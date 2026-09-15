import { readWorkspaceSnapshot, writeWorkspaceSnapshot, WorkspaceSnapshot } from '../api/storage';
import { defaultProfile } from '../stores/profile';
import { downloadJson, readJsonFile } from '../utils/storage';

/** 工作区整体备份/恢复：简历、个人资料、主题、岗位申请（含时间线与简历关联） */
export function useWorkspaceBackup() {
  const exportWorkspace = () => {
    downloadJson('smart-resume-workspace.json', readWorkspaceSnapshot(defaultProfile));
  };

  const importWorkspace = async (file: File) => {
    const snapshot = await readJsonFile<WorkspaceSnapshot>(file);
    writeWorkspaceSnapshot(snapshot);
    window.location.reload();
  };

  return { exportWorkspace, importWorkspace };
}
