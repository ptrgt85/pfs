<script lang="ts">
  // PricingPanel Component - Product pricing matrix with interactive SVG graph

  interface TreeNode {
    id: number;
    name: string;
    type: string;
  }

  interface PricingProduct {
    id?: number;
    productName: string;
    frontage: number;
    depth: number;
    baseArea: number;
    basePrice: number;
    pricePerSqm: number;
    balanceRate: number;
  }

  let {
    selectedNode,
    pricingProducts = $bindable([]),
    masterplanCount = 0,
    hasPermission,
    onLog,
    onApplyToMasterplan
  }: {
    selectedNode: TreeNode | null;
    pricingProducts: PricingProduct[];
    masterplanCount: number;
    hasPermission: (action: 'canView' | 'canEdit' | 'canDelete' | 'canInvite' | 'canManageRoles') => boolean;
    onLog: (message: string, type?: 'success' | 'error' | 'loading' | 'info' | 'warning') => void;
    onApplyToMasterplan: () => void;
  } = $props();

  // Local state
  let showPricingPanel = $state(false);
  let editingPricing = $state(false);

  // Interactive graph state
  let draggingPointIndex: number | null = $state(null);
  let selectedGraphPoint: number | null = $state(null);
  let graphSvgRef: SVGSVGElement | null = $state(null);
  const PRICE_INCREMENT = 5;

  function togglePanel() {
    showPricingPanel = !showPricingPanel;
  }

  async function savePricing() {
    if (!selectedNode) return;

    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedNode.id,
          products: pricingProducts
        })
      });

      if (res.ok) {
        const data = await res.json();
        pricingProducts = data.map((p: any) => ({
          id: p.id,
          productName: p.productName,
          frontage: parseFloat(p.frontage),
          depth: parseFloat(p.depth),
          baseArea: parseFloat(p.frontage) * parseFloat(p.depth),
          basePrice: parseFloat(p.basePrice),
          pricePerSqm: parseFloat(p.pricePerSqm),
          balanceRate: parseFloat(p.balanceRate) || 50
        }));
        editingPricing = false;
        selectedGraphPoint = null;
        onLog('Pricing saved successfully', 'success');
      }
    } catch (e) {
      onLog('Failed to save pricing', 'error');
    }
  }

  function updateProductPrice(index: number, price: number) {
    pricingProducts[index].basePrice = price;
    pricingProducts[index].pricePerSqm = price / pricingProducts[index].baseArea;
    pricingProducts = [...pricingProducts];
  }

  function addProduct() {
    pricingProducts = [...pricingProducts, {
      productName: '',
      frontage: 12,
      depth: 28,
      baseArea: 12 * 28,
      basePrice: 0,
      pricePerSqm: 0,
      balanceRate: 50
    }];
  }

  function removeProduct(index: number) {
    pricingProducts = pricingProducts.filter((_, i) => i !== index);
  }

  // Graph interaction functions
  function selectPoint(index: number) {
    if (!editingPricing) return;
    selectedGraphPoint = index;
  }

  function selectAndDragPoint(event: MouseEvent, index: number) {
    if (!editingPricing) return;
    selectedGraphPoint = index;
    draggingPointIndex = index;
    event.preventDefault();
  }

  function handleGraphMouseMove(event: MouseEvent) {
    if (draggingPointIndex === null || !graphSvgRef) return;

    const rect = graphSvgRef.getBoundingClientRect();
    const svgY = ((event.clientY - rect.top) / rect.height) * 480;

    const pricedProducts = pricingProducts.filter(p => p.pricePerSqm > 0);
    const rawMinSqm = Math.min(...pricedProducts.map(p => p.pricePerSqm));
    const rawMaxSqm = Math.max(...pricedProducts.map(p => p.pricePerSqm));
    const priceRange = rawMaxSqm - rawMinSqm;
    const graphMinSqm = Math.max(0, rawMinSqm - priceRange * 0.2);
    const graphMaxSqm = rawMaxSqm + priceRange * 0.2 || 2000;

    const newPricePerSqm = Math.max(0, graphMinSqm + ((390 - svgY) / 315) * (graphMaxSqm - graphMinSqm));

    const product = pricingProducts[draggingPointIndex];
    product.pricePerSqm = Math.round(newPricePerSqm);
    product.basePrice = Math.round(product.pricePerSqm * product.baseArea);
    pricingProducts = [...pricingProducts];
  }

  function stopDragPoint() {
    draggingPointIndex = null;
  }

  function handleGraphKeydown(event: KeyboardEvent) {
    if (!editingPricing || selectedGraphPoint === null) return;

    const product = pricingProducts[selectedGraphPoint];
    if (!product) return;

    let increment = PRICE_INCREMENT;
    if (event.shiftKey) increment *= 10;

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      product.pricePerSqm = Math.round(product.pricePerSqm + increment);
      product.basePrice = Math.round(product.pricePerSqm * product.baseArea);
      pricingProducts = [...pricingProducts];
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      product.pricePerSqm = Math.max(0, Math.round(product.pricePerSqm - increment));
      product.basePrice = Math.round(product.pricePerSqm * product.baseArea);
      pricingProducts = [...pricingProducts];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const pricedProducts = pricingProducts.filter(p => p.pricePerSqm > 0);
      const sortedByArea = [...pricedProducts].sort((a, b) => a.baseArea - b.baseArea);
      const currentIdx = sortedByArea.findIndex(p => pricingProducts.indexOf(p) === selectedGraphPoint);

      let newIdx = currentIdx;
      if (event.key === 'ArrowLeft') newIdx = Math.max(0, currentIdx - 1);
      if (event.key === 'ArrowRight') newIdx = Math.min(sortedByArea.length - 1, currentIdx + 1);

      selectedGraphPoint = pricingProducts.indexOf(sortedByArea[newIdx]);
    } else if (event.key === 'Escape') {
      selectedGraphPoint = null;
    }
  }

  // Calculate linear regression trend line
  function calculateTrendLine(products: PricingProduct[]): { slope: number; intercept: number } | null {
    const pricedProducts = products.filter(p => p.pricePerSqm > 0);
    if (pricedProducts.length < 2) return null;

    const n = pricedProducts.length;
    const sumX = pricedProducts.reduce((s, p) => s + p.baseArea, 0);
    const sumY = pricedProducts.reduce((s, p) => s + p.pricePerSqm, 0);
    const sumXY = pricedProducts.reduce((s, p) => s + p.baseArea * p.pricePerSqm, 0);
    const sumXX = pricedProducts.reduce((s, p) => s + p.baseArea * p.baseArea, 0);

    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 0.001) return null;

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }

  function applyTrendToAllProducts() {
    const pricedProducts = pricingProducts.filter(p => p.pricePerSqm > 0);
    if (pricedProducts.length < 2) {
      onLog('Need at least 2 products with prices to calculate trend', 'warning');
      return;
    }

    const trend = calculateTrendLine(pricingProducts);
    if (!trend) {
      onLog('Could not calculate trend line', 'error');
      return;
    }

    let filled = 0;
    pricingProducts = pricingProducts.map(p => {
      if (p.pricePerSqm === 0 || p.basePrice === 0) {
        const trendPricePerSqm = Math.max(0, trend.slope * p.baseArea + trend.intercept);
        filled++;
        return {
          ...p,
          pricePerSqm: Math.round(trendPricePerSqm),
          basePrice: Math.round(trendPricePerSqm * p.baseArea)
        };
      }
      return p;
    });
    onLog(`Applied trend to ${filled} products`, 'success');
  }
</script>

{#if selectedNode?.type === 'project'}
  <div class="pricing-section">
    <div class="panel-header collapsible" onclick={togglePanel} onkeydown={(e) => e.key === 'Enter' && togglePanel()} role="button" tabindex="0">
      <span>├─ {showPricingPanel ? '▼' : '▶'} Product Pricing Matrix</span>
    </div>
    
    {#if showPricingPanel}
      <div class="pricing-content">
        <div class="pricing-header">
          <p class="pricing-desc">Define base pricing for standard lot products. Lots with "Masterplan" status will use these prices.</p>
          <div class="pricing-actions">
            {#if editingPricing}
              <button class="btn-save" onclick={savePricing}>💾 Save</button>
              <button class="btn-cancel" onclick={() => { editingPricing = false; }}>Cancel</button>
            {:else if hasPermission('canEdit')}
              <button class="btn-edit" onclick={() => editingPricing = true}>✏️ Edit</button>
            {/if}
          </div>
        </div>
        
        <div class="pricing-table-wrapper">
          <table class="pricing-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Frontage (m)</th>
                <th>Depth (m)</th>
                <th>Area (m²)</th>
                <th>Base Price ($)</th>
                <th>$/m²</th>
                <th>Balance Rate (%)</th>
                {#if editingPricing}<th></th>{/if}
              </tr>
            </thead>
            <tbody>
              {#each pricingProducts as product, i}
                <tr>
                  <td>
                    {#if editingPricing}
                      <input type="text" class="pricing-input name" bind:value={product.productName} placeholder="{product.frontage}x{product.depth}" />
                    {:else}
                      <span class="product-name">{product.productName || `${product.frontage}x${product.depth}`}</span>
                    {/if}
                  </td>
                  <td>
                    {#if editingPricing}
                      <input type="number" class="pricing-input" bind:value={product.frontage} step="0.5" onchange={() => { product.baseArea = product.frontage * product.depth; product.pricePerSqm = product.basePrice / product.baseArea; }} />
                    {:else}
                      {product.frontage}
                    {/if}
                  </td>
                  <td>
                    {#if editingPricing}
                      <input type="number" class="pricing-input" bind:value={product.depth} step="1" onchange={() => { product.baseArea = product.frontage * product.depth; product.pricePerSqm = product.basePrice / product.baseArea; }} />
                    {:else}
                      {product.depth}
                    {/if}
                  </td>
                  <td class="area-cell">{product.baseArea.toFixed(1)}</td>
                  <td>
                    {#if editingPricing}
                      <input type="number" class="pricing-input price" bind:value={product.basePrice} step="1000" onchange={() => updateProductPrice(i, product.basePrice)} />
                    {:else}
                      <span class="price-value">${product.basePrice.toLocaleString()}</span>
                    {/if}
                  </td>
                  <td class="sqm-cell">
                    <span class="sqm-value {product.pricePerSqm > 0 ? (product.pricePerSqm > 1500 ? 'high' : product.pricePerSqm > 1000 ? 'medium' : 'low') : ''}">
                      ${product.pricePerSqm.toFixed(0)}
                    </span>
                  </td>
                  <td>
                    {#if editingPricing}
                      <input type="number" class="pricing-input rate" bind:value={product.balanceRate} min="0" max="100" step="5" />
                    {:else}
                      {product.balanceRate}%
                    {/if}
                  </td>
                  {#if editingPricing}
                    <td>
                      <button class="btn-remove" onclick={() => removeProduct(i)}>✕</button>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        
        {#if editingPricing}
          <button class="btn-add-product" onclick={addProduct}>+ Add Product</button>
        {/if}
        
        <div class="pricing-legend">
          <span class="legend-item"><span class="dot high"></span> High $/m² (&gt;$1500)</span>
          <span class="legend-item"><span class="dot medium"></span> Medium ($1000-$1500)</span>
          <span class="legend-item"><span class="dot low"></span> Low (&lt;$1000)</span>
        </div>
        
        <div class="pricing-info">
          <h4>💡 How Lot Pricing Works:</h4>
          <ul>
            <li><strong>Base Price:</strong> Applied to lots matching the product dimensions</li>
            <li><strong>Balance Rate:</strong> % of $/m² applied to excess area beyond base product</li>
            <li><strong>Example:</strong> 12.5x32m lot using 12.5x28 base → Base price + (32sqm × $/m² × Balance%)</li>
          </ul>
        </div>
        
        <!-- $/sqm Trend Graph -->
        {#if pricingProducts.length > 0 && pricingProducts.some(p => p.pricePerSqm > 0)}
          {@const pricedProducts = pricingProducts.filter(p => p.pricePerSqm > 0)}
          {@const rawMinSqm = Math.min(...pricedProducts.map(p => p.pricePerSqm))}
          {@const rawMaxSqm = Math.max(...pricedProducts.map(p => p.pricePerSqm))}
          {@const priceRange = rawMaxSqm - rawMinSqm}
          {@const graphMinSqm = Math.max(0, rawMinSqm - priceRange * 0.2)}
          {@const graphMaxSqm = rawMaxSqm + priceRange * 0.2 || 2000}
          {@const graphSortedProducts = [...pricingProducts].sort((a, b) => a.baseArea - b.baseArea)}
          {@const graphMinArea = Math.min(...pricingProducts.map(p => p.baseArea))}
          {@const graphMaxArea = Math.max(...pricingProducts.map(p => p.baseArea))}
          {@const trendLine = calculateTrendLine(pricingProducts)}
          <div class="pricing-graph-section full-width">
            <div class="graph-header">
              <h4>📈 $/m² Trend by Area {#if editingPricing}<span class="graph-edit-hint">(drag or ↑↓ keys to adjust)</span>{/if}</h4>
              <div class="graph-actions">
                {#if editingPricing}
                  <button class="btn-graph-save" onclick={savePricing}>💾 Save</button>
                  <button class="btn-graph-cancel" onclick={() => { editingPricing = false; selectedGraphPoint = null; }}>✕ Cancel</button>
                {:else}
                  <button class="btn-graph-edit" onclick={() => editingPricing = true}>✏️ Edit</button>
                {/if}
              </div>
            </div>
            <div class="pricing-graph-container">
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <svg 
                bind:this={graphSvgRef}
                class="pricing-graph" 
                class:editing={editingPricing}
                viewBox="0 0 1200 480" 
                preserveAspectRatio="xMidYMid meet"
                onmousemove={handleGraphMouseMove}
                onmouseup={stopDragPoint}
                onmouseleave={stopDragPoint}
                onkeydown={handleGraphKeydown}
                role="application"
                aria-label="Interactive pricing graph"
                tabindex="0"
              >
                <defs>
                  <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#9ece6a;stop-opacity:0.2" />
                    <stop offset="50%" style="stop-color:#e0af68;stop-opacity:0.2" />
                    <stop offset="100%" style="stop-color:#f7768e;stop-opacity:0.2" />
                  </linearGradient>
                </defs>
                
                <rect x="80" y="30" width="1040" height="360" fill="#1a1b26" stroke="#3b4261" />
                
                {#each [0, 1, 2, 3, 4, 5, 6, 7] as i}
                  {@const yPos = 390 - i * 45}
                  {@const priceValue = graphMinSqm + (graphMaxSqm - graphMinSqm) * i / 7}
                  <line x1="80" y1={yPos} x2="1120" y2={yPos} stroke="#3b4261" stroke-dasharray="2,2" />
                  <text x="72" y={yPos + 5} fill="#a9b1d6" font-size="14" text-anchor="end" font-weight="500">
                    ${Math.round(priceValue)}
                  </text>
                {/each}
                
                <!-- Trend Line -->
                {#if trendLine && graphSortedProducts.length >= 2}
                  {@const trendY1 = trendLine.slope * graphMinArea + trendLine.intercept}
                  {@const trendY2 = trendLine.slope * graphMaxArea + trendLine.intercept}
                  {@const trendYPos1 = 390 - ((trendY1 - graphMinSqm) / (graphMaxSqm - graphMinSqm)) * 315}
                  {@const trendYPos2 = 390 - ((trendY2 - graphMinSqm) / (graphMaxSqm - graphMinSqm)) * 315}
                  <line 
                    x1={80} 
                    y1={Math.max(30, Math.min(390, trendYPos1))} 
                    x2={1120} 
                    y2={Math.max(30, Math.min(390, trendYPos2))} 
                    stroke="#bb9af7" 
                    stroke-width="3" 
                    stroke-dasharray="10,5"
                    opacity="0.8"
                  />
                  <text x="1125" y={Math.max(35, Math.min(385, trendYPos2))} fill="#bb9af7" font-size="13" text-anchor="start" font-weight="600">trend</text>
                {/if}
                
                <!-- Area fill under points -->
                {#if graphSortedProducts.length > 1}
                  {@const areaPoints = graphSortedProducts.filter(p => p.pricePerSqm > 0).map(p => {
                    const x = 80 + (p.baseArea - graphMinArea) / (graphMaxArea - graphMinArea || 1) * 1040;
                    const y = 390 - ((p.pricePerSqm - graphMinSqm) / (graphMaxSqm - graphMinSqm || 1)) * 315;
                    return `${x},${y}`;
                  }).join(' ')}
                  <polygon 
                    points="{areaPoints} 1120,390 80,390" 
                    fill="url(#trendGradient)" 
                  />
                {/if}
                
                <!-- Connecting line -->
                {#if graphSortedProducts.length > 1}
                  {@const linePoints = graphSortedProducts.filter(p => p.pricePerSqm > 0).map(p => {
                    const x = 80 + (p.baseArea - graphMinArea) / (graphMaxArea - graphMinArea || 1) * 1040;
                    const y = 390 - ((p.pricePerSqm - graphMinSqm) / (graphMaxSqm - graphMinSqm || 1)) * 315;
                    return `${x},${y}`;
                  }).join(' ')}
                  <polyline 
                    points={linePoints}
                    fill="none" 
                    stroke="#7aa2f7" 
                    stroke-width="3"
                    opacity="0.7"
                  />
                {/if}
                
                <!-- Data points -->
                {#each graphSortedProducts.filter(p => p.pricePerSqm > 0) as product, i}
                  {@const originalIndex = pricingProducts.findIndex(p => p === product)}
                  {@const xPos = 80 + (product.baseArea - graphMinArea) / (graphMaxArea - graphMinArea || 1) * 1040}
                  {@const yPos = 390 - ((product.pricePerSqm - graphMinSqm) / (graphMaxSqm - graphMinSqm || 1)) * 315}
                  {@const isDragging = draggingPointIndex === originalIndex}
                  {@const isSelected = selectedGraphPoint === originalIndex}
                  <text x={xPos} y="420" fill="#c0caf5" font-size="13" text-anchor="middle" font-weight="600" transform="rotate(-35, {xPos}, 420)">
                    {product.baseArea.toFixed(0)}m²
                  </text>
                  <g 
                    class="graph-point" 
                    class:draggable={editingPricing}
                    class:dragging={isDragging}
                    class:selected={isSelected}
                    onmousedown={(e) => selectAndDragPoint(e, originalIndex)}
                    onclick={() => selectPoint(originalIndex)}
                    onkeydown={(e) => e.key === 'Enter' && selectPoint(originalIndex)}
                    role="button"
                    tabindex="0"
                  >
                    <circle 
                      cx={xPos} 
                      cy={yPos} 
                      r={isDragging || isSelected ? 12 : 8} 
                      fill={product.pricePerSqm > 1500 ? '#f7768e' : product.pricePerSqm > 1000 ? '#e0af68' : '#9ece6a'}
                      stroke={isDragging || isSelected ? '#fff' : '#1a1b26'}
                      stroke-width={isDragging || isSelected ? 3 : 2}
                      style="transition: r 0.1s, stroke-width 0.1s"
                    />
                    <text x={xPos} y={yPos - 20} fill="#c0caf5" font-size="13" text-anchor="middle" font-weight="600">
                      {product.productName || `${product.frontage}x${product.depth}`}
                    </text>
                    <text x={xPos} y={yPos + 30} fill="#7aa2f7" font-size="13" text-anchor="middle" font-weight="700">
                      ${product.pricePerSqm.toFixed(0)}/m²
                    </text>
                  </g>
                {/each}
                
                <text x="600" y="465" fill="#c0caf5" font-size="15" text-anchor="middle" font-weight="600">Area (m²)</text>
                <text x="30" y="210" fill="#c0caf5" font-size="15" text-anchor="middle" font-weight="600" transform="rotate(-90, 30, 210)">$/m²</text>
              </svg>
            </div>
            <div class="graph-legend">
              <span class="legend-item"><span class="dot" style="background:#7aa2f7"></span> Actual $/m²</span>
              <span class="legend-item"><span class="dot" style="background:#bb9af7"></span> Trend Line</span>
              {#if trendLine}
                <span class="legend-item trend-info">
                  {trendLine.slope < 0 ? '📉' : '📈'} {Math.abs(trendLine.slope).toFixed(2)} $/m² per m²
                </span>
              {/if}
              {#if editingPricing && trendLine}
                <button class="btn-apply-trend" onclick={applyTrendToAllProducts}>
                  📐 Fill Empty from Trend
                </button>
              {/if}
            </div>
            {#if !editingPricing && pricingProducts.some(p => p.basePrice > 0)}
              {#if masterplanCount > 0}
                <div class="graph-apply-all">
                  <button class="btn-apply-all-pricing" onclick={onApplyToMasterplan}>
                    💰 Update All {masterplanCount} Masterplan Lots with Pricing
                  </button>
                </div>
              {/if}
            {/if}
            <p class="graph-note">{#if editingPricing}Set 2+ prices, then use "Fill Empty from Trend" to auto-fill remaining products{:else}Click Edit to adjust prices by dragging points{/if}</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .pricing-section {
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
  
  .pricing-content {
    padding: 12px;
    background: var(--input-bg);
  }
  
  .pricing-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  
  .pricing-desc {
    margin: 0;
    font-size: 11px;
    color: var(--text-muted);
    max-width: 60%;
  }
  
  .pricing-actions {
    display: flex;
    gap: 6px;
  }
  
  .pricing-table-wrapper {
    overflow-x: auto;
    margin-bottom: 12px;
  }
  
  .pricing-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  
  .pricing-table th,
  .pricing-table td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }
  
  .pricing-table th {
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-weight: 500;
    font-size: 10px;
    text-transform: uppercase;
  }
  
  .pricing-input {
    width: 100%;
    padding: 4px 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 11px;
  }
  
  .pricing-input.name { min-width: 80px; }
  .pricing-input.price { min-width: 80px; }
  .pricing-input.rate { width: 50px; }
  
  .product-name {
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .price-value {
    color: var(--accent-success);
    font-weight: 500;
  }
  
  .area-cell {
    color: var(--text-muted);
  }
  
  .sqm-value {
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 500;
  }
  
  .sqm-value.high { background: rgba(247, 118, 142, 0.2); color: var(--accent-error); }
  .sqm-value.medium { background: rgba(224, 175, 104, 0.2); color: var(--accent-warning); }
  .sqm-value.low { background: rgba(158, 206, 106, 0.2); color: var(--accent-success); }
  
  .btn-remove {
    padding: 2px 6px;
    background: transparent;
    border: 1px solid var(--accent-error);
    border-radius: 3px;
    color: var(--accent-error);
    cursor: pointer;
  }
  
  .btn-add-product {
    padding: 6px 12px;
    background: transparent;
    border: 1px dashed var(--border-color);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    width: 100%;
    margin-bottom: 12px;
  }
  
  .btn-add-product:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  
  .pricing-legend {
    display: flex;
    gap: 16px;
    font-size: 10px;
    color: var(--text-muted);
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  
  .dot.high { background: var(--accent-error); }
  .dot.medium { background: var(--accent-warning); }
  .dot.low { background: var(--accent-success); }
  
  .btn-edit, .btn-save, .btn-cancel {
    padding: 4px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
  }
  
  .btn-edit {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
  }
  
  .btn-save {
    background: var(--accent-success);
    border: none;
    color: var(--bg-primary);
  }
  
  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
  }

  .pricing-info {
    margin: 12px 0;
    padding: 10px;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-size: 11px;
  }

  .pricing-info h4 {
    margin: 0 0 6px 0;
    font-size: 12px;
    color: var(--text-primary);
  }

  .pricing-info ul {
    margin: 0;
    padding-left: 16px;
    color: var(--text-muted);
  }

  .pricing-info li {
    margin-bottom: 3px;
  }

  /* Pricing Graph Styles */
  .pricing-graph-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #3b4261;
  }

  .pricing-graph-section h4 {
    margin: 0 0 12px 0;
    color: #7aa2f7;
    font-size: 13px;
  }

  .pricing-graph-container {
    background: var(--bg-primary);
    border-radius: 6px;
    padding: 10px;
    border: 1px solid var(--border-color);
  }

  .pricing-graph {
    width: 100%;
    height: auto;
    max-height: 380px;
  }

  .graph-point {
    transition: transform 0.15s ease;
  }

  .graph-point:hover circle {
    r: 10;
    filter: brightness(1.2);
  }

  .graph-note {
    margin: 8px 0 0 0;
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }

  .graph-edit-hint {
    font-size: 11px;
    color: #bb9af7;
    font-weight: normal;
  }

  .pricing-graph.editing {
    cursor: crosshair;
  }

  .graph-point.draggable {
    cursor: ns-resize;
  }

  .graph-point.draggable:hover circle {
    r: 10;
    filter: brightness(1.3);
  }

  .graph-point.dragging circle,
  .graph-point.selected circle {
    filter: drop-shadow(0 0 8px rgba(255,255,255,0.5));
  }

  .pricing-graph:focus {
    outline: 2px solid #7aa2f7;
    outline-offset: 2px;
  }

  .pricing-graph-section.full-width {
    margin: 0 -12px;
    padding: 0 12px;
  }

  .graph-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .graph-header h4 {
    margin: 0;
  }

  .graph-actions {
    display: flex;
    gap: 8px;
  }

  .btn-graph-edit,
  .btn-graph-save,
  .btn-graph-cancel {
    padding: 6px 14px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
    font-weight: 500;
  }

  .btn-graph-edit {
    background: linear-gradient(135deg, #2d3a4f 0%, #1d2a3f 100%);
    border: 1px solid #7aa2f7;
    color: #7aa2f7;
  }

  .btn-graph-edit:hover {
    background: linear-gradient(135deg, #3d4a5f 0%, #2d3a4f 100%);
    box-shadow: 0 0 8px rgba(122, 162, 247, 0.3);
  }

  .btn-graph-save {
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
  }

  .btn-graph-save:hover {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 8px rgba(158, 206, 106, 0.3);
  }

  .btn-graph-cancel {
    background: linear-gradient(135deg, #3d2d2d 0%, #2d1d1d 100%);
    border: 1px solid #f7768e;
    color: #f7768e;
  }

  .btn-graph-cancel:hover {
    background: linear-gradient(135deg, #4d3d3d 0%, #3d2d2d 100%);
    box-shadow: 0 0 8px rgba(247, 118, 142, 0.3);
  }

  .graph-legend {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
    flex-wrap: wrap;
  }

  .trend-info {
    color: #bb9af7;
    font-weight: 500;
  }

  .btn-apply-trend {
    padding: 4px 10px;
    background: linear-gradient(135deg, #2d2d4a 0%, #1d1d3a 100%);
    border: 1px solid #bb9af7;
    border-radius: 4px;
    color: #bb9af7;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
  }

  .btn-apply-trend:hover {
    box-shadow: 0 0 8px rgba(187, 154, 247, 0.3);
  }

  .graph-apply-all {
    margin-top: 10px;
  }

  .btn-apply-all-pricing {
    width: 100%;
    padding: 10px;
    font-size: 13px;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    border-radius: 6px;
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
  }

  .btn-apply-all-pricing:hover {
    box-shadow: 0 0 12px rgba(158, 206, 106, 0.4);
  }
</style>
