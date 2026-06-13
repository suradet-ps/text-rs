/**
 * Ensures a file path has an extension. If the filename is a hidden file
 * (starts with a dot) or already has an extension, it is returned as-is.
 *
 * Examples:
 *   ensureExtension('/Users/me/my_note')         → '/Users/me/my_note.txt'
 *   ensureExtension('/Users/me/.env')             → '/Users/me/.env'          (dotfile kept)
 *   ensureExtension('/Users/me/notes.md')         → '/Users/me/notes.md'
 *   ensureExtension('/Users/me/archive.tar.gz')   → '/Users/me/archive.tar.gz'
 */
export function ensureExtension(filePath: string, defaultExt: string = 'txt'): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const filename = filePath.substring(lastSlash + 1);

  if (!filename) return filePath;

  // Hidden files (starting with a dot) are kept as-is
  if (filename.startsWith('.')) return filePath;

  const visible = filename.replace(/^\.+/, '');
  if (!visible.includes('.')) {
    return `${filePath}.${defaultExt}`;
  }
  return filePath;
}
