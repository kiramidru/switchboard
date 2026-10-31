import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { bufferedKind, KEY_ROWS, validDraft } from "./switchboard/keyboard.ts";
import { fieldComplete, fieldValue } from "./switchboard/types.ts";
import type { FormField } from "./switchboard/types.ts";

const field: FormField = {
  id: "field",
  name: "name",
  label: "Name",
  labeled: true,
  kind: "text",
  value: "",
  checked: false,
  required: true,
  readOnly: false,
  groupId: "g",
  group: "Details",
  choices: [],
  error: "",
  hint: "",
  maxLength: null,
};

test("keyboard covers lowercase letters, digits and common form punctuation without duplicate keys", () => {
  const chars = KEY_ROWS.flat();
  assert.equal(new Set(chars).size, chars.length);
  for (const char of "abcdefghijklmnopqrstuvwxyz0123456789@.-_+/:?=&")
    assert.ok(chars.includes(char));
});

test("date/number drafts allow incremental entry without writing invalid native values", () => {
  assert.ok(bufferedKind("date"));
  assert.ok(bufferedKind("number"));
  assert.ok(!bufferedKind("email"));
  assert.ok(!validDraft("date", "2027-0"));
  assert.ok(!validDraft("date", "2027-02-29"));
  assert.ok(validDraft("date", "2028-02-29"));
  assert.ok(!validDraft("date", "0000-01-01"));
  assert.ok(validDraft("number", "-12.5"));
  assert.ok(!validDraft("number", "-"));
  assert.ok(!validDraft("number", "Infinity"));
  assert.ok(validDraft("number", "1e3"));
  assert.ok(validDraft("number", ""));
  assert.ok(validDraft("date", ""));
});

test("required state is based on actual values/errors, not a fake completion count", () => {
  assert.ok(!fieldComplete(field));
  assert.ok(fieldComplete({ ...field, value: "Alex" }));
  assert.ok(
    !fieldComplete({ ...field, value: "Alex", error: "Website says invalid" }),
  );
  assert.ok(
    !fieldComplete({ ...field, kind: "checkbox", value: "on", checked: false }),
  );
  assert.ok(fieldComplete({ ...field, kind: "checkbox", checked: true }));
});

test("review values preserve real choices, including unchecked boxes", () => {
  assert.equal(
    fieldValue({ ...field, kind: "checkbox", checked: false }),
    "No",
  );
  assert.equal(
    fieldValue({
      ...field,
      kind: "select",
      value: "repair",
      choices: [{ value: "repair", label: "Repair workshop", disabled: false }],
    }),
    "Repair workshop",
  );
  assert.equal(fieldValue(field), "Not entered");
});

test("shipped extension requests only user-activated access and no persistent storage", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../extension/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.externally_connectable, undefined);
});
