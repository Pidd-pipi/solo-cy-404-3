import dayjs from 'dayjs';
import { APPLICATION_STAGES, ApplicationStage, JobApplication, StageTransition } from '../types/application';
import { createId } from './format';

export function isApplicationStage(value: unknown): value is ApplicationStage {
  return typeof value === 'string' && (APPLICATION_STAGES as readonly string[]).includes(value);
}

export function stageIndex(stage: ApplicationStage): number {
  return APPLICATION_STAGES.indexOf(stage);
}

/** 阶段只允许在 待投递→已投递→笔试→面试→Offer→结束 上相邻推进或回退 */
export function canTransition(from: ApplicationStage, to: ApplicationStage): boolean {
  if (!isApplicationStage(from) || !isApplicationStage(to)) {
    return false;
  }
  return Math.abs(stageIndex(from) - stageIndex(to)) === 1;
}

export function adjacentStages(stage: ApplicationStage): { prev: ApplicationStage | null; next: ApplicationStage | null } {
  const index = stageIndex(stage);
  return {
    prev: index > 0 ? APPLICATION_STAGES[index - 1] : null,
    next: index < APPLICATION_STAGES.length - 1 ? APPLICATION_STAGES[index + 1] : null,
  };
}

export function isTerminalStage(stage: ApplicationStage): boolean {
  return stage === 'Offer' || stage === '结束';
}

export type DeadlineTone = 'none' | 'soon' | 'overdue';

/** 截止提醒：已过期（未到 Offer/结束）标红，3 天内标黄 */
export function deadlineTone(deadline: string, stage: ApplicationStage): DeadlineTone {
  if (!deadline || isTerminalStage(stage)) {
    return 'none';
  }
  const target = dayjs(deadline);
  if (!target.isValid()) {
    return 'none';
  }
  const days = target.startOf('day').diff(dayjs().startOf('day'), 'day');
  if (days < 0) {
    return 'overdue';
  }
  return days <= 3 ? 'soon' : 'none';
}

function stepToward(current: ApplicationStage, target: ApplicationStage): ApplicationStage {
  const from = stageIndex(current);
  const to = stageIndex(target);
  return APPLICATION_STAGES[to > from ? from + 1 : from - 1];
}

/** 从时间线末端沿相邻阶段行进到 target，补齐中间每一步 */
function appendAdjacentPath(timeline: StageTransition[], target: ApplicationStage, at: string): void {
  let current = timeline[timeline.length - 1].to;
  while (current !== target) {
    const next = stepToward(current, target);
    timeline.push({ from: current, to: next, at });
    current = next;
  }
}

/**
 * 把任意来源的时间线收敛为合法路径：
 * - 第一步是创建记录（from 为 null），锚点取首条记录的 from（非法时取 to）；
 * - 后续每一步只能相邻推进或回退，跳级/缺步时沿相邻阶段补齐中间步；
 * - 记录中的 from 与当前位置冲突时，以实际当前位置为准。
 * 合法时间线（本应用产生的）经过此函数保持不变。
 */
function normalizeTimeline(raw: unknown, fallbackAt: string): StageTransition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const repaired: StageTransition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const entry = item as Partial<StageTransition>;
    if (!isApplicationStage(entry.to)) {
      continue;
    }
    const at = typeof entry.at === 'string' && entry.at ? entry.at : fallbackAt;
    if (repaired.length === 0) {
      const anchor = isApplicationStage(entry.from) ? entry.from : entry.to;
      repaired.push({ from: null, to: anchor, at });
    }
    appendAdjacentPath(repaired, entry.to, at);
  }
  return repaired;
}

/**
 * 把任意来源（旧备份、手工编辑的存储）的申请记录补齐为合法结构。
 * 恢复后保证：stage 与时间线最后一步一致；时间线每一步都是相邻推进或回退。
 */
export function normalizeApplication(raw: unknown): JobApplication | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const now = new Date().toISOString();
  const createdAt = typeof record.createdAt === 'string' && record.createdAt ? record.createdAt : now;
  const updatedAt = typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : createdAt;
  const recordedStage = isApplicationStage(record.stage) ? record.stage : null;

  const timeline = normalizeTimeline(record.timeline, createdAt);
  if (timeline.length === 0) {
    const stage = recordedStage ?? '待投递';
    timeline.push({ from: null, to: stage, at: createdAt });
  } else if (recordedStage && recordedStage !== timeline[timeline.length - 1].to) {
    // 阶段与时间线末步冲突：沿相邻路径补齐到记录的阶段，收敛为可解释的合法历史
    appendAdjacentPath(timeline, recordedStage, updatedAt);
  }

  return {
    id: typeof record.id === 'string' && record.id ? record.id : createId('app'),
    company: typeof record.company === 'string' ? record.company : '',
    position: typeof record.position === 'string' ? record.position : '',
    location: typeof record.location === 'string' ? record.location : '',
    deadline: typeof record.deadline === 'string' ? record.deadline : '',
    contact: typeof record.contact === 'string' ? record.contact : '',
    resumeId: typeof record.resumeId === 'string' ? record.resumeId : null,
    resumeTitle: typeof record.resumeTitle === 'string' ? record.resumeTitle : '',
    stage: timeline[timeline.length - 1].to,
    timeline,
    createdAt,
    updatedAt,
  };
}

/** 规范化申请列表：过滤坏记录、按 id 去重，保证恢复备份后历史不重复 */
export function normalizeApplications(raw: unknown): JobApplication[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: JobApplication[] = [];
  for (const item of raw) {
    const application = normalizeApplication(item);
    if (!application || seen.has(application.id)) {
      continue;
    }
    seen.add(application.id);
    result.push(application);
  }
  return result;
}
