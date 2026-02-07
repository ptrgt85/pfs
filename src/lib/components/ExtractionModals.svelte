<script lang="ts">
  // ExtractionModals Component - AI extraction results modal
  
  interface ExtractedLot {
    lotNumber?: string;
    area?: number;
    frontage?: number;
    depth?: number;
    streetName?: string;
    status?: string;
    action: 'create' | 'update' | 'skip';
    existingId?: number;
    existingData?: any;
    hasChanges?: boolean;
  }
  
  interface ExtractedStage {
    stageName?: string;
    stageNumber?: number;
    lots?: ExtractedLot[];
    action: 'create' | 'skip';
  }
  
  interface ExtractionResult {
    summary?: string;
    stages?: ExtractedStage[];
    lots?: ExtractedLot[];
  }
  
  let {
    show,
    extractionResult,
    saving,
    onSaveStages,
    onSaveLots,
    onClose
  }: {
    show: boolean;
    extractionResult: ExtractionResult | null;
    saving: boolean;
    onSaveStages: () => Promise<void>;
    onSaveLots: () => Promise<void>;
    onClose: () => void;
  } = $props();
  
  // Computed stats
  const stageStats = $derived((() => {
    if (!extractionResult?.stages) return { count: 0, lotCount: 0 };
    const activeStages = extractionResult.stages.filter(s => s.action !== 'skip');
    return {
      count: activeStages.length,
      lotCount: activeStages.reduce((sum, s) => sum + (s.lots?.length || 0), 0)
    };
  })());
  
  const lotStats = $derived((() => {
    if (!extractionResult?.lots) return { updates: 0, creates: 0, total: 0 };
    const lots = extractionResult.lots;
    return {
      updates: lots.filter(l => l.action === 'update').length,
      creates: lots.filter(l => l.action === 'create').length,
      total: lots.filter(l => l.action !== 'skip').length
    };
  })());
</script>

{#if show && extractionResult}
  <div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && onClose()} role="presentation">
    <div class="modal extraction-modal" role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>🤖 AI Extraction Results</span>
        <button class="btn-cancel" onclick={onClose}>✕</button>
      </div>
      <div class="modal-body">
        {#if extractionResult.summary}
          <div class="extraction-summary">{extractionResult.summary}</div>
        {/if}
        
        {#if extractionResult.stages && extractionResult.stages.length > 0}
          <!-- Stages extraction (Permit Plan) -->
          <div class="extraction-stats">
            <span class="stat-create">📋 {extractionResult.stages.length} Stages</span>
            <span class="stat-create">🏠 {extractionResult.stages.reduce((sum, s) => sum + (s.lots?.length || 0), 0)} Total Lots</span>
          </div>
          {#each extractionResult.stages as stage, si}
            <div class="stage-section">
              <div class="stage-header">
                <select bind:value={stage.action} class="action-select">
                  <option value="create">Create</option>
                  <option value="skip">Skip</option>
                </select>
                <span class="stage-name">{stage.stageName || `Stage ${stage.stageNumber}`}</span>
                <span class="stage-lot-count">({stage.lots?.length || 0} lots)</span>
              </div>
              {#if stage.lots && stage.lots.length > 0 && stage.action !== 'skip'}
                <table class="extraction-table stage-lots">
                  <thead>
                    <tr><th>Lot #</th><th>Area</th><th>Front</th><th>Depth</th><th>Street</th></tr>
                  </thead>
                  <tbody>
                    {#each stage.lots.slice(0, 10) as lot}
                      <tr>
                        <td>{lot.lotNumber || '-'}</td>
                        <td>{lot.area || '-'}</td>
                        <td>{lot.frontage || '-'}</td>
                        <td>{lot.depth || '-'}</td>
                        <td>{lot.streetName || '-'}</td>
                      </tr>
                    {/each}
                    {#if stage.lots.length > 10}
                      <tr><td colspan="5" class="more-lots">... and {stage.lots.length - 10} more lots</td></tr>
                    {/if}
                  </tbody>
                </table>
              {/if}
            </div>
          {/each}
        {:else if extractionResult.lots && extractionResult.lots.length > 0}
          <!-- Single stage lots extraction -->
          <div class="extraction-stats">
            <span class="stat-update">📝 {lotStats.updates} Updates</span>
            <span class="stat-create">➕ {lotStats.creates} New</span>
          </div>
          <table class="extraction-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Lot #</th>
                <th>Area</th>
                <th>Front</th>
                <th>Depth</th>
                <th>Street</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each extractionResult.lots as lot, i}
                <tr class:row-update={lot.action === 'update'} class:row-create={lot.action === 'create'} class:row-skip={lot.action === 'skip'}>
                  <td class="action-col">
                    <select bind:value={lot.action} class="action-select">
                      {#if lot.existingId}
                        <option value="update">Update</option>
                        <option value="create">Create New</option>
                        <option value="skip">Skip</option>
                      {:else}
                        <option value="create">Create</option>
                        <option value="skip">Skip</option>
                      {/if}
                    </select>
                  </td>
                  <td>{lot.lotNumber || '-'}</td>
                  <td class="compare-cell">
                    {#if lot.existingData && lot.area}
                      <span class="old-val">{lot.existingData.area || '-'}</span>
                      <span class="arrow">→</span>
                    {/if}
                    <span class="new-val">{lot.area || '-'}</span>
                  </td>
                  <td class="compare-cell">
                    {#if lot.existingData && lot.frontage}
                      <span class="old-val">{lot.existingData.frontage || '-'}</span>
                      <span class="arrow">→</span>
                    {/if}
                    <span class="new-val">{lot.frontage || '-'}</span>
                  </td>
                  <td class="compare-cell">
                    {#if lot.existingData && lot.depth}
                      <span class="old-val">{lot.existingData.depth || '-'}</span>
                      <span class="arrow">→</span>
                    {/if}
                    <span class="new-val">{lot.depth || '-'}</span>
                  </td>
                  <td>{lot.streetName || '-'}</td>
                  <td>
                    {#if lot.existingId}
                      {#if lot.hasChanges}
                        <span class="status-changed">Changed</span>
                      {:else}
                        <span class="status-same">No Change</span>
                      {/if}
                    {:else}
                      <span class="status-new">New</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="empty-msg">No lots extracted from document</div>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick={onClose} disabled={saving}>Cancel</button>
        {#if extractionResult.stages && extractionResult.stages.length > 0}
          <button class="btn-save" onclick={onSaveStages} disabled={stageStats.count === 0 || saving}>
            {saving ? 'Creating...' : `Create ${stageStats.count} Stages (${stageStats.lotCount} lots)`}
          </button>
        {:else if extractionResult.lots && extractionResult.lots.length > 0}
          <button class="btn-save" onclick={onSaveLots} disabled={lotStats.total === 0 || saving}>
            {saving ? 'Applying...' : `Apply ${lotStats.total} Changes`}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .extraction-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    width: 800px;
    max-width: 95vw;
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }
  
  .extraction-summary {
    padding: 12px;
    background: rgba(122, 162, 247, 0.1);
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .extraction-stats {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }
  
  .stat-create {
    padding: 6px 12px;
    background: rgba(158, 206, 106, 0.2);
    color: var(--accent-success);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .stat-update {
    padding: 6px 12px;
    background: rgba(224, 175, 104, 0.2);
    color: var(--accent-warning);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .stage-section {
    margin-bottom: 16px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .stage-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg-primary);
  }
  
  .stage-name {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .stage-lot-count {
    color: var(--text-muted);
    font-size: 11px;
  }
  
  .action-select {
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 11px;
  }
  
  .extraction-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  
  .extraction-table th,
  .extraction-table td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }
  
  .extraction-table th {
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-weight: 500;
    font-size: 10px;
    text-transform: uppercase;
  }
  
  .extraction-table.stage-lots {
    margin: 0;
  }
  
  .extraction-table.stage-lots th,
  .extraction-table.stage-lots td {
    padding: 6px 10px;
    font-size: 10px;
  }
  
  tr.row-update {
    background: rgba(224, 175, 104, 0.05);
  }
  
  tr.row-create {
    background: rgba(158, 206, 106, 0.05);
  }
  
  tr.row-skip {
    opacity: 0.4;
  }
  
  .compare-cell {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .old-val {
    color: var(--text-muted);
    text-decoration: line-through;
    font-size: 10px;
  }
  
  .arrow {
    color: var(--accent-warning);
    font-size: 10px;
  }
  
  .new-val {
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .status-changed {
    color: var(--accent-warning);
    font-size: 10px;
  }
  
  .status-same {
    color: var(--text-muted);
    font-size: 10px;
  }
  
  .status-new {
    color: var(--accent-success);
    font-size: 10px;
  }
  
  .more-lots {
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
  }
  
  .empty-msg {
    color: var(--text-muted);
    font-size: 12px;
    font-style: italic;
    text-align: center;
    padding: 24px;
  }
  
  .modal-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  
  .btn-cancel,
  .btn-save {
    padding: 8px 16px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  
  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }
  
  .btn-save {
    background: var(--accent-success);
    border: none;
    color: var(--bg-primary);
    font-weight: 600;
  }
  
  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
