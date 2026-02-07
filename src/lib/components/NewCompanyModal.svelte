<script lang="ts">
  // NewCompanyModal Component - Modal for creating a new company group
  
  let {
    show,
    onCreate,
    onClose
  }: {
    show: boolean;
    onCreate: (name: string, abn: string | null) => Promise<void>;
    onClose: () => void;
  } = $props();
  
  // Local state
  let companyName = $state('');
  let companyAbn = $state('');
  let creating = $state(false);
  
  async function handleCreate() {
    if (!companyName.trim()) return;
    
    creating = true;
    try {
      await onCreate(companyName.trim(), companyAbn.trim() || null);
      // Reset form on success
      companyName = '';
      companyAbn = '';
    } finally {
      creating = false;
    }
  }
  
  function handleClose() {
    if (!creating) {
      companyName = '';
      companyAbn = '';
      onClose();
    }
  }
</script>

{#if show}
  <div class="modal-overlay" role="presentation" onclick={(e) => e.target === e.currentTarget && handleClose()}>
    <div class="modal new-company-modal" role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>🏢 Create New Company Group</span>
        <button class="btn-cancel" onclick={handleClose}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="companyName">Company Name *</label>
          <input 
            type="text" 
            id="companyName" 
            bind:value={companyName} 
            placeholder="Enter company name"
            onkeydown={(e) => e.key === 'Enter' && handleCreate()}
            disabled={creating}
          />
        </div>
        <div class="form-group">
          <label for="companyAbn">ABN (optional)</label>
          <input 
            type="text" 
            id="companyAbn" 
            bind:value={companyAbn} 
            placeholder="Enter ABN"
            onkeydown={(e) => e.key === 'Enter' && handleCreate()}
            disabled={creating}
          />
        </div>
        <p class="form-hint">You will automatically become the Admin of this company group and can invite others.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick={handleClose} disabled={creating}>Cancel</button>
        <button class="btn-primary" onclick={handleCreate} disabled={creating || !companyName.trim()}>
          {creating ? 'Creating...' : 'Create Company'}
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
    max-width: 450px;
    width: 90%;
    max-height: 90vh;
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
  }
  
  .modal-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  
  .form-group {
    margin-bottom: 16px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 6px;
    color: var(--text-secondary);
    font-size: 12px;
  }
  
  .form-group input {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 13px;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--accent-primary);
  }
  
  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .form-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
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
  
  .btn-cancel:hover:not(:disabled) {
    background: var(--bg-tertiary);
    border-color: var(--accent-warning);
  }
  
  .btn-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-primary {
    padding: 8px 16px;
    background: var(--accent-primary);
    border: none;
    border-radius: 4px;
    color: var(--bg-primary);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
