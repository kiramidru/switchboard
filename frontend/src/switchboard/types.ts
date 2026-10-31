export type FieldKind =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "search"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio";
export interface Choice {
  value: string;
  label: string;
  disabled: boolean;
}
export interface FormField {
  id: string;
  name: string;
  label: string;
  labeled: boolean;
  kind: FieldKind;
  value: string;
  checked: boolean;
  required: boolean;
  readOnly: boolean;
  groupId: string;
  group: string;
  choices: Choice[];
  error: string;
  hint: string;
  maxLength: number | null;
}
export interface UnsupportedControl {
  label: string;
  reason: string;
}
export interface FormSnapshot {
  id: string;
  title: string;
  fields: FormField[];
  unsupported: UnsupportedControl[];
  submitLabel: string;
  canSubmit: boolean;
  submitReason: string;
}
export interface PageSnapshot {
  forms: FormSnapshot[];
  feedback: string[];
  title: string;
}
export interface Review {
  formId: string;
  fingerprint: string;
  fields: FormField[];
  submitLabel: string;
}
export interface AdapterResult {
  ok: boolean;
  message: string;
  fieldId?: string;
}
export interface SessionEvent {
  id: number;
  text: string;
  time: string;
}
export function fieldValue(field: FormField): string {
  if (field.kind === "checkbox") return field.checked ? "Yes" : "No";
  if (field.kind === "select" || field.kind === "radio")
    return (
      field.choices.find((choice) => choice.value === field.value)?.label ||
      "Not selected"
    );
  return field.value || "Not entered";
}
export function fieldComplete(field: FormField): boolean {
  return (
    !field.error &&
    (!field.required ||
      (field.kind === "checkbox" ? field.checked : !!field.value.trim()))
  );
}
