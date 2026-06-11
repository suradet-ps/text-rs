<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView } from '@codemirror/view';
  import { createEditorState } from '$lib/codemirror/setup';
  import { tabsStore } from '$lib/stores/tabs.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';

  interface Props {
    tabId: string;
    content: string;
    language: string;
    onContentChange: (content: string) => void;
    onCursorUpdate: (line: number, col: number) => void;
  }

  let { tabId, content, language, onContentChange, onCursorUpdate }: Props = $props();

  let editorEl: HTMLDivElement;
  let view: EditorView | null = null;
  let lastTabId = '';
  let suppressNextUpdate = false;

  function getTheme(): 'light' | 'dark' {
    return settingsStore.theme === 'dark' ? 'dark' : 'light';
  }

  function destroyEditor() {
    if (view) {
      view.destroy();
      view = null;
    }
  }

  function createEditor(doc: string, lang: string) {
    destroyEditor();
    if (!editorEl) return;

    const state = createEditorState(
      doc,
      settingsStore.settings,
      getTheme(),
      lang,
      (value) => {
        if (!suppressNextUpdate) {
          onContentChange(value);
        }
      },
      (update) => {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        onCursorUpdate(line.number, pos - line.from + 1);
      },
    );

    view = new EditorView({ state, parent: editorEl });
  }

  onMount(() => {
    createEditor(content, language);
    lastTabId = tabId;
  });

  onDestroy(() => {
    destroyEditor();
  });

  $effect(() => {
    if (tabId !== lastTabId && view) {
      lastTabId = tabId;
      createEditor(content, language);
    }
  });
</script>

<div class="editor-wrapper" bind:this={editorEl}></div>

<style>
  .editor-wrapper {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .editor-wrapper :global(.cm-editor) {
    height: 100%;
    flex: 1;
  }

  .editor-wrapper :global(.cm-scroller) {
    overflow: auto;
  }
</style>
