export const APPLICATION_STAGES = ['待投递', '已投递', '笔试', '面试', 'Offer', '结束'] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export interface StageTransition {
  /** 起始阶段，为 null 表示这是创建记录 */
  from: ApplicationStage | null;
  to: ApplicationStage;
  /** ISO 时间串，记录本次变化发生的时间 */
  at: string;
}

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  location: string;
  /** YYYY-MM-DD，允许为空字符串表示未设置 */
  deadline: string;
  contact: string;
  /** 关联的简历 id；简历被删除后保留原值，用于识别“关联丢失” */
  resumeId: string | null;
  /** 关联时的简历标题快照，简历被删除后仍可展示“原关联” */
  resumeTitle: string;
  stage: ApplicationStage;
  timeline: StageTransition[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInput {
  company: string;
  position: string;
  location: string;
  deadline: string;
  contact: string;
  resumeId: string | null;
  resumeTitle: string;
}
