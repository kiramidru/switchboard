import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calendarTasks, escapeCalendar, exportCalendar, exportChecklist, foldCalendarLine, formatDate, isValidDate } from './exports.ts';
import type { Analysis, Task } from './types.ts';

const task: Task = {
  id: 'action-1', title: 'Return form, signed; today', detail: 'Keep the original.\nCheck the time.',
  evidence: { quote: 'Return the form by June 10, 2027.', start: 0, end: 34 },
  due_date: '2027-06-10', deadline_evidence: null, done: false, titleEdited: false, dateEdited: false,
};
const analysis: Analysis = {
  id: 'test-id', title: 'School trip', summary: 'Return the form.', source_text: task.evidence.quote,
  actions: [task], documents: [], warnings: ['Departure time is unknown.'],
  mode: 'demo', mode_reason: 'Fictional example.', source_type: 'example', created_at: '2027-01-01T00:00:00Z',
};

test('dates are strict, real calendar dates, and timezone independent', () => {
  assert.equal(isValidDate('2027-06-10'), true);
  assert.equal(isValidDate('2027-02-29'), false);
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(isValidDate('2027-6-1'), false);
  assert.equal(isValidDate(null), false);
  assert.equal(formatDate('2027-06-10'), 'Jun 10, 2027');
});

test('calendar exports only remaining, dated tasks', () => {
  assert.equal(calendarTasks([task, { ...task, done: true }, { ...task, due_date: null }]).length, 1);
});

test('calendar values cannot inject event lines', () => {
  assert.equal(escapeCalendar('a,b;c\\d\r\nBEGIN:VEVENT'), 'a\\,b\\;c\\\\d\\nBEGIN:VEVENT');
});

test('calendar folding respects UTF-8 octet limits and unfolds losslessly', () => {
  const text = 'DESCRIPTION:' + '📬café, '.repeat(60);
  const folded = foldCalendarLine(text);
  for (const line of folded.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), text);
});

test('calendar has exclusive next-day end and an explicit demo label', () => {
  const calendar = exportCalendar(analysis, [task], new Date('2027-01-01T12:30:00Z'));
  const unfolded = calendar.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('DTSTART;VALUE=DATE:20270610\r\n'));
  assert.ok(unfolded.includes('DTEND;VALUE=DATE:20270611\r\n'));
  assert.ok(unfolded.includes('DTSTAMP:20270101T123000Z'));
  assert.ok(unfolded.includes('SUMMARY:[Demo] Return form\\, signed\\; today'));
  assert.ok(unfolded.includes('fictional example'));
  assert.ok(!unfolded.includes('BEGIN:VALARM'));
  assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
});

test('calendar handles month and year boundaries', () => {
  const calendar = exportCalendar(analysis, [{ ...task, due_date: '2027-12-31' }]);
  assert.ok(calendar.includes('DTEND;VALUE=DATE:20280101'));
});

test('user edits are not presented as verified dates or titles', () => {
  const edited = { ...task, due_date: '2027-06-15', titleEdited: true, dateEdited: true };
  const checklist = exportChecklist(analysis, [edited]);
  assert.ok(checklist.includes('edited by you'));
  assert.ok(checklist.includes('not source-verified'));
  const calendar = exportCalendar(analysis, [edited]).replace(/\r\n /g, '');
  assert.ok(calendar.includes('Date set by you\\; not source-verified.'));
});

test('checklist includes completion state, source text, warnings, and demo context', () => {
  const checklist = exportChecklist(analysis, [{ ...task, done: true }]);
  assert.ok(checklist.includes('[x] Return form'));
  assert.ok(checklist.includes('DEMO: fictional'));
  assert.ok(checklist.includes('Original notice\n' + task.evidence.quote));
  assert.ok(checklist.includes('Departure time is unknown.'));
});
