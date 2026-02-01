<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let data: any[] = [];
  export let selectedId: string | null = null;
  
  const dispatch = createEventDispatcher();
  
  function selectNode(node: any, type: string, nodeId: string) {
    dispatch('select', { node, type });
  }
  
  function getNodeId(type: string, id: number) {
    return `${type}-${id}`;
  }
</script>

<div class="tree-view">
  {#each data as company}
    {@const companyId = getNodeId('company', company.id)}
    <div class="tree-node">
      <div 
        class="node-label company-node"
        class:selected={selectedId === companyId}
        on:click={() => selectNode(company, 'company', companyId)}
        role="button"
        tabindex="0"
      >
        <span class="icon">[CO]</span>
        <span class="label">{company.name}</span>
      </div>
    </div>
  {/each}
</div>

<style>
  .tree-view {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    color: #00ff00;
    background: #000;
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }
  
  .tree-node {
    margin-left: 0;
  }
  
  .tree-children {
    margin-left: 20px;
    border-left: 1px solid #00ff00;
    padding-left: 8px;
  }
  
  .node-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.2s;
    user-select: none;
  }
  
  .node-label:hover {
    background: rgba(0, 255, 0, 0.1);
  }
  
  .node-label.selected {
    background: rgba(0, 255, 0, 0.2);
    border: 1px solid #00ff00;
  }
  
  .expand-icon {
    width: 16px;
    text-align: center;
    color: #00ffff;
    font-size: 10px;
  }
  
  .icon {
    font-size: 11px;
    font-weight: bold;
    min-width: 30px;
  }
  
  .label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .company-node {
    color: #00ffff;
    font-weight: bold;
  }
  
  .project-node {
    color: #ffff00;
  }
  
  .precinct-node {
    color: #ff00ff;
  }
  
  .stage-node {
    color: #00ff00;
  }
  
  .lot-node {
    color: #ff8800;
  }
  
  .subgroup-node {
    color: #888;
    font-size: 12px;
    cursor: default;
  }
  
  .subgroup-node:hover {
    background: transparent;
  }
</style>
