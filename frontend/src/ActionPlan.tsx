import { useState } from 'react';
import { ArrowDownToLine, CalendarDays, Check, CheckCheck, ChevronDown, FileCheck2, ListChecks, Pencil, Quote, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Analysis, Evidence, Selection, Task } from './types';
import { calendarTasks, downloadFile, exportCalendar, exportChecklist, formatDate, isValidDate } from './exports';

interface Props {
  result: Analysis | null;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  selection: Selection | null;
  select: (key: string, evidence: Evidence) => void;
  busy: boolean;
  tryExample: () => void;
}

export default function ActionPlan({ result, tasks, setTasks, selection, select, busy, tryExample }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [editError, setEditError] = useState('');
  const [downloadStatus, setDownloadStatus] = useState('');
  const done = tasks.filter(task => task.done).length;
  const dated = calendarTasks(tasks).length;

  function startEdit(task: Task) {
    setEditing(task.id);
    setDraftTitle(task.title);
    setDraftDate(task.due_date || '');
    setEditError('');
  }

  function saveEdit(event: React.FormEvent, task: Task) {
    event.preventDefault();
    if (!draftTitle.trim()) { setEditError('Give this action a title.'); return; }
    if (draftDate && !isValidDate(draftDate)) { setEditError('Choose a valid date, or leave it blank.'); return; }
    const original = result!.actions.find(item => item.id === task.id)!;
    setTasks(previous => previous.map(item => item.id === task.id ? {
      ...item, title: draftTitle.trim(), due_date: draftDate || null,
      titleEdited: draftTitle.trim() !== original.title,
      dateEdited: (draftDate || null) !== original.due_date,
    } : item));
    setEditing(null);
  }

  function download(kind: 'checklist' | 'calendar') {
    if (!result) return;
    const name = result.mode === 'demo' ? 'demo-action-plan' : 'my-action-plan';
    if (kind === 'checklist') {
      downloadFile(exportChecklist(result, tasks), `${name}.txt`, 'text/plain;charset=utf-8');
      setDownloadStatus('Checklist downloaded.');
    } else {
      downloadFile(exportCalendar(result, tasks), `${name}.ics`, 'text/calendar;charset=utf-8');
      setDownloadStatus('Calendar file downloaded. Import it into your calendar; no alarms are set.');
    }
  }

  return <section className="plan-panel" aria-labelledby="plan-heading" aria-busy={busy}>
    <div className="panel-heading">
      <div className="heading-title"><ListChecks size={20} /><h2 id="plan-heading" tabIndex={-1}>Your action plan</h2></div>
      {result && <span className={`mode-badge ${result.mode}`}>{result.mode === 'demo' ? 'Demo example' : 'Live AI'}</span>}
    </div>
    {!result ? <div className="plan-empty">
      <div className={`paper-illustration ${busy ? 'is-loading' : ''}`} aria-hidden="true">
        <div className="mini-notice"><div className="mini-stamp"><FileCheck2 size={23} /></div><i /><i /><i /><i /></div>
        <div className="mini-checklist"><span><Check size={12} /><i /></span><span><Check size={12} /><i /></span><span><Check size={12} /><i /></span></div>
        <div className="illustration-link"><ListChecks size={20} /></div>
      </div>
      <h3>{busy ? 'Finding the next steps…' : 'A little clarity goes a long way.'}</h3>
      <p>{busy ? 'Reading your notice and checking the text behind each action. This can take up to a minute.' : 'See what to do, what to bring, and when it matters. Always with the original words to back it up.'}</p>
      {!busy && <button className="button text-button" onClick={tryExample}>See it with a school letter <ChevronDown size={15} className="rotate-arrow" /></button>}
      <div className="empty-promise"><Quote size={16} /><span>Clear actions. Traceable sources. No guessed deadlines.</span></div>
    </div> : <div className="plan-content">
      <div className={`mode-note ${result.mode}`}><ShieldCheck size={17} /><p>{result.mode_reason}</p></div>
      <div className="plan-summary"><h3>{result.title}</h3><p>{result.summary}</p></div>
      <div className="checklist-heading"><h4>What you need to do</h4><span>{done} of {tasks.length} done</span></div>
      <div className="progress-track" role="progressbar" aria-label="Checklist progress" aria-valuemin={0} aria-valuemax={tasks.length || 1} aria-valuenow={done}><span style={{ width: tasks.length ? `${done / tasks.length * 100}%` : '0%' }} /></div>
      <div className="task-list">
        {tasks.map(task => <article className={`task ${task.done ? 'is-done' : ''} ${selection?.key === task.id ? 'is-selected' : ''}`} key={task.id}>
          <div className="task-main">
            <label className="task-checkbox"><input type="checkbox" checked={task.done} aria-label={`Mark ${task.title} ${task.done ? 'incomplete' : 'complete'}`} onChange={() => setTasks(previous => previous.map(item => item.id === task.id ? { ...item, done: !item.done } : item))} /><span><Check size={14} strokeWidth={3} /></span></label>
            <div className="task-body">
              {editing === task.id ? <form className="edit-form" onSubmit={event => saveEdit(event, task)}>
                <label>Action title<input autoFocus value={draftTitle} maxLength={200} onChange={event => setDraftTitle(event.target.value)} required /></label>
                <label>Date <span>(optional)</span><input type="date" value={draftDate} min="0001-01-01" max="9998-12-31" onChange={event => setDraftDate(event.target.value)} /></label>
                <p className="edit-help">Your changes are labeled as edits, not source-verified facts.</p>
                {editError && <p className="inline-error" role="alert">{editError}</p>}
                <div className="edit-buttons"><button className="button primary small" type="submit">Save changes</button><button className="button subtle small" type="button" onClick={() => setEditing(null)}>Cancel</button></div>
              </form> : <>
                <div className="task-title-row"><h5>{task.title}</h5><button className="icon-button edit-task" aria-label={`Edit ${task.title}`} onClick={() => startEdit(task)}><Pencil size={14} /></button></div>
                <p className="task-detail">{task.detail}</p>
                <div className="task-meta">
                  {task.due_date ? task.dateEdited ? <span className="date-badge user-date"><CalendarDays size={13} />{formatDate(task.due_date)}<span className="edited-tag">Your date</span></span> : <button className="date-badge" title="Show the source for this date" onClick={() => task.deadline_evidence && select(`date-${task.id}`, task.deadline_evidence)}><CalendarDays size={13} />{formatDate(task.due_date)}</button> : <span className="no-date"><CalendarDays size={13} />{task.dateEdited ? 'Date removed by you' : 'No explicit date'}</span>}
                  {task.titleEdited && <span className="edited-tag">Title edited</span>}
                  <button className="source-button" aria-expanded={selection?.key === task.id} onClick={() => select(task.id, task.evidence)}><Quote size={13} />Show source</button>
                </div>
              </>}
            </div>
          </div>
          {(selection?.key === task.id || selection?.key === `date-${task.id}`) && <blockquote className="evidence-quote">“{selection.evidence.quote}”<span>Matched text in your notice</span></blockquote>}
        </article>)}
        {!tasks.length && <p className="no-items">No source-backed actions found. Check the original notice before deciding nothing is required.</p>}
      </div>
      {tasks.length > 0 && done === tasks.length && <div className="all-done"><CheckCheck size={18} /><span>All checked off. Keep your notice for reference.</span></div>}
      <section className="document-requirements" aria-labelledby="documents-heading">
        <h4 id="documents-heading"><FileCheck2 size={17} />Have these ready</h4>
        {result.documents.length ? <ul>{result.documents.map((document, index) => <li key={`${index}-${document.name}`}><span className="document-dot" /><span>{document.name}</span><button className="icon-button" aria-label={`Show source for ${document.name}`} onClick={() => select(`document-${index}`, document.evidence)}><Quote size={14} /></button>{selection?.key === `document-${index}` && <blockquote className="evidence-quote">“{document.evidence.quote}”</blockquote>}</li>)}</ul> : <p className="muted">No document requirements identified. Check the notice.</p>}
      </section>
      {result.warnings.length > 0 && <section className="review-note" aria-labelledby="review-heading"><h4 id="review-heading"><TriangleAlert size={17} />A few things to double-check</h4><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></section>}
      <div className="export-area"><div className="export-buttons"><button className="button primary" onClick={() => download('checklist')}><ArrowDownToLine size={16} />Download checklist</button><button className="button secondary" disabled={!dated} onClick={() => download('calendar')}><CalendarDays size={16} />Calendar <span className="button-count">{dated}</span></button></div><p>Calendar: remaining dated tasks as all-day events. No alarms or exact times. {result.mode === 'demo' && 'Demo events are labeled as fictional.'}</p><span className="download-status" role="status">{downloadStatus}</span></div>
    </div>}
  </section>;
}
