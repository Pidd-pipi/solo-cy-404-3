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

function normalizeTimeline(raw: unknown, fallbackStage: ApplicationStage, fallbackAt: string): StageTransition[] {
  if (!Array.isArray(raw)) {
    return [{ from: null, to: fallbackStage, at: fallbackAt }];
  }
  const entries = raw
    .filter((item): item is Partial<StageTransition> => Boolean(item) && typeof item === 'object')
    .filter((item) => isApplicationStage(item.to))
    .map((item) => ({
      from: isApplicationStage(item.from) ? item.from : null,
      to: item.to as ApplicationStage,
      at: typeof item.at === 'string' && item.at ? item.at : fallbackAt,
    }));
  return entries.length > 0 ? entries : [{ from: null, to: fallbackStage, at: fallbackAt }];
}

/** 把任意来源（旧备份、手工编辑的存储）的申请记录补齐为合法结构 */
export function normalizeApplication(raw: unknown): JobApplication | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const now = new Date().toISOString();
  const createdAt = typeof record.createdAt === 'string' && record.createdAt ? record.createdAt : now;
  const stage = isApplicationStage(record.stage) ? record.stage : '待投递';

  return {
    id: typeof record.id === 'string' && record.id ? record.id : createId('app'),
    company: typeof record.company === 'string' ? record.company : '',
    position: typeof record.position === 'string' ? record.position : '',
    location: typeof record.location === 'string' ? record.location : '',
    deadline: typeof record.deadline === 'string' ? record.deadline : '',
    contact: typeof record.contact === 'string' ? record.contact : '',
    resumeId: typeof record.resumeId === 'string' ? record.resumeId : null,
    resumeTitle: typeof record.resumeTitle === 'string' ? record.resumeTitle : '',
    stage,
    timeline: normalizeTimeline(record.timeline, stage, createdAt),
    createdAt,
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : createdAt,
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
