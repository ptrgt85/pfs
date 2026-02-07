<script lang="ts">
  // FieldsManagerModal Component - Modal for managing custom fields
  
  interface CustomField {
    id: number;
    entityType: string;
    fieldKey: string;
    fieldLabel: string;
    fieldType: string;
    fieldFormat?: string;
    isActive: number;
  }
  
  interface FieldItem {
    key: string;
    label: string;
    type: string;
    format: string;
    isDefault: boolean;
    id: number | undefined;
  }
  
  let {
    show,
    entityType,
    customFields,
    hiddenFields,
    fieldOrder,
    onFieldAdded,
    onFieldRemoved,
    onVisibilityToggled,
    onFieldOrderChanged,
    onClose
  }: {
    show: boolean;
    entityType: string;
    customFields: CustomField[];
    hiddenFields: Set<string>;
    fieldOrder: string[];
    onFieldAdded: (label: string, type: string, format: string) => Promise<void>;
    onFieldRemoved: (id: number, label: string) => Promise<void>;
    onVisibilityToggled: (key: string) => void;
    onFieldOrderChanged: (newOrder: string[]) => void;
    onClose: () => void;
  } = $props();
  
  // Local state
  let newFieldLabel = $state('');
  let newFieldType = $state('text');
  let newFieldFormat = $state('');
  let draggingField: string | null = $state(null);
  
  const numberFormatOptions = [
    { value: '', label: 'Plain' },
    { value: '$', label: '$ (Currency)' },
    { value: 'sqm', label: 'sqm (Square Meters)' },
    { value: 'm', label: 'm (Meters)' }
  ];
  
  // Compute all fields list
  const allFieldsList = $derived((() => {
    const defaultFields = entityType === 'lot'
      ? [
          { key: 'lotNumber', label: 'Lot #', type: 'text', format: '', isDefault: true, id: undefined as number | undefined },
          { key: 'area', label: 'Area', type: 'number', format: 'sqm', isDefault: true, id: undefined as number | undefined },
          { key: 'frontage', label: 'Frontage', type: 'number', format: 'm', isDefault: true, id: undefined as number | undefined },
          { key: 'depth', label: 'Depth', type: 'number', format: 'm', isDefault: true, id: undefined as number | undefined },
          { key: 'streetName', label: 'Street', type: 'text', format: '', isDefault: true, id: undefined as number | undefined },
          { key: 'status', label: 'Status', type: 'status', format: '', isDefault: true, id: undefined as number | undefined }
        ]
      : [
          { key: 'name', label: 'Name', type: 'text', format: '', isDefault: true, id: undefined as number | undefined },
          { key: 'description', label: 'Description', type: 'text', format: '', isDefault: true, id: undefined as number | undefined }
        ];
    
    const customFieldsList = customFields.map(f => ({
      key: f.fieldKey,
      label: f.fieldLabel,
      type: f.fieldType,
      format: f.fieldFormat || '',
      isDefault: false,
      id: f.id
    }));
    
    const allFields = [...defaultFields, ...customFieldsList];
    
    // Sort by fieldOrder
    return allFields.sort((a, b) => {
      const aIndex = fieldOrder.indexOf(a.key);
      const bIndex = fieldOrder.indexOf(b.key);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  })());
  
  async function handleAddField() {
    if (!newFieldLabel.trim()) return;
    await onFieldAdded(newFieldLabel.trim(), newFieldType, newFieldFormat);
    newFieldLabel = '';
    newFieldFormat = '';
  }
  
  function handleDragStart(e: DragEvent, fieldKey: string) {
    draggingField = fieldKey;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }
  
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }
  
  function handleDrop(e: DragEvent, targetFieldKey: string) {
    e.preventDefault();
    if (!draggingField || draggingField === targetFieldKey) return;
    
    const currentOrder = [...fieldOrder];
    const fromIndex = currentOrder.indexOf(draggingField);
    const toIndex = currentOrder.indexOf(targetFieldKey);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      currentOrder.splice(fromIndex, 1);
      currentOrder.splice(toIndex, 0, draggingField);
      onFieldOrderChanged(currentOrder);
    }
    draggingField = null;
  }
  
  function handleDragEnd() {
    draggingField = null;
  }
</script>

{#if show}
  <div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && onClose()} role="presentation">
    <div class="modal fields-modal" role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>⚙ Manage Fields - {entityType?.toUpperCase() || 'Entity'}s</span>
        <button class="btn-cancel" onclick={onClose}>✕</button>
      </div>
      <div class="modal-body">
        <div class="fields-section">
          <h4>Add New Field</h4>
          <div class="add-field-row">
            <input type="text" bind:value={newFieldLabel} placeholder="Field name (e.g. Price)" />
            <select bind:value={newFieldType}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="status">Status</option>
            </select>
            {#if newFieldType === 'number'}
              <select bind:value={newFieldFormat} class="format-select">
                {#each numberFormatOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            {/if}
            <button class="btn-save" onclick={handleAddField} disabled={!newFieldLabel.trim()}>+ Add</button>
          </div>
          <p class="field-note">New fields will appear across all {entityType || 'entity'}s of this type</p>
        </div>
        
        <div class="fields-section">
          <h4>All Fields <span class="field-hint">(drag to reorder)</span></h4>
          <div class="fields-list">
            {#each allFieldsList as field}
              <div 
                class="field-item" 
                class:field-hidden={hiddenFields.has(field.key)}
                class:field-dragging={draggingField === field.key}
                draggable="true"
                ondragstart={(e) => handleDragStart(e, field.key)}
                ondragover={handleDragOver}
                ondrop={(e) => handleDrop(e, field.key)}
                ondragend={handleDragEnd}
                role="listitem"
              >
                <span class="drag-handle">⋮⋮</span>
                <span class="field-label">{field.label}</span>
                <span class="field-type">
                  ({field.type}{field.format ? `, ${field.format}` : ''})
                  {#if field.isDefault}<span class="default-badge">default</span>{/if}
                </span>
                <div class="field-actions">
                  <button 
                    class="btn-toggle" 
                    class:hidden={hiddenFields.has(field.key)}
                    onclick={() => onVisibilityToggled(field.key)}
                    title={hiddenFields.has(field.key) ? 'Show field' : 'Hide field'}
                  >
                    {hiddenFields.has(field.key) ? '👁️‍🗨️' : '👁️'}
                  </button>
                  {#if !field.isDefault && field.id !== undefined}
                    <button class="btn-delete" onclick={() => field.id !== undefined && onFieldRemoved(field.id, field.label)} title="Remove field">✕</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick={onClose}>Close</button>
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
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
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
  
  .modal-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  
  .fields-section {
    margin-bottom: 20px;
  }
  
  .fields-section h4 {
    margin: 0 0 12px 0;
    color: var(--text-primary);
    font-size: 13px;
  }
  
  .field-hint {
    font-weight: normal;
    color: var(--text-muted);
    font-size: 11px;
  }
  
  .add-field-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .add-field-row input {
    flex: 1;
    min-width: 120px;
    padding: 6px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 12px;
  }
  
  .add-field-row select {
    padding: 6px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 12px;
  }
  
  .format-select {
    min-width: 100px;
  }
  
  .field-note {
    font-size: 11px;
    color: var(--text-muted);
    margin: 8px 0 0 0;
  }
  
  .fields-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .field-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: grab;
    transition: all 0.15s;
  }
  
  .field-item:hover {
    border-color: var(--accent-primary);
  }
  
  .field-item.field-hidden {
    opacity: 0.5;
    background: var(--bg-tertiary);
  }
  
  .field-item.field-dragging {
    opacity: 0.5;
    border-style: dashed;
  }
  
  .drag-handle {
    color: var(--text-muted);
    font-size: 12px;
    cursor: grab;
  }
  
  .field-label {
    flex: 1;
    color: var(--text-primary);
    font-size: 12px;
  }
  
  .field-type {
    color: var(--text-muted);
    font-size: 10px;
  }
  
  .default-badge {
    background: rgba(122, 162, 247, 0.2);
    color: var(--accent-primary);
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 9px;
    margin-left: 4px;
  }
  
  .field-actions {
    display: flex;
    gap: 4px;
  }
  
  .btn-toggle, .btn-delete {
    padding: 4px 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 12px;
    opacity: 0.7;
    transition: opacity 0.15s;
  }
  
  .btn-toggle:hover, .btn-delete:hover {
    opacity: 1;
  }
  
  .btn-toggle.hidden {
    opacity: 0.4;
  }
  
  .btn-delete {
    color: var(--accent-error);
  }
  
  .btn-save {
    padding: 6px 12px;
    background: var(--accent-success);
    border: none;
    border-radius: 4px;
    color: var(--bg-primary);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  
  .btn-save:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-cancel {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .btn-cancel:hover {
    background: var(--bg-tertiary);
  }
</style>
