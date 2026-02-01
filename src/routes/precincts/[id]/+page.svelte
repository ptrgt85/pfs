<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import DataTable from '$lib/components/DataTable.svelte';
  
  let precinct: any = null;
  let stages: any[] = [];
  let loading = true;
  
  $: precinctId = $page.params.id;
  
  const columns = [
    { key: 'id', label: 'ID', sortable: true, width: 80 },
    { key: 'name', label: 'Stage Name', editable: true, sortable: true, width: 250 },
    { key: 'description', label: 'Description', editable: true, sortable: true, width: 250 },
    { key: 'permitCount', label: 'Permits', sortable: true, width: 90 },
    { key: 'approvalCount', label: 'Approvals', sortable: true, width: 90 },
    { key: 'invoiceCount', label: 'Invoices', sortable: true, width: 90 },
    { key: 'lotCount', label: 'Lots', sortable: true, width: 80 }
  ];
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    loading = true;
    try {
      const [precinctsRes, stagesRes] = await Promise.all([
        fetch('/api/precincts'),
        fetch(`/api/stages?precinctId=${precinctId}`)
      ]);
      
      const precincts = await precinctsRes.json();
      precinct = precincts.find((p: any) => p.id === parseInt(precinctId));
      
      const stagesData = await stagesRes.json();
      stages = stagesData.map((stage: any) => ({
        ...stage,
        permitCount: stage.permits?.length || 0,
        approvalCount: stage.approvals?.length || 0,
        invoiceCount: stage.invoices?.length || 0,
        lotCount: stage.lots?.length || 0
      }));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }
  
  async function handleUpdate(id: number, field: string, value: any) {
    try {
      const response = await fetch('/api/stages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
      
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to update stage:', error);
    }
  }
  
  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this stage? All related data will be deleted.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/stages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to delete stage:', error);
    }
  }
  
  async function handleAdd() {
    const name = prompt('Enter stage name:');
    if (!name) return;
    
    try {
      const response = await fetch('/api/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          description: '', 
          precinctId: parseInt(precinctId),
          sortOrder: stages.length 
        })
      });
      
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to create stage:', error);
    }
  }
  
  function handleRowClick(row: any) {
    goto(`/stages/${row.id}`);
  }
</script>

<div class="container">
  <nav class="breadcrumb">
    <a href="/">Companies</a>
    {#if precinct?.project?.company}
      <span>/ <a href="/companies/{precinct.project.company.id}">{precinct.project.company.name}</a></span>
    {/if}
    {#if precinct?.project}
      <span>/ <a href="/projects/{precinct.project.id}">{precinct.project.name}</a></span>
    {/if}
    {#if precinct}
      <span>/ {precinct.name}</span>
    {/if}
  </nav>
  
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if precinct}
    <header>
      <h1>🏘️ {precinct.name}</h1>
      {#if precinct.description}
        <p class="description">{precinct.description}</p>
      {/if}
    </header>
    
    <main>
      <div class="section-header">
        <h2>Stages</h2>
        <p class="subtitle">Click on a stage to view its details (permits, approvals, invoices, lots)</p>
      </div>
      
      <DataTable 
        {columns}
        data={stages}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onRowClick={handleRowClick}
      />
    </main>
  {:else}
    <div class="error">Precinct not found</div>
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
    margin: 0 0 8px 0;
    color: #333;
  }
  
  .description {
    margin: 0;
    color: #666;
    font-size: 16px;
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
