import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { Briefcase, FileJson, Plus, Upload } from 'lucide-react';
import { ApplicationCard } from '../components/workbench/ApplicationCard';
import { ApplicationForm } from '../components/workbench/ApplicationForm';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { useWorkspaceBackup } from '../hooks/useWorkspaceBackup';
import { useApplicationStore } from '../stores/application';
import { APPLICATION_STAGES, ApplicationInput, ApplicationStage, JobApplication } from '../types/application';

type StageFilter = ApplicationStage | '全部';

export function Workbench() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const applications = useApplicationStore((state) => state.applications);
  const addApplication = useApplicationStore((state) => state.addApplication);
  const updateApplication = useApplicationStore((state) => state.updateApplication);
  const { exportWorkspace, importWorkspace } = useWorkspaceBackup();

  const [filter, setFilter] = useState<StageFilter>('全部');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobApplication | null>(null);

  const counts = useMemo(() => {
    const result = new Map<ApplicationStage, number>();
    for (const application of applications) {
      result.set(application.stage, (result.get(application.stage) ?? 0) + 1);
    }
    return result;
  }, [applications]);

  const visible = useMemo(
    () =>
      applications
        .filter((application) => filter === '全部' || application.stage === filter)
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [applications, filter],
  );

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      await importWorkspace(file);
    }
  };

  const handleSubmit = (input: ApplicationInput) => {
    if (editing) {
      updateApplication(editing.id, input);
    } else {
      addApplication(input);
    }
    setEditing(null);
    setFormOpen(false);
  };

  const handleEdit = (application: JobApplication) => {
    setEditing(application);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setEditing(null);
    setFormOpen(false);
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-[var(--accent-strong)]">Job tracking</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">求职进展工作台</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            记录岗位申请，按 待投递 → 已投递 → 笔试 → 面试 → Offer → 结束 逐阶段推进，每次变化都会写入时间线。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FileJson size={16} aria-hidden />} onClick={exportWorkspace}>
            导出备份
          </Button>
          <Button icon={<Upload size={16} aria-hidden />} onClick={() => inputRef.current?.click()}>
            恢复备份
          </Button>
          <Button
            icon={<Plus size={16} aria-hidden />}
            onClick={() => (formOpen && !editing ? closeForm() : (setEditing(null), setFormOpen(true)))}
            variant="primary"
          >
            记录申请
          </Button>
          <input ref={inputRef} className="hidden" type="file" accept="application/json" onChange={handleImport} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['全部', ...APPLICATION_STAGES] as StageFilter[]).map((stage) => {
          const count = stage === '全部' ? applications.length : counts.get(stage) ?? 0;
          const active = filter === stage;
          return (
            <button
              className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                active
                  ? 'bg-[var(--surface-strong)] text-[var(--ink-invert)]'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-alt)]'
              }`}
              key={stage}
              onClick={() => setFilter(stage)}
              type="button"
            >
              {stage}
              <span className={active ? 'text-[var(--ink-invert)]' : 'text-[var(--accent-strong)]'}>{count}</span>
            </button>
          );
        })}
      </div>

      {formOpen ? (
        <div className="mt-6">
          <ApplicationForm editing={editing} key={editing?.id ?? 'new'} onCancel={closeForm} onSubmit={handleSubmit} />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            actionLabel="记录第一条申请"
            description="添加公司、岗位、截止时间和联系人，并关联一份简历；之后每次阶段变化都会留下时间线。"
            icon={<Briefcase size={24} aria-hidden />}
            onAction={() => (setEditing(null), setFormOpen(true))}
            title={filter === '全部' ? '还没有岗位申请' : `没有处于「${filter}」的申请`}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          {visible.map((application) => (
            <ApplicationCard application={application} key={application.id} onEdit={handleEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
