import { create } from 'zustand';
import { ApplicationInput, ApplicationStage, JobApplication } from '../types/application';
import { canTransition, normalizeApplications } from '../utils/application';
import { createId } from '../utils/format';
import { readStorage, storageKeys, writeStorage } from '../utils/storage';

interface ApplicationState {
  applications: JobApplication[];
  addApplication: (input: ApplicationInput) => string;
  updateApplication: (applicationId: string, patch: Partial<ApplicationInput>) => void;
  deleteApplication: (applicationId: string) => void;
  /** 仅允许相邻阶段推进或回退，成功时写入带时间的时间线并返回 true */
  transitionStage: (applicationId: string, to: ApplicationStage) => boolean;
  /** 关联丢失后重新关联简历；传 null 表示解除关联 */
  relinkResume: (applicationId: string, resumeId: string | null, resumeTitle?: string) => void;
  replaceApplications: (applications: JobApplication[]) => void;
}

function persist(applications: JobApplication[]): void {
  writeStorage(storageKeys.applications, applications);
}

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  applications: normalizeApplications(readStorage<unknown>(storageKeys.applications, [])),
  addApplication: (input) => {
    const now = new Date().toISOString();
    const application: JobApplication = {
      id: createId('app'),
      company: input.company.trim(),
      position: input.position.trim(),
      location: input.location.trim(),
      deadline: input.deadline,
      contact: input.contact.trim(),
      resumeId: input.resumeId,
      resumeTitle: input.resumeTitle,
      stage: '待投递',
      timeline: [{ from: null, to: '待投递', at: now }],
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ applications: [application, ...state.applications] }));
    persist(get().applications);
    return application.id;
  },
  updateApplication: (applicationId, patch) => {
    set((state) => ({
      applications: state.applications.map((application) =>
        application.id === applicationId
          ? { ...application, ...patch, updatedAt: new Date().toISOString() }
          : application,
      ),
    }));
    persist(get().applications);
  },
  deleteApplication: (applicationId) => {
    set((state) => ({ applications: state.applications.filter((item) => item.id !== applicationId) }));
    persist(get().applications);
  },
  transitionStage: (applicationId, to) => {
    const target = get().applications.find((item) => item.id === applicationId);
    if (!target || !canTransition(target.stage, to)) {
      return false;
    }
    const now = new Date().toISOString();
    set((state) => ({
      applications: state.applications.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              stage: to,
              timeline: [...application.timeline, { from: application.stage, to, at: now }],
              updatedAt: now,
            }
          : application,
      ),
    }));
    persist(get().applications);
    return true;
  },
  relinkResume: (applicationId, resumeId, resumeTitle = '') => {
    set((state) => ({
      applications: state.applications.map((application) =>
        application.id === applicationId
          ? { ...application, resumeId, resumeTitle, updatedAt: new Date().toISOString() }
          : application,
      ),
    }));
    persist(get().applications);
  },
  replaceApplications: (applications) => {
    const normalized = normalizeApplications(applications);
    set({ applications: normalized });
    persist(normalized);
  },
}));
