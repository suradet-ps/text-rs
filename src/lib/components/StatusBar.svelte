<script lang="ts">
  import { tabsStore } from '$lib/stores/tabs.svelte';

  let line = $derived(tabsStore.activeTab?.cursorLine ?? 1);
  let col = $derived(tabsStore.activeTab?.cursorCol ?? 1);
  let content = $derived(tabsStore.activeTab?.content ?? '');
  let wordCount = $derived(content ? content.split(/\s+/).filter(Boolean).length : 0);
  let charCount = $derived(content.length);
  let language = $derived(tabsStore.activeTab?.language ?? 'text');

  const langDisplay: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    rust: 'Rust',
    python: 'Python',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    markdown: 'Markdown',
    sql: 'SQL',
    xml: 'XML',
    text: 'Plain Text',
  };
</script>

<div class="statusbar">
  <div class="statusbar-left">
    <span class="statusbar-badge">{langDisplay[language] ?? language}</span>
  </div>
  <div class="statusbar-center">
    <span class="statusbar-item">UTF-8</span>
    <span class="statusbar-sep">·</span>
    <span class="statusbar-item">LF</span>
  </div>
  <div class="statusbar-right">
    <span class="statusbar-item">Ln {line}, Col {col}</span>
    <span class="statusbar-sep">·</span>
    <span class="statusbar-item">{wordCount} words</span>
    <span class="statusbar-sep">·</span>
    <span class="statusbar-item">{charCount} chars</span>
  </div>
</div>

<style>
  .statusbar {
    height: 24px;
    background: var(--surface-soft);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--sp-sm);
    font-size: 11px;
    color: var(--muted);
    flex-shrink: 0;
    user-select: none;
    border-top: 1px solid var(--hairline);
  }

  .statusbar-left,
  .statusbar-center,
  .statusbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .statusbar-badge {
    background: var(--surface-card);
    padding: 1px 6px;
    border-radius: var(--r-xs);
    color: var(--primary);
    font-size: 11px;
    font-weight: 500;
  }

  .statusbar-item {
    color: var(--muted);
  }

  .statusbar-sep {
    color: var(--hairline);
  }
</style>
