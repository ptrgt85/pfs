<script lang="ts">
  // ========================================
  // PROPS FROM PARENT
  // ========================================
  export let selectedNode: { id: number; name: string; type: string } | null;
  export let tableData: any[];
  export let sortedTableData: any[];
  export let orderedFields: any[];
  export let statusOptions: { value: string; label: string; color: string; bg: string }[];
  export let numberPresets: { label: string; value: number }[];
  export let customFields: any[];
  export let hiddenFields: Set<string>;
  export let pricingProducts: any[];
  export let columnWidths: Record<string, number>;
  export let sortColumn: string;
  export let sortDirection: 'asc' | 'desc';
  export let selectedRows: Set<number>;
  export let editingId: number | null;
  export let editValues: Record<string, string>;
  export let isAdding: boolean;
  export let newRowValues: Record<string, string>;
  export let savingRow: boolean;
  export let savingAdd: boolean;
  export let deletingRow: number | null;
  export let loading: boolean;
  export let userCanEdit: boolean;
  export let userCanDelete: boolean;
  export let typeConfig: Record<string, any>;
  export let typeLabels: Record<string, string>;
  export let showStageTable: boolean;
  export let showFieldsManager: boolean;

  // Bulk edit fields (bound from parent)
  export let bulkEditField: string;
  export let bulkEditValue: string;

  // Callback functions
  export let log: (msg: string, type?: 'success' | 'error' | 'loading' | 'info' | 'warning') => void;
  export let toggleSort: (column: string) => void;
  export let startColumnResize: (e: MouseEvent, columnKey: string) => void;
  export let getColumnWidth: (key: string) => string;
  export let toggleRowSelection: (id: number) => void;
  export let toggleAllRows: () => void;
  export let clearSelection: () => void;
  export let startEdit: (row: any) => void;
  export let cancelEdit: () => void;
  export let saveEdit: (row: any) => void;
  export let startAdd: () => void;
  export let cancelAdd: () => void;
  export let saveAdd: () => void;
  export let deleteRow: (row: any) => void;
  export let applyBulkEdit: () => void;
  export let calculateLotPrice: (lot: any) => any;
  export let acceptIndicativePrice: (lot: any, price: number, pricePerSqm: number) => void;
  export let formatNumber: (value: any, format?: string) => string;
  export let getStatusOption: (value: string) => any;
  export let getCustomFieldValue: (row: any, fieldKey: string) => string;
  export let reloadTableData: () => Promise<void>;

  // ========================================
  // INTERNAL STATE
  // ========================================
  type DateStatus = 'forecast' | 'actual' | 'pending' | 'none';

  let stageTableTab: 'main' | 'dates' | 'pricing' = 'main';

  // Dates tab edit mode
  let datesTabEditMode = false;
  let datesTabEdits: Map<number, Record<string, string>> = new Map();

  // Pricing tab edit mode
  let pricingTabEditMode = false;
  let pricingTabEdits: Map<number, Record<string, string>> = new Map();

  // Inline price editing
  let inlinePriceEditMode = false;
  let inlinePriceEdits: Map<number, number> = new Map();
  let savingAllPrices = false;

  // ========================================
  // INTERNAL FUNCTIONS
  // ========================================

  function getDateStatus(dateStr: string | null | undefined, isActual: boolean | number | undefined): DateStatus {
    if (!dateStr) return 'none';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return 'forecast'; // Future date
    } else if (isActual) {
      return 'actual'; // Past date, confirmed as actual
    } else {
      return 'pending'; // Past date, not confirmed - needs attention
    }
  }

  // Get status indicator styles
  const dateStatusStyles: Record<DateStatus, { color: string; bg: string; border: string; label: string; title: string }> = {
    forecast: { color: '#e0af68', bg: 'rgba(224, 175, 104, 0.15)', border: '#e0af68', label: 'F', title: 'Forecast - Future date' },
    actual: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)', border: '#22c55e', label: 'A', title: 'Actual - Confirmed' },
    pending: { color: '#f7768e', bg: 'rgba(247, 118, 142, 0.15)', border: '#f7768e', label: 'P', title: 'Pending - Needs confirmation' },
    none: { color: '#565f89', bg: 'transparent', border: 'transparent', label: '', title: '' }
  };

  // Toggle actual confirmation for a lot date field
  async function toggleLotDateActual(lotId: number, dateField: string, currentCustomData: any) {
    const actualField = `${dateField}_actual`;
    const currentActual = currentCustomData[actualField] || false;
    const updatedCustomData = { ...currentCustomData, [actualField]: !currentActual };

    try {
      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lotId, customData: JSON.stringify(updatedCustomData) })
      });
      if (res.ok) {
        // Update local tableData
        const lotIndex = tableData.findIndex(l => l.id === lotId);
        if (lotIndex >= 0) {
          tableData[lotIndex].customData = updatedCustomData;
          tableData = [...tableData];
        }
        log(`Date ${!currentActual ? 'confirmed as actual' : 'reverted to pending'}`, 'success');
      }
    } catch (error) {
      log('Failed to update date status', 'error');
    }
  }

  // Toggle actual confirmation for a stage date field
  async function toggleStageDateActual(stageId: number, dateField: 'registrationDate' | 'settlementDate', currentActual: boolean) {
    const actualField = `${dateField}Actual`;

    try {
      const res = await fetch('/api/stages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stageId, [actualField]: !currentActual })
      });
      if (res.ok) {
        log(`Stage date ${!currentActual ? 'confirmed as actual' : 'reverted to pending'}`, 'success');
      }
    } catch (error) {
      log('Failed to update stage date status', 'error');
    }
  }

  // Start editing dates tab
  function startDatesTabEdit() {
    datesTabEditMode = true;
    datesTabEdits = new Map();
    tableData.forEach(row => {
      const customData = row.customData ? (typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData) : {};
      datesTabEdits.set(row.id, {
        on_market_date: customData.on_market_date || '',
        sold_date: customData.sold_date || '',
        exchange_date: customData.exchange_date || '',
        settled_date: customData.settled_date || '',
        cancelled_date: customData.cancelled_date || ''
      });
    });
    datesTabEdits = datesTabEdits;
    log('Editing Key Dates - Save when ready', 'info');
  }

  // Start editing pricing tab
  function startPricingTabEdit() {
    pricingTabEditMode = true;
    pricingTabEdits = new Map();
    tableData.forEach(row => {
      const customData = row.customData ? (typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData) : {};
      pricingTabEdits.set(row.id, {
        deposit_amount: customData.deposit_amount || '',
        deposit_date: customData.deposit_date || '',
        rebates: customData.rebates || '',
        discounts: customData.discounts || '',
        price_adjustments: customData.price_adjustments || ''
      });
    });
    pricingTabEdits = pricingTabEdits;
    log('Editing Pricing Details - Save when ready', 'info');
  }

  // Cancel tab edits
  function cancelDatesTabEdit() {
    datesTabEditMode = false;
    datesTabEdits = new Map();
    log('Dates editing cancelled', 'info');
  }

  function cancelPricingTabEdit() {
    pricingTabEditMode = false;
    pricingTabEdits = new Map();
    log('Pricing editing cancelled', 'info');
  }

  // Save dates tab edits
  async function saveDatesTabEdits() {
    let saved = 0;
    let failed = 0;

    for (const [lotId, edits] of datesTabEdits) {
      const lot = tableData.find(l => l.id === lotId);
      if (!lot) continue;

      try {
        let customData: Record<string, any> = {};
        if (lot.customData) {
          customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
        }

        // For each date field, check if the value changed and set the _manual flag
        const dateFields = ['on_market_date', 'sold_date', 'exchange_date', 'settled_date', 'cancelled_date'];
        for (const field of dateFields) {
          const oldValue = customData[field] || '';
          const newValue = edits[field] || '';
          if (newValue && newValue !== oldValue) {
            // User manually set/changed this date - mark as manual
            customData[`${field}_manual`] = true;
          } else if (!newValue && oldValue) {
            // User cleared this date - remove manual flag
            delete customData[`${field}_manual`];
          }
        }

        Object.assign(customData, edits);

        const res = await fetch('/api/lots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: lotId, customData: JSON.stringify(customData) })
        });

        if (res.ok) {
          lot.customData = JSON.stringify(customData);
          saved++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    tableData = [...tableData];
    datesTabEditMode = false;
    datesTabEdits = new Map();

    if (failed === 0) {
      log(`Saved dates for ${saved} lots`, 'success');
    } else {
      log(`Saved ${saved} lots, ${failed} failed`, 'warning');
    }
  }

  // Save pricing tab edits
  async function savePricingTabEdits() {
    let saved = 0;
    let failed = 0;

    for (const [lotId, edits] of pricingTabEdits) {
      const lot = tableData.find(l => l.id === lotId);
      if (!lot) continue;

      try {
        let customData: Record<string, any> = {};
        if (lot.customData) {
          customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
        }

        Object.assign(customData, edits);

        const res = await fetch('/api/lots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: lotId, customData: JSON.stringify(customData) })
        });

        if (res.ok) {
          lot.customData = JSON.stringify(customData);
          saved++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    tableData = [...tableData];
    pricingTabEditMode = false;
    pricingTabEdits = new Map();

    if (failed === 0) {
      log(`Saved pricing details for ${saved} lots`, 'success');
    } else {
      log(`Saved ${saved} lots, ${failed} failed`, 'warning');
    }
  }

  // Start inline price editing mode
  function startInlinePriceEdit() {
    if (!selectedNode || selectedNode.type !== 'stage') return;

    inlinePriceEdits = new Map();

    // Initialize with current prices from database
    for (const lot of tableData) {
      const currentPrice = parseFloat(lot.price) || 0;
      // Always start with the current saved price
      inlinePriceEdits.set(lot.id, currentPrice);
    }

    inlinePriceEdits = inlinePriceEdits;
    inlinePriceEditMode = true;
    log('Editing prices for all lots - Save All when ready', 'info');
  }

  // Update inline price for a lot
  function updateInlinePrice(lotId: number, price: number) {
    inlinePriceEdits.set(lotId, price);
    inlinePriceEdits = inlinePriceEdits;
  }

  // Use indicative price for a lot
  function useIndicativePriceInline(lotId: number) {
    const lot = tableData.find(l => l.id === lotId);
    if (!lot) return;
    const indicative = calculateLotPrice(lot);
    if (indicative) {
      inlinePriceEdits.set(lotId, indicative.totalPrice);
      inlinePriceEdits = inlinePriceEdits;
      // Log price calculation breakdown for user review
      log(`Lot ${lot.lotNumber || lot.id}: Base ${indicative.matchedProduct} = $${indicative.basePrice.toLocaleString()} + Balance $${indicative.balancePrice.toLocaleString()} = $${indicative.totalPrice.toLocaleString()} ($${indicative.pricePerSqm}/m²)`, 'info');
    }
  }

  // Apply all suggested prices at once
  function applyAllSuggestedPrices() {
    let appliedCount = 0;
    for (const lot of tableData) {
      const indicative = calculateLotPrice(lot);
      if (indicative) {
        inlinePriceEdits.set(lot.id, indicative.totalPrice);
        appliedCount++;
      }
    }
    inlinePriceEdits = inlinePriceEdits;
    log(`Applied suggested pricing to ${appliedCount} lots`, 'success');
  }

  // Cancel inline price editing
  function cancelInlinePriceEdit() {
    inlinePriceEditMode = false;
    inlinePriceEdits = new Map();
    log('Price editing cancelled', 'info');
  }

  // Save all inline price edits
  async function saveAllInlinePrices() {
    if (!selectedNode || selectedNode.type !== 'stage') return;

    const updates: { lotId: number; price: number; pricePerSqm: number }[] = [];

    inlinePriceEdits.forEach((price, lotId) => {
      const lot = tableData.find(l => l.id === lotId);
      if (!lot) return;
      const originalPrice = parseFloat(lot.price) || 0;
      if (price !== originalPrice && price > 0) {
        const area = parseFloat(lot.area) || (parseFloat(lot.frontage) * parseFloat(lot.depth)) || 1;
        updates.push({ lotId, price, pricePerSqm: Math.round(price / area) });
      }
    });

    if (updates.length === 0) {
      log('No price changes to save', 'warning');
      return;
    }

    savingAllPrices = true;
    let saved = 0;
    let failed = 0;

    for (const update of updates) {
      try {
        const res = await fetch(`/api/lots/${update.lotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: update.price, pricePerSqm: update.pricePerSqm })
        });
        if (res.ok) {
          saved++;
          const lot = tableData.find(l => l.id === update.lotId);
          if (lot) {
            lot.price = update.price;
            lot.pricePerSqm = update.pricePerSqm;
          }
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    tableData = [...tableData];
    savingAllPrices = false;
    inlinePriceEditMode = false;
    inlinePriceEdits = new Map();

    if (failed === 0) {
      log(`Saved pricing for ${saved} lots`, 'success');
    } else {
      log(`Saved ${saved} lots, ${failed} failed`, 'warning');
    }
  }

  // Bulk update custom fields for selected rows
  async function applyBulkCustomFieldEdit() {
    if (!bulkEditField || !bulkEditValue || selectedRows.size === 0) return;

    let updated = 0;
    let failed = 0;

    for (const rowId of selectedRows) {
      const lot = tableData.find(l => l.id === rowId);
      if (!lot) continue;

      try {
        let customData: Record<string, any> = {};
        if (lot.customData) {
          customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
        }

        customData[bulkEditField] = bulkEditValue;

        const res = await fetch('/api/lots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rowId, customData: JSON.stringify(customData) })
        });

        if (res.ok) {
          lot.customData = JSON.stringify(customData);
          updated++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    tableData = [...tableData];

    if (failed === 0) {
      log(`Updated ${bulkEditField} for ${updated} lots`, 'success');
    } else {
      log(`Updated ${updated} lots, ${failed} failed`, 'warning');
    }

    clearSelection();
    bulkEditField = '';
    bulkEditValue = '';
  }

  // Count pending inline price changes
  $: inlinePriceChangeCount = (() => {
    let count = 0;
    inlinePriceEdits.forEach((price, lotId) => {
      const lot = tableData.find(l => l.id === lotId);
      if (lot) {
        const originalPrice = parseFloat(lot.price) || 0;
        if (price !== originalPrice && price > 0) count++;
      }
    });
    return count;
  })();
</script>

<!-- STAGE TABLE - Separate Section -->
<div class="stage-table-section">
  <div class="panel-header collapsible" on:click={() => showStageTable = !showStageTable} on:keydown={(e) => e.key === 'Enter' && (showStageTable = !showStageTable)} role="button" tabindex="0">
    <span>├─ {showStageTable ? '▼' : '▶'} {selectedNode ? `${typeLabels[selectedNode.type]} ${selectedNode.name}` : 'Select item'} → Children {tableData.length > 0 ? `(${tableData.length})` : ''}</span>
    <div class="panel-header-actions" on:click|stopPropagation on:keydown|stopPropagation>
      {#if selectedNode?.type === 'stage' && tableData.length > 0}
        {#if stageTableTab === 'main'}
          {#if inlinePriceEditMode}
            <span class="edit-mode-badge">Editing Prices</span>
          {:else}
            <button class="btn-edit-all-prices" on:click={startInlinePriceEdit}>
              💰 Edit Prices
            </button>
          {/if}
        {:else if stageTableTab === 'dates'}
          {#if datesTabEditMode}
            <span class="edit-mode-badge">Editing Dates</span>
            <button class="btn-cancel-tab" on:click={cancelDatesTabEdit}>Cancel</button>
            <button class="btn-save-tab" on:click={saveDatesTabEdits}>✓ Save All</button>
          {:else}
            <button class="btn-tab-action" on:click={startDatesTabEdit}>
              ✏️ Edit Dates
            </button>
          {/if}
        {:else if stageTableTab === 'pricing'}
          {#if pricingTabEditMode}
            <span class="edit-mode-badge">Editing Pricing</span>
            <button class="btn-cancel-tab" on:click={cancelPricingTabEdit}>Cancel</button>
            <button class="btn-save-tab" on:click={savePricingTabEdits}>✓ Save All</button>
          {:else}
            <button class="btn-tab-action" on:click={startPricingTabEdit}>
              ✏️ Edit Pricing
            </button>
          {/if}
        {/if}
      {/if}
      {#if selectedNode && typeConfig[selectedNode.type].childEndpoint && stageTableTab === 'main' && userCanEdit}
        <button class="add-btn" on:click={startAdd} disabled={isAdding}>+ Add</button>
      {/if}
    </div>
  </div>
</div>

{#if showStageTable}
{#if selectedNode?.type === 'stage' && tableData.length > 0}
  <div class="stage-table-tabs">
    <button
      class="stage-tab"
      class:active={stageTableTab === 'main'}
      on:click={() => stageTableTab = 'main'}
    >
      📋 Main
    </button>
    <button
      class="stage-tab"
      class:active={stageTableTab === 'dates'}
      on:click={() => stageTableTab = 'dates'}
    >
      📅 Key Dates
    </button>
    <button
      class="stage-tab"
      class:active={stageTableTab === 'pricing'}
      on:click={() => stageTableTab = 'pricing'}
    >
      💵 Pricing Details
    </button>
  </div>
{/if}

{#if inlinePriceEditMode}
  <div class="inline-price-edit-bar">
    <span class="edit-info">💰 Editing prices for {tableData.length} lots</span>
    <button
      class="btn-apply-all-suggested"
      on:click={applyAllSuggestedPrices}
      disabled={pricingProducts.filter(p => p.basePrice > 0).length === 0}
      title="Apply suggested pricing from matrix to all lots"
    >
      📊 Use All Suggested
    </button>
    <span class="change-count">{inlinePriceChangeCount} changes pending</span>
    <div class="edit-actions">
      <button class="btn-cancel-edit" on:click={cancelInlinePriceEdit}>Cancel</button>
      <button
        class="btn-save-all-prices"
        on:click={saveAllInlinePrices}
        disabled={inlinePriceChangeCount === 0 || savingAllPrices}
      >
        {#if savingAllPrices}
          Saving...
        {:else}
          ✓ Save All ({inlinePriceChangeCount})
        {/if}
      </button>
    </div>
  </div>
{/if}

{#if selectedRows.size > 0}
  <div class="bulk-edit-bar">
    <span class="bulk-selected">{selectedRows.size} selected</span>
    <select bind:value={bulkEditField} class="bulk-field-select">
      <option value="">Select field...</option>
      {#if selectedNode?.type === 'stage' && stageTableTab === 'main'}
        <option value="streetName">Street Name</option>
        <option value="area">Area</option>
        <option value="frontage">Frontage</option>
        <option value="depth">Depth</option>
        <option value="status">Status</option>
      {:else if selectedNode?.type === 'stage' && stageTableTab === 'dates'}
        <option value="on_market_date">On Market Date</option>
        <option value="sold_date">Sold Date</option>
        <option value="exchange_date">Exchange Date</option>
        <option value="settled_date">Settled Date</option>
        <option value="cancelled_date">Cancelled Date</option>
      {:else if selectedNode?.type === 'stage' && stageTableTab === 'pricing'}
        <option value="deposit_amount">Deposit Amount</option>
        <option value="deposit_date">Deposit Date</option>
        <option value="rebates">Rebates</option>
        <option value="discounts">Discounts</option>
        <option value="price_adjustments">Price Adjustments</option>
      {:else}
        <option value="name">Name</option>
        <option value="description">Description</option>
      {/if}
    </select>
    {#if stageTableTab === 'dates' || (stageTableTab === 'pricing' && bulkEditField === 'deposit_date')}
      <input type="date" bind:value={bulkEditValue} class="bulk-value-input" />
    {:else}
      <input type="text" bind:value={bulkEditValue} placeholder="New value..." class="bulk-value-input" />
    {/if}
    <button class="btn-bulk-apply" on:click={() => stageTableTab === 'main' ? applyBulkEdit() : applyBulkCustomFieldEdit()} disabled={!bulkEditField || !bulkEditValue}>
      Apply to {selectedRows.size}
    </button>
    <button class="btn-bulk-clear" on:click={clearSelection}>Clear</button>
  </div>
{/if}

<div class="table-content">
  {#if loading}
    <div class="loading-msg">Loading...</div>
  {:else if !selectedNode}
    <div class="empty-msg">← Select an item from the tree</div>
  {:else if tableData.length === 0 && !isAdding}
    <div class="empty-msg">No children found. Click + Add to create one.</div>
  {:else if selectedNode?.type === 'stage' && stageTableTab === 'dates'}
    <!-- Key Dates Tab -->
    <div class="table-scroll-wrapper">
      <table class="data-table dates-table">
        <thead>
          <tr>
            <th class="th-checkbox">
              <input type="checkbox" checked={selectedRows.size === tableData.length && tableData.length > 0} on:change={toggleAllRows} title="Select all" />
            </th>
            <th class="th-id">ID</th>
            <th class="th-field">Lot #</th>
            <th class="th-field">Status</th>
            <th class="th-field th-date">On Market</th>
            <th class="th-field th-date">Sold Date</th>
            <th class="th-field th-date">Exchange Date</th>
            <th class="th-field th-date">Settled Date</th>
            <th class="th-field th-date">Cancelled Date</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedTableData as row}
            {@const customData = row.customData ? (typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData) : {}}
            {@const rowEdits = datesTabEdits.get(row.id) || {}}
            <tr class:selected={selectedRows.has(row.id)}>
              <td class="checkbox-col">
                <input type="checkbox" checked={selectedRows.has(row.id)} on:change={() => toggleRowSelection(row.id)} />
              </td>
              <td class="id-col">{row.id}</td>
              <td class="field-col">{row.lotNumber || '-'}</td>
              <td class="field-col status-col">
                <span class="status-badge status-{(row.status || '').toLowerCase().replace(/\s+/g, '-')}">{row.status || '-'}</span>
              </td>
              <td class="field-col date-col">
                {#if datesTabEditMode}
                  <input type="date" value={rowEdits.on_market_date || ''} on:input={(e) => { rowEdits.on_market_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                {:else}
                  {@const status = getDateStatus(customData.on_market_date, customData.on_market_date_actual)}
                  <div class="date-with-status">
                    <span class="date-display">{customData.on_market_date || '-'}</span>
                    {#if status !== 'none'}
                      <button
                        class="date-status-badge"
                        style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                        title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                        on:click={() => toggleLotDateActual(row.id, 'on_market_date', customData)}
                      >{dateStatusStyles[status].label}</button>
                    {/if}
                  </div>
                {/if}
              </td>
              <td class="field-col date-col">
                {#if datesTabEditMode}
                  <input type="date" value={rowEdits.sold_date || ''} on:input={(e) => { rowEdits.sold_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                {:else}
                  {@const status = getDateStatus(customData.sold_date, customData.sold_date_actual)}
                  <div class="date-with-status">
                    <span class="date-display">{customData.sold_date || '-'}</span>
                    {#if status !== 'none'}
                      <button
                        class="date-status-badge"
                        style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                        title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                        on:click={() => toggleLotDateActual(row.id, 'sold_date', customData)}
                      >{dateStatusStyles[status].label}</button>
                    {/if}
                  </div>
                {/if}
              </td>
              <td class="field-col date-col">
                {#if datesTabEditMode}
                  <input type="date" value={rowEdits.exchange_date || ''} on:input={(e) => { rowEdits.exchange_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                {:else}
                  {@const status = getDateStatus(customData.exchange_date, customData.exchange_date_actual)}
                  <div class="date-with-status">
                    <span class="date-display">{customData.exchange_date || '-'}</span>
                    {#if status !== 'none'}
                      <button
                        class="date-status-badge"
                        style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                        title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                        on:click={() => toggleLotDateActual(row.id, 'exchange_date', customData)}
                      >{dateStatusStyles[status].label}</button>
                    {/if}
                  </div>
                {/if}
              </td>
              <td class="field-col date-col">
                {#if datesTabEditMode}
                  <input type="date" value={rowEdits.settled_date || ''} on:input={(e) => { rowEdits.settled_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                {:else}
                  {@const status = getDateStatus(customData.settled_date, customData.settled_date_actual)}
                  <div class="date-with-status">
                    <span class="date-display">{customData.settled_date || '-'}</span>
                    {#if status !== 'none'}
                      <button
                        class="date-status-badge"
                        style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                        title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                        on:click={() => toggleLotDateActual(row.id, 'settled_date', customData)}
                      >{dateStatusStyles[status].label}</button>
                    {/if}
                  </div>
                {/if}
              </td>
              <td class="field-col date-col">
                {#if datesTabEditMode}
                  <input type="date" value={rowEdits.cancelled_date || ''} on:input={(e) => { rowEdits.cancelled_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                {:else}
                  {@const status = getDateStatus(customData.cancelled_date, customData.cancelled_date_actual)}
                  <div class="date-with-status">
                    <span class="date-display">{customData.cancelled_date || '-'}</span>
                    {#if status !== 'none'}
                      <button
                        class="date-status-badge"
                        style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                        title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                        on:click={() => toggleLotDateActual(row.id, 'cancelled_date', customData)}
                      >{dateStatusStyles[status].label}</button>
                    {/if}
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if selectedNode?.type === 'stage' && stageTableTab === 'pricing'}
    <!-- Pricing Details Tab -->
    <div class="table-scroll-wrapper">
      <table class="data-table pricing-details-table">
        <thead>
          <tr>
            <th class="th-checkbox">
              <input type="checkbox" checked={selectedRows.size === tableData.length && tableData.length > 0} on:change={toggleAllRows} title="Select all" />
            </th>
            <th class="th-id">ID</th>
            <th class="th-field">Lot #</th>
            <th class="th-field th-num">Price</th>
            <th class="th-field th-num">Deposit Amt</th>
            <th class="th-field th-date">Deposit Date</th>
            <th class="th-field th-num">Rebates</th>
            <th class="th-field th-num">Discounts</th>
            <th class="th-field">Price Adjustments</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedTableData as row}
            {@const customData = row.customData ? (typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData) : {}}
            {@const rowEdits = pricingTabEdits.get(row.id) || {}}
            <tr class:selected={selectedRows.has(row.id)}>
              <td class="checkbox-col">
                <input type="checkbox" checked={selectedRows.has(row.id)} on:change={() => toggleRowSelection(row.id)} />
              </td>
              <td class="id-col">{row.id}</td>
              <td class="field-col">{row.lotNumber || '-'}</td>
              <td class="field-col num-col">{row.price ? `$${parseFloat(row.price).toLocaleString()}` : '-'}</td>
              <td class="field-col num-col">
                {#if pricingTabEditMode}
                  <input type="text" value={rowEdits.deposit_amount || ''} on:input={(e) => { rowEdits.deposit_amount = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="number-input-cell" placeholder="$0" />
                {:else}
                  <span class="value-display">{customData.deposit_amount || '-'}</span>
                {/if}
              </td>
              <td class="field-col date-col">
                {#if pricingTabEditMode}
                  <input type="date" value={rowEdits.deposit_date || ''} on:input={(e) => { rowEdits.deposit_date = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="date-input-cell" />
                {:else}
                  <span class="date-display">{customData.deposit_date || '-'}</span>
                {/if}
              </td>
              <td class="field-col num-col">
                {#if pricingTabEditMode}
                  <input type="text" value={rowEdits.rebates || ''} on:input={(e) => { rowEdits.rebates = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="number-input-cell" placeholder="$0" />
                {:else}
                  <span class="value-display">{customData.rebates || '-'}</span>
                {/if}
              </td>
              <td class="field-col num-col">
                {#if pricingTabEditMode}
                  <input type="text" value={rowEdits.discounts || ''} on:input={(e) => { rowEdits.discounts = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="number-input-cell" placeholder="$0" />
                {:else}
                  <span class="value-display">{customData.discounts || '-'}</span>
                {/if}
              </td>
              <td class="field-col">
                {#if pricingTabEditMode}
                  <input type="text" value={rowEdits.price_adjustments || ''} on:input={(e) => { rowEdits.price_adjustments = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="text-input-cell" placeholder="Notes..." />
                {:else}
                  <span class="value-display">{customData.price_adjustments || '-'}</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="table-scroll-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class="th-checkbox th-sticky-left">
              <input type="checkbox" checked={selectedRows.size === tableData.length && tableData.length > 0} on:change={toggleAllRows} title="Select all" />
            </th>
            <th class="th-id sortable" style="width: {getColumnWidth('id')}" on:click={() => toggleSort('id')}>
              <span class="th-content">ID {sortColumn === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <div class="resize-handle" on:mousedown={(e) => startColumnResize(e, 'id')} role="separator" tabindex="0" aria-orientation="vertical"></div>
            </th>
            {#each orderedFields as field}
              <th
                class="th-field sortable"
                class:th-num={field.type === 'number'}
                class:th-status={field.type === 'status'}
                class:th-date={field.type === 'date'}
                style="width: {getColumnWidth(field.key)}"
                on:click={() => toggleSort(field.key)}
              >
                <span class="th-content">{field.label} {sortColumn === field.key ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <div class="resize-handle" on:mousedown={(e) => startColumnResize(e, field.key)} role="separator" tabindex="0" aria-orientation="vertical"></div>
              </th>
            {/each}
            <th class="th-actions th-sticky-right">
              Actions
              <button class="btn-fields-mgr" on:click={() => showFieldsManager = true} title="Manage Fields">⚙</button>
            </th>
          </tr>
        </thead>
      <tbody>
        {#if isAdding}
          <tr class="adding-row">
            <td class="checkbox-col td-sticky-left"></td>
            <td class="id-col">--</td>
            {#each orderedFields as field}
              <td class="field-col" class:num-col={field.type === 'number'} class:status-col={field.type === 'status'} class:date-col={field.type === 'date'}>
                {#if field.type === 'status'}
                  <select bind:value={newRowValues[field.key]} class="status-select">
                    <option value="">Select...</option>
                    {#each statusOptions as opt}
                      <option value={opt.value}>{opt.label}</option>
                    {/each}
                  </select>
                {:else if field.type === 'date'}
                  <input type="date" bind:value={newRowValues[field.key]} class="date-input" />
                {:else if field.type === 'number'}
                  <div class="number-input-wrapper">
                    <input type="text" bind:value={newRowValues[field.key]} placeholder={field.label} />
                    {#if field.format === '$'}
                      <div class="number-presets">
                        {#each numberPresets as preset}
                          <button type="button" class="preset-btn" on:click={() => newRowValues[field.key] = preset.value.toString()}>{preset.label}</button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <input type="text" bind:value={newRowValues[field.key]} placeholder={field.label} />
                {/if}
              </td>
            {/each}
            <td class="actions-col td-sticky-right">
              <button class="btn-save" on:click={saveAdd} disabled={savingAdd}>
                {savingAdd ? 'Saving...' : 'Save'}
              </button>
              <button class="btn-cancel" on:click={cancelAdd} disabled={savingAdd}>Cancel</button>
            </td>
          </tr>
        {/if}
        {#each sortedTableData as row}
          <tr class:editing={editingId === row.id} class:row-selected={selectedRows.has(row.id)}>
            <td class="checkbox-col td-sticky-left">
              <input type="checkbox" checked={selectedRows.has(row.id)} on:change={() => toggleRowSelection(row.id)} />
            </td>
            <td class="id-col">{row.id}</td>
            {#if editingId === row.id}
              {#each orderedFields as field}
                <td class="field-col" class:num-col={field.type === 'number'} class:status-col={field.type === 'status'} class:date-col={field.type === 'date'}>
                  {#if field.type === 'status'}
                    <select bind:value={editValues[field.key]} class="status-select">
                      <option value="">Select...</option>
                      {#each statusOptions as opt}
                        <option value={opt.value}>{opt.label}</option>
                      {/each}
                    </select>
                  {:else if field.type === 'date'}
                    <input type="date" bind:value={editValues[field.key]} class="date-input" />
                  {:else if field.key === 'price'}
                    {@const lotFrontage = parseFloat(editValues.frontage) || parseFloat(row.frontage) || 0}
                    {@const lotDepth = parseFloat(editValues.depth) || parseFloat(row.depth) || 0}
                    {@const lotArea = parseFloat(editValues.area) || parseFloat(row.area) || lotFrontage * lotDepth}
                    {@const editIndicative = lotFrontage > 0 && lotDepth > 0 ? calculateLotPrice({ frontage: lotFrontage, depth: lotDepth, area: lotArea }) : null}
                    {@const pricedCount = pricingProducts.filter(p => p.basePrice > 0).length}
                    <div class="price-input-wrapper">
                      <input type="text" bind:value={editValues[field.key]} placeholder="Enter price" />
                      {#if editIndicative && pricedCount > 0}
                        <div class="indicative-suggestion">
                          <button type="button" class="btn-use-indicative" on:click={() => { editValues[field.key] = editIndicative.totalPrice.toString(); log(`Lot ${row.lotNumber || row.id}: Base ${editIndicative.matchedProduct} = $${editIndicative.basePrice.toLocaleString()} + Balance $${editIndicative.balancePrice.toLocaleString()} = $${editIndicative.totalPrice.toLocaleString()} ($${editIndicative.pricePerSqm}/m²)`, 'info'); }}>
                            Use ${editIndicative.totalPrice.toLocaleString()}
                          </button>
                          <span class="base-used">Base: {editIndicative.matchedProduct}</span>
                        </div>
                      {:else if pricedCount === 0}
                        <span class="no-pricing-hint">Set up Pricing Matrix first</span>
                      {/if}
                    </div>
                  {:else if field.type === 'number'}
                    <div class="number-input-wrapper">
                      <input type="text" bind:value={editValues[field.key]} />
                    </div>
                  {:else}
                    <input type="text" bind:value={editValues[field.key]} />
                  {/if}
                </td>
              {/each}
              <td class="actions-col td-sticky-right">
                <button class="btn-save" on:click={() => saveEdit(row)} disabled={savingRow}>
                  {savingRow ? 'Saving...' : 'Save'}
                </button>
                <button class="btn-cancel" on:click={cancelEdit} disabled={savingRow}>Cancel</button>
              </td>
            {:else}
              {#each orderedFields as field}
                <td class="field-col" class:num-col={field.type === 'number'} class:status-col={field.type === 'status'} class:date-col={field.type === 'date'} class:price-col={field.key === 'price'} class:inline-price-edit={field.key === 'price' && inlinePriceEditMode}>
                  {#if field.key === 'price' && inlinePriceEditMode}
                    {@const indicativePrice = calculateLotPrice(row)}
                    {@const originalPrice = parseFloat(row.price) || 0}
                    {@const currentEditPrice = inlinePriceEdits.has(row.id) ? (inlinePriceEdits.get(row.id) ?? 0) : originalPrice}
                    {@const hasChanged = currentEditPrice !== originalPrice && currentEditPrice > 0}
                    <div class="inline-price-edit-cell" class:has-change={hasChanged}>
                      <input
                        type="text"
                        class="inline-price-input"
                        value={(currentEditPrice ?? 0) > 0 ? (currentEditPrice ?? 0).toLocaleString() : ''}
                        placeholder={originalPrice > 0 ? `Current: $${originalPrice.toLocaleString()}` : 'Enter price'}
                        on:input={(e) => updateInlinePrice(row.id, parseFloat(e.currentTarget.value.replace(/,/g, '')) || 0)}
                      />
                      {#if indicativePrice}
                        <button
                          type="button"
                          class="btn-use-indicative-inline"
                          on:click={() => useIndicativePriceInline(row.id)}
                          title="Base: {indicativePrice.matchedProduct}"
                        >
                          Use ${indicativePrice.totalPrice.toLocaleString()}
                        </button>
                      {/if}
                    </div>
                  {:else if field.key === 'price' && pricingProducts.some(p => p.basePrice > 0)}
                    {@const indicativePrice = calculateLotPrice(row)}
                    {#if row.price && row.price > 0}
                      <span class="price-set">${row.price.toLocaleString()}</span>
                    {:else if indicativePrice}
                      <div class="indicative-price-cell">
                        <span class="indicative-value" title="{indicativePrice.matchedProduct}: Base ${indicativePrice.basePrice.toLocaleString()} + Balance ${indicativePrice.balancePrice.toLocaleString()}">
                          ${indicativePrice.totalPrice.toLocaleString()}
                        </span>
                        <button class="btn-accept-price" on:click={() => acceptIndicativePrice(row, indicativePrice.totalPrice, indicativePrice.pricePerSqm)} title="Accept this price">✓</button>
                      </div>
                    {:else}
                      <span class="no-price">-</span>
                    {/if}
                  {:else if field.type === 'status'}
                    {@const status = getStatusOption(row[field.key] || row.status || '')}
                    {#if row[field.key] || row.status}
                      <span class="status-pill" style="color: {status.color}; background: {status.bg};">
                        {status.label}
                      </span>
                    {:else}
                      <span class="no-status">-</span>
                    {/if}
                  {:else if field.type === 'date'}
                    {#if row[field.key] || (field.isCustom && getCustomFieldValue(row, field.key))}
                      {new Date(row[field.key] || getCustomFieldValue(row, field.key)).toLocaleDateString('en-AU')}
                    {:else}
                      -
                    {/if}
                  {:else if field.type === 'number'}
                    {formatNumber(field.isCustom ? getCustomFieldValue(row, field.key) : (row[field.key] ?? row[field.key === 'lotNumber' ? 'lotNumber' : field.key]), field.format || '')}
                  {:else}
                    {field.isCustom ? (getCustomFieldValue(row, field.key) || '-') : (row[field.key] || row[field.key === 'lotNumber' ? 'lotNumber' : field.key] || row.name || '-')}
                  {/if}
                </td>
              {/each}
              <td class="actions-col td-sticky-right">
                {#if userCanEdit}
                  <button class="btn-edit" on:click={() => startEdit(row)}>Edit</button>
                {/if}
                {#if userCanDelete}
                  <button class="btn-delete" on:click={() => deleteRow(row)} disabled={deletingRow === row.id}>
                    {deletingRow === row.id ? '...' : 'Del'}
                  </button>
                {/if}
                {#if !userCanEdit && !userCanDelete}
                  <span class="view-only-badge">View Only</span>
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  {/if}
</div>
{/if}

<style>
  /* ========================================
     STAGE TABLE LAYOUT
     ======================================== */
  .stage-table-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .stage-table-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    padding: 0 8px;
  }

  .stage-tab {
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .stage-tab:hover {
    color: var(--text-primary);
  }

  .stage-tab.active {
    color: var(--accent-primary);
    border-bottom-color: var(--accent-primary);
  }

  /* ========================================
     PANEL HEADER
     ======================================== */
  .panel-header {
    padding: 8px 12px;
    color: #bb9af7;
    border-bottom: 1px solid #3b4261;
    background: var(--input-bg);
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-header.collapsible {
    cursor: pointer;
    user-select: none;
  }

  .panel-header.collapsible:hover {
    background: var(--table-row-alt);
  }

  .panel-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .add-btn {
    background: var(--bg-primary);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 4px 12px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
  }

  .add-btn:hover:not(:disabled) {
    background: #9ece6a;
    color: #1a1b26;
  }

  .add-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* ========================================
     INLINE PRICE EDITING BAR
     ======================================== */
  .inline-price-edit-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(158, 206, 106, 0.1);
    border: 1px solid #9ece6a;
    border-radius: 4px;
    margin: 4px 8px;
  }

  .edit-info {
    color: #9ece6a;
    font-size: 11px;
  }

  .change-count {
    color: var(--text-muted);
    font-size: 11px;
  }

  .edit-actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  .btn-apply-all-suggested, .btn-save-all-prices, .btn-cancel-edit {
    padding: 4px 10px;
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border: 1px solid;
  }

  .btn-apply-all-suggested {
    background: transparent;
    border-color: #7aa2f7;
    color: #7aa2f7;
  }

  .btn-save-all-prices {
    background: #9ece6a;
    border-color: #9ece6a;
    color: #1a1b26;
  }

  .btn-cancel-edit {
    background: transparent;
    border-color: var(--border-color);
    color: var(--text-muted);
  }

  .edit-mode-badge {
    color: #e0af68;
    font-size: 10px;
    font-style: italic;
  }

  .btn-edit-all-prices, .btn-tab-action {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 3px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 3px;
  }

  .btn-save-tab {
    background: #9ece6a;
    border: none;
    color: #1a1b26;
    padding: 3px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 3px;
  }

  .btn-cancel-tab {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    padding: 3px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 3px;
  }

  /* ========================================
     TABLE CONTENT
     ======================================== */
  .table-content {
    padding: 8px;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .table-scroll-wrapper {
    flex: 1;
    overflow: auto;
    position: relative;
    min-height: 0;
    max-height: calc(100vh - 300px);
  }

  .loading-msg, .empty-msg {
    color: var(--text-muted);
    padding: 20px;
    text-align: center;
  }

  table.data-table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  /* ========================================
     TABLE HEADERS
     ======================================== */
  th {
    text-align: left;
    padding: 8px 12px;
    color: #7aa2f7;
    border-bottom: 1px solid #3b4261;
    font-weight: normal;
    font-size: 11px;
    text-transform: uppercase;
    white-space: nowrap;
    position: sticky;
    top: 0;
    background: var(--bg-primary);
    z-index: 2;
  }

  thead tr {
    background: var(--bg-primary);
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 3;
    background: var(--bg-primary);
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
  }

  th.sortable:hover {
    color: #bb9af7;
    background: var(--table-row-alt);
  }

  .th-content {
    display: inline-block;
    padding-right: 8px;
  }

  .resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    cursor: col-resize;
    background: transparent;
    z-index: 1;
  }

  .resize-handle:hover {
    background: #7aa2f7;
  }

  /* Sticky columns */
  .th-sticky-left, .td-sticky-left {
    position: sticky;
    left: 0;
    z-index: 2;
    background: var(--bg-primary);
  }

  .th-sticky-right, .td-sticky-right {
    position: sticky;
    right: 0;
    z-index: 2;
    background: var(--bg-primary);
    box-shadow: -2px 0 4px rgba(0,0,0,0.3);
  }

  /* ========================================
     TABLE CELLS
     ======================================== */
  td {
    padding: 6px 12px;
    border-bottom: 1px solid #24283b;
    white-space: nowrap;
    background: var(--bg-primary);
  }

  tr:hover td {
    background: var(--table-row-alt);
  }

  .th-id { width: 50px; }
  .th-name { width: 100px; }
  .th-num { width: 70px; text-align: right; min-width: 80px; }
  .th-street { width: 120px; }
  .th-detail { flex: 1; }
  .th-actions { width: 100px; }

  .id-col { color: var(--text-muted); width: 50px; }
  .name-col { color: #9ece6a; }
  .num-col { color: #7dcfff; text-align: right; width: 70px; }
  .street-col { color: #bb9af7; width: 120px; }
  .detail-col { color: var(--text-secondary); }
  .actions-col { width: 100px; }

  tr.editing td, tr.adding-row td {
    background: var(--table-row-alt);
  }

  /* ========================================
     INPUTS
     ======================================== */
  input[type="text"] {
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 4px 8px;
    font-family: inherit;
    font-size: 12px;
    width: 100%;
    box-sizing: border-box;
    border-radius: 3px;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: #7aa2f7;
  }

  /* ========================================
     BUTTONS
     ======================================== */
  .btn-edit, .btn-delete, .btn-save, .btn-cancel {
    background: none;
    border: 1px solid;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
    margin-right: 4px;
  }

  .btn-edit {
    color: #7aa2f7;
    border-color: #7aa2f7;
  }

  .btn-edit:hover {
    background: #7aa2f7;
    color: #1a1b26;
  }

  .btn-delete {
    color: #f7768e;
    border-color: #f7768e;
  }

  .btn-delete:hover {
    background: #f7768e;
    color: #1a1b26;
  }

  .btn-save {
    color: #9ece6a;
    border-color: #9ece6a;
  }

  .btn-save:hover {
    background: #9ece6a;
    color: #1a1b26;
  }

  .btn-cancel {
    color: #e0af68;
    border-color: #e0af68;
  }

  .btn-cancel:hover {
    background: #e0af68;
    color: #1a1b26;
  }

  /* ========================================
     BULK EDIT BAR
     ======================================== */
  .bulk-edit-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(122, 162, 247, 0.1);
    border: 1px solid #7aa2f7;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .bulk-selected {
    color: #7aa2f7;
    font-weight: bold;
    font-size: 11px;
  }

  .bulk-field-select, .bulk-value-input {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 4px 8px;
    font-family: inherit;
    font-size: 11px;
    border-radius: 3px;
  }

  .bulk-value-input {
    flex: 1;
    max-width: 200px;
  }

  .btn-bulk-apply {
    background: #7aa2f7;
    border: none;
    color: #1a1b26;
    padding: 4px 12px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
    font-weight: bold;
  }

  .btn-bulk-apply:hover:not(:disabled) {
    background: #9db5f8;
  }

  .btn-bulk-apply:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-bulk-clear {
    background: none;
    border: 1px solid #565f89;
    color: var(--text-muted);
    padding: 4px 8px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
  }

  .btn-bulk-clear:hover {
    border-color: var(--text-primary);
    color: var(--text-primary);
  }

  /* ========================================
     CHECKBOXES
     ======================================== */
  .th-checkbox, .checkbox-col {
    width: 30px;
    text-align: center;
  }

  /* Terminal-themed checkboxes */
  .th-checkbox input[type="checkbox"],
  .checkbox-col input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    vertical-align: middle;
  }

  .th-checkbox input[type="checkbox"]::before,
  .checkbox-col input[type="checkbox"]::before {
    content: '[ ]';
    font-family: monospace;
    font-size: 12px;
    color: var(--text-muted);
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .th-checkbox input[type="checkbox"]:checked::before,
  .checkbox-col input[type="checkbox"]:checked::before {
    content: '[×]';
    color: #7aa2f7;
  }

  .th-checkbox input[type="checkbox"]:hover::before,
  .checkbox-col input[type="checkbox"]:hover::before {
    color: #7dcfff;
  }

  .row-selected {
    background: rgba(122, 162, 247, 0.15) !important;
  }

  .row-selected:hover {
    background: rgba(122, 162, 247, 0.25) !important;
  }

  /* ========================================
     FIELDS MANAGER BUTTON
     ======================================== */
  .btn-fields-mgr {
    background: none;
    border: none;
    color: #7dcfff;
    cursor: pointer;
    font-size: 12px;
    margin-left: 6px;
    padding: 0 4px;
  }

  .btn-fields-mgr:hover {
    color: #bb9af7;
  }

  /* ========================================
     STATUS PILLS
     ======================================== */
  .status-pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }

  .status-select {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    width: 100%;
    cursor: pointer;
  }

  .status-select:focus {
    outline: none;
    border-color: #7aa2f7;
  }

  .no-status {
    color: var(--text-muted);
  }

  .th-status {
    min-width: 100px;
  }

  .status-col {
    min-width: 100px;
  }

  /* ========================================
     DATE PICKER
     ======================================== */
  .date-input {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: inherit;
    width: 100%;
  }

  .date-input:focus {
    outline: none;
    border-color: #7aa2f7;
  }

  .date-input::-webkit-calendar-picker-indicator {
    filter: invert(0.8);
    cursor: pointer;
  }

  .th-date {
    min-width: 100px;
  }

  .date-col {
    min-width: 100px;
  }

  .date-with-status {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .date-display {
    font-size: 11px;
  }

  .date-status-badge {
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: bold;
    cursor: pointer;
    border: 1px solid;
    background: none;
    font-family: inherit;
  }

  .date-input-cell {
    width: 100%;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 3px 6px;
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
  }

  /* ========================================
     NUMBER INPUT
     ======================================== */
  .number-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .number-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }

  .preset-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: #7dcfff;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9px;
    cursor: pointer;
    font-family: inherit;
  }

  .preset-btn:hover {
    background: #7dcfff;
    color: #1a1b26;
  }

  .number-input-cell, .text-input-cell {
    width: 100%;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 3px 6px;
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
  }

  .value-display {
    font-size: 11px;
  }

  /* ========================================
     DYNAMIC FIELD COLUMNS
     ======================================== */
  .th-field {
    min-width: 80px;
    cursor: pointer;
    user-select: none;
  }

  .th-field:hover {
    color: #bb9af7;
    background: var(--table-row-alt);
  }

  .field-col {
    min-width: 80px;
  }

  .field-col input {
    width: 100%;
    padding: 3px 6px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 12px;
    border-radius: 3px;
  }

  .field-col input:focus {
    outline: none;
    border-color: #7aa2f7;
  }

  /* ========================================
     INLINE PRICE EDITING
     ======================================== */
  .inline-price-edit-cell {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .inline-price-edit-cell.has-change {
    background: rgba(158, 206, 106, 0.1);
    border-radius: 3px;
    padding: 2px 4px;
  }

  .inline-price-input {
    width: 80px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 3px 6px;
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
  }

  .btn-use-indicative-inline {
    background: transparent;
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 1px 4px;
    font-size: 9px;
    cursor: pointer;
    border-radius: 2px;
    white-space: nowrap;
    font-family: inherit;
  }

  .price-set {
    color: #9ece6a;
    font-weight: 500;
  }

  .no-price {
    color: var(--text-muted);
  }

  .indicative-price-cell {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .indicative-value {
    color: #e0af68;
    font-style: italic;
    font-size: 11px;
  }

  .btn-accept-price {
    background: transparent;
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 0px 4px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 10px;
    font-family: inherit;
  }

  .price-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .indicative-suggestion {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-use-indicative {
    background: transparent;
    border: 1px solid #e0af68;
    color: #e0af68;
    padding: 2px 6px;
    font-size: 9px;
    cursor: pointer;
    border-radius: 2px;
    font-family: inherit;
  }

  .base-used {
    color: var(--text-muted);
    font-size: 9px;
  }

  .no-pricing-hint {
    color: var(--text-muted);
    font-size: 9px;
    font-style: italic;
  }

  .view-only-badge {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
  }

  .price-col {
    min-width: 100px;
  }

  .inline-price-edit {
    min-width: 180px;
  }

  /* ========================================
     DATES AND PRICING TABLES
     ======================================== */
  .dates-table th, .dates-table td,
  .pricing-details-table th, .pricing-details-table td {
    padding: 6px 10px;
  }
</style>
