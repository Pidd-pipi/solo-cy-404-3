import { ChangeEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileJson, FilePlus2, Upload } from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { ResumeCard } from '../components/common/ResumeCard';
import { useWorkspaceBackup } from '../hooks/useWorkspaceBackup';
import { useApplicationStore } from '../stores/application';
import { useResumeStore } from '../stores/resume';

export function ResumeList() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resumes = useResumeStore((state) => state.resumes);
  const createResume = useResumeStore((state) => state.createResume);
  const duplicateResume = useResumeStore((state) => state.duplicateResume);
  const deleteResume = useResumeStore((state) => state.deleteResume);
  const { exportWorkspace, importWorkspace } = useWorkspaceBackup();

  const handleCreate = () => {
    const id = createResume();
    navigate(`/resumes/${id}/edit`);
  };

  const handleDelete = (resumeId: string) => {
    const linkedCount = useApplicationStore
      .getState()
      .applications.filter((application) => application.resumeId === resumeId).length;
    if (linkedCount > 0) {
      const confirmed = window.confirm(
        `该简历关联了 ${linkedCount} 个岗位申请。删除简历后申请会保留，但会失去关联（可在求职进展中重新关联）。确定删除吗？`,
      );
      if (!confirmed) {
        return;
      }
    }
    deleteResume(resumeId);
  };

  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      await importWorkspace(file);
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-[var(--accent-strong)]">Resume versions</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">简历列表</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">管理多个岗位版本，复制后可保留结构并快速改写内容。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FileJson size={16} aria-hidden />} onClick={exportWorkspace}>
            导出 JSON
          </Button>
          <Button icon={<Upload size={16} aria-hidden />} onClick={() => inputRef.current?.click()}>
            导入
          </Button>
          <Button icon={<FilePlus2 size={16} aria-hidden />} onClick={handleCreate} variant="primary">
            新建简历
          </Button>
          <input ref={inputRef} className="hidden" type="file" accept="application/json" onChange={handleImportJson} />
        </div>
      </div>

      {resumes.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            actionLabel="新建第一份简历"
            description="创建一份简历后，可以在编辑器里调整模块顺序、切换模板并导出 PDF。"
            icon={<FilePlus2 size={24} aria-hidden />}
            onAction={handleCreate}
            title="还没有简历"
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {resumes.map((resume) => (
            <ResumeCard key={resume.id} resume={resume} onDelete={handleDelete} onDuplicate={duplicateResume} />
          ))}
        </div>
      )}
    </div>
  );
}
