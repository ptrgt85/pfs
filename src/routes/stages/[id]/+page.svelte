<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import DataTable from '$lib/components/DataTable.svelte';
  
  let stage: any = null;
  let permits: any[] = [];
  let approvals: any[] = [];
  let invoices: any[] = [];
  let lots: any[] = [];
  let loading = true;
  let activeTab = 'permits';
  
  $: stageId = $page.params.id;
  
  const permitColumns = [
    { key: 'id', label: 'ID', sortable: true, width: 80 },
    { key: 'name', label: 'Permit Name', editable: true, sortable: true, width: 250 },
    { key: 'permitNumber', label: 'Permit #', editable: true, sortable: true, width: 150 },
    { key: 'status', label: 'Status', editable: true, sortable: true, width: 120 }
  ];
  
  const approvalColumns = [
    { key: 'id', label: 'ID', sortable: true, width: 80 },
    { key: 'name', label: 'Approval Name', editable: true, sortable: true, width: 250 },
    { key: 'approvalNumber', label: 'Approval #', editable: true, sortable: true, width: 150 },
    { key: 'status', label: 'Status', editable: true, sortable: true, width: 120 }
  ];
  
  const invoiceColumns = [
    { key: 'id', label: 'ID', sortable: true, width: 80 },
    { key: 'invoiceNumber', label: 'Invoice #', editable: true, sortable: true, width: 150 },
    { key: 'amount', label: 'Amount', editable: true, sortable: true, width: 120 },
    { key: 'status', label: 'Status', editable: true, sortable: true, width: 120 }
  ];
  
  const lotColumns = [
    { key: 'id', label: 'ID', sortable: true, width: 80 },
    { key: 'lotNumber', label: 'Lot #', editable: true, sortable: true, width: 120 },
    { key: 'address', label: 'Address', editable: true, sortable: true, width: 250 },
    { key: 'area', label: 'Area', editable: true, sortable: true, width: 100 },
    { key: 'status', label: 'Status', editable: true, sortable: true, width: 120 },
    { key: 'subgroupCount', label: 'Subgroups', sortable: true, width: 100 }
  ];
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    loading = true;
    try {
      const [stagesRes, permitsRes, approvalsRes, invoicesRes, lotsRes] = await Promise.all([
        fetch('/api/stages'),
        fetch(`/api/permits?stageId=${stageId}`),
        fetch(`/api/approvals?stageId=${stageId}`),
        fetch(`/api/invoices?stageId=${stageId}`),
        fetch(`/api/lots?stageId=${stageId}`)
      ]);
      
      const stages = await stagesRes.json();
      stage = stages.find((s: any) => s.id === parseInt(stageId));
      
      permits = await permitsRes.json();
      approvals = await approvalsRes.json();
      invoices = await invoicesRes.json();
      
      const lotsData = await lotsRes.json();
      lots = lotsData.map((lot: any) => ({
        ...lot,
        subgroupCount: lot.subgroups?.length || 0
      }));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }
  
  async function handlePermitUpdate(id: number, field: string, value: any) {
    try {
      await fetch('/api/permits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to update permit:', error);
    }
  }
  
  async function handlePermitDelete(id: number) {
    if (!confirm('Delete this permit?')) return;
    try {
      await fetch('/api/permits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete permit:', error);
    }
  }
  
  async function handlePermitAdd() {
    const name = prompt('Enter permit name:');
    if (!name) return;
    try {
      await fetch('/api/permits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stageId: parseInt(stageId), sortOrder: permits.length })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to create permit:', error);
    }
  }
  
  async function handleApprovalUpdate(id: number, field: string, value: any) {
    try {
      await fetch('/api/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to update approval:', error);
    }
  }
  
  async function handleApprovalDelete(id: number) {
    if (!confirm('Delete this approval?')) return;
    try {
      await fetch('/api/approvals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete approval:', error);
    }
  }
  
  async function handleApprovalAdd() {
    const name = prompt('Enter approval name:');
    if (!name) return;
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stageId: parseInt(stageId), sortOrder: approvals.length })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to create approval:', error);
    }
  }
  
  async function handleInvoiceUpdate(id: number, field: string, value: any) {
    try {
      await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to update invoice:', error);
    }
  }
  
  async function handleInvoiceDelete(id: number) {
    if (!confirm('Delete this invoice?')) return;
    try {
      await fetch('/api/invoices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  }
  
  async function handleInvoiceAdd() {
    const invoiceNumber = prompt('Enter invoice number:');
    if (!invoiceNumber) return;
    try {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber, stageId: parseInt(stageId), sortOrder: invoices.length })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to create invoice:', error);
    }
  }
  
  async function handleLotUpdate(id: number, field: string, value: any) {
    try {
      await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to update lot:', error);
    }
  }
  
  async function handleLotDelete(id: number) {
    if (!confirm('Delete this lot?')) return;
    try {
      await fetch('/api/lots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete lot:', error);
    }
  }
  
  async function handleLotAdd() {
    const lotNumber = prompt('Enter lot number:');
    if (!lotNumber) return;
    try {
      await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotNumber, stageId: parseInt(stageId), sortOrder: lots.length })
      });
      await loadData();
    } catch (error) {
      console.error('Failed to create lot:', error);
    }
  }
  
  function handleLotClick(row: any) {
    goto(`/lots/${row.id}`);
  }
</script>

<div class="container">
  <nav class="breadcrumb">
    <a href="/">Companies</a>
    {#if stage?.precinct?.project?.company}
      <span>/ <a href="/companies/{stage.precinct.project.company.id}">{stage.precinct.project.company.name}</a></span>
    {/if}
    {#if stage?.precinct?.project}
      <span>/ <a href="/projects/{stage.precinct.project.id}">{stage.precinct.project.name}</a></span>
    {/if}
    {#if stage?.precinct}
      <span>/ <a href="/precincts/{stage.precinct.id}">{stage.precinct.name}</a></span>
    {/if}
    {#if stage}
      <span>/ {stage.name}</span>
    {/if}
  </nav>
  
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if stage}
    <header>
      <h1>🏗️ {stage.name}</h1>
      {#if stage.description}
        <p class="description">{stage.description}</p>
      {/if}
    </header>
    
    <main>
      <div class="tabs">
        <button 
          class="tab" 
          class:active={activeTab === 'permits'}
          on:click={() => activeTab = 'permits'}
        >
          📋 Permits ({permits.length})
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'approvals'}
          on:click={() => activeTab = 'approvals'}
        >
          ✓ Approvals ({approvals.length})
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'invoices'}
          on:click={() => activeTab = 'invoices'}
        >
          💰 Invoices ({invoices.length})
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'lots'}
          on:click={() => activeTab = 'lots'}
        >
          📦 Lots ({lots.length})
        </button>
      </div>
      
      <div class="tab-content">
        {#if activeTab === 'permits'}
          <DataTable 
            columns={permitColumns}
            data={permits}
            onUpdate={handlePermitUpdate}
            onDelete={handlePermitDelete}
            onAdd={handlePermitAdd}
          />
        {:else if activeTab === 'approvals'}
          <DataTable 
            columns={approvalColumns}
            data={approvals}
            onUpdate={handleApprovalUpdate}
            onDelete={handleApprovalDelete}
            onAdd={handleApprovalAdd}
          />
        {:else if activeTab === 'invoices'}
          <DataTable 
            columns={invoiceColumns}
            data={invoices}
            onUpdate={handleInvoiceUpdate}
            onDelete={handleInvoiceDelete}
            onAdd={handleInvoiceAdd}
          />
        {:else if activeTab === 'lots'}
          <DataTable 
            columns={lotColumns}
            data={lots}
            onUpdate={handleLotUpdate}
            onDelete={handleLotDelete}
            onAdd={handleLotAdd}
            onRowClick={handleLotClick}
          />
        {/if}
      </div>
    </main>
  {:else}
    <div class="error">Stage not found</div>
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
    margin-bottom: 30px;
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
  
  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    border-bottom: 2px solid #eee;
  }
  
  .tab {
    padding: 12px 20px;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-size: 15px;
    font-weight: 500;
    color: #666;
    transition: all 0.2s;
  }
  
  .tab:hover {
    color: #333;
    background: #f9f9f9;
  }
  
  .tab.active {
    color: #0066cc;
    border-bottom-color: #0066cc;
  }
  
  .tab-content {
    margin-top: 20px;
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
