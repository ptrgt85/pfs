<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import DataTable from '$lib/components/DataTable.svelte';
  
  let lot: any = null;
  let subgroups: any[] = [];
  let loading = true;
  
  $: lotId = $page.params.id;
  
  const columns = [
    { key: 'id', label: 'ID', sortable: true, width: 80 },
    { key: 'name', label: 'Subgroup Name', editable: true, sortable: true, width: 250 },
    { key: 'description', label: 'Description', editable: true, sortable: true, width: 400 }
  ];
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    loading = true;
    try {
      const [lotsRes, subgroupsRes] = await Promise.all([
        fetch('/api/lots'),
        fetch(`/api/lot-subgroups?lotId=${lotId}`)
      ]);
      
      const lots = await lotsRes.json();
      lot = lots.find((l: any) => l.id === parseInt(lotId));
      subgroups = await subgroupsRes.json();
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }
  
  async function handleUpdate(id: number, field: string, value: any) {
    try {
      await fetch('/api/lot-subgroups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to update subgroup:', error);
    }
  }
  
  async function handleDelete(id: number) {
    if (!confirm('Delete this subgroup?')) return;
    try {
      await fetch('/api/lot-subgroups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete subgroup:', error);
    }
  }
  
  async function handleAdd() {
    const name = prompt('Enter subgroup name:');
    if (!name) return;
    try {
      await fetch('/api/lot-subgroups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lotId: parseInt(lotId), sortOrder: subgroups.length })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to create subgroup:', error);
    }
  }
</script>

<div class="container">
  <nav class="breadcrumb">
    <a href="/">Companies</a>
    {#if lot?.stage?.precinct?.project?.company}
      <span>/ <a href="/companies/{lot.stage.precinct.project.company.id}">{lot.stage.precinct.project.company.name}</a></span>
    {/if}
    {#if lot?.stage?.precinct?.project}
      <span>/ <a href="/projects/{lot.stage.precinct.project.id}">{lot.stage.precinct.project.name}</a></span>
    {/if}
    {#if lot?.stage?.precinct}
      <span>/ <a href="/precincts/{lot.stage.precinct.id}">{lot.stage.precinct.name}</a></span>
    {/if}
    {#if lot?.stage}
      <span>/ <a href="/stages/{lot.stage.id}">{lot.stage.name}</a></span>
    {/if}
    {#if lot}
      <span>/ Lot {lot.lotNumber}</span>
    {/if}
  </nav>
  
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if lot}
    <header>
      <h1>📦 Lot {lot.lotNumber}</h1>
      <div class="lot-info">
        {#if lot.address}
          <div class="info-item">
            <strong>Address:</strong> {lot.address}
          </div>
        {/if}
        {#if lot.area}
          <div class="info-item">
            <strong>Area:</strong> {lot.area} m²
          </div>
        {/if}
        {#if lot.status}
          <div class="info-item">
            <strong>Status:</strong> {lot.status}
          </div>
        {/if}
      </div>
    </header>
    
    <main>
      <div class="section-header">
        <h2>Subgroups</h2>
        <p class="subtitle">Manage lot subgroups</p>
      </div>
      
      <DataTable 
        {columns}
        data={subgroups}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAdd={handleAdd}
      />
    </main>
  {:else}
    <div class="error">Lot not found</div>
  {/if}
</div>

<style>
  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
  }
  
  .breadcrumb {
    margin-bottom: 20px;
    font-size: 14px;
  }
  
  .breadcrumb a {
    color: #0066cc;
    text-decoration: none;
  }
  
  .breadcrumb a:hover {
    text-decoration: underline;
  }
  
  .breadcrumb span {
    color: #666;
  }
  
  header {
    margin-bottom: 40px;
    padding-bottom: 20px;
    border-bottom: 2px solid #eee;
  }
  
  h1 {
    font-size: 32px;
    margin: 0 0 16px 0;
    color: #333;
  }
  
  .lot-info {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }
  
  .info-item {
    font-size: 14px;
    color: #666;
  }
  
  .info-item strong {
    color: #333;
  }
  
  .section-header {
    margin-bottom: 20px;
  }
  
  h2 {
    font-size: 24px;
    margin: 0 0 4px 0;
    color: #333;
  }
  
  .subtitle {
    margin: 0;
    color: #666;
    font-size: 14px;
  }
  
  .loading, .error {
    text-align: center;
    padding: 40px;
    color: #666;
    font-size: 16px;
  }
  
  .error {
    color: #dc3545;
  }
</style>
