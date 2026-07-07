/**
 * Generates an RFC4122 v4 compliant UUID.
 * Works consistently across all environments (Native Android/iOS, Node.js, Electron, and Web).
 */
export function generateUUID(): string {
  // If global crypto is available and has randomUUID, use it
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback RFC4122 v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
