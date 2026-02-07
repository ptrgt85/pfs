<script lang="ts">
  // PropertiesPanel Component - Collapsible properties section for selected entity
  
  interface TreeNode {
    id: number;
    name: string;
    type: string;
    parentId: number | null;
    children?: TreeNode[];
    expanded?: boolean;
    loading?: boolean;
  }
  
  interface FieldDefinition {
    key: string;
    label: string;
  }
  
  interface Props {
    selectedNode: TreeNode | null;
    entityDetails: any;
    entityFields: Record<string, FieldDefinition[]>;
    typeLabels: Record<string, string>;
    collapsed: boolean;
    hasPermission: (action: 'canView' | 'canEdit' | 'canDelete' | 'canInvite' | 'canManageRoles') => boolean;
    onToggleCollapsed: () => void;
    onSave: (field: string, value: string | null) => Promise<void>;
  }
  
  let {
    selectedNode,
    entityDetails,
    entityFields,
    typeLabels,
    collapsed,
    hasPermission,
    onToggleCollapsed,
    onSave
  }: Props = $props();
  
  // Local state
  let editingProperty: string | null = $state(null);
  let propertyEditValue: string = $state('');
  let savingProperty = $state(false);
  
  function startPropertyEdit(key: string) {
    editingProperty = key;
    // Handle date fields - convert ISO date to YYYY-MM-DD for date input
    if ((key === 'registrationDate' || key === 'settlementDate') && entityDetails?.[key]) {
      const date = new Date(entityDetails[key]);
      propertyEditValue = date.toISOString().split('T')[0];
    } else {
      propertyEditValue = entityDetails?.[key] || '';
    }
  }
  
  function cancelPropertyEdit() {
    editingProperty = null;
    propertyEditValue = '';
  }
  
  async function savePropertyEdit() {
    if (!selectedNode || !editingProperty || savingProperty) return;
    savingProperty = true;
    
    // Handle date fields - convert to ISO timestamp
    let valueToSave: string | null = propertyEditValue;
    if (editingProperty === 'registrationDate' || editingProperty === 'settlementDate') {
      valueToSave = propertyEditValue ? new Date(propertyEditValue).toISOString() : null;
    }
    
    try {
      await onSave(editingProperty, valueToSave);
    } finally {
      savingProperty = false;
      editingProperty = null;
      propertyEditValue = '';
    }
  }
</script>

{#if entityDetails && selectedNode}
  <div class="properties-section">
    <div class="panel-header collapsible" onclick={onToggleCollapsed} onkeydown={(e) => e.key === 'Enter' && onToggleCollapsed()} role="button" tabindex="0">
      <span>├─ {collapsed ? '▶' : '▼'} {typeLabels[selectedNode.type] || selectedNode.type} Properties</span>
    </div>
    {#if !collapsed}
      <div class="properties-grid">
        {#each entityFields[selectedNode.type] || [] as field}
          <div class="property-row">
            <span class="property-label">{field.label}:</span>
            {#if editingProperty === field.key}
              <input type="text" class="property-input" bind:value={propertyEditValue} />
              <button class="btn-save" onclick={savePropertyEdit} disabled={savingProperty}>
                {savingProperty ? 'Saving...' : 'Save'}
              </button>
              <button class="btn-cancel" onclick={cancelPropertyEdit} disabled={savingProperty}>Cancel</button>
            {:else}
              <span class="property-value">{entityDetails[field.key] || '-'}</span>
              {#if hasPermission('canEdit')}
                <button class="btn-edit" onclick={() => startPropertyEdit(field.key)}>Edit</button>
              {/if}
            {/if}
          </div>
        {/each}
        
        {#if selectedNode.type === 'stage'}
          <div class="property-row stage-date-row">
            <span class="property-label">Registration Date:</span>
            {#if editingProperty === 'registrationDate'}
              <input type="date" class="property-input date-input" bind:value={propertyEditValue} />
              <button class="btn-save" onclick={savePropertyEdit} disabled={savingProperty}>
                {savingProperty ? 'Saving...' : 'Save'}
              </button>
              <button class="btn-cancel" onclick={cancelPropertyEdit} disabled={savingProperty}>Cancel</button>
            {:else}
              <span class="property-value date-value registration">
                {entityDetails.registrationDate ? new Date(entityDetails.registrationDate).toLocaleDateString() : '-'}
              </span>
              {#if hasPermission('canEdit')}
                <button class="btn-edit" onclick={() => startPropertyEdit('registrationDate')}>Edit</button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .properties-section {
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
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
  
  .properties-grid {
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--input-bg);
    max-height: 250px;
    overflow-y: auto;
  }
  
  .property-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .property-label {
    color: var(--accent-primary);
    width: 110px;
    flex-shrink: 0;
    font-size: 11px;
    white-space: nowrap;
  }
  
  .property-value {
    color: var(--accent-success);
    flex: 1;
    min-width: 100px;
    font-size: 12px;
  }
  
  .property-value.date-value.registration {
    color: var(--accent-warning);
    font-weight: 500;
  }
  
  .property-input {
    flex: 1;
    padding: 4px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 12px;
  }
  
  .property-input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }
  
  .date-input {
    max-width: 150px;
  }
  
  .btn-edit, .btn-save, .btn-cancel {
    padding: 4px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .btn-edit {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
  }
  
  .btn-edit:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  
  .btn-save {
    background: var(--accent-success);
    border: none;
    color: var(--bg-primary);
    font-weight: 600;
  }
  
  .btn-save:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
  }
  
  .btn-cancel:hover:not(:disabled) {
    border-color: var(--accent-warning);
    color: var(--accent-warning);
  }
  
  .btn-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
