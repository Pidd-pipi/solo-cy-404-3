import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Link2,
  Link2Off,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useApplicationStore } from '../../stores/application';
import { useResumeStore } from '../../stores/resume';
import { JobApplication } from '../../types/application';
import { adjacentStages, deadlineTone } from '../../utils/application';
import { formatDateTime } from '../../utils/format';
import { Button } from '../common/Button';

interface ApplicationCardProps {
  application: JobApplication;
  onEdit: (application: JobApplication) => void;
}

function stageBadgeClass(stage: JobApplication['stage']): string {
  if (stage === 'Offer') {
    return 'bg-[var(--gold)] text-white';
  }
  if (stage === '结束') {
    return 'bg-[var(--surface-alt)] text-[var(--muted)]';
  }
  return 'bg-[var(--accent-soft)] text-[var(--accent-strong)]';
}

const selectClass =
  'min-h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none';

export function ApplicationCard({ application, onEdit }: ApplicationCardProps) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const resumes = useResumeStore((state) => state.resumes);
  const transitionStage = useApplicationStore((state) => state.transitionStage);
  const deleteApplication = useApplicationStore((state) => state.deleteApplication);
  const relinkResume = useApplicationStore((state) => state.relinkResume);

  const linkedResume = resumes.find((resume) => resume.id === application.resumeId);
  const linkLost = Boolean(application.resumeId) && !linkedResume;
  const { prev, next } = adjacentStages(application.stage);
  const tone = deadlineTone(application.deadline, application.stage);

  const handleRelink = (resumeId: string) => {
    const resume = resumes.find((item) => item.id === resumeId);
    relinkResume(application.id, resume ? resume.id : null, resume?.title ?? '');
  };

  const handleDelete = () => {
    if (window.confirm(`确定删除「${application.company} · ${application.position}」的申请及其时间线吗？`)) {
      deleteApplication(application.id);
    }
  };

  return (
    <article className="flex flex-col gap-4 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold text-[var(--ink)]">{application.company}</h3>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{application.position}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${stageBadgeClass(application.stage)}`}>
          {application.stage}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
        {application.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} aria-hidden /> {application.location}
          </span>
        ) : null}
        {application.deadline ? (
          <span
            className={`inline-flex items-center gap-1.5 ${
              tone === 'overdue' ? 'font-semibold text-[var(--danger)]' : tone === 'soon' ? 'font-semibold text-[var(--gold)]' : ''
            }`}
          >
            <CalendarDays size={14} aria-hidden /> 截止 {application.deadline}
            {tone === 'overdue' ? '（已过期）' : tone === 'soon' ? '（临近）' : ''}
          </span>
        ) : null}
        {application.contact ? (
          <span className="inline-flex items-center gap-1.5">
            <UserRound size={14} aria-hidden /> {application.contact}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {linkedResume ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-alt)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
            <Link2 size={13} aria-hidden /> 已关联简历：{linkedResume.title}
          </span>
        ) : linkLost ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--danger)]">
              <Link2Off size={13} aria-hidden /> 原关联「{application.resumeTitle || '未知简历'}」已删除，申请已保留
            </span>
            <select className={selectClass} onChange={(event) => handleRelink(event.target.value)} value="">
              <option disabled value="">
                重新关联简历…
              </option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title}
                </option>
              ))}
            </select>
          </>
        ) : (
          <select className={selectClass} onChange={(event) => handleRelink(event.target.value)} value="">
            <option disabled value="">
              关联简历（可选）…
            </option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
        <Button disabled={!prev} icon={<ChevronLeft size={15} aria-hidden />} onClick={() => prev && transitionStage(application.id, prev)}>
          {prev ? `回退到${prev}` : '已是起始阶段'}
        </Button>
        <Button
          disabled={!next}
          icon={<ChevronRight size={15} aria-hidden />}
          onClick={() => next && transitionStage(application.id, next)}
          variant="primary"
        >
          {next ? `推进到${next}` : '已到最终阶段'}
        </Button>
        <div className="ms-auto flex gap-1">
          <Button icon={<History size={15} aria-hidden />} onClick={() => setTimelineOpen((open) => !open)} variant="ghost">
            时间线 · {application.timeline.length}
          </Button>
          <Button icon={<Pencil size={15} aria-hidden />} onClick={() => onEdit(application)} variant="ghost">
            编辑
          </Button>
          <Button className="text-[var(--danger)]" icon={<Trash2 size={15} aria-hidden />} onClick={handleDelete} variant="ghost">
            删除
          </Button>
        </div>
      </div>

      {timelineOpen ? (
        <ol className="flex flex-col gap-2 border-l-2 border-[var(--border)] ps-4 text-sm">
          {[...application.timeline].reverse().map((entry, index) => (
            <li className="relative" key={`${entry.at}-${index}`}>
              <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" aria-hidden />
              <span className="font-semibold text-[var(--ink)]">
                {entry.from ? `${entry.from} → ${entry.to}` : `创建记录 · ${entry.to}`}
              </span>
              <span className="ms-2 text-xs text-[var(--muted)]">{formatDateTime(entry.at)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}
