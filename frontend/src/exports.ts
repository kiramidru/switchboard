import type { Analysis, Task } from './types';

export function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
}

export function exportChecklist(analysis: Analysis, tasks: Task[]): string {
  const lines = [
    'Notice → Action', analysis.title, '',
    analysis.mode === 'demo' ? 'DEMO: fictional notice with prewritten results.' : 'AI-assisted analysis — review against the original notice.',
    analysis.summary, '', 'Your checklist', '',
  ];
  for (const task of tasks) {
    lines.push(`[${task.done ? 'x' : ' '}] ${task.title}${task.titleEdited ? ' (edited by you)' : ''}`);
    lines.push(`    ${task.detail}`);
    lines.push(`    Date: ${task.due_date || 'Not stated'}${task.dateEdited ? ' (set by you; not source-verified)' : ''}`);
    lines.push(`    Source: ${task.evidence.quote}`, '');
  }
  lines.push('Documents to have ready');
  lines.push(...(analysis.documents.length ? analysis.documents.map(item => `- ${item.name}\n  Source: ${item.evidence.quote}`) : ['None identified. Check the original notice.']));
  lines.push('', 'Details to double-check', ...analysis.warnings.map(warning => `- ${warning}`));
  lines.push('', 'Original notice', analysis.source_text, '', 'This app helps organize a notice; it does not verify its legitimacy or replace the original.');
  return lines.join('\n');
}

export function escapeCalendar(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

// RFC 5545 folds at 75 UTF-8 octets, without splitting a Unicode character.
export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  let folded = '';
  let count = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (count + bytes > 75) { folded += '\r\n '; count = 1; }
    folded += char;
    count += bytes;
  }
  return folded;
}

export function calendarTasks(tasks: Task[]): Task[] {
  return tasks.filter(task => !task.done && isValidDate(task.due_date));
}

export function exportCalendar(analysis: Analysis, tasks: Task[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Notice to Action//Action plan//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeCalendar(analysis.title)}`,
  ];
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  for (const task of calendarTasks(tasks)) {
    const start = task.due_date!;
    const nextDay = new Date(start + 'T00:00:00Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const details = [
      analysis.mode === 'demo' ? 'DEMO — fictional example, not a real obligation.' : 'Review this AI-assisted task against the original notice.',
      task.detail,
      task.dateEdited ? 'Date set by you; not source-verified.' : 'Date matched to the notice. Confirm that it applies to you.',
      task.titleEdited ? 'Title edited by you.' : '',
      'All-day event. Check the original for exact times; no alarm is set.',
      `Source: ${task.evidence.quote}`,
    ].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT', `UID:${analysis.id}-${task.id}@notice-to-action.local`,
      `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${start.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${nextDay.toISOString().slice(0, 10).replace(/-/g, '')}`,
      `SUMMARY:${escapeCalendar((analysis.mode === 'demo' ? '[Demo] ' : '') + task.title)}`,
      `DESCRIPTION:${escapeCalendar(details)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}

export function downloadFile(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
