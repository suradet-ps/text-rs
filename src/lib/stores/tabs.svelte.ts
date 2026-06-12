export interface Tab {
  id: string;
  path: string | null;
  fileName: string;
  content: string;
  savedContent: string;
  language: string;
  encoding: string;
  lineEnding: string;
  cursorLine: number;
  cursorCol: number;
  scrollTop: number;
}

export interface FilePayload {
  path: string;
  content: string;
  file_name: string;
  encoding?: string;
  line_ending?: string;
}

let _tabs = $state<Tab[]>([]);
let _activeTabId = $state<string | null>(null);
let _untitledCounter = $state(0);

export const tabsStore = {
  get tabs() { return _tabs; },
  get activeTabId() { return _activeTabId; },

  get activeTab(): Tab | undefined {
    return _tabs.find(t => t.id === _activeTabId);
  },

  newTab(): Tab {
    _untitledCounter++;
    const tab: Tab = {
      id: crypto.randomUUID(),
      path: null,
      fileName: `untitled-${_untitledCounter}`,
      content: '',
      savedContent: '',
      language: 'text',
      encoding: 'UTF-8',
      lineEnding: 'LF',
      cursorLine: 1,
      cursorCol: 1,
      scrollTop: 0,
    };
    _tabs = [..._tabs, tab];
    _activeTabId = tab.id;
    return tab;
  },

  openTab(payload: FilePayload): Tab {
    const existing = _tabs.find(t => t.path === payload.path);
    if (existing) {
      _activeTabId = existing.id;
      return existing;
    }

    // If there's only one empty untitled tab, replace it
    if (_tabs.length === 1 && _tabs[0].path === null && _tabs[0].content === '') {
      _tabs = [];
    }

    const tab: Tab = {
      id: crypto.randomUUID(),
      path: payload.path,
      fileName: payload.file_name,
      content: payload.content,
      savedContent: payload.content,
      language: detectLangFromPath(payload.path),
      encoding: payload.encoding ?? 'UTF-8',
      lineEnding: payload.line_ending ?? 'LF',
      cursorLine: 1,
      cursorCol: 1,
      scrollTop: 0,
    };
    _tabs = [..._tabs, tab];
    _activeTabId = tab.id;
    return tab;
  },

  closeTab(id: string): boolean {
    const idx = _tabs.findIndex(t => t.id === id);
    if (idx === -1) return false;
    const tab = _tabs[idx];
    if (tab.content !== tab.savedContent) return false;

    _tabs = _tabs.filter(t => t.id !== id);
    if (_activeTabId === id) {
      _activeTabId = _tabs.length > 0 ? _tabs[Math.min(idx, _tabs.length - 1)].id : null;
    }
    // Ensure at least one tab exists
    if (_tabs.length === 0) {
      this.newTab();
    }
    return true;
  },

  forceCloseTab(id: string) {
    const idx = _tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    _tabs = _tabs.filter(t => t.id !== id);
    if (_activeTabId === id) {
      _activeTabId = _tabs.length > 0 ? _tabs[Math.min(idx, _tabs.length - 1)].id : null;
    }
    // Ensure at least one tab exists
    if (_tabs.length === 0) {
      _untitledCounter++;
      const tab: Tab = {
        id: crypto.randomUUID(),
        path: null,
        fileName: `untitled-${_untitledCounter}`,
        content: '',
        savedContent: '',
        language: 'text',
        encoding: 'UTF-8',
        lineEnding: 'LF',
        cursorLine: 1,
        cursorCol: 1,
        scrollTop: 0,
      };
      _tabs = [..._tabs, tab];
      _activeTabId = tab.id;
    }
  },

  setActive(id: string) {
    _activeTabId = id;
  },

  updateContent(id: string, content: string) {
    _tabs = _tabs.map(t => t.id === id ? { ...t, content } : t);
  },

  markSaved(id: string, path: string) {
    const tab = _tabs.find(t => t.id === id);
    if (tab) {
      _tabs = _tabs.map(t => t.id === id ? {
        ...t,
        savedContent: t.content,
        path,
        fileName: path.split('/').pop() || path.split('\\').pop() || t.fileName,
        language: detectLangFromPath(path),
      } : t);
    }
  },

  renameTab(id: string, newName: string) {
    _tabs = _tabs.map(t => t.id === id ? { ...t, fileName: newName } : t);
  },

  updateCursor(id: string, line: number, col: number) {
    _tabs = _tabs.map(t => t.id === id ? { ...t, cursorLine: line, cursorCol: col } : t);
  },

  updateScrollTop(id: string, scrollTop: number) {
    _tabs = _tabs.map(t => t.id === id ? { ...t, scrollTop } : t);
  },

  reorder(fromIdx: number, toIdx: number) {
    const tabs = [..._tabs];
    const [moved] = tabs.splice(fromIdx, 1);
    tabs.splice(toIdx, 0, moved);
    _tabs = tabs;
  },

  getDirtyTabs(): Tab[] {
    return _tabs.filter(t => t.content !== t.savedContent);
  },

  hasDirtyTabs(): boolean {
    return _tabs.some(t => t.content !== t.savedContent);
  },

  closeAll() {
    _tabs = [];
    _activeTabId = null;
  }
};

function detectLangFromPath(path: string | null): string {
  if (!path) return 'text';
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
