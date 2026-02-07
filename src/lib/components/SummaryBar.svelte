<script lang="ts">
  // SummaryBar Component - Collapsible summary bar showing lot statistics
  
  interface TableSummary {
    totalLots: number;
    totalArea: string;
    avgArea: string;
    totalFrontage: string;
    streetNames: string[];
  }
  
  let {
    tableData,
    summary,
    collapsed,
    onToggleCollapsed
  }: {
    tableData: any[];
    summary: TableSummary | null;
    collapsed: boolean;
    onToggleCollapsed: () => void;
  } = $props();
  
  // Computed pricing preview data
  const lotDensityInfo = $derived((() => {
    if (!summary || summary.totalLots === 0) return null;
    const totalAreaSqm = parseFloat(summary.totalArea) || 0;
    const totalAreaHa = totalAreaSqm / 10000;
    const lotDensity = totalAreaHa > 0 ? (summary.totalLots / totalAreaHa) : 0;
    return { totalAreaHa, lotDensity };
  })());
</script>

{#if summary}
  <div class="summary-section">
    <div class="panel-header collapsible" onclick={onToggleCollapsed} onkeydown={(e) => e.key === 'Enter' && onToggleCollapsed()} role="button" tabindex="0">
      <span>├─ {collapsed ? '▶' : '▼'} Summary</span>
    </div>
    {#if !collapsed}
      <div class="summary-tree">
        <div class="summary-row">
          <span class="tree-prefix">├─</span>
          <span class="sum-label">Lots</span>
          <span class="sum-arrow">→</span>
          <span class="sum-val cyan">{summary.totalLots}</span>
        </div>
        <div class="summary-row">
          <span class="tree-prefix">├─</span>
          <span class="sum-label">Area</span>
          <span class="sum-arrow">→</span>
          <span class="sum-val yellow sum-col1">{summary.totalArea} sqm</span>
          <span class="sum-sep">·</span>
          <span class="sum-label sum-label2">Avg</span>
          <span class="sum-arrow">→</span>
          <span class="sum-val yellow">{summary.avgArea} sqm</span>
        </div>
        <div class="summary-row">
          <span class="tree-prefix">├─</span>
          <span class="sum-label">Frontage</span>
          <span class="sum-arrow">→</span>
          <span class="sum-val magenta">{summary.totalFrontage}</span>
          <span class="sum-unit">m</span>
        </div>
        {#if lotDensityInfo}
          <div class="summary-row">
            <span class="tree-prefix">├─</span>
            <span class="sum-label">Density</span>
            <span class="sum-arrow">→</span>
            <span class="sum-val cyan sum-col1">{lotDensityInfo.lotDensity > 0 ? lotDensityInfo.lotDensity.toFixed(1) : '-'}</span>
            <span class="sum-unit">lots/ha</span>
            <span class="sum-sep">·</span>
            <span class="sum-label sum-label2">Area</span>
            <span class="sum-arrow">→</span>
            <span class="sum-val yellow">{lotDensityInfo.totalAreaHa > 0 ? lotDensityInfo.totalAreaHa.toFixed(4) : '-'}</span>
            <span class="sum-unit">ha</span>
          </div>
        {/if}
        
        {#if tableData.some(lot => parseFloat(lot.price) > 0)}
          {@const lotsWithPrice = tableData.filter(lot => parseFloat(lot.price) > 0)}
          {@const grossRevenue = lotsWithPrice.reduce((sum, lot) => sum + (parseFloat(lot.price) || 0), 0)}
          {@const avgPricePerLot = lotsWithPrice.length > 0 ? Math.round(grossRevenue / lotsWithPrice.length) : 0}
          {@const totalPricedArea = lotsWithPrice.reduce((sum, lot) => sum + (parseFloat(lot.area) || 0), 0)}
          {@const avgPriceSqm = totalPricedArea > 0 ? Math.round(grossRevenue / totalPricedArea) : 0}
          <div class="summary-row">
            <span class="tree-prefix">├─</span>
            <span class="sum-label">Revenue</span>
            <span class="sum-arrow">→</span>
            <span class="sum-val green sum-col1">${grossRevenue.toLocaleString()}</span>
            <span class="sum-sep">·</span>
            <span class="sum-label sum-label2">Priced</span>
            <span class="sum-arrow">→</span>
            <span class="sum-val cyan">{lotsWithPrice.length}/{tableData.length}</span>
          </div>
          <div class="summary-row">
            <span class="tree-prefix">└─</span>
            <span class="sum-label">Avg/Lot</span>
            <span class="sum-arrow">→</span>
            <span class="sum-val green sum-col1">${avgPricePerLot.toLocaleString()}</span>
            <span class="sum-sep">·</span>
            <span class="sum-label sum-label2">Avg/sqm</span>
            <span class="sum-arrow">→</span>
            <span class="sum-val green">${avgPriceSqm.toLocaleString()}</span>
          </div>
        {:else}
          <div class="summary-row">
            <span class="tree-prefix">└─</span>
            <span class="sum-label">Revenue</span>
            <span class="sum-arrow">→</span>
            <span class="sum-val dim">-</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .summary-section {
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
  }
  
  .panel-header.collapsible:hover {
    background: var(--bg-hover);
  }
  
  .summary-tree {
    padding: 8px 12px;
    background: var(--input-bg);
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
  }
  
  .summary-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
  }
  
  .tree-prefix {
    color: var(--text-muted);
    width: 20px;
  }
  
  .sum-label {
    color: var(--text-muted);
    width: 60px;
  }
  
  .sum-label2 {
    width: auto;
  }
  
  .sum-arrow {
    color: var(--text-muted);
  }
  
  .sum-val {
    font-weight: 600;
  }
  
  .sum-val.cyan { color: #7dcfff; }
  .sum-val.yellow { color: #e0af68; }
  .sum-val.magenta { color: #bb9af7; }
  .sum-val.green { color: #9ece6a; }
  .sum-val.dim { color: var(--text-muted); }
  
  .sum-col1 {
    min-width: 100px;
  }
  
  .sum-sep {
    color: var(--text-muted);
    margin: 0 4px;
  }
  
  .sum-unit {
    color: var(--text-muted);
    font-size: 10px;
  }
  
  
</style>
