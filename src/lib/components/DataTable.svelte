<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  type Column = {
    key: string;
    label: string;
    editable?: boolean;
    sortable?: boolean;
    width?: number;
  };
  
  export let columns: Column[] = [];
  export let data: any[] = [];
  export let onUpdate: (id: number, field: string, value: any) => void = () => {};
  export let onDelete: (id: number) => void = () => {};
  export let onAdd: (data: any) => void = () => {};
  export let onRowClick: (row: any) => void = () => {};
  export let showActions = true;
  
  const dispatch = createEventDispatcher();
  
  let sortColumn = '';
  let sortDirection: 'asc' | 'desc' = 'asc';
  let editingRow: number | null = null;
  let editValues: { [key: string]: any } = {};
  let isAddingNew = false;
  let newRowData: { [key: string]: any } = {};
  let columnWidths: { [key: string]: number } = {};
  let resizing: string | null = null;
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  
  $: {
    columns.forEach(col => {
      if (col.width && !columnWidths[col.key]) {
        columnWidths[col.key] = col.width;
      }
    });
  }
  
  $: sortedData = sortData(data, sortColumn, sortDirection);
  
  function sortData(items: any[], column: string, direction: 'asc' | 'desc') {
    if (!column) return items;
    
    return [...items].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const comparison = aVal < bVal ? -1 : 1;
      return direction === 'asc' ? comparison : -comparison;
    });
  }
  
  function handleSort(column: string) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }
  
  function startEdit(rowId: number, row: any) {
    editingRow = rowId;
    editValues = { ...row };
  }
  
  function saveEdit(rowId: number) {
    columns.forEach(col => {
      if (col.editable && editValues[col.key] !== undefined) {
        onUpdate(rowId, col.key, editValues[col.key]);
      }
    });
    editingRow = null;
    editValues = {};
  }
  
  function cancelEdit() {
    editingRow = null;
    editValues = {};
  }
  
  function startAddNew() {
    isAddingNew = true;
    newRowData = {};
    columns.forEach(col => {
      if (col.key !== 'id') {
        newRowData[col.key] = '';
      }
    });
  }
  
  function confirmAdd() {
    onAdd(newRowData);
    isAddingNew = false;
    newRowData = {};
  }
  
  function cancelAdd() {
    isAddingNew = false;
    newRowData = {};
  }
  
  function startResize(e: MouseEvent, columnKey: string) {
    resizing = columnKey;
    resizeStartX = e.clientX;
    resizeStartWidth = columnWidths[columnKey] || 150;
    
    e.preventDefault();
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (resizing) {
      const diff = e.clientX - resizeStartX;
      columnWidths[resizing] = Math.max(50, resizeStartWidth + diff);
    }
  }
  
  function handleMouseUp() {
    resizing = null;
  }
  
  let draggedRow: any = null;
  let dragOverRow: any = null;
  
  function handleDragStart(e: DragEvent, row: any) {
    draggedRow = row;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }
  
  function handleDragOver(e: DragEvent, row: any) {
    e.preventDefault();
    dragOverRow = row;
  }
  
  function handleDrop(e: DragEvent, targetRow: any) {
    e.preventDefault();
    if (draggedRow && targetRow && draggedRow !== targetRow) {
      dispatch('reorder', { from: draggedRow, to: targetRow });
    }
    draggedRow = null;
    dragOverRow = null;
  }
</script>

<svelte:window 
  on:mousemove={handleMouseMove} 
  on:mouseup={handleMouseUp}
/>

<div class="table-container">
  <div class="table-header">
    <button class="btn-add" on:click={startAddNew} disabled={isAddingNew}>[+ ADD NEW]</button>
  </div>
  
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          {#each columns as column}
            <th 
              style="width: {columnWidths[column.key] || 150}px; min-width: {columnWidths[column.key] || 150}px;"
              class:sortable={column.sortable}
            >
              <div class="th-content">
                <span 
                  on:click={() => column.sortable && handleSort(column.key)}
                  on:keydown={(e) => e.key === 'Enter' && column.sortable && handleSort(column.key)}
                  role={column.sortable ? 'button' : undefined}
                  tabindex={column.sortable ? 0 : undefined}
                >
                  {column.label}
                  {#if sortColumn === column.key}
                    <span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </span>
                <div 
                  class="resize-handle"
                  on:mousedown={(e) => startResize(e, column.key)}
                  role="separator"
                  tabindex="-1"
                  aria-label="Resize column"
                ></div>
              </div>
            </th>
          {/each}
          {#if showActions}
            <th style="width: 120px; min-width: 120px;">Actions</th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#if isAddingNew}
          <tr class="new-row">
            {#each columns as column}
              <td style="width: {columnWidths[column.key] || 150}px;">
                {#if column.key === 'id'}
                  <span class="new-label">[NEW]</span>
                {:else}
                  <input
                    type="text"
                    bind:value={newRowData[column.key]}
                    placeholder={column.label}
                  />
                {/if}
              </td>
            {/each}
            {#if showActions}
              <td class="actions">
                <button class="btn-confirm" on:click={confirmAdd}>[OK]</button>
                <button class="btn-cancel" on:click={cancelAdd}>[X]</button>
              </td>
            {/if}
          </tr>
        {/if}
        {#each sortedData as row (row.id)}
          <tr 
            on:click={() => editingRow !== row.id && onRowClick(row)}
            class:drag-over={dragOverRow === row}
            class:editing={editingRow === row.id}
            class:clickable={editingRow !== row.id}
          >
            {#each columns as column}
              <td style="width: {columnWidths[column.key] || 150}px;">
                {#if editingRow === row.id && column.editable}
                  <input
                    type="text"
                    bind:value={editValues[column.key]}
                  />
                {:else}
                  <div class="cell-content">
                    {row[column.key] ?? ''}
                  </div>
                {/if}
              </td>
            {/each}
            {#if showActions}
              <td class="actions">
                {#if editingRow === row.id}
                  <button class="btn-confirm" on:click={() => saveEdit(row.id)}>[OK]</button>
                  <button class="btn-cancel" on:click={cancelEdit}>[X]</button>
                {:else}
                  <button class="btn-edit" on:click={() => startEdit(row.id, row)}>[EDIT]</button>
                  <button class="btn-delete" on:click={() => onDelete(row.id)}>[DEL]</button>
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .table-container {
    width: 100%;
    border: 1px solid #333;
    background: #000;
  }
  
  .table-header {
    padding: 10px 16px;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: flex-end;
    background: #000;
  }
  
  .table-wrapper {
    overflow-x: auto;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  
  thead {
    background: #000;
    position: sticky;
    top: 0;
    z-index: 10;
    color: #888;
    border-bottom: 1px solid #333;
  }
  
  th {
    padding: 0;
    text-align: left;
    font-weight: 400;
    border-right: 1px solid #222;
    position: relative;
    user-select: none;
    color: #888;
  }
  
  th:last-child {
    border-right: none;
  }
  
  .th-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    height: 100%;
  }
  
  .th-content > span {
    flex: 1;
    cursor: default;
  }
  
  .sortable .th-content > span {
    cursor: pointer;
  }
  
  .sortable .th-content > span:hover {
    color: #00ff00;
  }
  
  .sort-indicator {
    margin-left: 4px;
    font-size: 12px;
  }
  
  .resize-handle {
    width: 4px;
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    cursor: col-resize;
    background: transparent;
  }
  
  .resize-handle:hover {
    background: #00ffff;
  }
  
  tbody tr {
    border-bottom: 1px solid #1a1a1a;
    color: #aaa;
  }
  
  tbody tr.clickable {
    cursor: pointer;
  }
  
  tbody tr.clickable:hover {
    background: #111;
    color: #00ff00;
  }
  
  tbody tr.editing {
    background: #0a0a0a;
    border: 1px solid #00ff00;
  }
  
  tbody tr.new-row {
    background: #0a0a0a;
    border: 1px solid #00ffff;
  }
  
  tbody tr:hover {
    background: #0a0a0a;
  }
  
  tbody tr.drag-over {
    border-top: 2px solid #00ffff;
  }
  
  td {
    padding: 10px 12px;
    border-right: 1px solid #222;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  td:last-child {
    border-right: none;
  }
  
  .cell-content {
    width: 100%;
    min-height: 20px;
    padding: 2px 4px;
  }
  
  .new-label {
    color: #00ffff;
    font-weight: bold;
  }
  
  input {
    width: 100%;
    padding: 4px;
    border: 1px solid #00ffff;
    background: #000;
    color: #00ff00;
    font-size: 14px;
  }
  
  input:focus {
    outline: none;
    border-color: #00ffff;
    box-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
  }
  
  .actions {
    text-align: center;
  }
  
  .btn-add {
    padding: 6px 14px;
    background: #000;
    color: #00ff00;
    border: 1px solid #333;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s;
  }
  
  .btn-add:hover:not(:disabled) {
    background: #00ff00;
    color: #000;
  }
  
  .btn-add:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-edit {
    padding: 3px 8px;
    background: #000;
    color: #00ffff;
    border: 1px solid #333;
    cursor: pointer;
    font-size: 10px;
    margin-right: 4px;
    transition: all 0.2s;
  }
  
  .btn-edit:hover {
    background: #00ffff;
    color: #000;
  }
  
  .btn-confirm {
    padding: 3px 8px;
    background: #000;
    color: #00ff00;
    border: 1px solid #333;
    cursor: pointer;
    font-size: 10px;
    margin-right: 4px;
    transition: all 0.2s;
  }
  
  .btn-confirm:hover {
    background: #00ff00;
    color: #000;
  }
  
  .btn-cancel {
    padding: 3px 8px;
    background: #000;
    color: #ffff00;
    border: 1px solid #333;
    cursor: pointer;
    font-size: 10px;
    margin-right: 4px;
    transition: all 0.2s;
  }
  
  .btn-cancel:hover {
    background: #ffff00;
    color: #000;
  }
  
  .btn-delete {
    padding: 3px 8px;
    background: #000;
    color: #ff0000;
    border: 1px solid #333;
    cursor: pointer;
    font-size: 10px;
    transition: all 0.2s;
  }
  
  .btn-delete:hover {
    background: #ff0000;
    color: #000;
  }
</style>
