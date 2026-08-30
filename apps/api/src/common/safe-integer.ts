export function toSafeInteger(
  value: string | number | bigint,
  field: string,
): number {
  const converted = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(converted)) {
    throw new RangeError(`${field} exceeds the safe integer range`);
  }
  return converted;
}
