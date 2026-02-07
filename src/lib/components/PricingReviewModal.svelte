<script lang="ts">
  // PricingReviewModal Component - Bulk pricing review and edit modal
  
  interface LotData {
    id: number;
    lotNumber?: string;
    name?: string;
    frontage?: number;
    depth?: number;
    area?: number;
    status?: string;
    price?: number;
  }
  
  interface PriceEdit {
    price: number;
    pricePerSqm: number;
    originalPrice: number;
    indicativePrice: number;
  }
  
  interface StatusOption {
    value: string;
    label: string;
    color: string;
  }
  
  let {
    show,
    stageName,
    tableData,
    statusOptions,
    calculateLotPrice,
    onSaveAll,
    onCancel
  }: {
    show: boolean;
    stageName: string;
    tableData: LotData[];
    statusOptions: StatusOption[];
    calculateLotPrice: (lot: LotData) => { totalPrice: number; pricePerSqm: number } | null;
    onSaveAll: (edits: Map<number, PriceEdit>) => Promise<void>;
    onCancel: () => void;
  } = $props();
  
  // Local state
  let stagePriceEdits: Map<number, PriceEdit> = $state(new Map());
  let savingAllPrices = $state(false);
  
  // Initialize edits when modal opens
  $effect(() => {
    if (show) {
      stagePriceEdits = new Map();
      for (const lot of tableData) {
        const indicative = calculateLotPrice(lot);
        const currentPrice = parseFloat(String(lot.price)) || 0;
        const area = parseFloat(String(lot.area)) || 0;
        
        stagePriceEdits.set(lot.id, {
          price: currentPrice,
          pricePerSqm: area > 0 ? Math.round(currentPrice / area) : 0,
          originalPrice: currentPrice,
          indicativePrice: indicative?.totalPrice || 0
        });
      }
      stagePriceEdits = new Map(stagePriceEdits);
    }
  });
  
  // Computed values
  const pendingPriceChanges = $derived(
    Array.from(stagePriceEdits.values()).filter(e => e.price !== e.originalPrice).length
  );
  
  const totalNewValue = $derived(
    Array.from(stagePriceEdits.values()).reduce((sum, e) => sum + e.price, 0)
  );
  
  const totalOriginalValue = $derived(
    Array.from(stagePriceEdits.values()).reduce((sum, e) => sum + e.originalPrice, 0)
  );
  
  function updateLotPriceInReview(lotId: number, newPrice: number) {
    const edit = stagePriceEdits.get(lotId);
    if (!edit) return;
    
    const lot = tableData.find(l => l.id === lotId);
    const area = parseFloat(String(lot?.area)) || 0;
    
    edit.price = newPrice;
    edit.pricePerSqm = area > 0 ? Math.round(newPrice / area) : 0;
    stagePriceEdits = new Map(stagePriceEdits);
  }
  
  function useIndicativePriceInReview(lotId: number) {
    const edit = stagePriceEdits.get(lotId);
    if (!edit || !edit.indicativePrice) return;
    
    const lot = tableData.find(l => l.id === lotId);
    const area = parseFloat(String(lot?.area)) || 0;
    
    edit.price = edit.indicativePrice;
    edit.pricePerSqm = area > 0 ? Math.round(edit.indicativePrice / area) : 0;
    stagePriceEdits = new Map(stagePriceEdits);
  }
  
  function applyIndicativeToAll() {
    for (const [lotId, edit] of stagePriceEdits.entries()) {
      if (edit.indicativePrice > 0) {
        const lot = tableData.find(l => l.id === lotId);
        const area = parseFloat(String(lot?.area)) || 0;
        
        edit.price = edit.indicativePrice;
        edit.pricePerSqm = area > 0 ? Math.round(edit.indicativePrice / area) : 0;
      }
    }
    stagePriceEdits = new Map(stagePriceEdits);
  }
  
  async function handleSaveAll() {
    savingAllPrices = true;
    try {
      await onSaveAll(stagePriceEdits);
    } finally {
      savingAllPrices = false;
    }
  }
</script>

{#if show}
  <div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && onCancel()} role="presentation">
    <div class="modal pricing-review-modal" role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>💰 Pricing Review - {stageName}</span>
        <div class="header-actions">
          {#if pendingPriceChanges > 0}
            <span class="pending-badge">{pendingPriceChanges} pending changes</span>
          {/if}
          <button class="btn-cancel" onclick={onCancel}>✕</button>
        </div>
      </div>
      <div class="modal-body pricing-review-body">
        <div class="review-toolbar">
          <button class="btn-apply-all-indicative" onclick={applyIndicativeToAll}>
            📊 Apply Indicative to All
          </button>
          <span class="review-info">Edit prices below, then Save All to apply changes</span>
        </div>
        <div class="pricing-review-table-wrapper">
          <table class="pricing-review-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Dimensions</th>
                <th>Area</th>
                <th>Status</th>
                <th>Indicative</th>
                <th>Price</th>
                <th>$/m²</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {#each tableData as lot}
                {@const edit = stagePriceEdits.get(lot.id)}
                {@const indicative = calculateLotPrice(lot)}
                {@const hasChange = edit && edit.price !== edit.originalPrice}
                {@const status = statusOptions.find(s => s.value === lot.status)}
                <tr class:has-change={hasChange}>
                  <td class="col-lot">{lot.lotNumber || lot.name || lot.id}</td>
                  <td class="col-dims">{lot.frontage || '-'}×{lot.depth || '-'}m</td>
                  <td class="col-area">{lot.area || '-'} m²</td>
                  <td class="col-status">
                    {#if status}
                      <span class="status-mini" style="color: {status.color}">{status.label}</span>
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="col-indicative">
                    {#if indicative}
                      <button class="btn-use-indicative-small" onclick={() => useIndicativePriceInReview(lot.id)} title="Use this price">
                        ${indicative.totalPrice.toLocaleString()}
                      </button>
                    {:else}
                      <span class="no-indicative">-</span>
                    {/if}
                  </td>
                  <td class="col-price-edit">
                    {#if edit}
                      <input 
                        type="number" 
                        class="price-input" 
                        value={edit.price}
                        oninput={(e) => updateLotPriceInReview(lot.id, parseFloat(e.currentTarget.value) || 0)}
                      />
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="col-sqm">
                    {#if edit && edit.pricePerSqm > 0}
                      ${edit.pricePerSqm}
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="col-change">
                    {#if hasChange}
                      {@const diff = edit.price - edit.originalPrice}
                      <span class="change-indicator" class:positive={diff > 0} class:negative={diff < 0}>
                        {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                      </span>
                    {:else}
                      -
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="pricing-review-summary">
          <div class="summary-stat">
            <span class="label">Total Value:</span>
            <span class="value">${totalNewValue.toLocaleString()}</span>
          </div>
          {#if pendingPriceChanges > 0}
            {@const diff = totalNewValue - totalOriginalValue}
            <div class="summary-stat change">
              <span class="label">Change:</span>
              <span class="value" class:positive={diff > 0} class:negative={diff < 0}>
                {diff > 0 ? '+' : ''}${diff.toLocaleString()}
              </span>
            </div>
          {/if}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick={onCancel} disabled={savingAllPrices}>Cancel</button>
        <button class="btn-save-all" onclick={handleSaveAll} disabled={savingAllPrices || pendingPriceChanges === 0}>
          {savingAllPrices ? 'Saving...' : `💾 Save All (${pendingPriceChanges})`}
        </button>
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
  
  .modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    max-width: 900px;
    width: 95%;
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
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .pending-badge {
    background: rgba(224, 175, 104, 0.2);
    color: var(--accent-warning);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }
  
  .modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }
  
  .review-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .btn-apply-all-indicative {
    padding: 6px 12px;
    background: rgba(122, 162, 247, 0.2);
    border: 1px solid var(--accent-primary);
    border-radius: 4px;
    color: var(--accent-primary);
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  
  .review-info {
    color: var(--text-muted);
    font-size: 11px;
  }
  
  .pricing-review-table-wrapper {
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 12px;
  }
  
  .pricing-review-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  
  .pricing-review-table th,
  .pricing-review-table td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }
  
  .pricing-review-table th {
    background: var(--bg-primary);
    color: var(--text-muted);
    font-weight: 500;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  
  .pricing-review-table tr.has-change {
    background: rgba(224, 175, 104, 0.05);
  }
  
  .status-mini {
    font-size: 10px;
    font-weight: 500;
  }
  
  .btn-use-indicative-small {
    padding: 2px 6px;
    background: rgba(158, 206, 106, 0.1);
    border: 1px solid var(--accent-success);
    border-radius: 3px;
    color: var(--accent-success);
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
  }
  
  .no-indicative {
    color: var(--text-muted);
  }
  
  .price-input {
    width: 90px;
    padding: 4px 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 11px;
  }
  
  .change-indicator {
    font-size: 10px;
    font-weight: 500;
  }
  
  .change-indicator.positive { color: var(--accent-success); }
  .change-indicator.negative { color: var(--accent-error); }
  
  .pricing-review-summary {
    display: flex;
    gap: 24px;
    padding: 12px;
    background: var(--bg-primary);
    border-radius: 4px;
  }
  
  .summary-stat .label {
    color: var(--text-muted);
    font-size: 11px;
    margin-right: 8px;
  }
  
  .summary-stat .value {
    font-weight: 600;
    color: var(--accent-success);
    font-size: 14px;
  }
  
  .summary-stat .value.positive { color: var(--accent-success); }
  .summary-stat .value.negative { color: var(--accent-error); }
  
  .modal-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  
  .btn-cancel, .btn-save-all {
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
  
  .btn-save-all {
    background: var(--accent-success);
    border: none;
    color: var(--bg-primary);
    font-weight: 600;
  }
  
  .btn-save-all:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
