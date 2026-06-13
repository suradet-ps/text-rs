<script lang="ts">
  import { onMount, tick } from 'svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import FindReplace from '$lib/components/FindReplace.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { tabsStore, type Tab } from '$lib/stores/tabs.svelte';
  import { recentStore } from '$lib/stores/recent.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { ipc } from '$lib/tauri/ipc';
  import { dispatchEditorAction } from '$lib/editor/actions';
  import { errorMessage } from '$lib/utils/error';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import type { FilePayload, RecoveryEntry } from '$lib/types/ipc';

  const SOFT_LIMIT_BYTES = 10 * 1024 * 1024;
  const RECOVERY_INTERVAL_MS = 15_000;
  const TOAST_DURATION_MS = 4_000;
  const SOFT_LIMIT_MB = SOFT_LIMIT_BYTES / (1024 * 1024);

  let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
  function getAppWindow() {
    if (!appWindow) appWindow = getCurrentWindow();
    return appWindow;
  }

  let showFindReplace = $state(false);
  let showGoToLine = $state(false);
  let goToLineValue = $state('');
  let showRecentDialog = $state(false);
  let toastMessage = $state('');
  let toastVisible = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  let confirmOpen = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let confirmShowSave = $state(true);
  let confirmShowDiscard = $state(true);
  let confirmShowCancel = $state(true);
  let confirmSaveLabel = $state('Save');
  let confirmResolve: ((value: 'save' | 'discard' | 'cancel') => void) | null = null;

  function showConfirmDialog(
    title: string,
    message: string,
    opts?: { saveLabel?: string; showSave?: boolean; showDiscard?: boolean; showCancel?: boolean }
  ): Promise<'save' | 'discard' | 'cancel'> {
    return new Promise((resolve) => {
      confirmTitle = title;
      confirmMessage = message;
      confirmShowSave = opts?.showSave ?? true;
      confirmShowDiscard = opts?.showDiscard ?? true;
      confirmShowCancel = opts?.showCancel ?? true;
      confirmSaveLabel = opts?.saveLabel ?? 'Save';
      confirmOpen = true;
      confirmResolve = resolve;
    });
  }

  function handleConfirmSave() {
    confirmOpen = false;
    confirmResolve?.('save');
  }

  function handleConfirmDiscard() {
    confirmOpen = false;
    confirmResolve?.('discard');
  }

  function handleConfirmCancel() {
    confirmOpen = false;
    confirmResolve?.('cancel');
  }

  function showToast(message: string) {
    toastMessage = message;
    toastVisible = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastVisible = false;
    }, TOAST_DURATION_MS);
  }

  async function handleOpenFile() {
    try {
      const payload = await ipc.openFile();
      if (payload) {
        tabsStore.openTab(payload);
        await recentStore.add(payload.path);
      }
    } catch (e: unknown) {
      showToast(`Failed to open file: ${errorMessage(e)}`);
    }
  }

  async function handleOpenRecent(path: string) {
    try {
      const payload = await ipc.readFile(path);
      tabsStore.openTab(payload);
      await recentStore.add(path);
    } catch (e: unknown) {
      const err = errorMessage(e);
      if (err.toLowerCase().includes('not found') || err.toLowerCase().includes('no such file')) {
        await recentStore.remove(path);
        showToast(`File not found: ${path}`);
      } else {
        showToast(`Failed to open: ${err}`);
      }
    }
    showRecentDialog = false;
  }

  async function handleOpenFromPath(path: string) {
    try {
      const sizeStr = await ipc.checkFileSize(path);
      const size = Number(sizeStr);
      if (size > SOFT_LIMIT_BYTES) {
        const result = await showConfirmDialog(
          'Large File',
          `This file is ${(size / (1024 * 1024)).toFixed(1)} MB. Opening large files may be slow. Continue?`,
        );
        if (result !== 'save') return;
      }
      const payload = await ipc.readFile(path);
      tabsStore.openTab(payload);
      await recentStore.add(path);
    } catch (e: unknown) {
      showToast(`Failed to open: ${errorMessage(e)}`);
    }
  }

  async function handleSave() {
    const tab = tabsStore.activeTab;
    if (!tab) return;

    if (!tab.path) {
      await handleSaveAs();
      return;
    }

    try {
      await ipc.saveFile({
        path: tab.path,
        content: tab.content,
        lineEnding: tab.lineEnding,
        encoding: tab.encoding,
      });
      tabsStore.markSaved(tab.id, tab.path);
      updateWindowTitle();
    } catch (e: unknown) {
      const err = errorMessage(e);
      if (err.toLowerCase().includes('permission denied') || err.toLowerCase().includes('read-only')) {
        const result = await showConfirmDialog(
          'Cannot Save',
          `Cannot save "${tab.fileName}" \u2014 the file is read-only. Save a copy instead?`,
          { showDiscard: false, saveLabel: 'Save Copy' },
        );
        if (result === 'save') {
          await handleSaveAs();
        }
      } else {
        showToast(`Failed to save: ${err}`);
      }
    }
  }

  async function handleSaveAs() {
    const tab = tabsStore.activeTab;
    if (!tab) return;

    try {
      const newPath = await ipc.saveFileAs({
        content: tab.content,
        suggestedName: tab.fileName,
        lineEnding: tab.lineEnding,
        encoding: tab.encoding,
      });
      if (newPath) {
        tabsStore.markSaved(tab.id, newPath);
        await recentStore.add(newPath);
        updateWindowTitle();
      }
    } catch (e: unknown) {
      showToast(`Failed to save as: ${errorMessage(e)}`);
    }
  }

  function handleContentChange(content: string) {
    const tab = tabsStore.activeTab;
    if (tab) {
      tabsStore.updateContent(tab.id, content);
    }
  }

  function handleCursorUpdate(line: number, col: number) {
    const tab = tabsStore.activeTab;
    if (tab) {
      tabsStore.updateCursor(tab.id, line, col);
    }
  }

  function updateWindowTitle() {
    const tab = tabsStore.activeTab;
    if (!tab) {
      ipc.setWindowTitle('text-rs').catch(() => {});
      return;
    }
    const dirty = tab.content !== tab.savedContent ? '\u2022 ' : '';
    const title = `${dirty}${tab.fileName} \u2014 text-rs`;
    ipc.setWindowTitle(title).catch(() => {});
  }

  let lastTitleDirty = $state(false);

  $effect(() => {
    const tab = tabsStore.activeTab;
    if (!tab) {
      ipc.setWindowTitle('text-rs').catch(() => {});
      lastTitleDirty = false;
      return;
    }
    const dirty = tab.content !== tab.savedContent;
    if (dirty !== lastTitleDirty) {
      lastTitleDirty = dirty;
      updateWindowTitle();
    }
  });

  async function handleTabCloseRequest(e: CustomEvent<{ tabId: string }>) {
    const tabId = e.detail.tabId;
    const tab = tabsStore.tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.content === tab.savedContent) {
      tabsStore.forceCloseTab(tabId);
      return;
    }

    const result = await showConfirmDialog(
      'Save changes?',
      `"${tab.fileName}" has unsaved changes.`,
    );

    if (result === 'save') {
      if (tab.path) {
        try {
          await ipc.saveFile({
            path: tab.path,
            content: tab.content,
            lineEnding: tab.lineEnding,
            encoding: tab.encoding,
          });
          tabsStore.markSaved(tab.id, tab.path);
          tabsStore.forceCloseTab(tabId);
        } catch (e: unknown) {
          showToast(`Failed to save: ${errorMessage(e)}`);
        }
      } else {
        await handleSaveAs();
        // Close regardless of save-as result: user explicitly chose Save
        tabsStore.forceCloseTab(tabId);
      }
    } else if (result === 'discard') {
      tabsStore.forceCloseTab(tabId);
    }
  }

  /**
   * Close-window flow. MUST be called only from the Tauri close interceptor.
   * Always decides whether to close. Returns nothing — side effect is `appWindow.close()`.
   */
  async function handleCloseRequest(): Promise<void> {
    const dirtyTabs = tabsStore.getDirtyTabs();
    if (dirtyTabs.length === 0) {
      getAppWindow().close();
      return;
    }

    const result = await showConfirmDialog(
      'Unsaved Changes',
      `You have ${dirtyTabs.length} unsaved file(s). Save before closing?`,
      { saveLabel: 'Save All' },
    );

    if (result === 'cancel') return;

    if (result === 'save') {
      const failed: Tab[] = [];
      for (const tab of dirtyTabs) {
        if (!tab.path) {
          failed.push(tab);
          continue;
        }
        try {
          await ipc.saveFile({
            path: tab.path,
            content: tab.content,
            lineEnding: tab.lineEnding,
            encoding: tab.encoding,
          });
          tabsStore.markSaved(tab.id, tab.path);
        } catch (e: unknown) {
          console.error('Failed to save:', e);
          failed.push(tab);
        }
      }
      if (failed.length > 0) {
        showToast(`Could not save ${failed.length} file(s). Close aborted.`);
        return;
      }
    }
    getAppWindow().close();
  }

  function handleGoToLine() {
    const line = parseInt(goToLineValue, 10);
    if (isNaN(line) || line < 1) return;

    dispatchEditorAction({ action: 'go-to-line', line });
    showGoToLine = false;
    goToLineValue = '';
  }

  $effect(() => {
    if (showGoToLine) {
      (async () => {
        await tick();
        document.querySelector<HTMLInputElement>('.goto-line-input')?.focus();
      })();
    }
  });

  function handleGlobalKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === 'n') {
      e.preventDefault();
      tabsStore.newTab();
    } else if (mod && e.key === 'o') {
      e.preventDefault();
      handleOpenFile();
    } else if (mod && !e.shiftKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    } else if (mod && e.shiftKey && e.key === 's') {
      e.preventDefault();
      handleSaveAs();
    } else if (mod && e.key === 'w') {
      e.preventDefault();
      const tab = tabsStore.activeTab;
      if (tab) {
        if (tab.content !== tab.savedContent) {
          void handleTabCloseRequest(new CustomEvent('tab-close', { detail: { tabId: tab.id } }));
        } else {
          tabsStore.forceCloseTab(tab.id);
        }
      }
    } else if (mod && e.key === 'f') {
      e.preventDefault();
      showFindReplace = !showFindReplace;
    } else if (mod && e.key === 'h') {
      e.preventDefault();
      showFindReplace = true;
    } else if (mod && e.key === 'g') {
      e.preventDefault();
      showGoToLine = true;
    } else if (mod && e.key === '=') {
      e.preventDefault();
      settingsStore.increaseFontSize();
    } else if (mod && e.key === '-') {
      e.preventDefault();
      settingsStore.decreaseFontSize();
    } else if (mod && e.key === '0') {
      e.preventDefault();
      settingsStore.resetFontSize();
    } else if (e.altKey && e.key === 'z') {
      e.preventDefault();
      settingsStore.toggleWordWrap();
    } else if (e.key === 'F3') {
      e.preventDefault();
      dispatchEditorAction({ action: 'search-next', query: '', caseSensitive: false, useRegex: false });
    } else if (e.shiftKey && e.key === 'F3') {
      e.preventDefault();
      dispatchEditorAction({ action: 'search-prev', query: '', caseSensitive: false, useRegex: false });
    } else if (mod && !e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      const tabIds = tabsStore.tabs.map(t => t.id);
      if (tabIds.length === 0) return;
      const currentIdx = tabIds.indexOf(tabsStore.activeTabId ?? '');
      const nextIdx = currentIdx >= tabIds.length - 1 ? 0 : currentIdx + 1;
      tabsStore.setActive(tabIds[nextIdx]);
    } else if (mod && e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      const tabIds = tabsStore.tabs.map(t => t.id);
      if (tabIds.length === 0) return;
      const currentIdx = tabIds.indexOf(tabsStore.activeTabId ?? '');
      const prevIdx = currentIdx <= 0 ? tabIds.length - 1 : currentIdx - 1;
      tabsStore.setActive(tabIds[prevIdx]);
    } else if (mod && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      if (idx < tabsStore.tabs.length) {
        tabsStore.setActive(tabsStore.tabs[idx].id);
      }
    }
  }

  let recoveryInterval: ReturnType<typeof setInterval> | null = null;
  let lastRecoveryHash = '';

  async function saveRecovery() {
    const tabs = tabsStore.tabs.map(t => ({
      file_name: t.fileName,
      content: t.content,
      path: t.path,
      saved_at: new Date().toISOString(),
    }));
    // Skip the IPC roundtrip if nothing has changed since the last save
    const hash = JSON.stringify(tabs);
    if (hash === lastRecoveryHash) return;
    lastRecoveryHash = hash;
    try {
      await ipc.saveRecovery(tabs);
    } catch {
      // best-effort
    }
  }

  async function checkRecovery() {
    try {
      const entries = await ipc.checkRecovery();
      if (!entries || entries.length === 0) return;

      const names = entries.map(e => e.file_name).join(', ');
      const result = await showConfirmDialog(
        'Session Recovery',
        `Found unsaved files from previous session: ${names}. Restore them?`,
        { showDiscard: true, showCancel: true, saveLabel: 'Restore' },
      );

      if (result === 'save') {
        for (const entry of entries) {
          try {
            tabsStore.openTab({
              path: entry.path ?? '',
              content: entry.content,
              file_name: entry.file_name,
              encoding: 'UTF-8',
              line_ending: 'LF',
            });
          } catch (e: unknown) {
            showToast(`Could not restore ${entry.file_name}: ${errorMessage(e)}`);
          }
        }
        await ipc.clearRecovery();
      } else if (result === 'discard') {
        await ipc.clearRecovery();
      }
      // 'cancel' → leave recovery data in place for next launch
    } catch {
      // best-effort
    }
  }

  onMount(() => {
    // Single source of truth: Tauri onCloseRequested interceptor.
    const closeUnlistenPromise = getAppWindow().onCloseRequested((event) => {
      event.preventDefault();
      void handleCloseRequest();
    });

    const init = async () => {
      // Run independent inits in parallel
      await Promise.all([settingsStore.init(), recentStore.refresh()]);

      if (tabsStore.tabs.length === 0) {
        tabsStore.newTab();
      }

      // Open files passed via OS (right-click → Open with, drag onto icon, etc.)
      try {
        const pending = await ipc.getPending();
        for (const filePath of pending) {
          await handleOpenFromPath(filePath);
        }
      } catch {
        // no pending files
      }

      await checkRecovery();
      updateWindowTitle();
    };
    void init();

    // Start recovery auto-save
    void saveRecovery();
    recoveryInterval = setInterval(() => void saveRecovery(), RECOVERY_INTERVAL_MS);

    window.addEventListener('keydown', handleGlobalKeydown);

    const tabCloseHandler: EventListener = (e) => {
      void handleTabCloseRequest(e as CustomEvent<{ tabId: string }>);
    };
    window.addEventListener('tab-close-request', tabCloseHandler);

    const menuHandlers: Array<{ event: string; handler: EventListener }> = [
      { event: 'menu-new-tab', handler: () => tabsStore.newTab() },
      { event: 'menu-open-file', handler: () => void handleOpenFile() },
      { event: 'menu-save', handler: () => void handleSave() },
      { event: 'menu-save-as', handler: () => void handleSaveAs() },
      {
        event: 'menu-close-tab',
        handler: () => {
          const tab = tabsStore.activeTab;
          if (!tab) return;
          if (tab.content !== tab.savedContent) {
            void handleTabCloseRequest(new CustomEvent('tab-close', { detail: { tabId: tab.id } }));
          } else {
            tabsStore.forceCloseTab(tab.id);
          }
        },
      },
      { event: 'menu-undo', handler: () => dispatchEditorAction({ action: 'undo' }) },
      { event: 'menu-redo', handler: () => dispatchEditorAction({ action: 'redo' }) },
      { event: 'menu-cut', handler: () => dispatchEditorAction({ action: 'cut' }) },
      { event: 'menu-copy', handler: () => dispatchEditorAction({ action: 'copy' }) },
      { event: 'menu-paste', handler: () => dispatchEditorAction({ action: 'paste' }) },
      { event: 'menu-select-all', handler: () => dispatchEditorAction({ action: 'select-all' }) },
      { event: 'menu-find', handler: () => { showFindReplace = true; } },
      { event: 'menu-find-replace', handler: () => { showFindReplace = true; } },
      { event: 'menu-go-to-line', handler: () => { showGoToLine = true; } },
      { event: 'menu-zoom-in', handler: () => settingsStore.increaseFontSize() },
      { event: 'menu-zoom-out', handler: () => settingsStore.decreaseFontSize() },
      { event: 'menu-zoom-reset', handler: () => settingsStore.resetFontSize() },
      { event: 'menu-word-wrap', handler: () => settingsStore.toggleWordWrap() },
      { event: 'menu-status-bar', handler: () => settingsStore.toggleStatusBar() },
    ];

    const menuOpenRecentHandler: EventListener = (e) => {
      const path = (e as CustomEvent<string>).detail;
      void handleOpenRecent(path);
    };
    const menuAboutHandler: EventListener = () => {
      void showConfirmDialog(
        'About text-rs',
        'text-rs v0.2.0\nA fast, lightweight text editor.\nBuilt with Tauri, Svelte 5, and CodeMirror 6.',
        { showDiscard: false, showCancel: false, saveLabel: 'OK' },
      );
    };

    menuHandlers.forEach(({ event, handler }) => window.addEventListener(event, handler));
    window.addEventListener('menu-open-recent', menuOpenRecentHandler);
    window.addEventListener('menu-about', menuAboutHandler);

    // OS file-open events and drag-drop
    const unlistenFileOpened = getAppWindow().listen<string[]>('file-opened', async (event) => {
      for (const filePath of event.payload) {
        await handleOpenFromPath(filePath);
      }
    });
    const unlistenDragDrop = getAppWindow().onDragDropEvent(async (event) => {
      if (event.payload.type === 'drop') {
        for (const filePath of event.payload.paths) {
          await handleOpenFromPath(filePath);
        }
      }
    });

    return () => {
      if (toastTimer) clearTimeout(toastTimer);
      if (recoveryInterval) clearInterval(recoveryInterval);
      window.removeEventListener('keydown', handleGlobalKeydown);
      window.removeEventListener('tab-close-request', tabCloseHandler);
      menuHandlers.forEach(({ event, handler }) => window.removeEventListener(event, handler));
      window.removeEventListener('menu-open-recent', menuOpenRecentHandler);
      window.removeEventListener('menu-about', menuAboutHandler);
      unlistenFileOpened.then((fn) => fn());
      unlistenDragDrop.then((fn) => fn());
      closeUnlistenPromise.then((fn) => fn());
    };
  });
</script>

<div class="app">
  <TabBar />
  <div class="editor-area">
    {#if tabsStore.activeTab}
      <FindReplace
        show={showFindReplace}
        onClose={() => showFindReplace = false}
      />
      {#if showGoToLine}
        <div class="goto-line-panel" role="dialog" aria-label="Go to Line">
          <input
            class="goto-line-input"
            type="number"
            min="1"
            placeholder="Line number"
            bind:value={goToLineValue}
            onkeydown={(e) => {
              if (e.key === 'Enter') handleGoToLine();
              if (e.key === 'Escape') { showGoToLine = false; goToLineValue = ''; }
            }}
          />
          <button class="goto-line-btn" onclick={handleGoToLine}>Go</button>
        </div>
      {/if}
      <Editor
        tabId={tabsStore.activeTab.id}
        content={tabsStore.activeTab.content}
        language={tabsStore.activeTab.language}
        onContentChange={handleContentChange}
        onCursorUpdate={handleCursorUpdate}
      />
    {:else}
      <div class="empty-state">
        <p>No open files</p>
        <p class="empty-hint">Ctrl+N to create a new tab, Ctrl+O to open a file</p>
      </div>
    {/if}
  </div>
  <StatusBar />

  {#if showRecentDialog}
    <div class="toast-backdrop" onclick={() => showRecentDialog = false} onkeydown={() => {}} role="presentation">
      <div class="recent-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog" tabindex="-1">
        <h3>Open Recent</h3>
        {#if recentStore.recentFiles.length === 0}
          <p class="recent-empty">No recent files</p>
        {:else}
          <div class="recent-list">
            {#each recentStore.recentFiles as path}
              <button class="recent-item" onclick={() => handleOpenRecent(path)}>
                {path}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if toastVisible}
    <div class="toast" role="alert">{toastMessage}</div>
  {/if}
</div>

<ConfirmDialog
  open={confirmOpen}
  title={confirmTitle}
  message={confirmMessage}
  showSave={confirmShowSave}
  showDiscard={confirmShowDiscard}
  showCancel={confirmShowCancel}
  saveLabel={confirmSaveLabel}
  onSave={handleConfirmSave}
  onDiscard={handleConfirmDiscard}
  onCancel={handleConfirmCancel}
/>

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--canvas);
    overflow: hidden;
  }

  .editor-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    background: var(--canvas);
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    gap: var(--sp-xs);
  }

  .empty-hint {
    font-size: 12px;
    color: var(--muted-soft);
  }

  .goto-line-panel {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--surface-card);
    border: 1px solid var(--hairline);
    border-radius: var(--r-lg);
    padding: var(--sp-md);
    display: flex;
    gap: var(--sp-xs);
    z-index: 60;
    box-shadow: 0 8px 32px rgba(20, 20, 19, 0.15);
  }

  .goto-line-input {
    width: 120px;
    height: 32px;
    padding: 0 var(--sp-xs);
    background: var(--canvas);
    border: 1px solid var(--hairline);
    border-radius: var(--r-sm);
    font-size: 14px;
    color: var(--ink);
    text-align: center;
  }

  .goto-line-input:focus {
    border-color: var(--primary);
    outline: none;
  }

  .goto-line-btn {
    height: 32px;
    padding: 0 var(--sp-md);
    background: var(--primary);
    color: var(--on-primary);
    border-radius: var(--r-md);
    font-size: 13px;
    font-weight: 500;
  }

  .goto-line-btn:hover {
    background: var(--primary-active);
  }

  .toast {
    position: fixed;
    bottom: 48px;
    right: var(--sp-md);
    background: var(--surface-dark);
    color: var(--on-dark);
    border-left: 4px solid var(--error);
    border-radius: var(--r-md);
    padding: var(--sp-sm) var(--sp-md);
    font-size: 13px;
    z-index: 550;
    box-shadow: 0 4px 16px rgba(20, 20, 19, 0.25);
    animation: toastIn 0.2s ease-out;
    max-width: 400px;
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }

  @keyframes toastIn {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .toast-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(20, 20, 19, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
  }

  .recent-dialog {
    background: var(--canvas);
    border: 1px solid var(--hairline);
    border-radius: var(--r-lg);
    padding: var(--sp-lg);
    min-width: 400px;
    max-width: 500px;
    max-height: 400px;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(20, 20, 19, 0.2);
  }

  .recent-dialog h3 {
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
    margin-bottom: var(--sp-md);
  }

  .recent-empty {
    font-size: 13px;
    color: var(--muted-soft);
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .recent-item {
    display: block;
    width: 100%;
    padding: var(--sp-xs) var(--sp-sm);
    font-size: 13px;
    color: var(--body);
    text-align: left;
    border-radius: var(--r-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.1s;
  }

  .recent-item:hover {
    background: var(--surface-soft);
    color: var(--ink);
  }
</style>
