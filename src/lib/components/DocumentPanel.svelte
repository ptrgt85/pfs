<script lang="ts">
  // DocumentPanel Component - Document upload, list, and viewer
  
  interface TreeNode {
    id: number;
    name: string;
    type: string;
    parentId: number | null;
  }
  
  interface Document {
    id: number;
    originalName: string;
    documentType: string;
    mimeType: string;
    size: number;
    path: string;
  }
  
  let {
    selectedNode,
    documents,
    tableDataLength,
    extractingDocId,
    selectedModel,
    hasPermission,
    onUpload,
    onDelete,
    onExtract,
    onReanalyze,
    onAnalyzePOS,
    onCrossReference,
    onOpenPreExtraction,
    onPreview,
    onView,
    inlineDocumentId,
    onModelChange
  }: {
    selectedNode: TreeNode | null;
    documents: Document[];
    tableDataLength: number;
    extractingDocId: number | null;
    selectedModel: string;
    hasPermission: (action: 'canView' | 'canEdit' | 'canDelete' | 'canInvite' | 'canManageRoles') => boolean;
    onUpload: (file: File, documentType: string) => Promise<void>;
    onDelete: (docId: number) => Promise<void>;
    onExtract: (docId: number) => void;
    onReanalyze: (docId: number) => void;
    onAnalyzePOS: (docId: number) => void;
    onCrossReference: (docId: number) => void;
    onOpenPreExtraction: (docId: number) => void;
    onPreview: (doc: Document) => void;
    onView: (doc: Document) => void;
    inlineDocumentId: number | null;
    onModelChange: (model: string) => void;
  } = $props();
  
  // Local state
  let showDocuments = $state(false);
  let uploading = $state(false);
  let uploadDocumentType = $state('other');
  
  const documentTypeOptions = [
    { id: 'permit_plan', name: '📋 Permit Plan' },
    { id: 'plan_subdivision', name: '📊 Plan of Subdivision' },
    { id: 'contract', name: '📄 Contract' },
    { id: 'other', name: '📎 Other' }
  ];
  
  const modelOptions = [
    { id: 'gemini', name: 'Gemini 2.0' },
    { id: 'gpt4o', name: 'GPT-4o' },
    { id: 'claude', name: 'Claude 3.5' }
  ];
  
  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    uploading = true;
    try {
      await onUpload(input.files[0], uploadDocumentType);
      input.value = '';
    } finally {
      uploading = false;
    }
  }
  
  function toggleDocuments() {
    showDocuments = !showDocuments;
  }
</script>

<div class="documents-section">
  <div class="panel-header collapsible" onclick={toggleDocuments} onkeydown={(e) => e.key === 'Enter' && toggleDocuments()} role="button" tabindex="0">
    <span>├─ {showDocuments ? '▼' : '▶'} Documents ({documents.length})</span>
  </div>
  {#if showDocuments}
    <div class="documents-content">
      {#if hasPermission('canEdit')}
        <div class="upload-row">
          <select 
            class="doc-type-selector" 
            bind:value={uploadDocumentType}
            title="Document type"
          >
            {#each documentTypeOptions as docType}
              <option value={docType.id}>{docType.name}</option>
            {/each}
          </select>
          <input type="file" id="doc-upload" accept="image/*,.pdf" onchange={handleFileUpload} disabled={uploading} />
          <label for="doc-upload" class="upload-label">{uploading ? 'Uploading...' : '+ Upload'}</label>
        </div>
      {/if}
      
      {#if documents.length > 0}
        <div class="doc-list">
          {#each documents as doc}
            <div class="doc-item">
              <button class="doc-name" onclick={() => onPreview(doc)}>{doc.originalName}</button>
              <span class="doc-type-badge {doc.documentType || 'other'}">
                {doc.documentType === 'permit_plan' ? 'PP' : doc.documentType === 'plan_subdivision' ? 'PS' : ''}
              </span>
              <span class="doc-size">{(doc.size / 1024).toFixed(1)}KB</span>
              
              {#if doc.mimeType?.startsWith('image/') || doc.mimeType === 'application/pdf'}
                <button class="btn-view-inline" onclick={() => onView(doc)}>
                  {inlineDocumentId === doc.id ? '✓ Viewing' : '👁 View'}
                </button>
              {/if}
              
              {#if selectedNode?.type === 'stage'}
                {#if doc.documentType === 'plan_subdivision'}
                  <select 
                    class="model-selector-small" 
                    value={selectedModel}
                    onchange={(e) => onModelChange((e.target as HTMLSelectElement).value)}
                    title="Choose AI model"
                  >
                    {#each modelOptions as model}
                      <option value={model.id}>{model.name}</option>
                    {/each}
                  </select>
                  <button class="btn-pos-analyze" onclick={() => onAnalyzePOS(doc.id)} disabled={extractingDocId !== null}>
                    {extractingDocId === doc.id ? 'Analyzing...' : '📊 Analyze POS'}
                  </button>
                {:else if tableDataLength === 0}
                  <button class="btn-extract" onclick={() => onExtract(doc.id)} disabled={extractingDocId !== null}>
                    {extractingDocId === doc.id ? 'Extracting...' : '🤖 Extract'}
                  </button>
                {:else}
                  <button class="btn-reanalyze" onclick={() => onReanalyze(doc.id)} disabled={extractingDocId !== null}>
                    {extractingDocId === doc.id ? 'Analyzing...' : '🔄 Re-analyze'}
                  </button>
                {/if}
              {/if}
              
              {#if selectedNode?.type === 'precinct'}
                <select 
                  class="model-selector-small" 
                  value={selectedModel}
                  onchange={(e) => onModelChange((e.target as HTMLSelectElement).value)}
                  title="Choose AI model"
                >
                  {#each modelOptions as model}
                    <option value={model.id}>{model.name}</option>
                  {/each}
                </select>
                {#if doc.documentType === 'permit_plan'}
                  <button class="btn-permit" onclick={() => onOpenPreExtraction(doc.id)} disabled={extractingDocId !== null}>
                    {extractingDocId === doc.id ? 'Analyzing...' : '📋 Extract'}
                  </button>
                {:else if doc.documentType === 'plan_subdivision'}
                  <button class="btn-crossref" onclick={() => onCrossReference(doc.id)} disabled={extractingDocId !== null}>
                    {extractingDocId === doc.id ? 'Comparing...' : '🔗 Cross-Ref'}
                  </button>
                {:else}
                  <button class="btn-permit" onclick={() => onOpenPreExtraction(doc.id)} disabled={extractingDocId !== null}>
                    {extractingDocId === doc.id ? 'Analyzing...' : '📋 Analyze'}
                  </button>
                {/if}
              {/if}
              
              {#if hasPermission('canDelete')}
                <button class="btn-delete" onclick={() => onDelete(doc.id)}>Del</button>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-msg">No documents uploaded</div>
      {/if}
    </div>
  {/if}
</div>


<style>
  .documents-section {
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
  
  .documents-content {
    padding: 8px 12px;
    background: var(--input-bg);
  }
  
  .upload-row {
    margin-bottom: 8px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  
  .upload-row input[type="file"] {
    display: none;
  }
  
  .doc-type-selector {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  
  .upload-label {
    padding: 4px 12px;
    background: var(--accent-primary);
    border-radius: 4px;
    color: var(--bg-primary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  
  .upload-label:hover {
    opacity: 0.9;
  }
  
  .doc-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .doc-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--bg-primary);
    border-radius: 4px;
    font-size: 11px;
  }
  
  .doc-name {
    flex: 1;
    background: none;
    border: none;
    color: var(--accent-primary);
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    padding: 0;
  }
  
  .doc-name:hover {
    text-decoration: underline;
  }
  
  .doc-type-badge {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 2px;
    font-weight: 600;
  }
  
  .doc-type-badge.permit_plan {
    background: rgba(122, 162, 247, 0.2);
    color: var(--accent-primary);
  }
  
  .doc-type-badge.plan_subdivision {
    background: rgba(158, 206, 106, 0.2);
    color: var(--accent-success);
  }
  
  .doc-size {
    color: var(--text-muted);
    font-size: 10px;
  }
  
  .model-selector-small {
    padding: 2px 4px;
    font-size: 9px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-secondary);
  }
  
  .btn-view-inline, .btn-extract, .btn-reanalyze, .btn-pos-analyze, .btn-permit, .btn-crossref, .btn-delete {
    padding: 2px 6px;
    border-radius: 3px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid transparent;
  }
  
  .btn-view-inline {
    background: var(--bg-secondary);
    border-color: var(--border-color);
    color: var(--text-secondary);
  }
  
  .btn-extract, .btn-permit {
    background: rgba(122, 162, 247, 0.2);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  
  .btn-reanalyze {
    background: rgba(224, 175, 104, 0.2);
    border-color: var(--accent-warning);
    color: var(--accent-warning);
  }
  
  .btn-pos-analyze {
    background: rgba(158, 206, 106, 0.2);
    border-color: var(--accent-success);
    color: var(--accent-success);
  }
  
  .btn-crossref {
    background: rgba(187, 154, 247, 0.2);
    border-color: var(--accent-secondary);
    color: var(--accent-secondary);
  }
  
  .btn-delete {
    background: rgba(247, 118, 142, 0.1);
    border-color: var(--accent-error);
    color: var(--accent-error);
  }
  
  .btn-delete:hover {
    background: var(--accent-error);
    color: var(--bg-primary);
  }
  
  .empty-msg {
    color: var(--text-muted);
    font-size: 11px;
    font-style: italic;
  }
  
</style>
