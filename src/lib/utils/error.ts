/**
 * Coerce an unknown thrown value (from `catch (e: unknown)`) into a
 * human-readable string. Tauri 2 IPC errors come through as `string`,
 * native errors as `Error`, anything else is JSON-stringified.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
