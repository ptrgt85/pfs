<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import DataTable from '$lib/components/DataTable.svelte';
  
  let project: any = null;
  let precincts: any[] = [];
  let loading = true;
  
  $: projectId = $page.params.id;
  
  const columns = [
    { key: 'id', label: 'ID', sortable: true, width: 80 },
    { key: 'name', label: 'Precinct Name', editable: true, sortable: true, width: 250 },
    { key: 'description', label: 'Description', editable: true, sortable: true, width: 300 },
    { key: 'stageCount', label: 'Stages', sortable: true, width: 100 }
  ];
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    loading = true;
    try {
      const [projectsRes, precinctsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch(`/api/precincts?projectId=${projectId}`)
      ]);
      
      const projects = await projectsRes.json();
      project = projects.find((p: any) => p.id === parseInt(projectId));
      
      const precinctsData = await precinctsRes.json();
      precincts = precinctsData.map((precinct: any) => ({
        ...precinct,
        stageCount: precinct.stages?.length || 0
      }));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }
  
  async function handleUpdate(id: number, field: string, value: any) {
    try {
      const response = await fetch('/api/precincts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
      
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to update precinct:', error);
    }
  }
  
  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this precinct? All related data will be deleted.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/precincts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to delete precinct:', error);
    }
  }
  
  async function handleAdd() {
    const name = prompt('Enter precinct name:');
    if (!name) return;
    
    try {
      const response = await fetch('/api/precincts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          description: '', 
          projectId: parseInt(projectId),
          sortOrder: precincts.length 
        })
      });
      
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to create precinct:', error);
    }
  }
  
  function handleRowClick(row: any) {
    goto(`/precincts/${row.id}`);
  }
</script>

<div class="container">
  <nav class="breadcrumb">
    <a href="/">Companies</a>
    {#if project?.company}
      <span>/ <a href="/companies/{project.company.id}">{project.company.name}</a></span>
    {/if}
    {#if project}
      <span>/ {project.name}</span>
    {/if}
  </nav>
  
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if project}
    <header>
      <h1>📋 {project.name}</h1>
      {#if project.description}
        <p class="description">{project.description}</p>
      {/if}
    </header>
    
    <main>
      <div class="section-header">
        <h2>Precincts</h2>
        <p class="subtitle">Click on a precinct to view its stages</p>
      </div>
      
      <DataTable 
        {columns}
        data={precincts}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onRowClick={handleRowClick}
      />
    </main>
  {:else}
    <div class="error">Project not found</div>
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
