<script lang="ts">
  // LandBudgetPanel Component - Stage (editable) and Precinct (read-only) land budget

  interface TreeNode {
    id: number;
    name: string;
    type: string;
    parentId?: number | null;
  }

  let {
    selectedNode,
    userCanEdit = false,
    onLog,
    onGenerateLots,
    existingLots = []
  }: {
    selectedNode: TreeNode | null;
    userCanEdit: boolean;
    onLog: (message: string, type?: 'success' | 'error' | 'loading' | 'info' | 'warning') => void;
    onGenerateLots?: (params: { stageId: number; rows: Array<{ name: string; areaHa: number; density: number; lotCount: number; avgSqm: number }>; deleteExisting?: boolean }) => Promise<void>;
    existingLots?: Array<{ id: number; status?: string }>;
  } = $props();

  const allMasterplan = $derived(
    existingLots.length === 0 || existingLots.every(l => l.status?.toLowerCase() === 'masterplan')
  );
  const hasExistingLots = $derived(existingLots.length > 0);
  
  // Local state - Stage level
  let showStageLandBudget = $state(false);
  let stageLandBudgetData: any[] = $state([]);
  let stageLandBudgetCategories: any = $state({});
  let stageLandBudgetLotAreaHa = $state(0);
  let stageLandBudgetEditMode = $state(false);
  let stageLandBudgetEditValues: Map<string, string> = $state(new Map());
  let stageLandBudgetNameEdits: Map<string, string> = $state(new Map());
  let loadingStageLandBudget = $state(false);
  let stageLbExpandedCategories: Set<string> = $state(new Set());
  let savingLandBudget = $state(false);
  let localRoadsPercent: number = $state(0);
  let lotGenDensityMap: Map<string, number> = $state(new Map());
  let generatingLots = $state(false);
  let showLotGenerator = $state(false);

  // Local state - Precinct level
  let showLandBudget = $state(false);
  let landBudgetCategories: any = $state({});
  let landBudgetStageData: Record<number, { name: string; items: any[] }> = $state({});
  let landBudgetStages: any[] = $state([]);
  let loadingLandBudget = $state(false);
  let lbExpandedCategories: Set<string> = $state(new Set());

  // Auto-load when selectedNode changes
  let lastNodeId: number | null = $state(null);
  $effect(() => {
    const nodeId = selectedNode?.id ?? null;
    const nodeType = selectedNode?.type;
    if (nodeId !== lastNodeId) {
      lastNodeId = nodeId;
      if (nodeType === 'stage') {
        loadStageLandBudget();
      } else if (nodeType === 'precinct') {
        loadLandBudget();
      }
    }
  });

  // ===== Toggle functions =====
  function toggleStageLandBudget() {
    showStageLandBudget = !showStageLandBudget;
  }

  function togglePrecinctLandBudget() {
    showLandBudget = !showLandBudget;
  }

  function toggleStageLbCategory(cat: string) {
    if (stageLbExpandedCategories.has(cat)) {
      stageLbExpandedCategories.delete(cat);
    } else {
      stageLbExpandedCategories.add(cat);
    }
    stageLbExpandedCategories = new Set(stageLbExpandedCategories);
  }

  function toggleLbCategory(cat: string) {
    if (lbExpandedCategories.has(cat)) {
      lbExpandedCategories.delete(cat);
    } else {
      lbExpandedCategories.add(cat);
    }
    lbExpandedCategories = new Set(lbExpandedCategories);
  }

  // ===== Stage land budget functions =====
  async function loadStageLandBudget() {
    if (!selectedNode || selectedNode.type !== 'stage') return;
    loadingStageLandBudget = true;
    try {
      const res = await fetch(`/api/land-budget?stageId=${selectedNode.id}`);
      if (res.ok) {
        const data = await res.json();
        stageLandBudgetData = data.items || [];
        stageLandBudgetCategories = data.categories || {};
        stageLandBudgetLotAreaHa = data.lotAreaHa || 0;
        stageLandBudgetEditValues = new Map();
        for (const item of stageLandBudgetData) {
          const key = item.subcategory ? `${item.category}:${item.subcategory}` : `${item.category}:_total`;
          stageLandBudgetEditValues.set(key, item.areaHa || '');
        }
      }
    } catch (e) {
      console.error('Failed to load stage land budget:', e);
    }
    loadingStageLandBudget = false;
  }

  function getStageLandBudgetValue(category: string, subcategory?: string): string {
    const key = subcategory ? `${category}:${subcategory}` : `${category}:_total`;
    if (stageLandBudgetEditMode) {
      return stageLandBudgetEditValues.get(key) || '';
    }
    const item = stageLandBudgetData.find(i => i.category === category && (subcategory ? i.subcategory === subcategory : !i.subcategory));
    return item?.areaHa || '';
  }

  function setStageLandBudgetValue(category: string, subcategory: string | undefined, value: string) {
    const key = subcategory ? `${category}:${subcategory}` : `${category}:_total`;
    stageLandBudgetEditValues.set(key, value);
    stageLandBudgetEditValues = new Map(stageLandBudgetEditValues);
  }

  function calculateStageLandBudgetTotal(categories: string[]): number {
    let total = 0;
    for (const cat of categories) {
      const catConfig = stageLandBudgetCategories[cat];
      if (!catConfig) continue;
      if (catConfig.subcategories && catConfig.subcategories.length > 0) {
        for (const sub of catConfig.subcategories) {
          const val = parseFloat(getStageLandBudgetValue(cat, sub.key) || '0');
          if (!isNaN(val)) total += val;
        }
      } else {
        const val = parseFloat(getStageLandBudgetValue(cat) || '0');
        if (!isNaN(val)) total += val;
      }
    }
    return total;
  }

  function getStageLandBudgetSubName(category: string, subKey: string): string {
    const nameKey = `${category}:${subKey}`;
    if (stageLandBudgetEditMode && stageLandBudgetNameEdits.has(nameKey)) {
      return stageLandBudgetNameEdits.get(nameKey) || '';
    }
    const catConfig = stageLandBudgetCategories[category];
    const sub = catConfig?.subcategories?.find((s: any) => s.key === subKey);
    return sub?.name || subKey;
  }

  function setStageLandBudgetSubName(category: string, subKey: string, name: string) {
    const nameKey = `${category}:${subKey}`;
    stageLandBudgetNameEdits.set(nameKey, name);
    stageLandBudgetNameEdits = new Map(stageLandBudgetNameEdits);
  }

  function getResidentialTotal(): number {
    return calculateStageLandBudgetTotal(['residential']);
  }

  function updateLocalRoadsFromPercent(percent: number) {
    localRoadsPercent = percent;
    const nsaHa = getResidentialTotal();
    const roadsHa = nsaHa > 0 ? (nsaHa * percent / 100) : 0;
    setStageLandBudgetValue('roads', 'localRoads', roadsHa > 0 ? roadsHa.toFixed(4) : '0');
  }

  function getResidentialRows(): Array<{ key: string; name: string; areaHa: number }> {
    const resCat = stageLandBudgetCategories['residential'];
    if (!resCat?.subcategories) return [];
    return resCat.subcategories
      .map((sub: any) => ({
        key: sub.key,
        name: getStageLandBudgetSubName('residential', sub.key),
        areaHa: parseFloat(getStageLandBudgetValue('residential', sub.key) || '0')
      }))
      .filter((r: any) => r.areaHa > 0);
  }

  function getLotGenDensity(subKey: string): number {
    return lotGenDensityMap.get(subKey) ?? 15;
  }

  function setLotGenDensity(subKey: string, val: number) {
    lotGenDensityMap.set(subKey, val);
    lotGenDensityMap = new Map(lotGenDensityMap);
  }

  async function handleGenerateLots() {
    if (!selectedNode || !onGenerateLots || generatingLots) return;
    const rows = getResidentialRows();
    if (rows.length === 0) {
      onLog('No residential area in land budget. Enter residential area first.', 'warning');
      return;
    }
    const genRows = rows.map(r => {
      const density = getLotGenDensity(r.key);
      const lotCount = Math.round(r.areaHa * density);
      const avgSqm = lotCount > 0 ? (r.areaHa * 10000) / lotCount : 0;
      return { name: r.name, areaHa: r.areaHa, density, lotCount, avgSqm };
    }).filter(r => r.lotCount > 0);
    if (genRows.length === 0) {
      onLog('Calculated lot count is 0. Adjust density.', 'warning');
      return;
    }
    generatingLots = true;
    try {
      await onGenerateLots({ stageId: selectedNode.id, rows: genRows, deleteExisting: hasExistingLots });
      showLotGenerator = false;
    } catch (e) {
      console.error('Failed to generate lots:', e);
    } finally {
      generatingLots = false;
    }
  }

  function addStageLandBudgetSubcategory(category: string) {
    if (!stageLandBudgetCategories[category]) return;
    const subs = stageLandBudgetCategories[category].subcategories || [];
    const newKey = `custom_${Date.now()}`;
    const newSub = { key: newKey, name: 'New Item', isCustom: true };
    stageLandBudgetCategories[category].subcategories = [...subs, newSub];
    stageLandBudgetCategories = { ...stageLandBudgetCategories };
    setStageLandBudgetValue(category, newKey, '0');
  }

  function removeStageLandBudgetSubcategory(category: string, subKey: string) {
    if (!stageLandBudgetCategories[category]) return;
    const subs = stageLandBudgetCategories[category].subcategories || [];
    if (subs.length <= 1) return;
    stageLandBudgetCategories[category].subcategories = subs.filter((s: any) => s.key !== subKey);
    stageLandBudgetCategories = { ...stageLandBudgetCategories };
    const key = `${category}:${subKey}`;
    stageLandBudgetEditValues.delete(key);
    stageLandBudgetEditValues = new Map(stageLandBudgetEditValues);
  }

  async function saveStageLandBudget() {
    if (!selectedNode || selectedNode.type !== 'stage' || savingLandBudget) return;
    savingLandBudget = true;
    const items: any[] = [];
    for (const [key, value] of stageLandBudgetEditValues) {
      const [category, subcategory] = key.split(':');
      const nameKey = `${category}:${subcategory}`;
      const customName = stageLandBudgetNameEdits.get(nameKey);
      const catConfig = stageLandBudgetCategories[category];
      const subConfig = catConfig?.subcategories?.find((s: any) => s.key === subcategory);
      items.push({
        category,
        subcategory: subcategory === '_total' ? null : subcategory,
        areaHa: value ? parseFloat(value) || 0 : 0,
        customName: customName || null,
        isCustom: subConfig?.isCustom ? 1 : 0
      });
    }
    try {
      const res = await fetch('/api/land-budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: selectedNode.id, items })
      });
      if (res.ok) {
        stageLandBudgetEditMode = false;
        stageLandBudgetNameEdits = new Map();
        showStageLandBudget = false;
        await loadStageLandBudget();
        showStageLandBudget = true;
        onLog('Land budget saved', 'success');
      }
    } catch (e) {
      console.error('Failed to save land budget:', e);
      onLog('Failed to save land budget', 'error');
    } finally {
      savingLandBudget = false;
    }
  }

  function cancelStageLandBudgetEdit() {
    stageLandBudgetEditMode = false;
    stageLandBudgetEditValues = new Map();
    stageLandBudgetNameEdits = new Map();
    for (const item of stageLandBudgetData) {
      const key = item.subcategory ? `${item.category}:${item.subcategory}` : `${item.category}:_total`;
      stageLandBudgetEditValues.set(key, item.areaHa || '');
    }
  }

  // ===== Precinct land budget functions =====
  async function loadLandBudget() {
    if (!selectedNode || selectedNode.type !== 'precinct') return;
    loadingLandBudget = true;
    try {
      const res = await fetch(`/api/land-budget?precinctId=${selectedNode.id}`);
      if (res.ok) {
        const data = await res.json();
        landBudgetCategories = data.categories || {};
        landBudgetStageData = data.stageData || {};
        landBudgetStages = data.stages || [];
      }
    } catch (e) {
      console.error('Failed to load land budget:', e);
    }
    loadingLandBudget = false;
  }

  function getLandBudgetValue(category: string, subcategory?: string): string {
    let total = 0;
    for (const stageId of Object.keys(landBudgetStageData)) {
      const stageItems = landBudgetStageData[parseInt(stageId)]?.items || [];
      const item = stageItems.find((i: any) => i.category === category && (subcategory ? i.subcategory === subcategory : !i.subcategory));
      if (item?.areaHa) total += parseFloat(item.areaHa);
    }
    return total > 0 ? total.toFixed(4) : '';
  }

  function getLandBudgetStageValue(stageId: number, category: string, subcategory?: string): string {
    const stageItems = landBudgetStageData[stageId]?.items || [];
    const item = stageItems.find((i: any) => i.category === category && (subcategory ? i.subcategory === subcategory : !i.subcategory));
    return item?.areaHa || '';
  }

  function calculateLandBudgetTotal(categories: string[]): number {
    let total = 0;
    for (const cat of categories) {
      const catConfig = landBudgetCategories[cat];
      if (!catConfig) continue;
      if (catConfig.subcategories && catConfig.subcategories.length > 0) {
        for (const sub of catConfig.subcategories) {
          const val = parseFloat(getLandBudgetValue(cat, sub.key) || '0');
          if (!isNaN(val)) total += val;
        }
      } else {
        const val = parseFloat(getLandBudgetValue(cat) || '0');
        if (!isNaN(val)) total += val;
      }
    }
    return total;
  }

  function getPrecinctCategoryStageTotal(stageId: number, catKey: string): number {
    return (landBudgetCategories[catKey]?.subcategories || []).reduce((sum: number, sub: any) => 
      sum + parseFloat(getLandBudgetStageValue(stageId, catKey, sub.key) || '0'), 0);
  }
</script>

<!-- ===== Reusable snippets for category rows ===== -->

{#snippet stageCategoryBlock(catKey: string, catName: string, colorClass: string, indentLevel: number, total: number)}
  <div class="lb-row lb-clickable lb-category" onclick={() => toggleStageLbCategory(catKey)} onkeydown={(e) => e.key === 'Enter' && toggleStageLbCategory(catKey)} role="button" tabindex="0">
    <div class="lb-indent-{indentLevel}">{stageLbExpandedCategories.has(catKey) ? '▼' : '▶'}</div>
    <div class="lb-name {colorClass}">{catName}</div>
    <div class="lb-arrow">→</div>
    <div class="lb-value {colorClass}">{total ? total.toFixed(4) : '-'}</div>
    <div class="lb-unit">ha</div>
    <div class="lb-actions">{#if stageLandBudgetEditMode}<button class="lb-add-btn" onclick={(e) => { e.stopPropagation(); addStageLandBudgetSubcategory(catKey); }}>+</button>{/if}</div>
  </div>
  {#if stageLbExpandedCategories.has(catKey)}
    {#each (stageLandBudgetCategories[catKey]?.subcategories || []) as sub, i}
      {@const subs = stageLandBudgetCategories[catKey]?.subcategories || []}
      {@const isLast = i === subs.length - 1}
      <div class="lb-row lb-sub">
        <div class="lb-indent-{indentLevel + 1}">│ {isLast ? '└─' : '├─'}</div>
        <div class="lb-name">
          {#if stageLandBudgetEditMode}
            <input type="text" class="lb-name-input" value={getStageLandBudgetSubName(catKey, sub.key)} oninput={(e) => setStageLandBudgetSubName(catKey, sub.key, e.currentTarget.value)} />
          {:else}
            {sub.name}
          {/if}
        </div>
        <div class="lb-arrow">→</div>
        <div class="lb-value {colorClass}">
          {#if stageLandBudgetEditMode && !sub.isPercentOfNSA}
            <input type="number" step="0.0001" class="lb-input" value={getStageLandBudgetValue(catKey, sub.key)} oninput={(e) => setStageLandBudgetValue(catKey, sub.key, e.currentTarget.value)} />
          {:else}
            {getStageLandBudgetValue(catKey, sub.key) || '-'}
          {/if}
        </div>
        <div class="lb-unit">ha</div>
        <div class="lb-actions">
          {#if stageLandBudgetEditMode && sub.isPercentOfNSA}
            <div class="lb-percent-input">
              <input type="number" step="0.1" min="0" max="100" class="lb-input lb-input-pct" value={localRoadsPercent} oninput={(e) => updateLocalRoadsFromPercent(parseFloat(e.currentTarget.value) || 0)} />
              <span class="lb-pct-label">% NSA</span>
            </div>
          {:else if stageLandBudgetEditMode && subs.length > 1}
            <button class="lb-del-btn" onclick={() => removeStageLandBudgetSubcategory(catKey, sub.key)}>×</button>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
{/snippet}

{#snippet precinctCategoryBlock(catKey: string, catName: string, colorClass: string, total: number)}
  <div class="lb-row lb-clickable" onclick={() => toggleLbCategory(catKey)} onkeydown={(e) => e.key === 'Enter' && toggleLbCategory(catKey)} role="button" tabindex="0">
    <div class="lb-indent-0">├─ {lbExpandedCategories.has(catKey) ? '▼' : '▶'}</div>
    <div class="lb-name {colorClass}">{catName}</div>
    <div class="lb-arrow">→</div>
    <div class="lb-value {colorClass}">{total ? total.toFixed(4) : '-'}</div>
    <div class="lb-unit">ha</div>
  </div>
  {#if lbExpandedCategories.has(catKey)}
    {#each landBudgetStages as stage}
      {@const stageVal = getPrecinctCategoryStageTotal(stage.id, catKey)}
      {#if stageVal > 0}
        <div class="lb-row lb-sub lb-stage-source">
          <div class="lb-indent-1">│ ├─</div>
          <div class="lb-name lb-color-gray">{stage.name}</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value {colorClass}">{stageVal.toFixed(4)}</div>
          <div class="lb-unit">ha</div>
        </div>
      {/if}
    {/each}
  {/if}
{/snippet}

<!-- ===== STAGE LAND BUDGET (Editable) ===== -->
{#if selectedNode?.type === 'stage'}
  <div class="land-budget-section">
    <div class="panel-header collapsible" onclick={toggleStageLandBudget} onkeydown={(e) => e.key === 'Enter' && toggleStageLandBudget()} role="button" tabindex="0">
      <span>├─ {showStageLandBudget ? '▼' : '▶'} Land Budget</span>
    </div>
  </div>
{/if}

{#if selectedNode?.type === 'stage' && showStageLandBudget}
  {@const transportTotal = calculateStageLandBudgetTotal(['transport'])}
  {@const communityTotal = calculateStageLandBudgetTotal(['community'])}
  {@const educationTotal = calculateStageLandBudgetTotal(['education'])}
  {@const encumberedTotal = calculateStageLandBudgetTotal(['encumberedOpenSpace'])}
  {@const creditedTotal = calculateStageLandBudgetTotal(['creditedOpenSpace'])}
  {@const openSpaceTotal = encumberedTotal + creditedTotal}
  {@const deductionsTotal = transportTotal + communityTotal + educationTotal + openSpaceTotal}
  {@const residentialTotal = calculateStageLandBudgetTotal(['residential'])}
  {@const roadsTotal = calculateStageLandBudgetTotal(['roads'])}
  {@const nraTotal = residentialTotal + roadsTotal}
  {@const nonResTotal = calculateStageLandBudgetTotal(['nonResidentialAreas'])}
  {@const ndaTotal = nraTotal + nonResTotal}
  {@const calculatedSiteArea = deductionsTotal + ndaTotal}
  <div class="land-budget-panel">
    <div class="land-budget-header">
      <div class="lot-area-check"></div>
      <div class="land-budget-controls">
        {#if stageLandBudgetEditMode}
          <button class="btn-save" onclick={saveStageLandBudget} disabled={savingLandBudget}>
            {savingLandBudget ? 'Saving...' : 'Save'}
          </button>
          <button class="btn-cancel" onclick={cancelStageLandBudgetEdit} disabled={savingLandBudget}>Cancel</button>
        {:else if userCanEdit}
          <button class="btn-edit" onclick={() => stageLandBudgetEditMode = true}>Edit</button>
        {/if}
      </div>
    </div>

    {#if loadingStageLandBudget}
      <div class="loading-state">Loading land budget...</div>
    {:else}
      <div class="land-budget-tree">
        <!-- Total Site Area -->
        <div class="lb-row">
          <div class="lb-indent-0">├─</div>
          <div class="lb-name lb-color-white">Total Site Area</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-cyan">{calculatedSiteArea ? calculatedSiteArea.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
          <div class="lb-actions"></div>
        </div>

        {@render stageCategoryBlock('transport', 'Transport', 'lb-color-brown', 0, transportTotal)}
        {@render stageCategoryBlock('community', 'Community', 'lb-color-gold', 0, communityTotal)}
        {@render stageCategoryBlock('education', 'Education', 'lb-color-blue', 0, educationTotal)}

        <!-- Open Space Network -->
        <div class="lb-row">
          <div class="lb-indent-0">├─</div>
          <div class="lb-name lb-color-green">Open Space Network</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-green">{openSpaceTotal ? openSpaceTotal.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
          <div class="lb-actions"></div>
        </div>

        {@render stageCategoryBlock('encumberedOpenSpace', 'Encumbered Open Space', 'lb-color-green-light', 1, encumberedTotal)}
        {@render stageCategoryBlock('creditedOpenSpace', 'Credited Open Space', 'lb-color-green-light', 1, creditedTotal)}

        <!-- Total Deductions -->
        <div class="lb-row lb-total">
          <div class="lb-indent-0">├─</div>
          <div class="lb-name lb-color-purple">Total (Deductions)</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-purple">{deductionsTotal ? deductionsTotal.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
          <div class="lb-actions"></div>
        </div>

        <div class="lb-separator"></div>

        <!-- Net Residential Area (NRA) -->
        <div class="lb-row">
          <div class="lb-indent-0">├─</div>
          <div class="lb-name lb-color-teal">Net Residential Area (NRA)</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-teal">{nraTotal ? nraTotal.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
          <div class="lb-actions"></div>
        </div>

        {@render stageCategoryBlock('residential', 'Residential', 'lb-color-red', 1, residentialTotal)}
        {@render stageCategoryBlock('roads', 'Roads', 'lb-color-gray', 1, roadsTotal)}

        {@render stageCategoryBlock('nonResidentialAreas', 'Non Residential Areas', 'lb-color-magenta', 0, nonResTotal)}

        <!-- Total Net Developable Area -->
        <div class="lb-row lb-grand-total">
          <div class="lb-indent-0">└─</div>
          <div class="lb-name lb-color-orange">Total Net Developable Area (NDA)</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-orange">{ndaTotal ? ndaTotal.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
          <div class="lb-actions"></div>
        </div>
      </div>

      <!-- Lot Generator from Density -->
      {#if userCanEdit && onGenerateLots && residentialTotal > 0 && allMasterplan}
        <div class="lot-gen-section">
          <button class="lot-gen-toggle" onclick={() => showLotGenerator = !showLotGenerator}>
            {showLotGenerator ? '▼' : '▶'} Generate Lots from Density
          </button>
          {#if showLotGenerator}
            <div class="lot-gen-form">
              <div class="lot-gen-info">
                {#if hasExistingLots}
                  Adjust density to regenerate lots. <strong>{existingLots.length} masterplan lots</strong> will be replaced.
                {:else}
                  No lot layout plan? Set density per residential area to generate estimated lots.
                {/if}
              </div>
              <div class="lot-gen-table">
                <div class="lot-gen-header">
                  <span class="lg-col-name">Residential Area</span>
                  <span class="lg-col-area">Area</span>
                  <span class="lg-col-density">Density</span>
                  <span class="lg-col-lots">Lots</span>
                  <span class="lg-col-avg">Avg sqm</span>
                </div>
                {#each getResidentialRows() as row}
                  {@const density = getLotGenDensity(row.key)}
                  {@const lots = Math.round(row.areaHa * density)}
                  {@const avgSqm = lots > 0 ? (row.areaHa * 10000) / lots : 0}
                  <div class="lot-gen-table-row">
                    <span class="lg-col-name lg-row-name">{row.name}</span>
                    <span class="lg-col-area lg-row-val">{row.areaHa.toFixed(4)} ha</span>
                    <span class="lg-col-density">
                      <input type="number" step="0.5" min="1" max="100" class="lot-gen-input" value={density} oninput={(e) => setLotGenDensity(row.key, parseFloat(e.currentTarget.value) || 15)} />
                    </span>
                    <span class="lg-col-lots lg-row-val">{lots}</span>
                    <span class="lg-col-avg lg-row-val {avgSqm < 300 ? 'lg-high-density' : avgSqm > 600 ? 'lg-low-density' : ''}">{avgSqm > 0 ? Math.round(avgSqm) : '-'} sqm</span>
                  </div>
                {/each}
              </div>
              {#if getResidentialRows().length > 0}
                {@const totalLots = getResidentialRows().reduce((sum, r) => sum + Math.round(r.areaHa * getLotGenDensity(r.key)), 0)}
                <div class="lot-gen-summary">
                  <span>Total: <strong>{totalLots}</strong> lots from <strong>{residentialTotal.toFixed(4)}</strong> ha</span>
                </div>
                <button class="btn-generate-lots" class:btn-regen={hasExistingLots} onclick={handleGenerateLots} disabled={generatingLots}>
                  {generatingLots ? 'Generating...' : hasExistingLots ? `Regenerate ${totalLots} Lots` : `Generate ${totalLots} Lots`}
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<!-- ===== PRECINCT LAND BUDGET SUMMARY (Read-only) ===== -->
{#if selectedNode?.type === 'precinct'}
  <div class="land-budget-section">
    <div class="panel-header collapsible" onclick={togglePrecinctLandBudget} onkeydown={(e) => e.key === 'Enter' && togglePrecinctLandBudget()} role="button" tabindex="0">
      <span>├─ {showLandBudget ? '▼' : '▶'} Land Budget Summary</span>
    </div>
  </div>
{/if}

{#if selectedNode?.type === 'precinct' && showLandBudget}
  {@const transportTotal = calculateLandBudgetTotal(['transport'])}
  {@const communityTotal = calculateLandBudgetTotal(['community'])}
  {@const educationTotal = calculateLandBudgetTotal(['education'])}
  {@const encumberedTotal = calculateLandBudgetTotal(['encumberedOpenSpace'])}
  {@const creditedTotal = calculateLandBudgetTotal(['creditedOpenSpace'])}
  {@const openSpaceTotal = encumberedTotal + creditedTotal}
  {@const deductionsTotal = transportTotal + communityTotal + educationTotal + openSpaceTotal}
  {@const residentialTotal = calculateLandBudgetTotal(['residential'])}
  {@const roadsTotal = calculateLandBudgetTotal(['roads'])}
  {@const nraTotal = residentialTotal + roadsTotal}
  {@const nonResTotal = calculateLandBudgetTotal(['nonResidentialAreas'])}
  {@const ndaTotal = nraTotal + nonResTotal}
  {@const calculatedSiteArea = deductionsTotal + ndaTotal}
  <div class="land-budget-panel">
    <div class="land-budget-header">
      <div class="land-budget-controls">
        <span class="lb-summary-label">Aggregated from {landBudgetStages.length} stage(s)</span>
      </div>
      <div class="lot-area-check"></div>
    </div>

    {#if loadingLandBudget}
      <div class="loading-state">Loading land budget...</div>
    {:else if landBudgetStages.length === 0}
      <div class="empty-state">No stage land budget data. Edit land budgets at the Stage level.</div>
    {:else}
      <div class="land-budget-tree">
        <!-- Total Site Area -->
        <div class="lb-row">
          <div class="lb-indent-0">├─</div>
          <div class="lb-name lb-color-white">Total Site Area</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-cyan">{calculatedSiteArea ? calculatedSiteArea.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
        </div>

        {@render precinctCategoryBlock('transport', 'Transport', 'lb-color-brown', transportTotal)}
        {@render precinctCategoryBlock('community', 'Community', 'lb-color-gold', communityTotal)}
        {@render precinctCategoryBlock('education', 'Education', 'lb-color-blue', educationTotal)}

        <!-- Open Space Network -->
        <div class="lb-row">
          <div class="lb-indent-0">├─</div>
          <div class="lb-name lb-color-green">Open Space Network</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-green">{openSpaceTotal ? openSpaceTotal.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
        </div>

        {@render precinctCategoryBlock('encumberedOpenSpace', 'Encumbered Open Space', 'lb-color-green-light', encumberedTotal)}
        {@render precinctCategoryBlock('creditedOpenSpace', 'Credited Open Space', 'lb-color-green-light', creditedTotal)}

        <!-- Total Deductions -->
        <div class="lb-row lb-total">
          <div class="lb-indent-0">├─</div>
          <div class="lb-name lb-color-purple">Total (Deductions)</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-purple">{deductionsTotal ? deductionsTotal.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
        </div>

        <div class="lb-separator"></div>

        <!-- NRA -->
        <div class="lb-row">
          <div class="lb-indent-0">├─</div>
          <div class="lb-name lb-color-teal">Net Residential Area (NRA)</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-teal">{nraTotal ? nraTotal.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
        </div>

        {@render precinctCategoryBlock('residential', 'Residential', 'lb-color-red', residentialTotal)}
        {@render precinctCategoryBlock('roads', 'Roads', 'lb-color-gray', roadsTotal)}

        {@render precinctCategoryBlock('nonResidentialAreas', 'Non Residential Areas', 'lb-color-magenta', nonResTotal)}

        <!-- Total NDA -->
        <div class="lb-row lb-grand-total">
          <div class="lb-indent-0">└─</div>
          <div class="lb-name lb-color-orange">Total Net Developable Area (NDA)</div>
          <div class="lb-arrow">→</div>
          <div class="lb-value lb-color-orange">{ndaTotal ? ndaTotal.toFixed(4) : '-'}</div>
          <div class="lb-unit">ha</div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .land-budget-section {
    border-bottom: 1px solid var(--border-color);
  }

  .panel-header {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .panel-header.collapsible { cursor: pointer; }
  .panel-header.collapsible:hover { background: var(--bg-hover); }

  .land-budget-panel {
    padding: 8px 12px;
    background: var(--input-bg);
  }

  .land-budget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .land-budget-controls { display: flex; gap: 6px; align-items: center; }
  .lot-area-check { font-size: 11px; }
  .check-warning { color: #e0af68; }
  .lb-summary-label { color: var(--text-muted); font-size: 11px; }

  .land-budget-tree {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
  }

  .lb-row {
    display: grid;
    grid-template-columns: 24px 1fr 16px 80px 24px 24px;
    gap: 4px;
    align-items: center;
    padding: 3px 0;
  }

  .lb-row.lb-clickable, .lb-row.lb-category { cursor: pointer; }
  .lb-row.lb-clickable:hover, .lb-row.lb-category:hover { background: var(--bg-hover); }

  .lb-row.lb-total { border-top: 1px solid var(--border-color); padding-top: 6px; margin-top: 4px; }
  .lb-row.lb-grand-total { border-top: 2px solid var(--border-color); padding-top: 6px; margin-top: 4px; font-weight: 700; }

  .lb-separator { height: 1px; background: var(--border-color); margin: 6px 0; }

  .lb-indent-0 { color: var(--text-muted); white-space: nowrap; }
  .lb-indent-1 { color: var(--text-muted); padding-left: 12px; white-space: nowrap; }
  .lb-indent-2 { color: var(--text-muted); padding-left: 24px; white-space: nowrap; }

  .lb-name { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lb-arrow { color: var(--text-muted); text-align: center; }
  .lb-value { text-align: right; font-weight: 500; }
  .lb-unit { color: var(--text-muted); font-size: 10px; }
  .lb-actions { text-align: center; }

  .lb-color-white { color: #c0caf5; }
  .lb-color-brown { color: #c4a574; }
  .lb-color-gold { color: #e0af68; }
  .lb-color-blue { color: #7aa2f7; }
  .lb-color-green { color: #9ece6a; }
  .lb-color-green-light { color: #73daca; }
  .lb-color-cyan { color: #7dcfff; }
  .lb-color-gray { color: var(--text-muted); }
  .lb-color-purple { color: #bb9af7; }
  .lb-color-teal { color: #2ac3de; }
  .lb-color-red { color: #f7768e; }
  .lb-color-magenta { color: #ff79c6; }
  .lb-color-orange { color: #ff9e64; }

  .lb-input {
    width: 70px;
    padding: 2px 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 11px;
    text-align: right;
  }

  .lb-name-input {
    width: 100%;
    padding: 2px 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 11px;
  }

  .lb-add-btn {
    padding: 0 4px;
    background: transparent;
    border: 1px dashed var(--border-color);
    border-radius: 3px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
  }
  .lb-add-btn:hover { border-color: var(--accent-success); color: var(--accent-success); }

  .lb-del-btn {
    padding: 0 4px;
    background: transparent;
    border: 1px solid var(--accent-error);
    border-radius: 3px;
    color: var(--accent-error);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
  }

  .lb-percent-input {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .lb-input-pct {
    width: 45px !important;
  }

  .lb-pct-label {
    color: var(--text-muted);
    font-size: 9px;
    white-space: nowrap;
  }

  .lot-gen-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--border-color);
  }

  .lot-gen-toggle {
    background: transparent;
    border: none;
    color: var(--accent-primary);
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    padding: 4px 0;
  }

  .lot-gen-toggle:hover {
    text-decoration: underline;
  }

  .lot-gen-form {
    padding: 8px;
    margin-top: 4px;
    background: rgba(122, 162, 247, 0.05);
    border: 1px solid rgba(122, 162, 247, 0.15);
    border-radius: 4px;
  }

  .lot-gen-info {
    font-size: 10px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .lot-gen-table {
    margin-top: 4px;
  }

  .lot-gen-header {
    display: flex;
    gap: 4px;
    padding: 3px 0;
    border-bottom: 1px solid var(--border-color);
    font-size: 9px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .lot-gen-table-row {
    display: flex;
    gap: 4px;
    padding: 4px 0;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  .lg-col-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lg-col-area { width: 70px; text-align: right; font-size: 10px; }
  .lg-col-density { width: 60px; text-align: right; }
  .lg-col-lots { width: 40px; text-align: right; font-size: 11px; }
  .lg-col-avg { width: 65px; text-align: right; font-size: 10px; }

  .lg-row-name {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .lg-row-val {
    color: var(--text-primary);
  }

  .lg-high-density {
    color: var(--accent-error, #f7768e) !important;
  }

  .lg-low-density {
    color: var(--accent-success, #9ece6a) !important;
  }

  .lot-gen-input {
    width: 52px;
    padding: 3px 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 11px;
    text-align: right;
  }

  .lot-gen-summary {
    margin: 8px 0 6px;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border-radius: 3px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .btn-generate-lots.btn-regen {
    background: var(--accent-warning, #e0af68);
  }

  .btn-generate-lots {
    width: 100%;
    padding: 6px 12px;
    background: var(--accent-success);
    border: none;
    border-radius: 4px;
    color: var(--bg-primary);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-generate-lots:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-generate-lots:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .lb-stage-source { opacity: 0.8; }

  .loading-state, .empty-state {
    color: var(--text-muted);
    font-size: 11px;
    font-style: italic;
    padding: 12px;
    text-align: center;
  }

  .btn-edit, .btn-save, .btn-cancel {
    padding: 4px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
  }

  .btn-edit { background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); }
  .btn-edit:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
  .btn-save { background: var(--accent-success); border: none; color: var(--bg-primary); }
  .btn-cancel { background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); }
</style>
