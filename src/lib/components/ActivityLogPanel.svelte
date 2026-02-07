<script lang="ts">
  // ActivityLogPanel Component - Collapsible bottom panel showing activity entries
  
  interface LogEntry {
    message: string;
    type: 'success' | 'error' | 'loading' | 'info' | 'warning';
    time: string;
  }
  
  interface ExtractionProgress {
    current: number;
    total: number;
    status: string;
  }
  
  let {
    entries,
    extractionProgress,
    collapsed,
    onToggleCollapsed
  }: {
    entries: LogEntry[];
    extractionProgress: ExtractionProgress;
    collapsed: boolean;
    onToggleCollapsed: () => void;
  } = $props();
</script>

<div class="log-panel" class:collapsed={collapsed}>
  <button class="log-header" onclick={onToggleCollapsed}>
    <span>{collapsed ? '▶' : '▼'} Activity Log</span>
    <span class="log-toggle-hint">{collapsed ? 'expand' : 'collapse'}</span>
  </button>
  {#if extractionProgress.total > 0}
    <div class="extraction-progress">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {extractionProgress.current}%"></div>
      </div>
      <span class="progress-text">{extractionProgress.status} ({extractionProgress.current}%)</span>
    </div>
  {/if}
  <div class="log-content">
    {#each entries.slice().reverse() as entry}
      <span class="log-{entry.type}">[{entry.time}] {entry.message}</span>
    {/each}
  </div>
</div>

<style>
  .log-panel {
    height: 100px;
    min-height: 100px;
    flex-shrink: 0;
    border-top: 1px solid var(--border-color);
    background: var(--input-bg);
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
    transition: height 0.2s ease, min-height 0.2s ease;
  }
  
  .log-panel.collapsed {
    height: 32px;
    min-height: 32px;
  }
  
  .log-panel.collapsed .log-content,
  .log-panel.collapsed .extraction-progress {
    display: none;
  }
  
  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    color: var(--accent-secondary);
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    padding: 2px 0;
    width: 100%;
    text-align: left;
  }
  
  .log-header:hover {
    color: var(--accent-primary);
  }
  
  .log-toggle-hint {
    font-size: 9px;
    color: var(--text-muted);
    opacity: 0.7;
  }
  
  .extraction-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  
  .progress-bar {
    flex: 1;
    height: 8px;
    background: var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  
  .progress-text {
    font-size: 10px;
    color: var(--text-secondary);
    min-width: 180px;
  }
  
  .log-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 11px;
  }
  
  .log-success { color: var(--accent-success); }
  .log-error { color: var(--accent-error); }
  .log-loading { color: var(--accent-warning); }
  .log-info { color: #7dcfff; }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .log-panel {
      height: 60px;
      font-size: 9px;
    }
  }
  
  @media (max-height: 500px) and (orientation: landscape) {
    .log-panel {
      height: 40px;
    }
  }
</style>
