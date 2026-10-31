export const KEY_ROWS = [
  ["a", "b", "c", "d", "e"],
  ["f", "g", "h", "i", "j"],
  ["k", "l", "m", "n", "o"],
  ["p", "q", "r", "s", "t"],
  ["u", "v", "w", "x", "y", "z"],
  ["0", "1", "2", "3", "4"],
  ["5", "6", "7", "8", "9"],
  ["@", ".", "-", "_", "+", "'"],
  ["/", ":", "?", "!", ",", "&"],
  ["=", "(", ")", "#", "%", "*"],
  ["[", "]", '"', ";", "\\", "$"],
];

export function bufferedKind(kind: string): boolean {
  return kind === "number" || kind === "date";
}

export function validDraft(kind: string, value: string): boolean {
  if (!value) return true; // Required/range constraints are checked on the original form.
  if (kind === "number")
    return (
      /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value) &&
      Number.isFinite(Number(value))
    );
  if (kind === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
      return false;
    const date = new Date(value + "T00:00:00Z");
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }
  return true;
}
