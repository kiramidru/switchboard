import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Camera, Check, ChevronRight, CircleHelp, FileText, GraduationCap, House, ImagePlus, LoaderCircle, LockKeyhole, RotateCcw, ScanText, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import { analyzeNotice, getExamples, getHealth } from './api';
import ActionPlan from './ActionPlan';
import type { Analysis, Evidence, Example, Health, Selection, Task } from './types';

function SourceText({ text, evidence }: { text: string; evidence: Evidence | null }) {
  const mark = useRef<HTMLElement>(null);
  useEffect(() => { mark.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [evidence]);
  // API offsets count Unicode code points; JS string offsets otherwise count UTF-16 units.
  const chars = Array.from(text);
  return <pre className="document-text">{evidence ? <>{chars.slice(0, evidence.start).join('')}<mark ref={mark}>{chars.slice(evidence.start, evidence.end).join('')}</mark>{chars.slice(evidence.end).join('')}</> : text}</pre>;
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [examples, setExamples] = useState<Example[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [inputType, setInputType] = useState<'text' | 'image'>('text');
  const [example, setExample] = useState<Example | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [dragging, setDragging] = useState(false);
  const [dialogMode, setDialogMode] = useState<'examples' | 'how' | 'privacy' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);

  async function connect() {
    setConnectionError(false);
    try {
      const [status, samples] = await Promise.all([getHealth(), getExamples()]);
      setHealth(status);
      setExamples(samples);
    } catch { setConnectionError(true); }
  }
  useEffect(() => { void connect(); return () => request.current?.abort(); }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (dialogMode) dialog.current?.showModal();
    else dialog.current?.close();
  }, [dialogMode]);
  useEffect(() => {
    if (!result) return;
    const heading = document.getElementById('plan-heading');
    heading?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 760px)').matches) {
      heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [result]);

  function clearResult() { setResult(null); setTasks([]); setSelection(null); setError(''); setAnnouncement(''); }
  function clearNotice() { clearResult(); setText(''); setFile(null); setExample(null); }
  function changeInput(next: 'text' | 'image') { if (next !== inputType) { clearNotice(); setInputType(next); } }
  function updateText(value: string) { clearResult(); setText(value); setExample(null); }
  function chooseFile(next: File | undefined) {
    if (!next || busy) return;
    clearResult();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setError('Choose a JPEG, PNG, or WebP photo.'); return; }
    if (next.size > 8 * 1024 * 1024) { setError('Keep your photo under 8 MB. Try cropping or resizing it.'); return; }
    setFile(next); setText(''); setExample(null);
  }
  function loadExample(next: Example) {
    clearResult(); setExample(next); setText(next.text); setFile(null); setInputType('text');
  }
  function select(key: string, evidence: Evidence) { setSelection(previous => previous?.key === key ? null : { key, evidence }); }

  async function analyze(sample?: Example, forceDemo = false) {
    if (busy) return;
    const chosen = sample || example;
    const data = new FormData();
    if (chosen) data.append('example_id', chosen.id);
    else if (inputType === 'image' && file) data.append('image', file);
    else if (text.trim()) data.append('text', text.trim());
    else return;
    if (forceDemo) data.append('use_demo', 'true');
    if (sample) loadExample(sample);
    clearResult(); setBusy(true);
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 75000);
    try {
      const analysis = await analyzeNotice(data, controller.signal);
      setResult(analysis);
      setTasks(analysis.actions.map(action => ({ ...action, done: false, titleEdited: false, dateEdited: false })));
      setAnnouncement(`${analysis.actions.length} actions found. ${analysis.mode === 'demo' ? 'Showing prewritten demo results.' : 'Review the AI-assisted action plan.'}`);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'AbortError' ? 'Analysis timed out. Try a shorter notice, a clearer photo, or a demo example.' : cause instanceof TypeError ? 'Cannot reach the server. Start the Python API and try again.' : cause instanceof Error ? cause.message : 'Analysis failed. Please try again.');
    } finally { clearTimeout(timeout); setBusy(false); request.current = null; }
  }

  function openDemo(next: Example) { setDialogMode(null); void analyze(next, true); }
  const hasInput = inputType === 'image' ? !!file : !!text.trim();
  const ready = health?.ai_configured;

  return <>
    <a className="skip-link" href="#workspace">Skip to notice workspace</a>
    <header className="site-header"><div className="header-inner">
      <a href="/notice" className="wordmark" aria-label="Notice to Action home"><span className="brand-symbol"><FileText size={22} /><span><Check size={10} strokeWidth={3} /></span></span><span>notice<span className="brand-arrow">→</span>action</span></a>
      <nav aria-label="Main navigation"><button className="nav-link" onClick={() => setDialogMode('how')}><CircleHelp size={16} />How it works</button><button className="button secondary header-demo" onClick={() => setDialogMode('examples')} disabled={busy || !examples.length}>Try an example<ArrowRight size={16} /></button></nav>
    </div></header>
    <main className="page-shell">
      <section className="intro" aria-labelledby="intro-heading"><div><div className="intro-context"><span className="context-line" />A clearer way through everyday paperwork</div><h1 id="intro-heading">Make sense of<br />what comes next.</h1><p>Turn a confusing notice into a clear next step.<br className="desktop-break" /> Less second-guessing. Nothing lost between the lines.</p></div><div className="intro-aside"><span className="source-to-step"><FileText size={19} /><span /><ListIcon /></span><p>Your notice, made practical.<br /><strong>Not rewritten. Understood.</strong></p><div className="review-first"><ShieldCheck size={15} />Built for you to double-check</div></div></section>
      <div className="workspace-topline"><p><span className={`status-dot ${ready ? 'live' : ''}`} />{connectionError ? 'Server not connected' : health ? ready ? 'Live analysis ready' : 'Demo ready — try a fictional example' : 'Connecting to your workspace…'}</p><span><LockKeyhole size={13} />No accounts. No saved history.</span></div>
      {connectionError && <div className="connection-error" role="alert"><p>Start the Python server on port 8000 to use the workspace.</p><button className="button subtle small" onClick={() => void connect()}>Retry connection</button></div>}
      <div className="workspace" id="workspace">
        <section className="source-panel" aria-labelledby="source-heading">
          <div className="panel-heading"><div className="heading-title"><FileText size={19} /><h2 id="source-heading">Your notice</h2></div>{hasInput && <button className="reset-button" disabled={busy} onClick={clearNotice}><RotateCcw size={13} />Clear</button>}</div>
          {!result ? <>
            <div className="input-switch" role="group" aria-label="Choose notice input method"><button aria-pressed={inputType === 'text'} disabled={busy} onClick={() => changeInput('text')}><ScanText size={16} />Paste text</button><button aria-pressed={inputType === 'image'} disabled={busy} onClick={() => changeInput('image')}><Camera size={16} />Upload photo</button></div>
            <div className="source-input-area">
              {inputType === 'text' ? <><div className="field-label"><label htmlFor="notice-text">The original words</label>{example && <span className="sample-label">Fictional example</span>}</div><textarea id="notice-text" value={text} onChange={event => updateText(event.target.value)} disabled={busy} maxLength={20000} aria-describedby="text-help" placeholder={'Paste your school letter, appointment notice, or community announcement here.\n\nWe’ll find the actions and deadlines — and show you exactly where they came from.'} /><div className="input-footnote"><span id="text-help">One notice at a time.</span><span>{text.length.toLocaleString()} / 20,000</span></div></> : <><div className="field-label"><label htmlFor="notice-photo">A clear photo of your notice</label></div>{file ? <div className="photo-preview"><img src={preview} alt="Your uploaded notice" /><div><span>{file.name}</span><button className="icon-button" disabled={busy} onClick={() => { setFile(null); clearResult(); }} aria-label="Remove photo"><X size={16} /></button></div></div> : <div className={`drop-zone ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}><div className="upload-symbol"><ImagePlus size={30} strokeWidth={1.5} /></div><strong>Drop your notice here</strong><span>or choose a photo from your device</span><span className="upload-type">JPEG, PNG, or WebP · up to 8 MB</span><input id="notice-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload a notice photo" aria-describedby="photo-help" disabled={busy} onChange={event => { chooseFile(event.target.files?.[0]); event.target.value = ''; }} /></div>}<p id="photo-help" className="photo-help">Keep the full notice in frame with sharp, readable text. AI transcription still needs your review.</p></>}
            </div>
            <div className="sample-picker"><span>Or start with an example</span><div>{examples.map(item => <button disabled={busy} className={example?.id === item.id ? 'selected' : ''} onClick={() => loadExample(item)} key={item.id}>{item.category === 'School' ? <GraduationCap size={14} /> : item.category === 'Housing' ? <House size={14} /> : <BookOpen size={14} />}{item.category}</button>)}</div></div>
            <div className="analyze-area">{error && <div className="error-message" role="alert"><CircleHelp size={17} /><p>{error}</p></div>}<button className="button primary analyze-button" disabled={!hasInput || busy} onClick={() => void analyze()}>{busy ? <><LoaderCircle size={18} className="spinner" />Reading your notice…</> : <><Sparkles size={17} />Make my action plan<ArrowRight size={17} /></>}</button><p><LockKeyhole size={13} /><span>{ready ? 'Live analysis sends your notice to OpenAI. Avoid sensitive personal information.' : 'Examples work without a key. Your own notices need server-side AI setup.'} <button className="inline-link" onClick={() => setDialogMode('privacy')}>Privacy details</button></span></p></div>
          </> : <div className="source-result"><div className="document-toolbar"><span>{result.source_type === 'image' ? 'AI transcription · check photo' : result.mode === 'demo' ? 'Fictional example notice' : 'Original notice text'}</span><button className="inline-link" onClick={() => { clearResult(); }}>Edit notice</button></div>{preview && <details className="original-photo"><summary><Camera size={15} />Compare with original photo</summary><img src={preview} alt="Original uploaded notice for comparison with the AI transcription" /></details>}<div className="document-sheet" tabIndex={0} role="region" aria-label="Notice text with source highlights"><SourceText text={result.source_text} evidence={selection?.evidence || null} /></div><div className="source-legend"><span className="highlight-swatch" /><p>Choose <strong>Show source</strong> on an action to find its original words here.</p></div></div>}
        </section>
        <ActionPlan key={result?.id || 'empty'} result={result} tasks={tasks} setTasks={setTasks} selection={selection} select={select} busy={busy} tryExample={() => examples[0] && openDemo(examples[0])} />
      </div>
      <p className="workspace-disclaimer"><ShieldCheck size={15} /><span>A helpful second read, not the final word. Always check your original notice before acting.</span></p>
      <section className="how-strip" aria-label="How Notice to Action works"><div><span className="how-icon"><Upload size={18} /></span><p><strong>Bring the notice</strong><span>Paste the words or upload a photo.</span></p></div><ChevronRight size={17} className="step-chevron" /><div><span className="how-icon"><ScanText size={19} /></span><p><strong>Find the next steps</strong><span>Actions, dates, and things to bring.</span></p></div><ChevronRight size={17} className="step-chevron" /><div><span className="how-icon"><ShieldCheck size={18} /></span><p><strong>Check it. Make it yours.</strong><span>Review sources, edit, and take it with you.</span></p></div></section>
    </main>
    <footer className="site-footer"><span>Made for the moments that need a little clarity.</span><button onClick={() => setDialogMode('privacy')}>Privacy & limitations</button><span className="footer-brand">Notice → Action</span></footer>
    <span className="sr-only" role="status">{announcement}</span>
    <dialog ref={dialog} className="info-dialog" aria-labelledby="dialog-heading" onClose={() => setDialogMode(null)} onClick={event => { if (event.target === event.currentTarget) setDialogMode(null); }}><div className="dialog-inner"><button className="icon-button dialog-close" onClick={() => setDialogMode(null)} aria-label="Close dialog"><X size={20} /></button>
      {dialogMode === 'examples' ? <><span className="dialog-icon"><FileText size={24} /></span><h2 id="dialog-heading">A familiar notice. A clearer plan.</h2><p>Explore a fictional example with prewritten results. No API key needed, and no real obligations.</p><div className="example-options">{examples.map(item => <button key={item.id} disabled={busy} onClick={() => openDemo(item)}><span className="example-icon">{item.category === 'School' ? <GraduationCap size={23} /> : item.category === 'Housing' ? <House size={23} /> : <BookOpen size={23} />}</span><span><strong>{item.label}</strong><span>{item.description}</span></span><ArrowRight size={18} /></button>)}</div></> : dialogMode === 'how' ? <><span className="dialog-icon"><ScanText size={24} /></span><h2 id="dialog-heading">From a notice to a next step.</h2><ol className="how-list"><li><strong>Add one notice.</strong> Paste text or upload a clear JPEG, PNG, or WebP photo.</li><li><strong>Read your action plan.</strong> See requirements, explicit dates, and required documents. Missing details are flagged.</li><li><strong>Check the evidence.</strong> Each action links to matching words in the notice. Matching text is not a guarantee that AI interpreted it correctly.</li><li><strong>Make it useful.</strong> Check off tasks, edit a title or date, and download your checklist or all-day calendar events.</li></ol><p>For photos, check the AI transcription against the original image too.</p><button className="button primary" disabled={busy || !examples.length} onClick={() => setDialogMode('examples')}>Try an example<ArrowRight size={16} /></button></> : <><span className="dialog-icon"><LockKeyhole size={24} /></span><h2 id="dialog-heading">Your notice stays your business.</h2><div className="privacy-copy"><h3>No saved notice history</h3><p>This app has no accounts, database, or browser storage for notices. Your plan stays in page memory until you clear or reload it. Uploads may use temporary server files during a request; the app does not retain them as a history.</p><h3>Live AI is an external service</h3><p>Your notice is sent to OpenAI when live analysis is used. We request no stored API response, but OpenAI’s own data retention and processing policies still apply. Avoid uploading IDs, medical records, financial details, or other sensitive information.</p><h3>Evidence is a starting point</h3><p>Quotes are matched to the notice text. This does not prove the interpretation, transcription, or notice itself is correct. Dates need an explicit year; ambiguous dates are left for you to resolve.</p><h3>Your downloads are your files</h3><p>Checklists include the notice text. Calendar files include task details and quotations. Store and share them carefully. Calendar entries are all-day and do not set alarms.</p></div></>}
    </div></dialog>
  </>;
}

function ListIcon() { return <span className="small-list-icon" aria-hidden="true"><Check size={12} /><i /><Check size={12} /><i /></span>; }
