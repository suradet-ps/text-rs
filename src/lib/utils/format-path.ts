export function formatPath(path: string, maxLen: number = 40): string {
  if (path.length <= maxLen) return path;
  const separator = path.includes('\\') ? '\\' : '/';
  const parts = path.split(separator);
  if (parts.length <= 2) return path;
  const fileName = parts[parts.length - 1];
  const dir = parts.slice(0, 2).join(separator);
  return `${dir}${separator}...${separator}${fileName}`;
}

export function getFileName(path: string): string {
  const separator = path.includes('\\') ? '\\' : '/';
  return path.split(separator).pop() ?? 'untitled';
}

export function getDirectory(path: string): string {
  const separator = path.includes('\\') ? '\\' : '/';
  const parts = path.split(separator);
  parts.pop();
  return parts.join(separator) || '/';
}
