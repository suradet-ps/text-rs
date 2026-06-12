export function detectLanguage(path: string | null, content?: string): string {
  if (!path) {
    // Try shebang detection for untitled files
    if (content) return detectFromShebang(content);
    return 'text';
  }
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const extMap: Record<string, string> = {
    rs: 'rust', ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    py: 'python', pyw: 'python', html: 'html', htm: 'html',
    css: 'css', scss: 'css', less: 'css',
    md: 'markdown', markdown: 'markdown',
    json: 'json', jsonc: 'json', sql: 'sql', graphql: 'sql',
    xml: 'xml', svg: 'xml', vue: 'vue', svelte: 'javascript',
    cpp: 'cpp', cc: 'cpp', c: 'cpp', h: 'cpp', hpp: 'cpp',
    java: 'java', php: 'php', go: 'go', rb: 'ruby',
    toml: 'toml', yaml: 'yaml', yml: 'yaml',
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
    txt: 'text', log: 'text', csv: 'text', ini: 'text', cfg: 'text', conf: 'text',
    env: 'text', rst: 'text',
  };
  return extMap[ext] ?? 'text';
}

function detectFromShebang(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  if (!firstLine.startsWith('#!')) return 'text';

  const shebang = firstLine.slice(2).toLowerCase();
  if (shebang.includes('python') || shebang.includes('python3')) return 'python';
  if (shebang.includes('node')) return 'javascript';
  if (shebang.includes('bash') || shebang.includes('sh')) return 'bash';
  if (shebang.includes('zsh')) return 'bash';
  if (shebang.includes('ruby')) return 'ruby';
  if (shebang.includes('perl')) return 'text';
  return 'text';
}
