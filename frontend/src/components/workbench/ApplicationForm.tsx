import { FormEvent, useState } from 'react';
import { useResumeStore } from '../../stores/resume';
import { ApplicationInput, JobApplication } from '../../types/application';
import { Button } from '../common/Button';

interface ApplicationFormProps {
  editing: JobApplication | null;
  onSubmit: (input: ApplicationInput) => void;
  onCancel: () => void;
}

const inputClass =
  'min-h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none';

const emptyInput: ApplicationInput = {
  company: '',
  position: '',
  location: '',
  deadline: '',
  contact: '',
  resumeId: null,
  resumeTitle: '',
};

export function ApplicationForm({ editing, onSubmit, onCancel }: ApplicationFormProps) {
  const resumes = useResumeStore((state) => state.resumes);
  const [form, setForm] = useState<ApplicationInput>(
    editing
      ? {
          company: editing.company,
          position: editing.position,
          location: editing.location,
          deadline: editing.deadline,
          contact: editing.contact,
          resumeId: editing.resumeId,
          resumeTitle: editing.resumeTitle,
        }
      : emptyInput,
  );

  const patch = (partial: Partial<ApplicationInput>) => setForm((prev) => ({ ...prev, ...partial }));

  const handleResumeChange = (resumeId: string) => {
    const resume = resumes.find((item) => item.id === resumeId);
    patch({ resumeId: resume ? resume.id : null, resumeTitle: resume?.title ?? '' });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.company.trim() || !form.position.trim()) {
      return;
    }
    onSubmit(form);
    if (!editing) {
      setForm(emptyInput);
    }
  };

  return (
    <form className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-panel" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="block text-sm font-semibold text-[var(--ink)]">
          公司 <span className="text-[var(--danger)]">*</span>
          <input
            className={`${inputClass} mt-1`}
            onChange={(event) => patch({ company: event.target.value })}
            placeholder="例如：青松科技"
            required
            value={form.company}
          />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          岗位 <span className="text-[var(--danger)]">*</span>
          <input
            className={`${inputClass} mt-1`}
            onChange={(event) => patch({ position: event.target.value })}
            placeholder="例如：高级产品经理"
            required
            value={form.position}
          />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          所在地
          <input
            className={`${inputClass} mt-1`}
            onChange={(event) => patch({ location: event.target.value })}
            placeholder="例如：上海 / 远程"
            value={form.location}
          />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          截止时间
          <input
            className={`${inputClass} mt-1`}
            onChange={(event) => patch({ deadline: event.target.value })}
            type="date"
            value={form.deadline}
          />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          联系人
          <input
            className={`${inputClass} mt-1`}
            onChange={(event) => patch({ contact: event.target.value })}
            placeholder="例如：张 HR · 138xxxx · 微信"
            value={form.contact}
          />
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          关联简历
          <select
            className={`${inputClass} mt-1`}
            onChange={(event) => handleResumeChange(event.target.value)}
            value={form.resumeId ?? ''}
          >
            <option value="">不关联</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <Button type="submit" variant="primary">
          {editing ? '保存修改' : '添加申请'}
        </Button>
        <Button onClick={onCancel} type="button" variant="ghost">
          取消
        </Button>
      </div>
    </form>
  );
}
