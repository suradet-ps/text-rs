<script lang="ts">
  import { tabsStore } from '$lib/stores/tabs.svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  let appWindow: ReturnType<typeof getCurrentWindow> | null = null;

  function getAppWindow() {
    if (!appWindow) appWindow = getCurrentWindow();
    return appWindow;
  }

  let title = $derived.by(() => {
    const tab = tabsStore.activeTab;
    if (!tab) return 'text-rs';
    const dirty = tab.content !== tab.savedContent ? '• ' : '';
    return `${dirty}text-rs — ${tab.fileName}`;
  });

  function handleMinimize() {
    getAppWindow().minimize();
  }

  function handleMaximize() {
    getAppWindow().toggleMaximize();
  }

  async function handleClose() {
    if (tabsStore.hasDirtyTabs()) {
      window.dispatchEvent(new CustomEvent('window-close-request'));
    } else {
      getAppWindow().close();
    }
  }
</script>

<div class="titlebar" data-tauri-drag-region>
  <div class="titlebar-left">
    <button class="traffic-light close" onclick={handleClose} title="Close">
      <svg class="tl-icon" viewBox="0 0 12 12">
        <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" />
      </svg>
    </button>
    <button class="traffic-light minimize" onclick={handleMinimize} title="Minimize">
      <svg class="tl-icon" viewBox="0 0 12 12">
        <path d="M2.5 6h7" />
      </svg>
    </button>
    <button class="traffic-light maximize" onclick={handleMaximize} title="Maximize">
      <svg class="tl-icon" viewBox="0 0 12 12">
        <path d="M2.5 6h7M6 2.5v7" />
      </svg>
    </button>
  </div>
  <div class="titlebar-title" data-tauri-drag-region>
    {title}
  </div>
  <div class="titlebar-right"></div>
</div>

<style>
  .titlebar {
    height: 38px;
    background: var(--surface-soft);
    display: flex;
    align-items: center;
    padding: 0 12px;
    user-select: none;
    flex-shrink: 0;
    position: relative;
    z-index: 100;
    border-bottom: 1px solid var(--hairline);
  }

  .titlebar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 72px;
    flex-shrink: 0;
  }

  .traffic-light {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: filter 0.15s;
    flex-shrink: 0;
  }

  .traffic-light.close {
    background: #ff5f57;
  }

  .traffic-light.minimize {
    background: #febc2e;
  }

  .traffic-light.maximize {
    background: #28c840;
  }

  .traffic-light:hover {
    filter: brightness(0.85);
  }

  .tl-icon {
    width: 8px;
    height: 8px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .tl-icon path {
    fill: none;
    stroke: rgba(0, 0, 0, 0.5);
    stroke-width: 1.2;
    stroke-linecap: round;
  }

  .titlebar-left:hover .tl-icon {
    opacity: 1;
  }

  .titlebar-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    text-align: center;
    padding: 0 var(--sp-sm);
  }

  .titlebar-right {
    width: 72px;
    flex-shrink: 0;
  }
</style>
