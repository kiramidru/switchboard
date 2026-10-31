import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Eye,
  FileCheck2,
  Keyboard,
  ListChecks,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { FormAdapter } from "./adapter";
import { fieldComplete, fieldValue } from "./types";
import type { FormField, PageSnapshot, Review, SessionEvent } from "./types";
import { useScanner } from "./useScanner";
import { bufferedKind, KEY_ROWS, validDraft } from "./keyboard";
type View =
  | { kind: "home" | "settings" | "forms" | "activity" | "review" }
  | { kind: "section"; groupId: string }
  | { kind: "field"; fieldId: string; row?: number };
interface Props {
  adapter: FormAdapter;
  mode: "demo" | "extension";
  onClose: () => void;
  onCollapse: (collapsed: boolean) => void;
}

export default function Panel({ adapter, mode, onClose, onCollapse }: Props) {
  const [page, setPage] = useState<PageSnapshot>(() => adapter.snapshot());
  const [formId, setFormId] = useState(() => page.forms[0]?.id || "");
  const [view, setView] = useState<View>({ kind: "home" });
  const [review, setReview] = useState<Review | null>(null);
  const [running, setRunning] = useState(false);
  const [delay, setDelay] = useState(1200);
  const [collapsed, setCollapsed] = useState(false);
  const [upper, setUpper] = useState(false);
  const [draft, setDraft] = useState<{ id: string; value: string } | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState(false);
  const [presses, setPresses] = useState(0);
  const [writes, setWrites] = useState(0);
  const [sends, setSends] = useState(0);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  const root = useRef<HTMLElement>(null);
  const awaiting = useRef(false);
  const wasRunning = useRef(false);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const form = page.forms.find((form) => form.id === formId);
  const scope = JSON.stringify([view, formId, collapsed]);

  function log(text: string) {
    setEvents((previous) =>
      [
        {
          id: Date.now() + Math.random(),
          text,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
        ...previous,
      ].slice(0, 30),
    );
  }
  function message(text: string, error = false) {
    setNote(text);
    setNoteError(error);
  }
  function navigate(next: View) {
    setView(next);
    setDraft(null);
    setNote("");
    setNoteError(false);
  }
  function restore() {
    setCollapsed(false);
    setRunning(wasRunning.current);
  }
  function reveal() {
    wasRunning.current = running;
    setRunning(false);
    setCollapsed(true);
  }
  const scanningLabel = useScanner({
    root,
    scope,
    delay,
    running,
    setRunning,
    collapsed,
    restore,
    onPress: () => setPresses((previous) => previous + 1),
  });

  useEffect(() => adapter.subscribe(setPage), [adapter]);
  useEffect(() => {
    if (!form && page.forms.length) {
      setFormId(page.forms[0].id);
      setView({ kind: "home" });
      setReview(null);
    }
    if (awaiting.current) {
      if (form?.fields.some((field) => field.error)) {
        awaiting.current = false;
        setView({ kind: "home" });
        message(
          "The website needs a correction. Choose the marked section to fix it.",
          true,
        );
        log("Website returned field errors.");
      } else if (!form || page.feedback.length) {
        awaiting.current = false;
        setView({ kind: "home" });
        message("The website responded. Read its message below.");
        log("Website response received.");
      }
    }
  }, [page]);
  useEffect(() => {
    onCollapse(collapsed);
  }, [collapsed, onCollapse]);
  useEffect(() => {
    if (!running && !collapsed)
      root.current
        ?.querySelector<HTMLButtonElement>('[data-sb-scan="scan-toggle"]')
        ?.focus({ preventScroll: true });
  }, [running, collapsed]);
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  function editValue(field: FormField): string {
    return draft?.id === field.id ? draft.value : field.value;
  }
  function sync(field: FormField, value: string | boolean): boolean {
    if (
      field.kind === "checkbox"
        ? field.checked === value
        : field.value === value
    )
      return true;
    const result = adapter.write(field.id, value);
    if (!result.ok) message(result.message, true);
    else {
      setWrites((previous) => previous + 1);
      log(`Updated ${field.label}.`);
      setNote("");
    }
    return result.ok;
  }
  function apply(field: FormField, value: string | boolean) {
    if (bufferedKind(field.kind) && typeof value === "string") {
      setDraft({ id: field.id, value });
      return;
    }
    sync(field, value);
  }
  function finishField(field: FormField) {
    if (bufferedKind(field.kind)) {
      const value = editValue(field);
      if (!validDraft(field.kind, value)) {
        message(
          field.kind === "date"
            ? "Complete the date as YYYY-MM-DD, or clear it. Nothing has been applied."
            : "Complete a valid number, or clear it. Nothing has been applied.",
          true,
        );
        return;
      }
      if (!sync(field, value)) return;
    }
    navigate({ kind: "section", groupId: field.groupId });
  }
  function undo() {
    const result = adapter.undo();
    message(result.message, !result.ok);
    if (result.ok) {
      setWrites((previous) => previous + 1);
      log("Undid the last edit on the website.");
    }
  }
  function locate(field: FormField) {
    const element = adapter.focus(field.id);
    if (!element) {
      message("This field is no longer on the page.", true);
      return;
    }
    setHighlight(element.getBoundingClientRect());
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlight(null), 3500);
    if (window.innerWidth < 900) reveal();
  }
  function openReview() {
    if (!form) return;
    const result = adapter.review(form.id);
    if ("ok" in result) {
      message(result.message, true);
      if (result.fieldId) setView({ kind: "field", fieldId: result.fieldId });
      return;
    }
    setReview(result);
    navigate({ kind: "review" });
    log("Reviewed current website values. Nothing sent.");
  }
  function confirm() {
    if (!review) return;
    awaiting.current = true;
    const result = adapter.submit(review);
    message(result.message, !result.ok);
    if (result.ok) {
      setSends((previous) => previous + 1);
      log("Explicitly sent the form to the website.");
      setView({ kind: "home" });
      setReview(null);
    } else {
      awaiting.current = false;
      setReview(null);
      setView({ kind: "home" });
    }
  }
  function append(field: FormField, text: string) {
    const next = editValue(field) + text;
    if (field.maxLength !== null && next.length > field.maxLength) {
      message(
        `The website limits this field to ${field.maxLength} characters.`,
        true,
      );
      return;
    }
    apply(field, next);
  }
  const groups = form
    ? Array.from(
        new Map(
          form.fields.map((field) => [field.groupId, field.group]),
        ).entries(),
      )
    : [];
  const required = form?.fields.filter((field) => field.required) || [];
  const ready = required.filter(fieldComplete).length;
  const errorCount = form?.fields.filter((field) => field.error).length || 0;
  const stale = !!(
    review &&
    (!form ||
      JSON.stringify(form.fields) !== JSON.stringify(review.fields) ||
      form.submitLabel !== review.submitLabel ||
      !form.canSubmit)
  );
  const field =
    view.kind === "field"
      ? form?.fields.find((field) => field.id === view.fieldId)
      : null;
  const inSection =
    view.kind === "section"
      ? form?.fields.filter((field) => field.groupId === view.groupId) || []
      : [];
  const title =
    view.kind === "home"
      ? "A clear path through."
      : view.kind === "section"
        ? groups.find((group) => group[0] === view.groupId)?.[1] ||
          "Form section"
        : view.kind === "field"
          ? field?.label || "Field changed"
          : view.kind === "review"
            ? "Check before you send."
            : view.kind === "settings"
              ? "Make it work for you."
              : view.kind === "activity"
                ? "Your session, in view."
                : "Choose a form.";
  const back = () =>
    navigate(
      view.kind === "field" && field
        ? { kind: "section", groupId: field.groupId }
        : { kind: "home" },
    );

  return (
    <>
      {highlight && (
        <div
          className="sb-page-highlight"
          style={{
            top: highlight.top - 5,
            left: highlight.left - 5,
            width: highlight.width + 10,
            height: highlight.height + 10,
          }}
          aria-hidden="true"
        />
      )}
      {collapsed ? (
        <div className="sb-return-bar">
          <span className="sb-logo-mini">
            <SlidersHorizontal size={19} />
          </span>
          <button onClick={restore}>
            Return to Switchboard <kbd>Space</kbd>
          </button>
          <button
            className="sb-icon-button"
            onClick={onClose}
            aria-label="Close Switchboard"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <aside
          ref={root}
          className="sb-panel"
          aria-label="Switchboard task view"
        >
          <header className="sb-header">
            <div className="sb-brand">
              <span>
                <SlidersHorizontal size={22} />
              </span>
              <div>
                Switchboard
                <small>
                  {mode === "demo" ? "Page demo" : "Browser extension"}
                </small>
              </div>
            </div>
            <button
              className="sb-icon-button"
              onClick={onClose}
              aria-label="Close Switchboard"
            >
              <X size={19} />
            </button>
          </header>
          <div className="sb-page-name">
            <span className="sb-connected-dot" />
            <span>{page.title || "Current website"}</span>
            <LockKeyhole size={13} />
          </div>
          <div className="sb-scroll-body">
            {view.kind !== "home" && (
              <button className="sb-back" data-sb-scan="back" onClick={back}>
                <ArrowLeft size={15} />
                {view.kind === "field" ? "Back to section" : "Back to sections"}
              </button>
            )}
            <div className="sb-view-heading">
              <h2 tabIndex={-1}>{title}</h2>
              {view.kind === "home" ? (
                <p>Same website. A more manageable next step.</p>
              ) : view.kind === "section" ? (
                <p>Choose a field. Your changes go straight to the page.</p>
              ) : view.kind === "field" ? (
                <p>
                  {field?.required
                    ? "Required by the website"
                    : "Optional field"}
                  {field?.readOnly ? " · Read-only" : ""}
                </p>
              ) : null}
            </div>
            {note && (
              <div
                className={`sb-note ${noteError ? "sb-note-error" : ""}`}
                role="status"
              >
                {noteError ? (
                  <TriangleAlert size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <p>{note}</p>
              </div>
            )}
            {page.feedback.length > 0 && (
              <div className="sb-website-feedback">
                <h3>
                  <Eye size={15} />
                  Website says
                </h3>
                {page.feedback.map((text, index) => (
                  <p key={index}>{text}</p>
                ))}
              </div>
            )}

            {view.kind === "home" && (
              <>
                {form ? (
                  <>
                    <div className="sb-form-summary">
                      <span className="sb-form-icon">
                        <ListChecks size={19} />
                      </span>
                      <div>
                        <h3>{form.title}</h3>
                        <p>
                          {ready} of {required.length} required fields ready
                          {errorCount > 0 ? ` · ${errorCount} to correct` : ""}
                        </p>
                      </div>
                      {page.forms.length > 1 && (
                        <button
                          className="sb-small-link"
                          data-sb-scan="choose-form"
                          onClick={() => navigate({ kind: "forms" })}
                        >
                          Change
                        </button>
                      )}
                    </div>
                    <div
                      className="sb-progress"
                      aria-label="Required fields ready"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={required.length || 1}
                      aria-valuenow={ready}
                    >
                      <span
                        style={{
                          width: required.length
                            ? `${(ready / required.length) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                    <div className="sb-target-list">
                      {groups.map(([id, label], index) => {
                        const groupFields = form.fields.filter(
                          (field) => field.groupId === id,
                        );
                        const needed = groupFields.filter(
                          (field) => field.required,
                        );
                        const errors = groupFields.filter(
                          (field) => field.error,
                        ).length;
                        return (
                          <button
                            key={id}
                            className={`sb-section-target ${errors ? "sb-has-error" : ""}`}
                            data-sb-scan={`section-${id}`}
                            onClick={() =>
                              navigate({ kind: "section", groupId: id })
                            }
                          >
                            <span
                              className="sb-section-number"
                              aria-hidden="true"
                            >
                              {errors ? (
                                <TriangleAlert size={17} />
                              ) : (
                                String(index + 1).padStart(2, "0")
                              )}
                            </span>
                            <span>
                              <strong>{label}</strong>
                              <small>
                                {errors
                                  ? `${errors} field${errors === 1 ? "" : "s"} need attention`
                                  : needed.length
                                    ? `${needed.filter(fieldComplete).length} of ${needed.length} required fields ready`
                                    : "Optional details"}
                              </small>
                            </span>
                            <ChevronRight size={17} />
                          </button>
                        );
                      })}
                    </div>
                    {form.unsupported.length > 0 && (
                      <div className="sb-warning">
                        <h3>Not all controls are supported</h3>
                        {form.unsupported.map((item, index) => (
                          <p key={index}>
                            <strong>{item.label}:</strong> {item.reason}
                          </p>
                        ))}
                      </div>
                    )}
                    {!form.canSubmit && (
                      <p className="sb-support-note">{form.submitReason}</p>
                    )}
                    <button
                      className="sb-primary sb-full"
                      data-sb-scan="review"
                      disabled={!form.canSubmit}
                      onClick={openReview}
                    >
                      <FileCheck2 size={17} />
                      Review before sending
                      <ArrowRight size={16} />
                    </button>
                    <p className="sb-review-hint">
                      Switchboard submits only after you review and confirm.
                    </p>
                  </>
                ) : (
                  <div className="sb-no-form">
                    <FileCheck2 size={35} />
                    <h3>
                      {page.feedback.length
                        ? "Read the website’s response."
                        : "No supported form in view."}
                    </h3>
                    <p>
                      {page.feedback.length
                        ? "Switchboard does not decide whether the website accepted your request. Its own message is shown above."
                        : "Open a page with a visible native form, or return to the website. Shadow-root forms and embedded frames are not supported."}
                    </p>
                    <button
                      data-sb-scan="rescan"
                      className="sb-secondary sb-full"
                      onClick={() => {
                        adapter.refresh();
                        message("Checked the current page again.");
                      }}
                    >
                      <RotateCcw size={15} />
                      Check page again
                    </button>
                  </div>
                )}
                <div className="sb-local-note">
                  <ShieldCheck size={16} />
                  <p>
                    No data goes to a separate Switchboard server. The website
                    controls how it handles edits and submissions.
                  </p>
                </div>
              </>
            )}

            {view.kind === "section" && (
              <div className="sb-target-list">
                {inSection.map((field) => (
                  <button
                    key={field.id}
                    data-sb-scan={`field-${field.id}`}
                    className={`sb-field-target ${field.error ? "sb-has-error" : ""}`}
                    disabled={field.readOnly}
                    onClick={() =>
                      navigate({ kind: "field", fieldId: field.id })
                    }
                  >
                    <span
                      className={`sb-field-state ${fieldComplete(field) && (field.value || field.checked) ? "sb-complete" : ""}`}
                    >
                      {field.error ? (
                        <TriangleAlert size={16} />
                      ) : fieldComplete(field) &&
                        (field.value || field.checked) ? (
                        <Check size={16} />
                      ) : (
                        <span />
                      )}
                    </span>
                    <span>
                      <strong>{field.label}</strong>
                      <small>{field.error || fieldValue(field)}</small>
                      <em>
                        {field.readOnly
                          ? "Read-only"
                          : field.required
                            ? "Required"
                            : "Optional"}
                      </em>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
                {!inSection.length && (
                  <p className="sb-support-note">
                    The website changed this section. Return to sections to read
                    its current fields.
                  </p>
                )}
              </div>
            )}

            {view.kind === "field" && field && (
              <>
                {!field.labeled && (
                  <div className="sb-warning">
                    <p>
                      This field has no readable label. The name above is a
                      fallback, not a verified description. Locate it on the
                      website before editing.
                    </p>
                  </div>
                )}
                {field.error && (
                  <div className="sb-field-error">
                    <TriangleAlert size={16} />
                    <p>{field.error}</p>
                  </div>
                )}
                {field.hint && <p className="sb-field-hint">{field.hint}</p>}
                {field.kind === "checkbox" ? (
                  <div className="sb-choice-list">
                    {[
                      { value: true, label: "Yes — check this box" },
                      { value: false, label: "No — leave it unchecked" },
                    ].map((option) => (
                      <button
                        key={String(option.value)}
                        data-sb-scan={`check-${option.value}`}
                        className={`sb-choice ${field.checked === option.value ? "sb-is-chosen" : ""}`}
                        onClick={() => {
                          apply(field, option.value);
                          navigate({ kind: "section", groupId: field.groupId });
                        }}
                      >
                        <span>{option.label}</span>
                        {field.checked === option.value ? (
                          <CheckCircle2 size={19} />
                        ) : (
                          <span className="sb-radio-dot" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : field.kind === "select" || field.kind === "radio" ? (
                  <div className="sb-choice-list">
                    {field.choices.map((choice, index) => (
                      <button
                        key={`${index}-${choice.value}`}
                        className={`sb-choice ${field.value === choice.value ? "sb-is-chosen" : ""}`}
                        data-sb-scan={`option-${index}`}
                        disabled={choice.disabled}
                        onClick={() => {
                          apply(field, choice.value);
                          navigate({ kind: "section", groupId: field.groupId });
                        }}
                      >
                        <span>{choice.label || "(Empty option)"}</span>
                        {field.value === choice.value ? (
                          <CheckCircle2 size={19} />
                        ) : (
                          <span className="sb-radio-dot" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <label className="sb-edit-value">
                      {bufferedKind(field.kind)
                        ? "Draft — applied when you choose Done"
                        : "On the website now"}
                      <input
                        aria-label={`Value for ${field.label}`}
                        type="text"
                        value={editValue(field)}
                        readOnly={running || field.readOnly}
                        maxLength={field.maxLength ?? undefined}
                        onChange={(event) => apply(field, event.target.value)}
                        placeholder="Not entered yet"
                      />
                    </label>
                    {["number", "date"].includes(field.kind) && (
                      <p className="sb-field-hint">
                        {field.kind === "date"
                          ? "Use YYYY-MM-DD, then choose Done to apply it. Back discards the draft. The website checks its allowed range."
                          : "Enter a number, then choose Done to apply it. Back discards the draft. The website checks its allowed range."}
                      </p>
                    )}
                    <div className="sb-keyboard-heading">
                      <Keyboard size={16} />
                      <h3>
                        {view.row === undefined
                          ? "Choose a row"
                          : "Choose a character"}
                      </h3>
                      <span>{upper ? "Uppercase" : "Lowercase"}</span>
                    </div>
                    {view.row === undefined ? (
                      <div className="sb-key-rows">
                        {KEY_ROWS.map((row, index) => (
                          <button
                            key={index}
                            className="sb-key-row"
                            data-sb-scan={`key-row-${index}`}
                            aria-label={`Keyboard row ${row.map((char) => (upper ? char.toUpperCase() : char)).join(" ")}`}
                            onClick={() =>
                              setView({
                                kind: "field",
                                fieldId: field.id,
                                row: index,
                              })
                            }
                          >
                            <span>
                              {row
                                .map((char) =>
                                  upper ? char.toUpperCase() : char,
                                )
                                .join("  ")}
                            </span>
                            <ChevronRight size={15} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="sb-character-grid">
                          {KEY_ROWS[view.row].map((char) => (
                            <button
                              key={char}
                              className="sb-character"
                              data-sb-scan={`character-${char}`}
                              aria-label={`Type ${upper ? char.toUpperCase() : char}`}
                              onClick={() => {
                                append(
                                  field,
                                  upper ? char.toUpperCase() : char,
                                );
                                setView({ kind: "field", fieldId: field.id });
                              }}
                            >
                              {upper ? char.toUpperCase() : char}
                            </button>
                          ))}
                        </div>
                        <button
                          className="sb-secondary sb-full"
                          data-sb-scan="other-row"
                          onClick={() =>
                            setView({ kind: "field", fieldId: field.id })
                          }
                        >
                          <ArrowLeft size={15} />
                          Choose another row
                        </button>
                      </>
                    )}
                    <div className="sb-key-tools">
                      <button
                        data-sb-scan="type-space"
                        onClick={() => append(field, " ")}
                      >
                        Space
                      </button>
                      <button
                        data-sb-scan="backspace"
                        disabled={!editValue(field)}
                        onClick={() =>
                          apply(
                            field,
                            Array.from(editValue(field)).slice(0, -1).join(""),
                          )
                        }
                      >
                        Delete last
                      </button>
                      <button
                        data-sb-scan="shift"
                        onClick={() => setUpper((previous) => !previous)}
                      >
                        {upper ? "Use lowercase" : "Use uppercase"}
                      </button>
                    </div>
                  </>
                )}
                <button
                  className="sb-primary sb-full sb-done-field"
                  data-sb-scan="done-field"
                  onClick={() => finishField(field)}
                >
                  <Check size={17} />
                  Done with this field
                </button>
                <button
                  className="sb-locate"
                  data-sb-scan="locate-field"
                  onClick={() => locate(field)}
                >
                  <Eye size={15} />
                  Locate this field on the website
                </button>
              </>
            )}
            {view.kind === "field" && !field && (
              <p className="sb-support-note">
                The website removed or replaced this field. Return to sections
                before making another edit.
              </p>
            )}

            {view.kind === "review" && review && (
              <>
                <div className="sb-review-notice">
                  <ShieldCheck size={18} />
                  <p>
                    These are the real form's current values. The next action
                    sends them to the website—not to Switchboard.
                  </p>
                </div>
                <dl className="sb-review-values">
                  {review.fields.map((field) => (
                    <div key={field.id}>
                      <dt>{field.label}</dt>
                      <dd>{fieldValue(field)}</dd>
                    </div>
                  ))}
                </dl>
                {stale && (
                  <div className="sb-warning" role="status">
                    <p>
                      The website changed after this review. Refresh the review
                      before sending.
                    </p>
                  </div>
                )}
                {stale ? (
                  <button
                    data-sb-scan="refresh-review"
                    className="sb-primary sb-full"
                    onClick={openReview}
                  >
                    <RotateCcw size={16} />
                    Review current values
                  </button>
                ) : (
                  <button
                    data-sb-scan="confirm-submit"
                    className="sb-primary sb-full"
                    onClick={confirm}
                  >
                    <CheckCircle2 size={17} />
                    Confirm: {review.submitLabel}
                    <ArrowRight size={16} />
                  </button>
                )}
                <button
                  data-sb-scan="cancel-review"
                  className="sb-secondary sb-full sb-margin-top"
                  onClick={() => {
                    setReview(null);
                    navigate({ kind: "home" });
                  }}
                >
                  Keep editing — do not send
                </button>
                <p className="sb-review-hint">
                  Normal website behavior applies. A confirmation is not a
                  guarantee that the site will accept the form.
                </p>
              </>
            )}

            {view.kind === "forms" && (
              <div className="sb-choice-list">
                {page.forms.map((form) => (
                  <button
                    data-sb-scan={`form-${form.id}`}
                    className="sb-choice"
                    key={form.id}
                    onClick={() => {
                      setFormId(form.id);
                      setReview(null);
                      navigate({ kind: "home" });
                    }}
                  >
                    <span>
                      {form.title}
                      <small>
                        {form.fields.length} supported fields
                        {form.unsupported.length
                          ? " · includes unsupported controls"
                          : ""}
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            )}
            {view.kind === "settings" && (
              <>
                <div className="sb-settings-intro">
                  <Clock3 size={18} />
                  <div>
                    <h3>How fast should scanning move?</h3>
                    <p>Choose a pace you can select comfortably.</p>
                  </div>
                </div>
                <div className="sb-choice-list">
                  {[
                    {
                      value: 1800,
                      label: "Take it slowly",
                      hint: "1.8 seconds per target",
                    },
                    {
                      value: 1200,
                      label: "A steady pace",
                      hint: "1.2 seconds per target",
                    },
                    {
                      value: 800,
                      label: "A little quicker",
                      hint: "0.8 seconds per target",
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      data-sb-scan={`speed-${option.value}`}
                      className={`sb-choice ${delay === option.value ? "sb-is-chosen" : ""}`}
                      onClick={() => {
                        setDelay(option.value);
                        message(
                          `Scanning every ${option.value / 1000} seconds.`,
                        );
                      }}
                    >
                      <span>
                        {option.label}
                        <small>{option.hint}</small>
                      </span>
                      {delay === option.value && <CheckCircle2 size={18} />}
                    </button>
                  ))}
                </div>
                <div className="sb-how-to">
                  <h3>
                    <CircleHelp size={16} />
                    One switch, step by step
                  </h3>
                  <p>
                    Start scanning. The blue target moves automatically. Press{" "}
                    <kbd>Space</kbd> to choose it. Navigate section → field →
                    keyboard row → character. Pause is included in every scan
                    cycle.
                  </p>
                  <p>
                    A USB switch mapped to Space can use the same controls. Hold
                    presses do not repeat. Escape is an additional emergency
                    pause.
                  </p>
                  <p>
                    When paused, you can also type normally in the field editor
                    or use ordinary Tab navigation.
                  </p>
                </div>
                <button
                  data-sb-scan="undo"
                  className="sb-secondary sb-full"
                  onClick={undo}
                >
                  <Undo2 size={16} />
                  Undo the last edit
                </button>
                <button
                  data-sb-scan="activity"
                  className="sb-secondary sb-full sb-margin-top"
                  onClick={() => navigate({ kind: "activity" })}
                >
                  <ListChecks size={16} />
                  View session activity
                </button>
                <div className="sb-how-to">
                  <h3>
                    <LockKeyhole size={16} />
                    Local, not universal
                  </h3>
                  <p>
                    No AI, analytics, remote server, or saved form history in
                    this panel. Closing clears its in-memory values and undo
                    stack. The website still handles its own submitted data.
                  </p>
                  <p>
                    Native top-page forms only. Passwords, file uploads, payment
                    fields, custom widgets, embedded frames and shadow-root
                    forms are not supported. No automatic WCAG-compliance or
                    speed-improvement claims.
                  </p>
                </div>
                <button
                  data-sb-scan="close-session"
                  className="sb-end-session"
                  onClick={onClose}
                >
                  <X size={16} />
                  End session and close
                </button>
              </>
            )}
            {view.kind === "activity" && (
              <>
                <p className="sb-field-hint">
                  Actual actions in this session, not a comparative benchmark.
                  Values are not recorded in this activity list.
                </p>
                <div className="sb-session-counts">
                  <p>
                    <strong>{presses}</strong> switch presses
                  </p>
                  <p>
                    <strong>{writes}</strong> edit actions applied
                  </p>
                  <p>
                    <strong>{sends}</strong> authorized submissions
                  </p>
                </div>
                <ol className="sb-activity-list">
                  {events.map((event) => (
                    <li key={event.id}>
                      <time>{event.time}</time>
                      <span>{event.text}</span>
                    </li>
                  ))}
                </ol>
                {!events.length && (
                  <p className="sb-support-note">
                    No edits yet. Start with a form section.
                  </p>
                )}
              </>
            )}
          </div>
          <footer
            className={`sb-control-rail ${running ? "sb-is-scanning" : ""}`}
          >
            <div className="sb-scan-status">
              <span className={`sb-scan-dot ${running ? "sb-scan-on" : ""}`} />
              <span>
                {running ? "Scanning" : "Paused"}
                <small>
                  {running
                    ? scanningLabel
                    : "Choose Start scanning, then use Space."}
                </small>
              </span>
            </div>
            <button
              className="sb-scan-toggle"
              aria-label={running ? "Pause scanning" : "Start scanning"}
              data-sb-scan="scan-toggle"
              onClick={() => setRunning((previous) => !previous)}
            >
              {running ? <Pause size={17} /> : <Play size={17} />}
              {running ? "Pause scanning" : "Start scanning"}
              <kbd>Space</kbd>
            </button>
            <div className="sb-rail-actions">
              <button
                data-sb-scan="settings"
                onClick={() => navigate({ kind: "settings" })}
              >
                <Settings2 size={15} />
                Settings
              </button>
              <button data-sb-scan="show-website" onClick={reveal}>
                <Eye size={15} />
                Show website
              </button>
              <span aria-label={`${presses} switch presses`}>
                {presses} presses
              </span>
            </div>
            <p className="sb-rail-help">
              {running
                ? "Space selects the blue target. Esc pauses."
                : "Your next action is always yours to choose."}
            </p>
          </footer>
        </aside>
      )}
    </>
  );
}
