import { JobApplication } from '../types/application';
import { Profile } from '../types/profile';
import { Resume } from '../types/resume';
import { normalizeApplications } from '../utils/application';
import { readStorage, storageKeys, writeStorage } from '../utils/storage';

export interface WorkspaceSnapshot {
  exportedAt: string;
  resumes: Resume[];
  activeResumeId: string | null;
  profile: Profile;
  selectedTemplateId: string;
  theme: 'light' | 'dark';
  /** 求职进展：申请 + 阶段时间线 + 简历关联。旧备份可能没有该字段 */
  applications?: JobApplication[];
}

export function readWorkspaceSnapshot(fallbackProfile: Profile): WorkspaceSnapshot {
  return {
    exportedAt: new Date().toISOString(),
    resumes: readStorage<Resume[]>(storageKeys.resumes, []),
    activeResumeId: readStorage<string | null>(storageKeys.activeResumeId, null),
    profile: readStorage<Profile>(storageKeys.profile, fallbackProfile),
    selectedTemplateId: readStorage<string>(storageKeys.template, 'atelier'),
    theme: readStorage<'light' | 'dark'>(storageKeys.theme, 'light'),
    applications: normalizeApplications(readStorage<unknown>(storageKeys.applications, [])),
  };
}

export function writeWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  writeStorage(storageKeys.resumes, snapshot.resumes);
  writeStorage(storageKeys.activeResumeId, snapshot.activeResumeId);
  writeStorage(storageKeys.profile, snapshot.profile);
  writeStorage(storageKeys.template, snapshot.selectedTemplateId);
  writeStorage(storageKeys.theme, snapshot.theme);
  // 旧备份缺少 applications 字段时保留现有申请数据，不覆盖
  if (snapshot.applications !== undefined) {
    writeStorage(storageKeys.applications, normalizeApplications(snapshot.applications));
  }
}
