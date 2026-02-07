<script lang="ts">
  // ForecastPanel Component - Precinct-level forecasting tool
  // Extracted from +page.svelte - self-contained with own state, functions, and styles

  let {
    selectedNode,
    onLog,
    onSaveNodePreference,
    onLoadNodePreferences
  }: {
    selectedNode: { id: number; name: string; type: string } | null;
    onLog: (message: string, type?: 'success' | 'error' | 'loading' | 'info' | 'warning') => void;
    onSaveNodePreference: (entityType: string, entityId: number, prefKey: string, prefValue: boolean | string) => void;
    onLoadNodePreferences: (entityType: string, entityId: number) => Promise<Record<string, string>>;
  } = $props();

  // ===== STATE VARIABLES =====
  let savingForecast = $state(false);
  let showForecastTool = $state(false);
  let forecastMode: 'sold_date' | 'exchange_date' | 'settled_date' | 'cancelled_date' | 'combined' = $state('sold_date');
  let forecastPeriod: 'days' | 'months' | 'quarters' | 'halfyear' | 'year' = $state('months');
  let forecastRange = $state(6);
  let forecastPeriodOffset = $state(0);
  let forecastEditMode = $state(false);
  let forecastExpandedStages: Set<number> = $state(new Set());
  let forecastLotSort: 'number' | 'date' | 'status' | 'price' = $state('number');
  let forecastLotSortAsc: boolean = $state(true);
  let forecastData: Map<number, Map<string, number>> = $state(new Map());
  let forecastOriginalData: Map<number, Map<string, number>> = $state(new Map());
  let forecastActualData: Map<number, Map<string, number>> = $state(new Map());
  let forecastManualData: Map<number, Map<string, number>> = $state(new Map());
  let forecastStages: any[] = $state([]);
  let forecastPeriodsKey = $state(0);
  // Plain variables (not $state) - only used for comparison tracking inside effects
  let lastForecastPeriod: 'days' | 'months' | 'quarters' | 'halfyear' | 'year' = 'months';
  let lastForecastMode: 'sold_date' | 'exchange_date' | 'settled_date' | 'cancelled_date' | 'combined' = 'sold_date';
  let lastSelectedNodeId: number | null = null;

  // ===== DERIVED: forecastPeriods =====
  let forecastPeriods = $derived((() => {
    // Reference the key to force recalculation
    const _ = forecastPeriodsKey;
    const now = new Date();
    const periods: { key: string; label: string; start: Date; end: Date; midDate: string }[] = [];

    if (forecastPeriod === 'months') {
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i + forecastPeriodOffset, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + i + forecastPeriodOffset + 1, 0);
        // Mid-month = 15th
        const mid = new Date(d.getFullYear(), d.getMonth(), 15);
        periods.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          label: d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
          start: d,
          end: end,
          midDate: mid.toISOString().slice(0, 10)
        });
      }
    } else if (forecastPeriod === 'quarters') {
      const currentQ = Math.floor(now.getMonth() / 3);
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const qOffset = currentQ + i + forecastPeriodOffset;
        const year = now.getFullYear() + Math.floor(qOffset / 4);
        const q = ((qOffset % 4) + 4) % 4;
        const startMonth = q * 3;
        const d = new Date(year, startMonth, 1);
        const end = new Date(year, startMonth + 3, 0);
        // Mid-quarter = 15th of middle month (month+1)
        const mid = new Date(year, startMonth + 1, 15);
        periods.push({
          key: `${year}-Q${q + 1}`,
          label: `Q${q + 1} ${String(year).slice(-2)}`,
          start: d,
          end: end,
          midDate: mid.toISOString().slice(0, 10)
        });
      }
    } else if (forecastPeriod === 'halfyear') {
      const currentH = Math.floor(now.getMonth() / 6);
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const hOffset = currentH + i + forecastPeriodOffset;
        const year = now.getFullYear() + Math.floor(hOffset / 2);
        const h = ((hOffset % 2) + 2) % 2;
        const startMonth = h * 6;
        const d = new Date(year, startMonth, 1);
        const end = new Date(year, startMonth + 6, 0);
        // Mid-half = 15th of middle month (month+2 for H1=Mar, month+2 for H2=Sep)
        const mid = new Date(year, startMonth + 2, 15);
        periods.push({
          key: `${year}-H${h + 1}`,
          label: `H${h + 1} ${year}`,
          start: d,
          end: end,
          midDate: mid.toISOString().slice(0, 10)
        });
      }
    } else if (forecastPeriod === 'year') {
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const year = now.getFullYear() + i + forecastPeriodOffset;
        // Mid-year = July 1 (or June 15 for mid-point)
        const mid = new Date(year, 5, 15); // June 15
        periods.push({
          key: `${year}`,
          label: `FY${String(year).slice(-2)}`,
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31),
          midDate: mid.toISOString().slice(0, 10)
        });
      }
    } else { // days
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i + forecastPeriodOffset);
        periods.push({
          key: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }),
          start: new Date(d),
          end: new Date(d),
          midDate: d.toISOString().slice(0, 10)
        });
      }
    }
    return periods;
  })());

  // ===== EFFECT: Re-bucket data when period type or mode changes =====
  $effect(() => {
    if (showForecastTool && forecastStages.length > 0 && !forecastEditMode &&
           (forecastPeriod !== lastForecastPeriod || forecastMode !== lastForecastMode)) {
      lastForecastPeriod = forecastPeriod;
      lastForecastMode = forecastMode;
      // Re-bucket existing lot data into new periods - track actual, manual, and auto separately
      const newForecastData = new Map<number, Map<string, number>>();
      const newActualData = new Map<number, Map<string, number>>();
      const newManualData = new Map<number, Map<string, number>>();
      for (const stage of forecastStages) {
        const stageMap = new Map<string, number>();
        const actualMap = new Map<string, number>();
        const manualMap = new Map<string, number>();
        if (stage.lots && stage.lots.length > 0) {
          for (const lot of stage.lots) {
            const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
            const dateValue = customData[forecastMode];
            if (dateValue) {
              const periodKey = getPeriodKeyForDate(dateValue);
              stageMap.set(periodKey, (stageMap.get(periodKey) || 0) + 1);

              // Check if this date is marked as actual (confirmed)
              const actualField = `${forecastMode}_actual`;
              if (customData[actualField]) {
                actualMap.set(periodKey, (actualMap.get(periodKey) || 0) + 1);
              }
              // Check if this date was manually assigned
              const manualField = `${forecastMode}_manual`;
              if (customData[manualField] && !customData[actualField]) {
                manualMap.set(periodKey, (manualMap.get(periodKey) || 0) + 1);
              }
            }
          }
        }
        newForecastData.set(stage.id, stageMap);
        newActualData.set(stage.id, actualMap);
        newManualData.set(stage.id, manualMap);
      }
      forecastData = newForecastData;
      forecastActualData = newActualData;
      forecastManualData = newManualData;
      forecastPeriodsKey++;
    }
  });

  // ===== EFFECT: Auto-load on selectedNode change =====
  $effect(() => {
    const node = selectedNode;
    const nodeId = node?.id ?? null;
    
    // Only reset if node actually changed
    if (nodeId !== lastSelectedNodeId) {
      lastSelectedNodeId = nodeId;
      resetForecastTool();
      if (node?.type === 'precinct') {
        onLoadNodePreferences(node.type, node.id).then((prefs) => {
          if (prefs && prefs['showForecastTool'] === 'true') {
            showForecastTool = true;
            loadForecastData();
          }
        }).catch(() => {
          // Ignore preference load errors
        });
      }
    }
  });

  // ===== FUNCTIONS =====

  // Reset forecast tool when precinct changes
  function resetForecastTool() {
    showForecastTool = false;
    forecastEditMode = false;
    forecastData = new Map();
    forecastActualData = new Map();
    forecastManualData = new Map();
    forecastStages = [];
    forecastPeriodOffset = 0;
    forecastPeriodsKey++;
  }

  // Navigate forecast periods
  function forecastNavigatePrev() {
    forecastPeriodOffset--;
    forecastPeriodsKey++;
  }

  function forecastNavigateNext() {
    forecastPeriodOffset++;
    forecastPeriodsKey++;
  }

  function forecastNavigateReset() {
    forecastPeriodOffset = 0;
    forecastPeriodsKey++;
  }

  // Load forecast data for precinct
  async function loadForecastData() {
    if (!selectedNode || selectedNode.type !== 'precinct') return;

    try {
      const res = await fetch(`/api/stages?precinctId=${selectedNode.id}`);
      const stages = await res.json();
      forecastStages = stages;

      // Initialize forecast data from stage lots - separate actual, manual, and auto
      const newData = new Map<number, Map<string, number>>(); // Total counts
      const newActualData = new Map<number, Map<string, number>>(); // Actual (confirmed) counts only
      const newManualData = new Map<number, Map<string, number>>(); // Manual (user-assigned) counts

      for (const stage of stages) {
        const stageMap = new Map<string, number>();
        const actualMap = new Map<string, number>();
        const manualMap = new Map<string, number>();

        if (stage.lots && stage.lots.length > 0) {
          for (const lot of stage.lots) {
            const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
            const dateValue = customData[forecastMode];
            if (dateValue) {
              const periodKey = getPeriodKeyForDate(dateValue);
              stageMap.set(periodKey, (stageMap.get(periodKey) || 0) + 1);

              // Check if this date is marked as actual (confirmed)
              const actualField = `${forecastMode}_actual`;
              if (customData[actualField]) {
                actualMap.set(periodKey, (actualMap.get(periodKey) || 0) + 1);
              }
              // Check if this date was manually assigned (but not actual)
              const manualField = `${forecastMode}_manual`;
              if (customData[manualField] && !customData[actualField]) {
                manualMap.set(periodKey, (manualMap.get(periodKey) || 0) + 1);
              }
            }
          }
        }

        newData.set(stage.id, stageMap);
        newActualData.set(stage.id, actualMap);
        newManualData.set(stage.id, manualMap);
      }

      forecastData = newData;
      forecastActualData = newActualData;
      forecastManualData = newManualData;
      // Store original for comparison during save
      forecastOriginalData = new Map();
      for (const [stageId, stageMap] of newData.entries()) {
        forecastOriginalData.set(stageId, new Map(stageMap));
      }
    } catch (e) {
      console.error('Failed to load forecast data:', e);
    }
  }

  // Toggle forecast stage expansion to show lot details
  function toggleForecastStageExpand(stageId: number) {
    if (forecastExpandedStages.has(stageId)) {
      forecastExpandedStages.delete(stageId);
    } else {
      forecastExpandedStages.add(stageId);
    }
    forecastExpandedStages = new Set(forecastExpandedStages); // Trigger reactivity
  }

  // Get sorted lots for a stage - maintains stable order
  function getSortedLots(lots: any[]): any[] {
    if (!lots || lots.length === 0) return [];

    // Create a copy to avoid mutating original
    const sorted = [...lots];

    sorted.sort((a, b) => {
      const aCustom = a.customData ? (typeof a.customData === 'string' ? JSON.parse(a.customData) : a.customData) : {};
      const bCustom = b.customData ? (typeof b.customData === 'string' ? JSON.parse(b.customData) : b.customData) : {};

      let result = 0;

      if (forecastLotSort === 'number') {
        // Sort by lot number (natural sort)
        const aNum = parseInt(a.lotNumber || a.name || '0') || 0;
        const bNum = parseInt(b.lotNumber || b.name || '0') || 0;
        result = aNum - bNum;
      } else if (forecastLotSort === 'date') {
        // Sort by forecast date (nulls last regardless of direction)
        const aDate = aCustom[forecastMode] || '';
        const bDate = bCustom[forecastMode] || '';
        if (!aDate && !bDate) result = 0;
        else if (!aDate) result = 1; // nulls always last
        else if (!bDate) result = -1;
        else result = aDate.localeCompare(bDate);
      } else if (forecastLotSort === 'status') {
        // Sort by status: Actual > Forecast > None (asc) or None > Forecast > Actual (desc)
        const aStatus = aCustom[`${forecastMode}_actual`] ? 2 : (aCustom[forecastMode] ? 1 : 0);
        const bStatus = bCustom[`${forecastMode}_actual`] ? 2 : (bCustom[forecastMode] ? 1 : 0);
        result = aStatus - bStatus;
      } else if (forecastLotSort === 'price') {
        // Sort by price
        const aPrice = parseFloat(a.price) || 0;
        const bPrice = parseFloat(b.price) || 0;
        result = aPrice - bPrice;
      }

      // Apply sort direction (except for null handling in date sort)
      return forecastLotSortAsc ? result : -result;
    });

    return sorted;
  }

  // Start editing forecast - snapshot current state
  function startForecastEdit() {
    // Deep copy current data as original baseline
    forecastOriginalData = new Map();
    for (const [stageId, stageMap] of forecastData.entries()) {
      forecastOriginalData.set(stageId, new Map(stageMap));
    }
    forecastEditMode = true;
  }

  // Get period key for a date
  function getPeriodKeyForDate(dateStr: string): string {
    // Parse date string directly to avoid timezone issues
    // Format expected: "YYYY-MM-DD"
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]); // 1-indexed from string

    if (forecastPeriod === 'months') {
      return `${year}-${String(month).padStart(2, '0')}`;
    } else if (forecastPeriod === 'quarters') {
      return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
    } else if (forecastPeriod === 'halfyear') {
      return `${year}-H${Math.floor((month - 1) / 6) + 1}`;
    } else if (forecastPeriod === 'year') {
      return `${year}`;
    }
    return dateStr.slice(0, 10);
  }

  // Get unallocated lots for a stage
  function getUnallocatedLots(stageId: number): number {
    const stage = forecastStages.find(s => s.id === stageId);
    if (!stage || !stage.lots) return 0;

    const allocated = Array.from(forecastData.get(stageId)?.values() || []).reduce((a, b) => a + b, 0);
    return stage.lots.length - allocated;
  }

  // Get stage lot stats for a period
  function getStagePeriodStats(stageId: number, periodKey: string): { lots: number; area: number; avgArea: number; totalPrice: number; avgPrice: number; pricePerSqm: number } {
    const stage = forecastStages.find(s => s.id === stageId);
    const lotCount = forecastData.get(stageId)?.get(periodKey) || 0;

    if (!stage || !stage.lots || lotCount === 0) {
      return { lots: 0, area: 0, avgArea: 0, totalPrice: 0, avgPrice: 0, pricePerSqm: 0 };
    }

    // Get lots that match this period
    const matchingLots = stage.lots.filter((lot: any) => {
      const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
      const dateValue = customData[forecastMode];
      return dateValue && getPeriodKeyForDate(dateValue) === periodKey;
    });

    const totalArea = matchingLots.reduce((sum: number, lot: any) => sum + (parseFloat(lot.area) || 0), 0);
    const totalPrice = matchingLots.reduce((sum: number, lot: any) => sum + (parseFloat(lot.price) || 0), 0);

    return {
      lots: lotCount,
      area: totalArea,
      avgArea: lotCount > 0 ? totalArea / lotCount : 0,
      totalPrice: totalPrice,
      avgPrice: lotCount > 0 ? totalPrice / lotCount : 0,
      pricePerSqm: totalArea > 0 ? totalPrice / totalArea : 0
    };
  }

  // Get column totals
  function getPeriodTotals(periodKey: string): { lots: number; area: number; avgArea: number; totalPrice: number; avgPrice: number; pricePerSqm: number } {
    let totalLots = 0;
    let totalArea = 0;
    let totalPrice = 0;

    for (const stage of forecastStages) {
      const stats = getStagePeriodStats(stage.id, periodKey);
      totalLots += stats.lots;
      totalArea += stats.area;
      totalPrice += stats.totalPrice;
    }

    return {
      lots: totalLots,
      area: totalArea,
      avgArea: totalLots > 0 ? totalArea / totalLots : 0,
      totalPrice: totalPrice,
      avgPrice: totalLots > 0 ? totalPrice / totalLots : 0,
      pricePerSqm: totalArea > 0 ? totalPrice / totalArea : 0
    };
  }

  // Update forecast allocation
  function updateForecastAllocation(stageId: number, periodKey: string, value: number) {
    console.log(`updateForecastAllocation: stageId=${stageId}, periodKey=${periodKey}, value=${value}`);

    // Deep clone the Map to ensure reactivity
    const newData = new Map<number, Map<string, number>>();
    for (const [sid, stageMap] of forecastData.entries()) {
      newData.set(sid, new Map(stageMap));
    }

    if (!newData.has(stageId)) {
      newData.set(stageId, new Map());
    }
    newData.get(stageId)!.set(periodKey, Math.max(0, value));

    forecastData = newData;
    console.log('Updated forecastData for stage', stageId, ':', Array.from(newData.get(stageId)!.entries()));
  }

  // Update a single lot's forecast date
  async function updateLotForecastDate(lot: any, stageId: number, newDate: string) {
    try {
      let customData: Record<string, any> = {};
      if (lot.customData) {
        customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
      }

      if (newDate) {
        customData[forecastMode] = newDate;
      } else {
        delete customData[forecastMode];
        delete customData[`${forecastMode}_actual`];
      }

      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
      });

      if (res.ok) {
        lot.customData = JSON.stringify(customData);
        // Refresh forecast data to update totals
        await loadForecastData();
      }
    } catch (e) {
      console.error('Failed to update lot forecast date:', e);
    }
  }

  // Assign lot to a specific period by clicking on that period cell
  async function assignLotToPeriod(lot: any, stageId: number, periodKey: string) {
    try {
      // Parse period key to get a date in the middle of that period
      // Period key format: "2026-Q1" or "2026-01" depending on forecastInterval
      let targetDate: string;
      if (periodKey.includes('Q')) {
        // Quarterly: e.g., "2026-Q1" -> use first month of quarter, 15th day
        const [year, quarter] = periodKey.split('-Q');
        const quarterMonth = (parseInt(quarter) - 1) * 3 + 1; // Q1=1, Q2=4, Q3=7, Q4=10
        targetDate = `${year}-${String(quarterMonth).padStart(2, '0')}-15`;
      } else {
        // Monthly: e.g., "2026-01" -> use 15th day of month
        targetDate = `${periodKey}-15`;
      }

      let customData: Record<string, any> = {};
      if (lot.customData) {
        customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
      }

      customData[forecastMode] = targetDate;
      // Keep it as forecast (not actual) when clicking to move
      if (!customData[`${forecastMode}_actual`]) {
        customData[`${forecastMode}_actual`] = false;
      }

      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
      });

      if (res.ok) {
        lot.customData = JSON.stringify(customData);
        await loadForecastData();
      }
    } catch (e) {
      console.error('Failed to assign lot to period:', e);
    }
  }

  // Toggle lot actual/forecast status (cycles: none -> forecast -> actual -> none)
  async function toggleLotForecastStatus(lot: any, stageId: number) {
    try {
      let customData: Record<string, any> = {};
      if (lot.customData) {
        customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
      }

      const hasDate = !!customData[forecastMode];
      const isActual = !!customData[`${forecastMode}_actual`];

      if (!hasDate) {
        // No date set - set to today as forecast
        customData[forecastMode] = new Date().toISOString().split('T')[0];
        customData[`${forecastMode}_actual`] = false;
      } else if (!isActual) {
        // Has forecast date - mark as actual
        customData[`${forecastMode}_actual`] = true;
      } else {
        // Is actual - clear the date entirely
        delete customData[forecastMode];
        delete customData[`${forecastMode}_actual`];
      }

      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
      });

      if (res.ok) {
        lot.customData = JSON.stringify(customData);
        // Refresh forecast data to update totals
        await loadForecastData();
      }
    } catch (e) {
      console.error('Failed to toggle lot forecast status:', e);
    }
  }

  // Save forecast to lots - handles reallocation (unassign from decreased, assign to increased)
  async function saveForecast() {
    if (savingForecast) return;
    savingForecast = true;
    let updated = 0;
    let failed = 0;

    for (const stage of forecastStages) {
      if (!stage.lots || stage.lots.length === 0) continue;

      const originalAllocations = forecastOriginalData.get(stage.id) || new Map();
      const newAllocations = forecastData.get(stage.id) || new Map();

      // Collect all period keys from both original and new
      const allPeriodKeys = new Set([...originalAllocations.keys(), ...newAllocations.keys()]);

      // Pool of lots to reassign (will be populated from decreased periods)
      const lotsToReassign: any[] = [];

      // PHASE 1: Unassign lots from periods where count DECREASED (skip actual and manual lots)
      for (const periodKey of allPeriodKeys) {
        const originalCount = originalAllocations.get(periodKey) || 0;
        const newCount = newAllocations.get(periodKey) || 0;
        const delta = newCount - originalCount;

        if (delta < 0) {
          // Need to unassign |delta| lots from this period - but ONLY auto-assigned lots, not actuals or manual
          const lotsInPeriod = stage.lots.filter((lot: any) => {
            const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
            if (!customData[forecastMode]) return false;
            // Skip lots with actual (confirmed) dates - they cannot be unassigned
            const actualField = `${forecastMode}_actual`;
            if (customData[actualField]) return false;
            // Skip lots with manual flag - they are protected from reforecast
            const manualField = `${forecastMode}_manual`;
            if (customData[manualField]) return false;
            return getPeriodKeyForDate(customData[forecastMode]) === periodKey;
          });

          // Unassign the required number of pending lots
          const toUnassign = Math.min(Math.abs(delta), lotsInPeriod.length);
          for (let i = 0; i < toUnassign; i++) {
            const lot = lotsInPeriod[i];
            try {
              let customData: Record<string, any> = {};
              if (lot.customData) {
                customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
              }
              delete customData[forecastMode]; // Remove the date

              const res = await fetch('/api/lots', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
              });

              if (res.ok) {
                lot.customData = JSON.stringify(customData);
                lotsToReassign.push(lot); // Add to pool for reassignment
                updated++;
              } else {
                failed++;
              }
            } catch (e) {
              failed++;
            }
          }
        }
      }

      // Add originally unassigned lots to the pool (lots without any date for this mode)
      const unassignedLots = stage.lots.filter((lot: any) => {
        const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
        return !customData[forecastMode];
      });
      lotsToReassign.push(...unassignedLots);

      // PHASE 2: Assign lots to periods where count INCREASED
      let poolIndex = 0;
      for (const periodKey of allPeriodKeys) {
        const originalCount = originalAllocations.get(periodKey) || 0;
        const newCount = newAllocations.get(periodKey) || 0;
        const delta = newCount - originalCount;

        if (delta > 0) {
          // Need to assign |delta| lots to this period
          const period = forecastPeriods.find(p => p.key === periodKey);
          if (!period) continue;

          for (let i = 0; i < delta && poolIndex < lotsToReassign.length; i++) {
            const lot = lotsToReassign[poolIndex++];
            try {
              let customData: Record<string, any> = {};
              if (lot.customData) {
                customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
              }
              customData[forecastMode] = period.midDate;

              const res = await fetch('/api/lots', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
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
        }
      }
    }

    forecastEditMode = false;
    savingForecast = false;

    if (updated === 0 && failed === 0) {
      onLog(`No changes to save (lots may already be assigned)`, 'info');
    } else if (failed === 0) {
      onLog(`Forecast saved: ${updated} lots updated`, 'success');
    } else {
      onLog(`Saved ${updated} lots, ${failed} failed`, 'warning');
    }

    // Refresh table data
    await loadForecastData();
    forecastPeriodsKey++;
  }

  // Combined forecast mode - category colors
  const forecastCategoryColors: Record<string, { text: string; bg: string; label: string }> = {
    sold_date: { text: '#9ece6a', bg: 'rgba(158, 206, 106, 0.15)', label: 'S' },
    exchange_date: { text: '#bb9af7', bg: 'rgba(187, 154, 247, 0.15)', label: 'X' },
    settled_date: { text: '#73daca', bg: 'rgba(115, 218, 202, 0.15)', label: 'T' },
    cancelled_date: { text: '#f7768e', bg: 'rgba(247, 118, 142, 0.15)', label: 'C' }
  };

  // Stage date colors for registration/settlement milestones
  const stageDateColors: Record<string, { bg: string; label: string }> = {
    registration: { bg: 'rgba(255, 158, 100, 0.25)', label: 'R' },
    settlement: { bg: 'rgba(100, 200, 255, 0.25)', label: 'S' }
  };

  // Get combined category data for a stage and period
  function getCombinedCellData(stageId: number, periodKey: string): { category: string; count: number }[] {
    const stage = forecastStages.find(s => s.id === stageId);
    if (!stage || !stage.lots) return [];

    const categories = ['sold_date', 'exchange_date', 'settled_date', 'cancelled_date'];
    const result: { category: string; count: number }[] = [];

    for (const category of categories) {
      const count = stage.lots.filter((lot: any) => {
        const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
        const dateValue = customData[category];
        return dateValue && getPeriodKeyForDate(dateValue) === periodKey;
      }).length;

      if (count > 0) {
        result.push({ category, count });
      }
    }

    return result;
  }

  // Get combined totals for a period across all stages
  function getCombinedPeriodTotals(periodKey: string): { category: string; count: number }[] {
    const categories = ['sold_date', 'exchange_date', 'settled_date', 'cancelled_date'];
    const totals: Record<string, number> = {};

    for (const stage of forecastStages) {
      const cellData = getCombinedCellData(stage.id, periodKey);
      for (const item of cellData) {
        totals[item.category] = (totals[item.category] || 0) + item.count;
      }
    }

    return categories.filter(c => totals[c] > 0).map(c => ({ category: c, count: totals[c] }));
  }

  // Check if a stage has a milestone date in a period
  function getStageMilestoneInPeriod(stage: any, periodKey: string): { type: 'registration' | 'settlement'; date: string } | null {
    if (stage.registrationDate) {
      const regKey = getPeriodKeyForDate(stage.registrationDate);
      if (regKey === periodKey) {
        return { type: 'registration', date: stage.registrationDate };
      }
    }
    if (stage.settlementDate) {
      const settKey = getPeriodKeyForDate(stage.settlementDate);
      if (settKey === periodKey) {
        return { type: 'settlement', date: stage.settlementDate };
      }
    }
    return null;
  }

  // Date status types: 'forecast' (future), 'actual' (confirmed past), 'pending' (past but unconfirmed)
  type DateStatus = 'forecast' | 'actual' | 'pending' | 'none';

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
</script>

<!-- PRECINCT FORECASTING TOOL - Separate Section -->
{#if selectedNode?.type === 'precinct'}
  <div class="forecast-section">
    <div class="panel-header collapsible" on:click={() => { showForecastTool = !showForecastTool; if (showForecastTool) loadForecastData(); if (selectedNode) onSaveNodePreference(selectedNode.type, selectedNode.id, 'showForecastTool', showForecastTool); }} on:keydown={(e) => e.key === 'Enter' && (showForecastTool = !showForecastTool)} role="button" tabindex="0">
      <span>├─ {showForecastTool ? '▼' : '▶'} Forecast Tool</span>
    </div>
  </div>
{/if}

<!-- PRECINCT FORECASTING TOOL CONTENT -->
{#if selectedNode?.type === 'precinct' && showForecastTool}
  {@const totalLotsToForecast = forecastStages.reduce((sum, s) => sum + (s.lots?.length || 0), 0)}
  {@const totalAllocated = forecastStages.reduce((sum, s) => {
    const stageData = forecastData.get(s.id);
    return sum + (stageData ? Array.from(stageData.values()).reduce((a, b) => a + b, 0) : 0);
  }, 0)}
  <div class="forecast-tool">
    <div class="forecast-header">
      <div class="forecast-stats-text">
        {#if forecastPeriods.length > 0 && forecastPeriod}
          {@const _fp = forecastPeriod}
          {@const _fk = forecastPeriodsKey}
          {@const periodLabel = _fp === 'days' ? 'Today' : _fp === 'months' ? 'This Month' : _fp === 'quarters' ? 'This Qtr' : _fp === 'halfyear' ? 'This Half' : 'This Year'}
          {@const currentPeriodStats = (() => {
            const fp = _fp;
            const now = new Date();
            let currentKey = '';
            if (fp === 'months') {
              currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            } else if (fp === 'quarters') {
              currentKey = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
            } else if (fp === 'halfyear') {
              currentKey = `${now.getFullYear()}-H${Math.floor(now.getMonth() / 6) + 1}`;
            } else if (fp === 'year') {
              currentKey = `${now.getFullYear()}`;
            } else {
              currentKey = now.toISOString().slice(0, 10);
            }
            const categories = ['sold_date', 'exchange_date', 'settled_date', 'cancelled_date'];
            const stats: Record<string, { actual: number; total: number }> = {};
            for (const cat of categories) {
              stats[cat] = { actual: 0, total: 0 };
            }
            for (const stage of forecastStages) {
              if (!stage.lots) continue;
              for (const lot of stage.lots) {
                const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
                for (const cat of categories) {
                  const dateValue = customData[cat];
                  if (!dateValue) continue;
                  const d = new Date(dateValue);
                  let lotKey = '';
                  if (fp === 'months') {
                    lotKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  } else if (fp === 'quarters') {
                    lotKey = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
                  } else if (fp === 'halfyear') {
                    lotKey = `${d.getFullYear()}-H${Math.floor(d.getMonth() / 6) + 1}`;
                  } else if (fp === 'year') {
                    lotKey = `${d.getFullYear()}`;
                  } else {
                    lotKey = dateValue.slice(0, 10);
                  }
                  if (lotKey === currentKey) {
                    stats[cat].total++;
                    if (customData[`${cat}_actual`]) {
                      stats[cat].actual++;
                    }
                  }
                }
              }
            }
            return stats;
          })()}
          <button class="stat-link sold" class:active={forecastMode === 'sold_date'} on:click={() => { forecastMode = 'sold_date'; loadForecastData(); }}>
            Sold: <span class="actual">{currentPeriodStats.sold_date.actual}</span>/<span class="target">{currentPeriodStats.sold_date.total}</span>
          </button>
          <button class="stat-link exchanged" class:active={forecastMode === 'exchange_date'} on:click={() => { forecastMode = 'exchange_date'; loadForecastData(); }}>
            Exch: <span class="actual">{currentPeriodStats.exchange_date.actual}</span>/<span class="target">{currentPeriodStats.exchange_date.total}</span>
          </button>
          <button class="stat-link settled" class:active={forecastMode === 'settled_date'} on:click={() => { forecastMode = 'settled_date'; loadForecastData(); }}>
            Sett: <span class="actual">{currentPeriodStats.settled_date.actual}</span>/<span class="target">{currentPeriodStats.settled_date.total}</span>
          </button>
          <button class="stat-link cancelled" class:active={forecastMode === 'cancelled_date'} on:click={() => { forecastMode = 'cancelled_date'; loadForecastData(); }}>
            Canc: <span class="actual">{currentPeriodStats.cancelled_date.actual}</span>/<span class="target">{currentPeriodStats.cancelled_date.total}</span>
          </button>
        {/if}
      </div>

      <div class="forecast-controls">
        <div class="control-group">
          <label for="forecast-mode-select">Forecast Mode:</label>
          <select id="forecast-mode-select" bind:value={forecastMode} on:change={loadForecastData} class="forecast-select">
            <option value="sold_date">Sales Date</option>
            <option value="exchange_date">Exchange Date</option>
            <option value="settled_date">Settlement Date</option>
            <option value="cancelled_date">Cancel Date</option>
            <option value="combined">Combined View</option>
          </select>
        </div>

        <div class="control-group">
          <span class="control-label">Period:</span>
          <div class="period-buttons">
            <button class:active={forecastPeriod === 'days'} on:click={() => { forecastPeriod = 'days'; forecastRange = 14; forecastPeriodOffset = 0; loadForecastData(); }}>Days</button>
            <button class:active={forecastPeriod === 'months'} on:click={() => { forecastPeriod = 'months'; forecastRange = 6; forecastPeriodOffset = 0; loadForecastData(); }}>Month</button>
            <button class:active={forecastPeriod === 'quarters'} on:click={() => { forecastPeriod = 'quarters'; forecastRange = 4; forecastPeriodOffset = 0; loadForecastData(); }}>Qtr</button>
            <button class:active={forecastPeriod === 'halfyear'} on:click={() => { forecastPeriod = 'halfyear'; forecastRange = 2; forecastPeriodOffset = 0; loadForecastData(); }}>Half</button>
            <button class:active={forecastPeriod === 'year'} on:click={() => { forecastPeriod = 'year'; forecastRange = 2; forecastPeriodOffset = 0; loadForecastData(); }}>Year</button>
          </div>
        </div>

        <div class="control-group">
          <label for="forecast-range-slider">Range: +/-{forecastRange}</label>
          <input id="forecast-range-slider" type="range" min="1" max={forecastPeriod === 'days' ? 30 : forecastPeriod === 'months' ? 12 : 6} bind:value={forecastRange} class="range-slider" />
        </div>

        <div class="forecast-sort">
          <label for="lot-sort">Sort:</label>
          <select id="lot-sort" bind:value={forecastLotSort} class="forecast-select">
            <option value="number">Lot #</option>
            <option value="date">Date</option>
            <option value="status">Status</option>
            <option value="price">Price</option>
          </select>
          <button
            class="sort-direction-btn"
            on:click={() => forecastLotSortAsc = !forecastLotSortAsc}
            title={forecastLotSortAsc ? 'Ascending - click for descending' : 'Descending - click for ascending'}
          >
            {forecastLotSortAsc ? '↑' : '↓'}
          </button>
        </div>

        <div class="forecast-actions">
          {#if forecastEditMode}
            <button class="btn-cancel" on:click={() => { forecastEditMode = false; loadForecastData(); }} disabled={savingForecast}>Cancel</button>
            <button class="btn-save" on:click={saveForecast} disabled={savingForecast}>
              {savingForecast ? 'Saving...' : 'Save'}
            </button>
          {:else}
            <button class="btn-edit" on:click={startForecastEdit}>Edit</button>
          {/if}
        </div>
      </div>
    </div>

    <div class="forecast-grid-wrapper">
      <table class="forecast-table">
        <thead>
          <tr>
            <th class="th-stage th-sticky-left">Stage</th>
            <th class="th-lots th-sticky-left th-sticky-left-2">Lots</th>
            <th class="th-unalloc th-sticky-left th-sticky-left-3">Unalloc</th>
            <th class="th-nav th-nav-prev">
              <button class="nav-btn" on:click={forecastNavigatePrev} title="Previous periods">&#171;</button>
            </th>
            {#each forecastPeriods as period}
              <th class="th-period" class:current={period.key === getPeriodKeyForDate(new Date().toISOString())}>{period.label}</th>
            {/each}
            <th class="th-nav th-nav-next">
              <button class="nav-btn" on:click={forecastNavigateNext} title="Next periods">&#187;</button>
            </th>
            <th class="th-total th-sticky-right">Total $</th>
          </tr>
          {#if forecastPeriodOffset !== 0}
            <tr class="offset-indicator">
              <td colspan="3" class="th-sticky-left"></td>
              <td colspan="{forecastPeriods.length + 2}" class="offset-info">
                <button class="btn-reset-offset" on:click={forecastNavigateReset}>&#8634; Return to current</button>
              </td>
              <td class="th-sticky-right"></td>
            </tr>
          {/if}
        </thead>
        <tbody>
          {#each forecastStages as stage}
            {@const stageData = forecastData.get(stage.id) || new Map()}
            {@const unalloc = getUnallocatedLots(stage.id)}
            {@const stageTotalPrice = stage.lots?.reduce((sum: number, l: any) => sum + (parseFloat(l.price) || 0), 0) || 0}
            {@const isExpanded = forecastExpandedStages.has(stage.id)}
            <tr class="stage-row" class:expanded={isExpanded}>
              <td class="stage-name td-sticky-left">
                <div class="stage-name-with-dates">
                  <button class="stage-expand-btn" on:click={() => toggleForecastStageExpand(stage.id)} title={isExpanded ? 'Collapse' : 'Expand lots'}>
                    {isExpanded ? '▼' : '▶'}
                  </button>
                  <span>{stage.name}</span>
                  {#if stage.registrationDate || stage.settlementDate}
                    <div class="stage-date-badges">
                      {#if stage.registrationDate}
                        {@const regStatus = getDateStatus(stage.registrationDate, stage.registrationDateActual)}
                        <span
                          class="stage-date-badge"
                          style="background: {dateStatusStyles[regStatus].bg}; color: {dateStatusStyles[regStatus].color}; border-color: {dateStatusStyles[regStatus].border};"
                          title="Registration: {new Date(stage.registrationDate).toLocaleDateString()} ({dateStatusStyles[regStatus].title})"
                        >R</span>
                      {/if}
                      {#if stage.settlementDate}
                        {@const setStatus = getDateStatus(stage.settlementDate, stage.settlementDateActual)}
                        <span
                          class="stage-date-badge"
                          style="background: {dateStatusStyles[setStatus].bg}; color: {dateStatusStyles[setStatus].color}; border-color: {dateStatusStyles[setStatus].border};"
                          title="Settlement: {new Date(stage.settlementDate).toLocaleDateString()} ({dateStatusStyles[setStatus].title})"
                        >S</span>
                      {/if}
                    </div>
                  {/if}
                </div>
              </td>
              <td class="lots-count td-sticky-left td-sticky-left-2">{stage.lots?.length || 0}</td>
              <td class="unalloc-count td-sticky-left td-sticky-left-3" class:warning={unalloc > 0}>{unalloc}</td>
              <td class="td-nav"></td>
              {#each forecastPeriods as period}
                {@const cellValue = stageData.get(period.key) || 0}
                {@const actualValue = forecastActualData.get(stage.id)?.get(period.key) || 0}
                {@const manualValue = forecastManualData.get(stage.id)?.get(period.key) || 0}
                {@const autoValue = cellValue - actualValue - manualValue}
                {@const stats = getStagePeriodStats(stage.id, period.key)}
                {@const milestone = getStageMilestoneInPeriod(stage, period.key)}
                {@const combinedData = forecastMode === 'combined' ? getCombinedCellData(stage.id, period.key) : []}
                <td
                  class="period-cell"
                  class:has-value={forecastMode === 'combined' ? combinedData.length > 0 : cellValue > 0}
                  class:has-actual={actualValue > 0}
                  class:has-manual={manualValue > 0}
                  class:current={period.key === getPeriodKeyForDate(new Date().toISOString())}
                  class:has-registration={milestone?.type === 'registration'}
                  class:has-settlement={milestone?.type === 'settlement'}
                >
                  {#if milestone}
                    <span class="milestone-indicator" title="{milestone.type === 'registration' ? 'Registration' : 'Settlement'} Date: {new Date(milestone.date).toLocaleDateString()}">{milestone.type === 'registration' ? '📋' : '🏠'}</span>
                  {/if}
                  {#if forecastMode === 'combined'}
                    {#if combinedData.length > 0}
                      <div class="combined-cell-content">
                        {#each combinedData as item, idx}
                          <span class="combined-category" style="color: {forecastCategoryColors[item.category].text}" title="{item.category.replace('_', ' ')}: {item.count}">{forecastCategoryColors[item.category].label}{item.count}</span>{#if idx < combinedData.length - 1}<span class="combined-sep">/</span>{/if}
                        {/each}
                      </div>
                    {:else}
                      <span class="cell-empty">-</span>
                    {/if}
                  {:else if forecastEditMode}
                    <div class="forecast-edit-cell">
                      {#if actualValue > 0}
                        <span class="actual-locked" title="Confirmed actuals - cannot edit">{actualValue}A</span>
                      {/if}
                      {#if manualValue > 0}
                        {#if actualValue > 0}<span class="edit-sep">+</span>{/if}
                        <span class="manual-locked" title="Manually assigned - protected from reforecast">{manualValue}M</span>
                      {/if}
                      {#if actualValue > 0 || manualValue > 0}<span class="edit-sep">+</span>{/if}
                      <input
                        type="number"
                        min="0"
                        value={autoValue > 0 ? autoValue : ''}
                        placeholder="-"
                        on:input={(e) => {
                          const val = parseInt(e.currentTarget.value) || 0;
                          updateForecastAllocation(stage.id, period.key, actualValue + manualValue + val);
                        }}
                        class="forecast-input"
                        title="Auto-assigned lots only (can be reforecast)"
                      />
                    </div>
                  {:else if cellValue > 0}
                    <div class="cell-content" title="Lots: {stats.lots} ({actualValue} actual, {manualValue} manual, {autoValue} auto) | Area: {stats.area.toFixed(0)}m² | ${stats.totalPrice.toLocaleString()} | ${stats.pricePerSqm.toFixed(0)}/m²">
                      {#if actualValue > 0}
                        <span class="cell-actual">{actualValue}A</span>
                      {/if}
                      {#if manualValue > 0}
                        {#if actualValue > 0}<span class="cell-sep">+</span>{/if}
                        <span class="cell-manual">{manualValue}M</span>
                      {/if}
                      {#if autoValue > 0}
                        {#if actualValue > 0 || manualValue > 0}<span class="cell-sep">+</span>{/if}
                        <span class="cell-auto">{autoValue}</span>
                      {/if}
                    </div>
                  {:else}
                    <span class="cell-empty">-</span>
                  {/if}
                </td>
              {/each}
              <td class="td-nav"></td>
              <td class="total-price td-sticky-right">${(stageTotalPrice / 1000).toFixed(0)}k</td>
            </tr>
            {#if isExpanded && stage.lots?.length > 0}
              {#each getSortedLots(stage.lots) as lot (`${lot.id}-${forecastPeriod}-${forecastMode}-${forecastLotSort}-${forecastLotSortAsc}`)}
                {@const lotCustomData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {}}
                {@const lotDateValue = lotCustomData[forecastMode] || ''}
                {@const lotDateActual = lotCustomData[`${forecastMode}_actual`] || false}
                {@const lotPeriodKey = lotDateValue ? getPeriodKeyForDate(lotDateValue) : ''}
                <tr class="lot-detail-row">
                  <td class="lot-name td-sticky-left">
                    <span class="lot-indent">└─</span>
                    <span class="lot-number">{lot.lotNumber || lot.name}</span>
                    {#if lot.baseArea}<span class="lot-area">{lot.baseArea}m²</span>{/if}
                  </td>
                  <td class="lot-date-cell td-sticky-left td-sticky-left-2">
                    {#if forecastEditMode}
                      <input
                        type="date"
                        class="lot-date-input"
                        value={lotDateValue}
                        on:change={(e) => updateLotForecastDate(lot, stage.id, e.currentTarget.value)}
                        title="Set forecast date"
                      />
                    {:else}
                      <span class="lot-date-display">{lotDateValue || '-'}</span>
                    {/if}
                  </td>
                  <td class="td-sticky-left td-sticky-left-3">
                    {#if forecastEditMode}
                      <button
                        class="lot-status-badge clickable"
                        class:actual={lotDateActual}
                        class:forecast={lotDateValue && !lotDateActual}
                        class:none={!lotDateValue}
                        on:click={() => toggleLotForecastStatus(lot, stage.id)}
                        title={lotDateActual ? 'Actual - click to clear' : lotDateValue ? 'Forecast - click to mark actual' : 'Not set - click to set forecast'}
                      >
                        {lotDateActual ? 'A' : lotDateValue ? 'F' : '-'}
                      </button>
                    {:else}
                      <span
                        class="lot-status-badge"
                        class:actual={lotDateActual}
                        class:forecast={lotDateValue && !lotDateActual}
                        class:none={!lotDateValue}
                      >
                        {lotDateActual ? 'A' : lotDateValue ? 'F' : '-'}
                      </span>
                    {/if}
                  </td>
                  <td class="td-nav"></td>
                  {#each forecastPeriods as period}
                    <td
                      class="period-cell lot-period"
                      class:lot-period-clickable={forecastEditMode}
                      class:lot-allocated={lotPeriodKey === period.key}
                      class:lot-actual={lotPeriodKey === period.key && lotDateActual}
                      on:click={() => forecastEditMode && assignLotToPeriod(lot, stage.id, period.key)}
                      on:keydown={(e) => forecastEditMode && e.key === 'Enter' && assignLotToPeriod(lot, stage.id, period.key)}
                      role={forecastEditMode ? 'button' : undefined}
                      tabindex={forecastEditMode ? 0 : undefined}
                      title={forecastEditMode ? `Click to move ${lot.lotNumber || lot.name} to ${period.label}` : ''}
                    >
                      {#if lotPeriodKey === period.key}
                        <span class="lot-marker">{lotDateActual ? '●' : '○'}</span>
                      {:else}
                        {forecastEditMode ? '·' : '-'}
                      {/if}
                    </td>
                  {/each}
                  <td class="td-nav"></td>
                  <td class="lot-price td-sticky-right">${lot.price ? (parseFloat(lot.price) / 1000).toFixed(0) + 'k' : '-'}</td>
                </tr>
              {/each}
            {/if}
          {/each}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td class="stage-name td-sticky-left">TOTAL</td>
            <td class="lots-count td-sticky-left td-sticky-left-2">{forecastStages.reduce((sum, s) => sum + (s.lots?.length || 0), 0)}</td>
            <td class="unalloc-count td-sticky-left td-sticky-left-3">{forecastStages.reduce((sum, s) => sum + getUnallocatedLots(s.id), 0)}</td>
            <td class="td-nav"></td>
            {#each forecastPeriods as period}
              {@const totals = getPeriodTotals(period.key)}
              {@const combinedTotals = forecastMode === 'combined' ? getCombinedPeriodTotals(period.key) : []}
              <td class="period-cell totals" class:has-value={forecastMode === 'combined' ? combinedTotals.length > 0 : totals.lots > 0} class:current={period.key === getPeriodKeyForDate(new Date().toISOString())}>
                {#if forecastMode === 'combined'}
                  {#if combinedTotals.length > 0}
                    <div class="combined-cell-content totals">
                      {#each combinedTotals as item, idx}
                        <span class="combined-category" style="color: {forecastCategoryColors[item.category].text}" title="{item.category.replace('_', ' ')}: {item.count}">{forecastCategoryColors[item.category].label}{item.count}</span>{#if idx < combinedTotals.length - 1}<span class="combined-sep">/</span>{/if}
                      {/each}
                    </div>
                  {:else}
                    <span class="cell-empty">-</span>
                  {/if}
                {:else if totals.lots > 0}
                  <div class="totals-content" title="Lots: {totals.lots} | Area: {totals.area.toFixed(0)}m² | ${totals.totalPrice.toLocaleString()} | ${totals.pricePerSqm.toFixed(0)}/m²">
                    <span class="total-lots">{totals.lots}</span>
                    <span class="total-price-small">${(totals.totalPrice / 1000).toFixed(0)}k</span>
                  </div>
                {:else}
                  <span class="cell-empty">-</span>
                {/if}
              </td>
            {/each}
            <td class="td-nav"></td>
            <td class="total-price grand td-sticky-right">${(forecastStages.reduce((sum, s) => sum + (s.lots?.reduce((ls: number, l: any) => ls + (parseFloat(l.price) || 0), 0) || 0), 0) / 1000000).toFixed(2)}M</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="forecast-legend">
      <span class="legend-title">Legend:</span>
      {#if forecastMode !== 'combined'}
        <div class="legend-item">
          <span class="legend-color legend-actual">2A</span>
          <span class="legend-label">Actual (confirmed, locked)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color legend-manual">3M</span>
          <span class="legend-label">Manual (user-assigned, protected)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color legend-auto">5</span>
          <span class="legend-label">Auto (can be reforecast)</span>
        </div>
        <div class="legend-sep">|</div>
      {/if}
      {#if forecastMode === 'combined'}
        <div class="legend-item">
          <span class="legend-color" style="background: rgba(158, 206, 106, 0.3); color: #9ece6a;">S</span>
          <span class="legend-label">Sold</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: rgba(187, 154, 247, 0.3); color: #bb9af7;">X</span>
          <span class="legend-label">Exchanged</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: rgba(115, 218, 202, 0.3); color: #73daca;">T</span>
          <span class="legend-label">Settled</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: rgba(247, 118, 142, 0.3); color: #f7768e;">C</span>
          <span class="legend-label">Cancelled</span>
        </div>
        <div class="legend-sep">|</div>
      {/if}
      <div class="legend-item">
        <span class="legend-color" style="background: rgba(255, 158, 100, 0.3); color: #ff9e64;">📋</span>
        <span class="legend-label">Registration</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: rgba(100, 200, 255, 0.3); color: #7dcfff;">🏠</span>
        <span class="legend-label">Settlement</span>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ===== PANEL / SECTION STYLES ===== */
  .forecast-section {
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

  .panel-header.collapsible {
    cursor: pointer;
    user-select: none;
  }

  .panel-header.collapsible:hover {
    background: var(--table-row-alt);
  }

  .btn-edit, .btn-save, .btn-cancel {
    background: none;
    border: 1px solid;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
    margin-right: 4px;
  }

  .btn-edit { color: #7aa2f7; border-color: #7aa2f7; }
  .btn-edit:hover { background: #7aa2f7; color: #1a1b26; }
  .btn-save { color: #9ece6a; border-color: #9ece6a; }
  .btn-save:hover { background: #9ece6a; color: #1a1b26; }
  .btn-cancel { color: #e0af68; border-color: #e0af68; }
  .btn-cancel:hover { background: #e0af68; color: #1a1b26; }

  .loading-state, .empty-state {
    color: var(--text-muted);
    text-align: center;
    padding: 24px;
  }

  /* ===== FORECAST TOOL STYLES ===== */
  .forecast-tool {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    margin: 8px 0;
    overflow: hidden;
  }

  .forecast-header {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .forecast-stats-text {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
  }

  .forecast-stats-text .stat-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .forecast-stats-text .stat-label {
    color: var(--text-muted);
  }

  .forecast-stats-text .stat-value {
    font-weight: 600;
  }

  .forecast-stats-text .stat-value.total {
    color: var(--accent-primary);
  }

  .forecast-stats-text .stat-value.allocated {
    color: var(--accent-success);
  }

  .forecast-stats-text .stat-value.unallocated {
    color: var(--accent-warning);
  }

  .forecast-stats-text .stat-sep {
    color: var(--border-color);
  }

  .forecast-stats-text .stat-link {
    background: none;
    border: none;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    transition: background 0.15s;
  }

  .forecast-stats-text .stat-link:hover {
    background: rgba(122, 162, 247, 0.15);
  }

  .forecast-stats-text .stat-link.active {
    background: rgba(122, 162, 247, 0.25);
  }

  .forecast-stats-text .stat-link.sold {
    color: #bb9af7;
  }

  .forecast-stats-text .stat-link.exchanged {
    color: #7dcfff;
  }

  .forecast-stats-text .stat-link.settled {
    color: #9ece6a;
  }

  .forecast-stats-text .stat-link.cancelled {
    color: #f7768e;
  }

  .forecast-stats-text .stat-link .actual {
    font-weight: 700;
  }

  .forecast-stats-text .stat-link .target {
    opacity: 0.7;
  }

  button.forecast-card.period-stat {
    min-width: 80px;
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0.6;
  }

  button.forecast-card.period-stat:hover {
    opacity: 0.85;
    transform: translateY(-1px);
  }

  button.forecast-card.period-stat.active {
    opacity: 1;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.15);
  }

  .forecast-card.period-stat.sold {
    background: rgba(224, 175, 104, 0.15);
    border-color: #e0af68;
  }

  .forecast-card.period-stat.sold .card-value {
    color: #e0af68;
  }

  .forecast-card.period-stat.exchanged {
    background: rgba(187, 154, 247, 0.15);
    border-color: #bb9af7;
  }

  .forecast-card.period-stat.exchanged .card-value {
    color: #bb9af7;
  }

  .forecast-card.period-stat.settled {
    background: rgba(158, 206, 106, 0.15);
    border-color: #9ece6a;
  }

  .forecast-card.period-stat.settled .card-value {
    color: #9ece6a;
  }

  .forecast-card.period-stat.cancelled {
    background: rgba(247, 118, 142, 0.15);
    border-color: #f7768e;
  }

  .forecast-card.period-stat.cancelled .card-value {
    color: #f7768e;
  }

  .forecast-card .card-value.dual {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 1px;
  }

  .forecast-card .card-value .actual-val {
    font-size: 18px;
  }

  .forecast-card .card-value .stat-sep {
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 400;
  }

  .forecast-card .card-value .target-val {
    font-size: 14px;
    opacity: 0.7;
  }

  .forecast-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-group label {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .forecast-select {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    padding: 4px 8px;
    font-size: 11px;
    font-family: inherit;
  }

  .forecast-sort {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .forecast-sort label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .sort-direction-btn {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--accent-primary);
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    min-width: 28px;
  }

  .sort-direction-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent-primary);
  }

  .lot-date-display {
    font-size: 10px;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    font-weight: 400;
  }

  .period-buttons {
    display: flex;
    gap: 2px;
  }

  .period-buttons button {
    padding: 4px 10px;
    font-size: 10px;
    font-family: inherit;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .period-buttons button:first-child {
    border-radius: 4px 0 0 4px;
  }

  .period-buttons button:last-child {
    border-radius: 0 4px 4px 0;
  }

  .period-buttons button.active {
    background: #2dd4bf;
    border-color: #2dd4bf;
    color: #1a1b26;
    font-weight: 600;
  }

  .range-slider {
    width: 80px;
    accent-color: #2dd4bf;
  }

  .forecast-actions {
    display: flex;
    gap: 8px;
  }

  .forecast-grid-wrapper {
    overflow-x: auto;
    max-height: 400px;
    position: relative;
  }

  .forecast-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 11px;
  }

  /* Sticky columns for forecast table */
  .forecast-table .th-sticky-left,
  .forecast-table .td-sticky-left {
    position: sticky;
    left: 0;
    background: var(--bg-primary);
    z-index: 2;
  }

  .forecast-table .th-sticky-left-2,
  .forecast-table .td-sticky-left-2 {
    left: 100px;
  }

  .forecast-table .th-sticky-left-3,
  .forecast-table .td-sticky-left-3 {
    left: 150px;
    border-right: 2px solid var(--accent-primary);
  }

  .forecast-table .th-sticky-right,
  .forecast-table .td-sticky-right {
    position: sticky;
    right: 0;
    background: var(--bg-primary);
    z-index: 2;
    border-left: 2px solid var(--accent-primary);
  }

  .forecast-table tbody .td-sticky-left,
  .forecast-table tbody .td-sticky-right {
    background: var(--input-bg);
  }

  .forecast-table tbody tr:hover .td-sticky-left,
  .forecast-table tbody tr:hover .td-sticky-right {
    background: rgba(122, 162, 247, 0.1);
  }

  .forecast-table tfoot .td-sticky-left,
  .forecast-table tfoot .td-sticky-right {
    background: var(--bg-primary);
  }

  /* Navigation columns */
  .forecast-table .th-nav,
  .forecast-table .td-nav {
    width: 28px;
    min-width: 28px;
    max-width: 28px;
    padding: 2px;
  }

  .forecast-table .th-nav {
    background: var(--bg-primary);
  }

  .nav-btn {
    width: 24px;
    height: 24px;
    background: var(--bg-secondary);
    border: 1px solid var(--accent-primary);
    border-radius: 4px;
    color: var(--accent-primary);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .nav-btn:hover {
    background: var(--accent-primary);
    color: var(--text-primary);
  }

  /* Offset indicator row */
  .offset-indicator {
    background: rgba(122, 162, 247, 0.1);
  }

  .offset-info {
    text-align: center;
    padding: 4px !important;
  }

  .btn-reset-offset {
    background: transparent;
    border: 1px solid var(--accent-primary);
    border-radius: 4px;
    color: var(--accent-primary);
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-reset-offset:hover {
    background: var(--accent-primary);
    color: var(--bg-primary);
  }

  .forecast-table th,
  .forecast-table td {
    padding: 6px 8px;
    text-align: center;
    border-bottom: 1px solid var(--border-color);
  }

  .forecast-table thead th {
    background: var(--bg-primary);
    color: var(--text-muted);
    font-weight: 500;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.3px;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .forecast-table .th-stage {
    text-align: left;
    min-width: 100px;
  }

  .forecast-table .th-lots,
  .forecast-table .th-unalloc {
    min-width: 50px;
  }

  .forecast-table .th-period {
    min-width: 60px;
  }

  .forecast-table .th-period.current {
    background: rgba(45, 212, 191, 0.2);
    color: #2dd4bf;
  }

  .forecast-table .th-total {
    min-width: 80px;
  }

  .forecast-table tbody tr:hover {
    background: rgba(122, 162, 247, 0.05);
  }

  .forecast-table .stage-name {
    text-align: left;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .forecast-table .stage-row.expanded {
    background: rgba(122, 162, 247, 0.08);
  }

  .stage-expand-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0 4px 0 0;
    font-size: 10px;
    transition: color 0.15s;
  }

  .stage-expand-btn:hover {
    color: var(--accent-primary);
  }

  .forecast-table .lot-detail-row {
    background: rgba(59, 66, 97, 0.1);
    font-size: 11px;
    font-weight: 400;
  }

  .forecast-table .lot-detail-row:hover {
    background: rgba(59, 66, 97, 0.2);
  }

  .forecast-table .lot-name {
    text-align: left;
    color: var(--text-muted);
    font-weight: 400;
  }

  .forecast-table .lot-indent {
    color: var(--border-color);
    margin-right: 4px;
    font-weight: 400;
  }

  .forecast-table .lot-number {
    color: var(--text-secondary);
    font-weight: 400;
    font-size: 11px;
  }

  .forecast-table .lot-area {
    color: var(--text-muted);
    margin-left: 6px;
    font-size: 10px;
    font-weight: 400;
  }

  .lot-status-badge {
    display: inline-block;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 9px;
    font-weight: 500;
  }

  .lot-status-badge.clickable {
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
  }

  .lot-status-badge.clickable:hover {
    transform: scale(1.1);
  }

  .lot-status-badge.actual {
    background: rgba(158, 206, 106, 0.2);
    color: #9ece6a;
  }

  .lot-status-badge.clickable.actual:hover {
    border-color: #9ece6a;
    background: rgba(158, 206, 106, 0.3);
  }

  .lot-status-badge.forecast {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }

  .lot-status-badge.clickable.forecast:hover {
    border-color: #7aa2f7;
    background: rgba(122, 162, 247, 0.3);
  }

  .lot-status-badge.none {
    background: rgba(59, 66, 97, 0.3);
    color: var(--text-muted);
  }

  .lot-status-badge.clickable.none:hover {
    border-color: var(--text-muted);
    background: rgba(59, 66, 97, 0.5);
  }

  .lot-date-cell {
    padding: 0 2px;
  }

  .lot-date-input {
    width: 85px;
    padding: 1px 2px;
    background: rgba(36, 40, 59, 0.8);
    border: 1px solid var(--border-color);
    border-radius: 2px;
    color: var(--text-secondary);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 400;
  }

  .lot-date-input:focus {
    outline: none;
    border-color: #7aa2f7;
  }

  .lot-date-input::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
    cursor: pointer;
  }

  .forecast-table .lot-period {
    color: #3b4261;
    font-size: 9px;
  }

  .forecast-table .lot-period.lot-period-clickable {
    cursor: pointer;
    transition: background 0.15s;
  }

  .forecast-table .lot-period.lot-period-clickable:hover {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }

  .forecast-table .lot-period.lot-allocated {
    background: rgba(122, 162, 247, 0.15);
  }

  .forecast-table .lot-period.lot-allocated:hover {
    background: rgba(122, 162, 247, 0.3);
  }

  .forecast-table .lot-period.lot-actual {
    background: rgba(158, 206, 106, 0.15);
  }

  .forecast-table .lot-marker {
    color: #7aa2f7;
  }

  .forecast-table .lot-period.lot-actual .lot-marker {
    color: #9ece6a;
  }

  .forecast-table .lot-price {
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 400;
  }

  .forecast-table .lots-count {
    color: #7aa2f7;
  }

  .forecast-table .unalloc-count {
    color: var(--text-muted);
  }

  .forecast-table .unalloc-count.warning {
    color: #f7768e;
    font-weight: 600;
  }

  .forecast-table .period-cell {
    position: relative;
  }

  .forecast-table .period-cell.current {
    background: rgba(45, 212, 191, 0.08);
  }

  .forecast-table .period-cell.has-value {
    background: rgba(45, 212, 191, 0.15);
  }

  .forecast-table .period-cell.current.has-value {
    background: rgba(45, 212, 191, 0.25);
  }

  .forecast-table .cell-empty {
    color: #3b4261;
  }

  .forecast-table .cell-content {
    cursor: help;
  }

  .forecast-table .cell-lots {
    color: #2dd4bf;
    font-weight: 600;
  }

  .forecast-input {
    width: 50px;
    background: transparent;
    border: none;
    border-bottom: 1px solid #24283b;
    border-radius: 0;
    color: var(--text-muted);
    padding: 3px 5px;
    font-size: 11px;
    font-family: inherit;
    text-align: center;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .forecast-input::-webkit-outer-spin-button,
  .forecast-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .forecast-input::placeholder {
    color: #3b4261;
  }

  .forecast-input:focus {
    outline: none;
    border-bottom-color: #2dd4bf;
    color: var(--text-secondary);
    box-shadow: none;
  }

  /* Forecast edit cell with actual + pending */
  .forecast-edit-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .actual-locked {
    color: #22c55e;
    font-weight: 700;
    font-size: 11px;
    padding: 2px 4px;
    background: rgba(34, 197, 94, 0.15);
    border-radius: 3px;
    cursor: not-allowed;
  }

  .edit-sep {
    color: var(--text-muted);
    font-size: 10px;
  }

  /* Cell display for actual vs pending */
  .cell-actual {
    color: #22c55e;
    font-weight: 700;
  }

  .cell-sep {
    color: var(--text-muted);
    font-size: 10px;
    margin: 0 1px;
  }

  .cell-pending {
    color: #e0af68;
    font-weight: 500;
  }

  /* Manual lots styling */
  .manual-locked {
    color: #7aa2f7;
    font-weight: 700;
    font-size: 11px;
    padding: 2px 4px;
    background: rgba(122, 162, 247, 0.15);
    border-radius: 3px;
    cursor: not-allowed;
  }

  .cell-manual {
    color: #7aa2f7;
    font-weight: 700;
  }

  .cell-auto {
    color: var(--text-secondary);
    font-weight: 500;
  }

  /* Period cell with actuals/manual indicator */
  .period-cell.has-actual {
    border-left: 2px solid #22c55e;
  }

  .period-cell.has-manual:not(.has-actual) {
    border-left: 2px solid #7aa2f7;
  }

  .period-cell.has-actual.has-manual {
    border-left: 2px solid;
    border-image: linear-gradient(to bottom, #22c55e 50%, #7aa2f7 50%) 1;
  }

  /* Legend styles for A/M/Auto */
  .legend-actual {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    font-weight: 700;
  }

  .legend-manual {
    background: rgba(122, 162, 247, 0.15);
    color: #7aa2f7;
    font-weight: 700;
  }

  .legend-auto {
    background: rgba(169, 177, 214, 0.15);
    color: var(--text-secondary);
    font-weight: 500;
  }

  .legend-sep {
    color: #3b4261;
    margin: 0 4px;
  }

  .forecast-table .total-price {
    color: #9ece6a;
    font-weight: 500;
  }

  .forecast-table .total-price.grand {
    color: #9ece6a;
    font-weight: 700;
    font-size: 12px;
  }

  .forecast-table tfoot .totals-row {
    background: var(--bg-primary);
    font-weight: 600;
  }

  .forecast-table tfoot .totals-row td {
    border-top: 2px solid var(--accent-primary);
  }

  .forecast-table .totals-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: help;
  }

  .forecast-table .total-lots {
    color: #7aa2f7;
    font-weight: 700;
  }

  .forecast-table .total-price-small {
    font-size: 9px;
    color: #9ece6a;
  }

  /* Stage name with date badges */
  .stage-name-with-dates {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stage-date-badges {
    display: flex;
    gap: 3px;
  }

  .stage-date-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 3px;
    text-transform: uppercase;
    border: 1px solid;
  }

  /* Milestone indicator in period cells */
  .milestone-indicator {
    position: absolute;
    top: 1px;
    right: 2px;
    font-size: 8px;
    opacity: 0.8;
  }

  /* Period cells with milestone backgrounds */
  .forecast-table .period-cell.has-registration {
    background: rgba(255, 158, 100, 0.2) !important;
    border-left: 2px solid #ff9e64;
  }

  .forecast-table .period-cell.has-settlement {
    background: rgba(100, 200, 255, 0.2) !important;
    border-left: 2px solid #7dcfff;
  }

  /* Combined mode cell content */
  .combined-cell-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1px;
    flex-wrap: wrap;
  }

  .combined-category {
    font-weight: 600;
    font-size: 10px;
    white-space: nowrap;
  }

  .combined-sep {
    color: var(--text-muted);
    font-size: 9px;
    margin: 0 1px;
  }

  .combined-cell-content.totals .combined-category {
    font-size: 11px;
    font-weight: 700;
  }

  /* Combined mode legend */
  .forecast-legend {
    display: flex;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(36, 40, 59, 0.5);
    border-top: 1px solid #24283b;
    font-size: 10px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    font-size: 8px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .legend-label {
    color: var(--text-muted);
  }

  .legend-title {
    color: #7aa2f7;
    font-weight: 600;
    margin-right: 8px;
  }
</style>
