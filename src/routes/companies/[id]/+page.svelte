<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import DataTable from '$lib/components/DataTable.svelte';
  
  let company: any = null;
  let projects: any[] = [];
  let loading = true;
  
  $: companyId = $page.params.id;
  
  const columns = [
    { key: 'id', label: 'ID', sortable: true, width: 80 },
    { key: 'name', label: 'Project Name', editable: true, sortable: true, width: 250 },
    { key: 'description', label: 'Description', editable: true, sortable: true, width: 300 },
    { key: 'precinctCount', label: 'Precincts', sortable: true, width: 100 }
  ];
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    loading = true;
    try {
      const [companyRes, projectsRes] = await Promise.all([
        fetch('/api/companies'),
        fetch(`/api/projects?companyId=${companyId}`)
      ]);
      
      const companies = await companyRes.json();
      company = companies.find((c: any) => c.id === parseInt(companyId));
      
      const projectsData = await projectsRes.json();
      projects = projectsData.map((project: any) => ({
        ...project,
        precinctCount: project.precincts?.length || 0
      }));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }
  
  async function handleUpdate(id: number, field: string, value: any) {
    try {
      const response = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
      
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  }
  
  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this project? All related data will be deleted.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }
  
  async function handleAdd() {
    const name = prompt('Enter project name:');
    if (!name) return;
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          description: '', 
          companyId: parseInt(companyId),
          sortOrder: projects.length 
        })
      });
      
      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  }
  
  function handleRowClick(row: any) {
    goto(`/projects/${row.id}`);
  }
</script>

<div class="container">
  <nav class="breadcrumb">
    <a href="/">← Companies</a>
    {#if company}
      <span>/ {company.name}</span>
    {/if}
  </nav>
  
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if company}
    <header>
      <h1>🏢 {company.name}</h1>
      <div class="company-info">
        {#if company.abn}
          <div class="info-item">
            <strong>ABN:</strong> {company.abn}
          </div>
        {/if}
        {#if company.owners}
          <div class="info-item">
            <strong>Owners:</strong> {company.owners}
          </div>
        {/if}
      </div>
    </header>
    
    <main>
      <div class="section-header">
        <h2>Projects</h2>
        <p class="subtitle">Click on a project to view its precincts</p>
      </div>
      
      <DataTable 
        {columns}
        data={projects}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onRowClick={handleRowClick}
      />
    </main>
  {:else}
    <div class="error">Company not found</div>
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
  
  .company-info {
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
