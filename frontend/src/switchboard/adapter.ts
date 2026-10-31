import type {
  AdapterResult,
  Choice,
  FormField,
  FormSnapshot,
  PageSnapshot,
  Review,
} from "./types";

const TEXT_TYPES = new Set([
  "text",
  "email",
  "tel",
  "url",
  "search",
  "number",
  "date",
]);
const IGNORED_INPUTS = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
]);
const SENSITIVE_AUTOCOMPLETE =
  /(?:^|\s)(?:cc-|current-password|new-password|one-time-code)/;
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
interface Binding {
  elements: Control[];
  form: HTMLFormElement;
}
const clean = (text: string | null | undefined) =>
  (text || "").replace(/\s+/g, " ").trim().slice(0, 400);

export class FormAdapter {
  private ids = new WeakMap<Element, string>();
  private nextId = 0;
  private forms = new Map<string, HTMLFormElement>();
  private bindings = new Map<string, Binding>();
  private invalid = new WeakSet<Element>();
  private subscribers = new Set<(snapshot: PageSnapshot) => void>();
  private observer: MutationObserver;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private undoStack: { id: string; value: string; checked: boolean }[] = [];
  private readonly onInput = (event: Event) => {
    if (
      event
        .composedPath()
        .some(
          (node) => node instanceof Element && node.id === "switchboard-root",
        )
    )
      return;
    this.schedule();
  };
  private readonly onInvalid = (event: Event) => {
    if (event.target instanceof Element) this.invalid.add(event.target);
    this.schedule();
  };

  constructor(private doc: Document = document) {
    this.observer = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            !(
              record.target instanceof Element &&
              record.target.closest("#switchboard-root")
            ),
        )
      )
        this.schedule();
    });
    this.observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "disabled",
        "readonly",
        "required",
        "checked",
        "value",
        "aria-invalid",
        "aria-describedby",
        "aria-label",
        "aria-labelledby",
        "hidden",
        "type",
        "name",
        "min",
        "max",
        "minlength",
        "maxlength",
        "pattern",
        "multiple",
        "action",
        "formaction",
        "aria-errormessage",
        "style",
        "class",
        "inert",
        "aria-hidden",
      ],
    });
    for (const type of ["input", "change", "reset", "submit"])
      doc.addEventListener(type, this.onInput, true);
    doc.addEventListener("invalid", this.onInvalid, true);
  }

  private id(element: Element): string {
    let id = this.ids.get(element);
    if (!id) {
      id = `sb-${++this.nextId}`;
      this.ids.set(element, id);
    }
    return id;
  }

  private visible(element: Element): boolean {
    if (
      !element.isConnected ||
      element.closest('#switchboard-root,[hidden],[inert],[aria-hidden="true"]')
    )
      return false;
    const style = this.doc.defaultView!.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }

  private referenced(element: Element, attribute: string): string {
    return clean(
      (element.getAttribute(attribute) || "")
        .split(/\s+/)
        .map((id) => this.doc.getElementById(id)?.textContent || "")
        .join(" "),
    );
  }

  private labelText(element: Element): string {
    const walker = this.doc.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) =>
          node instanceof Element &&
          node.matches('[hidden],[aria-hidden="true"],script,style')
            ? NodeFilter.FILTER_REJECT
            : node.nodeType === Node.TEXT_NODE
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP,
      },
    );
    const parts: string[] = [];
    while (walker.nextNode()) parts.push(walker.currentNode.textContent || "");
    return clean(parts.join(" "));
  }

  private label(
    element: Control | HTMLFormElement | HTMLButtonElement,
  ): string {
    const labels =
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
        ? element.labels
        : null;
    return (
      this.referenced(element, "aria-labelledby") ||
      clean(element.getAttribute("aria-label")) ||
      clean(
        Array.from(labels || [])
          .map((label) => this.labelText(label))
          .join(" "),
      )
    );
  }

  private group(
    element: Element,
    form: HTMLFormElement,
  ): { id: string; label: string } {
    let fieldset = element.closest("fieldset");
    const outer = fieldset?.parentElement?.closest("fieldset");
    if (outer && form.contains(outer)) fieldset = outer;
    const group = fieldset && form.contains(fieldset) ? fieldset : form;
    const legend =
      group instanceof HTMLFieldSetElement
        ? group.querySelector(":scope > legend")
        : null;
    return {
      id: this.id(group),
      label: clean(legend?.textContent) || "Form details",
    };
  }

  private error(elements: Control[]): string {
    for (const element of elements) {
      if (element.getAttribute("aria-invalid") === "true") {
        return (
          this.referenced(element, "aria-errormessage") ||
          this.referenced(element, "aria-describedby") ||
          "The website marks this field as invalid."
        );
      }
      if (this.invalid.has(element) && !element.validity.valid)
        return element.validationMessage;
    }
    return "";
  }

  snapshot(): PageSnapshot {
    this.forms.clear();
    this.bindings.clear();
    const snapshots: FormSnapshot[] = [];
    for (const form of Array.from(this.doc.forms)
      .filter((form) => this.visible(form))
      .slice(0, 30)) {
      const formId = this.id(form);
      this.forms.set(formId, form);
      const controls = Array.from(form.elements).filter(
        (element): element is Control =>
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement,
      );
      const fields: FormField[] = [];
      const unsupported: FormSnapshot["unsupported"] = [];
      const radioGroups = new Set<string>();
      for (const element of controls) {
        if (element.matches(":disabled")) continue;
        if (
          element instanceof HTMLInputElement &&
          IGNORED_INPUTS.has(element.type)
        )
          continue;
        const type =
          element instanceof HTMLInputElement
            ? element.type
            : element instanceof HTMLSelectElement
              ? "select"
              : "textarea";
        if (
          type === "password" ||
          type === "file" ||
          SENSITIVE_AUTOCOMPLETE.test(element.autocomplete)
        ) {
          unsupported.push({
            label: this.label(element) || `${type} field`,
            reason:
              "Sensitive or file fields must be handled on the original website.",
          });
          continue;
        }
        if (!this.visible(element)) continue;
        if (
          !(
            TEXT_TYPES.has(type) ||
            ["textarea", "select", "checkbox", "radio"].includes(type)
          ) ||
          (element instanceof HTMLSelectElement && element.multiple)
        ) {
          unsupported.push({
            label: this.label(element) || `${type} control`,
            reason: "This control type is not supported.",
          });
          continue;
        }
        if (fields.length >= 200) {
          unsupported.push({
            label: "Additional fields",
            reason: "This form exceeds the 200-field safety limit.",
          });
          break;
        }
        const group = this.group(element, form);
        let elements: Control[] = [element];
        let label = this.label(element);
        let value = element.value;
        let choices: Choice[] = [];
        if (type === "radio") {
          const key = element.name || this.id(element);
          if (radioGroups.has(key)) continue;
          radioGroups.add(key);
          elements = controls.filter(
            (other): other is HTMLInputElement =>
              other instanceof HTMLInputElement &&
              other.type === "radio" &&
              (element.name
                ? other.name === element.name
                : other === element) &&
              this.visible(other),
          );
          choices = elements.map((radio) => ({
            value: radio.value,
            label: this.label(radio) || radio.value,
            disabled: radio.matches(":disabled"),
          }));
          value = (
            elements.find((radio) => (radio as HTMLInputElement).checked) || {
              value: "",
            }
          ).value;
          const fieldset = element.closest("fieldset");
          label =
            clean(fieldset?.querySelector(":scope > legend")?.textContent) ||
            clean(element.name);
        } else if (element instanceof HTMLSelectElement) {
          if (element.options.length > 300) {
            unsupported.push({
              label: label || "Long select menu",
              reason: "More than 300 options; use the original website.",
            });
            continue;
          }
          choices = Array.from(element.options).map((option) => ({
            value: option.value,
            label: clean(option.label),
            disabled: option.disabled || !!option.closest("optgroup:disabled"),
          }));
        }
        const id = this.id(element);
        const required = elements.some((control) => control.required);
        fields.push({
          id,
          name: element.name,
          label:
            label ||
            `Unlabeled ${type} field${element.name ? ` (${element.name})` : ""}`,
          labeled: !!label,
          kind: type as FormField["kind"],
          value,
          checked: element instanceof HTMLInputElement && element.checked,
          required,
          readOnly: "readOnly" in element && element.readOnly,
          groupId: group.id,
          group: group.label,
          choices,
          error: this.error(elements),
          hint:
            element.getAttribute("aria-invalid") === "true"
              ? ""
              : this.referenced(element, "aria-describedby"),
          maxLength:
            "maxLength" in element && element.maxLength >= 0
              ? element.maxLength
              : null,
        });
        this.bindings.set(id, { elements, form });
      }
      const custom = Array.from(
        form.querySelectorAll(
          '[role="combobox"],[role="slider"],[role="switch"],[role="checkbox"],[role="radiogroup"],[role="spinbutton"],[role="textbox"],[contenteditable="true"]',
        ),
      ).filter(
        (element) =>
          this.visible(element) &&
          !(
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement
          ),
      );
      custom.forEach((element) =>
        unsupported.push({
          label:
            clean(element.getAttribute("aria-label")) ||
            "Custom interactive control",
          reason: "Custom widgets are not supported; use the original page.",
        }),
      );
      const submitters = Array.from(form.elements).filter(
        (element): element is HTMLButtonElement | HTMLInputElement =>
          (element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement) &&
          element.type === "submit" &&
          this.visible(element),
      );
      const submitter = submitters[0];
      const submitLabel = submitter
        ? this.label(submitter) ||
          clean(
            submitter instanceof HTMLInputElement
              ? submitter.value
              : submitter.textContent,
          )
        : "";
      const submitReason = unsupported.length
        ? "This form includes unsupported controls. Submit on the original website."
        : submitters.length !== 1
          ? "A single, visible submit button is required. Use the original website."
          : submitter?.matches(":disabled")
            ? "The website has disabled submission. Wait or check the original page."
            : !submitLabel
              ? "The submit action has no readable label. Use the original website."
              : "";
      snapshots.push({
        id: formId,
        title:
          this.label(form) ||
          clean(form.getAttribute("name")) ||
          `Form ${snapshots.length + 1}`,
        fields,
        unsupported,
        submitLabel,
        canSubmit: !submitReason && fields.length > 0,
        submitReason,
      });
    }
    const feedback = Array.from(
      this.doc.querySelectorAll(
        '[role="alert"],[role="status"],[aria-live="polite"],[aria-live="assertive"]',
      ),
    )
      .filter((element) => this.visible(element))
      .map((element) => clean(element.textContent))
      .filter(Boolean)
      .slice(-8);
    return {
      forms: snapshots,
      feedback: Array.from(new Set(feedback)),
      title: this.doc.title,
    };
  }

  subscribe(callback: (snapshot: PageSnapshot) => void): () => void {
    this.subscribers.add(callback);
    callback(this.snapshot());
    return () => this.subscribers.delete(callback);
  }

  refresh(): PageSnapshot {
    const snapshot = this.snapshot();
    this.subscribers.forEach((callback) => callback(snapshot));
    return snapshot;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.refresh();
    }, 45);
  }

  write(id: string, value: string | boolean, remember = true): AdapterResult {
    const oldBinding = this.bindings.get(id);
    this.snapshot();
    const binding = this.bindings.get(id);
    if (
      !binding ||
      !oldBinding ||
      binding.elements[0] !== oldBinding.elements[0]
    )
      return {
        ok: false,
        message:
          "The page replaced this field. Return to sections and select it again.",
      };
    const { elements } = binding;
    const element = elements[0];
    if (
      !this.visible(element) ||
      element.matches(":disabled") ||
      ("readOnly" in element && element.readOnly)
    )
      return {
        ok: false,
        message: "This field is no longer editable on the website.",
      };
    const radio =
      element instanceof HTMLInputElement && element.type === "radio"
        ? elements.find((control) => control.value === value)
        : null;
    if (element.type === "radio" && (!radio || radio.matches(":disabled")))
      return {
        ok: false,
        message: "This option is unavailable on the website.",
      };
    if (
      element instanceof HTMLSelectElement &&
      !Array.from(element.options).some(
        (option) =>
          option.value === value &&
          !option.disabled &&
          !option.closest("optgroup:disabled"),
      )
    ) {
      return {
        ok: false,
        message: "This option is unavailable on the website.",
      };
    }
    if (remember)
      this.undoStack.push({
        id,
        value:
          element.type === "radio"
            ? elements.find((control) => (control as HTMLInputElement).checked)
                ?.value || ""
            : element.value,
        checked: element instanceof HTMLInputElement && element.checked,
      });
    this.undoStack = this.undoStack.slice(-30);
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      if (element.checked !== Boolean(value)) element.click();
    } else if (radio) {
      radio.click();
    } else {
      const prototype =
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : element instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
        element,
        String(value),
      );
      element.dispatchEvent(
        new Event("input", { bubbles: true, composed: true }),
      );
      element.dispatchEvent(
        new Event("change", { bubbles: true, composed: true }),
      );
    }
    this.refresh();
    return { ok: true, message: "Change applied to the website." };
  }

  undo(): AdapterResult {
    const previous = this.undoStack.pop();
    if (!previous)
      return {
        ok: false,
        message: "There are no edits to undo in this session.",
      };
    this.snapshot();
    const binding = this.bindings.get(previous.id);
    if (!binding)
      return {
        ok: false,
        message: "That field was replaced or removed. Nothing was changed.",
      };
    if (binding.elements[0].type === "radio" && !previous.value)
      return {
        ok: false,
        message:
          "This radio group originally had no selection. Clearing it reliably is not supported; nothing was changed.",
      };
    return this.write(
      previous.id,
      binding.elements[0].type === "checkbox"
        ? previous.checked
        : previous.value,
      false,
    );
  }

  focus(id: string): Element | null {
    const element = this.bindings.get(id)?.elements[0];
    if (!element?.isConnected || !this.visible(element)) return null;
    element.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "instant",
    });
    return element;
  }

  private fingerprint(snapshot: FormSnapshot): string {
    const form = this.forms.get(snapshot.id);
    return JSON.stringify({
      form: snapshot.id,
      action: form?.action,
      method: form?.method,
      submitters: form
        ? Array.from(form.elements)
            .filter(
              (element): element is HTMLButtonElement | HTMLInputElement =>
                (element instanceof HTMLButtonElement ||
                  element instanceof HTMLInputElement) &&
                element.type === "submit",
            )
            .map((element) => [
              this.id(element),
              element.formAction,
              element.formMethod,
              element.name,
              element.value,
              element.disabled,
            ])
        : [],
      fields: snapshot.fields,
      unsupported: snapshot.unsupported,
    });
  }

  review(formId: string): Review | AdapterResult {
    const snapshot = this.snapshot().forms.find((form) => form.id === formId);
    const form = this.forms.get(formId);
    if (!snapshot || !form?.isConnected)
      return {
        ok: false,
        message: "This form was replaced or removed. Select the current form.",
      };
    if (!snapshot.canSubmit)
      return {
        ok: false,
        message: snapshot.submitReason || "No supported fields were found.",
      };
    HTMLFormElement.prototype.checkValidity.call(form);
    const current = this.refresh().forms.find((item) => item.id === formId)!;
    const error = current.fields.find((field) => field.error);
    if (error)
      return {
        ok: false,
        message: "The website needs a correction before you can review.",
        fieldId: error.id,
      };
    return {
      formId,
      fingerprint: this.fingerprint(current),
      fields: current.fields,
      submitLabel: current.submitLabel,
    };
  }

  submit(review: Review): AdapterResult {
    const current = this.snapshot().forms.find(
      (form) => form.id === review.formId,
    );
    const form = this.forms.get(review.formId);
    if (
      !current ||
      !form?.isConnected ||
      !current.canSubmit ||
      this.fingerprint(current) !== review.fingerprint
    ) {
      return {
        ok: false,
        message:
          "The website changed after your review. Review the current values again before sending.",
      };
    }
    const valid = HTMLFormElement.prototype.checkValidity.call(form);
    if (!valid || current.fields.some((field) => field.error)) {
      this.refresh();
      return {
        ok: false,
        message: "The website needs a correction. Nothing was sent.",
      };
    }
    const submitter = Array.from(form.elements).find(
      (element): element is HTMLButtonElement | HTMLInputElement =>
        (element instanceof HTMLButtonElement ||
          element instanceof HTMLInputElement) &&
        element.type === "submit" &&
        this.visible(element),
    );
    if (!submitter)
      return {
        ok: false,
        message: "The submit action is no longer available.",
      };
    HTMLFormElement.prototype.requestSubmit.call(form, submitter);
    this.schedule();
    return {
      ok: true,
      message:
        "Sent to the website. Check its response below; this is not a success guarantee.",
    };
  }

  destroy(): void {
    this.observer.disconnect();
    if (this.timer) clearTimeout(this.timer);
    for (const type of ["input", "change", "reset", "submit"])
      this.doc.removeEventListener(type, this.onInput, true);
    this.doc.removeEventListener("invalid", this.onInvalid, true);
    this.subscribers.clear();
    this.forms.clear();
    this.bindings.clear();
    this.undoStack = [];
  }
}
