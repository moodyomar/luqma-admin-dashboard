import { Timestamp } from 'firebase/firestore';

/** Recursively clone menu data for JSON export (Timestamps → ISO strings). */
export function serializeMenuForJsonExport(value) {
  if (value == null) return value;

  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch {
      // fall through
    }
  }

  if (Array.isArray(value)) {
    return value.map(serializeMenuForJsonExport);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeMenuForJsonExport(v)]),
    );
  }

  return value;
}

/** Pretty-printed JSON string for export/copy. */
export function menuDataToJsonString(data) {
  return JSON.stringify(serializeMenuForJsonExport(data), null, 2);
}

/** Copy menu JSON to the clipboard. */
export async function copyMenuJsonToClipboard(data) {
  const json = menuDataToJsonString(data);
  await navigator.clipboard.writeText(json);
}
