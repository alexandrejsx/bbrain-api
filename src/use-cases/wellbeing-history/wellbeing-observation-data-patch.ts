const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** RFC 7396-style merge for user corrections: omitted fields stay, null removes a field. */
export function applyWellbeingObservationMergePatch(current: unknown, patch: unknown): unknown {
  if (!isRecord(current) || !isRecord(patch)) return patch;

  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete merged[key];
    } else {
      merged[key] = applyWellbeingObservationMergePatch(merged[key], value);
    }
  }

  return merged;
}
