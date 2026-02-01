<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  // ===== AUTHENTICATION STATE =====
  interface User {
    id: number;
    email: string;
    name: string;
    isMaster: boolean;
    access?: Array<{
      entityType: string;
      entityId: number;
      roleName: string;
      canView: number;
      canEdit: number;
      canDelete: number;
      canInvite: number;
      canManageRoles: number;
    }>;
  }
  
  let currentUser: User | null = null;
  let authLoading = true;
  let showUserMenu = false;
  let showUserManagement = false;
  let showNewCompanyModal = false;
  let newCompanyName = '';
  let newCompanyAbn = '';
  let creatingCompany = false;
  
  // User management state
  let managementTab: 'users' | 'roles' | 'invites' | 'activity' = 'users';
  let allUsers: any[] = [];
  let allRoles: any[] = [];
  let allInvites: any[] = [];
  let allCompanies: any[] = [];
  let allProjects: any[] = [];
  let activityLogs: any[] = [];
  let loadingActivity = false;
  let loadingManagement = false;
  let newUserForm = { email: '', name: '', password: '', isMaster: false, roleId: 0 };
  let editingUser: any = null;
  let newRoleForm = { name: '', description: '', canView: true, canEdit: false, canDelete: false, canInvite: false, canManageRoles: false };
  let inviteForm = { email: '', roleId: 0, entityType: 'company', entityId: 0 };
  let managementError = '';
  
  // Check if current user is admin (has canInvite permission)
  $: isAdmin = currentUser?.access?.some(a => a.canInvite === 1) || false;
  $: canManageUsers = currentUser?.isMaster || isAdmin;
  
  // Get user's primary role info
  $: userPrimaryRole = currentUser?.access?.[0]?.roleName || null;
  $: userCanEdit = currentUser?.isMaster || currentUser?.access?.some(a => a.canEdit === 1) || false;
  $: userCanDelete = currentUser?.isMaster || currentUser?.access?.some(a => a.canDelete === 1) || false;
  $: userCanView = currentUser?.isMaster || currentUser?.access?.some(a => a.canView === 1) || false;
  
  async function loadManagementData() {
    loadingManagement = true;
    try {
      const [usersRes, rolesRes, invitesRes, companiesRes, projectsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/roles'),
        fetch('/api/invitations'),
        fetch('/api/companies'),
        fetch('/api/projects')
      ]);
      allUsers = await usersRes.json();
      allRoles = await rolesRes.json();
      allInvites = await invitesRes.json();
      if (companiesRes.ok) {
        allCompanies = await companiesRes.json();
      }
      if (projectsRes.ok) {
        allProjects = await projectsRes.json();
      }
    } catch (e) {
      console.error('Failed to load management data:', e);
    }
    loadingManagement = false;
  }
  
  async function createUser() {
    managementError = '';
    if (!newUserForm.email || !newUserForm.name || !newUserForm.password) {
      managementError = 'All fields are required';
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm)
      });
      if (!res.ok) {
        const data = await res.json();
        managementError = data.error || 'Failed to create user';
        return;
      }
      newUserForm = { email: '', name: '', password: '', isMaster: false, roleId: 0 };
      await loadManagementData();
    } catch (e) {
      managementError = 'Failed to create user';
    }
  }
  
  async function toggleUserStatus(user: any) {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, isActive: !user.isActive })
    });
    await loadManagementData();
  }
  
  function startEditUser(user: any) {
    editingUser = { ...user, password: '', roleId: user.roleId || 0, companyId: user.companyId || 0 };
  }
  
  function cancelEditUser() {
    editingUser = null;
  }
  
  async function saveEditUser() {
    managementError = '';
    if (!editingUser.name || !editingUser.email) {
      managementError = 'Name and email are required';
      return;
    }
    try {
      const payload: any = {
        id: editingUser.id,
        name: editingUser.name,
        email: editingUser.email,
        isMaster: editingUser.isMaster
      };
      if (editingUser.password) {
        payload.password = editingUser.password;
      }
      if (editingUser.roleId && editingUser.roleId > 0) {
        payload.roleId = editingUser.roleId;
      }
      if (editingUser.companyId && editingUser.companyId > 0) {
        payload.companyId = editingUser.companyId;
      }
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json();
        managementError = data.error || 'Failed to update user';
        return;
      }
      editingUser = null;
      await loadManagementData();
    } catch (e) {
      managementError = 'Failed to update user';
    }
  }
  
  async function createRole() {
    managementError = '';
    if (!newRoleForm.name) {
      managementError = 'Role name is required';
      return;
    }
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoleForm)
      });
      if (!res.ok) {
        const data = await res.json();
        managementError = data.error || 'Failed to create role';
        return;
      }
      newRoleForm = { name: '', description: '', canView: true, canEdit: false, canDelete: false, canInvite: false, canManageRoles: false };
      await loadManagementData();
    } catch (e) {
      managementError = 'Failed to create role';
    }
  }
  
  async function deleteInvite(id: number) {
    await fetch(`/api/invitations?id=${id}`, { method: 'DELETE' });
    await loadManagementData();
  }
  
  async function loadActivityLogs() {
    loadingActivity = true;
    try {
      const res = await fetch('/api/activity-log?limit=100');
      if (res.ok) {
        activityLogs = await res.json();
      }
    } catch (e) {
      console.error('Failed to load activity logs:', e);
    }
    loadingActivity = false;
  }
  
  async function sendInvite() {
    managementError = '';
    if (!inviteForm.email || !inviteForm.roleId || !inviteForm.entityId) {
      managementError = 'Email, role, and entity are required';
      return;
    }
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm)
      });
      const data = await res.json();
      if (!res.ok) {
        managementError = data.error || 'Failed to send invitation';
        return;
      }
      // Reset form and reload
      inviteForm = { email: '', roleId: 0, entityType: 'company', entityId: 0 };
      await loadManagementData();
    } catch (e) {
      managementError = 'Failed to send invitation';
    }
  }
  
  // Get available entities based on entity type and user permissions
  $: availableEntities = inviteForm.entityType === 'company' ? allCompanies : allProjects;
  
  // Reset entityId when entity type changes
  function onEntityTypeChange() {
    inviteForm.entityId = 0;
  }
  
  $: if (showUserManagement && canManageUsers) {
    loadManagementData();
  }
  
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      currentUser = data.user;
      if (!currentUser) {
        goto('/login');
      }
    } catch (e) {
      goto('/login');
    } finally {
      authLoading = false;
    }
  }
  
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    goto('/login');
  }
  
  // Check permissions for current node
  function hasPermission(permission: 'canView' | 'canEdit' | 'canDelete' | 'canInvite' | 'canManageRoles'): boolean {
    if (!currentUser) return false;
    if (currentUser.isMaster) return true;
    if (!selectedNode || !currentUser.access) return false;
    
    // Check access for this entity or any parent
    const access = currentUser.access.find(a => 
      a.entityType === selectedNode!.type && a.entityId === selectedNode!.id
    );
    
    return access ? access[permission] === 1 : false;
  }
  
  interface TreeNode {
    id: number;
    name: string;
    type: string;
    parentId: number | null;
    children?: TreeNode[];
    expanded?: boolean;
    loading?: boolean;
  }
  
  let tree: TreeNode[] = [];
  let selectedNode: TreeNode | null = null;
  let tableData: any[] = [];
  let loading = false;
  let activityLog: Array<{time: string, message: string, type: string}> = [];
  let editingId: number | null = null;
  let editValues: Record<string, string> = {};
  let isAdding = false;
  let newRowValues: Record<string, string> = {};
  let sortColumn: string = '';
  let sortDirection: 'asc' | 'desc' = 'asc';
  let entityDetails: any = null;
  let editingProperty: string | null = null;
  let propertyEditValue: string = '';
  let hierarchyPath: Array<{type: string, name: string}> = [];
  let documents: any[] = [];
  let showDocuments = false;
  let uploading = false;
  let extractingDocId: number | null = null; // Track which specific document is being extracted
  let extractionProgress = { current: 0, total: 0, status: '' }; // Progress tracking
  let extractionResult: any = null;
  let showExtractionModal = false;
  let previewDocument: any = null;
  
  // Continuation extraction state
  let showContinueModal = false;
  let continuationInfo: { docId: number, remainingStages: string[], estimatedLots: number, existingData: any } | null = null;
  
  // Document type for upload
  let uploadDocumentType = 'other';
  const documentTypeOptions = [
    { id: 'permit_plan', name: 'Permit Plan', desc: 'Initial planning document with stages/lots' },
    { id: 'plan_subdivision', name: 'Plan of Subdivision', desc: 'Registered plan with lot details' },
    { id: 'other', name: 'Other', desc: 'Supporting documents' }
  ];
  
  // Extraction hints - user-provided context to assist AI
  let extractionHints = '';
  let showHintsInput = false;
  let showPreExtractionModal = false;
  let pendingExtractionDocId: number | null = null;
  
  // Bulk edit state
  let selectedRows: Set<number> = new Set();
  let bulkEditField = '';
  let bulkEditValue = '';
  let showBulkEdit = false;
  
  // Inline document viewer state
  let inlineDocument: any = null;
  let inlineZoom = 1;
  let inlineViewerHeight = 250;
  let pdfPageNumber = 1;
  let analyzingPage = false;
  
  // Verification/correction state
  let verificationResult: any = null;
  let showVerificationModal = false;
  
  // POS Analysis state
  let showPosAnalysisModal = false;
  let posAnalysisResult: any = null;
  let analyzingPos = false;
  let posAnalysisFilter: 'all' | 'variance' | 'easements' | 'match' = 'all';
  let expandedLots: Set<string> = new Set();
  
  // AI Model selection
  let selectedModel: 'gemini' | 'grok' | 'openai' = 'gemini';
  const modelOptions = [
    { id: 'gemini', name: 'Gemini 3 Flash', desc: 'Google AI - Best for complex plans & OCR (Free tier)' },
    { id: 'openai', name: 'GPT-5 Mini (OpenAI)', desc: 'OpenAI vision model - Fast & affordable' },
    { id: 'grok', name: 'Grok 2 Vision (xAI)', desc: 'xAI vision model' }
  ];
  
  // AI Learning - track user corrections for pattern recognition
  let correctionHistory: { 
    lotNumber: string; 
    field: string; 
    oldValue: string; 
    newValue: string;
    timestamp: Date;
  }[] = [];
  
  // Screen capture state
  let capturedImage: string | null = null;
  let isCapturing = false;
  
  // Calibration state - for verifying AI accuracy before showing results
  let showCalibrationModal = false;
  let calibrationSamples: {
    lotNumber: string;
    area: string;
    frontage: string;
    depth: string;
    streetName: string;
    userArea: string;
    userFrontage: string;
    userDepth: string;
    userStreetName: string;
    confirmed: boolean;
  }[] = [];
  let calibrationDocId: number | null = null;
  let calibrationPageNum: number = 1;
  let pendingFullResults: any = null;
  let isCalibrating = false;
  
  // Visual box calibration state
  let showBoxCalibration = false;
  let boxCalibrationImage: string | null = null;
  let boxCalibrationLots: {
    lotNumber: string;
    fields: {
      name: string;
      aiValue: string;
      userValue: string;
      box: { x: number; y: number; width: number; height: number } | null;
      confirmed: boolean;
    }[];
  }[] = [];
  let currentLotIndex = 0;
  let currentFieldIndex = 0;
  let isDrawingBox = false;
  let drawStartPos = { x: 0, y: 0 };
  let currentBox: { x: number; y: number; width: number; height: number } | null = null;
  let boxCanvasRef: HTMLCanvasElement | null = null;
  let boxImageRef: HTMLImageElement | null = null;
  
  // Collapsible sections
  let showProperties = true;
  let showSummary = true;
  let showStageTable = true;
  
  // ===== USER PREFERENCES (DB-backed) =====
  let nodePreferences: Record<string, Record<string, string>> = {}; // Cache: "type:id" -> { prefKey: prefValue }
  
  async function loadNodePreferences(entityType: string, entityId: number): Promise<Record<string, string>> {
    const key = `${entityType}:${entityId}`;
    if (nodePreferences[key]) return nodePreferences[key];
    
    try {
      const res = await fetch(`/api/preferences?entityType=${entityType}&entityId=${entityId}`);
      const prefs = await res.json();
      nodePreferences[key] = prefs;
      return prefs;
    } catch (e) {
      console.warn('Failed to load preferences:', e);
      return {};
    }
  }
  
  async function saveNodePreference(entityType: string, entityId: number, prefKey: string, prefValue: boolean | string) {
    const key = `${entityType}:${entityId}`;
    // Update cache
    if (!nodePreferences[key]) nodePreferences[key] = {};
    nodePreferences[key][prefKey] = String(prefValue);
    
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, prefKey, prefValue: String(prefValue) })
      });
    } catch (e) {
      console.warn('Failed to save preference:', e);
    }
  }
  
  function getNodePreference(entityType: string, entityId: number, prefKey: string, defaultValue: boolean = false): boolean {
    const key = `${entityType}:${entityId}`;
    const prefs = nodePreferences[key];
    if (!prefs || prefs[prefKey] === undefined) return defaultValue;
    return prefs[prefKey] === 'true';
  }
  
  // Custom fields state
  let customFields: { id: number; entityType: string; fieldKey: string; fieldLabel: string; fieldType: string; fieldFormat?: string; isActive: number }[] = [];
  let hiddenFields: Set<string> = new Set(); // Fields user has hidden from view
  let showFieldsManager = false;
  let newFieldLabel = '';
  let newFieldType = 'text';
  let newFieldFormat = ''; // For number fields: $, sqm, m, or custom
  
  // Field ordering state
  let fieldOrder: string[] = []; // Order of field keys
  let draggingField: string | null = null;
  
  // Column resize state
  let columnWidths: Record<string, number> = {};
  let resizingColumn: string | null = null;
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  
  // Status field options with colors
  const statusOptions = [
    { value: 'masterplan', label: 'Masterplan', color: '#7aa2f7', bg: 'rgba(122, 162, 247, 0.2)' },
    { value: 'on_market', label: 'On Market', color: '#9ece6a', bg: 'rgba(158, 206, 106, 0.2)' },
    { value: 'hold', label: 'Hold', color: '#e0af68', bg: 'rgba(224, 175, 104, 0.2)' },
    { value: 'exchanged', label: 'Exchanged', color: '#bb9af7', bg: 'rgba(187, 154, 247, 0.2)' },
    { value: 'settled', label: 'Settled', color: '#73daca', bg: 'rgba(115, 218, 202, 0.2)' },
    { value: 'cancelled', label: 'Cancelled', color: '#f7768e', bg: 'rgba(247, 118, 142, 0.2)' }
  ];
  
  // Number format options
  const numberFormatOptions = [
    { value: '', label: 'Plain' },
    { value: '$', label: '$ (Currency)' },
    { value: 'sqm', label: 'sqm (Square Meters)' },
    { value: 'm', label: 'm (Meters)' },
    { value: 'custom', label: 'Custom' }
  ];
  
  // Common number presets
  const numberPresets = [
    { value: 100000, label: '100K' },
    { value: 250000, label: '250K' },
    { value: 500000, label: '500K' },
    { value: 750000, label: '750K' },
    { value: 1000000, label: '1M' },
    { value: 2000000, label: '2M' },
    { value: 5000000, label: '5M' }
  ];
  
  // Pricing state for Project Groups
  let showPricingPanel = false;
  let pricingProducts: {
    id?: number;
    productName: string;
    frontage: number;
    depth: number;
    baseArea: number;
    basePrice: number;
    pricePerSqm: number;
    balanceRate: number;
  }[] = [];
  let editingPricing = false;
  
  // Standard product types (sorted by area descending)
  const defaultProducts = [
    { frontage: 20, depth: 36, basePrice: 0 },
    { frontage: 20, depth: 32, basePrice: 0 },
    { frontage: 20, depth: 28, basePrice: 0 },
    { frontage: 18, depth: 36, basePrice: 0 },
    { frontage: 18, depth: 32, basePrice: 0 },
    { frontage: 16, depth: 36, basePrice: 0 },
    { frontage: 18, depth: 28, basePrice: 0 },
    { frontage: 16, depth: 32, basePrice: 0 },
    { frontage: 14, depth: 36, basePrice: 0 },
    { frontage: 16, depth: 28, basePrice: 0 },
    { frontage: 14, depth: 32, basePrice: 0 },
    { frontage: 16, depth: 25, basePrice: 0 },
    { frontage: 14, depth: 28, basePrice: 0 },
    { frontage: 12.5, depth: 32, basePrice: 0 },
    { frontage: 14, depth: 25, basePrice: 0 },
    { frontage: 12.5, depth: 28, basePrice: 0 },
    { frontage: 16, depth: 21, basePrice: 0 },
    { frontage: 10.5, depth: 32, basePrice: 0 },
    { frontage: 12.5, depth: 25, basePrice: 0 },
    { frontage: 14, depth: 21, basePrice: 0 },
    { frontage: 10.5, depth: 28, basePrice: 0 },
    { frontage: 13, depth: 21, basePrice: 0 },
    { frontage: 12.5, depth: 21, basePrice: 0 },
    { frontage: 10.5, depth: 25, basePrice: 0 },
    { frontage: 16, depth: 16, basePrice: 0 },
    { frontage: 8.5, depth: 28, basePrice: 0 },
    { frontage: 10.5, depth: 21, basePrice: 0 },
    { frontage: 8.5, depth: 25, basePrice: 0 },
    { frontage: 7.5, depth: 28, basePrice: 0 },
    { frontage: 5.1, depth: 28, basePrice: 0 },
    { frontage: 6.75, depth: 21, basePrice: 0 }
  ];
  
  async function loadPricing(projectId: number) {
    try {
      console.log('Loading pricing for projectId:', projectId);
      const res = await fetch(`/api/pricing?projectId=${projectId}`);
      const data = await res.json();
      console.log('Pricing API response:', data);
      if (data.length > 0) {
        pricingProducts = data.map((p: any) => ({
          id: p.id,
          productName: p.productName,
          frontage: parseFloat(p.frontage),
          depth: parseFloat(p.depth),
          baseArea: parseFloat(p.baseArea),
          basePrice: parseFloat(p.basePrice),
          pricePerSqm: parseFloat(p.pricePerSqm),
          balanceRate: parseFloat(p.balanceRate) || 50
        }));
        console.log('Loaded pricing products:', pricingProducts.map(p => ({ name: p.productName, basePrice: p.basePrice })));
      } else {
        // Initialize with default products (no prices set)
        pricingProducts = defaultProducts.map(p => ({
          productName: `${p.frontage}x${p.depth}`,
          frontage: p.frontage,
          depth: p.depth,
          baseArea: p.frontage * p.depth,
          basePrice: p.basePrice,
          pricePerSqm: 0,
          balanceRate: 50
        }));
        console.log('No pricing found, using defaults');
      }
    } catch (e) {
      console.error('Failed to load pricing:', e);
    }
  }
  
  async function savePricing() {
    if (!selectedNode || selectedNode.type !== 'project') return;
    
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedNode.id,
          products: pricingProducts
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        pricingProducts = data.map((p: any) => ({
          id: p.id,
          productName: p.productName,
          frontage: parseFloat(p.frontage),
          depth: parseFloat(p.depth),
          baseArea: parseFloat(p.baseArea),
          basePrice: parseFloat(p.basePrice),
          pricePerSqm: parseFloat(p.pricePerSqm),
          balanceRate: parseFloat(p.balanceRate) || 50
        }));
        editingPricing = false;
        log('Pricing saved successfully', 'success');
      }
    } catch (e) {
      log('Failed to save pricing', 'error');
    }
  }
  
  function updateProductPrice(index: number, price: number) {
    pricingProducts[index].basePrice = price;
    pricingProducts[index].pricePerSqm = price / pricingProducts[index].baseArea;
    pricingProducts = [...pricingProducts];
  }
  
  // Interactive graph dragging
  let draggingPointIndex: number | null = null;
  let selectedGraphPoint: number | null = null;
  let graphSvgRef: SVGSVGElement | null = null;
  const PRICE_INCREMENT = 5; // $/m² increment per key press
  
  function selectPoint(index: number) {
    if (!editingPricing) return;
    selectedGraphPoint = index;
  }
  
  function selectAndDragPoint(event: MouseEvent, index: number) {
    if (!editingPricing) return;
    selectedGraphPoint = index;
    draggingPointIndex = index;
    event.preventDefault();
  }
  
  function handleGraphMouseMove(event: MouseEvent) {
    if (draggingPointIndex === null || !graphSvgRef) return;
    
    const rect = graphSvgRef.getBoundingClientRect();
    const svgY = ((event.clientY - rect.top) / rect.height) * 480; // viewBox height
    
    // Get current price range for accurate scaling
    const pricedProducts = pricingProducts.filter(p => p.pricePerSqm > 0);
    const rawMinSqm = Math.min(...pricedProducts.map(p => p.pricePerSqm));
    const rawMaxSqm = Math.max(...pricedProducts.map(p => p.pricePerSqm));
    const priceRange = rawMaxSqm - rawMinSqm;
    const graphMinSqm = Math.max(0, rawMinSqm - priceRange * 0.2);
    const graphMaxSqm = rawMaxSqm + priceRange * 0.2 || 2000;
    
    // Convert Y position to price (inverted - higher Y = lower price)
    const newPricePerSqm = Math.max(0, graphMinSqm + ((390 - svgY) / 315) * (graphMaxSqm - graphMinSqm));
    
    // Update the product price
    const product = pricingProducts[draggingPointIndex];
    product.pricePerSqm = Math.round(newPricePerSqm);
    product.basePrice = Math.round(product.pricePerSqm * product.baseArea);
    pricingProducts = [...pricingProducts];
  }
  
  function stopDragPoint() {
    draggingPointIndex = null;
  }
  
  function handleGraphKeydown(event: KeyboardEvent) {
    if (!editingPricing || selectedGraphPoint === null) return;
    
    const product = pricingProducts[selectedGraphPoint];
    if (!product) return;
    
    let increment = PRICE_INCREMENT;
    if (event.shiftKey) increment *= 5; // Shift = 5x faster
    if (event.altKey) increment = 1; // Alt = 1 $/m² fine control
    
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      product.pricePerSqm = Math.round(product.pricePerSqm + increment);
      product.basePrice = Math.round(product.pricePerSqm * product.baseArea);
      pricingProducts = [...pricingProducts];
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      product.pricePerSqm = Math.max(0, Math.round(product.pricePerSqm - increment));
      product.basePrice = Math.round(product.pricePerSqm * product.baseArea);
      pricingProducts = [...pricingProducts];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      // Navigate between points
      event.preventDefault();
      const pricedProducts = pricingProducts.filter(p => p.pricePerSqm > 0);
      const sortedByArea = [...pricedProducts].sort((a, b) => a.baseArea - b.baseArea);
      const currentIdx = sortedByArea.findIndex(p => pricingProducts.indexOf(p) === selectedGraphPoint);
      
      let newIdx = currentIdx;
      if (event.key === 'ArrowLeft') newIdx = Math.max(0, currentIdx - 1);
      if (event.key === 'ArrowRight') newIdx = Math.min(sortedByArea.length - 1, currentIdx + 1);
      
      selectedGraphPoint = pricingProducts.indexOf(sortedByArea[newIdx]);
    } else if (event.key === 'Escape') {
      selectedGraphPoint = null;
    }
  }
  
  // Calculate linear regression trend line
  function calculateTrendLine(products: typeof pricingProducts): { slope: number; intercept: number } | null {
    // Only use products with prices set for the trend
    const pricedProducts = products.filter(p => p.pricePerSqm > 0);
    if (pricedProducts.length < 2) return null;
    
    const n = pricedProducts.length;
    const sumX = pricedProducts.reduce((s, p) => s + p.baseArea, 0);
    const sumY = pricedProducts.reduce((s, p) => s + p.pricePerSqm, 0);
    const sumXY = pricedProducts.reduce((s, p) => s + p.baseArea * p.pricePerSqm, 0);
    const sumXX = pricedProducts.reduce((s, p) => s + p.baseArea * p.baseArea, 0);
    
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return null;
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }
  
  // Apply trend line to fill in prices for products without prices
  function applyTrendToAllProducts() {
    const pricedProducts = pricingProducts.filter(p => p.pricePerSqm > 0);
    if (pricedProducts.length < 2) {
      log('Need at least 2 products with prices to calculate trend', 'warning');
      return;
    }
    
    const trend = calculateTrendLine(pricingProducts);
    if (!trend) {
      log('Could not calculate trend line', 'error');
      return;
    }
    
    let filled = 0;
    pricingProducts = pricingProducts.map(p => {
      if (p.pricePerSqm === 0 || p.basePrice === 0) {
        // Calculate price from trend line
        const trendPricePerSqm = Math.max(0, trend.slope * p.baseArea + trend.intercept);
        filled++;
        return {
          ...p,
          pricePerSqm: Math.round(trendPricePerSqm),
          basePrice: Math.round(trendPricePerSqm * p.baseArea)
        };
      }
      return p;
    });
    
    log(`Applied trend to ${filled} products`, 'success');
  }
  
  function addProduct() {
    pricingProducts = [...pricingProducts, {
      productName: '',
      frontage: 12,
      depth: 28,
      baseArea: 336,
      basePrice: 0,
      pricePerSqm: 0,
      balanceRate: 50
    }];
  }
  
  function removeProduct(index: number) {
    pricingProducts = pricingProducts.filter((_, i) => i !== index);
  }
  
  function calculateLotPrice(lot: any): { basePrice: number; balancePrice: number; totalPrice: number; matchedProduct: string; pricePerSqm: number } | null {
    if (!lot.frontage || !lot.depth || pricingProducts.length === 0) return null;
    
    const lotFrontage = parseFloat(lot.frontage);
    const lotDepth = parseFloat(lot.depth);
    const lotArea = parseFloat(lot.area) || lotFrontage * lotDepth;
    
    if (lotFrontage <= 0 || lotDepth <= 0) return null;
    
    // Filter products with prices set
    const pricedProducts = pricingProducts.filter(p => p.basePrice > 0);
    if (pricedProducts.length === 0) return null;
    
    // Best practice: Find closest frontage WITHOUT going over lot frontage
    // Then find closest depth WITHOUT going over lot depth
    let bestMatch: typeof pricedProducts[0] | null = null;
    let bestScore = -Infinity;
    
    for (const product of pricedProducts) {
      // Prefer products with frontage <= lot frontage
      const frontageOK = product.frontage <= lotFrontage + 0.5;
      const depthOK = product.depth <= lotDepth + 0.5;
      
      if (frontageOK) {
        // Score: prefer closest frontage without going over (higher = better)
        const frontageScore = lotFrontage - product.frontage;
        const depthScore = depthOK ? (lotDepth - product.depth) : -50;
        
        // Combined score: prioritize frontage match, then depth
        const score = 100 - frontageScore * 10 - Math.abs(depthScore);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = product;
        }
      }
    }
    
    // If no product fits (lot smaller than all products), use smallest product
    if (!bestMatch) {
      bestMatch = pricedProducts.reduce((min, p) => p.baseArea < min.baseArea ? p : min, pricedProducts[0]);
    }
    
    const basePrice = bestMatch.basePrice;
    const baseArea = bestMatch.baseArea;
    const balanceArea = Math.max(0, lotArea - baseArea);
    const balanceRate = bestMatch.balanceRate / 100;
    const balancePrice = balanceArea * bestMatch.pricePerSqm * balanceRate;
    const totalPrice = basePrice + balancePrice;
    
    return {
      basePrice,
      balancePrice,
      totalPrice,
      matchedProduct: bestMatch.productName || `${bestMatch.frontage}x${bestMatch.depth}`,
      pricePerSqm: Math.round(totalPrice / lotArea)
    };
  }
  
  // Apply pricing to all Masterplan status lots
  async function applyPricingToMasterplanLots() {
    if (!selectedNode || selectedNode.type !== 'stage') {
      log('Select a stage to apply pricing', 'error');
      return;
    }
    
    const masterplanLots = tableData.filter(lot => lot.status?.toLowerCase() === 'masterplan');
    if (masterplanLots.length === 0) {
      log('No lots with Masterplan status found', 'warning');
      return;
    }
    
    if (pricingProducts.length === 0 || !pricingProducts.some(p => p.basePrice > 0)) {
      log('Set up pricing products first', 'error');
      return;
    }
    
    let updated = 0;
    for (const lot of masterplanLots) {
      const pricing = calculateLotPrice(lot);
      if (pricing) {
        try {
          await fetch(`/api/lots/${lot.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              price: pricing.totalPrice,
              pricePerSqm: pricing.pricePerSqm
            })
          });
          updated++;
        } catch (e) {
          console.error('Failed to update lot pricing:', e);
        }
      }
    }
    
    log(`Applied pricing to ${updated} Masterplan lots`, 'success');
    await reloadTableData();
  }
  
  // Accept indicative price for a single lot
  async function acceptIndicativePrice(lot: any, price: number, pricePerSqm: number) {
    try {
      const res = await fetch(`/api/lots/${lot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, pricePerSqm })
      });
      if (res.ok) {
        lot.price = price;
        lot.pricePerSqm = pricePerSqm;
        tableData = [...tableData];
        log(`Accepted price $${price.toLocaleString()} for Lot ${lot.lotNumber || lot.name}`, 'success');
      }
    } catch (e) {
      log('Failed to save price', 'error');
    }
  }
  
  // Stage-level pricing review state
  let showPricingReview = false;
  let stagePriceEdits: Map<number, { price: number; pricePerSqm: number; originalPrice: number; indicativePrice: number }> = new Map();
  let savingAllPrices = false;
  
  // Stage table tabs
  let stageTableTab: 'main' | 'dates' | 'pricing' = 'main';
  
  // ===== PRECINCT FORECASTING TOOL =====
  let showForecastTool = false;
  let forecastMode: 'sold_date' | 'exchange_date' | 'settled_date' | 'cancelled_date' | 'combined' = 'sold_date';
  let forecastPeriod: 'days' | 'months' | 'quarters' | 'halfyear' | 'year' = 'months';
  let forecastRange = 6; // +/- from current
  let forecastPeriodOffset = 0; // Navigation offset for << and >>
  let forecastEditMode = false;
  let forecastExpandedStages: Set<number> = new Set(); // Track which stages are expanded to show lot details
  let forecastLotSort: 'number' | 'date' | 'status' | 'price' = 'number'; // Lot sorting option
  let forecastLotSortAsc: boolean = true; // Sort direction: true = ascending, false = descending
  let forecastData: Map<number, Map<string, number>> = new Map(); // stageId -> (period -> lot count) - EDITED values (pending only in edit mode)
  let forecastOriginalData: Map<number, Map<string, number>> = new Map(); // Original values before edit
  let forecastActualData: Map<number, Map<string, number>> = new Map(); // stageId -> (period -> actual lot count) - LOCKED, cannot edit
  let forecastManualData: Map<number, Map<string, number>> = new Map(); // stageId -> (period -> manual lot count) - Protected from reforecast
  let forecastStages: any[] = [];
  let forecastPeriodsKey = 0; // Force reactivity
  
  // ===== RESPONSIVE UI STATE =====
  let treeNavCollapsed = false;
  
  // ===== LAND BUDGET (Stage-level editable) =====
  let showStageLandBudget = false;
  let stageLandBudgetData: any[] = [];
  let stageLandBudgetCategories: any = {};
  let stageLandBudgetLotAreaHa = 0;
  let stageLandBudgetEditMode = false;
  let stageLandBudgetEditValues: Map<string, string> = new Map();
  let stageLandBudgetNameEdits: Map<string, string> = new Map();
  let loadingStageLandBudget = false;
  let stageLbExpandedCategories: Set<string> = new Set(); // Start collapsed
  let stageLandBudgetLoaded = false; // Track if data has been loaded for current node
  
  // ===== LAND BUDGET SUMMARY (Precinct-level read-only) =====
  let showLandBudget = false;
  let landBudgetData: any[] = [];
  let landBudgetCategories: any = {};
  let landBudgetLotAreaHa = 0;
  let landBudgetStageData: Record<number, { name: string; items: any[] }> = {};
  let landBudgetStages: any[] = [];
  let loadingLandBudget = false;
  let lbExpandedCategories: Set<string> = new Set(); // Start collapsed
  let landBudgetLoaded = false; // Track if data has been loaded for current node
  let lbExpandedStages: Set<string> = new Set(); // Which category:stageId combos are expanded
  
  function toggleLbCategory(cat: string) {
    if (lbExpandedCategories.has(cat)) {
      lbExpandedCategories.delete(cat);
    } else {
      lbExpandedCategories.add(cat);
    }
    lbExpandedCategories = new Set(lbExpandedCategories);
  }
  
  function toggleStageLbCategory(cat: string) {
    if (stageLbExpandedCategories.has(cat)) {
      stageLbExpandedCategories.delete(cat);
    } else {
      stageLbExpandedCategories.add(cat);
    }
    stageLbExpandedCategories = new Set(stageLbExpandedCategories);
  }
  
  function toggleLbStage(catStageKey: string) {
    if (lbExpandedStages.has(catStageKey)) {
      lbExpandedStages.delete(catStageKey);
    } else {
      lbExpandedStages.add(catStageKey);
    }
    lbExpandedStages = new Set(lbExpandedStages);
  }
  
  function toggleStageLandBudget() {
    showStageLandBudget = !showStageLandBudget;
  }
  
  function togglePrecinctLandBudget() {
    showLandBudget = !showLandBudget;
  }
  
  // Reactive periods - recalculates when period type or range changes
  $: forecastPeriods = (() => {
    // Reference the key to force recalculation
    const _ = forecastPeriodsKey;
    const now = new Date();
    const periods: { key: string; label: string; start: Date; end: Date; midDate: string }[] = [];
    
    if (forecastPeriod === 'months') {
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i + forecastPeriodOffset, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + i + forecastPeriodOffset + 1, 0);
        // Mid-month = 15th
        const mid = new Date(d.getFullYear(), d.getMonth(), 15);
        periods.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          label: d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
          start: d,
          end: end,
          midDate: mid.toISOString().slice(0, 10)
        });
      }
    } else if (forecastPeriod === 'quarters') {
      const currentQ = Math.floor(now.getMonth() / 3);
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const qOffset = currentQ + i + forecastPeriodOffset;
        const year = now.getFullYear() + Math.floor(qOffset / 4);
        const q = ((qOffset % 4) + 4) % 4;
        const startMonth = q * 3;
        const d = new Date(year, startMonth, 1);
        const end = new Date(year, startMonth + 3, 0);
        // Mid-quarter = 15th of middle month (month+1)
        const mid = new Date(year, startMonth + 1, 15);
        periods.push({
          key: `${year}-Q${q + 1}`,
          label: `Q${q + 1} ${String(year).slice(-2)}`,
          start: d,
          end: end,
          midDate: mid.toISOString().slice(0, 10)
        });
      }
    } else if (forecastPeriod === 'halfyear') {
      const currentH = Math.floor(now.getMonth() / 6);
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const hOffset = currentH + i + forecastPeriodOffset;
        const year = now.getFullYear() + Math.floor(hOffset / 2);
        const h = ((hOffset % 2) + 2) % 2;
        const startMonth = h * 6;
        const d = new Date(year, startMonth, 1);
        const end = new Date(year, startMonth + 6, 0);
        // Mid-half = 15th of middle month (month+2 for H1=Mar, month+2 for H2=Sep)
        const mid = new Date(year, startMonth + 2, 15);
        periods.push({
          key: `${year}-H${h + 1}`,
          label: `H${h + 1} ${year}`,
          start: d,
          end: end,
          midDate: mid.toISOString().slice(0, 10)
        });
      }
    } else if (forecastPeriod === 'year') {
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const year = now.getFullYear() + i + forecastPeriodOffset;
        // Mid-year = July 1 (or June 15 for mid-point)
        const mid = new Date(year, 5, 15); // June 15
        periods.push({
          key: `${year}`,
          label: `FY${String(year).slice(-2)}`,
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31),
          midDate: mid.toISOString().slice(0, 10)
        });
      }
    } else { // days
      for (let i = -forecastRange; i <= forecastRange; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i + forecastPeriodOffset);
        periods.push({
          key: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }),
          start: new Date(d),
          end: new Date(d),
          midDate: d.toISOString().slice(0, 10)
        });
      }
    }
    return periods;
  })();
  
  // Reset forecast tool when precinct changes
  function resetForecastTool() {
    showForecastTool = false;
    forecastEditMode = false;
    forecastData = new Map();
    forecastActualData = new Map();
    forecastManualData = new Map();
    forecastStages = [];
    forecastPeriodOffset = 0;
    forecastPeriodsKey++;
  }
  
  // ===== STAGE LAND BUDGET FUNCTIONS (Editable) =====
  function resetStageLandBudget() {
    showStageLandBudget = false;
    stageLandBudgetData = [];
    stageLandBudgetCategories = {};
    stageLandBudgetLotAreaHa = 0;
    stageLandBudgetEditMode = false;
    stageLandBudgetEditValues = new Map();
    stageLandBudgetNameEdits = new Map();
  }
  
  async function loadStageLandBudget(stageId?: number) {
    const id = stageId || selectedNode?.id;
    if (!id) return;
    
    loadingStageLandBudget = true;
    try {
      const res = await fetch(`/api/land-budget?stageId=${id}`);
      if (res.ok) {
        const data = await res.json();
        stageLandBudgetData = data.items || [];
        stageLandBudgetCategories = data.categories || {};
        stageLandBudgetLotAreaHa = data.lotAreaHa || 0;
        
        // Initialize edit values from existing data
        stageLandBudgetEditValues = new Map();
        for (const item of stageLandBudgetData) {
          const key = item.subcategory ? `${item.category}:${item.subcategory}` : `${item.category}:_total`;
          stageLandBudgetEditValues.set(key, item.areaHa || '');
        }
      }
    } catch (e) {
      console.error('Failed to load stage land budget:', e);
    }
    loadingStageLandBudget = false;
  }
  
  function getStageLandBudgetValue(category: string, subcategory?: string): string {
    const key = subcategory ? `${category}:${subcategory}` : `${category}:_total`;
    if (stageLandBudgetEditMode) {
      return stageLandBudgetEditValues.get(key) || '';
    }
    const item = stageLandBudgetData.find(i => i.category === category && (subcategory ? i.subcategory === subcategory : !i.subcategory));
    return item?.areaHa || '';
  }
  
  function setStageLandBudgetValue(category: string, subcategory: string | undefined, value: string) {
    const key = subcategory ? `${category}:${subcategory}` : `${category}:_total`;
    stageLandBudgetEditValues.set(key, value);
    stageLandBudgetEditValues = new Map(stageLandBudgetEditValues);
  }
  
  function calculateStageLandBudgetTotal(categories: string[]): number {
    let total = 0;
    for (const cat of categories) {
      const catConfig = stageLandBudgetCategories[cat];
      if (!catConfig) continue;
      
      if (catConfig.subcategories && catConfig.subcategories.length > 0) {
        for (const sub of catConfig.subcategories) {
          const val = parseFloat(getStageLandBudgetValue(cat, sub.key) || '0');
          if (!isNaN(val)) total += val;
        }
      } else {
        const val = parseFloat(getStageLandBudgetValue(cat) || '0');
        if (!isNaN(val)) total += val;
      }
    }
    return total;
  }
  
  async function saveStageLandBudget() {
    if (!selectedNode || selectedNode.type !== 'stage') return;
    
    const items: any[] = [];
    for (const [key, value] of stageLandBudgetEditValues) {
      const [category, subcategory] = key.split(':');
      const nameKey = `${category}:${subcategory}`;
      const customName = stageLandBudgetNameEdits.get(nameKey);
      const catConfig = stageLandBudgetCategories[category];
      const subConfig = catConfig?.subcategories?.find((s: any) => s.key === subcategory);
      
      items.push({
        category,
        subcategory: subcategory === '_total' ? null : subcategory,
        areaHa: value ? parseFloat(value) || 0 : 0,
        customName: customName || null,
        isCustom: subConfig?.isCustom ? 1 : 0
      });
    }
    
    try {
      const res = await fetch('/api/land-budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: selectedNode.id, items })
      });
      
      if (res.ok) {
        stageLandBudgetEditMode = false;
        stageLandBudgetNameEdits = new Map();
        // Use show/hide toggle to force UI refresh
        showStageLandBudget = false;
        await loadStageLandBudget();
        showStageLandBudget = true;
        
        // Also refresh parent precinct's land budget summary if it exists
        if (selectedNode?.parentId) {
          const parentNode = findNodeById(tree, selectedNode.parentId);
          if (parentNode?.type === 'precinct') {
            // Trigger precinct summary refresh by reloading landBudgetData
            const precinctRes = await fetch(`/api/land-budget?precinctId=${parentNode.id}`);
            if (precinctRes.ok) {
              const precinctData = await precinctRes.json();
              landBudgetData = precinctData.items || [];
              landBudgetStageData = precinctData.stageData || {};
              landBudgetStages = precinctData.stages || [];
            }
          }
        }
        
        log('Land budget saved', 'success');
      } else {
        log('Failed to save land budget', 'error');
      }
    } catch (e) {
      console.error('Failed to save land budget:', e);
      log('Failed to save land budget', 'error');
    }
  }
  
  function cancelStageLandBudgetEdit() {
    stageLandBudgetEditMode = false;
    stageLandBudgetEditValues = new Map();
    stageLandBudgetNameEdits = new Map();
    for (const item of stageLandBudgetData) {
      const key = item.subcategory ? `${item.category}:${item.subcategory}` : `${item.category}:_total`;
      stageLandBudgetEditValues.set(key, item.areaHa || '');
    }
  }
  
  function getStageLandBudgetSubName(category: string, subKey: string): string {
    const nameKey = `${category}:${subKey}`;
    if (stageLandBudgetEditMode && stageLandBudgetNameEdits.has(nameKey)) {
      return stageLandBudgetNameEdits.get(nameKey) || '';
    }
    const catConfig = stageLandBudgetCategories[category];
    const sub = catConfig?.subcategories?.find((s: any) => s.key === subKey);
    return sub?.name || subKey;
  }
  
  function setStageLandBudgetSubName(category: string, subKey: string, name: string) {
    const nameKey = `${category}:${subKey}`;
    stageLandBudgetNameEdits.set(nameKey, name);
    stageLandBudgetNameEdits = new Map(stageLandBudgetNameEdits);
  }
  
  function addStageLandBudgetSubcategory(category: string) {
    if (!stageLandBudgetCategories[category]) return;
    
    const subs = stageLandBudgetCategories[category].subcategories || [];
    const newKey = `custom_${Date.now()}`;
    const newSub = { key: newKey, name: 'New Item', isCustom: true };
    
    stageLandBudgetCategories[category].subcategories = [...subs, newSub];
    stageLandBudgetCategories = { ...stageLandBudgetCategories };
    
    setStageLandBudgetValue(category, newKey, '0');
  }
  
  function removeStageLandBudgetSubcategory(category: string, subKey: string) {
    if (!stageLandBudgetCategories[category]) return;
    
    const subs = stageLandBudgetCategories[category].subcategories || [];
    // Don't allow deleting if only one item remains
    if (subs.length <= 1) return;
    
    stageLandBudgetCategories[category].subcategories = subs.filter((s: any) => s.key !== subKey);
    stageLandBudgetCategories = { ...stageLandBudgetCategories };
    
    const key = `${category}:${subKey}`;
    stageLandBudgetEditValues.delete(key);
    stageLandBudgetEditValues = new Map(stageLandBudgetEditValues);
  }
  
  // ===== PRECINCT LAND BUDGET SUMMARY (Read-only aggregated) =====
  function resetLandBudget() {
    showLandBudget = false;
    landBudgetData = [];
    landBudgetCategories = {};
    landBudgetLotAreaHa = 0;
    landBudgetStageData = {};
    landBudgetStages = [];
  }
  
  async function loadLandBudget(precinctId?: number) {
    const id = precinctId || selectedNode?.id;
    if (!id) return;
    
    loadingLandBudget = true;
    try {
      const res = await fetch(`/api/land-budget?precinctId=${id}`);
      if (res.ok) {
        const data = await res.json();
        landBudgetData = data.items || [];
        landBudgetCategories = data.categories || {};
        landBudgetLotAreaHa = data.lotAreaHa || 0;
        landBudgetStageData = data.stageData || {};
        landBudgetStages = data.stages || [];
      }
    } catch (e) {
      console.error('Failed to load land budget:', e);
    }
    loadingLandBudget = false;
  }
  
  // Get aggregated value for precinct (sum of all stages)
  function getLandBudgetValue(category: string, subcategory?: string): string {
    let total = 0;
    for (const stageId of Object.keys(landBudgetStageData)) {
      const stageItems = landBudgetStageData[parseInt(stageId)]?.items || [];
      for (const item of stageItems) {
        if (item.category === category && (subcategory ? item.subcategory === subcategory : !item.subcategory)) {
          total += parseFloat(item.areaHa || '0');
        }
      }
    }
    return total > 0 ? total.toFixed(4) : '';
  }
  
  // Get value for a specific stage
  function getLandBudgetStageValue(stageId: number, category: string, subcategory?: string): string {
    const stageItems = landBudgetStageData[stageId]?.items || [];
    const item = stageItems.find(i => i.category === category && (subcategory ? i.subcategory === subcategory : !i.subcategory));
    return item?.areaHa || '';
  }
  
  function calculateLandBudgetTotal(categories: string[]): number {
    let total = 0;
    for (const cat of categories) {
      const catConfig = landBudgetCategories[cat];
      if (!catConfig) continue;
      
      if (catConfig.subcategories && catConfig.subcategories.length > 0) {
        for (const sub of catConfig.subcategories) {
          const val = parseFloat(getLandBudgetValue(cat, sub.key) || '0');
          if (!isNaN(val)) total += val;
        }
      } else {
        const val = parseFloat(getLandBudgetValue(cat) || '0');
        if (!isNaN(val)) total += val;
      }
    }
    return total;
  }
  
  function getLandBudgetSubName(category: string, subKey: string): string {
    const catConfig = landBudgetCategories[category];
    const sub = catConfig?.subcategories?.find((s: any) => s.key === subKey);
    return sub?.name || subKey;
  }
  
  
  // Navigate forecast periods
  function forecastNavigatePrev() {
    forecastPeriodOffset--;
    forecastPeriodsKey++;
  }
  
  function forecastNavigateNext() {
    forecastPeriodOffset++;
    forecastPeriodsKey++;
  }
  
  function forecastNavigateReset() {
    forecastPeriodOffset = 0;
    forecastPeriodsKey++;
  }
  
  // Track last period type to detect changes
  let lastForecastPeriod: 'days' | 'months' | 'quarters' | 'halfyear' | 'year' = forecastPeriod;
  let lastForecastMode: 'sold_date' | 'exchange_date' | 'settled_date' | 'cancelled_date' | 'combined' = forecastMode;
  
  // Reload forecast data when period type or mode changes (but NOT during edit mode)
  $: if (showForecastTool && forecastStages.length > 0 && !forecastEditMode && 
         (forecastPeriod !== lastForecastPeriod || forecastMode !== lastForecastMode)) {
    lastForecastPeriod = forecastPeriod;
    lastForecastMode = forecastMode;
    // Re-bucket existing lot data into new periods - track actual, manual, and auto separately
    const newForecastData = new Map<number, Map<string, number>>();
    const newActualData = new Map<number, Map<string, number>>();
    const newManualData = new Map<number, Map<string, number>>();
    for (const stage of forecastStages) {
      const stageMap = new Map<string, number>();
      const actualMap = new Map<string, number>();
      const manualMap = new Map<string, number>();
      if (stage.lots && stage.lots.length > 0) {
        for (const lot of stage.lots) {
          const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
          const dateValue = customData[forecastMode];
          if (dateValue) {
            const periodKey = getPeriodKeyForDate(dateValue);
            stageMap.set(periodKey, (stageMap.get(periodKey) || 0) + 1);
            
            // Check if this date is marked as actual (confirmed)
            const actualField = `${forecastMode}_actual`;
            if (customData[actualField]) {
              actualMap.set(periodKey, (actualMap.get(periodKey) || 0) + 1);
            }
            // Check if this date was manually assigned
            const manualField = `${forecastMode}_manual`;
            if (customData[manualField] && !customData[actualField]) {
              manualMap.set(periodKey, (manualMap.get(periodKey) || 0) + 1);
            }
          }
        }
      }
      newForecastData.set(stage.id, stageMap);
      newActualData.set(stage.id, actualMap);
      newManualData.set(stage.id, manualMap);
    }
    forecastData = newForecastData;
    forecastActualData = newActualData;
    forecastManualData = newManualData;
    forecastPeriodsKey++;
  }
  
  // Load forecast data for precinct
  async function loadForecastData() {
    if (!selectedNode || selectedNode.type !== 'precinct') return;
    
    try {
      const res = await fetch(`/api/stages?precinctId=${selectedNode.id}`);
      const stages = await res.json();
      forecastStages = stages;
      
      // Initialize forecast data from stage lots - separate actual, manual, and auto
      const newData = new Map<number, Map<string, number>>(); // Total counts
      const newActualData = new Map<number, Map<string, number>>(); // Actual (confirmed) counts only
      const newManualData = new Map<number, Map<string, number>>(); // Manual (user-assigned) counts
      
      for (const stage of stages) {
        const stageMap = new Map<string, number>();
        const actualMap = new Map<string, number>();
        const manualMap = new Map<string, number>();
        
        if (stage.lots && stage.lots.length > 0) {
          for (const lot of stage.lots) {
            const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
            const dateValue = customData[forecastMode];
            if (dateValue) {
              const periodKey = getPeriodKeyForDate(dateValue);
              stageMap.set(periodKey, (stageMap.get(periodKey) || 0) + 1);
              
              // Check if this date is marked as actual (confirmed)
              const actualField = `${forecastMode}_actual`;
              if (customData[actualField]) {
                actualMap.set(periodKey, (actualMap.get(periodKey) || 0) + 1);
              }
              // Check if this date was manually assigned (but not actual)
              const manualField = `${forecastMode}_manual`;
              if (customData[manualField] && !customData[actualField]) {
                manualMap.set(periodKey, (manualMap.get(periodKey) || 0) + 1);
              }
            }
          }
        }
        
        newData.set(stage.id, stageMap);
        newActualData.set(stage.id, actualMap);
        newManualData.set(stage.id, manualMap);
      }
      
      forecastData = newData;
      forecastActualData = newActualData;
      forecastManualData = newManualData;
      // Store original for comparison during save
      forecastOriginalData = new Map();
      for (const [stageId, stageMap] of newData.entries()) {
        forecastOriginalData.set(stageId, new Map(stageMap));
      }
    } catch (e) {
      console.error('Failed to load forecast data:', e);
    }
  }
  
  // Toggle forecast stage expansion to show lot details
  function toggleForecastStageExpand(stageId: number) {
    if (forecastExpandedStages.has(stageId)) {
      forecastExpandedStages.delete(stageId);
    } else {
      forecastExpandedStages.add(stageId);
    }
    forecastExpandedStages = new Set(forecastExpandedStages); // Trigger reactivity
  }

  // Get sorted lots for a stage - maintains stable order
  function getSortedLots(lots: any[]): any[] {
    if (!lots || lots.length === 0) return [];
    
    // Create a copy to avoid mutating original
    const sorted = [...lots];
    
    sorted.sort((a, b) => {
      const aCustom = a.customData ? (typeof a.customData === 'string' ? JSON.parse(a.customData) : a.customData) : {};
      const bCustom = b.customData ? (typeof b.customData === 'string' ? JSON.parse(b.customData) : b.customData) : {};
      
      let result = 0;
      
      if (forecastLotSort === 'number') {
        // Sort by lot number (natural sort)
        const aNum = parseInt(a.lotNumber || a.name || '0') || 0;
        const bNum = parseInt(b.lotNumber || b.name || '0') || 0;
        result = aNum - bNum;
      } else if (forecastLotSort === 'date') {
        // Sort by forecast date (nulls last regardless of direction)
        const aDate = aCustom[forecastMode] || '';
        const bDate = bCustom[forecastMode] || '';
        if (!aDate && !bDate) result = 0;
        else if (!aDate) result = 1; // nulls always last
        else if (!bDate) result = -1;
        else result = aDate.localeCompare(bDate);
      } else if (forecastLotSort === 'status') {
        // Sort by status: Actual > Forecast > None (asc) or None > Forecast > Actual (desc)
        const aStatus = aCustom[`${forecastMode}_actual`] ? 2 : (aCustom[forecastMode] ? 1 : 0);
        const bStatus = bCustom[`${forecastMode}_actual`] ? 2 : (bCustom[forecastMode] ? 1 : 0);
        result = aStatus - bStatus;
      } else if (forecastLotSort === 'price') {
        // Sort by price
        const aPrice = parseFloat(a.price) || 0;
        const bPrice = parseFloat(b.price) || 0;
        result = aPrice - bPrice;
      }
      
      // Apply sort direction (except for null handling in date sort)
      return forecastLotSortAsc ? result : -result;
    });
    
    return sorted;
  }

  // Start editing forecast - snapshot current state
  function startForecastEdit() {
    // Deep copy current data as original baseline
    forecastOriginalData = new Map();
    for (const [stageId, stageMap] of forecastData.entries()) {
      forecastOriginalData.set(stageId, new Map(stageMap));
    }
    forecastEditMode = true;
  }
  
  // Get period key for a date
  function getPeriodKeyForDate(dateStr: string): string {
    // Parse date string directly to avoid timezone issues
    // Format expected: "YYYY-MM-DD"
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]); // 1-indexed from string
    
    if (forecastPeriod === 'months') {
      return `${year}-${String(month).padStart(2, '0')}`;
    } else if (forecastPeriod === 'quarters') {
      return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
    } else if (forecastPeriod === 'halfyear') {
      return `${year}-H${Math.floor((month - 1) / 6) + 1}`;
    } else if (forecastPeriod === 'year') {
      return `${year}`;
    }
    return dateStr.slice(0, 10);
  }
  
  // Get unallocated lots for a stage
  function getUnallocatedLots(stageId: number): number {
    const stage = forecastStages.find(s => s.id === stageId);
    if (!stage || !stage.lots) return 0;
    
    const allocated = Array.from(forecastData.get(stageId)?.values() || []).reduce((a, b) => a + b, 0);
    return stage.lots.length - allocated;
  }
  
  // Get stage lot stats for a period
  function getStagePeriodStats(stageId: number, periodKey: string): { lots: number; area: number; avgArea: number; totalPrice: number; avgPrice: number; pricePerSqm: number } {
    const stage = forecastStages.find(s => s.id === stageId);
    const lotCount = forecastData.get(stageId)?.get(periodKey) || 0;
    
    if (!stage || !stage.lots || lotCount === 0) {
      return { lots: 0, area: 0, avgArea: 0, totalPrice: 0, avgPrice: 0, pricePerSqm: 0 };
    }
    
    // Get lots that match this period
    const matchingLots = stage.lots.filter((lot: any) => {
      const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
      const dateValue = customData[forecastMode];
      return dateValue && getPeriodKeyForDate(dateValue) === periodKey;
    });
    
    const totalArea = matchingLots.reduce((sum: number, lot: any) => sum + (parseFloat(lot.area) || 0), 0);
    const totalPrice = matchingLots.reduce((sum: number, lot: any) => sum + (parseFloat(lot.price) || 0), 0);
    
    return {
      lots: lotCount,
      area: totalArea,
      avgArea: lotCount > 0 ? totalArea / lotCount : 0,
      totalPrice: totalPrice,
      avgPrice: lotCount > 0 ? totalPrice / lotCount : 0,
      pricePerSqm: totalArea > 0 ? totalPrice / totalArea : 0
    };
  }
  
  // Get column totals
  function getPeriodTotals(periodKey: string): { lots: number; area: number; avgArea: number; totalPrice: number; avgPrice: number; pricePerSqm: number } {
    let totalLots = 0;
    let totalArea = 0;
    let totalPrice = 0;
    
    for (const stage of forecastStages) {
      const stats = getStagePeriodStats(stage.id, periodKey);
      totalLots += stats.lots;
      totalArea += stats.area;
      totalPrice += stats.totalPrice;
    }
    
    return {
      lots: totalLots,
      area: totalArea,
      avgArea: totalLots > 0 ? totalArea / totalLots : 0,
      totalPrice: totalPrice,
      avgPrice: totalLots > 0 ? totalPrice / totalLots : 0,
      pricePerSqm: totalArea > 0 ? totalPrice / totalArea : 0
    };
  }
  
  // Update forecast allocation
  function updateForecastAllocation(stageId: number, periodKey: string, value: number) {
    console.log(`updateForecastAllocation: stageId=${stageId}, periodKey=${periodKey}, value=${value}`);
    
    // Deep clone the Map to ensure reactivity
    const newData = new Map<number, Map<string, number>>();
    for (const [sid, stageMap] of forecastData.entries()) {
      newData.set(sid, new Map(stageMap));
    }
    
    if (!newData.has(stageId)) {
      newData.set(stageId, new Map());
    }
    newData.get(stageId)!.set(periodKey, Math.max(0, value));
    
    forecastData = newData;
    console.log('Updated forecastData for stage', stageId, ':', Array.from(newData.get(stageId)!.entries()));
  }
  
  // Update a single lot's forecast date
  async function updateLotForecastDate(lot: any, stageId: number, newDate: string) {
    try {
      let customData: Record<string, any> = {};
      if (lot.customData) {
        customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
      }
      
      if (newDate) {
        customData[forecastMode] = newDate;
      } else {
        delete customData[forecastMode];
        delete customData[`${forecastMode}_actual`];
      }
      
      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
      });
      
      if (res.ok) {
        lot.customData = JSON.stringify(customData);
        // Refresh forecast data to update totals
        await loadForecastData();
      }
    } catch (e) {
      console.error('Failed to update lot forecast date:', e);
    }
  }

  // Assign lot to a specific period by clicking on that period cell
  async function assignLotToPeriod(lot: any, stageId: number, periodKey: string) {
    try {
      // Parse period key to get a date in the middle of that period
      // Period key format: "2026-Q1" or "2026-01" depending on forecastInterval
      let targetDate: string;
      if (periodKey.includes('Q')) {
        // Quarterly: e.g., "2026-Q1" -> use first month of quarter, 15th day
        const [year, quarter] = periodKey.split('-Q');
        const quarterMonth = (parseInt(quarter) - 1) * 3 + 1; // Q1=1, Q2=4, Q3=7, Q4=10
        targetDate = `${year}-${String(quarterMonth).padStart(2, '0')}-15`;
      } else {
        // Monthly: e.g., "2026-01" -> use 15th day of month
        targetDate = `${periodKey}-15`;
      }
      
      let customData: Record<string, any> = {};
      if (lot.customData) {
        customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
      }
      
      customData[forecastMode] = targetDate;
      // Keep it as forecast (not actual) when clicking to move
      if (!customData[`${forecastMode}_actual`]) {
        customData[`${forecastMode}_actual`] = false;
      }
      
      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
      });
      
      if (res.ok) {
        lot.customData = JSON.stringify(customData);
        await loadForecastData();
      }
    } catch (e) {
      console.error('Failed to assign lot to period:', e);
    }
  }

  // Toggle lot actual/forecast status (cycles: none -> forecast -> actual -> none)
  async function toggleLotForecastStatus(lot: any, stageId: number) {
    try {
      let customData: Record<string, any> = {};
      if (lot.customData) {
        customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
      }
      
      const hasDate = !!customData[forecastMode];
      const isActual = !!customData[`${forecastMode}_actual`];
      
      if (!hasDate) {
        // No date set - set to today as forecast
        customData[forecastMode] = new Date().toISOString().split('T')[0];
        customData[`${forecastMode}_actual`] = false;
      } else if (!isActual) {
        // Has forecast date - mark as actual
        customData[`${forecastMode}_actual`] = true;
      } else {
        // Is actual - clear the date entirely
        delete customData[forecastMode];
        delete customData[`${forecastMode}_actual`];
      }
      
      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
      });
      
      if (res.ok) {
        lot.customData = JSON.stringify(customData);
        // Refresh forecast data to update totals
        await loadForecastData();
      }
    } catch (e) {
      console.error('Failed to toggle lot forecast status:', e);
    }
  }

  // Save forecast to lots - handles reallocation (unassign from decreased, assign to increased)
  async function saveForecast() {
    let updated = 0;
    let failed = 0;
    
    for (const stage of forecastStages) {
      if (!stage.lots || stage.lots.length === 0) continue;
      
      const originalAllocations = forecastOriginalData.get(stage.id) || new Map();
      const newAllocations = forecastData.get(stage.id) || new Map();
      
      // Collect all period keys from both original and new
      const allPeriodKeys = new Set([...originalAllocations.keys(), ...newAllocations.keys()]);
      
      // Pool of lots to reassign (will be populated from decreased periods)
      const lotsToReassign: any[] = [];
      
      // PHASE 1: Unassign lots from periods where count DECREASED (skip actual and manual lots)
      for (const periodKey of allPeriodKeys) {
        const originalCount = originalAllocations.get(periodKey) || 0;
        const newCount = newAllocations.get(periodKey) || 0;
        const delta = newCount - originalCount;
        
        if (delta < 0) {
          // Need to unassign |delta| lots from this period - but ONLY auto-assigned lots, not actuals or manual
          const lotsInPeriod = stage.lots.filter((lot: any) => {
            const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
            if (!customData[forecastMode]) return false;
            // Skip lots with actual (confirmed) dates - they cannot be unassigned
            const actualField = `${forecastMode}_actual`;
            if (customData[actualField]) return false;
            // Skip lots with manual flag - they are protected from reforecast
            const manualField = `${forecastMode}_manual`;
            if (customData[manualField]) return false;
            return getPeriodKeyForDate(customData[forecastMode]) === periodKey;
          });
          
          // Unassign the required number of pending lots
          const toUnassign = Math.min(Math.abs(delta), lotsInPeriod.length);
          for (let i = 0; i < toUnassign; i++) {
            const lot = lotsInPeriod[i];
            try {
              let customData: Record<string, any> = {};
              if (lot.customData) {
                customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
              }
              delete customData[forecastMode]; // Remove the date
              
              const res = await fetch('/api/lots', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
              });
              
              if (res.ok) {
                lot.customData = JSON.stringify(customData);
                lotsToReassign.push(lot); // Add to pool for reassignment
                updated++;
              } else {
                failed++;
              }
            } catch (e) {
              failed++;
            }
          }
        }
      }
      
      // Add originally unassigned lots to the pool (lots without any date for this mode)
      const unassignedLots = stage.lots.filter((lot: any) => {
        const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
        return !customData[forecastMode];
      });
      lotsToReassign.push(...unassignedLots);
      
      // PHASE 2: Assign lots to periods where count INCREASED
      let poolIndex = 0;
      for (const periodKey of allPeriodKeys) {
        const originalCount = originalAllocations.get(periodKey) || 0;
        const newCount = newAllocations.get(periodKey) || 0;
        const delta = newCount - originalCount;
        
        if (delta > 0) {
          // Need to assign |delta| lots to this period
          const period = forecastPeriods.find(p => p.key === periodKey);
          if (!period) continue;
          
          for (let i = 0; i < delta && poolIndex < lotsToReassign.length; i++) {
            const lot = lotsToReassign[poolIndex++];
            try {
              let customData: Record<string, any> = {};
              if (lot.customData) {
                customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
              }
              customData[forecastMode] = period.midDate;
              
              const res = await fetch('/api/lots', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lot.id, customData: JSON.stringify(customData) })
              });
              
              if (res.ok) {
                lot.customData = JSON.stringify(customData);
                updated++;
              } else {
                failed++;
              }
            } catch (e) {
              failed++;
            }
          }
        }
      }
    }
    
    forecastEditMode = false;
    
    if (updated === 0 && failed === 0) {
      log(`No changes to save (lots may already be assigned)`, 'info');
    } else if (failed === 0) {
      log(`Forecast saved: ${updated} lots updated`, 'success');
    } else {
      log(`Saved ${updated} lots, ${failed} failed`, 'warning');
    }
    
    // Refresh table data
    await loadForecastData();
    forecastPeriodsKey++;
  }
  
  // Combined forecast mode - category colors
  const forecastCategoryColors: Record<string, { text: string; bg: string; label: string }> = {
    sold_date: { text: '#9ece6a', bg: 'rgba(158, 206, 106, 0.15)', label: 'S' },
    exchange_date: { text: '#bb9af7', bg: 'rgba(187, 154, 247, 0.15)', label: 'X' },
    settled_date: { text: '#73daca', bg: 'rgba(115, 218, 202, 0.15)', label: 'T' },
    cancelled_date: { text: '#f7768e', bg: 'rgba(247, 118, 142, 0.15)', label: 'C' }
  };
  
  // Stage date colors for registration/settlement milestones
  const stageDateColors: Record<string, { bg: string; label: string }> = {
    registration: { bg: 'rgba(255, 158, 100, 0.25)', label: 'R' },
    settlement: { bg: 'rgba(100, 200, 255, 0.25)', label: 'S' }
  };
  
  // Get combined category data for a stage and period
  function getCombinedCellData(stageId: number, periodKey: string): { category: string; count: number }[] {
    const stage = forecastStages.find(s => s.id === stageId);
    if (!stage || !stage.lots) return [];
    
    const categories = ['sold_date', 'exchange_date', 'settled_date', 'cancelled_date'];
    const result: { category: string; count: number }[] = [];
    
    for (const category of categories) {
      const count = stage.lots.filter((lot: any) => {
        const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
        const dateValue = customData[category];
        return dateValue && getPeriodKeyForDate(dateValue) === periodKey;
      }).length;
      
      if (count > 0) {
        result.push({ category, count });
      }
    }
    
    return result;
  }
  
  // Get combined totals for a period across all stages
  function getCombinedPeriodTotals(periodKey: string): { category: string; count: number }[] {
    const categories = ['sold_date', 'exchange_date', 'settled_date', 'cancelled_date'];
    const totals: Record<string, number> = {};
    
    for (const stage of forecastStages) {
      const cellData = getCombinedCellData(stage.id, periodKey);
      for (const item of cellData) {
        totals[item.category] = (totals[item.category] || 0) + item.count;
      }
    }
    
    return categories.filter(c => totals[c] > 0).map(c => ({ category: c, count: totals[c] }));
  }
  
  // Check if a stage has a milestone date in a period
  function getStageMilestoneInPeriod(stage: any, periodKey: string): { type: 'registration' | 'settlement'; date: string } | null {
    if (stage.registrationDate) {
      const regKey = getPeriodKeyForDate(stage.registrationDate);
      if (regKey === periodKey) {
        return { type: 'registration', date: stage.registrationDate };
      }
    }
    if (stage.settlementDate) {
      const settKey = getPeriodKeyForDate(stage.settlementDate);
      if (settKey === periodKey) {
        return { type: 'settlement', date: stage.settlementDate };
      }
    }
    return null;
  }
  
  // Tab edit modes
  let datesTabEditMode = false;
  let pricingTabEditMode = false;
  let datesTabEdits: Map<number, Record<string, string>> = new Map();
  let pricingTabEdits: Map<number, Record<string, string>> = new Map();
  
  // Date status types: 'forecast' (future), 'actual' (confirmed past), 'pending' (past but unconfirmed)
  type DateStatus = 'forecast' | 'actual' | 'pending' | 'none';
  
  function getDateStatus(dateStr: string | null | undefined, isActual: boolean | number | undefined): DateStatus {
    if (!dateStr) return 'none';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date > today) {
      return 'forecast'; // Future date
    } else if (isActual) {
      return 'actual'; // Past date, confirmed as actual
    } else {
      return 'pending'; // Past date, not confirmed - needs attention
    }
  }
  
  // Get status indicator styles
  const dateStatusStyles: Record<DateStatus, { color: string; bg: string; border: string; label: string; title: string }> = {
    forecast: { color: '#e0af68', bg: 'rgba(224, 175, 104, 0.15)', border: '#e0af68', label: 'F', title: 'Forecast - Future date' },
    actual: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)', border: '#22c55e', label: 'A', title: 'Actual - Confirmed' },
    pending: { color: '#f7768e', bg: 'rgba(247, 118, 142, 0.15)', border: '#f7768e', label: 'P', title: 'Pending - Needs confirmation' },
    none: { color: '#565f89', bg: 'transparent', border: 'transparent', label: '', title: '' }
  };
  
  // Toggle actual confirmation for a lot date field
  async function toggleLotDateActual(lotId: number, dateField: string, currentCustomData: any) {
    const actualField = `${dateField}_actual`;
    const currentActual = currentCustomData[actualField] || false;
    const updatedCustomData = { ...currentCustomData, [actualField]: !currentActual };
    
    try {
      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lotId, customData: JSON.stringify(updatedCustomData) })
      });
      if (res.ok) {
        // Update local tableData
        const lotIndex = tableData.findIndex(l => l.id === lotId);
        if (lotIndex >= 0) {
          tableData[lotIndex].customData = updatedCustomData;
          tableData = [...tableData];
        }
        log(`Date ${!currentActual ? 'confirmed as actual' : 'reverted to pending'}`, 'success');
      }
    } catch (error) {
      log('Failed to update date status', 'error');
    }
  }
  
  // Toggle actual confirmation for a stage date field
  async function toggleStageDateActual(stageId: number, dateField: 'registrationDate' | 'settlementDate', currentActual: boolean) {
    const actualField = `${dateField}Actual`;
    
    try {
      const res = await fetch('/api/stages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stageId, [actualField]: !currentActual })
      });
      if (res.ok) {
        // Update entityDetails
        entityDetails = { ...entityDetails, [actualField]: !currentActual ? 1 : 0 };
        log(`Stage date ${!currentActual ? 'confirmed as actual' : 'reverted to pending'}`, 'success');
      }
    } catch (error) {
      log('Failed to update stage date status', 'error');
    }
  }
  
  // Start editing dates tab
  function startDatesTabEdit() {
    datesTabEditMode = true;
    datesTabEdits = new Map();
    tableData.forEach(row => {
      const customData = row.customData ? (typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData) : {};
      datesTabEdits.set(row.id, {
        on_market_date: customData.on_market_date || '',
        sold_date: customData.sold_date || '',
        exchange_date: customData.exchange_date || '',
        settled_date: customData.settled_date || '',
        cancelled_date: customData.cancelled_date || ''
      });
    });
    datesTabEdits = datesTabEdits;
    log('Editing Key Dates - Save when ready', 'info');
  }
  
  // Start editing pricing tab
  function startPricingTabEdit() {
    pricingTabEditMode = true;
    pricingTabEdits = new Map();
    tableData.forEach(row => {
      const customData = row.customData ? (typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData) : {};
      pricingTabEdits.set(row.id, {
        deposit_amount: customData.deposit_amount || '',
        deposit_date: customData.deposit_date || '',
        rebates: customData.rebates || '',
        discounts: customData.discounts || '',
        price_adjustments: customData.price_adjustments || ''
      });
    });
    pricingTabEdits = pricingTabEdits;
    log('Editing Pricing Details - Save when ready', 'info');
  }
  
  // Cancel tab edits
  function cancelDatesTabEdit() {
    datesTabEditMode = false;
    datesTabEdits = new Map();
    log('Dates editing cancelled', 'info');
  }
  
  function cancelPricingTabEdit() {
    pricingTabEditMode = false;
    pricingTabEdits = new Map();
    log('Pricing editing cancelled', 'info');
  }
  
  // Save dates tab edits
  async function saveDatesTabEdits() {
    let saved = 0;
    let failed = 0;
    
    for (const [lotId, edits] of datesTabEdits) {
      const lot = tableData.find(l => l.id === lotId);
      if (!lot) continue;
      
      try {
        let customData: Record<string, any> = {};
        if (lot.customData) {
          customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
        }
        
        // For each date field, check if the value changed and set the _manual flag
        const dateFields = ['on_market_date', 'sold_date', 'exchange_date', 'settled_date', 'cancelled_date'];
        for (const field of dateFields) {
          const oldValue = customData[field] || '';
          const newValue = edits[field] || '';
          if (newValue && newValue !== oldValue) {
            // User manually set/changed this date - mark as manual
            customData[`${field}_manual`] = true;
          } else if (!newValue && oldValue) {
            // User cleared this date - remove manual flag
            delete customData[`${field}_manual`];
          }
        }
        
        Object.assign(customData, edits);
        
        const res = await fetch('/api/lots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: lotId, customData: JSON.stringify(customData) })
        });
        
        if (res.ok) {
          lot.customData = JSON.stringify(customData);
          saved++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
    
    tableData = [...tableData];
    datesTabEditMode = false;
    datesTabEdits = new Map();
    
    if (failed === 0) {
      log(`Saved dates for ${saved} lots`, 'success');
    } else {
      log(`Saved ${saved} lots, ${failed} failed`, 'warning');
    }
  }
  
  // Save pricing tab edits
  async function savePricingTabEdits() {
    let saved = 0;
    let failed = 0;
    
    for (const [lotId, edits] of pricingTabEdits) {
      const lot = tableData.find(l => l.id === lotId);
      if (!lot) continue;
      
      try {
        let customData: Record<string, any> = {};
        if (lot.customData) {
          customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
        }
        
        Object.assign(customData, edits);
        
        const res = await fetch('/api/lots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: lotId, customData: JSON.stringify(customData) })
        });
        
        if (res.ok) {
          lot.customData = JSON.stringify(customData);
          saved++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
    
    tableData = [...tableData];
    pricingTabEditMode = false;
    pricingTabEdits = new Map();
    
    if (failed === 0) {
      log(`Saved pricing details for ${saved} lots`, 'success');
    } else {
      log(`Saved ${saved} lots, ${failed} failed`, 'warning');
    }
  }
  
  // Inline price editing mode for table view
  let inlinePriceEditMode = false;
  let inlinePriceEdits: Map<number, number> = new Map(); // lotId -> price
  
  // Start inline price editing mode
  function startInlinePriceEdit() {
    if (!selectedNode || selectedNode.type !== 'stage') return;
    
    inlinePriceEdits = new Map();
    
    // Initialize with current prices from database
    for (const lot of tableData) {
      const currentPrice = parseFloat(lot.price) || 0;
      // Always start with the current saved price
      inlinePriceEdits.set(lot.id, currentPrice);
    }
    
    inlinePriceEdits = inlinePriceEdits;
    inlinePriceEditMode = true;
    log('Editing prices for all lots - Save All when ready', 'info');
  }
  
  // Update inline price for a lot
  function updateInlinePrice(lotId: number, price: number) {
    inlinePriceEdits.set(lotId, price);
    inlinePriceEdits = inlinePriceEdits;
  }
  
  // Use indicative price for a lot
  function useIndicativePriceInline(lotId: number) {
    const lot = tableData.find(l => l.id === lotId);
    if (!lot) return;
    const indicative = calculateLotPrice(lot);
    if (indicative) {
      inlinePriceEdits.set(lotId, indicative.totalPrice);
      inlinePriceEdits = inlinePriceEdits;
      // Log price calculation breakdown for user review
      log(`Lot ${lot.lotNumber || lot.id}: Base ${indicative.matchedProduct} = $${indicative.basePrice.toLocaleString()} + Balance $${indicative.balancePrice.toLocaleString()} = $${indicative.totalPrice.toLocaleString()} ($${indicative.pricePerSqm}/m²)`, 'info');
    }
  }
  
  // Apply all suggested prices at once
  function applyAllSuggestedPrices() {
    let appliedCount = 0;
    for (const lot of tableData) {
      const indicative = calculateLotPrice(lot);
      if (indicative) {
        inlinePriceEdits.set(lot.id, indicative.totalPrice);
        appliedCount++;
      }
    }
    inlinePriceEdits = inlinePriceEdits;
    log(`Applied suggested pricing to ${appliedCount} lots`, 'success');
  }
  
  // Cancel inline price editing
  function cancelInlinePriceEdit() {
    inlinePriceEditMode = false;
    inlinePriceEdits = new Map();
    log('Price editing cancelled', 'info');
  }
  
  // Save all inline price edits
  async function saveAllInlinePrices() {
    if (!selectedNode || selectedNode.type !== 'stage') return;
    
    const updates: { lotId: number; price: number; pricePerSqm: number }[] = [];
    
    inlinePriceEdits.forEach((price, lotId) => {
      const lot = tableData.find(l => l.id === lotId);
      if (!lot) return;
      const originalPrice = parseFloat(lot.price) || 0;
      if (price !== originalPrice && price > 0) {
        const area = parseFloat(lot.area) || (parseFloat(lot.frontage) * parseFloat(lot.depth)) || 1;
        updates.push({ lotId, price, pricePerSqm: Math.round(price / area) });
      }
    });
    
    if (updates.length === 0) {
      log('No price changes to save', 'warning');
      return;
    }
    
    savingAllPrices = true;
    let saved = 0;
    let failed = 0;
    
    for (const update of updates) {
      try {
        const res = await fetch(`/api/lots/${update.lotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: update.price, pricePerSqm: update.pricePerSqm })
        });
        if (res.ok) {
          saved++;
          const lot = tableData.find(l => l.id === update.lotId);
          if (lot) {
            lot.price = update.price;
            lot.pricePerSqm = update.pricePerSqm;
          }
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
    
    tableData = [...tableData];
    savingAllPrices = false;
    inlinePriceEditMode = false;
    inlinePriceEdits = new Map();
    
    if (failed === 0) {
      log(`Saved pricing for ${saved} lots`, 'success');
    } else {
      log(`Saved ${saved} lots, ${failed} failed`, 'warning');
    }
  }
  
  // Update custom field in lot's customData
  async function updateCustomField(lotId: number, fieldKey: string, value: string) {
    const lot = tableData.find(l => l.id === lotId);
    if (!lot) return;
    
    try {
      // Parse existing customData or create new object
      let customData: Record<string, any> = {};
      if (lot.customData) {
        customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
      }
      
      // Update the field
      customData[fieldKey] = value;
      
      // Save to database
      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lotId, customData: JSON.stringify(customData) })
      });
      
      if (res.ok) {
        // Update local state
        lot.customData = JSON.stringify(customData);
        tableData = [...tableData];
      }
    } catch (e) {
      console.error('Failed to update custom field:', e);
    }
  }
  
  // Bulk update custom fields for selected rows
  async function applyBulkCustomFieldEdit() {
    if (!bulkEditField || !bulkEditValue || selectedRows.size === 0) return;
    
    let updated = 0;
    let failed = 0;
    
    for (const rowId of selectedRows) {
      const lot = tableData.find(l => l.id === rowId);
      if (!lot) continue;
      
      try {
        let customData: Record<string, any> = {};
        if (lot.customData) {
          customData = typeof lot.customData === 'string' ? JSON.parse(lot.customData) : { ...lot.customData };
        }
        
        customData[bulkEditField] = bulkEditValue;
        
        const res = await fetch('/api/lots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rowId, customData: JSON.stringify(customData) })
        });
        
        if (res.ok) {
          lot.customData = JSON.stringify(customData);
          updated++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
    
    tableData = [...tableData];
    
    if (failed === 0) {
      log(`Updated ${bulkEditField} for ${updated} lots`, 'success');
    } else {
      log(`Updated ${updated} lots, ${failed} failed`, 'warning');
    }
    
    clearSelection();
    bulkEditField = '';
    bulkEditValue = '';
  }
  
  // Count pending inline price changes
  $: inlinePriceChangeCount = (() => {
    let count = 0;
    inlinePriceEdits.forEach((price, lotId) => {
      const lot = tableData.find(l => l.id === lotId);
      if (lot) {
        const originalPrice = parseFloat(lot.price) || 0;
        if (price !== originalPrice && price > 0) count++;
      }
    });
    return count;
  })();
  
  // Initialize pricing review for all lots in stage
  function startPricingReview() {
    if (!selectedNode || selectedNode.type !== 'stage') return;
    
    stagePriceEdits = new Map();
    
    // Initialize edits for all lots with dimensions
    for (const lot of tableData) {
      const indicative = calculateLotPrice(lot);
      const currentPrice = parseFloat(lot.price) || 0;
      const indicativePrice = indicative?.totalPrice || 0;
      const pricePerSqm = indicative?.pricePerSqm || 0;
      
      stagePriceEdits.set(lot.id, {
        price: currentPrice > 0 ? currentPrice : indicativePrice,
        pricePerSqm: currentPrice > 0 ? (parseFloat(lot.pricePerSqm) || pricePerSqm) : pricePerSqm,
        originalPrice: currentPrice,
        indicativePrice: indicativePrice
      });
    }
    
    stagePriceEdits = stagePriceEdits; // trigger reactivity
    showPricingReview = true;
    log('Opened pricing review - edit prices and save all when ready', 'info');
  }
  
  // Update a single lot price in review
  function updateLotPriceInReview(lotId: number, newPrice: number) {
    const lot = tableData.find(l => l.id === lotId);
    const edit = stagePriceEdits.get(lotId);
    if (!edit || !lot) return;
    
    const area = parseFloat(lot.area) || (parseFloat(lot.frontage) * parseFloat(lot.depth)) || 1;
    edit.price = newPrice;
    edit.pricePerSqm = Math.round(newPrice / area);
    stagePriceEdits = stagePriceEdits; // trigger reactivity
  }
  
  // Apply indicative price to a lot in review
  function useIndicativePriceInReview(lotId: number) {
    const edit = stagePriceEdits.get(lotId);
    if (!edit) return;
    
    const lot = tableData.find(l => l.id === lotId);
    const indicative = lot ? calculateLotPrice(lot) : null;
    if (indicative) {
      edit.price = indicative.totalPrice;
      edit.pricePerSqm = indicative.pricePerSqm;
      stagePriceEdits = stagePriceEdits;
    }
  }
  
  // Apply indicative prices to all lots in review
  function applyIndicativeToAll() {
    for (const lot of tableData) {
      const indicative = calculateLotPrice(lot);
      const edit = stagePriceEdits.get(lot.id);
      if (indicative && edit) {
        edit.price = indicative.totalPrice;
        edit.pricePerSqm = indicative.pricePerSqm;
      }
    }
    stagePriceEdits = stagePriceEdits;
    log('Applied indicative prices to all lots', 'info');
  }
  
  // Get pending changes count
  $: pendingPriceChanges = (() => {
    let count = 0;
    stagePriceEdits.forEach((edit, lotId) => {
      if (edit.price !== edit.originalPrice) count++;
    });
    return count;
  })();
  
  // Reactive calculations for pricing review summary
  $: totalNewValue = Array.from(stagePriceEdits.values()).reduce((sum, e) => sum + e.price, 0);
  $: totalOriginalValue = Array.from(stagePriceEdits.values()).reduce((sum, e) => sum + e.originalPrice, 0);
  $: totalPriceDiff = totalNewValue - totalOriginalValue;
  
  // Save all pricing changes
  async function saveAllPrices() {
    if (!selectedNode || selectedNode.type !== 'stage') return;
    
    const updates: { lotId: number; price: number; pricePerSqm: number }[] = [];
    stagePriceEdits.forEach((edit, lotId) => {
      if (edit.price !== edit.originalPrice) {
        updates.push({ lotId, price: edit.price, pricePerSqm: edit.pricePerSqm });
      }
    });
    
    if (updates.length === 0) {
      log('No pricing changes to save', 'warning');
      return;
    }
    
    savingAllPrices = true;
    let saved = 0;
    let failed = 0;
    
    for (const update of updates) {
      try {
        const res = await fetch(`/api/lots/${update.lotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: update.price, pricePerSqm: update.pricePerSqm })
        });
        if (res.ok) {
          saved++;
          // Update local data
          const lot = tableData.find(l => l.id === update.lotId);
          if (lot) {
            lot.price = update.price;
            lot.pricePerSqm = update.pricePerSqm;
          }
          // Update original price in edits
          const edit = stagePriceEdits.get(update.lotId);
          if (edit) edit.originalPrice = update.price;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
    
    tableData = [...tableData];
    stagePriceEdits = stagePriceEdits;
    savingAllPrices = false;
    
    if (failed === 0) {
      log(`Saved pricing for ${saved} lots`, 'success');
      showPricingReview = false;
    } else {
      log(`Saved ${saved} lots, ${failed} failed`, 'warning');
    }
  }
  
  // Cancel pricing review
  function cancelPricingReview() {
    showPricingReview = false;
    stagePriceEdits = new Map();
    log('Pricing review cancelled', 'info');
  }
  
  // Calculate summary stats for current table data (lots)
  $: tableSummary = calculateSummary(tableData, selectedNode?.type);
  
  function calculateSummary(data: any[], entityType: string | undefined) {
    if (!data || data.length === 0 || entityType !== 'stage') return null;
    
    const totalLots = data.length;
    const totalArea = data.reduce((sum, lot) => sum + (parseFloat(lot.area) || 0), 0);
    const avgArea = totalArea / totalLots;
    const totalFrontage = data.reduce((sum, lot) => sum + (parseFloat(lot.frontage) || 0), 0);
    const streetNames = [...new Set(data.map(lot => lot.streetName).filter(Boolean))];
    
    return {
      totalLots,
      totalArea: totalArea.toFixed(2),
      avgArea: avgArea.toFixed(2),
      totalFrontage: totalFrontage.toFixed(2),
      streetNames
    };
  }
  
  const entityEndpoints: Record<string, string> = {
    'company': '/api/companies',
    'project': '/api/projects',
    'precinct': '/api/precincts',
    'stage': '/api/stages',
    'lot': '/api/lots',
    'subgroup': '/api/lot-subgroups'
  };
  
  const entityFields: Record<string, Array<{key: string, label: string}>> = {
    'company': [{key: 'name', label: 'Name'}, {key: 'abn', label: 'ABN'}, {key: 'owners', label: 'Owners'}],
    'project': [{key: 'name', label: 'Name'}, {key: 'description', label: 'Description'}],
    'precinct': [{key: 'name', label: 'Name'}, {key: 'description', label: 'Description'}],
    'stage': [{key: 'name', label: 'Name'}, {key: 'description', label: 'Description'}],
    'lot': [{key: 'lotNumber', label: 'Lot #'}, {key: 'address', label: 'Address'}, {key: 'area', label: 'Area'}, {key: 'status', label: 'Status'}],
    'subgroup': [{key: 'name', label: 'Name'}, {key: 'description', label: 'Description'}]
  };
  
  $: sortedTableData = sortData(tableData, sortColumn, sortDirection);
  
  function getFieldValue(row: any, column: string): any {
    if (column === 'name') {
      return row.name || row.lotNumber || row.invoiceNumber || '';
    }
    if (column === 'description') {
      return row.description || row.status || row.address || '';
    }
    return row[column] ?? '';
  }
  
  function sortData(data: any[], column: string, direction: 'asc' | 'desc') {
    if (!column) return data;
    return [...data].sort((a, b) => {
      let aVal = getFieldValue(a, column);
      let bVal = getFieldValue(b, column);
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  function toggleSort(column: string) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }
  
  const typeConfig: Record<string, {childEndpoint: string, childType: string, childKey: string}> = {
    'company': { childEndpoint: '/api/projects', childType: 'project', childKey: 'companyId' },
    'project': { childEndpoint: '/api/precincts', childType: 'precinct', childKey: 'projectId' },
    'precinct': { childEndpoint: '/api/stages', childType: 'stage', childKey: 'precinctId' },
    'stage': { childEndpoint: '/api/lots', childType: 'lot', childKey: 'stageId' },
    'lot': { childEndpoint: '/api/lot-subgroups', childType: 'subgroup', childKey: 'lotId' },
    'subgroup': { childEndpoint: '', childType: '', childKey: '' }
  };
  
  const typeLabels: Record<string, string> = {
    'company': 'CO',
    'project': 'PR', 
    'precinct': 'PC',
    'stage': 'ST',
    'lot': 'LT',
    'subgroup': 'SG'
  };
  
  const typeColors: Record<string, string> = {
    'company': '#7dcfff',
    'project': '#bb9af7',
    'precinct': '#f7768e',
    'stage': '#9ece6a',
    'lot': '#e0af68',
    'subgroup': '#73daca'
  };
  
  onMount(async () => {
    await checkAuth();
    if (currentUser) {
      await loadCompanies();
    }
  });
  
  function log(msg: string, type = 'info') {
    activityLog = [...activityLog, {time: new Date().toLocaleTimeString(), message: msg, type}].slice(-20);
  }
  
  // Custom fields functions
  async function loadCustomFields(entityType: string) {
    try {
      const res = await fetch(`/api/custom-fields?entityType=${entityType}`);
      customFields = await res.json();
    } catch (e) {
      console.error('Failed to load custom fields:', e);
    }
  }
  
  async function addCustomField() {
    if (!newFieldLabel.trim() || !selectedNode) return;
    
    // Determine the entity type for custom fields (lot, stage, precinct, etc.)
    const entityType = getCustomFieldEntityType();
    if (!entityType) return;
    
    const fieldKey = newFieldLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    try {
      const res = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          fieldKey,
          fieldLabel: newFieldLabel.trim(),
          fieldType: newFieldType
        })
      });
      
      if (res.ok) {
        log(`Added custom field "${newFieldLabel}" to all ${entityType}s`, 'success');
        newFieldLabel = '';
        await loadCustomFields(entityType);
      }
    } catch (e) {
      log(`Failed to add custom field: ${e}`, 'error');
    }
  }
  
  async function removeCustomField(fieldId: number, fieldLabel: string) {
    try {
      const res = await fetch('/api/custom-fields', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fieldId })
      });
      
      if (res.ok) {
        log(`Removed custom field "${fieldLabel}"`, 'success');
        const entityType = getCustomFieldEntityType();
        if (entityType) await loadCustomFields(entityType);
      }
    } catch (e) {
      log(`Failed to remove field: ${e}`, 'error');
    }
  }
  
  function toggleFieldVisibility(fieldKey: string) {
    if (hiddenFields.has(fieldKey)) {
      hiddenFields.delete(fieldKey);
    } else {
      hiddenFields.add(fieldKey);
    }
    hiddenFields = new Set(hiddenFields); // Trigger reactivity
  }
  
  // Format number with specified format
  function formatNumber(value: any, format: string = ''): string {
    if (value === null || value === undefined || value === '') return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    
    const formatted = num.toLocaleString('en-AU', { maximumFractionDigits: 2 });
    
    switch (format) {
      case '$':
        return `$${formatted}`;
      case 'sqm':
        return `${formatted} sqm`;
      case 'm':
        return `${formatted} m`;
      default:
        return formatted;
    }
  }
  
  // Get status option by value
  function getStatusOption(value: string) {
    return statusOptions.find(s => s.value === value) || statusOptions[0];
  }
  
  // Field drag and drop handlers
  function handleFieldDragStart(e: DragEvent, fieldKey: string) {
    draggingField = fieldKey;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }
  
  function handleFieldDragOver(e: DragEvent) {
    e.preventDefault();
  }
  
  function handleFieldDrop(e: DragEvent, targetFieldKey: string) {
    e.preventDefault();
    if (!draggingField || draggingField === targetFieldKey) return;
    
    const currentOrder = [...fieldOrder];
    const fromIndex = currentOrder.indexOf(draggingField);
    const toIndex = currentOrder.indexOf(targetFieldKey);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      currentOrder.splice(fromIndex, 1);
      currentOrder.splice(toIndex, 0, draggingField);
      fieldOrder = currentOrder;
    }
    draggingField = null;
  }
  
  function handleFieldDragEnd() {
    draggingField = null;
  }
  
  // Column resize handlers
  function startColumnResize(e: MouseEvent, columnKey: string) {
    e.preventDefault();
    e.stopPropagation();
    resizingColumn = columnKey;
    resizeStartX = e.clientX;
    resizeStartWidth = columnWidths[columnKey] || 100;
    
    document.addEventListener('mousemove', handleColumnResize);
    document.addEventListener('mouseup', stopColumnResize);
  }
  
  function handleColumnResize(e: MouseEvent) {
    if (!resizingColumn) return;
    const diff = e.clientX - resizeStartX;
    const newWidth = Math.max(50, resizeStartWidth + diff);
    columnWidths = { ...columnWidths, [resizingColumn]: newWidth };
  }
  
  function stopColumnResize() {
    resizingColumn = null;
    document.removeEventListener('mousemove', handleColumnResize);
    document.removeEventListener('mouseup', stopColumnResize);
  }
  
  function getColumnWidth(key: string): string {
    return columnWidths[key] ? `${columnWidths[key]}px` : 'auto';
  }
  
  // Initialize field order when custom fields change
  $: {
    const defaultFields = selectedNode?.type === 'stage' 
      ? ['lotNumber', 'area', 'frontage', 'depth', 'streetName', 'status']
      : ['name', 'description'];
    const customFieldKeys = customFields.map(f => f.fieldKey);
    const allFields = [...defaultFields, ...customFieldKeys];
    
    // Clean up removed fields and add missing fields
    const currentValidFields = fieldOrder.filter(f => allFields.includes(f));
    const missingFields = allFields.filter(f => !fieldOrder.includes(f));
    
    if (missingFields.length > 0 || currentValidFields.length !== fieldOrder.length) {
      fieldOrder = [...currentValidFields, ...missingFields];
    }
  }
  
  // Reactive ordered visible fields - updates when fieldOrder, customFields, or hiddenFields change
  $: orderedFields = (() => {
    const defaultFields = selectedNode?.type === 'stage'
      ? [
          { key: 'lotNumber', label: 'Lot #', type: 'text', format: '', isCustom: false },
          { key: 'area', label: 'Area', type: 'number', format: 'sqm', isCustom: false },
          { key: 'frontage', label: 'Front', type: 'number', format: 'm', isCustom: false },
          { key: 'depth', label: 'Depth', type: 'number', format: 'm', isCustom: false },
          { key: 'streetName', label: 'Street', type: 'text', format: '', isCustom: false },
          { key: 'status', label: 'Status', type: 'status', format: '', isCustom: false },
          { key: 'price', label: 'Price', type: 'number', format: '$', isCustom: false }
        ]
      : selectedNode?.type === 'precinct'
        ? [
            { key: 'name', label: 'Name', type: 'text', format: '', isCustom: false },
            { key: 'description', label: 'Description', type: 'text', format: '', isCustom: false },
            { key: 'registrationDate', label: 'Reg Date', type: 'date', format: '', isCustom: false }
          ]
        : [
            { key: 'name', label: 'Name', type: 'text', format: '', isCustom: false },
            { key: 'description', label: 'Description', type: 'text', format: '', isCustom: false }
          ];
    
    const customFieldsList = customFields.map(f => ({
      key: f.fieldKey,
      label: f.fieldLabel,
      type: f.fieldType,
      format: f.fieldFormat || '',
      isCustom: true
    }));
    
    const allFields = [...defaultFields, ...customFieldsList];
    
    // Sort by fieldOrder
    return allFields
      .filter(f => !hiddenFields.has(f.key))
      .sort((a, b) => {
        const aIndex = fieldOrder.indexOf(a.key);
        const bIndex = fieldOrder.indexOf(b.key);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  })();
  
  // Reactive all fields for the fields manager (including hidden)
  $: allFieldsList = (() => {
    const defaultFields = selectedNode?.type === 'stage'
      ? [
          { key: 'lotNumber', label: 'Lot #', type: 'text', format: '', isDefault: true, id: undefined as number | undefined },
          { key: 'area', label: 'Area', type: 'number', format: 'sqm', isDefault: true, id: undefined as number | undefined },
          { key: 'frontage', label: 'Frontage', type: 'number', format: 'm', isDefault: true, id: undefined as number | undefined },
          { key: 'depth', label: 'Depth', type: 'number', format: 'm', isDefault: true, id: undefined as number | undefined },
          { key: 'streetName', label: 'Street', type: 'text', format: '', isDefault: true, id: undefined as number | undefined },
          { key: 'status', label: 'Status', type: 'status', format: '', isDefault: true, id: undefined as number | undefined },
          { key: 'price', label: 'Price', type: 'number', format: '$', isDefault: true, id: undefined as number | undefined }
        ]
      : selectedNode?.type === 'precinct'
        ? [
            { key: 'name', label: 'Name', type: 'text', format: '', isDefault: true, id: undefined as number | undefined },
            { key: 'description', label: 'Description', type: 'text', format: '', isDefault: true, id: undefined as number | undefined },
            { key: 'registrationDate', label: 'Reg Date', type: 'date', format: '', isDefault: true, id: undefined as number | undefined }
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
  })();
  
  function getCustomFieldEntityType(): string | null {
    if (!selectedNode) return null;
    // When viewing a stage, we're looking at lots
    if (selectedNode.type === 'stage') return 'lot';
    // When viewing a precinct, we're looking at stages
    if (selectedNode.type === 'precinct') return 'stage';
    // When viewing a project, we're looking at precincts
    if (selectedNode.type === 'project') return 'precinct';
    // When viewing a company, we're looking at projects
    if (selectedNode.type === 'company') return 'project';
    return null;
  }
  
  function getCustomFieldValue(row: any, fieldKey: string): string {
    if (row.customData) {
      try {
        const data = typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData;
        return data[fieldKey] || '';
      } catch {
        return '';
      }
    }
    return '';
  }
  
  async function loadCompanies() {
    log('Loading companies...', 'loading');
    const res = await fetch('/api/companies');
    const companies = await res.json();
    tree = companies.map((c: any) => ({ id: c.id, name: c.name, type: 'company', parentId: null }));
    log(`Loaded ${tree.length} companies`, 'success');
  }
  
  async function createNewCompany() {
    if (!newCompanyName.trim()) return;
    
    creatingCompany = true;
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newCompanyName.trim(),
          abn: newCompanyAbn.trim() || null
        })
      });
      
      if (res.ok) {
        const newCompany = await res.json();
        log(`Created company: ${newCompany.name}`, 'success');
        // Reload tree to show the new company
        await loadCompanies();
        // Reset and close modal
        newCompanyName = '';
        newCompanyAbn = '';
        showNewCompanyModal = false;
      } else {
        const data = await res.json();
        log(data.error || 'Failed to create company', 'error');
      }
    } catch (e) {
      log('Failed to create company', 'error');
    }
    creatingCompany = false;
  }
  
  function findNodeById(nodes: TreeNode[], id: number): TreeNode | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }
  
  async function toggleNode(node: TreeNode) {
    if (node.expanded) {
      node.expanded = false;
      tree = [...tree];
      return;
    }
    
    const config = typeConfig[node.type];
    if (!config.childEndpoint) return;
    
    node.loading = true;
    tree = [...tree];
    
    log(`Loading ${config.childType}s...`, 'loading');
    const res = await fetch(`${config.childEndpoint}?${config.childKey}=${node.id}`);
    const children = await res.json();
    
    node.children = children.map((c: any) => ({
      id: c.id,
      name: c.name || c.lotNumber || `#${c.id}`,
      type: config.childType,
      parentId: node.id
    }));
    node.expanded = true;
    node.loading = false;
    tree = [...tree];
    log(`Loaded ${children.length} ${config.childType}s`, 'success');
  }
  
  async function selectNode(node: TreeNode) {
    // Reset forecast tool when changing selection
    resetForecastTool();
    
    // Reset land budget loaded flags when switching nodes
    stageLandBudgetLoaded = false;
    landBudgetLoaded = false;
    
    selectedNode = node;
    editingId = null;
    isAdding = false;
    editingProperty = null;
    log(`Selected ${node.name}`, 'info');
    
    // Load and apply saved preferences for this node
    const prefs = await loadNodePreferences(node.type, node.id);
    if (prefs.showForecastTool === 'true' && node.type === 'precinct') {
      showForecastTool = true;
      loadForecastData();
    }
    if (prefs.showSummary !== undefined) showSummary = prefs.showSummary === 'true';
    if (prefs.showProperties !== undefined) showProperties = prefs.showProperties === 'true';
    
    // Build hierarchy path by traversing up the tree
    hierarchyPath = [];
    let currentNode: TreeNode | undefined = node;
    while (currentNode) {
      hierarchyPath.unshift({ type: currentNode.type, name: currentNode.name });
      if (currentNode.parentId) {
        currentNode = findNodeById(tree, currentNode.parentId);
      } else {
        break;
      }
    }
    
    // Force Land Budget panel refresh by toggling if already open
    if (node.type === 'stage' && showStageLandBudget) {
      showStageLandBudget = false;
      await loadStageLandBudget(node.id);
      showStageLandBudget = true;
    } else if (node.type === 'stage') {
      await loadStageLandBudget(node.id);
    } else if (node.type === 'precinct' && showLandBudget) {
      showLandBudget = false;
      await loadLandBudget(node.id);
      showLandBudget = true;
    } else if (node.type === 'precinct') {
      await loadLandBudget(node.id);
    }
    
    // Fetch full entity details
    const endpoint = entityEndpoints[node.type];
    if (endpoint) {
      const detailRes = await fetch(`${endpoint}?id=${node.id}`);
      const details = await detailRes.json();
      entityDetails = Array.isArray(details) ? details.find((d: any) => d.id === node.id) : details;
    }
    
    const config = typeConfig[node.type];
    if (!config.childEndpoint) {
      tableData = [];
      return;
    }
    
    loading = true;
    const res = await fetch(`${config.childEndpoint}?${config.childKey}=${node.id}`);
    tableData = await res.json();
    loading = false;
    
    // Load custom fields for the child entity type
    const childEntityType = getCustomFieldEntityType();
    if (childEntityType) {
      await loadCustomFields(childEntityType);
    }
    
    // Load pricing when viewing a stage (fetch project ID via stage -> precinct -> project)
    if (node.type === 'stage') {
      try {
        // Fetch all stages with precinct relation to find this stage's project
        const stagesRes = await fetch('/api/stages');
        const allStages = await stagesRes.json();
        const thisStage = allStages.find((s: any) => s.id === node.id);
        
        const projectId = thisStage?.precinct?.projectId;
        if (projectId) {
          await loadPricing(projectId);
          const pricedCount = pricingProducts.filter(p => p.basePrice > 0).length;
          if (pricedCount > 0) {
            log(`Loaded ${pricedCount} priced products`, 'info');
          }
        }
      } catch (e) {
        console.error('Failed to load pricing for stage:', e);
      }
    }
    
    // Reload Documents if panel is open
    if (showDocuments) {
      await loadDocuments();
    }
  }
  
  // Helper to find node by type and name
  function findNodeByTypeAndName(nodes: TreeNode[], type: string, name: string): TreeNode | undefined {
    for (const node of nodes) {
      if (node.type === type && node.name === name) return node;
      if (node.children) {
        const found = findNodeByTypeAndName(node.children, type, name);
        if (found) return found;
      }
    }
    return undefined;
  }
  
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
    if (!selectedNode || !editingProperty) return;
    const endpoint = entityEndpoints[selectedNode.type];
    
    // Handle date fields - convert to ISO timestamp
    let valueToSave: string | null = propertyEditValue;
    if (editingProperty === 'registrationDate' || editingProperty === 'settlementDate') {
      valueToSave = propertyEditValue ? new Date(propertyEditValue).toISOString() : null;
    }
    
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedNode.id, [editingProperty]: valueToSave })
      });
      if (res.ok) {
        entityDetails = { ...entityDetails, [editingProperty]: valueToSave };
        // Update tree node name if name was changed
        if (editingProperty === 'name' || editingProperty === 'lotNumber') {
          selectedNode.name = propertyEditValue;
          tree = [...tree];
        }
        log(`Updated ${editingProperty}`, 'success');
      } else {
        log('Update failed', 'error');
      }
    } catch (e) {
      log('Update error', 'error');
    }
    editingProperty = null;
  }
  
  async function loadDocuments() {
    if (!selectedNode) return;
    const res = await fetch(`/api/documents?entityType=${selectedNode.type}&entityId=${selectedNode.id}`);
    documents = await res.json();
  }
  
  // Helper function to reload table data for current selected node
  async function reloadTableData() {
    if (!selectedNode) return;
    const config = typeConfig[selectedNode.type];
    if (config?.childEndpoint) {
      const res = await fetch(`${config.childEndpoint}?${config.childKey}=${selectedNode.id}`);
      tableData = await res.json();
    }
  }
  
  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !selectedNode) return;
    
    uploading = true;
    log('Uploading document...', 'loading');
    
    const formData = new FormData();
    formData.append('file', input.files[0]);
    formData.append('entityType', selectedNode.type);
    formData.append('entityId', selectedNode.id.toString());
    formData.append('documentType', uploadDocumentType);
    
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const doc = await res.json();
        documents = [...documents, doc];
        log('Document uploaded', 'success');
        input.value = '';
      } else {
        const errData = await res.json().catch(() => ({}));
        log(`Upload failed: ${errData.error || res.statusText}`, 'error');
      }
    } catch (e: any) {
      log(`Upload error: ${e.message}`, 'error');
    }
    uploading = false;
  }
  
  async function extractFromDocument(docId: number, reanalyze: boolean = false) {
    extractingDocId = docId;
    log(reanalyze ? 'Re-analyzing with AI...' : 'Extracting data with AI...', 'loading');
    
    try {
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, extractionType: 'stage' })
      });
      
      if (res.ok) {
        const extracted = await res.json();
        
        if (reanalyze && extracted.lots && selectedNode) {
          // Re-analyze mode: Match extracted lots against existing lots
          const existingLots = tableData;
          extracted.lots = extracted.lots.map((lot: any) => {
            // Try to find matching existing lot by lot number
            const match = existingLots.find((existing: any) => 
              existing.lotNumber?.toLowerCase() === lot.lotNumber?.toLowerCase()
            );
            
            if (match) {
              // Found a match - mark for update
              return {
                ...lot,
                existingId: match.id,
                existingData: match,
                action: 'update',
                hasChanges: checkForChanges(match, lot)
              };
            } else {
              // No match - mark for create
              return {
                ...lot,
                existingId: null,
                existingData: null,
                action: 'create'
              };
            }
          });
          
          const updates = extracted.lots?.filter((l: any) => l.action === 'update').length || 0;
          const creates = extracted.lots?.filter((l: any) => l.action === 'create').length || 0;
          log(`Found ${updates} updates, ${creates} new lots`, 'success');
        } else {
          // First extraction mode: All lots are new creates
          if (extracted.lots) {
            extracted.lots = extracted.lots.map((lot: any) => ({
              ...lot,
              existingId: null,
              existingData: null,
              action: 'create'
            }));
          }
          log(`Extracted ${extracted.lots?.length || 0} lots`, 'success');
        }
        
        extractionResult = extracted;
        showExtractionModal = true;
      } else {
        log('Extraction failed', 'error');
      }
    } catch (e) {
      log('Extraction error', 'error');
    }
    extractingDocId = null;
  }
  
  function checkForChanges(existing: any, extracted: any): boolean {
    const parseNum = (val: any) => {
      if (!val) return null;
      const match = val.toString().match(/[\d.]+/);
      return match ? parseFloat(match[0]) : null;
    };
    
    return (
      parseNum(extracted.area) !== parseFloat(existing.area) ||
      parseNum(extracted.frontage) !== parseFloat(existing.frontage) ||
      parseNum(extracted.depth) !== parseFloat(existing.depth) ||
      (extracted.streetName && extracted.streetName !== existing.streetName)
    );
  }
  
  // Open pre-extraction modal to allow user to add context
  function openPreExtractionModal(docId: number) {
    pendingExtractionDocId = docId;
    extractionHints = ''; // Reset hints for new extraction
    showPreExtractionModal = true;
  }
  
  // Start extraction after user confirms (with optional hints)
  function confirmExtraction() {
    if (pendingExtractionDocId) {
      showPreExtractionModal = false;
      extractPermitPlan(pendingExtractionDocId);
    }
  }
  
  // Cancel pre-extraction modal
  function cancelPreExtraction() {
    showPreExtractionModal = false;
    pendingExtractionDocId = null;
    extractionHints = '';
  }
  
  // Permit Plan extraction for Precincts - extracts multiple stages and lots
  async function extractPermitPlan(docId: number) {
    extractingDocId = docId;
    extractionProgress = { current: 0, total: 0, status: 'Starting extraction...' };
    const modelName = modelOptions.find(m => m.id === selectedModel)?.name || selectedModel;
    log(`Analyzing Permit Plan using ${modelName}...`, 'loading');
    
    // Start progress animation
    extractionProgress = { current: 0, total: 100, status: 'Converting PDF pages to images...' };
    const progressInterval = setInterval(() => {
      if (extractionProgress.current < 90) {
        extractionProgress.current += 2;
        if (extractionProgress.current < 30) {
          extractionProgress.status = 'Converting PDF pages to images...';
        } else if (extractionProgress.current < 70) {
          extractionProgress.status = 'AI analyzing document...';
        } else {
          extractionProgress.status = 'Processing extracted data...';
        }
      }
    }, 500);
    
    try {
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: docId, 
          extractionType: 'precinct', 
          model: selectedModel,
          hints: extractionHints || undefined
        })
      });
      
      clearInterval(progressInterval);
      extractionProgress = { current: 100, total: 100, status: 'Complete!' };
      
      if (res.ok) {
        const extracted = await res.json();
        
        if (extracted.stages && extracted.stages.length > 0) {
          // Mark all stages for creation with their lots
          extracted.stages = extracted.stages.map((stage: any) => ({
            ...stage,
            action: 'create',
            lots: (stage.lots || []).map((lot: any) => ({
              ...lot,
              action: 'create'
            }))
          }));
          const totalLots = extracted.stages.reduce((sum: number, s: any) => sum + (s.lots?.length || 0), 0);
          const pageInfo = extracted.pageCount > 1 ? ` (from ${extracted.pageCount} pages)` : '';
          log(`Found ${extracted.stages.length} stages with ${totalLots} total lots${pageInfo}`, 'success');
          
          // Check if there's more data to extract
          if (extracted.hasMore) {
            const remaining = extracted.remainingStages || [];
            const estLots = extracted.estimatedRemainingLots || 0;
            log(`⚠️ More data available: ${remaining.join(', ')} (~${estLots} lots remaining)`, 'loading');
            continuationInfo = { 
              docId, 
              remainingStages: remaining, 
              estimatedLots: estLots,
              existingData: extracted
            };
            showContinueModal = true;
          }
        } else if (extracted.lots && extracted.lots.length > 0) {
          // Fallback: If no stages found but lots exist, wrap in single stage
          extracted.stages = [{
            stageName: 'Stage 1',
            stageNumber: '1',
            action: 'create',
            lots: extracted.lots.map((lot: any) => ({ ...lot, action: 'create' }))
          }];
          const pageInfo = extracted.pageCount > 1 ? ` (from ${extracted.pageCount} pages)` : '';
          log(`Found ${extracted.lots.length} lots (single stage)${pageInfo}`, 'success');
        } else {
          log('No stages or lots found in permit plan', 'error');
        }
        
        extractionResult = extracted;
        showExtractionModal = true;
      } else {
        const errData = await res.json();
        log(`Extraction failed: ${errData.error || 'Unknown error'}`, 'error');
      }
    } catch (e: any) {
      clearInterval(progressInterval);
      log(`Extraction error: ${e.message || e}`, 'error');
    }
    extractingDocId = null;
    extractionProgress = { current: 0, total: 0, status: '' };
  }
  
  // Continue extraction for remaining stages
  async function continueExtraction() {
    if (!continuationInfo) return;
    
    const { docId, remainingStages, existingData } = continuationInfo;
    showContinueModal = false;
    extractingDocId = docId;
    
    const modelName = modelOptions.find(m => m.id === selectedModel)?.name || selectedModel;
    log(`Continuing extraction for ${remainingStages.join(', ')} using ${modelName}...`, 'loading');
    
    extractionProgress = { current: 0, total: 100, status: 'Continuing extraction...' };
    const progressInterval = setInterval(() => {
      if (extractionProgress.current < 90) {
        extractionProgress.current += 2;
        extractionProgress.status = `Extracting ${remainingStages[0] || 'remaining stages'}...`;
      }
    }, 500);
    
    try {
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: docId, 
          extractionType: 'precinct', 
          model: selectedModel,
          continueFrom: remainingStages,
          excludeStages: existingData.stages?.map((s: any) => s.stageName || s.stageNumber) || []
        })
      });
      
      clearInterval(progressInterval);
      extractionProgress = { current: 100, total: 100, status: 'Complete!' };
      
      if (res.ok) {
        const newData = await res.json();
        
        // Merge new stages with existing
        if (newData.stages && newData.stages.length > 0) {
          const mergedStages = [
            ...(existingData.stages || []),
            ...newData.stages.map((stage: any) => ({
              ...stage,
              action: 'create',
              lots: (stage.lots || []).map((lot: any) => ({ ...lot, action: 'create' }))
            }))
          ];
          
          const totalLots = mergedStages.reduce((sum: number, s: any) => sum + (s.lots?.length || 0), 0);
          log(`Total: ${mergedStages.length} stages with ${totalLots} lots`, 'success');
          
          extractionResult = { ...existingData, stages: mergedStages };
          
          // Check if still more data
          if (newData.hasMore) {
            continuationInfo = {
              docId,
              remainingStages: newData.remainingStages || [],
              estimatedLots: newData.estimatedRemainingLots || 0,
              existingData: extractionResult
            };
            showContinueModal = true;
          } else {
            continuationInfo = null;
            // Show the extraction results modal when continuation is complete
            showExtractionModal = true;
          }
        } else {
          // No new stages found, still show what we have
          log('No additional stages found in continuation', 'info');
          showExtractionModal = true;
        }
      } else {
        const errData = await res.json();
        log(`Continuation failed: ${errData.error || 'Unknown error'}`, 'error');
        // Still show existing data
        showExtractionModal = true;
      }
    } catch (e: any) {
      clearInterval(progressInterval);
      log(`Continuation error: ${e.message || e}`, 'error');
    }
    
    extractingDocId = null;
    extractionProgress = { current: 0, total: 0, status: '' };
  }
  
  // Cross-reference Plan of Subdivision against existing lot data
  async function crossReferenceDocument(docId: number) {
    extractingDocId = docId;
    const modelName = modelOptions.find(m => m.id === selectedModel)?.name || selectedModel;
    log(`Cross-referencing document using ${modelName}...`, 'loading');
    
    try {
      const res = await fetch('/api/documents/cross-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: docId, 
          model: selectedModel,
          entityType: selectedNode?.type,
          entityId: selectedNode?.id
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        
        if (result.matches && result.matches.length > 0) {
          // Show cross-reference results in verification modal
          verificationResult = {
            ...result,
            corrections: result.matches.filter((m: any) => m.hasDiscrepancy).map((m: any) => ({
              lotNumber: m.lotNumber,
              field: m.discrepancyField,
              currentValue: m.existingValue,
              correctValue: m.extractedValue,
              confidence: m.confidence,
              lotId: m.lotId
            }))
          };
          showVerificationModal = true;
          
          const discrepancies = result.matches.filter((m: any) => m.hasDiscrepancy).length;
          log(`Found ${result.matches.length} matching lots, ${discrepancies} with discrepancies`, discrepancies > 0 ? 'info' : 'success');
        } else {
          log('No matching lots found in document', 'error');
        }
      } else {
        const errData = await res.json();
        log(`Cross-reference failed: ${errData.error || 'Unknown error'}`, 'error');
      }
    } catch (e: any) {
      log(`Cross-reference error: ${e.message || e}`, 'error');
    }
    extractingDocId = null;
  }
  
  // Analyze Plan of Subdivision - comprehensive analysis with easements
  async function analyzePlanOfSubdivision(docId: number) {
    extractingDocId = docId;
    analyzingPos = true;
    const modelName = modelOptions.find(m => m.id === selectedModel)?.name || selectedModel;
    log(`Analyzing Plan of Subdivision using ${modelName}...`, 'loading');
    
    try {
      const res = await fetch('/api/documents/analyze-pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: docId, 
          model: selectedModel,
          stageId: selectedNode?.id
        })
      });
      
      if (res.ok) {
        posAnalysisResult = await res.json();
        showPosAnalysisModal = true;
        expandedLots = new Set();
        
        const { summary } = posAnalysisResult;
        log(`POS Analysis: ${summary.matches} match, ${summary.variances} variances, ${summary.lotsWithEasements} with easements`, 
          summary.variances > 0 ? 'info' : 'success');
      } else {
        const errData = await res.json();
        log(`POS Analysis failed: ${errData.error || 'Unknown error'}`, 'error');
      }
    } catch (e: any) {
      log(`POS Analysis error: ${e.message || e}`, 'error');
    }
    extractingDocId = null;
    analyzingPos = false;
  }
  
  // Toggle expanded state for lot details
  function toggleLotExpanded(lotNumber: string) {
    if (expandedLots.has(lotNumber)) {
      expandedLots.delete(lotNumber);
    } else {
      expandedLots.add(lotNumber);
    }
    expandedLots = expandedLots; // Trigger reactivity
  }
  
  // Filter comparisons based on selected filter
  function getFilteredComparisons() {
    if (!posAnalysisResult?.comparisons) return [];
    
    switch (posAnalysisFilter) {
      case 'variance':
        return posAnalysisResult.comparisons.filter((c: any) => c.status === 'variance');
      case 'easements':
        return posAnalysisResult.comparisons.filter((c: any) => 
          c.newInfo?.easements?.length > 0 || c.newInfo?.encumbrances?.length > 0
        );
      case 'match':
        return posAnalysisResult.comparisons.filter((c: any) => c.status === 'match');
      default:
        return posAnalysisResult.comparisons;
    }
  }
  
  // Apply a single correction from POS analysis
  async function applyPosCorrection(correction: any) {
    if (!correction.lotId) return;
    
    try {
      const res = await fetch(`/api/lots/${correction.lotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [correction.field]: correction.newValue })
      });
      
      if (res.ok) {
        log(`Updated Lot ${correction.lotNumber} ${correction.field}: ${correction.currentValue} → ${correction.newValue}`, 'success');
        // Remove from corrections list
        posAnalysisResult.corrections = posAnalysisResult.corrections.filter(
          (c: any) => !(c.lotId === correction.lotId && c.field === correction.field)
        );
        // Update comparison status
        const comp = posAnalysisResult.comparisons.find((c: any) => c.lotId === correction.lotId);
        if (comp) {
          comp.variances = comp.variances.filter((v: any) => v.field !== correction.field);
          if (comp.variances.length === 0) {
            comp.status = comp.newInfo?.easements?.length > 0 ? 'new_data' : 'match';
          }
        }
        posAnalysisResult = posAnalysisResult; // Trigger reactivity
        await reloadTableData();
      }
    } catch (e: any) {
      log(`Error applying correction: ${e.message}`, 'error');
    }
  }
  
  // Apply all corrections from POS analysis
  async function applyAllPosCorrections() {
    if (!posAnalysisResult?.corrections?.length) return;
    
    log(`Applying ${posAnalysisResult.corrections.length} corrections...`, 'loading');
    let applied = 0;
    
    for (const correction of [...posAnalysisResult.corrections]) {
      await applyPosCorrection(correction);
      applied++;
    }
    
    log(`Applied ${applied} corrections from POS`, 'success');
  }
  
  // Save extracted stages and lots from Permit Plan
  async function saveExtractedStages() {
    if (!selectedNode || !extractionResult?.stages) {
      log('No stages to save', 'error');
      return;
    }
    
    if (selectedNode.type !== 'precinct') {
      log('Please select a Precinct to save stages', 'error');
      return;
    }
    
    log('Creating stages and lots...', 'loading');
    let stagesCreated = 0;
    let lotsCreated = 0;
    let errors = 0;
    
    const parseNumeric = (val: any) => {
      if (!val) return null;
      const match = val.toString().match(/[\d.]+/);
      return match ? match[0] : null;
    };
    
    for (const stage of extractionResult.stages) {
      if (stage.action === 'skip') continue;
      
      try {
        // Create stage
        const stageRes = await fetch('/api/stages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            precinctId: selectedNode.id,
            name: stage.stageName || `Stage ${stage.stageNumber || stagesCreated + 1}`
          })
        });
        
        if (stageRes.ok) {
          const newStage = await stageRes.json();
          stagesCreated++;
          
          // Create lots for this stage
          for (const lot of (stage.lots || [])) {
            if (lot.action === 'skip') continue;
            
            try {
              const lotRes = await fetch('/api/lots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  stageId: newStage.id,
                  lotNumber: lot.lotNumber,
                  area: parseNumeric(lot.area),
                  frontage: parseNumeric(lot.frontage),
                  depth: parseNumeric(lot.depth),
                  streetName: lot.streetName || null,
                  status: 'extracted'
                })
              });
              if (lotRes.ok) lotsCreated++;
              else errors++;
            } catch {
              errors++;
            }
          }
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    }
    
    if (stagesCreated > 0) {
      log(`Created ${stagesCreated} stages, ${lotsCreated} lots${errors > 0 ? `, ${errors} errors` : ''}`, 'success');
      // Refresh tree to show new stages
      if (selectedNode.expanded) {
        await toggleNode(selectedNode);
        await toggleNode(selectedNode);
      }
    } else {
      log(`Failed to create stages (${errors} errors)`, 'error');
    }
    
    showExtractionModal = false;
    extractionResult = null;
  }
  
  async function saveExtractedLots() {
    if (!selectedNode || !extractionResult?.lots) {
      log('No data to save', 'error');
      return;
    }
    
    if (selectedNode.type !== 'stage') {
      log('Please select a Stage to save lots', 'error');
      return;
    }
    
    log('Saving extracted lots...', 'loading');
    let updated = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    // Parse numeric values helper
    const parseNumeric = (val: any) => {
      if (!val) return null;
      const match = val.toString().match(/[\d.]+/);
      return match ? match[0] : null;
    };
    
    for (const lot of extractionResult.lots) {
      // Skip if action is 'skip'
      if (lot.action === 'skip') {
        skipped++;
        continue;
      }
      
      try {
        const lotData: any = {
          lotNumber: lot.lotNumber || `Lot ${created + 1}`,
          address: lot.address || `${lot.lotNumber || ''} ${lot.streetName || ''}`.trim() || null,
          area: parseNumeric(lot.area),
          frontage: parseNumeric(lot.frontage),
          depth: parseNumeric(lot.depth),
          streetName: lot.streetName || null,
          status: lot.status || 'extracted'
        };
        
        if (lot.action === 'update' && lot.existingId) {
          // Update existing lot
          lotData.id = lot.existingId;
          const res = await fetch('/api/lots', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lotData)
          });
          if (res.ok) updated++;
          else errors++;
        } else {
          // Create new lot
          lotData.stageId = selectedNode.id;
          const res = await fetch('/api/lots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lotData)
          });
          if (res.ok) created++;
          else errors++;
        }
      } catch (e) {
        console.error('Error saving lot:', e);
        errors++;
      }
    }
    
    const total = updated + created;
    if (total > 0) {
      const parts = [];
      if (updated > 0) parts.push(`${updated} updated`);
      if (created > 0) parts.push(`${created} created`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (errors > 0) parts.push(`${errors} failed`);
      log(parts.join(', '), 'success');
    } else if (skipped > 0) {
      log(`${skipped} lots skipped`, 'info');
    } else {
      log(`Failed to save lots (${errors} errors)`, 'error');
    }
    
    showExtractionModal = false;
    extractionResult = null;
    
    // Refresh table data
    if (selectedNode) {
      const config = typeConfig[selectedNode.type];
      if (config.childEndpoint) {
        const res = await fetch(`${config.childEndpoint}?${config.childKey}=${selectedNode.id}`);
        tableData = await res.json();
      }
    }
  }
  
  async function deleteDocument(docId: number) {
    try {
      await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId })
      });
      documents = documents.filter(d => d.id !== docId);
      log('Document deleted', 'success');
    } catch (e) {
      log('Delete error', 'error');
    }
  }
  
  // Bulk edit functions
  function toggleRowSelection(id: number) {
    if (selectedRows.has(id)) {
      selectedRows.delete(id);
    } else {
      selectedRows.add(id);
    }
    selectedRows = new Set(selectedRows); // Trigger reactivity
  }
  
  function toggleAllRows() {
    if (selectedRows.size === tableData.length) {
      selectedRows = new Set();
    } else {
      selectedRows = new Set(tableData.map(r => r.id));
    }
  }
  
  function clearSelection() {
    selectedRows = new Set();
    showBulkEdit = false;
    bulkEditField = '';
    bulkEditValue = '';
  }
  
  async function applyBulkEdit() {
    if (selectedRows.size === 0 || !bulkEditField || !selectedNode) {
      log('Select rows and field to update', 'error');
      return;
    }
    
    log(`Updating ${selectedRows.size} rows...`, 'loading');
    let updated = 0;
    let errors = 0;
    
    const endpoint = typeConfig[selectedNode.type]?.childEndpoint;
    if (!endpoint) return;
    
    for (const id of selectedRows) {
      try {
        const updateData: any = { id };
        // Parse numeric values for specific fields
        if (['area', 'frontage', 'depth'].includes(bulkEditField)) {
          const numMatch = bulkEditValue.match(/[\d.]+/);
          updateData[bulkEditField] = numMatch ? numMatch[0] : null;
        } else {
          updateData[bulkEditField] = bulkEditValue;
        }
        
        const res = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        if (res.ok) updated++;
        else errors++;
      } catch {
        errors++;
      }
    }
    
    if (updated > 0) {
      log(`Updated ${updated} rows${errors > 0 ? `, ${errors} failed` : ''}`, 'success');
      // Refresh table
      const config = typeConfig[selectedNode.type];
      if (config.childEndpoint) {
        const res = await fetch(`${config.childEndpoint}?${config.childKey}=${selectedNode.id}`);
        tableData = await res.json();
      }
    } else {
      log(`Failed to update (${errors} errors)`, 'error');
    }
    
    clearSelection();
  }
  
  // Analyze specific PDF page and compare with existing lot data
  async function analyzePageForVerification() {
    if (!inlineDocument || inlineDocument.mimeType !== 'application/pdf') {
      log('No PDF document selected', 'error');
      return;
    }
    
    const modelName = modelOptions.find(m => m.id === selectedModel)?.name || selectedModel;
    analyzingPage = true;
    log(`Extracting data using ${modelName}...`, 'loading');
    
    try {
      const res = await fetch('/api/documents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: inlineDocument.id,
          pageNumber: pdfPageNumber,
          existingLots: tableData,
          correctionHistory: correctionHistory.slice(-20),
          capturedImage: capturedImage,
          model: selectedModel
        })
      });
      
      if (!res.ok) {
        const err = await res.text();
        log(`Extraction failed: ${err}`, 'error');
        return;
      }
      
      verificationResult = await res.json();
      showVerificationModal = true;
      
      const usedModel = verificationResult.usedModel || modelName;
      log(`Extracted ${verificationResult.lotsFound?.length || 0} lots using ${usedModel}`, 'success');
    } catch (e) {
      log(`Extraction error: ${e}`, 'error');
    } finally {
      analyzingPage = false;
    }
  }
  
  // Submit calibration and get final corrected results
  async function submitCalibration() {
    isCalibrating = true;
    log('Applying calibration and re-analyzing...', 'loading');
    
    // Build calibration feedback from user edits
    const calibrationFeedback = calibrationSamples.map(sample => ({
      lotNumber: sample.lotNumber,
      aiValues: {
        area: sample.area,
        frontage: sample.frontage,
        depth: sample.depth,
        streetName: sample.streetName
      },
      userValues: {
        area: sample.userArea,
        frontage: sample.userFrontage,
        depth: sample.userDepth,
        streetName: sample.userStreetName
      },
      corrections: {
        area: sample.area !== sample.userArea,
        frontage: sample.frontage !== sample.userFrontage,
        depth: sample.depth !== sample.userDepth,
        streetName: sample.streetName !== sample.userStreetName
      }
    }));
    
    try {
      const res = await fetch('/api/documents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: calibrationDocId,
          pageNumber: calibrationPageNum,
          existingLots: tableData,
          correctionHistory: correctionHistory.slice(-20),
          capturedImage: capturedImage,
          phase: 'final',
          calibrationFeedback: calibrationFeedback
        })
      });
      
      if (!res.ok) {
        const err = await res.text();
        log(`Calibrated verification failed: ${err}`, 'error');
        return;
      }
      
      verificationResult = await res.json();
      showCalibrationModal = false;
      showVerificationModal = true;
      log(`Calibration complete. Found ${verificationResult.corrections?.length || 0} corrections`, 'success');
    } catch (e) {
      log(`Calibration error: ${e}`, 'error');
    } finally {
      isCalibrating = false;
    }
  }
  
  // Skip calibration and show raw results
  function skipCalibration() {
    verificationResult = pendingFullResults;
    showCalibrationModal = false;
    showVerificationModal = true;
    log('Showing uncalibrated results', 'info');
  }
  
  // Start visual box calibration wizard
  async function startBoxCalibration() {
    if (!inlineDocument) return;
    
    analyzingPage = true;
    log('Loading page for visual calibration...', 'loading');
    
    try {
      // Get the PDF page as an image for the canvas
      const res = await fetch('/api/documents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: inlineDocument.id,
          pageNumber: pdfPageNumber,
          existingLots: tableData,
          phase: 'calibration',
          returnImage: true // Request the base64 image back
        })
      });
      
      if (!res.ok) {
        log('Failed to load page for calibration', 'error');
        return;
      }
      
      const result = await res.json();
      
      if (result.lotsFound && result.lotsFound.length > 0) {
        // Pick up to 5 RANDOM lots spread across the dataset for better calibration
        const allLots = result.lotsFound;
        const sampleCount = Math.min(5, allLots.length);
        let samples: any[];
        
        if (allLots.length <= 5) {
          samples = [...allLots];
        } else {
          // Stratified random sampling - pick from different parts of the list
          const indices = new Set<number>();
          // Always include first and last for range coverage
          indices.add(0);
          indices.add(allLots.length - 1);
          // Fill remaining with random picks from middle
          while (indices.size < sampleCount) {
            const randomIndex = Math.floor(Math.random() * allLots.length);
            indices.add(randomIndex);
          }
          samples = Array.from(indices).sort((a, b) => a - b).map(i => allLots[i]);
        }
        
        boxCalibrationLots = samples.map((lot: any) => ({
          lotNumber: lot.lotNumber || '?',
          fields: [
            { name: 'Area', aiValue: lot.area || '', userValue: lot.area || '', box: null, confirmed: false },
            { name: 'Frontage', aiValue: lot.frontage || '', userValue: lot.frontage || '', box: null, confirmed: false },
            { name: 'Depth', aiValue: lot.depth || '', userValue: lot.depth || '', box: null, confirmed: false }
          ]
        }));
        
        boxCalibrationImage = result.imageBase64 ? `data:image/png;base64,${result.imageBase64}` : null;
        currentLotIndex = 0;
        currentFieldIndex = 0;
        currentBox = null;
        pendingFullResults = result;
        calibrationDocId = inlineDocument.id;
        calibrationPageNum = pdfPageNumber;
        showBoxCalibration = true;
        
        log(`Visual calibration: ${boxCalibrationLots.length} lots to verify`, 'info');
      } else {
        log('No lots found on this page', 'error');
      }
    } catch (e) {
      log(`Calibration error: ${e}`, 'error');
    } finally {
      analyzingPage = false;
    }
  }
  
  // Get current lot and field being calibrated
  $: currentCalibrationLot = boxCalibrationLots[currentLotIndex];
  $: currentCalibrationField = currentCalibrationLot?.fields[currentFieldIndex];
  
  // Canvas mouse handlers for box drawing
  function handleCanvasMouseDown(e: MouseEvent) {
    if (!boxCanvasRef) return;
    const rect = boxCanvasRef.getBoundingClientRect();
    const scaleX = boxCanvasRef.width / rect.width;
    const scaleY = boxCanvasRef.height / rect.height;
    
    drawStartPos = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
    isDrawingBox = true;
  }
  
  function handleCanvasMouseMove(e: MouseEvent) {
    if (!isDrawingBox || !boxCanvasRef) return;
    const rect = boxCanvasRef.getBoundingClientRect();
    const scaleX = boxCanvasRef.width / rect.width;
    const scaleY = boxCanvasRef.height / rect.height;
    
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;
    
    currentBox = {
      x: Math.min(drawStartPos.x, currentX),
      y: Math.min(drawStartPos.y, currentY),
      width: Math.abs(currentX - drawStartPos.x),
      height: Math.abs(currentY - drawStartPos.y)
    };
    
    redrawCanvas();
  }
  
  function handleCanvasMouseUp() {
    isDrawingBox = false;
    if (currentBox && currentBox.width > 10 && currentBox.height > 10) {
      // Save the box to current field
      if (currentCalibrationField) {
        currentCalibrationField.box = { ...currentBox };
        boxCalibrationLots = [...boxCalibrationLots]; // Trigger reactivity
        
        // Extract the boxed region and OCR it
        extractBoxRegion(currentBox);
      }
    }
  }
  
  // Extract text from the drawn box region using AI
  let isExtractingBox = false;
  async function extractBoxRegion(box: { x: number; y: number; width: number; height: number }) {
    if (!boxCanvasRef || !boxImageRef || !currentCalibrationField) return;
    
    isExtractingBox = true;
    
    try {
      // Create a temporary canvas to extract just the box region
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = box.width;
      tempCanvas.height = box.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      // Draw just the selected region
      tempCtx.drawImage(
        boxImageRef,
        box.x, box.y, box.width, box.height,  // Source region
        0, 0, box.width, box.height            // Destination
      );
      
      // Convert to base64
      const regionBase64 = tempCanvas.toDataURL('image/png').split(',')[1];
      
      // Send to AI for OCR
      const fieldName = currentCalibrationField.name.toLowerCase();
      const res = await fetch('/api/documents/ocr-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: regionBase64,
          fieldType: fieldName  // area, frontage, or depth
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.value) {
          // Update the user value with OCR result
          currentCalibrationField.userValue = result.value;
          boxCalibrationLots = [...boxCalibrationLots]; // Trigger reactivity
          log(`OCR detected: ${result.value}`, 'success');
        }
      }
    } catch (e) {
      console.error('OCR extraction error:', e);
    } finally {
      isExtractingBox = false;
    }
  }
  
  function redrawCanvas() {
    if (!boxCanvasRef || !boxImageRef) return;
    const ctx = boxCanvasRef.getContext('2d');
    if (!ctx) return;
    
    // Draw the image
    ctx.drawImage(boxImageRef, 0, 0, boxCanvasRef.width, boxCanvasRef.height);
    
    // Draw current box being drawn
    if (currentBox) {
      ctx.strokeStyle = '#7aa2f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
      ctx.setLineDash([]);
    }
    
    // Draw saved box for current field
    if (currentCalibrationField?.box) {
      ctx.strokeStyle = '#9ece6a';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        currentCalibrationField.box.x,
        currentCalibrationField.box.y,
        currentCalibrationField.box.width,
        currentCalibrationField.box.height
      );
      
      // Label
      ctx.fillStyle = '#9ece6a';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(
        `${currentCalibrationField.name}: ${currentCalibrationField.userValue}`,
        currentCalibrationField.box.x + 5,
        currentCalibrationField.box.y - 5
      );
    }
  }
  
  // Initialize canvas when image loads
  function onCalibrationImageLoad(e: Event) {
    const img = e.target as HTMLImageElement;
    boxImageRef = img;
    
    if (boxCanvasRef) {
      boxCanvasRef.width = img.naturalWidth;
      boxCanvasRef.height = img.naturalHeight;
      redrawCanvas();
    }
  }
  
  // Confirm current field and move to next
  function confirmField() {
    if (currentCalibrationField) {
      currentCalibrationField.confirmed = true;
      boxCalibrationLots = [...boxCalibrationLots];
    }
    nextField();
  }
  
  // Move to next field or lot
  function nextField() {
    if (currentFieldIndex < 2) {
      currentFieldIndex++;
    } else if (currentLotIndex < boxCalibrationLots.length - 1) {
      currentLotIndex++;
      currentFieldIndex = 0;
    }
    currentBox = null;
    redrawCanvas();
  }
  
  // Move to previous field or lot
  function prevField() {
    if (currentFieldIndex > 0) {
      currentFieldIndex--;
    } else if (currentLotIndex > 0) {
      currentLotIndex--;
      currentFieldIndex = 2;
    }
    currentBox = null;
    redrawCanvas();
  }
  
  // Complete visual calibration and submit
  async function submitBoxCalibration() {
    isCalibrating = true;
    log('Applying visual calibration...', 'loading');
    
    // Build calibration data from boxes
    const boxFeedback = boxCalibrationLots.map(lot => ({
      lotNumber: lot.lotNumber,
      fields: lot.fields.map(f => ({
        name: f.name.toLowerCase(),
        aiValue: f.aiValue,
        userValue: f.userValue,
        hasBox: !!f.box,
        confirmed: f.confirmed
      }))
    }));
    
    try {
      const res = await fetch('/api/documents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: calibrationDocId || inlineDocument?.id,
          pageNumber: calibrationPageNum || pdfPageNumber,
          existingLots: tableData,
          phase: 'final',
          boxCalibrationFeedback: boxFeedback
        })
      });
      
      if (!res.ok) {
        log('Calibration failed', 'error');
        return;
      }
      
      verificationResult = await res.json();
      showBoxCalibration = false;
      showVerificationModal = true;
      log(`Visual calibration complete. Found ${verificationResult.corrections?.length || 0} corrections`, 'success');
    } catch (e) {
      log(`Error: ${e}`, 'error');
    } finally {
      isCalibrating = false;
    }
  }
  
  // Apply a single correction from verification
  async function applyCorrection(correction: any) {
    const { lotId, field, newValue } = correction;
    
    try {
      const res = await fetch('/api/lots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lotId, [field]: newValue })
      });
      
      if (res.ok) {
        log(`Updated lot ${correction.lotNumber} ${field}`, 'success');
        // Remove from corrections list
        verificationResult.corrections = verificationResult.corrections.filter(
          (c: any) => !(c.lotId === lotId && c.field === field)
        );
        // Refresh table
        if (selectedNode) {
          const config = typeConfig[selectedNode.type];
          if (config.childEndpoint) {
            const res = await fetch(`${config.childEndpoint}?${config.childKey}=${selectedNode.id}`);
            tableData = await res.json();
          }
        }
      }
    } catch (e) {
      log(`Failed to apply correction: ${e}`, 'error');
    }
  }
  
  // Apply all corrections from verification
  async function applyAllCorrections() {
    if (!verificationResult?.corrections) return;
    
    log(`Applying ${verificationResult.corrections.length} corrections...`, 'loading');
    let applied = 0;
    
    for (const correction of [...verificationResult.corrections]) {
      await applyCorrection(correction);
      applied++;
    }
    
    log(`Applied ${applied} corrections`, 'success');
    showVerificationModal = false;
  }
  
  // Capture screen/window for AI analysis
  async function captureScreen() {
    isCapturing = true;
    log('Starting screen capture...', 'loading');
    
    try {
      // Request screen capture permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'window' } as any,
        audio: false
      });
      
      // Get video track and capture frame
      const track = stream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      
      // Convert to canvas and base64
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(bitmap, 0, 0);
      
      // Get base64 image (without data URL prefix for API)
      const dataUrl = canvas.toDataURL('image/png');
      capturedImage = dataUrl.split(',')[1];
      
      // Stop the stream
      track.stop();
      
      log('Screen captured! Click "Verify Data" to analyze.', 'success');
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        log('Screen capture cancelled', 'info');
      } else {
        log(`Capture failed: ${e.message}`, 'error');
      }
      capturedImage = null;
    } finally {
      isCapturing = false;
    }
  }
  
  // Clear captured image
  function clearCapture() {
    capturedImage = null;
    log('Capture cleared', 'info');
  }
  
  function startEdit(row: any) {
    editingId = row.id;
    editValues = {
      name: row.name || row.lotNumber || row.invoiceNumber || '',
      detail: row.description || row.status || row.address || '',
      area: row.area || '',
      frontage: row.frontage || '',
      depth: row.depth || '',
      streetName: row.streetName || '',
      price: row.price || '',
      status: row.status || '',
      // Handle registrationDate - convert ISO to YYYY-MM-DD for date input
      registrationDate: row.registrationDate ? new Date(row.registrationDate).toISOString().split('T')[0] : ''
    };
    // Load custom field values
    for (const field of customFields) {
      editValues[field.fieldKey] = getCustomFieldValue(row, field.fieldKey);
    }
  }
  
  function cancelEdit() {
    editingId = null;
    editValues = {};
  }
  
  async function saveEdit(row: any) {
    if (!selectedNode) return;
    const config = typeConfig[selectedNode.type];
    
    const updateData: any = { id: row.id };
    if (row.name !== undefined) updateData.name = editValues.name;
    else if (row.lotNumber !== undefined) updateData.lotNumber = editValues.name;
    else if (row.invoiceNumber !== undefined) updateData.invoiceNumber = editValues.name;
    
    if (row.description !== undefined) updateData.description = editValues.detail;
    else if (row.status !== undefined) updateData.status = editValues.detail;
    else if (row.address !== undefined) updateData.address = editValues.detail;
    
    // Handle lot-specific fields and track corrections for AI learning
    if (selectedNode.type === 'stage') {
      const lotNumber = row.lotNumber || editValues.name;
      
      // Track corrections for AI learning
      if (editValues.area !== (row.area || '') && editValues.area) {
        correctionHistory.push({ lotNumber, field: 'area', oldValue: row.area || '', newValue: editValues.area, timestamp: new Date() });
      }
      if (editValues.frontage !== (row.frontage || '') && editValues.frontage) {
        correctionHistory.push({ lotNumber, field: 'frontage', oldValue: row.frontage || '', newValue: editValues.frontage, timestamp: new Date() });
      }
      if (editValues.depth !== (row.depth || '') && editValues.depth) {
        correctionHistory.push({ lotNumber, field: 'depth', oldValue: row.depth || '', newValue: editValues.depth, timestamp: new Date() });
      }
      if (editValues.streetName !== (row.streetName || '') && editValues.streetName) {
        correctionHistory.push({ lotNumber, field: 'streetName', oldValue: row.streetName || '', newValue: editValues.streetName, timestamp: new Date() });
      }
      
      // Keep only last 50 corrections
      if (correctionHistory.length > 50) {
        correctionHistory = correctionHistory.slice(-50);
      }
      
      updateData.area = editValues.area || null;
      updateData.frontage = editValues.frontage || null;
      updateData.depth = editValues.depth || null;
      updateData.streetName = editValues.streetName || null;
      updateData.status = editValues.status || null;
      
      // Save price if provided
      if (editValues.price !== undefined && editValues.price !== '') {
        const priceValue = parseFloat(String(editValues.price).replace(/,/g, '')) || 0;
        updateData.price = priceValue;
        const area = parseFloat(editValues.area) || parseFloat(row.area) || 0;
        updateData.pricePerSqm = area > 0 ? Math.round(priceValue / area) : 0;
      }
    }
    
    // Handle registrationDate for stages when editing from precinct table
    if (selectedNode.type === 'precinct' && editValues.registrationDate !== undefined) {
      updateData.registrationDate = editValues.registrationDate ? new Date(editValues.registrationDate).toISOString() : null;
    }
    
    // Build customData from custom fields
    if (customFields.length > 0) {
      const existingCustomData = row.customData ? 
        (typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData) : {};
      for (const field of customFields) {
        if (editValues[field.fieldKey] !== undefined) {
          existingCustomData[field.fieldKey] = editValues[field.fieldKey];
        }
      }
      updateData.customData = JSON.stringify(existingCustomData);
    }
    
    try {
      const res = await fetch(config.childEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (res.ok) {
        Object.assign(row, updateData);
        tableData = [...tableData];
        log('Updated successfully', 'success');
      } else {
        log('Update failed', 'error');
      }
    } catch (e) {
      log('Update error', 'error');
    }
    editingId = null;
  }
  
  async function deleteRow(row: any) {
    if (!selectedNode) return;
    const config = typeConfig[selectedNode.type];
    
    try {
      const res = await fetch(config.childEndpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id })
      });
      if (res.ok) {
        tableData = tableData.filter(r => r.id !== row.id);
        log('Deleted successfully', 'success');
      } else {
        log('Delete failed', 'error');
      }
    } catch (e) {
      log('Delete error', 'error');
    }
  }
  
  function startAdd() {
    isAdding = true;
    newRowValues = { name: '', detail: '' };
  }
  
  function cancelAdd() {
    isAdding = false;
    newRowValues = {};
  }
  
  async function saveAdd() {
    if (!selectedNode) return;
    const config = typeConfig[selectedNode.type];
    
    const newData: any = { [config.childKey]: selectedNode.id };
    
    if (config.childType === 'lot') {
      newData.lotNumber = newRowValues.name;
      newData.address = newRowValues.detail;
      newData.area = newRowValues.area || null;
      newData.frontage = newRowValues.frontage || null;
      newData.depth = newRowValues.depth || null;
      newData.streetName = newRowValues.streetName || null;
    } else if (config.childType === 'invoice') {
      newData.invoiceNumber = newRowValues.name;
      newData.status = newRowValues.detail;
    } else {
      newData.name = newRowValues.name;
      newData.description = newRowValues.detail;
    }
    
    try {
      const res = await fetch(config.childEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });
      if (res.ok) {
        const created = await res.json();
        tableData = [created, ...tableData];
        // Also add to tree if parent is expanded
        if (selectedNode && selectedNode.expanded && selectedNode.children) {
          const newTreeNode: TreeNode = {
            id: created.id,
            name: created.name || created.lotNumber || `#${created.id}`,
            type: config.childType,
            parentId: selectedNode.id
          };
          selectedNode.children = [newTreeNode, ...selectedNode.children];
          tree = [...tree];
        }
        log('Created successfully', 'success');
      } else {
        log('Create failed', 'error');
      }
    } catch (e) {
      log('Create error', 'error');
    }
    isAdding = false;
    newRowValues = {};
  }
  
  function renderTree(nodes: TreeNode[], depth = 0, isLast: boolean[] = []): string {
    let result = '';
    nodes.forEach((node, i) => {
      const last = i === nodes.length - 1;
      const prefix = isLast.map(l => l ? '   ' : '│  ').join('');
      const branch = last ? '└─ ' : '├─ ';
      const expandIcon = node.loading ? '*' : (node.children?.length ? (node.expanded ? '▼' : '▶') : ' ');
      result += `${prefix}${branch}${expandIcon} [${typeLabels[node.type]}] ${node.name}\n`;
      if (node.expanded && node.children) {
        result += renderTree(node.children, depth + 1, [...isLast, last]);
      }
    });
    return result;
  }
</script>

{#snippet treeNode(node: TreeNode, depth: number, isLast: boolean, ancestors: boolean[])}
  {@const hasChildren = typeConfig[node.type].childEndpoint !== ''}
  <div class="tree-row" class:selected={selectedNode?.id === node.id && selectedNode?.type === node.type}>
    <span class="tree-prefix">{#each ancestors as showLine}{#if showLine}│{:else}&nbsp;{/if}&nbsp;&nbsp;{/each}{#if isLast}└─{:else}├─{/if}&nbsp;</span>
    <button class="tree-expand" on:click={() => toggleNode(node)} disabled={!hasChildren}>
      {#if node.loading}*{:else if hasChildren}{node.expanded ? '▼' : '▶'}{:else}·{/if}
    </button>
    <button class="tree-label" style="color: {typeColors[node.type]}" on:click={() => selectNode(node)}>
      [{typeLabels[node.type]}] {node.name}
    </button>
  </div>
  {#if node.expanded && node.children}
    {#each node.children as child, i}
      {@render treeNode(child, depth + 1, i === node.children.length - 1, [...ancestors, !isLast])}
    {/each}
  {/if}
{/snippet}

{#if authLoading}
  <div class="auth-loading">
    <div class="loading-spinner"></div>
    <span>Loading...</span>
  </div>
{:else if currentUser}
<div class="app">
  <div class="header">
    <span class="title">◆ Filing System</span>
    <span class="subtitle">Navigate hierarchy below</span>
    <div class="user-section">
      <button class="user-btn" on:click={() => showUserMenu = !showUserMenu}>
        <span class="user-avatar">{currentUser.name.charAt(0).toUpperCase()}</span>
        <span class="user-name">{currentUser.name}</span>
        {#if currentUser.isMaster}<span class="master-badge">Master</span>{/if}
      </button>
      {#if showUserMenu}
        <div class="user-dropdown">
          <div class="dropdown-header">
            <strong>{currentUser.name}</strong>
            <span class="user-email">{currentUser.email}</span>
            <span class="user-role-badge" class:master={currentUser.isMaster} class:admin={isAdmin && !currentUser.isMaster}>
              {currentUser.isMaster ? 'Master' : userPrimaryRole || 'No Role'}
            </span>
          </div>
          <div class="dropdown-permissions">
            <span class="perm-item" class:enabled={userCanView}>👁 View</span>
            <span class="perm-item" class:enabled={userCanEdit}>✏️ Edit</span>
            <span class="perm-item" class:enabled={userCanDelete}>🗑 Delete</span>
            <span class="perm-item" class:enabled={isAdmin}>📨 Invite</span>
          </div>
          <div class="dropdown-divider"></div>
          {#if canManageUsers}
            <button class="dropdown-item" on:click={() => { showUserManagement = true; showUserMenu = false; }}>
              Manage Users & Roles
            </button>
            <div class="dropdown-divider"></div>
          {/if}
          <button class="dropdown-item logout" on:click={logout}>
            Sign Out
          </button>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="main">
    <div class="tree-panel" class:collapsed={treeNavCollapsed}>
      <div class="panel-header tree-header">
        <button class="tree-toggle-btn" on:click={() => treeNavCollapsed = !treeNavCollapsed} title={treeNavCollapsed ? 'Expand Tree' : 'Collapse Tree'}>
          {treeNavCollapsed ? '▶' : '▼'}
        </button>
        <span>├─ Tree Navigation</span>
        <button class="add-company-btn" on:click={() => showNewCompanyModal = true} title="Create New Company Group">
          + New Group
        </button>
      </div>
      <div class="tree-content" class:hidden={treeNavCollapsed}>
        {#if tree.length === 0}
          <div class="empty-tree">
            <p>No Company Groups yet</p>
            <button class="btn-primary" on:click={() => showNewCompanyModal = true}>
              Create Your First Company Group
            </button>
          </div>
        {:else}
          {#each tree as node, i}
            {@render treeNode(node, 0, i === tree.length - 1, [])}
          {/each}
        {/if}
      </div>
    </div>
    
    <div class="table-panel">
      <div class="table-panel-scroll">
      {#if selectedNode}
        {#if hierarchyPath.length > 1}
          <div class="hierarchy-path">
            <span class="path-label">└─ Path:</span>
            {#each hierarchyPath as item, i}
              {#if i > 0}<span class="path-sep">→</span>{/if}
              <span class="path-item" style="color: {typeColors[item.type]}">[{typeLabels[item.type]}] {item.name}</span>
            {/each}
          </div>
        {/if}
        
        {#if entityDetails}
        <div class="properties-section">
          <div class="panel-header collapsible" on:click={() => { showProperties = !showProperties; if (selectedNode) saveNodePreference(selectedNode.type, selectedNode.id, 'showProperties', showProperties); }} on:keydown={(e) => e.key === 'Enter' && (showProperties = !showProperties)} role="button" tabindex="0">
            <span>├─ {showProperties ? '▼' : '▶'} {typeLabels[selectedNode.type]} Properties</span>
          </div>
          {#if showProperties}
          <div class="properties-grid">
            {#each entityFields[selectedNode.type] || [] as field}
              <div class="property-row">
                <span class="property-label">{field.label}:</span>
                {#if editingProperty === field.key}
                  <input type="text" class="property-input" bind:value={propertyEditValue} />
                  <button class="btn-save" on:click={savePropertyEdit}>Save</button>
                  <button class="btn-cancel" on:click={cancelPropertyEdit}>Cancel</button>
                {:else}
                  <span class="property-value">{entityDetails[field.key] || '-'}</span>
                  <button class="btn-edit" on:click={() => startPropertyEdit(field.key)}>Edit</button>
                {/if}
              </div>
            {/each}
            
            {#if selectedNode.type === 'stage'}
              <div class="property-row stage-date-row">
                <span class="property-label">Registration Date:</span>
                {#if editingProperty === 'registrationDate'}
                  <input type="date" class="property-input date-input" bind:value={propertyEditValue} />
                  <button class="btn-save" on:click={savePropertyEdit}>Save</button>
                  <button class="btn-cancel" on:click={cancelPropertyEdit}>Cancel</button>
                {:else}
                  <span class="property-value date-value registration">{entityDetails.registrationDate ? new Date(entityDetails.registrationDate).toLocaleDateString() : '-'}</span>
                  <button class="btn-edit" on:click={() => startPropertyEdit('registrationDate')}>Edit</button>
                {/if}
              </div>
            {/if}
          </div>
          {/if}
        </div>
        {/if}
        
        {#if selectedNode?.type === 'project'}
        <div class="pricing-section">
          <div class="panel-header collapsible" on:click={() => { showPricingPanel = !showPricingPanel; if (showPricingPanel && selectedNode) loadPricing(selectedNode.id); }} on:keydown={(e) => e.key === 'Enter' && (showPricingPanel = !showPricingPanel)} role="button" tabindex="0">
            <span>├─ {showPricingPanel ? '▼' : '▶'} Product Pricing Matrix</span>
          </div>
          {#if showPricingPanel}
          <div class="pricing-content">
            <div class="pricing-header">
              <p class="pricing-desc">Define base pricing for standard lot products. Lots with "Masterplan" status will use these prices.</p>
              <div class="pricing-actions">
                {#if editingPricing}
                  <button class="btn-save" on:click={savePricing}>💾 Save</button>
                  <button class="btn-cancel" on:click={() => { editingPricing = false; if (selectedNode) loadPricing(selectedNode.id); }}>Cancel</button>
                {:else}
                  <button class="btn-edit" on:click={() => editingPricing = true}>✏️ Edit</button>
                {/if}
              </div>
            </div>
            
            <div class="pricing-table-wrapper">
              <table class="pricing-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Frontage (m)</th>
                    <th>Depth (m)</th>
                    <th>Area (m²)</th>
                    <th>Base Price ($)</th>
                    <th>$/m²</th>
                    <th>Balance Rate (%)</th>
                    {#if editingPricing}<th></th>{/if}
                  </tr>
                </thead>
                <tbody>
                  {#each pricingProducts as product, i}
                    <tr>
                      <td>
                        {#if editingPricing}
                          <input type="text" class="pricing-input name" bind:value={product.productName} placeholder="{product.frontage}x{product.depth}" />
                        {:else}
                          <span class="product-name">{product.productName || `${product.frontage}x${product.depth}`}</span>
                        {/if}
                      </td>
                      <td>
                        {#if editingPricing}
                          <input type="number" class="pricing-input" bind:value={product.frontage} step="0.5" on:change={() => { product.baseArea = product.frontage * product.depth; product.pricePerSqm = product.basePrice / product.baseArea; }} />
                        {:else}
                          {product.frontage}
                        {/if}
                      </td>
                      <td>
                        {#if editingPricing}
                          <input type="number" class="pricing-input" bind:value={product.depth} step="1" on:change={() => { product.baseArea = product.frontage * product.depth; product.pricePerSqm = product.basePrice / product.baseArea; }} />
                        {:else}
                          {product.depth}
                        {/if}
                      </td>
                      <td class="area-cell">{product.baseArea.toFixed(1)}</td>
                      <td>
                        {#if editingPricing}
                          <input type="number" class="pricing-input price" bind:value={product.basePrice} step="1000" on:change={() => updateProductPrice(i, product.basePrice)} />
                        {:else}
                          <span class="price-value">${product.basePrice.toLocaleString()}</span>
                        {/if}
                      </td>
                      <td class="sqm-cell">
                        <span class="sqm-value {product.pricePerSqm > 0 ? (product.pricePerSqm > 1500 ? 'high' : product.pricePerSqm > 1000 ? 'medium' : 'low') : ''}">
                          ${product.pricePerSqm.toFixed(0)}
                        </span>
                      </td>
                      <td>
                        {#if editingPricing}
                          <input type="number" class="pricing-input rate" bind:value={product.balanceRate} min="0" max="100" step="5" />
                        {:else}
                          {product.balanceRate}%
                        {/if}
                      </td>
                      {#if editingPricing}
                        <td>
                          <button class="btn-remove" on:click={() => removeProduct(i)}>✕</button>
                        </td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            
            {#if editingPricing}
              <button class="btn-add-product" on:click={addProduct}>+ Add Product</button>
            {/if}
            
            <div class="pricing-legend">
              <span class="legend-item"><span class="dot high"></span> High $/m² (&gt;$1500)</span>
              <span class="legend-item"><span class="dot medium"></span> Medium ($1000-$1500)</span>
              <span class="legend-item"><span class="dot low"></span> Low (&lt;$1000)</span>
            </div>
            
            <div class="pricing-info">
              <h4>💡 How Lot Pricing Works:</h4>
              <ul>
                <li><strong>Base Price:</strong> Applied to lots matching the product dimensions</li>
                <li><strong>Balance Rate:</strong> % of $/m² applied to excess area beyond base product</li>
                <li><strong>Example:</strong> 12.5x32m lot using 12.5x28 base → Base price + (32sqm × $/m² × Balance%)</li>
              </ul>
            </div>
            
            <!-- $/sqm Trend Graph -->
            {#if pricingProducts.length > 0 && pricingProducts.some(p => p.pricePerSqm > 0)}
            {@const pricedProducts = pricingProducts.filter(p => p.pricePerSqm > 0)}
            {@const rawMinSqm = Math.min(...pricedProducts.map(p => p.pricePerSqm))}
            {@const rawMaxSqm = Math.max(...pricedProducts.map(p => p.pricePerSqm))}
            {@const priceRange = rawMaxSqm - rawMinSqm}
            {@const graphMinSqm = Math.max(0, rawMinSqm - priceRange * 0.2)}
            {@const graphMaxSqm = rawMaxSqm + priceRange * 0.2 || 2000}
            {@const graphSortedProducts = [...pricingProducts].sort((a, b) => a.baseArea - b.baseArea)}
            {@const graphMinArea = Math.min(...pricingProducts.map(p => p.baseArea))}
            {@const graphMaxArea = Math.max(...pricingProducts.map(p => p.baseArea))}
            {@const trendLine = calculateTrendLine(pricingProducts)}
            <div class="pricing-graph-section full-width">
              <div class="graph-header">
                <h4>📈 $/m² Trend by Area {#if editingPricing}<span class="graph-edit-hint">(drag or ↑↓ keys to adjust)</span>{/if}</h4>
                <div class="graph-actions">
                  {#if editingPricing}
                    <button class="btn-graph-save" on:click={savePricing}>💾 Save</button>
                    <button class="btn-graph-cancel" on:click={() => { editingPricing = false; selectedGraphPoint = null; }}>✕ Cancel</button>
                  {:else}
                    <button class="btn-graph-edit" on:click={() => editingPricing = true}>✏️ Edit</button>
                  {/if}
                </div>
              </div>
              <div class="pricing-graph-container">
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <svg 
                  bind:this={graphSvgRef}
                  class="pricing-graph" 
                  class:editing={editingPricing}
                  viewBox="0 0 1200 480" 
                  preserveAspectRatio="xMidYMid meet"
                  on:mousemove={handleGraphMouseMove}
                  on:mouseup={stopDragPoint}
                  on:mouseleave={stopDragPoint}
                  on:keydown={handleGraphKeydown}
                  role="application"
                  aria-label="Interactive pricing graph"
                  tabindex="0"
                >
                  <defs>
                    <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" style="stop-color:#9ece6a;stop-opacity:0.2" />
                      <stop offset="50%" style="stop-color:#e0af68;stop-opacity:0.2" />
                      <stop offset="100%" style="stop-color:#f7768e;stop-opacity:0.2" />
                    </linearGradient>
                  </defs>
                  
                  <rect x="80" y="30" width="1040" height="360" fill="#1a1b26" stroke="#3b4261" />
                  
                  {#each [0, 1, 2, 3, 4, 5, 6, 7] as i}
                    {@const yPos = 390 - i * 45}
                    {@const priceValue = graphMinSqm + (graphMaxSqm - graphMinSqm) * i / 7}
                    <line x1="80" y1={yPos} x2="1120" y2={yPos} stroke="#3b4261" stroke-dasharray="2,2" />
                    <text x="72" y={yPos + 5} fill="#a9b1d6" font-size="14" text-anchor="end" font-weight="500">
                      ${Math.round(priceValue)}
                    </text>
                  {/each}
                  
                  <!-- Trend Line (Linear Regression) -->
                  {#if trendLine && graphSortedProducts.length >= 2}
                    {@const trendY1 = trendLine.slope * graphMinArea + trendLine.intercept}
                    {@const trendY2 = trendLine.slope * graphMaxArea + trendLine.intercept}
                    {@const trendX1 = 80}
                    {@const trendX2 = 1120}
                    {@const trendYPos1 = 390 - ((trendY1 - graphMinSqm) / (graphMaxSqm - graphMinSqm)) * 315}
                    {@const trendYPos2 = 390 - ((trendY2 - graphMinSqm) / (graphMaxSqm - graphMinSqm)) * 315}
                    <line 
                      x1={trendX1} 
                      y1={Math.max(30, Math.min(390, trendYPos1))} 
                      x2={trendX2} 
                      y2={Math.max(30, Math.min(390, trendYPos2))} 
                      stroke="#bb9af7" 
                      stroke-width="3" 
                      stroke-dasharray="10,5"
                      opacity="0.8"
                    />
                    <text x="1125" y={Math.max(35, Math.min(385, trendYPos2))} fill="#bb9af7" font-size="13" text-anchor="start" font-weight="600">trend</text>
                  {/if}
                  
                  <!-- Area fill under points -->
                  {#if graphSortedProducts.length > 1}
                    {@const areaPoints = graphSortedProducts.filter(p => p.pricePerSqm > 0).map(p => {
                      const x = 80 + (p.baseArea - graphMinArea) / (graphMaxArea - graphMinArea || 1) * 1040;
                      const y = 390 - ((p.pricePerSqm - graphMinSqm) / (graphMaxSqm - graphMinSqm || 1)) * 315;
                      return `${x},${y}`;
                    }).join(' ')}
                    <polygon 
                      points="{areaPoints} 1120,390 80,390" 
                      fill="url(#trendGradient)" 
                    />
                  {/if}
                  
                  <!-- Connecting line between points -->
                  {#if graphSortedProducts.length > 1}
                    {@const linePoints = graphSortedProducts.filter(p => p.pricePerSqm > 0).map(p => {
                      const x = 80 + (p.baseArea - graphMinArea) / (graphMaxArea - graphMinArea || 1) * 1040;
                      const y = 390 - ((p.pricePerSqm - graphMinSqm) / (graphMaxSqm - graphMinSqm || 1)) * 315;
                      return `${x},${y}`;
                    }).join(' ')}
                    <polyline 
                      points={linePoints}
                      fill="none" 
                      stroke="#7aa2f7" 
                      stroke-width="3"
                      opacity="0.7"
                    />
                  {/if}
                  
                  <!-- Data points (draggable when editing) -->
                  {#each graphSortedProducts.filter(p => p.pricePerSqm > 0) as product, i}
                    {@const originalIndex = pricingProducts.findIndex(p => p === product)}
                    {@const xPos = 80 + (product.baseArea - graphMinArea) / (graphMaxArea - graphMinArea || 1) * 1040}
                    {@const yPos = 390 - ((product.pricePerSqm - graphMinSqm) / (graphMaxSqm - graphMinSqm || 1)) * 315}
                    {@const isDragging = draggingPointIndex === originalIndex}
                    {@const isSelected = selectedGraphPoint === originalIndex}
                    <text x={xPos} y="420" fill="#c0caf5" font-size="13" text-anchor="middle" font-weight="600" transform="rotate(-35, {xPos}, 420)">
                      {product.baseArea.toFixed(0)}m²
                    </text>
                    <g 
                      class="graph-point" 
                      class:draggable={editingPricing}
                      class:dragging={isDragging}
                      class:selected={isSelected}
                      on:mousedown={(e) => selectAndDragPoint(e, originalIndex)}
                      on:click={() => selectPoint(originalIndex)}
                      on:keydown={(e) => e.key === 'Enter' && selectPoint(originalIndex)}
                      role="button"
                      tabindex="0"
                    >
                      <circle 
                        cx={xPos} 
                        cy={yPos} 
                        r={isDragging || isSelected ? 12 : 8} 
                        fill={product.pricePerSqm > 1500 ? '#f7768e' : product.pricePerSqm > 1000 ? '#e0af68' : '#9ece6a'}
                        stroke={isDragging || isSelected ? '#fff' : '#1a1b26'}
                        stroke-width={isDragging || isSelected ? 3 : 2}
                        style="transition: r 0.1s, stroke-width 0.1s"
                      />
                      <text x={xPos} y={yPos - 20} fill="#c0caf5" font-size="13" text-anchor="middle" font-weight="600">
                        {product.productName || `${product.frontage}x${product.depth}`}
                      </text>
                      <text x={xPos} y={yPos + 30} fill="#7aa2f7" font-size="13" text-anchor="middle" font-weight="700">
                        ${product.pricePerSqm.toFixed(0)}/m²
                      </text>
                    </g>
                  {/each}
                  
                  <text x="600" y="465" fill="#c0caf5" font-size="15" text-anchor="middle" font-weight="600">Area (m²)</text>
                  <text x="30" y="210" fill="#c0caf5" font-size="15" text-anchor="middle" font-weight="600" transform="rotate(-90, 30, 210)">$/m²</text>
                </svg>
              </div>
              <div class="graph-legend">
                <span class="legend-item"><span class="dot" style="background:#7aa2f7"></span> Actual $/m²</span>
                <span class="legend-item"><span class="dot" style="background:#bb9af7"></span> Trend Line</span>
                {#if trendLine}
                  <span class="legend-item trend-info">
                    {trendLine.slope < 0 ? '📉' : '📈'} {Math.abs(trendLine.slope).toFixed(2)} $/m² per m²
                  </span>
                {/if}
                {#if editingPricing && trendLine}
                  <button class="btn-apply-trend" on:click={applyTrendToAllProducts}>
                    📐 Fill Empty from Trend
                  </button>
                {/if}
              </div>
              {#if !editingPricing && pricingProducts.some(p => p.basePrice > 0)}
                {@const masterplanCount = tableData.filter(lot => lot.status?.toLowerCase() === 'masterplan' && (!lot.price || lot.price === 0)).length}
                {#if masterplanCount > 0}
                  <div class="graph-apply-all">
                    <button class="btn-apply-all-pricing" on:click={applyPricingToMasterplanLots}>
                      💰 Update All {masterplanCount} Masterplan Lots with Pricing
                    </button>
                  </div>
                {/if}
              {/if}
              <p class="graph-note">{#if editingPricing}Set 2+ prices, then use "Fill Empty from Trend" to auto-fill remaining products{:else}Click Edit to adjust prices by dragging points{/if}</p>
            </div>
            {/if}
          </div>
          {/if}
        </div>
        {/if}
        
        <div class="documents-section">
          <div class="panel-header collapsible" on:click={() => { showDocuments = !showDocuments; if (showDocuments) loadDocuments(); }} on:keydown={(e) => e.key === 'Enter' && (showDocuments = !showDocuments)} role="button" tabindex="0">
            <span>├─ {showDocuments ? '▼' : '▶'} Documents</span>
          </div>
          {#if showDocuments}
            <div class="documents-content">
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
                <input type="file" id="doc-upload" accept="image/*,.pdf" on:change={handleFileUpload} disabled={uploading} />
                <label for="doc-upload" class="upload-label">{uploading ? 'Uploading...' : '+ Upload'}</label>
              </div>
              {#if documents.length > 0}
                <div class="doc-list">
                  {#each documents as doc}
                    <div class="doc-item">
                      <button class="doc-name" on:click={() => previewDocument = doc}>{doc.originalName}</button>
                      <span class="doc-type-badge {doc.documentType || 'other'}">{doc.documentType === 'permit_plan' ? 'PP' : doc.documentType === 'plan_subdivision' ? 'PS' : ''}</span>
                      <span class="doc-size">{(doc.size / 1024).toFixed(1)}KB</span>
                      {#if doc.mimeType?.startsWith('image/') || doc.mimeType === 'application/pdf'}
                        <button class="btn-view-inline" on:click={() => { inlineDocument = doc; inlineZoom = 1; }}>
                          {inlineDocument?.id === doc.id ? '✓ Viewing' : '👁 View'}
                        </button>
                      {/if}
                      {#if selectedNode?.type === 'stage'}
                        {#if doc.documentType === 'plan_subdivision'}
                          <select 
                            class="model-selector-small" 
                            bind:value={selectedModel}
                            title="Choose AI model"
                          >
                            {#each modelOptions as model}
                              <option value={model.id}>{model.name}</option>
                            {/each}
                          </select>
                          <button class="btn-pos-analyze" on:click={() => analyzePlanOfSubdivision(doc.id)} disabled={extractingDocId !== null}>
                            {extractingDocId === doc.id ? 'Analyzing...' : '📊 Analyze POS'}
                          </button>
                        {:else if tableData.length === 0}
                          <button class="btn-extract" on:click={() => extractFromDocument(doc.id, false)} disabled={extractingDocId !== null}>
                            {extractingDocId === doc.id ? 'Extracting...' : '🤖 Extract'}
                          </button>
                        {:else}
                          <button class="btn-reanalyze" on:click={() => extractFromDocument(doc.id, true)} disabled={extractingDocId !== null}>
                            {extractingDocId === doc.id ? 'Analyzing...' : '🔄 Re-analyze'}
                          </button>
                        {/if}
                      {/if}
                      {#if selectedNode?.type === 'precinct'}
                        <select 
                          class="model-selector-small" 
                          bind:value={selectedModel}
                          title="Choose AI model"
                        >
                          {#each modelOptions as model}
                            <option value={model.id}>{model.name}</option>
                          {/each}
                        </select>
                        {#if doc.documentType === 'permit_plan'}
                          <button class="btn-permit" on:click={() => openPreExtractionModal(doc.id)} disabled={extractingDocId !== null}>
                            {extractingDocId === doc.id ? 'Analyzing...' : '📋 Extract'}
                          </button>
                        {:else if doc.documentType === 'plan_subdivision'}
                          <button class="btn-crossref" on:click={() => crossReferenceDocument(doc.id)} disabled={extractingDocId !== null}>
                            {extractingDocId === doc.id ? 'Comparing...' : '🔗 Cross-Ref'}
                          </button>
                        {:else}
                          <button class="btn-permit" on:click={() => openPreExtractionModal(doc.id)} disabled={extractingDocId !== null}>
                            {extractingDocId === doc.id ? 'Analyzing...' : '📋 Analyze'}
                          </button>
                        {/if}
                      {/if}
                      <button class="btn-delete" on:click={() => deleteDocument(doc.id)}>Del</button>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="empty-msg">No documents uploaded</div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
      
      {#if inlineDocument}
        <div class="inline-viewer-section">
          <div class="inline-viewer-header">
            <span>{inlineDocument.mimeType === 'application/pdf' ? '📑' : '📄'} {inlineDocument.originalName}</span>
            <div class="inline-viewer-controls">
              {#if inlineDocument.mimeType?.startsWith('image/')}
                <button class="zoom-btn" on:click={() => inlineZoom = Math.max(0.5, inlineZoom - 0.25)}>🔍−</button>
                <span class="zoom-level">{Math.round(inlineZoom * 100)}%</span>
                <button class="zoom-btn" on:click={() => inlineZoom = Math.min(3, inlineZoom + 0.25)}>🔍+</button>
                <button class="zoom-btn" on:click={() => inlineZoom = 1}>Reset</button>
              {/if}
              {#if inlineDocument.mimeType === 'application/pdf'}
                <div class="page-controls">
                  <button class="page-btn" on:click={() => pdfPageNumber = Math.max(1, pdfPageNumber - 1)} title="Previous page">◀</button>
                  <span class="page-indicator">Page {pdfPageNumber}</span>
                  <button class="page-btn" on:click={() => pdfPageNumber++} title="Next page">▶</button>
                </div>
              {/if}
              <button 
                class="btn-capture" 
                on:click={captureScreen}
                disabled={isCapturing}
                title="Capture your screen view for AI analysis"
              >
                {isCapturing ? '⏳' : '📷'} {capturedImage ? 'Re-capture' : 'Capture'}
              </button>
              {#if capturedImage}
                <span class="capture-indicator" title="Screen capture ready">✓</span>
                <button class="btn-clear-capture" on:click={clearCapture} title="Clear capture">✕</button>
              {/if}
              <select 
                class="model-selector" 
                bind:value={selectedModel}
                title="Choose AI model for extraction"
              >
                {#each modelOptions as model}
                  <option value={model.id}>{model.name}</option>
                {/each}
              </select>
              <button 
                class="btn-analyze-page" 
                on:click={analyzePageForVerification}
                disabled={analyzingPage || (!capturedImage && inlineDocument.mimeType !== 'application/pdf')}
                title={capturedImage ? "Analyze captured screen" : "Analyze PDF page and verify lot data"}
              >
                {analyzingPage ? '⏳' : '🔍'} Extract Data
              </button>
              <input type="range" min="150" max="500" bind:value={inlineViewerHeight} class="height-slider" title="Adjust viewer height" />
              <button class="btn-close-inline" on:click={() => inlineDocument = null}>✕</button>
            </div>
          </div>
          <div class="inline-viewer-container" style="height: {inlineViewerHeight}px;">
            {#if inlineDocument.mimeType === 'application/pdf'}
              <iframe 
                src="/uploads/{inlineDocument.filename}" 
                title={inlineDocument.originalName}
                class="inline-viewer-pdf"
              ></iframe>
            {:else}
              <div class="inline-viewer-scroll">
                <img 
                  src="/uploads/{inlineDocument.filename}" 
                  alt={inlineDocument.originalName} 
                  class="inline-viewer-image"
                  style="transform: scale({inlineZoom}); transform-origin: top left;"
                />
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      {#if tableSummary}
        <div class="summary-section">
          <div class="panel-header collapsible" on:click={() => { showSummary = !showSummary; if (selectedNode) saveNodePreference(selectedNode.type, selectedNode.id, 'showSummary', showSummary); }} on:keydown={(e) => e.key === 'Enter' && (showSummary = !showSummary)} role="button" tabindex="0">
            <span>├─ {showSummary ? '▼' : '▶'} Summary</span>
          </div>
          {#if showSummary}
          <div class="summary-tree">
            <div class="summary-row"><span class="tree-prefix">├─</span><span class="sum-label">Lots</span><span class="sum-arrow">→</span><span class="sum-val cyan">{tableSummary.totalLots}</span></div>
            <div class="summary-row"><span class="tree-prefix">├─</span><span class="sum-label">Area</span><span class="sum-arrow">→</span><span class="sum-val yellow sum-col1">{tableSummary.totalArea} sqm</span><span class="sum-sep">·</span><span class="sum-label sum-label2">Avg</span><span class="sum-arrow">→</span><span class="sum-val yellow">{tableSummary.avgArea} sqm</span></div>
            <div class="summary-row"><span class="tree-prefix">├─</span><span class="sum-label">Frontage</span><span class="sum-arrow">→</span><span class="sum-val magenta">{tableSummary.totalFrontage}</span><span class="sum-unit">m</span></div>
            {#if tableData.some(lot => parseFloat(lot.price) > 0)}
              {@const lotsWithPrice = tableData.filter(lot => parseFloat(lot.price) > 0)}
              {@const grossRevenue = lotsWithPrice.reduce((sum, lot) => sum + (parseFloat(lot.price) || 0), 0)}
              {@const avgPricePerLot = lotsWithPrice.length > 0 ? Math.round(grossRevenue / lotsWithPrice.length) : 0}
              {@const totalPricedArea = lotsWithPrice.reduce((sum, lot) => sum + (parseFloat(lot.area) || 0), 0)}
              {@const avgPriceSqm = totalPricedArea > 0 ? Math.round(grossRevenue / totalPricedArea) : 0}
              <div class="summary-row"><span class="tree-prefix">├─</span><span class="sum-label">Revenue</span><span class="sum-arrow">→</span><span class="sum-val green sum-col1">${grossRevenue.toLocaleString()}</span><span class="sum-sep">·</span><span class="sum-label sum-label2">Priced</span><span class="sum-arrow">→</span><span class="sum-val cyan">{lotsWithPrice.length}/{tableData.length}</span></div>
              <div class="summary-row"><span class="tree-prefix">└─</span><span class="sum-label">Avg/Lot</span><span class="sum-arrow">→</span><span class="sum-val green sum-col1">${avgPricePerLot.toLocaleString()}</span><span class="sum-sep">·</span><span class="sum-label sum-label2">Avg/sqm</span><span class="sum-arrow">→</span><span class="sum-val green">${avgPriceSqm.toLocaleString()}</span></div>
            {:else}
              <div class="summary-row"><span class="tree-prefix">└─</span><span class="sum-label">Revenue</span><span class="sum-arrow">→</span><span class="sum-val dim">-</span></div>
            {/if}
          </div>
            {#if pricingProducts.length > 0 && pricingProducts.some(p => p.basePrice > 0)}
              {@const masterplanLots = tableData.filter(lot => lot.status?.toLowerCase() === 'masterplan')}
              {@const pricedLots = masterplanLots.map(lot => ({ lot, pricing: calculateLotPrice(lot) })).filter(l => l.pricing)}
              {#if pricedLots.length > 0}
                {@const totalValue = pricedLots.reduce((sum, l) => sum + (l.pricing?.totalPrice || 0), 0)}
                {@const avgPricePerSqm = Math.round(totalValue / pricedLots.reduce((sum, l) => sum + (parseFloat(l.lot.area) || 0), 0))}
                <div class="pricing-preview-section">
                  <div class="pricing-preview-header">
                    <span>Indicative Pricing Preview</span>
                    <span class="preview-count">{pricedLots.length} Masterplan lots</span>
                  </div>
                  <div class="pricing-preview-table">
                    <div class="preview-row header">
                      <span class="col-lot">Lot</span>
                      <span class="col-dims">Dimensions</span>
                      <span class="col-match">Base Product</span>
                      <span class="col-price">Indicative Price</span>
                    </div>
                    {#each pricedLots.slice(0, 8) as { lot, pricing }}
                      <div class="preview-row">
                        <span class="col-lot">{lot.lotNumber || lot.name}</span>
                        <span class="col-dims">{lot.frontage}×{lot.depth}m ({lot.area}m²)</span>
                        <span class="col-match">{pricing?.matchedProduct}</span>
                        <span class="col-price">${pricing?.totalPrice.toLocaleString()}</span>
                      </div>
                    {/each}
                    {#if pricedLots.length > 8}
                      <div class="preview-row more">
                        <span>... and {pricedLots.length - 8} more lots</span>
                      </div>
                    {/if}
                  </div>
                  <div class="pricing-preview-summary">
                    <div class="preview-total">
                      <span class="label">Total Portfolio Value:</span>
                      <span class="value">${totalValue.toLocaleString()}</span>
                    </div>
                    <div class="preview-avg">
                      <span class="label">Avg:</span>
                      <span class="value">${avgPricePerSqm}/m²</span>
                    </div>
                  </div>
                  <div class="pricing-action-buttons">
                    <button class="btn-review-pricing" on:click={startPricingReview}>
                      ✏️ Review & Edit All Prices
                    </button>
                    <button class="btn-apply-pricing" on:click={applyPricingToMasterplanLots}>
                      ✓ Quick Apply to {pricedLots.length} Lots
                    </button>
                  </div>
                </div>
              {/if}
            {/if}
          {/if}
        </div>
      {/if}
      
      <!-- PRECINCT LAND BUDGET SUMMARY - Read-only aggregation of Stage data -->
      {#if selectedNode?.type === 'precinct'}
        <div class="forecast-section">
          <div class="panel-header collapsible" on:click={togglePrecinctLandBudget} on:keydown={(e) => e.key === 'Enter' && togglePrecinctLandBudget()} role="button" tabindex="0">
            <span>├─ {showLandBudget ? '▼' : '▶'} Land Budget Summary</span>
          </div>
        </div>
      {/if}
      
      <!-- PRECINCT LAND BUDGET SUMMARY CONTENT (Read-only) -->
      {#if selectedNode?.type === 'precinct' && showLandBudget}
        {@const totalSiteArea = parseFloat(getLandBudgetValue('totalSiteArea') || '0')}
        {@const transportTotal = calculateLandBudgetTotal(['transport'])}
        {@const communityTotal = calculateLandBudgetTotal(['community'])}
        {@const educationTotal = calculateLandBudgetTotal(['education'])}
        {@const encumberedTotal = calculateLandBudgetTotal(['encumberedOpenSpace'])}
        {@const creditedTotal = calculateLandBudgetTotal(['creditedOpenSpace'])}
        {@const openSpaceTotal = encumberedTotal + creditedTotal}
        {@const deductionsTotal = transportTotal + communityTotal + educationTotal + openSpaceTotal}
        {@const residentialTotal = calculateLandBudgetTotal(['residential'])}
        {@const roadsTotal = calculateLandBudgetTotal(['roads'])}
        {@const nraTotal = residentialTotal + roadsTotal}
        {@const nonResTotal = calculateLandBudgetTotal(['nonResidentialAreas'])}
        {@const ndaTotal = nraTotal + nonResTotal}
        {@const calculatedSiteArea = deductionsTotal + ndaTotal}
        {@const siteAreaBalanced = Math.abs(totalSiteArea - calculatedSiteArea) < 0.0001 || totalSiteArea === 0}
        <div class="land-budget-panel">
          <div class="land-budget-header">
            <div class="land-budget-controls">
              <span class="lb-summary-label">Aggregated from {landBudgetStages.length} stage(s)</span>
            </div>
            <div class="lot-area-check">
              {#if !siteAreaBalanced && totalSiteArea > 0}
                <span class="check-warning">⚠️ Total Site Area ≠ Deductions + NDA</span>
              {/if}
            </div>
          </div>
          
          {#if loadingLandBudget}
            <div class="loading-state">Loading land budget...</div>
          {:else if landBudgetStages.length === 0}
            <div class="empty-state">No stage land budget data. Edit land budgets at the Stage level.</div>
          {:else}
            <div class="land-budget-tree">
              <!-- Total Site Area -->
              <div class="lb-row">
                <div class="lb-indent-0">├─</div>
                <div class="lb-name lb-color-white">Total Site Area</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-cyan">{totalSiteArea ? totalSiteArea.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              
              <!-- Transport -->
              <div class="lb-row lb-clickable" on:click={() => toggleLbCategory('transport')} on:keydown={(e) => e.key === 'Enter' && toggleLbCategory('transport')} role="button" tabindex="0">
                <div class="lb-indent-0">├─ {lbExpandedCategories.has('transport') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-brown">Transport</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-brown">{transportTotal ? transportTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              {#if lbExpandedCategories.has('transport')}
                {#each landBudgetStages as stage}
                  {@const stageVal = parseFloat(getLandBudgetStageValue(stage.id, 'transport') || '0') + 
                    (landBudgetCategories.transport?.subcategories || []).reduce((sum: number, sub: any) => sum + parseFloat(getLandBudgetStageValue(stage.id, 'transport', sub.key) || '0'), 0)}
                  {#if stageVal > 0}
                    <div class="lb-row lb-sub lb-stage-source">
                      <div class="lb-indent-1">│ ├─</div>
                      <div class="lb-name lb-color-gray">{stage.name}</div>
                      <div class="lb-arrow">→</div>
                      <div class="lb-value lb-color-brown">{stageVal.toFixed(4)}</div>
                      <div class="lb-unit">ha</div>
                    </div>
                  {/if}
                {/each}
              {/if}
              
              <!-- Community -->
              <div class="lb-row lb-clickable" on:click={() => toggleLbCategory('community')} on:keydown={(e) => e.key === 'Enter' && toggleLbCategory('community')} role="button" tabindex="0">
                <div class="lb-indent-0">├─ {lbExpandedCategories.has('community') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-gold">Community</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-gold">{communityTotal ? communityTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              {#if lbExpandedCategories.has('community')}
                {#each landBudgetStages as stage}
                  {@const stageVal = (landBudgetCategories.community?.subcategories || []).reduce((sum: number, sub: any) => sum + parseFloat(getLandBudgetStageValue(stage.id, 'community', sub.key) || '0'), 0)}
                  {#if stageVal > 0}
                    <div class="lb-row lb-sub lb-stage-source">
                      <div class="lb-indent-1">│ ├─</div>
                      <div class="lb-name lb-color-gray">{stage.name}</div>
                      <div class="lb-arrow">→</div>
                      <div class="lb-value lb-color-gold">{stageVal.toFixed(4)}</div>
                      <div class="lb-unit">ha</div>
                    </div>
                  {/if}
                {/each}
              {/if}
              
              <!-- Education -->
              <div class="lb-row lb-clickable" on:click={() => toggleLbCategory('education')} on:keydown={(e) => e.key === 'Enter' && toggleLbCategory('education')} role="button" tabindex="0">
                <div class="lb-indent-0">├─ {lbExpandedCategories.has('education') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-blue">Education</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-blue">{educationTotal ? educationTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              {#if lbExpandedCategories.has('education')}
                {#each landBudgetStages as stage}
                  {@const stageVal = (landBudgetCategories.education?.subcategories || []).reduce((sum: number, sub: any) => sum + parseFloat(getLandBudgetStageValue(stage.id, 'education', sub.key) || '0'), 0)}
                  {#if stageVal > 0}
                    <div class="lb-row lb-sub lb-stage-source">
                      <div class="lb-indent-1">│ ├─</div>
                      <div class="lb-name lb-color-gray">{stage.name}</div>
                      <div class="lb-arrow">→</div>
                      <div class="lb-value lb-color-blue">{stageVal.toFixed(4)}</div>
                      <div class="lb-unit">ha</div>
                    </div>
                  {/if}
                {/each}
              {/if}
              
              <!-- Open Space Network -->
              <div class="lb-row">
                <div class="lb-indent-0">├─</div>
                <div class="lb-name lb-color-green">Open Space Network</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-green">{openSpaceTotal ? openSpaceTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              
              <!-- Encumbered Open Space -->
              <div class="lb-row lb-clickable" on:click={() => toggleLbCategory('encumberedOpenSpace')} on:keydown={(e) => e.key === 'Enter' && toggleLbCategory('encumberedOpenSpace')} role="button" tabindex="0">
                <div class="lb-indent-1">│ ├─ {lbExpandedCategories.has('encumberedOpenSpace') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-green-light">Encumbered Open Space</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-green-light">{encumberedTotal ? encumberedTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              {#if lbExpandedCategories.has('encumberedOpenSpace')}
                {#each landBudgetStages as stage}
                  {@const stageVal = (landBudgetCategories.encumberedOpenSpace?.subcategories || []).reduce((sum: number, sub: any) => sum + parseFloat(getLandBudgetStageValue(stage.id, 'encumberedOpenSpace', sub.key) || '0'), 0)}
                  {#if stageVal > 0}
                    <div class="lb-row lb-sub lb-stage-source">
                      <div class="lb-indent-2">│ │ ├─</div>
                      <div class="lb-name lb-color-gray">{stage.name}</div>
                      <div class="lb-arrow">→</div>
                      <div class="lb-value lb-color-green-light">{stageVal.toFixed(4)}</div>
                      <div class="lb-unit">ha</div>
                    </div>
                  {/if}
                {/each}
              {/if}
              
              <!-- Credited Open Space -->
              <div class="lb-row lb-clickable" on:click={() => toggleLbCategory('creditedOpenSpace')} on:keydown={(e) => e.key === 'Enter' && toggleLbCategory('creditedOpenSpace')} role="button" tabindex="0">
                <div class="lb-indent-1">│ └─ {lbExpandedCategories.has('creditedOpenSpace') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-green-light">Credited Open Space</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-green-light">{creditedTotal ? creditedTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              {#if lbExpandedCategories.has('creditedOpenSpace')}
                {#each landBudgetStages as stage}
                  {@const stageVal = (landBudgetCategories.creditedOpenSpace?.subcategories || []).reduce((sum: number, sub: any) => sum + parseFloat(getLandBudgetStageValue(stage.id, 'creditedOpenSpace', sub.key) || '0'), 0)}
                  {#if stageVal > 0}
                    <div class="lb-row lb-sub lb-stage-source">
                      <div class="lb-indent-2">│   ├─</div>
                      <div class="lb-name lb-color-gray">{stage.name}</div>
                      <div class="lb-arrow">→</div>
                      <div class="lb-value lb-color-green-light">{stageVal.toFixed(4)}</div>
                      <div class="lb-unit">ha</div>
                    </div>
                  {/if}
                {/each}
              {/if}
              
              <!-- Total Deductions -->
              <div class="lb-row lb-total">
                <div class="lb-indent-0">├─</div>
                <div class="lb-name lb-color-purple">Total (Deductions)</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-purple">{deductionsTotal ? deductionsTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              
              <div class="lb-separator"></div>
              
              <!-- Net Residential Area (NRA) -->
              <div class="lb-row">
                <div class="lb-indent-0">├─</div>
                <div class="lb-name lb-color-teal">Net Residential Area (NRA)</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-teal">{nraTotal ? nraTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              
              <!-- Residential -->
              <div class="lb-row lb-clickable" on:click={() => toggleLbCategory('residential')} on:keydown={(e) => e.key === 'Enter' && toggleLbCategory('residential')} role="button" tabindex="0">
                <div class="lb-indent-1">│ ├─ {lbExpandedCategories.has('residential') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-red">Residential</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-red">{residentialTotal ? residentialTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              {#if lbExpandedCategories.has('residential')}
                {#each landBudgetStages as stage}
                  {@const stageVal = (landBudgetCategories.residential?.subcategories || []).reduce((sum: number, sub: any) => sum + parseFloat(getLandBudgetStageValue(stage.id, 'residential', sub.key) || '0'), 0)}
                  {#if stageVal > 0}
                    <div class="lb-row lb-sub lb-stage-source">
                      <div class="lb-indent-2">│ │ ├─</div>
                      <div class="lb-name lb-color-gray">{stage.name}</div>
                      <div class="lb-arrow">→</div>
                      <div class="lb-value lb-color-red">{stageVal.toFixed(4)}</div>
                      <div class="lb-unit">ha</div>
                    </div>
                  {/if}
                {/each}
              {/if}
              
              <!-- Roads -->
              <div class="lb-row lb-clickable" on:click={() => toggleLbCategory('roads')} on:keydown={(e) => e.key === 'Enter' && toggleLbCategory('roads')} role="button" tabindex="0">
                <div class="lb-indent-1">│ └─ {lbExpandedCategories.has('roads') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-gray">Roads</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-gray">{roadsTotal ? roadsTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              {#if lbExpandedCategories.has('roads')}
                {#each landBudgetStages as stage}
                  {@const stageVal = (landBudgetCategories.roads?.subcategories || []).reduce((sum: number, sub: any) => sum + parseFloat(getLandBudgetStageValue(stage.id, 'roads', sub.key) || '0'), 0)}
                  {#if stageVal > 0}
                    <div class="lb-row lb-sub lb-stage-source">
                      <div class="lb-indent-2">│   ├─</div>
                      <div class="lb-name lb-color-gray">{stage.name}</div>
                      <div class="lb-arrow">→</div>
                      <div class="lb-value lb-color-gray">{stageVal.toFixed(4)}</div>
                      <div class="lb-unit">ha</div>
                    </div>
                  {/if}
                {/each}
              {/if}
              
              <!-- Non Residential Areas -->
              <div class="lb-row lb-clickable" on:click={() => toggleLbCategory('nonResidentialAreas')} on:keydown={(e) => e.key === 'Enter' && toggleLbCategory('nonResidentialAreas')} role="button" tabindex="0">
                <div class="lb-indent-0">├─ {lbExpandedCategories.has('nonResidentialAreas') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-magenta">Non Residential Areas</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-magenta">{nonResTotal ? nonResTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
              {#if lbExpandedCategories.has('nonResidentialAreas')}
                {#each landBudgetStages as stage}
                  {@const stageVal = (landBudgetCategories.nonResidentialAreas?.subcategories || []).reduce((sum: number, sub: any) => sum + parseFloat(getLandBudgetStageValue(stage.id, 'nonResidentialAreas', sub.key) || '0'), 0)}
                  {#if stageVal > 0}
                    <div class="lb-row lb-sub lb-stage-source">
                      <div class="lb-indent-1">│ ├─</div>
                      <div class="lb-name lb-color-gray">{stage.name}</div>
                      <div class="lb-arrow">→</div>
                      <div class="lb-value lb-color-magenta">{stageVal.toFixed(4)}</div>
                      <div class="lb-unit">ha</div>
                    </div>
                  {/if}
                {/each}
              {/if}
              
              <!-- Total Net Developable Area -->
              <div class="lb-row lb-grand-total">
                <div class="lb-indent-0">└─</div>
                <div class="lb-name lb-color-orange">Total Net Developable Area (NDA)</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-orange">{ndaTotal ? ndaTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- PRECINCT FORECASTING TOOL - Separate Section -->
      {#if selectedNode?.type === 'precinct'}
        <div class="forecast-section">
          <div class="panel-header collapsible" on:click={() => { showForecastTool = !showForecastTool; if (showForecastTool) loadForecastData(); if (selectedNode) saveNodePreference(selectedNode.type, selectedNode.id, 'showForecastTool', showForecastTool); }} on:keydown={(e) => e.key === 'Enter' && (showForecastTool = !showForecastTool)} role="button" tabindex="0">
            <span>├─ {showForecastTool ? '▼' : '▶'} Forecast Tool</span>
          </div>
        </div>
      {/if}
      
      <!-- PRECINCT FORECASTING TOOL CONTENT -->
      {#if selectedNode?.type === 'precinct' && showForecastTool}
        {@const totalLotsToForecast = forecastStages.reduce((sum, s) => sum + (s.lots?.length || 0), 0)}
        {@const totalAllocated = forecastStages.reduce((sum, s) => {
          const stageData = forecastData.get(s.id);
          return sum + (stageData ? Array.from(stageData.values()).reduce((a, b) => a + b, 0) : 0);
        }, 0)}
        <div class="forecast-tool">
          <div class="forecast-header">
            <div class="forecast-stats-text">
              {#if forecastPeriods.length > 0 && forecastPeriod}
                {@const _fp = forecastPeriod}
                {@const _fk = forecastPeriodsKey}
                {@const periodLabel = _fp === 'days' ? 'Today' : _fp === 'months' ? 'This Month' : _fp === 'quarters' ? 'This Qtr' : _fp === 'halfyear' ? 'This Half' : 'This Year'}
                {@const currentPeriodStats = (() => {
                  const fp = _fp;
                  const now = new Date();
                  let currentKey = '';
                  if (fp === 'months') {
                    currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  } else if (fp === 'quarters') {
                    currentKey = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
                  } else if (fp === 'halfyear') {
                    currentKey = `${now.getFullYear()}-H${Math.floor(now.getMonth() / 6) + 1}`;
                  } else if (fp === 'year') {
                    currentKey = `${now.getFullYear()}`;
                  } else {
                    currentKey = now.toISOString().slice(0, 10);
                  }
                  const categories = ['sold_date', 'exchange_date', 'settled_date', 'cancelled_date'];
                  const stats: Record<string, { actual: number; total: number }> = {};
                  for (const cat of categories) {
                    stats[cat] = { actual: 0, total: 0 };
                  }
                  for (const stage of forecastStages) {
                    if (!stage.lots) continue;
                    for (const lot of stage.lots) {
                      const customData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {};
                      for (const cat of categories) {
                        const dateValue = customData[cat];
                        if (!dateValue) continue;
                        const d = new Date(dateValue);
                        let lotKey = '';
                        if (fp === 'months') {
                          lotKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        } else if (fp === 'quarters') {
                          lotKey = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
                        } else if (fp === 'halfyear') {
                          lotKey = `${d.getFullYear()}-H${Math.floor(d.getMonth() / 6) + 1}`;
                        } else if (fp === 'year') {
                          lotKey = `${d.getFullYear()}`;
                        } else {
                          lotKey = dateValue.slice(0, 10);
                        }
                        if (lotKey === currentKey) {
                          stats[cat].total++;
                          if (customData[`${cat}_actual`]) {
                            stats[cat].actual++;
                          }
                        }
                      }
                    }
                  }
                  return stats;
                })()}
                <button class="stat-link sold" class:active={forecastMode === 'sold_date'} on:click={() => { forecastMode = 'sold_date'; loadForecastData(); }}>
                  Sold: <span class="actual">{currentPeriodStats.sold_date.actual}</span>/<span class="target">{currentPeriodStats.sold_date.total}</span>
                </button>
                <button class="stat-link exchanged" class:active={forecastMode === 'exchange_date'} on:click={() => { forecastMode = 'exchange_date'; loadForecastData(); }}>
                  Exch: <span class="actual">{currentPeriodStats.exchange_date.actual}</span>/<span class="target">{currentPeriodStats.exchange_date.total}</span>
                </button>
                <button class="stat-link settled" class:active={forecastMode === 'settled_date'} on:click={() => { forecastMode = 'settled_date'; loadForecastData(); }}>
                  Sett: <span class="actual">{currentPeriodStats.settled_date.actual}</span>/<span class="target">{currentPeriodStats.settled_date.total}</span>
                </button>
                <button class="stat-link cancelled" class:active={forecastMode === 'cancelled_date'} on:click={() => { forecastMode = 'cancelled_date'; loadForecastData(); }}>
                  Canc: <span class="actual">{currentPeriodStats.cancelled_date.actual}</span>/<span class="target">{currentPeriodStats.cancelled_date.total}</span>
                </button>
              {/if}
            </div>
            
            <div class="forecast-controls">
              <div class="control-group">
                <label for="forecast-mode-select">Forecast Mode:</label>
                <select id="forecast-mode-select" bind:value={forecastMode} on:change={loadForecastData} class="forecast-select">
                  <option value="sold_date">Sales Date</option>
                  <option value="exchange_date">Exchange Date</option>
                  <option value="settled_date">Settlement Date</option>
                  <option value="cancelled_date">Cancel Date</option>
                  <option value="combined">📊 Combined View</option>
                </select>
              </div>
              
              <div class="control-group">
                <span class="control-label">Period:</span>
                <div class="period-buttons">
                  <button class:active={forecastPeriod === 'days'} on:click={() => { forecastPeriod = 'days'; forecastRange = 14; forecastPeriodOffset = 0; loadForecastData(); }}>Days</button>
                  <button class:active={forecastPeriod === 'months'} on:click={() => { forecastPeriod = 'months'; forecastRange = 6; forecastPeriodOffset = 0; loadForecastData(); }}>Month</button>
                  <button class:active={forecastPeriod === 'quarters'} on:click={() => { forecastPeriod = 'quarters'; forecastRange = 4; forecastPeriodOffset = 0; loadForecastData(); }}>Qtr</button>
                  <button class:active={forecastPeriod === 'halfyear'} on:click={() => { forecastPeriod = 'halfyear'; forecastRange = 2; forecastPeriodOffset = 0; loadForecastData(); }}>Half</button>
                  <button class:active={forecastPeriod === 'year'} on:click={() => { forecastPeriod = 'year'; forecastRange = 2; forecastPeriodOffset = 0; loadForecastData(); }}>Year</button>
                </div>
              </div>
              
              <div class="control-group">
                <label for="forecast-range-slider">Range: ±{forecastRange}</label>
                <input id="forecast-range-slider" type="range" min="1" max={forecastPeriod === 'days' ? 30 : forecastPeriod === 'months' ? 12 : 6} bind:value={forecastRange} class="range-slider" />
              </div>
              
              <div class="forecast-sort">
                <label for="lot-sort">Sort:</label>
                <select id="lot-sort" bind:value={forecastLotSort} class="forecast-select">
                  <option value="number">Lot #</option>
                  <option value="date">Date</option>
                  <option value="status">Status</option>
                  <option value="price">Price</option>
                </select>
                <button 
                  class="sort-direction-btn" 
                  on:click={() => forecastLotSortAsc = !forecastLotSortAsc}
                  title={forecastLotSortAsc ? 'Ascending - click for descending' : 'Descending - click for ascending'}
                >
                  {forecastLotSortAsc ? '↑' : '↓'}
                </button>
              </div>

              <div class="forecast-actions">
                {#if forecastEditMode}
                  <button class="btn-cancel" on:click={() => { forecastEditMode = false; loadForecastData(); }}>Cancel</button>
                  <button class="btn-save" on:click={saveForecast}>Save</button>
                {:else}
                  <button class="btn-edit" on:click={startForecastEdit}>Edit</button>
                {/if}
              </div>
            </div>
          </div>
          
          <div class="forecast-grid-wrapper">
            <table class="forecast-table">
              <thead>
                <tr>
                  <th class="th-stage th-sticky-left">Stage</th>
                  <th class="th-lots th-sticky-left th-sticky-left-2">Lots</th>
                  <th class="th-unalloc th-sticky-left th-sticky-left-3">Unalloc</th>
                  <th class="th-nav th-nav-prev">
                    <button class="nav-btn" on:click={forecastNavigatePrev} title="Previous periods">«</button>
                  </th>
                  {#each forecastPeriods as period}
                    <th class="th-period" class:current={period.key === getPeriodKeyForDate(new Date().toISOString())}>{period.label}</th>
                  {/each}
                  <th class="th-nav th-nav-next">
                    <button class="nav-btn" on:click={forecastNavigateNext} title="Next periods">»</button>
                  </th>
                  <th class="th-total th-sticky-right">Total $</th>
                </tr>
                {#if forecastPeriodOffset !== 0}
                  <tr class="offset-indicator">
                    <td colspan="3" class="th-sticky-left"></td>
                    <td colspan="{forecastPeriods.length + 2}" class="offset-info">
                      <button class="btn-reset-offset" on:click={forecastNavigateReset}>↺ Return to current</button>
                    </td>
                    <td class="th-sticky-right"></td>
                  </tr>
                {/if}
              </thead>
              <tbody>
                {#each forecastStages as stage}
                  {@const stageData = forecastData.get(stage.id) || new Map()}
                  {@const unalloc = getUnallocatedLots(stage.id)}
                  {@const stageTotalPrice = stage.lots?.reduce((sum: number, l: any) => sum + (parseFloat(l.price) || 0), 0) || 0}
                  {@const isExpanded = forecastExpandedStages.has(stage.id)}
                  <tr class="stage-row" class:expanded={isExpanded}>
                    <td class="stage-name td-sticky-left">
                      <div class="stage-name-with-dates">
                        <button class="stage-expand-btn" on:click={() => toggleForecastStageExpand(stage.id)} title={isExpanded ? 'Collapse' : 'Expand lots'}>
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        <span>{stage.name}</span>
                        {#if stage.registrationDate || stage.settlementDate}
                          <div class="stage-date-badges">
                            {#if stage.registrationDate}
                              {@const regStatus = getDateStatus(stage.registrationDate, stage.registrationDateActual)}
                              <span 
                                class="stage-date-badge" 
                                style="background: {dateStatusStyles[regStatus].bg}; color: {dateStatusStyles[regStatus].color}; border-color: {dateStatusStyles[regStatus].border};"
                                title="Registration: {new Date(stage.registrationDate).toLocaleDateString()} ({dateStatusStyles[regStatus].title})"
                              >R</span>
                            {/if}
                            {#if stage.settlementDate}
                              {@const setStatus = getDateStatus(stage.settlementDate, stage.settlementDateActual)}
                              <span 
                                class="stage-date-badge" 
                                style="background: {dateStatusStyles[setStatus].bg}; color: {dateStatusStyles[setStatus].color}; border-color: {dateStatusStyles[setStatus].border};"
                                title="Settlement: {new Date(stage.settlementDate).toLocaleDateString()} ({dateStatusStyles[setStatus].title})"
                              >S</span>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </td>
                    <td class="lots-count td-sticky-left td-sticky-left-2">{stage.lots?.length || 0}</td>
                    <td class="unalloc-count td-sticky-left td-sticky-left-3" class:warning={unalloc > 0}>{unalloc}</td>
                    <td class="td-nav"></td>
                    {#each forecastPeriods as period}
                      {@const cellValue = stageData.get(period.key) || 0}
                      {@const actualValue = forecastActualData.get(stage.id)?.get(period.key) || 0}
                      {@const manualValue = forecastManualData.get(stage.id)?.get(period.key) || 0}
                      {@const autoValue = cellValue - actualValue - manualValue}
                      {@const stats = getStagePeriodStats(stage.id, period.key)}
                      {@const milestone = getStageMilestoneInPeriod(stage, period.key)}
                      {@const combinedData = forecastMode === 'combined' ? getCombinedCellData(stage.id, period.key) : []}
                      <td 
                        class="period-cell" 
                        class:has-value={forecastMode === 'combined' ? combinedData.length > 0 : cellValue > 0} 
                        class:has-actual={actualValue > 0}
                        class:has-manual={manualValue > 0}
                        class:current={period.key === getPeriodKeyForDate(new Date().toISOString())}
                        class:has-registration={milestone?.type === 'registration'}
                        class:has-settlement={milestone?.type === 'settlement'}
                      >
                        {#if milestone}
                          <span class="milestone-indicator" title="{milestone.type === 'registration' ? 'Registration' : 'Settlement'} Date: {new Date(milestone.date).toLocaleDateString()}">{milestone.type === 'registration' ? '📋' : '🏠'}</span>
                        {/if}
                        {#if forecastMode === 'combined'}
                          {#if combinedData.length > 0}
                            <div class="combined-cell-content">
                              {#each combinedData as item, idx}
                                <span class="combined-category" style="color: {forecastCategoryColors[item.category].text}" title="{item.category.replace('_', ' ')}: {item.count}">{forecastCategoryColors[item.category].label}{item.count}</span>{#if idx < combinedData.length - 1}<span class="combined-sep">/</span>{/if}
                              {/each}
                            </div>
                          {:else}
                            <span class="cell-empty">-</span>
                          {/if}
                        {:else if forecastEditMode}
                          <div class="forecast-edit-cell">
                            {#if actualValue > 0}
                              <span class="actual-locked" title="Confirmed actuals - cannot edit">{actualValue}A</span>
                            {/if}
                            {#if manualValue > 0}
                              {#if actualValue > 0}<span class="edit-sep">+</span>{/if}
                              <span class="manual-locked" title="Manually assigned - protected from reforecast">{manualValue}M</span>
                            {/if}
                            {#if actualValue > 0 || manualValue > 0}<span class="edit-sep">+</span>{/if}
                            <input 
                              type="number" 
                              min="0"
                              value={autoValue > 0 ? autoValue : ''}
                              placeholder="-"
                              on:input={(e) => {
                                const val = parseInt(e.currentTarget.value) || 0;
                                updateForecastAllocation(stage.id, period.key, actualValue + manualValue + val);
                              }}
                              class="forecast-input"
                              title="Auto-assigned lots only (can be reforecast)"
                            />
                          </div>
                        {:else if cellValue > 0}
                          <div class="cell-content" title="Lots: {stats.lots} ({actualValue} actual, {manualValue} manual, {autoValue} auto) | Area: {stats.area.toFixed(0)}m² | ${stats.totalPrice.toLocaleString()} | ${stats.pricePerSqm.toFixed(0)}/m²">
                            {#if actualValue > 0}
                              <span class="cell-actual">{actualValue}A</span>
                            {/if}
                            {#if manualValue > 0}
                              {#if actualValue > 0}<span class="cell-sep">+</span>{/if}
                              <span class="cell-manual">{manualValue}M</span>
                            {/if}
                            {#if autoValue > 0}
                              {#if actualValue > 0 || manualValue > 0}<span class="cell-sep">+</span>{/if}
                              <span class="cell-auto">{autoValue}</span>
                            {/if}
                          </div>
                        {:else}
                          <span class="cell-empty">-</span>
                        {/if}
                      </td>
                    {/each}
                    <td class="td-nav"></td>
                    <td class="total-price td-sticky-right">${(stageTotalPrice / 1000).toFixed(0)}k</td>
                  </tr>
                  {#if isExpanded && stage.lots?.length > 0}
                    {#each getSortedLots(stage.lots) as lot (`${lot.id}-${forecastPeriod}-${forecastMode}-${forecastLotSort}-${forecastLotSortAsc}`)}
                      {@const lotCustomData = lot.customData ? (typeof lot.customData === 'string' ? JSON.parse(lot.customData) : lot.customData) : {}}
                      {@const lotDateValue = lotCustomData[forecastMode] || ''}
                      {@const lotDateActual = lotCustomData[`${forecastMode}_actual`] || false}
                      {@const lotPeriodKey = lotDateValue ? getPeriodKeyForDate(lotDateValue) : ''}
                      <tr class="lot-detail-row">
                        <td class="lot-name td-sticky-left">
                          <span class="lot-indent">└─</span>
                          <span class="lot-number">{lot.lotNumber || lot.name}</span>
                          {#if lot.baseArea}<span class="lot-area">{lot.baseArea}m²</span>{/if}
                        </td>
                        <td class="lot-date-cell td-sticky-left td-sticky-left-2">
                          {#if forecastEditMode}
                            <input 
                              type="date" 
                              class="lot-date-input"
                              value={lotDateValue}
                              on:change={(e) => updateLotForecastDate(lot, stage.id, e.currentTarget.value)}
                              title="Set forecast date"
                            />
                          {:else}
                            <span class="lot-date-display">{lotDateValue || '-'}</span>
                          {/if}
                        </td>
                        <td class="td-sticky-left td-sticky-left-3">
                          {#if forecastEditMode}
                            <button 
                              class="lot-status-badge clickable" 
                              class:actual={lotDateActual}
                              class:forecast={lotDateValue && !lotDateActual}
                              class:none={!lotDateValue}
                              on:click={() => toggleLotForecastStatus(lot, stage.id)}
                              title={lotDateActual ? 'Actual - click to clear' : lotDateValue ? 'Forecast - click to mark actual' : 'Not set - click to set forecast'}
                            >
                              {lotDateActual ? 'A' : lotDateValue ? 'F' : '-'}
                            </button>
                          {:else}
                            <span 
                              class="lot-status-badge" 
                              class:actual={lotDateActual}
                              class:forecast={lotDateValue && !lotDateActual}
                              class:none={!lotDateValue}
                            >
                              {lotDateActual ? 'A' : lotDateValue ? 'F' : '-'}
                            </span>
                          {/if}
                        </td>
                        <td class="td-nav"></td>
                        {#each forecastPeriods as period}
                          <td 
                            class="period-cell lot-period" 
                            class:lot-period-clickable={forecastEditMode}
                            class:lot-allocated={lotPeriodKey === period.key} 
                            class:lot-actual={lotPeriodKey === period.key && lotDateActual}
                            on:click={() => forecastEditMode && assignLotToPeriod(lot, stage.id, period.key)}
                            on:keydown={(e) => forecastEditMode && e.key === 'Enter' && assignLotToPeriod(lot, stage.id, period.key)}
                            role={forecastEditMode ? 'button' : undefined}
                            tabindex={forecastEditMode ? 0 : undefined}
                            title={forecastEditMode ? `Click to move ${lot.lotNumber || lot.name} to ${period.label}` : ''}
                          >
                            {#if lotPeriodKey === period.key}
                              <span class="lot-marker">{lotDateActual ? '●' : '○'}</span>
                            {:else}
                              {forecastEditMode ? '·' : '-'}
                            {/if}
                          </td>
                        {/each}
                        <td class="td-nav"></td>
                        <td class="lot-price td-sticky-right">${lot.price ? (parseFloat(lot.price) / 1000).toFixed(0) + 'k' : '-'}</td>
                      </tr>
                    {/each}
                  {/if}
                {/each}
              </tbody>
              <tfoot>
                <tr class="totals-row">
                  <td class="stage-name td-sticky-left">TOTAL</td>
                  <td class="lots-count td-sticky-left td-sticky-left-2">{forecastStages.reduce((sum, s) => sum + (s.lots?.length || 0), 0)}</td>
                  <td class="unalloc-count td-sticky-left td-sticky-left-3">{forecastStages.reduce((sum, s) => sum + getUnallocatedLots(s.id), 0)}</td>
                  <td class="td-nav"></td>
                  {#each forecastPeriods as period}
                    {@const totals = getPeriodTotals(period.key)}
                    {@const combinedTotals = forecastMode === 'combined' ? getCombinedPeriodTotals(period.key) : []}
                    <td class="period-cell totals" class:has-value={forecastMode === 'combined' ? combinedTotals.length > 0 : totals.lots > 0} class:current={period.key === getPeriodKeyForDate(new Date().toISOString())}>
                      {#if forecastMode === 'combined'}
                        {#if combinedTotals.length > 0}
                          <div class="combined-cell-content totals">
                            {#each combinedTotals as item, idx}
                              <span class="combined-category" style="color: {forecastCategoryColors[item.category].text}" title="{item.category.replace('_', ' ')}: {item.count}">{forecastCategoryColors[item.category].label}{item.count}</span>{#if idx < combinedTotals.length - 1}<span class="combined-sep">/</span>{/if}
                            {/each}
                          </div>
                        {:else}
                          <span class="cell-empty">-</span>
                        {/if}
                      {:else if totals.lots > 0}
                        <div class="totals-content" title="Lots: {totals.lots} | Area: {totals.area.toFixed(0)}m² | ${totals.totalPrice.toLocaleString()} | ${totals.pricePerSqm.toFixed(0)}/m²">
                          <span class="total-lots">{totals.lots}</span>
                          <span class="total-price-small">${(totals.totalPrice / 1000).toFixed(0)}k</span>
                        </div>
                      {:else}
                        <span class="cell-empty">-</span>
                      {/if}
                    </td>
                  {/each}
                  <td class="td-nav"></td>
                  <td class="total-price grand td-sticky-right">${(forecastStages.reduce((sum, s) => sum + (s.lots?.reduce((ls: number, l: any) => ls + (parseFloat(l.price) || 0), 0) || 0), 0) / 1000000).toFixed(2)}M</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div class="forecast-legend">
            <span class="legend-title">Legend:</span>
            {#if forecastMode !== 'combined'}
              <div class="legend-item">
                <span class="legend-color legend-actual">2A</span>
                <span class="legend-label">Actual (confirmed, locked)</span>
              </div>
              <div class="legend-item">
                <span class="legend-color legend-manual">3M</span>
                <span class="legend-label">Manual (user-assigned, protected)</span>
              </div>
              <div class="legend-item">
                <span class="legend-color legend-auto">5</span>
                <span class="legend-label">Auto (can be reforecast)</span>
              </div>
              <div class="legend-sep">|</div>
            {/if}
            {#if forecastMode === 'combined'}
              <div class="legend-item">
                <span class="legend-color" style="background: rgba(158, 206, 106, 0.3); color: #9ece6a;">S</span>
                <span class="legend-label">Sold</span>
              </div>
              <div class="legend-item">
                <span class="legend-color" style="background: rgba(187, 154, 247, 0.3); color: #bb9af7;">X</span>
                <span class="legend-label">Exchanged</span>
              </div>
              <div class="legend-item">
                <span class="legend-color" style="background: rgba(115, 218, 202, 0.3); color: #73daca;">T</span>
                <span class="legend-label">Settled</span>
              </div>
              <div class="legend-item">
                <span class="legend-color" style="background: rgba(247, 118, 142, 0.3); color: #f7768e;">C</span>
                <span class="legend-label">Cancelled</span>
              </div>
              <div class="legend-sep">|</div>
            {/if}
            <div class="legend-item">
              <span class="legend-color" style="background: rgba(255, 158, 100, 0.3); color: #ff9e64;">📋</span>
              <span class="legend-label">Registration</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background: rgba(100, 200, 255, 0.3); color: #7dcfff;">🏠</span>
              <span class="legend-label">Settlement</span>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- STAGE LAND BUDGET - Editable Section -->
      {#if selectedNode?.type === 'stage'}
        <div class="forecast-section">
          <div class="panel-header collapsible" on:click={toggleStageLandBudget} on:keydown={(e) => e.key === 'Enter' && toggleStageLandBudget()} role="button" tabindex="0">
            <span>├─ {showStageLandBudget ? '▼' : '▶'} Land Budget</span>
          </div>
        </div>
      {/if}
      
      <!-- STAGE LAND BUDGET CONTENT (Editable) -->
      {#if selectedNode?.type === 'stage' && showStageLandBudget}
        {@const totalSiteArea = parseFloat(getStageLandBudgetValue('totalSiteArea') || '0')}
        {@const transportTotal = calculateStageLandBudgetTotal(['transport'])}
        {@const communityTotal = calculateStageLandBudgetTotal(['community'])}
        {@const educationTotal = calculateStageLandBudgetTotal(['education'])}
        {@const encumberedTotal = calculateStageLandBudgetTotal(['encumberedOpenSpace'])}
        {@const creditedTotal = calculateStageLandBudgetTotal(['creditedOpenSpace'])}
        {@const openSpaceTotal = encumberedTotal + creditedTotal}
        {@const deductionsTotal = transportTotal + communityTotal + educationTotal + openSpaceTotal}
        {@const residentialTotal = calculateStageLandBudgetTotal(['residential'])}
        {@const roadsTotal = calculateStageLandBudgetTotal(['roads'])}
        {@const nraTotal = residentialTotal + roadsTotal}
        {@const nonResTotal = calculateStageLandBudgetTotal(['nonResidentialAreas'])}
        {@const ndaTotal = nraTotal + nonResTotal}
        {@const calculatedSiteArea = deductionsTotal + ndaTotal}
        <div class="land-budget-panel">
          <div class="land-budget-header">
            <div class="lot-area-check"></div>
            <div class="land-budget-controls">
              {#if stageLandBudgetEditMode}
                <button class="btn-save" on:click={saveStageLandBudget}>Save</button>
                <button class="btn-cancel" on:click={cancelStageLandBudgetEdit}>Cancel</button>
              {:else if userCanEdit}
                <button class="btn-edit" on:click={() => stageLandBudgetEditMode = true}>Edit</button>
              {/if}
            </div>
          </div>
          
          {#if loadingStageLandBudget}
            <div class="loading-state">Loading land budget...</div>
          {:else}
            <div class="land-budget-tree">
              <!-- Total Site Area (Calculated: Deductions + NDA) -->
              <div class="lb-row">
                <div class="lb-indent-0">├─</div>
                <div class="lb-name lb-color-white">Total Site Area</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-cyan">{calculatedSiteArea ? calculatedSiteArea.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions"></div>
              </div>
              
              <!-- Transport -->
              <div class="lb-row lb-clickable lb-category" on:click={() => toggleStageLbCategory('transport')} on:keydown={(e) => e.key === 'Enter' && toggleStageLbCategory('transport')} role="button" tabindex="0">
                <div class="lb-indent-0">├─ {stageLbExpandedCategories.has('transport') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-brown">Transport</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-brown">{transportTotal ? transportTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions">{#if stageLandBudgetEditMode}<button class="lb-add-btn" on:click|stopPropagation={() => addStageLandBudgetSubcategory('transport')}>+</button>{/if}</div>
              </div>
              {#if stageLbExpandedCategories.has('transport')}
                {#each (stageLandBudgetCategories.transport?.subcategories || []) as sub, i}
                  {@const subs = stageLandBudgetCategories.transport?.subcategories || []}
                  {@const isLast = i === subs.length - 1}
                  <div class="lb-row lb-sub">
                    <div class="lb-indent-1">│ {isLast ? '└─' : '├─'}</div>
                    <div class="lb-name">
                      {#if stageLandBudgetEditMode}
                        <input type="text" class="lb-name-input" value={getStageLandBudgetSubName('transport', sub.key)} on:input={(e) => setStageLandBudgetSubName('transport', sub.key, e.currentTarget.value)} />
                      {:else}
                        {sub.name}
                      {/if}
                    </div>
                    <div class="lb-arrow">→</div>
                    <div class="lb-value lb-color-brown">
                      {#if stageLandBudgetEditMode}
                        <input type="number" step="0.0001" class="lb-input" value={getStageLandBudgetValue('transport', sub.key)} on:input={(e) => setStageLandBudgetValue('transport', sub.key, e.currentTarget.value)} />
                      {:else}
                        {getStageLandBudgetValue('transport', sub.key) || '-'}
                      {/if}
                    </div>
                    <div class="lb-unit">ha</div>
                    <div class="lb-actions">{#if stageLandBudgetEditMode && subs.length > 1}<button class="lb-del-btn" on:click={() => removeStageLandBudgetSubcategory('transport', sub.key)}>×</button>{/if}</div>
                  </div>
                {/each}
              {/if}
              
              <!-- Community -->
              <div class="lb-row lb-clickable lb-category" on:click={() => toggleStageLbCategory('community')} on:keydown={(e) => e.key === 'Enter' && toggleStageLbCategory('community')} role="button" tabindex="0">
                <div class="lb-indent-0">├─ {stageLbExpandedCategories.has('community') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-gold">Community</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-gold">{communityTotal ? communityTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions">{#if stageLandBudgetEditMode}<button class="lb-add-btn" on:click|stopPropagation={() => addStageLandBudgetSubcategory('community')}>+</button>{/if}</div>
              </div>
              {#if stageLbExpandedCategories.has('community')}
                {#each (stageLandBudgetCategories.community?.subcategories || []) as sub, i}
                  {@const subs = stageLandBudgetCategories.community?.subcategories || []}
                  {@const isLast = i === subs.length - 1}
                  <div class="lb-row lb-sub">
                    <div class="lb-indent-1">│ {isLast ? '└─' : '├─'}</div>
                    <div class="lb-name">
                      {#if stageLandBudgetEditMode}
                        <input type="text" class="lb-name-input" value={getStageLandBudgetSubName('community', sub.key)} on:input={(e) => setStageLandBudgetSubName('community', sub.key, e.currentTarget.value)} />
                      {:else}
                        {sub.name}
                      {/if}
                    </div>
                    <div class="lb-arrow">→</div>
                    <div class="lb-value lb-color-gold">
                      {#if stageLandBudgetEditMode}
                        <input type="number" step="0.0001" class="lb-input" value={getStageLandBudgetValue('community', sub.key)} on:input={(e) => setStageLandBudgetValue('community', sub.key, e.currentTarget.value)} />
                      {:else}
                        {getStageLandBudgetValue('community', sub.key) || '-'}
                      {/if}
                    </div>
                    <div class="lb-unit">ha</div>
                    <div class="lb-actions">{#if stageLandBudgetEditMode && subs.length > 1}<button class="lb-del-btn" on:click={() => removeStageLandBudgetSubcategory('community', sub.key)}>×</button>{/if}</div>
                  </div>
                {/each}
              {/if}
              
              <!-- Education -->
              <div class="lb-row lb-clickable lb-category" on:click={() => toggleStageLbCategory('education')} on:keydown={(e) => e.key === 'Enter' && toggleStageLbCategory('education')} role="button" tabindex="0">
                <div class="lb-indent-0">├─ {stageLbExpandedCategories.has('education') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-blue">Education</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-blue">{educationTotal ? educationTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions">{#if stageLandBudgetEditMode}<button class="lb-add-btn" on:click|stopPropagation={() => addStageLandBudgetSubcategory('education')}>+</button>{/if}</div>
              </div>
              {#if stageLbExpandedCategories.has('education')}
                {#each (stageLandBudgetCategories.education?.subcategories || []) as sub, i}
                  {@const subs = stageLandBudgetCategories.education?.subcategories || []}
                  {@const isLast = i === subs.length - 1}
                  <div class="lb-row lb-sub">
                    <div class="lb-indent-1">│ {isLast ? '└─' : '├─'}</div>
                    <div class="lb-name">
                      {#if stageLandBudgetEditMode}
                        <input type="text" class="lb-name-input" value={getStageLandBudgetSubName('education', sub.key)} on:input={(e) => setStageLandBudgetSubName('education', sub.key, e.currentTarget.value)} />
                      {:else}
                        {sub.name}
                      {/if}
                    </div>
                    <div class="lb-arrow">→</div>
                    <div class="lb-value lb-color-blue">
                      {#if stageLandBudgetEditMode}
                        <input type="number" step="0.0001" class="lb-input" value={getStageLandBudgetValue('education', sub.key)} on:input={(e) => setStageLandBudgetValue('education', sub.key, e.currentTarget.value)} />
                      {:else}
                        {getStageLandBudgetValue('education', sub.key) || '-'}
                      {/if}
                    </div>
                    <div class="lb-unit">ha</div>
                    <div class="lb-actions">{#if stageLandBudgetEditMode && subs.length > 1}<button class="lb-del-btn" on:click={() => removeStageLandBudgetSubcategory('education', sub.key)}>×</button>{/if}</div>
                  </div>
                {/each}
              {/if}
              
              <!-- Open Space Network -->
              <div class="lb-row">
                <div class="lb-indent-0">├─</div>
                <div class="lb-name lb-color-green">Open Space Network</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-green">{openSpaceTotal ? openSpaceTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions"></div>
              </div>
              
              <!-- Encumbered Open Space -->
              <div class="lb-row lb-clickable lb-category" on:click={() => toggleStageLbCategory('encumberedOpenSpace')} on:keydown={(e) => e.key === 'Enter' && toggleStageLbCategory('encumberedOpenSpace')} role="button" tabindex="0">
                <div class="lb-indent-1">│ ├─ {stageLbExpandedCategories.has('encumberedOpenSpace') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-green-light">Encumbered Open Space</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-green-light">{encumberedTotal ? encumberedTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions">{#if stageLandBudgetEditMode}<button class="lb-add-btn" on:click|stopPropagation={() => addStageLandBudgetSubcategory('encumberedOpenSpace')}>+</button>{/if}</div>
              </div>
              {#if stageLbExpandedCategories.has('encumberedOpenSpace')}
                {#each (stageLandBudgetCategories.encumberedOpenSpace?.subcategories || []) as sub, i}
                  {@const subs = stageLandBudgetCategories.encumberedOpenSpace?.subcategories || []}
                  {@const isLast = i === subs.length - 1}
                  <div class="lb-row lb-sub">
                    <div class="lb-indent-2">│ │ {isLast ? '└─' : '├─'}</div>
                    <div class="lb-name">
                      {#if stageLandBudgetEditMode}
                        <input type="text" class="lb-name-input" value={getStageLandBudgetSubName('encumberedOpenSpace', sub.key)} on:input={(e) => setStageLandBudgetSubName('encumberedOpenSpace', sub.key, e.currentTarget.value)} />
                      {:else}
                        {sub.name}
                      {/if}
                    </div>
                    <div class="lb-arrow">→</div>
                    <div class="lb-value lb-color-green-light">
                      {#if stageLandBudgetEditMode}
                        <input type="number" step="0.0001" class="lb-input" value={getStageLandBudgetValue('encumberedOpenSpace', sub.key)} on:input={(e) => setStageLandBudgetValue('encumberedOpenSpace', sub.key, e.currentTarget.value)} />
                      {:else}
                        {getStageLandBudgetValue('encumberedOpenSpace', sub.key) || '-'}
                      {/if}
                    </div>
                    <div class="lb-unit">ha</div>
                    <div class="lb-actions">{#if stageLandBudgetEditMode && subs.length > 1}<button class="lb-del-btn" on:click={() => removeStageLandBudgetSubcategory('encumberedOpenSpace', sub.key)}>×</button>{/if}</div>
                  </div>
                {/each}
              {/if}
              
              <!-- Credited Open Space -->
              <div class="lb-row lb-clickable lb-category" on:click={() => toggleStageLbCategory('creditedOpenSpace')} on:keydown={(e) => e.key === 'Enter' && toggleStageLbCategory('creditedOpenSpace')} role="button" tabindex="0">
                <div class="lb-indent-1">│ └─ {stageLbExpandedCategories.has('creditedOpenSpace') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-green-light">Credited Open Space</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-green-light">{creditedTotal ? creditedTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions">{#if stageLandBudgetEditMode}<button class="lb-add-btn" on:click|stopPropagation={() => addStageLandBudgetSubcategory('creditedOpenSpace')}>+</button>{/if}</div>
              </div>
              {#if stageLbExpandedCategories.has('creditedOpenSpace')}
                {#each (stageLandBudgetCategories.creditedOpenSpace?.subcategories || []) as sub, i}
                  {@const subs = stageLandBudgetCategories.creditedOpenSpace?.subcategories || []}
                  {@const isLast = i === subs.length - 1}
                  <div class="lb-row lb-sub">
                    <div class="lb-indent-2">│   {isLast ? '└─' : '├─'}</div>
                    <div class="lb-name">
                      {#if stageLandBudgetEditMode}
                        <input type="text" class="lb-name-input" value={getStageLandBudgetSubName('creditedOpenSpace', sub.key)} on:input={(e) => setStageLandBudgetSubName('creditedOpenSpace', sub.key, e.currentTarget.value)} />
                      {:else}
                        {sub.name}
                      {/if}
                    </div>
                    <div class="lb-arrow">→</div>
                    <div class="lb-value lb-color-green-light">
                      {#if stageLandBudgetEditMode}
                        <input type="number" step="0.0001" class="lb-input" value={getStageLandBudgetValue('creditedOpenSpace', sub.key)} on:input={(e) => setStageLandBudgetValue('creditedOpenSpace', sub.key, e.currentTarget.value)} />
                      {:else}
                        {getStageLandBudgetValue('creditedOpenSpace', sub.key) || '-'}
                      {/if}
                    </div>
                    <div class="lb-unit">ha</div>
                    <div class="lb-actions">{#if stageLandBudgetEditMode && subs.length > 1}<button class="lb-del-btn" on:click={() => removeStageLandBudgetSubcategory('creditedOpenSpace', sub.key)}>×</button>{/if}</div>
                  </div>
                {/each}
              {/if}
              
              <!-- Total Deductions -->
              <div class="lb-row lb-total">
                <div class="lb-indent-0">├─</div>
                <div class="lb-name lb-color-purple">Total (Deductions)</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-purple">{deductionsTotal ? deductionsTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions"></div>
              </div>
              
              <div class="lb-separator"></div>
              
              <!-- Net Residential Area (NRA) -->
              <div class="lb-row">
                <div class="lb-indent-0">├─</div>
                <div class="lb-name lb-color-teal">Net Residential Area (NRA)</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-teal">{nraTotal ? nraTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions"></div>
              </div>
              
              <!-- Residential -->
              <div class="lb-row lb-clickable lb-category" on:click={() => toggleStageLbCategory('residential')} on:keydown={(e) => e.key === 'Enter' && toggleStageLbCategory('residential')} role="button" tabindex="0">
                <div class="lb-indent-1">│ ├─ {stageLbExpandedCategories.has('residential') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-red">Residential</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-red">{residentialTotal ? residentialTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions">{#if stageLandBudgetEditMode}<button class="lb-add-btn" on:click|stopPropagation={() => addStageLandBudgetSubcategory('residential')}>+</button>{/if}</div>
              </div>
              {#if stageLbExpandedCategories.has('residential')}
                {#each (stageLandBudgetCategories.residential?.subcategories || []) as sub, i}
                  {@const subs = stageLandBudgetCategories.residential?.subcategories || []}
                  {@const isLast = i === subs.length - 1}
                  <div class="lb-row lb-sub">
                    <div class="lb-indent-2">│ │ {isLast ? '└─' : '├─'}</div>
                    <div class="lb-name">
                      {#if stageLandBudgetEditMode}
                        <input type="text" class="lb-name-input" value={getStageLandBudgetSubName('residential', sub.key)} on:input={(e) => setStageLandBudgetSubName('residential', sub.key, e.currentTarget.value)} />
                      {:else}
                        {sub.name}
                      {/if}
                    </div>
                    <div class="lb-arrow">→</div>
                    <div class="lb-value lb-color-red">
                      {#if stageLandBudgetEditMode}
                        <input type="number" step="0.0001" class="lb-input" value={getStageLandBudgetValue('residential', sub.key)} on:input={(e) => setStageLandBudgetValue('residential', sub.key, e.currentTarget.value)} />
                      {:else}
                        {getStageLandBudgetValue('residential', sub.key) || '-'}
                      {/if}
                    </div>
                    <div class="lb-unit">ha</div>
                    <div class="lb-actions">{#if stageLandBudgetEditMode && subs.length > 1}<button class="lb-del-btn" on:click={() => removeStageLandBudgetSubcategory('residential', sub.key)}>×</button>{/if}</div>
                  </div>
                {/each}
              {/if}
              
              <!-- Roads -->
              <div class="lb-row lb-clickable lb-category" on:click={() => toggleStageLbCategory('roads')} on:keydown={(e) => e.key === 'Enter' && toggleStageLbCategory('roads')} role="button" tabindex="0">
                <div class="lb-indent-1">│ └─ {stageLbExpandedCategories.has('roads') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-gray">Roads</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-gray">{roadsTotal ? roadsTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions">{#if stageLandBudgetEditMode}<button class="lb-add-btn" on:click|stopPropagation={() => addStageLandBudgetSubcategory('roads')}>+</button>{/if}</div>
              </div>
              {#if stageLbExpandedCategories.has('roads')}
                {#each (stageLandBudgetCategories.roads?.subcategories || []) as sub, i}
                  {@const subs = stageLandBudgetCategories.roads?.subcategories || []}
                  {@const isLast = i === subs.length - 1}
                  <div class="lb-row lb-sub">
                    <div class="lb-indent-2">│   {isLast ? '└─' : '├─'}</div>
                    <div class="lb-name">
                      {#if stageLandBudgetEditMode}
                        <input type="text" class="lb-name-input" value={getStageLandBudgetSubName('roads', sub.key)} on:input={(e) => setStageLandBudgetSubName('roads', sub.key, e.currentTarget.value)} />
                      {:else}
                        {sub.name}
                      {/if}
                    </div>
                    <div class="lb-arrow">→</div>
                    <div class="lb-value lb-color-gray">
                      {#if stageLandBudgetEditMode}
                        <input type="number" step="0.0001" class="lb-input" value={getStageLandBudgetValue('roads', sub.key)} on:input={(e) => setStageLandBudgetValue('roads', sub.key, e.currentTarget.value)} />
                      {:else}
                        {getStageLandBudgetValue('roads', sub.key) || '-'}
                      {/if}
                    </div>
                    <div class="lb-unit">ha</div>
                    <div class="lb-actions">{#if stageLandBudgetEditMode && subs.length > 1}<button class="lb-del-btn" on:click={() => removeStageLandBudgetSubcategory('roads', sub.key)}>×</button>{/if}</div>
                  </div>
                {/each}
              {/if}
              
              <!-- Non Residential Areas -->
              <div class="lb-row lb-clickable lb-category" on:click={() => toggleStageLbCategory('nonResidentialAreas')} on:keydown={(e) => e.key === 'Enter' && toggleStageLbCategory('nonResidentialAreas')} role="button" tabindex="0">
                <div class="lb-indent-0">├─ {stageLbExpandedCategories.has('nonResidentialAreas') ? '▼' : '▶'}</div>
                <div class="lb-name lb-color-magenta">Non Residential Areas</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-magenta">{nonResTotal ? nonResTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions">{#if stageLandBudgetEditMode}<button class="lb-add-btn" on:click|stopPropagation={() => addStageLandBudgetSubcategory('nonResidentialAreas')}>+</button>{/if}</div>
              </div>
              {#if stageLbExpandedCategories.has('nonResidentialAreas')}
                {#each (stageLandBudgetCategories.nonResidentialAreas?.subcategories || []) as sub, i}
                  {@const subs = stageLandBudgetCategories.nonResidentialAreas?.subcategories || []}
                  {@const isLast = i === subs.length - 1}
                  <div class="lb-row lb-sub">
                    <div class="lb-indent-1">│ {isLast ? '└─' : '├─'}</div>
                    <div class="lb-name">
                      {#if stageLandBudgetEditMode}
                        <input type="text" class="lb-name-input" value={getStageLandBudgetSubName('nonResidentialAreas', sub.key)} on:input={(e) => setStageLandBudgetSubName('nonResidentialAreas', sub.key, e.currentTarget.value)} />
                      {:else}
                        {sub.name}
                      {/if}
                    </div>
                    <div class="lb-arrow">→</div>
                    <div class="lb-value lb-color-magenta">
                      {#if stageLandBudgetEditMode}
                        <input type="number" step="0.0001" class="lb-input" value={getStageLandBudgetValue('nonResidentialAreas', sub.key)} on:input={(e) => setStageLandBudgetValue('nonResidentialAreas', sub.key, e.currentTarget.value)} />
                      {:else}
                        {getStageLandBudgetValue('nonResidentialAreas', sub.key) || '-'}
                      {/if}
                    </div>
                    <div class="lb-unit">ha</div>
                    <div class="lb-actions">{#if stageLandBudgetEditMode && subs.length > 1}<button class="lb-del-btn" on:click={() => removeStageLandBudgetSubcategory('nonResidentialAreas', sub.key)}>×</button>{/if}</div>
                  </div>
                {/each}
              {/if}
              
              <!-- Total Net Developable Area -->
              <div class="lb-row lb-grand-total">
                <div class="lb-indent-0">└─</div>
                <div class="lb-name lb-color-orange">Total Net Developable Area (NDA)</div>
                <div class="lb-arrow">→</div>
                <div class="lb-value lb-color-orange">{ndaTotal ? ndaTotal.toFixed(4) : '-'}</div>
                <div class="lb-unit">ha</div>
                <div class="lb-actions"></div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- STAGE TABLE - Separate Section -->
      <div class="stage-table-section">
        <div class="panel-header collapsible" on:click={() => showStageTable = !showStageTable} on:keydown={(e) => e.key === 'Enter' && (showStageTable = !showStageTable)} role="button" tabindex="0">
          <span>├─ {showStageTable ? '▼' : '▶'} {selectedNode ? `${typeLabels[selectedNode.type]} ${selectedNode.name}` : 'Select item'} → Children {tableData.length > 0 ? `(${tableData.length})` : ''}</span>
          <div class="panel-header-actions" on:click|stopPropagation on:keydown|stopPropagation>
            {#if selectedNode?.type === 'stage' && tableData.length > 0}
              {#if stageTableTab === 'main'}
                {#if inlinePriceEditMode}
                  <span class="edit-mode-badge">Editing Prices</span>
                {:else}
                  <button class="btn-edit-all-prices" on:click={startInlinePriceEdit}>
                    💰 Edit Prices
                  </button>
                {/if}
              {:else if stageTableTab === 'dates'}
                {#if datesTabEditMode}
                  <span class="edit-mode-badge">Editing Dates</span>
                  <button class="btn-cancel-tab" on:click={cancelDatesTabEdit}>Cancel</button>
                  <button class="btn-save-tab" on:click={saveDatesTabEdits}>✓ Save All</button>
                {:else}
                  <button class="btn-tab-action" on:click={startDatesTabEdit}>
                    ✏️ Edit Dates
                  </button>
                {/if}
              {:else if stageTableTab === 'pricing'}
                {#if pricingTabEditMode}
                  <span class="edit-mode-badge">Editing Pricing</span>
                  <button class="btn-cancel-tab" on:click={cancelPricingTabEdit}>Cancel</button>
                  <button class="btn-save-tab" on:click={savePricingTabEdits}>✓ Save All</button>
                {:else}
                  <button class="btn-tab-action" on:click={startPricingTabEdit}>
                    ✏️ Edit Pricing
                  </button>
                {/if}
              {/if}
            {/if}
            {#if selectedNode && typeConfig[selectedNode.type].childEndpoint && stageTableTab === 'main' && userCanEdit}
              <button class="add-btn" on:click={startAdd} disabled={isAdding}>+ Add</button>
            {/if}
          </div>
        </div>
      </div>
      
      {#if showStageTable}
      {#if selectedNode?.type === 'stage' && tableData.length > 0}
        <div class="stage-table-tabs">
          <button 
            class="stage-tab" 
            class:active={stageTableTab === 'main'}
            on:click={() => stageTableTab = 'main'}
          >
            📋 Main
          </button>
          <button 
            class="stage-tab" 
            class:active={stageTableTab === 'dates'}
            on:click={() => stageTableTab = 'dates'}
          >
            📅 Key Dates
          </button>
          <button 
            class="stage-tab" 
            class:active={stageTableTab === 'pricing'}
            on:click={() => stageTableTab = 'pricing'}
          >
            💵 Pricing Details
          </button>
        </div>
      {/if}
      
      {#if inlinePriceEditMode}
        <div class="inline-price-edit-bar">
          <span class="edit-info">💰 Editing prices for {tableData.length} lots</span>
          <button 
            class="btn-apply-all-suggested" 
            on:click={applyAllSuggestedPrices}
            disabled={pricingProducts.filter(p => p.basePrice > 0).length === 0}
            title="Apply suggested pricing from matrix to all lots"
          >
            📊 Use All Suggested
          </button>
          <span class="change-count">{inlinePriceChangeCount} changes pending</span>
          <div class="edit-actions">
            <button class="btn-cancel-edit" on:click={cancelInlinePriceEdit}>Cancel</button>
            <button 
              class="btn-save-all-prices" 
              on:click={saveAllInlinePrices} 
              disabled={inlinePriceChangeCount === 0 || savingAllPrices}
            >
              {#if savingAllPrices}
                Saving...
              {:else}
                ✓ Save All ({inlinePriceChangeCount})
              {/if}
            </button>
          </div>
        </div>
      {/if}
      
      {#if selectedRows.size > 0}
        <div class="bulk-edit-bar">
          <span class="bulk-selected">{selectedRows.size} selected</span>
          <select bind:value={bulkEditField} class="bulk-field-select">
            <option value="">Select field...</option>
            {#if selectedNode?.type === 'stage' && stageTableTab === 'main'}
              <option value="streetName">Street Name</option>
              <option value="area">Area</option>
              <option value="frontage">Frontage</option>
              <option value="depth">Depth</option>
              <option value="status">Status</option>
            {:else if selectedNode?.type === 'stage' && stageTableTab === 'dates'}
              <option value="on_market_date">On Market Date</option>
              <option value="sold_date">Sold Date</option>
              <option value="exchange_date">Exchange Date</option>
              <option value="settled_date">Settled Date</option>
              <option value="cancelled_date">Cancelled Date</option>
            {:else if selectedNode?.type === 'stage' && stageTableTab === 'pricing'}
              <option value="deposit_amount">Deposit Amount</option>
              <option value="deposit_date">Deposit Date</option>
              <option value="rebates">Rebates</option>
              <option value="discounts">Discounts</option>
              <option value="price_adjustments">Price Adjustments</option>
            {:else}
              <option value="name">Name</option>
              <option value="description">Description</option>
            {/if}
          </select>
          {#if stageTableTab === 'dates' || (stageTableTab === 'pricing' && bulkEditField === 'deposit_date')}
            <input type="date" bind:value={bulkEditValue} class="bulk-value-input" />
          {:else}
            <input type="text" bind:value={bulkEditValue} placeholder="New value..." class="bulk-value-input" />
          {/if}
          <button class="btn-bulk-apply" on:click={() => stageTableTab === 'main' ? applyBulkEdit() : applyBulkCustomFieldEdit()} disabled={!bulkEditField || !bulkEditValue}>
            Apply to {selectedRows.size}
          </button>
          <button class="btn-bulk-clear" on:click={clearSelection}>Clear</button>
        </div>
      {/if}
      
      <div class="table-content">
        {#if loading}
          <div class="loading-msg">Loading...</div>
        {:else if !selectedNode}
          <div class="empty-msg">← Select an item from the tree</div>
        {:else if tableData.length === 0 && !isAdding}
          <div class="empty-msg">No children found. Click + Add to create one.</div>
        {:else if selectedNode?.type === 'stage' && stageTableTab === 'dates'}
          <!-- Key Dates Tab -->
          <div class="table-scroll-wrapper">
            <table class="data-table dates-table">
              <thead>
                <tr>
                  <th class="th-checkbox">
                    <input type="checkbox" checked={selectedRows.size === tableData.length && tableData.length > 0} on:change={toggleAllRows} title="Select all" />
                  </th>
                  <th class="th-id">ID</th>
                  <th class="th-field">Lot #</th>
                  <th class="th-field">Status</th>
                  <th class="th-field th-date">On Market</th>
                  <th class="th-field th-date">Sold Date</th>
                  <th class="th-field th-date">Exchange Date</th>
                  <th class="th-field th-date">Settled Date</th>
                  <th class="th-field th-date">Cancelled Date</th>
                </tr>
              </thead>
              <tbody>
                {#each sortedTableData as row}
                  {@const customData = row.customData ? (typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData) : {}}
                  {@const rowEdits = datesTabEdits.get(row.id) || {}}
                  <tr class:selected={selectedRows.has(row.id)}>
                    <td class="checkbox-col">
                      <input type="checkbox" checked={selectedRows.has(row.id)} on:change={() => toggleRowSelection(row.id)} />
                    </td>
                    <td class="id-col">{row.id}</td>
                    <td class="field-col">{row.lotNumber || '-'}</td>
                    <td class="field-col status-col">
                      <span class="status-badge status-{(row.status || '').toLowerCase().replace(/\s+/g, '-')}">{row.status || '-'}</span>
                    </td>
                    <td class="field-col date-col">
                      {#if datesTabEditMode}
                        <input type="date" value={rowEdits.on_market_date || ''} on:input={(e) => { rowEdits.on_market_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                      {:else}
                        {@const status = getDateStatus(customData.on_market_date, customData.on_market_date_actual)}
                        <div class="date-with-status">
                          <span class="date-display">{customData.on_market_date || '-'}</span>
                          {#if status !== 'none'}
                            <button 
                              class="date-status-badge" 
                              style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                              title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                              on:click={() => toggleLotDateActual(row.id, 'on_market_date', customData)}
                            >{dateStatusStyles[status].label}</button>
                          {/if}
                        </div>
                      {/if}
                    </td>
                    <td class="field-col date-col">
                      {#if datesTabEditMode}
                        <input type="date" value={rowEdits.sold_date || ''} on:input={(e) => { rowEdits.sold_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                      {:else}
                        {@const status = getDateStatus(customData.sold_date, customData.sold_date_actual)}
                        <div class="date-with-status">
                          <span class="date-display">{customData.sold_date || '-'}</span>
                          {#if status !== 'none'}
                            <button 
                              class="date-status-badge" 
                              style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                              title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                              on:click={() => toggleLotDateActual(row.id, 'sold_date', customData)}
                            >{dateStatusStyles[status].label}</button>
                          {/if}
                        </div>
                      {/if}
                    </td>
                    <td class="field-col date-col">
                      {#if datesTabEditMode}
                        <input type="date" value={rowEdits.exchange_date || ''} on:input={(e) => { rowEdits.exchange_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                      {:else}
                        {@const status = getDateStatus(customData.exchange_date, customData.exchange_date_actual)}
                        <div class="date-with-status">
                          <span class="date-display">{customData.exchange_date || '-'}</span>
                          {#if status !== 'none'}
                            <button 
                              class="date-status-badge" 
                              style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                              title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                              on:click={() => toggleLotDateActual(row.id, 'exchange_date', customData)}
                            >{dateStatusStyles[status].label}</button>
                          {/if}
                        </div>
                      {/if}
                    </td>
                    <td class="field-col date-col">
                      {#if datesTabEditMode}
                        <input type="date" value={rowEdits.settled_date || ''} on:input={(e) => { rowEdits.settled_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                      {:else}
                        {@const status = getDateStatus(customData.settled_date, customData.settled_date_actual)}
                        <div class="date-with-status">
                          <span class="date-display">{customData.settled_date || '-'}</span>
                          {#if status !== 'none'}
                            <button 
                              class="date-status-badge" 
                              style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                              title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                              on:click={() => toggleLotDateActual(row.id, 'settled_date', customData)}
                            >{dateStatusStyles[status].label}</button>
                          {/if}
                        </div>
                      {/if}
                    </td>
                    <td class="field-col date-col">
                      {#if datesTabEditMode}
                        <input type="date" value={rowEdits.cancelled_date || ''} on:input={(e) => { rowEdits.cancelled_date = e.currentTarget.value; datesTabEdits = datesTabEdits; }} class="date-input-cell" />
                      {:else}
                        {@const status = getDateStatus(customData.cancelled_date, customData.cancelled_date_actual)}
                        <div class="date-with-status">
                          <span class="date-display">{customData.cancelled_date || '-'}</span>
                          {#if status !== 'none'}
                            <button 
                              class="date-status-badge" 
                              style="background: {dateStatusStyles[status].bg}; color: {dateStatusStyles[status].color}; border-color: {dateStatusStyles[status].border};"
                              title="{dateStatusStyles[status].title} - Click to {status === 'actual' ? 'revert' : 'confirm'}"
                              on:click={() => toggleLotDateActual(row.id, 'cancelled_date', customData)}
                            >{dateStatusStyles[status].label}</button>
                          {/if}
                        </div>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if selectedNode?.type === 'stage' && stageTableTab === 'pricing'}
          <!-- Pricing Details Tab -->
          <div class="table-scroll-wrapper">
            <table class="data-table pricing-details-table">
              <thead>
                <tr>
                  <th class="th-checkbox">
                    <input type="checkbox" checked={selectedRows.size === tableData.length && tableData.length > 0} on:change={toggleAllRows} title="Select all" />
                  </th>
                  <th class="th-id">ID</th>
                  <th class="th-field">Lot #</th>
                  <th class="th-field th-num">Price</th>
                  <th class="th-field th-num">Deposit Amt</th>
                  <th class="th-field th-date">Deposit Date</th>
                  <th class="th-field th-num">Rebates</th>
                  <th class="th-field th-num">Discounts</th>
                  <th class="th-field">Price Adjustments</th>
                </tr>
              </thead>
              <tbody>
                {#each sortedTableData as row}
                  {@const customData = row.customData ? (typeof row.customData === 'string' ? JSON.parse(row.customData) : row.customData) : {}}
                  {@const rowEdits = pricingTabEdits.get(row.id) || {}}
                  <tr class:selected={selectedRows.has(row.id)}>
                    <td class="checkbox-col">
                      <input type="checkbox" checked={selectedRows.has(row.id)} on:change={() => toggleRowSelection(row.id)} />
                    </td>
                    <td class="id-col">{row.id}</td>
                    <td class="field-col">{row.lotNumber || '-'}</td>
                    <td class="field-col num-col">{row.price ? `$${parseFloat(row.price).toLocaleString()}` : '-'}</td>
                    <td class="field-col num-col">
                      {#if pricingTabEditMode}
                        <input type="text" value={rowEdits.deposit_amount || ''} on:input={(e) => { rowEdits.deposit_amount = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="number-input-cell" placeholder="$0" />
                      {:else}
                        <span class="value-display">{customData.deposit_amount || '-'}</span>
                      {/if}
                    </td>
                    <td class="field-col date-col">
                      {#if pricingTabEditMode}
                        <input type="date" value={rowEdits.deposit_date || ''} on:input={(e) => { rowEdits.deposit_date = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="date-input-cell" />
                      {:else}
                        <span class="date-display">{customData.deposit_date || '-'}</span>
                      {/if}
                    </td>
                    <td class="field-col num-col">
                      {#if pricingTabEditMode}
                        <input type="text" value={rowEdits.rebates || ''} on:input={(e) => { rowEdits.rebates = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="number-input-cell" placeholder="$0" />
                      {:else}
                        <span class="value-display">{customData.rebates || '-'}</span>
                      {/if}
                    </td>
                    <td class="field-col num-col">
                      {#if pricingTabEditMode}
                        <input type="text" value={rowEdits.discounts || ''} on:input={(e) => { rowEdits.discounts = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="number-input-cell" placeholder="$0" />
                      {:else}
                        <span class="value-display">{customData.discounts || '-'}</span>
                      {/if}
                    </td>
                    <td class="field-col">
                      {#if pricingTabEditMode}
                        <input type="text" value={rowEdits.price_adjustments || ''} on:input={(e) => { rowEdits.price_adjustments = e.currentTarget.value; pricingTabEdits = pricingTabEdits; }} class="text-input-cell" placeholder="Notes..." />
                      {:else}
                        <span class="value-display">{customData.price_adjustments || '-'}</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="table-scroll-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="th-checkbox th-sticky-left">
                    <input type="checkbox" checked={selectedRows.size === tableData.length && tableData.length > 0} on:change={toggleAllRows} title="Select all" />
                  </th>
                  <th class="th-id sortable" style="width: {getColumnWidth('id')}" on:click={() => toggleSort('id')}>
                    <span class="th-content">ID {sortColumn === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
                    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <div class="resize-handle" on:mousedown={(e) => startColumnResize(e, 'id')} role="separator" tabindex="0" aria-orientation="vertical"></div>
                  </th>
                  {#each orderedFields as field}
                    <th 
                      class="th-field sortable" 
                      class:th-num={field.type === 'number'}
                      class:th-status={field.type === 'status'}
                      class:th-date={field.type === 'date'}
                      style="width: {getColumnWidth(field.key)}"
                      on:click={() => toggleSort(field.key)}
                    >
                      <span class="th-content">{field.label} {sortColumn === field.key ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
                      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                      <div class="resize-handle" on:mousedown={(e) => startColumnResize(e, field.key)} role="separator" tabindex="0" aria-orientation="vertical"></div>
                    </th>
                  {/each}
                  <th class="th-actions th-sticky-right">
                    Actions
                    <button class="btn-fields-mgr" on:click={() => showFieldsManager = true} title="Manage Fields">⚙</button>
                  </th>
                </tr>
              </thead>
            <tbody>
              {#if isAdding}
                <tr class="adding-row">
                  <td class="checkbox-col td-sticky-left"></td>
                  <td class="id-col">--</td>
                  {#each orderedFields as field}
                    <td class="field-col" class:num-col={field.type === 'number'} class:status-col={field.type === 'status'} class:date-col={field.type === 'date'}>
                      {#if field.type === 'status'}
                        <select bind:value={newRowValues[field.key]} class="status-select">
                          <option value="">Select...</option>
                          {#each statusOptions as opt}
                            <option value={opt.value}>{opt.label}</option>
                          {/each}
                        </select>
                      {:else if field.type === 'date'}
                        <input type="date" bind:value={newRowValues[field.key]} class="date-input" />
                      {:else if field.type === 'number'}
                        <div class="number-input-wrapper">
                          <input type="text" bind:value={newRowValues[field.key]} placeholder={field.label} />
                          {#if field.format === '$'}
                            <div class="number-presets">
                              {#each numberPresets as preset}
                                <button type="button" class="preset-btn" on:click={() => newRowValues[field.key] = preset.value.toString()}>{preset.label}</button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {:else}
                        <input type="text" bind:value={newRowValues[field.key]} placeholder={field.label} />
                      {/if}
                    </td>
                  {/each}
                  <td class="actions-col td-sticky-right">
                    <button class="btn-save" on:click={saveAdd}>Save</button>
                    <button class="btn-cancel" on:click={cancelAdd}>Cancel</button>
                  </td>
                </tr>
              {/if}
              {#each sortedTableData as row}
                <tr class:editing={editingId === row.id} class:row-selected={selectedRows.has(row.id)}>
                  <td class="checkbox-col td-sticky-left">
                    <input type="checkbox" checked={selectedRows.has(row.id)} on:change={() => toggleRowSelection(row.id)} />
                  </td>
                  <td class="id-col">{row.id}</td>
                  {#if editingId === row.id}
                    {#each orderedFields as field}
                      <td class="field-col" class:num-col={field.type === 'number'} class:status-col={field.type === 'status'} class:date-col={field.type === 'date'}>
                        {#if field.type === 'status'}
                          <select bind:value={editValues[field.key]} class="status-select">
                            <option value="">Select...</option>
                            {#each statusOptions as opt}
                              <option value={opt.value}>{opt.label}</option>
                            {/each}
                          </select>
                        {:else if field.type === 'date'}
                          <input type="date" bind:value={editValues[field.key]} class="date-input" />
                        {:else if field.key === 'price'}
                          {@const lotFrontage = parseFloat(editValues.frontage) || parseFloat(row.frontage) || 0}
                          {@const lotDepth = parseFloat(editValues.depth) || parseFloat(row.depth) || 0}
                          {@const lotArea = parseFloat(editValues.area) || parseFloat(row.area) || lotFrontage * lotDepth}
                          {@const editIndicative = lotFrontage > 0 && lotDepth > 0 ? calculateLotPrice({ frontage: lotFrontage, depth: lotDepth, area: lotArea }) : null}
                          {@const pricedCount = pricingProducts.filter(p => p.basePrice > 0).length}
                          <div class="price-input-wrapper">
                            <input type="text" bind:value={editValues[field.key]} placeholder="Enter price" />
                            {#if editIndicative && pricedCount > 0}
                              <div class="indicative-suggestion">
                                <button type="button" class="btn-use-indicative" on:click={() => { editValues[field.key] = editIndicative.totalPrice.toString(); log(`Lot ${row.lotNumber || row.id}: Base ${editIndicative.matchedProduct} = $${editIndicative.basePrice.toLocaleString()} + Balance $${editIndicative.balancePrice.toLocaleString()} = $${editIndicative.totalPrice.toLocaleString()} ($${editIndicative.pricePerSqm}/m²)`, 'info'); }}>
                                  Use ${editIndicative.totalPrice.toLocaleString()}
                                </button>
                                <span class="base-used">Base: {editIndicative.matchedProduct}</span>
                              </div>
                            {:else if pricedCount === 0}
                              <span class="no-pricing-hint">Set up Pricing Matrix first</span>
                            {/if}
                          </div>
                        {:else if field.type === 'number'}
                          <div class="number-input-wrapper">
                            <input type="text" bind:value={editValues[field.key]} />
                          </div>
                        {:else}
                          <input type="text" bind:value={editValues[field.key]} />
                        {/if}
                      </td>
                    {/each}
                    <td class="actions-col td-sticky-right">
                      <button class="btn-save" on:click={() => saveEdit(row)}>Save</button>
                      <button class="btn-cancel" on:click={cancelEdit}>Cancel</button>
                    </td>
                  {:else}
                    {#each orderedFields as field}
                      <td class="field-col" class:num-col={field.type === 'number'} class:status-col={field.type === 'status'} class:date-col={field.type === 'date'} class:price-col={field.key === 'price'} class:inline-price-edit={field.key === 'price' && inlinePriceEditMode}>
                        {#if field.key === 'price' && inlinePriceEditMode}
                          {@const indicativePrice = calculateLotPrice(row)}
                          {@const originalPrice = parseFloat(row.price) || 0}
                          {@const currentEditPrice = inlinePriceEdits.has(row.id) ? (inlinePriceEdits.get(row.id) ?? 0) : originalPrice}
                          {@const hasChanged = currentEditPrice !== originalPrice && currentEditPrice > 0}
                          <div class="inline-price-edit-cell" class:has-change={hasChanged}>
                            <input 
                              type="text" 
                              class="inline-price-input" 
                              value={(currentEditPrice ?? 0) > 0 ? (currentEditPrice ?? 0).toLocaleString() : ''}
                              placeholder={originalPrice > 0 ? `Current: $${originalPrice.toLocaleString()}` : 'Enter price'}
                              on:input={(e) => updateInlinePrice(row.id, parseFloat(e.currentTarget.value.replace(/,/g, '')) || 0)}
                            />
                            {#if indicativePrice}
                              <button 
                                type="button" 
                                class="btn-use-indicative-inline" 
                                on:click={() => useIndicativePriceInline(row.id)}
                                title="Base: {indicativePrice.matchedProduct}"
                              >
                                Use ${indicativePrice.totalPrice.toLocaleString()}
                              </button>
                            {/if}
                          </div>
                        {:else if field.key === 'price' && pricingProducts.some(p => p.basePrice > 0)}
                          {@const indicativePrice = calculateLotPrice(row)}
                          {#if row.price && row.price > 0}
                            <span class="price-set">${row.price.toLocaleString()}</span>
                          {:else if indicativePrice}
                            <div class="indicative-price-cell">
                              <span class="indicative-value" title="{indicativePrice.matchedProduct}: Base ${indicativePrice.basePrice.toLocaleString()} + Balance ${indicativePrice.balancePrice.toLocaleString()}">
                                ${indicativePrice.totalPrice.toLocaleString()}
                              </span>
                              <button class="btn-accept-price" on:click={() => acceptIndicativePrice(row, indicativePrice.totalPrice, indicativePrice.pricePerSqm)} title="Accept this price">✓</button>
                            </div>
                          {:else}
                            <span class="no-price">-</span>
                          {/if}
                        {:else if field.type === 'status'}
                          {@const status = getStatusOption(row[field.key] || row.status || '')}
                          {#if row[field.key] || row.status}
                            <span class="status-pill" style="color: {status.color}; background: {status.bg};">
                              {status.label}
                            </span>
                          {:else}
                            <span class="no-status">-</span>
                          {/if}
                        {:else if field.type === 'date'}
                          {#if row[field.key] || (field.isCustom && getCustomFieldValue(row, field.key))}
                            {new Date(row[field.key] || getCustomFieldValue(row, field.key)).toLocaleDateString('en-AU')}
                          {:else}
                            -
                          {/if}
                        {:else if field.type === 'number'}
                          {formatNumber(field.isCustom ? getCustomFieldValue(row, field.key) : (row[field.key] ?? row[field.key === 'lotNumber' ? 'lotNumber' : field.key]), field.format || '')}
                        {:else}
                          {field.isCustom ? (getCustomFieldValue(row, field.key) || '-') : (row[field.key] || row[field.key === 'lotNumber' ? 'lotNumber' : field.key] || row.name || '-')}
                        {/if}
                      </td>
                    {/each}
                    <td class="actions-col td-sticky-right">
                      {#if userCanEdit}
                        <button class="btn-edit" on:click={() => startEdit(row)}>Edit</button>
                      {/if}
                      {#if userCanDelete}
                        <button class="btn-delete" on:click={() => deleteRow(row)}>Del</button>
                      {/if}
                      {#if !userCanEdit && !userCanDelete}
                        <span class="view-only-badge">View Only</span>
                      {/if}
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
          </div>
        {/if}
      </div>
      {/if}
      </div>
    </div>
  </div>
  
  <div class="log-panel">
    <span class="log-header">└─ Activity Log</span>
    {#if extractionProgress.total > 0}
      <div class="extraction-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {extractionProgress.current}%"></div>
        </div>
        <span class="progress-text">{extractionProgress.status} ({extractionProgress.current}%)</span>
      </div>
    {/if}
    <div class="log-content">
      {#each activityLog.slice().reverse() as entry}
        <span class="log-{entry.type}">[{entry.time}] {entry.message}</span>
      {/each}
    </div>
  </div>
</div>
{/if}

{#if showExtractionModal && extractionResult}
  <div class="modal-overlay" on:click={() => showExtractionModal = false} on:keydown={(e) => e.key === 'Escape' && (showExtractionModal = false)} role="button" tabindex="0">
    <div class="modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>🤖 AI Extraction Results</span>
        <button class="btn-cancel" on:click={() => showExtractionModal = false}>✕</button>
      </div>
      <div class="modal-body">
        {#if extractionResult.summary}
          <div class="extraction-summary">{extractionResult.summary}</div>
        {/if}
        
        {#if extractionResult.stages?.length > 0}
          <!-- Stages extraction (Permit Plan) -->
          <div class="extraction-stats">
            <span class="stat-create">📋 {extractionResult.stages.length} Stages</span>
            <span class="stat-create">🏠 {extractionResult.stages.reduce((sum: number, s: any) => sum + (s.lots?.length || 0), 0)} Total Lots</span>
          </div>
          {#each extractionResult.stages as stage, si}
            <div class="stage-section">
              <div class="stage-header">
                <select bind:value={stage.action} class="action-select">
                  <option value="create">Create</option>
                  <option value="skip">Skip</option>
                </select>
                <span class="stage-name">{stage.stageName || `Stage ${stage.stageNumber}`}</span>
                <span class="stage-lot-count">({stage.lots?.length || 0} lots)</span>
              </div>
              {#if stage.lots?.length > 0 && stage.action !== 'skip'}
                <table class="extraction-table stage-lots">
                  <thead>
                    <tr><th>Lot #</th><th>Area</th><th>Front</th><th>Depth</th><th>Street</th></tr>
                  </thead>
                  <tbody>
                    {#each stage.lots.slice(0, 10) as lot}
                      <tr><td>{lot.lotNumber}</td><td>{lot.area || '-'}</td><td>{lot.frontage || '-'}</td><td>{lot.depth || '-'}</td><td>{lot.streetName || '-'}</td></tr>
                    {/each}
                    {#if stage.lots.length > 10}
                      <tr><td colspan="5" class="more-lots">... and {stage.lots.length - 10} more lots</td></tr>
                    {/if}
                  </tbody>
                </table>
              {/if}
            </div>
          {/each}
        {:else if extractionResult.lots?.length > 0}
          <!-- Single stage lots extraction -->
          {@const updates = extractionResult.lots.filter((l: any) => l.action === 'update').length}
          {@const creates = extractionResult.lots.filter((l: any) => l.action === 'create').length}
          <div class="extraction-stats">
            <span class="stat-update">📝 {updates} Updates</span>
            <span class="stat-create">➕ {creates} New</span>
          </div>
          <table class="extraction-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Lot #</th>
                <th>Area</th>
                <th>Front</th>
                <th>Depth</th>
                <th>Street</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each extractionResult.lots as lot, i}
                <tr class:row-update={lot.action === 'update'} class:row-create={lot.action === 'create'} class:row-skip={lot.action === 'skip'}>
                  <td class="action-col">
                    <select bind:value={lot.action} class="action-select">
                      {#if lot.existingId}
                        <option value="update">Update</option>
                        <option value="create">Create New</option>
                        <option value="skip">Skip</option>
                      {:else}
                        <option value="create">Create</option>
                        <option value="skip">Skip</option>
                      {/if}
                    </select>
                  </td>
                  <td>{lot.lotNumber || '-'}</td>
                  <td class="compare-cell">
                    {#if lot.existingData && lot.area}
                      <span class="old-val">{lot.existingData.area || '-'}</span>
                      <span class="arrow">→</span>
                    {/if}
                    <span class="new-val">{lot.area || '-'}</span>
                  </td>
                  <td class="compare-cell">
                    {#if lot.existingData && lot.frontage}
                      <span class="old-val">{lot.existingData.frontage || '-'}</span>
                      <span class="arrow">→</span>
                    {/if}
                    <span class="new-val">{lot.frontage || '-'}</span>
                  </td>
                  <td class="compare-cell">
                    {#if lot.existingData && lot.depth}
                      <span class="old-val">{lot.existingData.depth || '-'}</span>
                      <span class="arrow">→</span>
                    {/if}
                    <span class="new-val">{lot.depth || '-'}</span>
                  </td>
                  <td>{lot.streetName || '-'}</td>
                  <td>
                    {#if lot.existingId}
                      {#if lot.hasChanges}
                        <span class="status-changed">Changed</span>
                      {:else}
                        <span class="status-same">No Change</span>
                      {/if}
                    {:else}
                      <span class="status-new">New</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="empty-msg">No lots extracted from document</div>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => showExtractionModal = false}>Cancel</button>
        {#if extractionResult.stages?.length > 0}
          {@const stageCount = extractionResult.stages.filter((s: any) => s.action !== 'skip').length}
          {@const lotCount = extractionResult.stages.filter((s: any) => s.action !== 'skip').reduce((sum: number, s: any) => sum + (s.lots?.length || 0), 0)}
          <button class="btn-save" on:click={saveExtractedStages} disabled={stageCount === 0}>
            Create {stageCount} Stages ({lotCount} lots)
          </button>
        {:else if extractionResult.lots?.length > 0}
          {@const actionCount = extractionResult.lots.filter((l: any) => l.action !== 'skip').length}
          <button class="btn-save" on:click={saveExtractedLots} disabled={actionCount === 0}>
            Apply {actionCount} Changes
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if showPricingReview}
  <div class="modal-overlay" on:click={cancelPricingReview} on:keydown={(e) => e.key === 'Escape' && cancelPricingReview()} role="button" tabindex="0">
    <div class="modal pricing-review-modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>💰 Pricing Review - {selectedNode?.name || 'Stage'}</span>
        <div class="header-actions">
          {#if pendingPriceChanges > 0}
            <span class="pending-badge">{pendingPriceChanges} pending changes</span>
          {/if}
          <button class="btn-cancel" on:click={cancelPricingReview}>✕</button>
        </div>
      </div>
      <div class="modal-body pricing-review-body">
        <div class="review-toolbar">
          <button class="btn-apply-all-indicative" on:click={applyIndicativeToAll}>
            📊 Apply Indicative to All
          </button>
          <span class="review-info">Edit prices below, then Save All to apply changes</span>
        </div>
        <div class="pricing-review-table-wrapper">
          <table class="pricing-review-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Dimensions</th>
                <th>Area</th>
                <th>Status</th>
                <th>Indicative</th>
                <th>Price</th>
                <th>$/m²</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {#each tableData as lot}
                {@const edit = stagePriceEdits.get(lot.id)}
                {@const indicative = calculateLotPrice(lot)}
                {@const hasChange = edit && edit.price !== edit.originalPrice}
                {@const status = statusOptions.find(s => s.value === lot.status)}
                <tr class:has-change={hasChange}>
                  <td class="col-lot">{lot.lotNumber || lot.name || lot.id}</td>
                  <td class="col-dims">{lot.frontage || '-'}×{lot.depth || '-'}m</td>
                  <td class="col-area">{lot.area || '-'} m²</td>
                  <td class="col-status">
                    {#if status}
                      <span class="status-mini" style="color: {status.color}">{status.label}</span>
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="col-indicative">
                    {#if indicative}
                      <button class="btn-use-indicative-small" on:click={() => useIndicativePriceInReview(lot.id)} title="Use this price">
                        ${indicative.totalPrice.toLocaleString()}
                      </button>
                    {:else}
                      <span class="no-indicative">-</span>
                    {/if}
                  </td>
                  <td class="col-price-edit">
                    {#if edit}
                      <input 
                        type="number" 
                        class="price-input" 
                        value={edit.price}
                        on:input={(e) => updateLotPriceInReview(lot.id, parseFloat(e.currentTarget.value) || 0)}
                      />
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="col-sqm">
                    {#if edit && edit.pricePerSqm > 0}
                      ${edit.pricePerSqm}
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="col-change">
                    {#if hasChange}
                      {@const diff = edit.price - edit.originalPrice}
                      <span class="change-indicator" class:positive={diff > 0} class:negative={diff < 0}>
                        {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                      </span>
                    {:else}
                      -
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="pricing-review-summary">
          <div class="summary-stat">
            <span class="label">Total Value:</span>
            <span class="value">${totalNewValue.toLocaleString()}</span>
          </div>
          {#if totalPriceDiff !== 0}
            <div class="summary-stat change">
              <span class="label">Change:</span>
              <span class="value" class:positive={totalPriceDiff > 0} class:negative={totalPriceDiff < 0}>
                {totalPriceDiff > 0 ? '+' : ''}${totalPriceDiff.toLocaleString()}
              </span>
            </div>
          {/if}
          <div class="summary-stat">
            <span class="label">Lots:</span>
            <span class="value">{tableData.length}</span>
          </div>
        </div>
      </div>
      <div class="modal-footer pricing-review-footer">
        <button class="btn-cancel" on:click={cancelPricingReview}>Cancel</button>
        <button 
          class="btn-save-all" 
          on:click={saveAllPrices} 
          disabled={pendingPriceChanges === 0 || savingAllPrices}
        >
          {#if savingAllPrices}
            Saving...
          {:else}
            ✓ Save All ({pendingPriceChanges} changes)
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if previewDocument}
  <div class="modal-overlay" on:click={() => previewDocument = null} on:keydown={(e) => e.key === 'Escape' && (previewDocument = null)} role="button" tabindex="0">
    <div class="modal preview-modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>📄 {previewDocument.originalName}</span>
        <button class="btn-cancel" on:click={() => previewDocument = null}>✕</button>
      </div>
      <div class="modal-body preview-body">
        {#if previewDocument.mimeType?.startsWith('image/')}
          <img src="/uploads/{previewDocument.filename}" alt={previewDocument.originalName} class="preview-image" />
        {:else if previewDocument.mimeType === 'application/pdf'}
          <iframe src="/uploads/{previewDocument.filename}" title={previewDocument.originalName} class="preview-pdf"></iframe>
        {:else}
          <div class="preview-unsupported">Preview not available for this file type</div>
        {/if}
      </div>
      <div class="modal-footer">
        <a href="/uploads/{previewDocument.filename}" download={previewDocument.originalName} class="btn-download">Download</a>
        <button class="btn-cancel" on:click={() => previewDocument = null}>Close</button>
      </div>
    </div>
  </div>
{/if}

{#if showCalibrationModal}
  <div class="modal-overlay" on:click={() => showCalibrationModal = false} on:keydown={(e) => e.key === 'Escape' && (showCalibrationModal = false)} role="button" tabindex="0">
    <div class="modal calibration-modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>🎯 Calibration Check - Verify {calibrationSamples.length} Sample Lots</span>
        <button class="btn-cancel" on:click={() => showCalibrationModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="calibration-instructions">
          <p>The AI extracted the following sample lots. <strong>Please verify and correct</strong> any values that don't match the document.</p>
          <p class="calibration-hint">Your corrections will help calibrate the AI to find similar errors in other lots.</p>
        </div>
        
        <div class="calibration-samples">
          {#each calibrationSamples as sample, i}
            <div class="calibration-card">
              <div class="calibration-card-header">
                <span class="lot-badge">Lot {sample.lotNumber}</span>
                {#if sample.area !== sample.userArea || sample.frontage !== sample.userFrontage || sample.depth !== sample.userDepth || sample.streetName !== sample.userStreetName}
                  <span class="corrected-badge">✏️ Corrected</span>
                {/if}
              </div>
              <div class="calibration-fields">
                <label class="calibration-field">
                  <span class="field-label">Area</span>
                  <div class="field-row">
                    <span class="ai-value" class:changed={sample.area !== sample.userArea}>{sample.area || '-'}</span>
                    <span class="arrow">→</span>
                    <input type="text" bind:value={sample.userArea} placeholder="Correct value" class="calibration-input" />
                  </div>
                </label>
                <label class="calibration-field">
                  <span class="field-label">Frontage</span>
                  <div class="field-row">
                    <span class="ai-value" class:changed={sample.frontage !== sample.userFrontage}>{sample.frontage || '-'}</span>
                    <span class="arrow">→</span>
                    <input type="text" bind:value={sample.userFrontage} placeholder="Correct value" class="calibration-input" />
                  </div>
                </label>
                <label class="calibration-field">
                  <span class="field-label">Depth</span>
                  <div class="field-row">
                    <span class="ai-value" class:changed={sample.depth !== sample.userDepth}>{sample.depth || '-'}</span>
                    <span class="arrow">→</span>
                    <input type="text" bind:value={sample.userDepth} placeholder="Correct value" class="calibration-input" />
                  </div>
                </label>
                <label class="calibration-field">
                  <span class="field-label">Street</span>
                  <div class="field-row">
                    <span class="ai-value" class:changed={sample.streetName !== sample.userStreetName}>{sample.streetName || '-'}</span>
                    <span class="arrow">→</span>
                    <input type="text" bind:value={sample.userStreetName} placeholder="Correct value" class="calibration-input" />
                  </div>
                </label>
              </div>
            </div>
          {/each}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => showCalibrationModal = false}>Cancel</button>
        <button class="btn-skip" on:click={skipCalibration}>Skip Calibration</button>
        <button class="btn-save" on:click={submitCalibration} disabled={isCalibrating}>
          {isCalibrating ? '⏳ Calibrating...' : '✓ Apply Calibration & Analyze'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showVerificationModal && verificationResult}
  <div class="modal-overlay" on:click={() => showVerificationModal = false} on:keydown={(e) => e.key === 'Escape' && (showVerificationModal = false)} role="button" tabindex="0">
    <div class="modal verification-modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>🔍 Verification Results - Page {pdfPageNumber}</span>
        <button class="btn-cancel" on:click={() => showVerificationModal = false}>✕</button>
      </div>
      <div class="modal-body">
        {#if verificationResult.summary}
          <div class="verification-summary">{verificationResult.summary}</div>
        {/if}
        
        {#if verificationResult.corrections?.length > 0}
          <h4>📝 Suggested Corrections</h4>
          <table class="extraction-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Field</th>
                <th>Current</th>
                <th>Suggested</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {#each verificationResult.corrections as correction}
                <tr>
                  <td>{correction.lotNumber}</td>
                  <td>{correction.field}</td>
                  <td class="current-val">{correction.currentValue || '-'}</td>
                  <td class="new-val">{correction.newValue || correction.correctValue}</td>
                  <td>
                    <button class="btn-apply-one" on:click={() => applyCorrection(correction)}>Apply</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="empty-msg">No corrections found - data appears accurate!</div>
        {/if}
        
        {#if verificationResult.newLots?.length > 0}
          <h4>➕ New Lots Found</h4>
          <table class="extraction-table">
            <thead>
              <tr>
                <th>Lot #</th>
                <th>Area</th>
                <th>Frontage</th>
                <th>Depth</th>
                <th>Street</th>
              </tr>
            </thead>
            <tbody>
              {#each verificationResult.newLots as lot}
                <tr>
                  <td>{lot.lotNumber}</td>
                  <td>{lot.area || '-'}</td>
                  <td>{lot.frontage || '-'}</td>
                  <td>{lot.depth || '-'}</td>
                  <td>{lot.streetName || '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
        
        {#if verificationResult.error}
          <div class="error-msg">{verificationResult.error}</div>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => showVerificationModal = false}>Close</button>
        {#if verificationResult.corrections?.length > 0}
          <button class="btn-save" on:click={applyAllCorrections}>
            Apply All ({verificationResult.corrections.length}) Corrections
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if showPosAnalysisModal && posAnalysisResult}
  <div class="modal-overlay" on:click={() => showPosAnalysisModal = false} on:keydown={(e) => e.key === 'Escape' && (showPosAnalysisModal = false)} role="button" tabindex="0">
    <div class="modal pos-analysis-modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>📊 Plan of Subdivision Analysis {posAnalysisResult.psNumber ? `- ${posAnalysisResult.psNumber}` : ''}</span>
        <button class="btn-cancel" on:click={() => showPosAnalysisModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <!-- Summary Stats -->
        {#if posAnalysisResult.summary}
          <div class="pos-summary">
            <div class="summary-stat">
              <span class="stat-value">{posAnalysisResult.summary.totalLots}</span>
              <span class="stat-label">Total Lots</span>
            </div>
            <div class="summary-stat match">
              <span class="stat-value">{posAnalysisResult.summary.matches}</span>
              <span class="stat-label">Match</span>
            </div>
            <div class="summary-stat variance">
              <span class="stat-value">{posAnalysisResult.summary.variances}</span>
              <span class="stat-label">Variances</span>
            </div>
            <div class="summary-stat easement">
              <span class="stat-value">{posAnalysisResult.summary.lotsWithEasements}</span>
              <span class="stat-label">With Easements</span>
            </div>
          </div>
        {/if}
        
        <!-- Filter Tabs -->
        <div class="pos-filter-tabs">
          <button class:active={posAnalysisFilter === 'all'} on:click={() => posAnalysisFilter = 'all'}>
            All ({posAnalysisResult.comparisons?.length || 0})
          </button>
          <button class:active={posAnalysisFilter === 'variance'} on:click={() => posAnalysisFilter = 'variance'}>
            ⚠️ Variances ({posAnalysisResult.summary?.variances || 0})
          </button>
          <button class:active={posAnalysisFilter === 'easements'} on:click={() => posAnalysisFilter = 'easements'}>
            📋 Easements ({posAnalysisResult.summary?.lotsWithEasements || 0})
          </button>
          <button class:active={posAnalysisFilter === 'match'} on:click={() => posAnalysisFilter = 'match'}>
            ✓ Match ({posAnalysisResult.summary?.matches || 0})
          </button>
        </div>
        
        <!-- Lot Comparisons -->
        <div class="pos-comparisons">
          {#each getFilteredComparisons() as comp}
            <div class="pos-lot-card {comp.status}">
              <div class="lot-card-header" on:click={() => toggleLotExpanded(comp.lotNumber)} on:keydown={(e) => e.key === 'Enter' && toggleLotExpanded(comp.lotNumber)} role="button" tabindex="0">
                <span class="lot-number">Lot {comp.lotNumber}</span>
                <span class="lot-status-badge {comp.status}">
                  {#if comp.status === 'match'}✓ Match
                  {:else if comp.status === 'variance'}⚠️ Variance
                  {:else if comp.status === 'new_data'}📋 New Data
                  {/if}
                </span>
                {#if comp.newInfo?.easements?.length > 0}
                  <span class="easement-badge">🔒 {comp.newInfo.easements.length} Easement{comp.newInfo.easements.length > 1 ? 's' : ''}</span>
                {/if}
                <span class="expand-icon">{expandedLots.has(comp.lotNumber) ? '▼' : '▶'}</span>
              </div>
              
              {#if expandedLots.has(comp.lotNumber) || comp.status === 'variance'}
                <div class="lot-card-body">
                  <!-- Comparison Table -->
                  <table class="comparison-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Existing</th>
                        <th>POS Value</th>
                        <th>Diff</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class:has-variance={comp.variances.some((v: any) => v.field === 'area')}>
                        <td>Area</td>
                        <td>{comp.existing.area || '-'} m²</td>
                        <td>{comp.extracted.area || '-'} m²</td>
                        <td class="diff-cell">
                          {#if comp.variances.find((v: any) => v.field === 'area')}
                            <span class="diff-value">{comp.variances.find((v: any) => v.field === 'area').difference}</span>
                          {:else}
                            -
                          {/if}
                        </td>
                        <td>
                          {#if comp.variances.find((v: any) => v.field === 'area')}
                            <button class="btn-apply-small" on:click={() => applyPosCorrection(posAnalysisResult.corrections.find((c: any) => c.lotId === comp.lotId && c.field === 'area'))}>Apply</button>
                          {/if}
                        </td>
                      </tr>
                      <tr class:has-variance={comp.variances.some((v: any) => v.field === 'frontage')}>
                        <td>Frontage</td>
                        <td>{comp.existing.frontage || '-'}m</td>
                        <td>{comp.extracted.frontage || '-'}m</td>
                        <td class="diff-cell">
                          {#if comp.variances.find((v: any) => v.field === 'frontage')}
                            <span class="diff-value">{comp.variances.find((v: any) => v.field === 'frontage').difference}</span>
                          {:else}
                            -
                          {/if}
                        </td>
                        <td>
                          {#if comp.variances.find((v: any) => v.field === 'frontage')}
                            <button class="btn-apply-small" on:click={() => applyPosCorrection(posAnalysisResult.corrections.find((c: any) => c.lotId === comp.lotId && c.field === 'frontage'))}>Apply</button>
                          {/if}
                        </td>
                      </tr>
                      <tr class:has-variance={comp.variances.some((v: any) => v.field === 'depth')}>
                        <td>Depth</td>
                        <td>{comp.existing.depth || '-'}m</td>
                        <td>{comp.extracted.depth || '-'}m</td>
                        <td class="diff-cell">
                          {#if comp.variances.find((v: any) => v.field === 'depth')}
                            <span class="diff-value">{comp.variances.find((v: any) => v.field === 'depth').difference}</span>
                          {:else}
                            -
                          {/if}
                        </td>
                        <td>
                          {#if comp.variances.find((v: any) => v.field === 'depth')}
                            <button class="btn-apply-small" on:click={() => applyPosCorrection(posAnalysisResult.corrections.find((c: any) => c.lotId === comp.lotId && c.field === 'depth'))}>Apply</button>
                          {/if}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <!-- Easements -->
                  {#if comp.newInfo?.easements?.length > 0}
                    <div class="easements-section">
                      <h5>🔒 Easements</h5>
                      <div class="easements-list">
                        {#each comp.newInfo.easements as easement}
                          <div class="easement-item">
                            <span class="easement-id">{easement.id}</span>
                            <span class="easement-type">{easement.type}</span>
                            {#if easement.width}<span class="easement-width">{easement.width}</span>{/if}
                            {#if easement.purpose}<span class="easement-purpose">{easement.purpose}</span>{/if}
                            {#if easement.beneficiary}<span class="easement-beneficiary">→ {easement.beneficiary}</span>{/if}
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  
                  <!-- Encumbrances -->
                  {#if comp.newInfo?.encumbrances?.length > 0}
                    <div class="encumbrances-section">
                      <h5>⚠️ Encumbrances</h5>
                      <div class="encumbrances-list">
                        {#each comp.newInfo.encumbrances as enc}
                          <div class="encumbrance-item">
                            <span class="enc-type">{enc.type}</span>
                            <span class="enc-desc">{enc.description}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  
                  <!-- Restrictions -->
                  {#if comp.newInfo?.restrictions?.length > 0}
                    <div class="restrictions-section">
                      <h5>📜 Restrictions</h5>
                      <div class="restrictions-list">
                        {#each comp.newInfo.restrictions as rest}
                          <div class="restriction-item">
                            <span class="rest-type">{rest.type}</span>
                            <span class="rest-desc">{rest.description}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
        
        <!-- General Easements -->
        {#if posAnalysisResult.generalEasements?.length > 0}
          <div class="general-easements-section">
            <h4>📋 General Easements Affecting Multiple Lots</h4>
            <div class="general-easements-list">
              {#each posAnalysisResult.generalEasements as ge}
                <div class="general-easement-item">
                  <span class="ge-id">{ge.id}</span>
                  <span class="ge-type">{ge.type}</span>
                  {#if ge.width}<span class="ge-width">{ge.width}</span>{/if}
                  <span class="ge-lots">Affects: {ge.affectedLots?.join(', ') || 'Unknown'}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => showPosAnalysisModal = false}>Close</button>
        {#if posAnalysisResult.corrections?.length > 0}
          <button class="btn-save" on:click={applyAllPosCorrections}>
            Apply All ({posAnalysisResult.corrections.length}) Corrections
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if showPreExtractionModal}
  <div class="modal-overlay" on:click={cancelPreExtraction} on:keydown={(e) => e.key === 'Escape' && cancelPreExtraction()} role="button" tabindex="0">
    <div class="modal pre-extraction-modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>💡 Extraction Context</span>
        <button class="btn-cancel" on:click={cancelPreExtraction}>✕</button>
      </div>
      <div class="modal-body">
        <div class="pre-extraction-info">
          <p>You can provide context to help the AI extract data more accurately. This is <strong>optional</strong> but can significantly improve results.</p>
          
          <div class="hints-examples">
            <h4>Helpful information to include:</h4>
            <ul>
              <li><strong>Stage names/numbers</strong> - e.g., "This plan has Stage 40, 41, and 42"</li>
              <li><strong>Lot numbering pattern</strong> - e.g., "Lots start with stage number: 4001 = Stage 40, Lot 1"</li>
              <li><strong>Street names</strong> - e.g., "Streets: Main St, Oak Ave, Park Rd"</li>
              <li><strong>Approximate lot count</strong> - e.g., "About 120 lots total"</li>
            </ul>
          </div>
          
          <textarea 
            class="hints-textarea-large"
            bind:value={extractionHints}
            placeholder="Example:
This Permit Plan has 3 stages: Stage 40, 41, and 42
Lot numbers start with the stage number:
- Stage 40: Lots 4001-4050
- Stage 41: Lots 4101-4140
- Stage 42: Lots 4201-4230
Street names: Maple Drive, Oak Avenue, Park Road"
            rows="6"
          ></textarea>
        </div>
        
        <div class="model-selection">
          <label for="ai-model-select">AI Model:</label>
          <select id="ai-model-select" bind:value={selectedModel}>
            {#each modelOptions as model}
              <option value={model.id}>{model.name}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={cancelPreExtraction}>Cancel</button>
        <button class="btn-secondary" on:click={() => { extractionHints = ''; confirmExtraction(); }}>
          Skip Context
        </button>
        <button class="btn-save" on:click={confirmExtraction}>
          🤖 Start Extraction
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showContinueModal && continuationInfo}
  <div class="modal-overlay" on:click={() => showContinueModal = false} on:keydown={(e) => e.key === 'Escape' && (showContinueModal = false)} role="button" tabindex="0">
    <div class="modal continue-modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>📊 More Data Available</span>
        <button class="btn-cancel" on:click={() => showContinueModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="continue-info">
          <p>The AI has extracted partial data and detected more content:</p>
          <div class="continue-details">
            <div class="detail-row">
              <span class="label">Remaining Stages:</span>
              <span class="value">{continuationInfo.remainingStages.join(', ') || 'Unknown'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Estimated Lots:</span>
              <span class="value">~{continuationInfo.estimatedLots} lots</span>
            </div>
            <div class="detail-row">
              <span class="label">Est. Token Cost:</span>
              <span class="value">~{Math.ceil(continuationInfo.estimatedLots * 50)} tokens</span>
            </div>
          </div>
          <p class="continue-note">Continue extraction to get the remaining data?</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => { showContinueModal = false; continuationInfo = null; showExtractionModal = true; }}>
          ✓ Save Current Data
        </button>
        <button class="btn-save" on:click={continueExtraction}>
          ➕ Continue Extraction
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showFieldsManager}
  <div class="modal-overlay" on:click={() => showFieldsManager = false} on:keydown={(e) => e.key === 'Escape' && (showFieldsManager = false)} role="button" tabindex="0">
    <div class="modal fields-modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>⚙ Manage Fields - {getCustomFieldEntityType()?.toUpperCase() || 'Entity'}s</span>
        <button class="btn-cancel" on:click={() => showFieldsManager = false}>✕</button>
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
            <button class="btn-save" on:click={addCustomField} disabled={!newFieldLabel.trim()}>+ Add</button>
          </div>
          <p class="field-note">New fields will appear across all {getCustomFieldEntityType() || 'entity'}s of this type</p>
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
                on:dragstart={(e) => handleFieldDragStart(e, field.key)}
                on:dragover={handleFieldDragOver}
                on:drop={(e) => handleFieldDrop(e, field.key)}
                on:dragend={handleFieldDragEnd}
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
                    on:click={() => toggleFieldVisibility(field.key)}
                    title={hiddenFields.has(field.key) ? 'Show field' : 'Hide field'}
                  >
                    {hiddenFields.has(field.key) ? '👁️‍🗨️' : '👁️'}
                  </button>
                  {#if !field.isDefault && field.id !== undefined}
                    <button class="btn-delete" on:click={() => field.id !== undefined && removeCustomField(field.id, field.label)} title="Remove field">✕</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => showFieldsManager = false}>Close</button>
      </div>
    </div>
  </div>
{/if}

{#if showUserManagement && canManageUsers}
  <div class="modal-overlay" role="presentation">
    <div class="modal user-management-modal" role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>👥 User & Role Management</span>
        <button class="btn-cancel" on:click={() => showUserManagement = false}>✕</button>
      </div>
      
      <div class="management-tabs">
        <button class:active={managementTab === 'users'} on:click={() => managementTab = 'users'}>Users</button>
        <button class:active={managementTab === 'roles'} on:click={() => managementTab = 'roles'}>Roles</button>
        <button class:active={managementTab === 'invites'} on:click={() => managementTab = 'invites'}>Invitations</button>
        <button class:active={managementTab === 'activity'} on:click={() => { managementTab = 'activity'; loadActivityLogs(); }}>Activity Log</button>
      </div>
      
      <div class="modal-body">
        {#if managementError}
          <div class="management-error">{managementError}</div>
        {/if}
        
        {#if loadingManagement}
          <div class="loading-state">Loading...</div>
        {:else if managementTab === 'users'}
          <div class="management-section">
            <h4>Create New User</h4>
            <div class="user-create-form">
              <div class="form-row">
                <input type="text" placeholder="Name" bind:value={newUserForm.name} />
                <input type="email" placeholder="Email" bind:value={newUserForm.email} />
                <input type="password" placeholder="Password" bind:value={newUserForm.password} />
                <select bind:value={newUserForm.roleId}>
                  <option value={0}>-- Select Role --</option>
                  {#each allRoles as role}
                    <option value={role.id}>{role.name}</option>
                  {/each}
                </select>
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={newUserForm.isMaster} /> Master
                </label>
                <button class="btn-primary" on:click={createUser}>Create User</button>
              </div>
            </div>
          </div>
          
          {#if editingUser}
            <div class="management-section edit-user-section">
              <h4>Edit User: {editingUser.name}</h4>
              <div class="user-create-form">
                <div class="form-row">
                  <input type="text" placeholder="Name" bind:value={editingUser.name} />
                  <input type="email" placeholder="Email" bind:value={editingUser.email} />
                  <input type="password" placeholder="New Password (leave empty to keep)" bind:value={editingUser.password} />
                  <select bind:value={editingUser.roleId}>
                    <option value={0}>-- No Role Change --</option>
                    {#each allRoles as role}
                      <option value={role.id}>{role.name}</option>
                    {/each}
                  </select>
                  {#if currentUser?.isMaster}
                    <select bind:value={editingUser.companyId}>
                      <option value={0}>-- Select Company --</option>
                      {#each allCompanies as company}
                        <option value={company.id}>{company.name}</option>
                      {/each}
                    </select>
                    <label class="checkbox-label">
                      <input type="checkbox" bind:checked={editingUser.isMaster} /> Master
                    </label>
                  {/if}
                  <button class="btn-primary" on:click={saveEditUser}>Save</button>
                  <button class="btn-cancel" on:click={cancelEditUser}>Cancel</button>
                </div>
              </div>
            </div>
          {/if}
          
          <div class="management-section">
            <h4>All Users ({allUsers.length})</h4>
            <table class="management-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  {#if currentUser?.isMaster}<th>Company</th>{/if}
                  <th>Status</th>
                  {#if currentUser?.isMaster}<th>Master</th>{/if}
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each allUsers as user}
                  <tr class:inactive={!user.isActive} class:editing={editingUser?.id === user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td><span class="role-badge">{user.roleName || 'No Role'}</span></td>
                    {#if currentUser?.isMaster}
                      <td><span class="company-badge">{allCompanies.find(c => c.id === user.companyId)?.name || 'None'}</span></td>
                    {/if}
                    <td>
                      <span class="status-badge" class:active={user.isActive}>{user.isActive ? 'Active' : 'Disabled'}</span>
                    </td>
                    {#if currentUser?.isMaster}<td>{user.isMaster ? '✓' : ''}</td>{/if}
                    <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <button class="btn-small edit-btn" on:click={() => startEditUser(user)}>Edit</button>
                      <button class="btn-small" on:click={() => toggleUserStatus(user)}>
                        {user.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if managementTab === 'roles'}
          <div class="management-section">
            <h4>Create New Role</h4>
            <div class="role-form">
              <div class="form-row">
                <input type="text" placeholder="Role Name" bind:value={newRoleForm.name} />
                <input type="text" placeholder="Description" bind:value={newRoleForm.description} />
              </div>
              <div class="permissions-row">
                <label><input type="checkbox" bind:checked={newRoleForm.canView} /> View</label>
                <label><input type="checkbox" bind:checked={newRoleForm.canEdit} /> Edit</label>
                <label><input type="checkbox" bind:checked={newRoleForm.canDelete} /> Delete</label>
                <label><input type="checkbox" bind:checked={newRoleForm.canInvite} /> Invite</label>
                <label><input type="checkbox" bind:checked={newRoleForm.canManageRoles} /> Manage Roles</label>
                <button class="btn-primary" on:click={createRole}>Create Role</button>
              </div>
            </div>
          </div>
          
          <div class="management-section">
            <h4>All Roles ({allRoles.length})</h4>
            <table class="management-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>View</th>
                  <th>Edit</th>
                  <th>Delete</th>
                  <th>Invite</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {#each allRoles as role}
                  <tr>
                    <td><strong>{role.name}</strong></td>
                    <td>{role.description || '-'}</td>
                    <td>{role.canView ? '✓' : ''}</td>
                    <td>{role.canEdit ? '✓' : ''}</td>
                    <td>{role.canDelete ? '✓' : ''}</td>
                    <td>{role.canInvite ? '✓' : ''}</td>
                    <td>{role.canManageRoles ? '✓' : ''}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if managementTab === 'invites'}
          <div class="management-section">
            <h4>Send Invitation</h4>
            <div class="invite-form">
              <div class="form-row">
                <input type="email" placeholder="Email address" bind:value={inviteForm.email} />
                <select bind:value={inviteForm.roleId}>
                  <option value={0}>-- Select Role --</option>
                  {#each allRoles as role}
                    <option value={role.id}>{role.name}</option>
                  {/each}
                </select>
                <select bind:value={inviteForm.entityType} on:change={onEntityTypeChange}>
                  <option value="company">Company</option>
                  <option value="project">Project</option>
                </select>
                <select bind:value={inviteForm.entityId}>
                  <option value={0}>-- Select {inviteForm.entityType === 'company' ? 'Company' : 'Project'} --</option>
                  {#each availableEntities as entity}
                    <option value={entity.id}>{entity.name}</option>
                  {/each}
                </select>
                <button class="btn-primary" on:click={sendInvite}>Send Invite</button>
              </div>
            </div>
          </div>
          
          <div class="management-section">
            <h4>Pending Invitations ({allInvites.filter(i => !i.acceptedAt).length})</h4>
            {#if allInvites.filter(i => !i.acceptedAt).length === 0}
              <p class="empty-state">No pending invitations</p>
            {:else}
              <table class="management-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Entity</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each allInvites.filter(i => !i.acceptedAt) as invite}
                    <tr>
                      <td>{invite.email}</td>
                      <td>{invite.roleName}</td>
                      <td><span class="entity-badge">{invite.entityType} #{invite.entityId}</span></td>
                      <td>{new Date(invite.expiresAt).toLocaleDateString()}</td>
                      <td>
                        <button class="btn-small copy-btn" on:click={() => navigator.clipboard.writeText(window.location.origin + '/signup?token=' + invite.token + '&email=' + invite.email)}>
                          Copy Link
                        </button>
                        <button class="btn-small danger" on:click={() => deleteInvite(invite.id)}>Delete</button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        {:else if managementTab === 'activity'}
          <div class="management-section">
            <h4>Activity Log</h4>
            <p class="section-desc">Recent actions performed by users in the system</p>
            {#if loadingActivity}
              <div class="loading-state">Loading activity logs...</div>
            {:else if activityLogs.length === 0}
              <p class="empty-state">No activity recorded yet</p>
            {:else}
              <div class="activity-log-container">
                <table class="management-table activity-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each activityLogs as log}
                      <tr>
                        <td class="time-col">{new Date(log.createdAt).toLocaleString()}</td>
                        <td>{log.userName || 'System'}</td>
                        <td>
                          <span class="action-badge" class:create={log.action === 'create'} class:update={log.action === 'update'} class:delete={log.action === 'delete'}>
                            {log.action}
                          </span>
                        </td>
                        <td><span class="entity-badge">{log.entityType} #{log.entityId}</span></td>
                        <td class="details-col">
                          {#if log.details}
                            <span class="details-text" title={log.details}>
                              {(() => {
                                try {
                                  const d = JSON.parse(log.details);
                                  return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ').substring(0, 50) + (JSON.stringify(d).length > 50 ? '...' : '');
                                } catch { return log.details.substring(0, 50); }
                              })()}
                            </span>
                          {:else}
                            -
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => showUserManagement = false}>Close</button>
      </div>
    </div>
  </div>
{/if}

{#if showNewCompanyModal}
  <div class="modal-overlay" role="presentation" on:click|self={() => showNewCompanyModal = false}>
    <div class="modal new-company-modal" role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>🏢 Create New Company Group</span>
        <button class="btn-cancel" on:click={() => showNewCompanyModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="companyName">Company Name *</label>
          <input 
            type="text" 
            id="companyName" 
            bind:value={newCompanyName} 
            placeholder="Enter company name"
            on:keydown={(e) => e.key === 'Enter' && createNewCompany()}
            disabled={creatingCompany}
          />
        </div>
        <div class="form-group">
          <label for="companyAbn">ABN (optional)</label>
          <input 
            type="text" 
            id="companyAbn" 
            bind:value={newCompanyAbn} 
            placeholder="Enter ABN"
            on:keydown={(e) => e.key === 'Enter' && createNewCompany()}
            disabled={creatingCompany}
          />
        </div>
        <p class="form-hint">You will automatically become the Admin of this company group and can invite others.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => showNewCompanyModal = false} disabled={creatingCompany}>Cancel</button>
        <button class="btn-primary" on:click={createNewCompany} disabled={creatingCompany || !newCompanyName.trim()}>
          {creatingCompany ? 'Creating...' : 'Create Company'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Auth Loading */
  .auth-loading {
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #1a1b26;
    color: #a9b1d6;
    font-family: 'JetBrains Mono', monospace;
    gap: 16px;
  }
  
  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #3b4261;
    border-top-color: #7aa2f7;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* User Menu */
  .user-section {
    margin-left: auto;
    position: relative;
  }
  
  .user-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 1px solid #3b4261;
    border-radius: 4px;
    padding: 6px 12px;
    color: #c0caf5;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .user-btn:hover {
    background: #292e42;
    border-color: #7aa2f7;
  }
  
  .user-avatar {
    width: 24px;
    height: 24px;
    background: #7aa2f7;
    color: #1a1b26;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 11px;
  }
  
  .master-badge {
    background: #bb9af7;
    color: #1a1b26;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .user-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 6px;
    min-width: 200px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
  }
  
  .dropdown-header {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .dropdown-header strong {
    color: #c0caf5;
  }
  
  .user-email {
    color: #565f89;
    font-size: 11px;
  }
  
  .user-role-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    background: rgba(86, 95, 137, 0.3);
    color: #a9b1d6;
    margin-top: 4px;
    width: fit-content;
  }
  
  .user-role-badge.master {
    background: rgba(247, 118, 142, 0.2);
    color: #f7768e;
  }
  
  .user-role-badge.admin {
    background: rgba(158, 206, 106, 0.2);
    color: #9ece6a;
  }
  
  .dropdown-permissions {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    flex-wrap: wrap;
  }
  
  .perm-item {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(86, 95, 137, 0.2);
    color: #565f89;
  }
  
  .perm-item.enabled {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }
  
  .dropdown-divider {
    height: 1px;
    background: #3b4261;
  }
  
  .dropdown-item {
    display: block;
    width: 100%;
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: #a9b1d6;
    font-family: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .dropdown-item:hover {
    background: #292e42;
  }
  
  .dropdown-item.logout {
    color: #f7768e;
  }
  
  /* User Management Modal */
  .user-management-modal {
    width: 900px;
    max-width: 95vw;
    max-height: 85vh;
  }
  
  .management-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid #3b4261;
    padding: 0 16px;
  }
  
  .management-tabs button {
    padding: 12px 20px;
    background: transparent;
    border: none;
    color: #565f89;
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  
  .management-tabs button:hover {
    color: #a9b1d6;
  }
  
  .management-tabs button.active {
    color: #7aa2f7;
    border-bottom-color: #7aa2f7;
  }
  
  .management-section {
    margin-bottom: 24px;
  }
  
  .management-section h4 {
    color: #c0caf5;
    margin: 0 0 12px 0;
    font-size: 14px;
  }
  
  .management-error {
    background: rgba(247, 118, 142, 0.15);
    border: 1px solid #f7768e;
    color: #f7768e;
    padding: 10px 14px;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 12px;
  }
  
  .inline-form {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .inline-form input[type="text"],
  .inline-form input[type="email"],
  .inline-form input[type="password"] {
    padding: 8px 12px;
    background: #1a1b26;
    border: 1px solid #3b4261;
    border-radius: 4px;
    color: #c0caf5;
    font-family: inherit;
    font-size: 12px;
    min-width: 120px;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #a9b1d6;
    font-size: 12px;
  }
  
  .user-create-form .form-row,
  .role-form .form-row,
  .invite-form .form-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .user-create-form select,
  .invite-form select {
    padding: 8px 12px;
    background: #1a1b26;
    border: 1px solid #3b4261;
    border-radius: 4px;
    color: #c0caf5;
    font-family: inherit;
    font-size: 12px;
    min-width: 120px;
  }
  
  .user-create-form input[type="number"] {
    width: 100px;
  }
  
  .role-form input {
    padding: 8px 12px;
    background: #1a1b26;
    border: 1px solid #3b4261;
    border-radius: 4px;
    color: #c0caf5;
    font-family: inherit;
    font-size: 12px;
    flex: 1;
  }
  
  .permissions-row {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .permissions-row label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #a9b1d6;
    font-size: 12px;
  }
  
  .management-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  
  .management-table th,
  .management-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #3b4261;
  }
  
  .management-table th {
    color: #7aa2f7;
    font-weight: normal;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
  }
  
  .management-table tr.inactive {
    opacity: 0.5;
  }
  
  .status-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 10px;
    background: rgba(247, 118, 142, 0.2);
    color: #f7768e;
  }
  
  .status-badge.active {
    background: rgba(158, 206, 106, 0.2);
    color: #9ece6a;
  }
  
  .role-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 10px;
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }
  
  .company-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 10px;
    background: rgba(224, 175, 104, 0.2);
    color: #e0af68;
  }
  
  .entity-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 10px;
    background: rgba(187, 154, 247, 0.2);
    color: #bb9af7;
    text-transform: capitalize;
  }
  
  .btn-small {
    padding: 4px 10px;
    background: #3b4261;
    border: none;
    border-radius: 3px;
    color: #c0caf5;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  
  .btn-small:hover {
    background: #414868;
  }
  
  .btn-small.danger {
    background: rgba(247, 118, 142, 0.2);
    color: #f7768e;
  }
  
  .btn-small.copy-btn,
  .btn-small.edit-btn {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }
  
  .management-table tr.editing {
    background: rgba(122, 162, 247, 0.1);
  }
  
  .activity-log-container {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .activity-table .time-col {
    white-space: nowrap;
    font-size: 11px;
    color: #565f89;
  }
  
  .activity-table .details-col {
    max-width: 200px;
  }
  
  .details-text {
    font-size: 11px;
    color: #a9b1d6;
    cursor: help;
  }
  
  .action-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 10px;
    text-transform: uppercase;
    background: rgba(86, 95, 137, 0.3);
    color: #a9b1d6;
  }
  
  .action-badge.create {
    background: rgba(158, 206, 106, 0.2);
    color: #9ece6a;
  }
  
  .action-badge.update {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }
  
  .action-badge.delete {
    background: rgba(247, 118, 142, 0.2);
    color: #f7768e;
  }
  
  .section-desc {
    color: #565f89;
    font-size: 12px;
    margin: 0 0 12px 0;
  }
  
  .edit-user-section {
    background: rgba(122, 162, 247, 0.05);
    padding: 16px;
    border-radius: 6px;
    border: 1px solid rgba(122, 162, 247, 0.2);
  }
  
  .btn-primary {
    padding: 8px 16px;
    background: #7aa2f7;
    color: #1a1b26;
    border: none;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  
  .btn-primary:hover {
    background: #89b4fa;
  }
  
  .loading-state, .empty-state {
    color: #565f89;
    text-align: center;
    padding: 24px;
  }
  
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #1a1b26;
    color: #a9b1d6;
    font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    font-size: 13px;
    overflow: hidden;
  }
  
  .header {
    padding: 12px 16px;
    border-bottom: 1px solid #3b4261;
    display: flex;
    gap: 16px;
    align-items: center;
  }
  
  .title {
    color: #7dcfff;
    font-weight: bold;
    font-size: 15px;
  }
  
  .subtitle {
    color: #565f89;
    font-size: 12px;
  }
  
  .main {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }
  
  .tree-panel {
    width: 350px;
    border-right: 1px solid #3b4261;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  
  .table-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  
  .table-panel-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }
  
  .table-panel-scroll::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }
  
  .hierarchy-path {
    padding: 8px 12px;
    background: #1a1b26;
    border-bottom: 1px solid #3b4261;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 11px;
  }
  
  .path-label {
    color: #565f89;
  }
  
  .path-sep {
    color: #3b4261;
  }
  
  .path-item {
    font-size: 11px;
  }
  
  .properties-section {
    border-bottom: 1px solid #3b4261;
    flex-shrink: 0;
  }
  
  .properties-grid {
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: #16161e;
    max-height: 250px;
    overflow-y: auto;
  }
  
  .property-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .property-label {
    color: #7aa2f7;
    width: 110px;
    flex-shrink: 0;
    font-size: 11px;
    white-space: nowrap;
  }
  
  .property-value {
    color: #9ece6a;
    flex: 1;
    min-width: 100px;
  }
  
  .property-row .btn-edit {
    margin-left: auto;
  }
  
  .property-input {
    flex: 1;
    background: #1a1b26;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 12px;
    border-radius: 3px;
  }
  
  .panel-header {
    padding: 8px 12px;
    color: #bb9af7;
    border-bottom: 1px solid #3b4261;
    background: #16161e;
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .panel-header.tree-header {
    flex-shrink: 0;
  }
  
  .tree-toggle-btn {
    display: none;
  }
  
  .add-company-btn {
    padding: 4px 10px;
    background: #9ece6a;
    color: #1a1b26;
    border: none;
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .add-company-btn:hover {
    background: #a9d574;
  }
  
  .empty-tree {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: #565f89;
  }
  
  .empty-tree p {
    margin: 0 0 16px 0;
    font-size: 14px;
  }
  
  .empty-tree .btn-primary {
    padding: 10px 20px;
  }
  
  .new-company-modal {
    width: 400px;
  }
  
  .new-company-modal .form-group {
    margin-bottom: 16px;
  }
  
  .new-company-modal .form-group label {
    display: block;
    color: #7aa2f7;
    font-size: 12px;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .new-company-modal .form-group input {
    width: 100%;
    padding: 10px 12px;
    background: #1a1b26;
    border: 1px solid #3b4261;
    border-radius: 4px;
    color: #c0caf5;
    font-family: inherit;
    font-size: 13px;
    box-sizing: border-box;
  }
  
  .new-company-modal .form-group input:focus {
    outline: none;
    border-color: #7aa2f7;
  }
  
  .form-hint {
    color: #565f89;
    font-size: 12px;
    margin: 0;
    padding: 8px 0;
  }
  
  .panel-header.collapsible {
    cursor: pointer;
    user-select: none;
  }
  
  .panel-header.collapsible:hover {
    background: #1f2335;
  }
  
  .add-btn {
    background: #1a1b26;
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 4px 12px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
  }
  
  .add-btn:hover:not(:disabled) {
    background: #9ece6a;
    color: #1a1b26;
  }
  
  .add-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  
  .tree-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }
  
  .tree-row {
    display: flex;
    align-items: center;
    padding: 2px 8px;
    white-space: nowrap;
  }
  
  .tree-row.selected {
    background: #283457;
  }
  
  .tree-prefix {
    color: #3b4261;
  }
  
  .tree-expand {
    background: none;
    border: none;
    color: #565f89;
    width: 16px;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
  }
  
  .tree-expand:disabled {
    cursor: default;
  }
  
  .tree-label {
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    padding: 2px 4px;
    text-align: left;
  }
  
  .tree-label:hover {
    text-decoration: underline;
  }
  
  .table-content {
    padding: 8px;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  
  .table-scroll-wrapper {
    flex: 1;
    overflow: auto;
    position: relative;
    min-height: 0;
    max-height: calc(100vh - 300px);
  }
  
  .loading-msg, .empty-msg {
    color: #565f89;
    padding: 20px;
    text-align: center;
  }
  
  table.data-table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  
  th {
    text-align: left;
    padding: 8px 12px;
    color: #7aa2f7;
    border-bottom: 1px solid #3b4261;
    font-weight: normal;
    font-size: 11px;
    text-transform: uppercase;
    white-space: nowrap;
    position: sticky;
    top: 0;
    background: #1a1b26;
    z-index: 2;
  }
  
  thead tr {
    background: #1a1b26;
  }
  
  thead {
    position: sticky;
    top: 0;
    z-index: 3;
    background: #1a1b26;
  }
  
  th.sortable {
    cursor: pointer;
    user-select: none;
  }
  
  th.sortable:hover {
    color: #bb9af7;
    background: #1f2335;
  }
  
  .th-content {
    display: inline-block;
    padding-right: 8px;
  }
  
  .resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    cursor: col-resize;
    background: transparent;
    z-index: 1;
  }
  
  .resize-handle:hover {
    background: #7aa2f7;
  }
  
  /* Sticky columns */
  .th-sticky-left, .td-sticky-left {
    position: sticky;
    left: 0;
    z-index: 2;
    background: #1a1b26;
  }
  
  .th-sticky-right, .td-sticky-right {
    position: sticky;
    right: 0;
    z-index: 2;
    background: #1a1b26;
    box-shadow: -2px 0 4px rgba(0,0,0,0.3);
  }
  
  td {
    padding: 6px 12px;
    border-bottom: 1px solid #24283b;
    white-space: nowrap;
    background: #1a1b26;
  }
  
  tr:hover td {
    background: #1f2335;
  }
  
  .th-id { width: 50px; }
  .th-name { width: 100px; }
  .th-num { width: 70px; }
  .th-street { width: 120px; }
  .th-detail { flex: 1; }
  .th-actions { width: 100px; }
  
  .id-col { color: #565f89; width: 50px; }
  .name-col { color: #9ece6a; }
  .num-col { color: #7dcfff; text-align: right; width: 70px; }
  .street-col { color: #bb9af7; width: 120px; }
  .detail-col { color: #a9b1d6; }
  .actions-col { width: 100px; }
  
  .summary-section {
    border-bottom: 1px solid #3b4261;
    background: #16161e;
  }
  
  .summary-tree {
    padding: 2px 0 6px 20px;
    font-size: 12px;
    line-height: 1.5;
  }
  
  .summary-row {
    display: flex;
    align-items: center;
  }
  
  .tree-prefix {
    color: #565f89;
    margin-right: 4px;
  }
  
  .sum-label {
    color: #565f89;
    display: inline-block;
    width: 60px;
  }
  
  .sum-arrow {
    color: #565f89;
    margin: 0 4px;
  }
  
  .sum-val.cyan { color: #7dcfff; }
  .sum-val.yellow { color: #e0af68; }
  .sum-val.green { color: #9ece6a; }
  .sum-val.magenta { color: #bb9af7; }
  .sum-val.dim { color: #565f89; }
  
  .sum-unit {
    color: #565f89;
    margin-left: 2px;
  }
  
  .sum-sep {
    color: #3b4261;
    margin: 0 6px;
  }
  
  .sum-col1 {
    display: inline-block;
    min-width: 120px;
  }
  
  .sum-label2 {
    display: inline-block;
    width: 55px;
  }
  
  tr.editing td, tr.adding-row td {
    background: #1f2335;
  }
  
  input[type="text"] {
    background: #16161e;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 12px;
    width: 100%;
    box-sizing: border-box;
    border-radius: 3px;
  }
  
  input[type="text"]:focus {
    outline: none;
    border-color: #7aa2f7;
  }
  
  .btn-edit, .btn-delete, .btn-save, .btn-cancel {
    background: none;
    border: 1px solid;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
    margin-right: 4px;
  }
  
  .btn-edit {
    color: #7aa2f7;
    border-color: #7aa2f7;
  }
  
  .btn-edit:hover {
    background: #7aa2f7;
    color: #1a1b26;
  }
  
  .btn-delete {
    color: #f7768e;
    border-color: #f7768e;
  }
  
  .btn-delete:hover {
    background: #f7768e;
    color: #1a1b26;
  }
  
  .view-only-badge {
    font-size: 10px;
    color: #565f89;
    font-style: italic;
  }
  
  .btn-save {
    color: #9ece6a;
    border-color: #9ece6a;
  }
  
  .btn-save:hover {
    background: #9ece6a;
    color: #1a1b26;
  }
  
  .btn-cancel {
    color: #e0af68;
    border-color: #e0af68;
  }
  
  .btn-cancel:hover {
    background: #e0af68;
    color: #1a1b26;
  }
  
  .log-panel {
    height: 100px;
    min-height: 100px;
    flex-shrink: 0;
    border-top: 1px solid #3b4261;
    background: #16161e;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
  }
  
  .log-header {
    color: #bb9af7;
    font-size: 11px;
  }
  
  .extraction-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  
  .progress-bar {
    flex: 1;
    height: 8px;
    background: #3b4261;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7aa2f7, #bb9af7);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  
  .progress-text {
    font-size: 10px;
    color: #a9b1d6;
    min-width: 180px;
  }
  
  .log-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 11px;
  }
  
  .log-success { color: #9ece6a; }
  .log-error { color: #f7768e; }
  .log-loading { color: #e0af68; }
  .log-info { color: #7dcfff; }
  
  .documents-section {
    border-bottom: 1px solid #3b4261;
  }
  
  .documents-content {
    padding: 8px 12px;
    background: #16161e;
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
    background: #1a1b26;
    border: 1px solid #414868;
    color: #c0caf5;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  
  .doc-type-selector:hover {
    border-color: #7aa2f7;
  }
  
  .doc-type-badge {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 4px;
  }
  
  .doc-type-badge.permit_plan {
    background: rgba(158, 206, 106, 0.2);
    color: #9ece6a;
  }
  
  .doc-type-badge.plan_subdivision {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }
  
  .doc-type-badge.other {
    background: rgba(86, 95, 137, 0.2);
    color: #565f89;
  }
  
  .upload-label {
    display: inline-block;
    padding: 6px 12px;
    background: #1a1b26;
    border: 1px dashed #3b4261;
    color: #7aa2f7;
    cursor: pointer;
    font-size: 11px;
    border-radius: 3px;
  }
  
  .upload-label:hover {
    border-color: #7aa2f7;
    background: #1f2335;
  }
  
  .doc-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .doc-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: #1a1b26;
    border-radius: 3px;
  }
  
  .doc-name {
    flex: 1;
    color: #9ece6a;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    padding: 0;
  }
  
  .doc-name:hover {
    color: #7dcfff;
    text-decoration: underline;
  }
  
  .preview-modal {
    max-width: 90vw;
    max-height: 90vh;
    width: auto;
  }
  
  .preview-body {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    background: #16161e;
  }
  
  .preview-image {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
  }
  
  .preview-pdf {
    width: 100%;
    height: 70vh;
    border: none;
  }
  
  .preview-unsupported {
    color: #565f89;
    padding: 40px;
  }
  
  .btn-download {
    background: none;
    border: 1px solid #7aa2f7;
    color: #7aa2f7;
    padding: 4px 12px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
    text-decoration: none;
  }
  
  .btn-download:hover {
    background: #7aa2f7;
    color: #1a1b26;
  }
  
  .doc-size {
    color: #565f89;
    font-size: 10px;
  }
  
  .btn-extract {
    background: none;
    border: 1px solid #bb9af7;
    color: #bb9af7;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
  }
  
  .btn-extract:hover:not(:disabled) {
    background: #bb9af7;
    color: #1a1b26;
  }
  
  .btn-extract:disabled {
    opacity: 0.5;
  }
  
  .btn-reanalyze {
    background: none;
    border: 1px solid #e0af68;
    color: #e0af68;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
  }
  
  .btn-reanalyze:hover:not(:disabled) {
    background: #e0af68;
    color: #1a1b26;
  }
  
  .btn-reanalyze:disabled {
    opacity: 0.5;
  }
  
  .btn-permit {
    background: none;
    border: 1px solid #7dcfff;
    color: #7dcfff;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
  }
  
  .btn-permit:hover:not(:disabled) {
    background: #7dcfff;
    color: #1a1b26;
  }
  
  .btn-permit:disabled {
    opacity: 0.5;
  }
  
  .btn-view-inline {
    background: none;
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
  }
  
  .btn-view-inline:hover {
    background: #9ece6a;
    color: #1a1b26;
  }
  
  /* Inline document viewer */
  .inline-viewer-section {
    border: 1px solid #3b4261;
    border-radius: 4px;
    margin-bottom: 8px;
    overflow: hidden;
  }
  
  .inline-viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: #16161e;
    border-bottom: 1px solid #3b4261;
    color: #7dcfff;
    font-size: 11px;
  }
  
  .inline-viewer-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .zoom-btn {
    background: #1a1b26;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
  }
  
  .zoom-btn:hover {
    background: #3b4261;
  }
  
  .zoom-level {
    color: #9ece6a;
    font-size: 10px;
    min-width: 40px;
    text-align: center;
  }
  
  .height-slider {
    width: 60px;
    height: 4px;
    cursor: pointer;
  }
  
  .btn-close-inline {
    background: none;
    border: 1px solid #f7768e;
    color: #f7768e;
    padding: 2px 6px;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
  }
  
  .btn-close-inline:hover {
    background: #f7768e;
    color: #1a1b26;
  }
  
  .inline-viewer-container {
    overflow: auto;
    background: #16161e;
  }
  
  .inline-viewer-pdf {
    width: 100%;
    height: 100%;
    border: none;
  }
  
  .inline-viewer-scroll {
    min-width: 100%;
    min-height: 100%;
  }
  
  .inline-viewer-image {
    display: block;
    max-width: none;
  }
  
  /* Bulk edit bar */
  .bulk-edit-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(122, 162, 247, 0.1);
    border: 1px solid #7aa2f7;
    border-radius: 4px;
    margin-bottom: 8px;
  }
  
  .bulk-selected {
    color: #7aa2f7;
    font-weight: bold;
    font-size: 11px;
  }
  
  .bulk-field-select, .bulk-value-input {
    background: #1a1b26;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 11px;
    border-radius: 3px;
  }
  
  .bulk-value-input {
    flex: 1;
    max-width: 200px;
  }
  
  .btn-bulk-apply {
    background: #7aa2f7;
    border: none;
    color: #1a1b26;
    padding: 4px 12px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
    font-weight: bold;
  }
  
  .btn-bulk-apply:hover:not(:disabled) {
    background: #9db5f8;
  }
  
  .btn-bulk-apply:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-bulk-clear {
    background: none;
    border: 1px solid #565f89;
    color: #565f89;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
  }
  
  .btn-bulk-clear:hover {
    border-color: #c0caf5;
    color: #c0caf5;
  }
  
  /* Checkbox column */
  .th-checkbox, .checkbox-col {
    width: 30px;
    text-align: center;
  }
  
  /* Terminal-themed checkboxes */
  .th-checkbox input[type="checkbox"],
  .checkbox-col input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    vertical-align: middle;
  }
  
  .th-checkbox input[type="checkbox"]::before,
  .checkbox-col input[type="checkbox"]::before {
    content: '[ ]';
    font-family: monospace;
    font-size: 12px;
    color: #565f89;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  
  .th-checkbox input[type="checkbox"]:checked::before,
  .checkbox-col input[type="checkbox"]:checked::before {
    content: '[×]';
    color: #7aa2f7;
  }
  
  .th-checkbox input[type="checkbox"]:hover::before,
  .checkbox-col input[type="checkbox"]:hover::before {
    color: #7dcfff;
  }
  
  .row-selected {
    background: rgba(122, 162, 247, 0.15) !important;
  }
  
  .row-selected:hover {
    background: rgba(122, 162, 247, 0.25) !important;
  }
  
  .stage-section {
    margin-bottom: 16px;
    border: 1px solid #3b4261;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .stage-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #16161e;
    border-bottom: 1px solid #3b4261;
  }
  
  .stage-name {
    color: #9ece6a;
    font-weight: bold;
  }
  
  .stage-lot-count {
    color: #565f89;
    font-size: 11px;
  }
  
  .stage-lots {
    margin: 0;
  }
  
  .stage-lots th, .stage-lots td {
    padding: 4px 8px;
    font-size: 11px;
  }
  
  .more-lots {
    color: #565f89;
    font-style: italic;
    text-align: center;
  }
  
  /* Extraction Hints */
  .extraction-hints-section {
    margin: 8px 0;
    padding: 0;
  }
  
  .hints-toggle {
    background: #24283b;
    border: 1px dashed #565f89;
    color: #a9b1d6;
    padding: 6px 12px;
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
    width: 100%;
    text-align: left;
  }
  
  .hints-toggle:hover {
    border-color: #7aa2f7;
    color: #c0caf5;
  }
  
  .hints-input-wrapper {
    margin-top: 8px;
    background: #1f2335;
    border: 1px solid #3b4261;
    border-radius: 4px;
    padding: 8px;
  }
  
  .hints-textarea {
    width: 100%;
    background: #24283b;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 8px;
    font-family: inherit;
    font-size: 11px;
    border-radius: 4px;
    resize: vertical;
    min-height: 60px;
  }
  
  .hints-textarea::placeholder {
    color: #565f89;
  }
  
  .hints-textarea:focus {
    outline: none;
    border-color: #7aa2f7;
  }
  
  .hints-help {
    margin-top: 6px;
  }
  
  .hint-example {
    color: #565f89;
    font-size: 10px;
    font-style: italic;
  }
  
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal {
    background: #1a1b26;
    border: 1px solid #3b4261;
    border-radius: 8px;
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    padding: 12px 16px;
    border-bottom: 1px solid #3b4261;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #7dcfff;
    font-weight: bold;
  }
  
  .modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }
  
  .modal-footer {
    padding: 12px 16px;
    border-top: 1px solid #3b4261;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  
  .extraction-summary {
    padding: 8px 12px;
    background: #16161e;
    border-radius: 4px;
    margin-bottom: 12px;
    color: #a9b1d6;
    font-size: 12px;
  }
  
  .extraction-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .extraction-table th,
  .extraction-table td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid #3b4261;
    font-size: 12px;
  }
  
  .extraction-table th {
    color: #7aa2f7;
    background: #16161e;
  }
  
  .extraction-table td {
    color: #9ece6a;
  }
  
  .extraction-stats {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: #16161e;
    border-radius: 4px;
  }
  
  .stat-update { color: #e0af68; }
  .stat-create { color: #9ece6a; }
  
  .action-select {
    background: #1a1b26;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 11px;
    border-radius: 3px;
    cursor: pointer;
  }
  
  .action-col { width: 100px; }
  
  .row-update { background: rgba(224, 175, 104, 0.1); }
  .row-create { background: rgba(158, 206, 106, 0.1); }
  .row-skip { opacity: 0.5; }
  
  .compare-cell {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .old-val {
    color: #565f89;
    text-decoration: line-through;
    font-size: 10px;
  }
  
  .arrow {
    color: #7aa2f7;
    font-size: 10px;
  }
  
  .new-val {
    color: #9ece6a;
  }
  
  .status-changed {
    color: #e0af68;
    font-size: 10px;
    padding: 2px 6px;
    background: rgba(224, 175, 104, 0.2);
    border-radius: 3px;
  }
  
  .status-same {
    color: #565f89;
    font-size: 10px;
  }
  
  .status-new {
    color: #9ece6a;
    font-size: 10px;
    padding: 2px 6px;
    background: rgba(158, 206, 106, 0.2);
    border-radius: 3px;
  }
  
  /* PDF Page Controls */
  .page-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-right: 8px;
  }
  
  .page-btn {
    background: #1a1b26;
    border: 1px solid #3b4261;
    color: #7aa2f7;
    padding: 2px 6px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 10px;
  }
  
  .page-btn:hover {
    background: #3b4261;
  }
  
  .page-indicator {
    color: #a9b1d6;
    font-size: 11px;
    min-width: 50px;
    text-align: center;
  }
  
  .btn-analyze-page {
    background: #2d4f2d;
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 3px 10px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
    margin-right: 8px;
  }
  
  .btn-analyze-page:hover:not(:disabled) {
    background: #9ece6a;
    color: #1a1b26;
  }
  
  .btn-analyze-page:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .model-selector {
    background: #1a1b26;
    border: 1px solid #414868;
    color: #c0caf5;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    margin-right: 4px;
  }
  
  .model-selector:hover {
    border-color: #7aa2f7;
  }
  
  .model-selector:focus {
    outline: none;
    border-color: #7aa2f7;
    box-shadow: 0 0 0 2px rgba(122, 162, 247, 0.2);
  }
  
  .model-selector-small {
    background: #1a1b26;
    border: 1px solid #414868;
    color: #c0caf5;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 10px;
    cursor: pointer;
  }
  
  .model-selector-small:hover {
    border-color: #7aa2f7;
  }
  
  .btn-crossref {
    background: #2d3a4f;
    border: 1px solid #7dcfff;
    color: #7dcfff;
    padding: 2px 6px;
    font-size: 10px;
    cursor: pointer;
    border-radius: 3px;
  }
  
  .btn-crossref:hover:not(:disabled) {
    background: #7dcfff;
    color: #1a1b26;
  }
  
  .btn-crossref:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-capture {
    background: #2d3a4f;
    border: 1px solid #7aa2f7;
    color: #7aa2f7;
    padding: 3px 10px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
  }
  
  .btn-capture:hover:not(:disabled) {
    background: #7aa2f7;
    color: #1a1b26;
  }
  
  .btn-capture:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .capture-indicator {
    color: #9ece6a;
    font-size: 12px;
    margin-left: -4px;
  }
  
  .btn-clear-capture {
    background: none;
    border: 1px solid #f7768e;
    color: #f7768e;
    padding: 1px 5px;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
    margin-left: -4px;
  }
  
  .btn-clear-capture:hover {
    background: #f7768e;
    color: #1a1b26;
  }
  
  /* Pre-Extraction Modal */
  .pre-extraction-modal {
    max-width: 600px;
  }
  
  .pre-extraction-info p {
    margin: 0 0 16px;
    color: #a9b1d6;
    line-height: 1.5;
  }
  
  .pre-extraction-info p strong {
    color: #e0af68;
  }
  
  .hints-examples {
    background: #1f2335;
    border: 1px solid #3b4261;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  
  .hints-examples h4 {
    margin: 0 0 10px;
    color: #7aa2f7;
    font-size: 13px;
  }
  
  .hints-examples ul {
    margin: 0;
    padding-left: 20px;
    color: #a9b1d6;
    font-size: 12px;
  }
  
  .hints-examples li {
    margin-bottom: 6px;
  }
  
  .hints-examples li strong {
    color: #9ece6a;
  }
  
  .hints-textarea-large {
    width: 100%;
    background: #24283b;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 12px;
    font-family: inherit;
    font-size: 12px;
    border-radius: 6px;
    resize: vertical;
    min-height: 120px;
  }
  
  .hints-textarea-large::placeholder {
    color: #565f89;
  }
  
  .hints-textarea-large:focus {
    outline: none;
    border-color: #7aa2f7;
    box-shadow: 0 0 0 2px rgba(122, 162, 247, 0.2);
  }
  
  .model-selection {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #3b4261;
  }
  
  .model-selection label {
    color: #a9b1d6;
    font-size: 12px;
  }
  
  .model-selection select {
    background: #24283b;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }
  
  .model-selection select:hover {
    border-color: #7aa2f7;
  }
  
  .btn-secondary {
    background: #24283b;
    border: 1px solid #565f89;
    color: #a9b1d6;
    padding: 8px 16px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
  }
  
  .btn-secondary:hover {
    background: #3b4261;
    color: #c0caf5;
  }
  
  /* Continue Extraction Modal */
  .continue-modal {
    max-width: 450px;
  }
  
  .continue-info p {
    margin: 0 0 12px;
    color: #a9b1d6;
  }
  
  .continue-details {
    background: #24283b;
    padding: 12px;
    border-radius: 4px;
    margin: 12px 0;
  }
  
  .continue-details .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #3b4261;
  }
  
  .continue-details .detail-row:last-child {
    border-bottom: none;
  }
  
  .continue-details .label {
    color: #7dcfff;
  }
  
  .continue-details .value {
    color: #9ece6a;
    font-weight: bold;
  }
  
  .continue-note {
    color: #e0af68;
    font-style: italic;
  }
  
  /* POS Analysis Button */
  .btn-pos-analyze {
    background: #2d4f3d;
    border: 1px solid #73daca;
    color: #73daca;
    padding: 2px 6px;
    font-size: 10px;
    cursor: pointer;
    border-radius: 3px;
  }
  
  .btn-pos-analyze:hover:not(:disabled) {
    background: #73daca;
    color: #1a1b26;
  }
  
  .btn-pos-analyze:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* POS Analysis Modal */
  .pos-analysis-modal {
    max-width: 900px;
    width: 90%;
    max-height: 85vh;
  }
  
  .pos-analysis-modal .modal-body {
    max-height: 70vh;
    overflow-y: auto;
  }
  
  .pos-summary {
    display: flex;
    gap: 16px;
    padding: 16px;
    background: #24283b;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  
  .summary-stat {
    flex: 1;
    text-align: center;
    padding: 12px;
    background: #1a1b26;
    border-radius: 6px;
    border: 1px solid #3b4261;
  }
  
  .summary-stat.match {
    border-color: #9ece6a;
  }
  
  .summary-stat.variance {
    border-color: #e0af68;
  }
  
  .summary-stat.easement {
    border-color: #7dcfff;
  }
  
  .stat-value {
    display: block;
    font-size: 24px;
    font-weight: bold;
    color: #c0caf5;
  }
  
  .summary-stat.match .stat-value { color: #9ece6a; }
  .summary-stat.variance .stat-value { color: #e0af68; }
  .summary-stat.easement .stat-value { color: #7dcfff; }
  
  .stat-label {
    display: block;
    font-size: 11px;
    color: #565f89;
    text-transform: uppercase;
    margin-top: 4px;
  }
  
  .pos-filter-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    border-bottom: 1px solid #3b4261;
    padding-bottom: 8px;
  }
  
  .pos-filter-tabs button {
    background: none;
    border: 1px solid transparent;
    color: #565f89;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px 4px 0 0;
  }
  
  .pos-filter-tabs button:hover {
    color: #a9b1d6;
  }
  
  .pos-filter-tabs button.active {
    color: #7aa2f7;
    border-color: #3b4261;
    border-bottom-color: #1a1b26;
    background: #1a1b26;
  }
  
  .pos-comparisons {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .pos-lot-card {
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .pos-lot-card.match { border-left: 3px solid #9ece6a; }
  .pos-lot-card.variance { border-left: 3px solid #e0af68; }
  .pos-lot-card.new_data { border-left: 3px solid #7dcfff; }
  
  .lot-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    background: #1f2335;
  }
  
  .lot-card-header:hover {
    background: #292e42;
  }
  
  .lot-number {
    font-weight: bold;
    color: #c0caf5;
    font-size: 14px;
  }
  
  .lot-status-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    background: #3b4261;
  }
  
  .lot-status-badge.match { background: rgba(158, 206, 106, 0.2); color: #9ece6a; }
  .lot-status-badge.variance { background: rgba(224, 175, 104, 0.2); color: #e0af68; }
  .lot-status-badge.new_data { background: rgba(125, 207, 255, 0.2); color: #7dcfff; }
  
  .easement-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(125, 207, 255, 0.15);
    color: #7dcfff;
    margin-left: auto;
  }
  
  .expand-icon {
    color: #565f89;
    font-size: 10px;
  }
  
  .lot-card-body {
    padding: 16px;
    border-top: 1px solid #3b4261;
  }
  
  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  
  .comparison-table th {
    text-align: left;
    padding: 8px;
    color: #565f89;
    font-size: 11px;
    text-transform: uppercase;
    border-bottom: 1px solid #3b4261;
  }
  
  .comparison-table td {
    padding: 8px;
    color: #a9b1d6;
    font-size: 13px;
    border-bottom: 1px solid #24283b;
  }
  
  .comparison-table tr.has-variance td {
    background: rgba(224, 175, 104, 0.1);
  }
  
  .diff-cell .diff-value {
    color: #e0af68;
    font-weight: bold;
  }
  
  .btn-apply-small {
    background: #2d4f2d;
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
    border-radius: 3px;
  }
  
  .btn-apply-small:hover {
    background: #9ece6a;
    color: #1a1b26;
  }
  
  .easements-section, .encumbrances-section, .restrictions-section {
    margin-top: 16px;
    padding: 12px;
    background: #1a1b26;
    border-radius: 6px;
  }
  
  .easements-section h5, .encumbrances-section h5, .restrictions-section h5 {
    margin: 0 0 10px;
    color: #7dcfff;
    font-size: 12px;
  }
  
  .easements-list, .encumbrances-list, .restrictions-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .easement-item, .encumbrance-item, .restriction-item {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
    background: #24283b;
    border-radius: 4px;
    font-size: 12px;
  }
  
  .easement-id {
    background: #7dcfff;
    color: #1a1b26;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: bold;
  }
  
  .easement-type {
    color: #bb9af7;
  }
  
  .easement-width {
    color: #9ece6a;
  }
  
  .easement-purpose {
    color: #a9b1d6;
  }
  
  .easement-beneficiary {
    color: #e0af68;
  }
  
  .enc-type, .rest-type {
    color: #f7768e;
    font-weight: bold;
  }
  
  .enc-desc, .rest-desc {
    color: #a9b1d6;
    flex: 1;
  }
  
  .general-easements-section {
    margin-top: 20px;
    padding: 16px;
    background: #1f2335;
    border-radius: 8px;
    border: 1px solid #3b4261;
  }
  
  .general-easements-section h4 {
    margin: 0 0 12px;
    color: #7dcfff;
    font-size: 14px;
  }
  
  .general-easements-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .general-easement-item {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px;
    background: #24283b;
    border-radius: 4px;
    align-items: center;
  }
  
  .ge-id {
    background: #7dcfff;
    color: #1a1b26;
    padding: 2px 8px;
    border-radius: 3px;
    font-weight: bold;
    font-size: 12px;
  }
  
  .ge-type {
    color: #bb9af7;
    font-size: 12px;
  }
  
  .ge-width {
    color: #9ece6a;
    font-size: 12px;
  }
  
  .ge-lots {
    color: #a9b1d6;
    font-size: 11px;
    margin-left: auto;
  }
  
  /* Fields Manager Modal */
  .fields-modal {
    max-width: 500px;
  }
  
  .fields-section {
    margin-bottom: 20px;
  }
  
  .fields-section h4 {
    color: #bb9af7;
    margin: 0 0 10px;
    font-size: 12px;
  }
  
  .add-field-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .add-field-row input {
    flex: 1;
    padding: 6px 8px;
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 4px;
    color: #a9b1d6;
    font-size: 12px;
  }
  
  .add-field-row select {
    padding: 6px 8px;
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 4px;
    color: #a9b1d6;
    font-size: 12px;
  }
  
  .field-note {
    font-size: 10px;
    color: #565f89;
    margin-top: 6px;
    font-style: italic;
  }
  
  .empty-fields {
    color: #565f89;
    font-style: italic;
    font-size: 11px;
  }
  
  .fields-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .field-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #24283b;
    border-radius: 4px;
  }
  
  .field-item .field-label {
    flex: 1;
    color: #a9b1d6;
  }
  
  .field-item .field-type {
    color: #565f89;
    font-size: 10px;
  }
  
  .field-actions {
    display: flex;
    gap: 4px;
  }
  
  .btn-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
  }
  
  .btn-toggle.hidden {
    opacity: 0.5;
  }
  
  .btn-fields-mgr {
    background: none;
    border: none;
    color: #7dcfff;
    cursor: pointer;
    font-size: 12px;
    margin-left: 6px;
    padding: 0 4px;
  }
  
  .btn-fields-mgr:hover {
    color: #bb9af7;
  }
  
  .th-custom {
    min-width: 80px;
    max-width: 120px;
    color: #bb9af7;
  }
  
  .custom-col {
    min-width: 80px;
    max-width: 120px;
  }
  
  /* Status Pills */
  .status-pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .status-select {
    background: #1a1b26;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    width: 100%;
    cursor: pointer;
  }
  
  .status-select:focus {
    outline: none;
    border-color: #7aa2f7;
  }
  
  .no-status {
    color: #565f89;
  }
  
  .th-status {
    min-width: 100px;
  }
  
  .status-col {
    min-width: 100px;
  }
  
  /* Date Picker */
  .date-input {
    background: #1a1b26;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: inherit;
    width: 100%;
  }
  
  .date-input:focus {
    outline: none;
    border-color: #7aa2f7;
  }
  
  .date-input::-webkit-calendar-picker-indicator {
    filter: invert(0.8);
    cursor: pointer;
  }
  
  .th-date {
    min-width: 100px;
  }
  
  .date-col {
    min-width: 100px;
  }
  
  /* Number Input with Presets */
  .number-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .number-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  
  .preset-btn {
    background: #24283b;
    border: 1px solid #3b4261;
    color: #7dcfff;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9px;
    cursor: pointer;
    font-family: inherit;
  }
  
  .preset-btn:hover {
    background: #7dcfff;
    color: #1a1b26;
  }
  
  .th-num {
    text-align: right;
    min-width: 80px;
  }
  
  .num-col {
    text-align: right;
  }
  
  /* Field Manager Enhancements */
  .field-hint {
    font-size: 10px;
    color: #565f89;
    font-weight: normal;
    font-style: italic;
  }
  
  .drag-handle {
    cursor: grab;
    color: #565f89;
    font-size: 12px;
    user-select: none;
  }
  
  .drag-handle:active {
    cursor: grabbing;
  }
  
  .field-item {
    cursor: default;
    transition: background 0.15s, opacity 0.15s;
  }
  
  .field-item.field-hidden {
    opacity: 0.5;
    background: #1a1b26;
  }
  
  .field-item.field-dragging {
    opacity: 0.5;
    background: #3b4261;
  }
  
  .default-badge {
    background: #3b4261;
    color: #7aa2f7;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9px;
    margin-left: 4px;
  }
  
  .format-select {
    background: #24283b;
    border: 1px solid #3b4261;
    color: #a9b1d6;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 12px;
  }
  
  /* Dynamic Field Columns */
  .th-field {
    min-width: 80px;
    cursor: pointer;
    user-select: none;
  }
  
  .th-field:hover {
    color: #bb9af7;
    background: #1f2335;
  }
  
  .field-col {
    min-width: 80px;
  }
  
  .field-col input {
    width: 100%;
    padding: 3px 6px;
    background: #16161e;
    border: 1px solid #3b4261;
    color: #c0caf5;
    font-family: inherit;
    font-size: 12px;
    border-radius: 3px;
  }
  
  .field-col input:focus {
    outline: none;
    border-color: #7aa2f7;
  }
  
  /* Original continue-note styling below */
  .continue-note-original {
    color: #e0af68;
    font-style: italic;
  }
  
  /* Verification Modal */
  .verification-modal {
    max-width: 700px;
  }
  
  .verification-summary {
    background: #24283b;
    padding: 10px 12px;
    border-radius: 4px;
    margin-bottom: 16px;
    color: #7dcfff;
    font-size: 12px;
  }
  
  .verification-modal h4 {
    color: #bb9af7;
    margin: 16px 0 8px;
    font-size: 12px;
  }
  
  .current-val {
    color: #f7768e;
    text-decoration: line-through;
  }
  
  .btn-apply-one {
    background: none;
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    border-radius: 2px;
  }
  
  .btn-apply-one:hover {
    background: #9ece6a;
    color: #1a1b26;
  }
  
  .error-msg {
    color: #f7768e;
    background: rgba(247, 118, 142, 0.1);
    padding: 10px;
    border-radius: 4px;
    margin-top: 12px;
  }
  
  /* Calibration Modal */
  .calibration-modal {
    max-width: 800px;
  }
  
  .calibration-instructions {
    background: #24283b;
    padding: 12px 16px;
    border-radius: 6px;
    margin-bottom: 16px;
    border-left: 3px solid #7aa2f7;
  }
  
  .calibration-instructions p {
    margin: 0 0 6px 0;
    color: #a9b1d6;
    font-size: 12px;
  }
  
  .calibration-hint {
    color: #7dcfff !important;
    font-style: italic;
  }
  
  .calibration-samples {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .calibration-card {
    background: #1a1b26;
    border: 1px solid #3b4261;
    border-radius: 6px;
    padding: 12px;
  }
  
  .calibration-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #3b4261;
  }
  
  .lot-badge {
    background: #7aa2f7;
    color: #1a1b26;
    padding: 2px 8px;
    border-radius: 3px;
    font-weight: bold;
    font-size: 11px;
  }
  
  .corrected-badge {
    color: #9ece6a;
    font-size: 10px;
  }
  
  .calibration-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .calibration-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    cursor: pointer;
  }
  
  .field-label {
    font-size: 10px;
    color: #565f89;
    text-transform: uppercase;
  }
  
  .field-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .ai-value {
    background: #24283b;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 11px;
    color: #a9b1d6;
    min-width: 60px;
    text-align: center;
  }
  
  .ai-value.changed {
    color: #f7768e;
    text-decoration: line-through;
  }
  
  .field-row .arrow {
    color: #565f89;
    font-size: 10px;
  }
  
  .calibration-input {
    flex: 1;
    background: #24283b;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-family: inherit;
  }
  
  .calibration-input:focus {
    border-color: #7aa2f7;
    outline: none;
  }
  
  .btn-skip {
    background: none;
    border: 1px solid #565f89;
    color: #565f89;
    padding: 6px 12px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
  }
  
  .btn-skip:hover {
    border-color: #a9b1d6;
    color: #a9b1d6;
  }
  
  /* Visual Box Calibration Modal */
  .box-calibration-modal {
    max-width: 95vw;
    width: 1200px;
    max-height: 90vh;
  }
  
  .box-calibration-body {
    display: flex;
    gap: 16px;
    min-height: 500px;
  }
  
  .box-calibration-sidebar {
    width: 250px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .current-step-info {
    background: #24283b;
    padding: 12px;
    border-radius: 6px;
    text-align: center;
  }
  
  .step-badge {
    font-size: 10px;
    color: #565f89;
    margin-bottom: 4px;
  }
  
  .lot-number-display {
    font-size: 18px;
    font-weight: bold;
    color: #7aa2f7;
  }
  
  .field-badge {
    display: inline-block;
    margin-top: 8px;
    background: #bb9af7;
    color: #1a1b26;
    padding: 4px 12px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 12px;
  }
  
  .ai-says {
    background: #1a1b26;
    padding: 10px;
    border-radius: 4px;
    border-left: 3px solid #f7768e;
  }
  
  .ai-label {
    display: block;
    font-size: 10px;
    color: #565f89;
    margin-bottom: 4px;
  }
  
  .ai-extracted-value {
    font-size: 16px;
    color: #f7768e;
    font-weight: bold;
  }
  
  .user-correction-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .calibration-input.large {
    padding: 8px 12px;
    font-size: 14px;
  }
  
  
  .step-progress {
    padding: 8px 0;
  }
  
  .progress-dots {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
  }
  
  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3b4261;
  }
  
  .progress-dot.active {
    background: #7aa2f7;
    box-shadow: 0 0 6px #7aa2f7;
  }
  
  .progress-dot.completed {
    background: #9ece6a;
  }
  
  .progress-dot.has-box {
    border: 2px solid #bb9af7;
  }
  
  .step-nav-buttons {
    display: flex;
    gap: 8px;
  }
  
  .btn-nav {
    flex: 1;
    background: #24283b;
    border: 1px solid #3b4261;
    color: #a9b1d6;
    padding: 8px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
  }
  
  .btn-nav:hover:not(:disabled) {
    background: #3b4261;
  }
  
  .btn-nav:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-confirm-field {
    flex: 1;
    background: #2d4f2d;
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 8px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
  }
  
  .btn-confirm-field:hover {
    background: #9ece6a;
    color: #1a1b26;
  }
  
  .box-calibration-canvas-container {
    flex: 1;
    background: #1a1b26;
    border-radius: 6px;
    overflow: auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  
  .box-calibration-canvas {
    max-width: 100%;
    cursor: crosshair;
  }
  
  .btn-box-calibrate {
    background: #3d2d4f;
    border: 1px solid #bb9af7;
    color: #bb9af7;
    padding: 3px 10px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 3px;
  }
  
  .btn-box-calibrate:hover:not(:disabled) {
    background: #bb9af7;
    color: #1a1b26;
  }
  
  .btn-box-calibrate:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Pricing Section Styles */
  .pricing-section {
    margin-bottom: 12px;
  }
  
  .pricing-content {
    background: #1e2030;
    border: 1px solid #3b4261;
    border-radius: 6px;
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .pricing-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .pricing-desc {
    color: #a9b1d6;
    font-size: 12px;
    margin: 0;
  }
  
  .pricing-actions {
    display: flex;
    gap: 8px;
  }
  
  .pricing-table-wrapper {
    overflow-x: auto;
    margin-bottom: 12px;
  }
  
  .pricing-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  
  .pricing-table th {
    background: #24283b;
    color: #7aa2f7;
    padding: 10px 8px;
    text-align: left;
    font-weight: 500;
    border-bottom: 1px solid #3b4261;
  }
  
  .pricing-table td {
    padding: 8px;
    border-bottom: 1px solid #3b4261;
    color: #c0caf5;
  }
  
  .pricing-table tr:hover {
    background: rgba(122, 162, 247, 0.05);
  }
  
  .pricing-input {
    background: #24283b;
    border: 1px solid #3b4261;
    color: #c0caf5;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    width: 70px;
  }
  
  .pricing-input.name {
    width: 100px;
  }
  
  .pricing-input.price {
    width: 100px;
  }
  
  .pricing-input.rate {
    width: 60px;
  }
  
  .pricing-input:focus {
    border-color: #7aa2f7;
    outline: none;
  }
  
  .product-name {
    font-weight: 500;
    color: #7aa2f7;
  }
  
  .price-value {
    font-weight: 600;
    color: #9ece6a;
  }
  
  .area-cell {
    color: #a9b1d6;
  }
  
  .sqm-cell {
    text-align: center;
  }
  
  .sqm-value {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }
  
  .sqm-value.high {
    background: rgba(247, 118, 142, 0.2);
    color: #f7768e;
  }
  
  .sqm-value.medium {
    background: rgba(224, 175, 104, 0.2);
    color: #e0af68;
  }
  
  .sqm-value.low {
    background: rgba(158, 206, 106, 0.2);
    color: #9ece6a;
  }
  
  .btn-add-product {
    background: #24283b;
    border: 1px dashed #3b4261;
    color: #a9b1d6;
    padding: 8px 16px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
    width: 100%;
    margin-bottom: 12px;
  }
  
  .btn-add-product:hover {
    border-color: #7aa2f7;
    color: #7aa2f7;
  }
  
  .btn-remove {
    background: none;
    border: none;
    color: #f7768e;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 8px;
  }
  
  .btn-remove:hover {
    background: rgba(247, 118, 142, 0.2);
    border-radius: 4px;
  }
  
  .pricing-legend {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    padding: 8px;
    background: #24283b;
    border-radius: 4px;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #a9b1d6;
  }
  
  .legend-item .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  
  .legend-item .dot.high {
    background: #f7768e;
  }
  
  .legend-item .dot.medium {
    background: #e0af68;
  }
  
  .legend-item .dot.low {
    background: #9ece6a;
  }
  
  .pricing-info {
    background: #24283b;
    padding: 12px;
    border-radius: 6px;
    border-left: 3px solid #7aa2f7;
  }
  
  .pricing-info h4 {
    margin: 0 0 8px 0;
    color: #7aa2f7;
    font-size: 12px;
  }
  
  .pricing-info ul {
    margin: 0;
    padding-left: 20px;
    font-size: 11px;
    color: #a9b1d6;
  }
  
  .pricing-info li {
    margin-bottom: 4px;
  }
  
  /* Pricing Graph Styles */
  .pricing-graph-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #3b4261;
  }
  
  .pricing-graph-section h4 {
    margin: 0 0 12px 0;
    color: #7aa2f7;
    font-size: 13px;
  }
  
  .pricing-graph-container {
    background: #1a1b26;
    border-radius: 6px;
    padding: 10px;
    border: 1px solid #3b4261;
  }
  
  .pricing-graph {
    width: 100%;
    height: auto;
    max-height: 380px;
  }
  
  .graph-point {
    transition: transform 0.15s ease;
  }
  
  .graph-point:hover circle {
    r: 10;
    filter: brightness(1.2);
  }
  
  .graph-note {
    margin: 8px 0 0 0;
    font-size: 11px;
    color: #565f89;
    font-style: italic;
  }
  
  .graph-edit-hint {
    font-size: 11px;
    color: #bb9af7;
    font-weight: normal;
  }
  
  .pricing-graph.editing {
    cursor: crosshair;
  }
  
  .graph-point.draggable {
    cursor: ns-resize;
  }
  
  .graph-point.draggable:hover circle {
    r: 10;
    filter: brightness(1.3);
  }
  
  .graph-point.dragging circle,
  .graph-point.selected circle {
    filter: drop-shadow(0 0 8px rgba(255,255,255,0.5));
  }
  
  .pricing-graph:focus {
    outline: 2px solid #7aa2f7;
    outline-offset: 2px;
  }
  
  .pricing-graph-section.full-width {
    margin: 0 -12px;
    padding: 0 12px;
  }
  
  .graph-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .graph-header h4 {
    margin: 0;
  }
  
  .graph-actions {
    display: flex;
    gap: 8px;
  }
  
  .btn-graph-edit,
  .btn-graph-save,
  .btn-graph-cancel {
    padding: 6px 14px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
    font-weight: 500;
  }
  
  .btn-graph-edit {
    background: linear-gradient(135deg, #2d3a4f 0%, #1d2a3f 100%);
    border: 1px solid #7aa2f7;
    color: #7aa2f7;
  }
  
  .btn-graph-edit:hover {
    background: linear-gradient(135deg, #3d4a5f 0%, #2d3a4f 100%);
    box-shadow: 0 0 8px rgba(122, 162, 247, 0.3);
  }
  
  .btn-graph-save {
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
  }
  
  .btn-graph-save:hover {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 8px rgba(158, 206, 106, 0.3);
  }
  
  .btn-graph-cancel {
    background: linear-gradient(135deg, #3d2d2d 0%, #2d1d1d 100%);
    border: 1px solid #f7768e;
    color: #f7768e;
  }
  
  .btn-graph-cancel:hover {
    background: linear-gradient(135deg, #4d3d3d 0%, #3d2d2d 100%);
    box-shadow: 0 0 8px rgba(247, 118, 142, 0.3);
  }

  .pricing-preview-section {
    margin-top: 12px;
    padding: 12px;
    background: linear-gradient(135deg, #1a2a1a 0%, #1a1b26 100%);
    border: 1px solid #3d5a3d;
    border-radius: 6px;
  }

  .pricing-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-weight: 600;
    color: #9ece6a;
  }

  .preview-count {
    font-size: 11px;
    color: #a9b1d6;
    font-weight: normal;
  }

  .pricing-preview-table {
    background: #1a1b26;
    border-radius: 4px;
    overflow: hidden;
    font-size: 11px;
  }

  .preview-row {
    display: grid;
    grid-template-columns: 60px 120px 100px 100px;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid #24283b;
  }

  .preview-row.header {
    background: #24283b;
    font-weight: 600;
    color: #7aa2f7;
  }

  .preview-row.more {
    grid-template-columns: 1fr;
    color: #565f89;
    font-style: italic;
    text-align: center;
  }

  .preview-row .col-price {
    color: #9ece6a;
    font-weight: 600;
    text-align: right;
  }

  .preview-row .col-match {
    color: #bb9af7;
  }

  .pricing-preview-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 10px 0;
    padding: 8px 12px;
    background: #24283b;
    border-radius: 4px;
  }

  .preview-total .value {
    font-size: 16px;
    font-weight: 700;
    color: #9ece6a;
    margin-left: 8px;
  }

  .preview-avg .value {
    color: #7aa2f7;
    margin-left: 4px;
  }

  .pricing-preview-section .btn-apply-pricing {
    width: 100%;
    padding: 10px;
    font-size: 13px;
  }

  .price-col {
    min-width: 120px;
  }

  .indicative-price-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .indicative-value {
    color: #e0af68;
    font-weight: 500;
    cursor: help;
    border-bottom: 1px dashed #e0af68;
  }

  .btn-accept-price {
    padding: 2px 6px;
    font-size: 11px;
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    border-radius: 3px;
    cursor: pointer;
    font-weight: bold;
  }

  .btn-accept-price:hover {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 6px rgba(158, 206, 106, 0.4);
  }

  .price-set {
    color: #9ece6a;
    font-weight: 600;
  }

  .no-price {
    color: #565f89;
  }

  .price-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .price-input-wrapper input {
    width: 100px;
  }

  .indicative-suggestion {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .btn-use-indicative {
    padding: 4px 8px;
    font-size: 11px;
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    border-radius: 3px;
    cursor: pointer;
    font-weight: 500;
    white-space: nowrap;
  }

  .btn-use-indicative:hover {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 6px rgba(158, 206, 106, 0.4);
  }

  .base-used {
    font-size: 9px;
    color: #bb9af7;
    white-space: nowrap;
  }

  .no-pricing-hint {
    font-size: 10px;
    color: #565f89;
    font-style: italic;
  }

  .graph-apply-all {
    margin: 10px 0;
  }

  .btn-apply-all-pricing {
    width: 100%;
    padding: 10px 16px;
    font-size: 13px;
    font-family: inherit;
    font-weight: 600;
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-apply-all-pricing:hover {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 12px rgba(158, 206, 106, 0.4);
  }
  
  .graph-legend {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-top: 8px;
    padding: 6px 10px;
    background: #24283b;
    border-radius: 4px;
    font-size: 11px;
  }
  
  .graph-legend .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #a9b1d6;
  }
  
  .graph-legend .legend-item .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  
  .graph-legend .trend-info {
    color: #bb9af7;
    font-weight: 500;
  }
  
  .btn-apply-trend {
    background: linear-gradient(135deg, #3d2d4f 0%, #2d1d3f 100%);
    border: 1px solid #bb9af7;
    color: #bb9af7;
    padding: 4px 10px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
    margin-left: auto;
  }
  
  .btn-apply-trend:hover {
    background: linear-gradient(135deg, #4d3d5f 0%, #3d2d4f 100%);
    box-shadow: 0 0 6px rgba(187, 154, 247, 0.3);
  }
  
  /* Pricing Summary Styles */
  .pricing-summary {
    border-top: 1px solid #3b4261;
    padding-top: 6px;
    margin-top: 6px;
  }
  
  .pricing-summary .summary-value.price {
    color: #9ece6a;
  }
  
  .pricing-summary .summary-value.balance {
    color: #e0af68;
  }
  
  .pricing-summary.total {
    background: rgba(122, 162, 247, 0.1);
    padding: 8px;
    border-radius: 4px;
    margin-top: 4px;
  }
  
  .pricing-summary .summary-value.total-price {
    color: #7aa2f7;
    font-weight: 600;
    font-size: 14px;
  }
  
  .pricing-summary.action {
    width: 100%;
    margin-top: 8px;
  }
  
  .btn-apply-pricing {
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    padding: 8px 16px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
    width: 100%;
    font-weight: 500;
  }
  
  .btn-apply-pricing:hover {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 8px rgba(158, 206, 106, 0.3);
  }

  /* Pricing Action Buttons */
  .pricing-action-buttons {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .btn-review-pricing {
    flex: 1;
    padding: 10px 16px;
    font-size: 13px;
    font-family: inherit;
    font-weight: 600;
    background: linear-gradient(135deg, #2d3a4f 0%, #1a2a3f 100%);
    border: 1px solid #7aa2f7;
    color: #7aa2f7;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-review-pricing:hover {
    background: linear-gradient(135deg, #3d4a5f 0%, #2a3a4f 100%);
    box-shadow: 0 0 12px rgba(122, 162, 247, 0.4);
  }

  .pricing-action-buttons .btn-apply-pricing {
    flex: 1;
  }

  /* Pricing Review Modal */
  .pricing-review-modal {
    max-width: 900px;
    width: 90vw;
    max-height: 85vh;
  }

  .pricing-review-modal .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pricing-review-modal .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pending-badge {
    padding: 4px 10px;
    background: rgba(224, 175, 104, 0.2);
    border: 1px solid #e0af68;
    border-radius: 12px;
    color: #e0af68;
    font-size: 11px;
    font-weight: 600;
  }

  .pricing-review-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 60vh;
    overflow: hidden;
  }

  .review-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px;
    background: #24283b;
    border-radius: 6px;
  }

  .btn-apply-all-indicative {
    padding: 8px 16px;
    font-size: 12px;
    font-family: inherit;
    font-weight: 600;
    background: linear-gradient(135deg, #3d2d4f 0%, #2d1d3f 100%);
    border: 1px solid #bb9af7;
    color: #bb9af7;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-apply-all-indicative:hover {
    background: linear-gradient(135deg, #4d3d5f 0%, #3d2d4f 100%);
    box-shadow: 0 0 8px rgba(187, 154, 247, 0.4);
  }

  .review-info {
    font-size: 12px;
    color: #a9b1d6;
  }

  .pricing-review-table-wrapper {
    flex: 1;
    overflow: auto;
    max-height: 400px;
    border: 1px solid #3b4261;
    border-radius: 6px;
  }

  .pricing-review-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .pricing-review-table th,
  .pricing-review-table td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid #24283b;
  }

  .pricing-review-table th {
    background: #24283b;
    color: #7aa2f7;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .pricing-review-table tr:hover {
    background: rgba(122, 162, 247, 0.05);
  }

  .pricing-review-table tr.has-change {
    background: rgba(224, 175, 104, 0.1);
  }

  .pricing-review-table tr.has-change:hover {
    background: rgba(224, 175, 104, 0.15);
  }

  .pricing-review-table .col-lot {
    font-weight: 600;
    color: #c0caf5;
  }

  .pricing-review-table .col-dims,
  .pricing-review-table .col-area {
    color: #a9b1d6;
  }

  .pricing-review-table .status-mini {
    font-size: 11px;
    font-weight: 500;
  }

  .btn-use-indicative-small {
    padding: 4px 8px;
    font-size: 11px;
    font-family: inherit;
    background: transparent;
    border: 1px solid #e0af68;
    color: #e0af68;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-use-indicative-small:hover {
    background: rgba(224, 175, 104, 0.2);
  }

  .no-indicative {
    color: #565f89;
  }

  .col-price-edit {
    min-width: 120px;
  }

  .price-input {
    width: 100px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: inherit;
    background: #1a1b26;
    border: 1px solid #3b4261;
    color: #9ece6a;
    border-radius: 4px;
    font-weight: 600;
  }

  .price-input:focus {
    outline: none;
    border-color: #7aa2f7;
    box-shadow: 0 0 4px rgba(122, 162, 247, 0.3);
  }

  .col-sqm {
    color: #7aa2f7;
    font-size: 11px;
  }

  .change-indicator {
    font-weight: 600;
    font-size: 11px;
  }

  .change-indicator.positive {
    color: #9ece6a;
  }

  .change-indicator.negative {
    color: #f7768e;
  }

  .pricing-review-summary {
    display: flex;
    gap: 24px;
    align-items: center;
    padding: 12px 16px;
    background: linear-gradient(135deg, #1a2a1a 0%, #1a1b26 100%);
    border: 1px solid #3b4261;
    border-radius: 6px;
  }

  .pricing-review-summary .summary-stat {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pricing-review-summary .label {
    font-size: 12px;
    color: #a9b1d6;
  }

  .pricing-review-summary .value {
    font-size: 16px;
    font-weight: 700;
    color: #9ece6a;
  }

  .pricing-review-summary .value.positive {
    color: #9ece6a;
  }

  .pricing-review-summary .value.negative {
    color: #f7768e;
  }

  .pricing-review-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .btn-save-all {
    padding: 10px 24px;
    font-size: 14px;
    font-family: inherit;
    font-weight: 600;
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-save-all:hover:not(:disabled) {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 12px rgba(158, 206, 106, 0.4);
  }

  .btn-save-all:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Stage table tabs */
  .stage-table-tabs {
    display: flex;
    gap: 4px;
    padding: 8px 12px 0;
    border-bottom: 1px solid #1a1b26;
    background: #16161e;
  }

  .stage-tab {
    padding: 8px 16px;
    font-size: 12px;
    font-family: inherit;
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    color: #565f89;
    cursor: pointer;
    border-radius: 4px 4px 0 0;
    transition: all 0.2s;
    position: relative;
    top: 1px;
  }

  .stage-tab:hover {
    color: #a9b1d6;
    background: rgba(86, 95, 137, 0.1);
  }

  .stage-tab.active {
    color: #7aa2f7;
    background: #1a1b26;
    border-color: #1a1b26;
    border-bottom-color: #1a1b26;
  }

  /* Tab table input styles */
  .date-input-cell,
  .number-input-cell,
  .text-input-cell {
    width: 100%;
    padding: 4px 8px;
    font-size: 12px;
    font-family: inherit;
    background: transparent;
    border: 1px solid transparent;
    color: #a9b1d6;
    border-radius: 3px;
    transition: all 0.2s;
  }

  .date-input-cell:hover,
  .number-input-cell:hover,
  .text-input-cell:hover {
    border-color: #565f89;
    background: rgba(86, 95, 137, 0.1);
  }

  .date-input-cell:focus,
  .number-input-cell:focus,
  .text-input-cell:focus {
    border-color: #7aa2f7;
    background: rgba(122, 162, 247, 0.1);
    outline: none;
  }

  .number-input-cell {
    text-align: right;
  }

  .dates-table th,
  .pricing-details-table th {
    white-space: nowrap;
  }

  .th-date {
    min-width: 120px;
  }

  /* Panel header actions */
  .panel-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-tab-action {
    padding: 4px 12px;
    font-size: 11px;
    font-family: inherit;
    background: transparent;
    border: 1px solid #565f89;
    color: #a9b1d6;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-tab-action:hover {
    border-color: #7aa2f7;
    color: #7aa2f7;
    background: rgba(122, 162, 247, 0.1);
  }

  .btn-cancel-tab {
    padding: 4px 12px;
    font-size: 11px;
    font-family: inherit;
    background: transparent;
    border: 1px solid #565f89;
    color: #a9b1d6;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-cancel-tab:hover {
    border-color: #f7768e;
    color: #f7768e;
  }

  .btn-save-tab {
    padding: 4px 12px;
    font-size: 11px;
    font-family: inherit;
    font-weight: 600;
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-save-tab:hover {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 8px rgba(158, 206, 106, 0.3);
  }

  .date-display,
  .value-display {
    font-size: 12px;
    color: #a9b1d6;
    padding: 4px 8px;
    display: block;
  }

  .date-with-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .date-with-status .date-display {
    padding: 0;
  }

  .date-status-badge {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .date-status-badge:hover {
    transform: scale(1.1);
    box-shadow: 0 0 6px currentColor;
  }

  .btn-edit-all-prices {
    padding: 4px 12px;
    font-size: 11px;
    font-family: inherit;
    font-weight: 600;
    background: linear-gradient(135deg, #2d3a2d 0%, #1a2a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-edit-all-prices:hover {
    background: linear-gradient(135deg, #3d4a3d 0%, #2a3a2a 100%);
    box-shadow: 0 0 8px rgba(158, 206, 106, 0.4);
  }

  .edit-mode-badge {
    padding: 4px 10px;
    background: rgba(224, 175, 104, 0.2);
    border: 1px solid #e0af68;
    border-radius: 4px;
    color: #e0af68;
    font-size: 11px;
    font-weight: 600;
  }

  /* Inline price edit bar */
  .inline-price-edit-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 12px;
    background: linear-gradient(135deg, #2d3a2d 0%, #1a2a1a 100%);
    border: 1px solid #9ece6a;
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .inline-price-edit-bar .edit-info {
    font-size: 13px;
    font-weight: 600;
    color: #9ece6a;
  }

  .inline-price-edit-bar .change-count {
    font-size: 12px;
    color: #e0af68;
    padding: 4px 10px;
    background: rgba(224, 175, 104, 0.15);
    border-radius: 12px;
  }

  .inline-price-edit-bar .edit-actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .btn-apply-all-suggested {
    padding: 6px 14px;
    font-size: 12px;
    font-family: inherit;
    font-weight: 600;
    background: linear-gradient(135deg, #2d3a4a 0%, #1a2a3a 100%);
    border: 1px solid #7aa2f7;
    color: #7aa2f7;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-apply-all-suggested:hover:not(:disabled) {
    background: linear-gradient(135deg, #3d4a5a 0%, #2a3a4a 100%);
    box-shadow: 0 0 8px rgba(122, 162, 247, 0.3);
  }

  .btn-apply-all-suggested:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-cancel-edit {
    padding: 6px 16px;
    font-size: 12px;
    font-family: inherit;
    background: transparent;
    border: 1px solid #565f89;
    color: #a9b1d6;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-cancel-edit:hover {
    border-color: #a9b1d6;
    color: #c0caf5;
  }

  .btn-save-all-prices {
    padding: 6px 20px;
    font-size: 12px;
    font-family: inherit;
    font-weight: 600;
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-save-all-prices:hover:not(:disabled) {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 8px rgba(158, 206, 106, 0.4);
  }

  .btn-save-all-prices:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Inline price edit cell */
  .inline-price-edit {
    min-width: 200px !important;
  }

  .inline-price-edit-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .inline-price-edit-cell.has-change {
    background: rgba(224, 175, 104, 0.1);
    margin: -4px -6px;
    padding: 4px 6px;
    border-radius: 4px;
  }

  .inline-price-input {
    width: 100px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: inherit;
    background: #1a1b26;
    border: 1px solid #3b4261;
    color: #9ece6a;
    border-radius: 4px;
    font-weight: 600;
  }

  .inline-price-input:focus {
    outline: none;
    border-color: #7aa2f7;
    box-shadow: 0 0 4px rgba(122, 162, 247, 0.3);
  }

  .inline-price-input::placeholder {
    color: #565f89;
    font-weight: normal;
  }

  .btn-use-indicative-inline {
    padding: 4px 10px;
    font-size: 11px;
    font-family: inherit;
    font-weight: 500;
    background: linear-gradient(135deg, #2d4a2d 0%, #1a3a1a 100%);
    border: 1px solid #9ece6a;
    color: #9ece6a;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-use-indicative-inline:hover {
    background: linear-gradient(135deg, #3d5a3d 0%, #2a4a2a 100%);
    box-shadow: 0 0 6px rgba(158, 206, 106, 0.4);
  }

  /* ===== LAND BUDGET STYLES ===== */
  .land-budget-panel {
    background: #1a1b26;
    border: 1px solid #3b4261;
    border-radius: 6px;
    margin: 8px 12px;
  }
  
  .land-budget-header {
    padding: 8px 12px;
    border-bottom: 1px solid #3b4261;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    background: #1a1b26;
    position: sticky;
    top: 0;
    z-index: 1;
    flex-shrink: 0;
  }
  
  .land-budget-controls {
    display: flex;
    gap: 8px;
  }
  
  .btn-edit-budget, .btn-save-budget, .btn-cancel-budget, .btn-toggle-subtotals {
    padding: 3px 10px;
    border-radius: 3px;
    font-size: 10px;
    cursor: pointer;
    border: 1px solid;
    background: transparent;
  }
  
  .btn-edit-budget {
    border-color: #7aa2f7;
    color: #7aa2f7;
  }
  
  .btn-save-budget {
    border-color: #9ece6a;
    color: #9ece6a;
  }
  
  .btn-cancel-budget {
    border-color: #565f89;
    color: #a9b1d6;
  }
  
  .btn-toggle-subtotals {
    border-color: #565f89;
    color: #565f89;
  }
  
  .lot-area-check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
  }
  
  .check-label {
    color: #565f89;
  }
  
  .check-value {
    font-family: 'JetBrains Mono', monospace;
  }
  
  .check-value.match {
    color: #9ece6a;
  }
  
  .check-value.mismatch {
    color: #f7768e;
  }
  
  .check-warning {
    color: #e0af68;
  }
  
  .land-budget-tree {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
    padding: 8px 12px;
    line-height: 1.4;
    font-weight: 400;
    border: 1px solid #3b4261;
    border-radius: 4px;
    background: #1a1b26;
  }
  
  .lb-row {
    display: grid;
    grid-template-columns: 24px 1fr 20px 80px 24px 24px;
    align-items: center;
    padding: 3px 4px;
    gap: 4px;
    font-weight: 400;
    border-bottom: 1px solid rgba(59, 66, 97, 0.3);
  }
  
  .lb-row:last-child {
    border-bottom: none;
  }
  
  .lb-row.lb-clickable {
    cursor: pointer;
  }
  
  .lb-row.lb-clickable:hover {
    background: rgba(122, 162, 247, 0.08);
  }
  
  .lb-row.lb-category {
    background: rgba(59, 66, 97, 0.2);
    border-top: 1px solid #3b4261;
    border-bottom: 1px solid #3b4261;
    margin-top: 4px;
  }
  
  .lb-row.lb-total {
    background: rgba(187, 154, 247, 0.1);
    border-top: 1px solid #565f89;
    border-bottom: 1px solid #565f89;
    margin-top: 6px;
  }
  
  .lb-row.lb-grand-total {
    background: rgba(122, 162, 247, 0.15);
    border-top: 2px solid #7aa2f7;
    border-bottom: 2px solid #7aa2f7;
    margin-top: 8px;
  }
  
  .lb-row.lb-sub {
    font-size: 10px;
    padding-left: 8px;
    border-bottom: 1px dotted rgba(59, 66, 97, 0.4);
  }
  
  .lb-indent-0, .lb-indent-1, .lb-indent-2 {
    color: #565f89;
    white-space: pre;
    font-size: 10px;
  }
  
  .lb-indent-0 { padding-left: 0; }
  .lb-indent-1 { padding-left: 8px; }
  .lb-indent-2 { padding-left: 16px; }
  
  .lb-name {
    color: #a9b1d6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 400;
  }
  
  .lb-arrow {
    color: #565f89;
    text-align: center;
    font-size: 10px;
  }
  
  .lb-value {
    font-family: 'JetBrains Mono', monospace;
    text-align: right;
    font-weight: 400;
    font-size: 11px;
  }
  
  .lb-unit {
    color: #565f89;
    font-size: 9px;
  }
  
  .lb-actions {
    text-align: center;
  }
  
  .lb-separator {
    height: 1px;
    background: linear-gradient(90deg, transparent, #3b4261, transparent);
    margin: 6px 0;
    grid-column: 1 / -1;
  }
  
  .lb-input {
    width: 80px;
    padding: 2px 4px;
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 2px;
    color: #c0caf5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    text-align: right;
  }
  
  .lb-input:focus {
    outline: none;
    border-color: #7aa2f7;
  }
  
  .lb-name-input {
    width: 100%;
    padding: 2px 4px;
    background: #24283b;
    border: 1px solid #3b4261;
    border-radius: 2px;
    color: #c0caf5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
  }
  
  .lb-name-input:focus {
    outline: none;
    border-color: #7aa2f7;
  }
  
  .lb-add-btn, .lb-del-btn {
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
  }
  
  .lb-add-btn {
    background: rgba(158, 206, 106, 0.2);
    color: #9ece6a;
  }
  
  .lb-add-btn:hover {
    background: rgba(158, 206, 106, 0.4);
  }
  
  .lb-del-btn {
    background: rgba(247, 118, 142, 0.2);
    color: #f7768e;
  }
  
  .lb-del-btn:hover {
    background: rgba(247, 118, 142, 0.4);
  }
  
  /* Text colors for categories */
  .lb-color-white { color: #c0caf5; }
  .lb-color-cyan { color: #7dcfff; }
  .lb-color-yellow { color: #e0af68; }
  .lb-color-brown { color: #d19a66; }
  .lb-color-gold { color: #e5c07b; }
  .lb-color-blue { color: #7aa2f7; }
  .lb-color-green { color: #9ece6a; }
  .lb-color-green-light { color: #73daca; }
  .lb-color-purple { color: #bb9af7; }
  .lb-color-teal { color: #2dd4bf; }
  .lb-color-red { color: #f7768e; }
  .lb-color-gray { color: #9aa5ce; }
  .lb-color-magenta { color: #ff79c6; }
  .lb-color-orange { color: #ff9e64; }
  
  .lb-summary-label {
    color: #565f89;
    font-size: 11px;
    font-style: italic;
  }
  
  .lb-stage-source {
    opacity: 0.8;
  }
  
  .empty-state {
    color: #565f89;
    font-size: 12px;
    padding: 16px;
    text-align: center;
    font-style: italic;
  }

  /* ===== FORECAST TOOL STYLES ===== */
  .forecast-tool {
    background: linear-gradient(135deg, #1a1b26 0%, #16161e 100%);
    border: 1px solid #3d59a1;
    border-radius: 6px;
    margin: 8px 0;
    overflow: hidden;
  }

  .forecast-header {
    padding: 12px;
    border-bottom: 1px solid #3d59a1;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .forecast-stats-text {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
  }

  .forecast-stats-text .stat-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .forecast-stats-text .stat-label {
    color: #565f89;
  }

  .forecast-stats-text .stat-value {
    font-weight: 600;
  }

  .forecast-stats-text .stat-value.total {
    color: #7aa2f7;
  }

  .forecast-stats-text .stat-value.allocated {
    color: #9ece6a;
  }

  .forecast-stats-text .stat-value.unallocated {
    color: #ff9e64;
  }

  .forecast-stats-text .stat-sep {
    color: #3b4261;
  }

  .forecast-stats-text .stat-link {
    background: none;
    border: none;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    transition: background 0.15s;
  }

  .forecast-stats-text .stat-link:hover {
    background: rgba(122, 162, 247, 0.15);
  }

  .forecast-stats-text .stat-link.active {
    background: rgba(122, 162, 247, 0.25);
  }

  .forecast-stats-text .stat-link.sold {
    color: #bb9af7;
  }

  .forecast-stats-text .stat-link.exchanged {
    color: #7dcfff;
  }

  .forecast-stats-text .stat-link.settled {
    color: #9ece6a;
  }

  .forecast-stats-text .stat-link.cancelled {
    color: #f7768e;
  }

  .forecast-stats-text .stat-link .actual {
    font-weight: 700;
  }

  .forecast-stats-text .stat-link .target {
    opacity: 0.7;
  }

  button.forecast-card.period-stat {
    min-width: 80px;
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0.6;
  }

  button.forecast-card.period-stat:hover {
    opacity: 0.85;
    transform: translateY(-1px);
  }

  button.forecast-card.period-stat.active {
    opacity: 1;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.15);
  }

  .forecast-card.period-stat.sold {
    background: rgba(224, 175, 104, 0.15);
    border-color: #e0af68;
  }

  .forecast-card.period-stat.sold .card-value {
    color: #e0af68;
  }

  .forecast-card.period-stat.exchanged {
    background: rgba(187, 154, 247, 0.15);
    border-color: #bb9af7;
  }

  .forecast-card.period-stat.exchanged .card-value {
    color: #bb9af7;
  }

  .forecast-card.period-stat.settled {
    background: rgba(158, 206, 106, 0.15);
    border-color: #9ece6a;
  }

  .forecast-card.period-stat.settled .card-value {
    color: #9ece6a;
  }

  .forecast-card.period-stat.cancelled {
    background: rgba(247, 118, 142, 0.15);
    border-color: #f7768e;
  }

  .forecast-card.period-stat.cancelled .card-value {
    color: #f7768e;
  }

  .forecast-card .card-value.dual {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 1px;
  }

  .forecast-card .card-value .actual-val {
    font-size: 18px;
  }

  .forecast-card .card-value .stat-sep {
    color: #565f89;
    font-size: 14px;
    font-weight: 400;
  }

  .forecast-card .card-value .target-val {
    font-size: 14px;
    opacity: 0.7;
  }

  .forecast-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-group label {
    font-size: 11px;
    color: #565f89;
    white-space: nowrap;
  }

  .forecast-select {
    background: #1a1b26;
    border: 1px solid #3d59a1;
    border-radius: 4px;
    color: #a9b1d6;
    padding: 4px 8px;
    font-size: 11px;
    font-family: inherit;
  }

  .forecast-sort {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .forecast-sort label {
    font-size: 11px;
    color: #565f89;
  }

  .sort-direction-btn {
    background: #1a1b26;
    border: 1px solid #3d59a1;
    border-radius: 4px;
    color: #7aa2f7;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    min-width: 28px;
  }

  .sort-direction-btn:hover {
    background: #24283b;
    border-color: #7aa2f7;
  }

  .lot-date-display {
    font-size: 10px;
    color: #565f89;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 400;
  }

  .period-buttons {
    display: flex;
    gap: 2px;
  }

  .period-buttons button {
    padding: 4px 10px;
    font-size: 10px;
    font-family: inherit;
    background: #1a1b26;
    border: 1px solid #3d59a1;
    color: #565f89;
    cursor: pointer;
    transition: all 0.2s;
  }

  .period-buttons button:first-child {
    border-radius: 4px 0 0 4px;
  }

  .period-buttons button:last-child {
    border-radius: 0 4px 4px 0;
  }

  .period-buttons button.active {
    background: #2dd4bf;
    border-color: #2dd4bf;
    color: #1a1b26;
    font-weight: 600;
  }

  .range-slider {
    width: 80px;
    accent-color: #2dd4bf;
  }

  .forecast-actions {
    display: flex;
    gap: 8px;
  }

  .forecast-grid-wrapper {
    overflow-x: auto;
    max-height: 400px;
    position: relative;
  }

  .forecast-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 11px;
  }

  /* Sticky columns for forecast table */
  .forecast-table .th-sticky-left,
  .forecast-table .td-sticky-left {
    position: sticky;
    left: 0;
    background: #1a1b26;
    z-index: 2;
  }

  .forecast-table .th-sticky-left-2,
  .forecast-table .td-sticky-left-2 {
    left: 100px;
  }

  .forecast-table .th-sticky-left-3,
  .forecast-table .td-sticky-left-3 {
    left: 150px;
    border-right: 2px solid #3d59a1;
  }

  .forecast-table .th-sticky-right,
  .forecast-table .td-sticky-right {
    position: sticky;
    right: 0;
    background: #1a1b26;
    z-index: 2;
    border-left: 2px solid #3d59a1;
  }

  .forecast-table tbody .td-sticky-left,
  .forecast-table tbody .td-sticky-right {
    background: #16161e;
  }

  .forecast-table tbody tr:hover .td-sticky-left,
  .forecast-table tbody tr:hover .td-sticky-right {
    background: rgba(122, 162, 247, 0.1);
  }

  .forecast-table tfoot .td-sticky-left,
  .forecast-table tfoot .td-sticky-right {
    background: #1a1b26;
  }

  /* Navigation columns */
  .forecast-table .th-nav,
  .forecast-table .td-nav {
    width: 28px;
    min-width: 28px;
    max-width: 28px;
    padding: 2px;
  }

  .forecast-table .th-nav {
    background: #1a1b26;
  }

  .nav-btn {
    width: 24px;
    height: 24px;
    background: #24283b;
    border: 1px solid #3d59a1;
    border-radius: 4px;
    color: #7aa2f7;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .nav-btn:hover {
    background: #3d59a1;
    color: #c0caf5;
  }

  /* Offset indicator row */
  .offset-indicator {
    background: rgba(122, 162, 247, 0.1);
  }

  .offset-info {
    text-align: center;
    padding: 4px !important;
  }

  .btn-reset-offset {
    background: transparent;
    border: 1px solid #7aa2f7;
    border-radius: 4px;
    color: #7aa2f7;
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-reset-offset:hover {
    background: #7aa2f7;
    color: #1a1b26;
  }

  .forecast-table th,
  .forecast-table td {
    padding: 6px 8px;
    text-align: center;
    border-bottom: 1px solid #24283b;
  }

  .forecast-table thead th {
    background: #1a1b26;
    color: #565f89;
    font-weight: 500;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.3px;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .forecast-table .th-stage {
    text-align: left;
    min-width: 100px;
  }

  .forecast-table .th-lots,
  .forecast-table .th-unalloc {
    min-width: 50px;
  }

  .forecast-table .th-period {
    min-width: 60px;
  }

  .forecast-table .th-period.current {
    background: rgba(45, 212, 191, 0.2);
    color: #2dd4bf;
  }

  .forecast-table .th-total {
    min-width: 80px;
  }

  .forecast-table tbody tr:hover {
    background: rgba(122, 162, 247, 0.05);
  }

  .forecast-table .stage-name {
    text-align: left;
    color: #a9b1d6;
    font-weight: 500;
  }

  .forecast-table .stage-row.expanded {
    background: rgba(122, 162, 247, 0.08);
  }

  .stage-expand-btn {
    background: none;
    border: none;
    color: #565f89;
    cursor: pointer;
    padding: 0 4px 0 0;
    font-size: 10px;
    transition: color 0.15s;
  }

  .stage-expand-btn:hover {
    color: #7aa2f7;
  }

  .forecast-table .lot-detail-row {
    background: rgba(59, 66, 97, 0.1);
    font-size: 11px;
    font-weight: 400;
  }

  .forecast-table .lot-detail-row:hover {
    background: rgba(59, 66, 97, 0.2);
  }

  .forecast-table .lot-name {
    text-align: left;
    color: #565f89;
    font-weight: 400;
  }

  .forecast-table .lot-indent {
    color: #3b4261;
    margin-right: 4px;
    font-weight: 400;
  }

  .forecast-table .lot-number {
    color: #a9b1d6;
    font-weight: 400;
    font-size: 11px;
  }

  .forecast-table .lot-area {
    color: #565f89;
    margin-left: 6px;
    font-size: 10px;
    font-weight: 400;
  }

  .lot-status-badge {
    display: inline-block;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 9px;
    font-weight: 500;
  }

  .lot-status-badge.clickable {
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
  }

  .lot-status-badge.clickable:hover {
    transform: scale(1.1);
  }

  .lot-status-badge.actual {
    background: rgba(158, 206, 106, 0.2);
    color: #9ece6a;
  }

  .lot-status-badge.clickable.actual:hover {
    border-color: #9ece6a;
    background: rgba(158, 206, 106, 0.3);
  }

  .lot-status-badge.forecast {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }

  .lot-status-badge.clickable.forecast:hover {
    border-color: #7aa2f7;
    background: rgba(122, 162, 247, 0.3);
  }

  .lot-status-badge.none {
    background: rgba(59, 66, 97, 0.3);
    color: #565f89;
  }

  .lot-status-badge.clickable.none:hover {
    border-color: #565f89;
    background: rgba(59, 66, 97, 0.5);
  }

  .lot-date-cell {
    padding: 0 2px;
  }

  .lot-date-input {
    width: 85px;
    padding: 1px 2px;
    background: rgba(36, 40, 59, 0.8);
    border: 1px solid #3b4261;
    border-radius: 2px;
    color: #a9b1d6;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 400;
  }

  .lot-date-input:focus {
    outline: none;
    border-color: #7aa2f7;
  }

  .lot-date-input::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
    cursor: pointer;
  }

  .forecast-table .lot-period {
    color: #3b4261;
    font-size: 9px;
  }

  .forecast-table .lot-period.lot-period-clickable {
    cursor: pointer;
    transition: background 0.15s;
  }

  .forecast-table .lot-period.lot-period-clickable:hover {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }

  .forecast-table .lot-period.lot-allocated {
    background: rgba(122, 162, 247, 0.15);
  }

  .forecast-table .lot-period.lot-allocated:hover {
    background: rgba(122, 162, 247, 0.3);
  }

  .forecast-table .lot-period.lot-actual {
    background: rgba(158, 206, 106, 0.15);
  }

  .forecast-table .lot-marker {
    color: #7aa2f7;
  }

  .forecast-table .lot-period.lot-actual .lot-marker {
    color: #9ece6a;
  }

  .forecast-table .lot-price {
    color: #565f89;
    font-size: 10px;
    font-weight: 400;
  }

  .forecast-table .lots-count {
    color: #7aa2f7;
  }

  .forecast-table .unalloc-count {
    color: #565f89;
  }

  .forecast-table .unalloc-count.warning {
    color: #f7768e;
    font-weight: 600;
  }

  .forecast-table .period-cell {
    position: relative;
  }

  .forecast-table .period-cell.current {
    background: rgba(45, 212, 191, 0.08);
  }

  .forecast-table .period-cell.has-value {
    background: rgba(45, 212, 191, 0.15);
  }

  .forecast-table .period-cell.current.has-value {
    background: rgba(45, 212, 191, 0.25);
  }

  .forecast-table .cell-empty {
    color: #3b4261;
  }

  .forecast-table .cell-content {
    cursor: help;
  }

  .forecast-table .cell-lots {
    color: #2dd4bf;
    font-weight: 600;
  }

  .forecast-input {
    width: 50px;
    background: transparent;
    border: none;
    border-bottom: 1px solid #24283b;
    border-radius: 0;
    color: #565f89;
    padding: 3px 5px;
    font-size: 11px;
    font-family: inherit;
    text-align: center;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .forecast-input::-webkit-outer-spin-button,
  .forecast-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .forecast-input::placeholder {
    color: #3b4261;
  }

  .forecast-input:focus {
    outline: none;
    border-bottom-color: #2dd4bf;
    color: #a9b1d6;
    box-shadow: none;
  }

  /* Forecast edit cell with actual + pending */
  .forecast-edit-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .actual-locked {
    color: #22c55e;
    font-weight: 700;
    font-size: 11px;
    padding: 2px 4px;
    background: rgba(34, 197, 94, 0.15);
    border-radius: 3px;
    cursor: not-allowed;
  }

  .edit-sep {
    color: #565f89;
    font-size: 10px;
  }

  /* Cell display for actual vs pending */
  .cell-actual {
    color: #22c55e;
    font-weight: 700;
  }

  .cell-sep {
    color: #565f89;
    font-size: 10px;
    margin: 0 1px;
  }

  .cell-pending {
    color: #e0af68;
    font-weight: 500;
  }

  /* Manual lots styling */
  .manual-locked {
    color: #7aa2f7;
    font-weight: 700;
    font-size: 11px;
    padding: 2px 4px;
    background: rgba(122, 162, 247, 0.15);
    border-radius: 3px;
    cursor: not-allowed;
  }

  .cell-manual {
    color: #7aa2f7;
    font-weight: 700;
  }

  .cell-auto {
    color: #a9b1d6;
    font-weight: 500;
  }

  /* Period cell with actuals/manual indicator */
  .period-cell.has-actual {
    border-left: 2px solid #22c55e;
  }

  .period-cell.has-manual:not(.has-actual) {
    border-left: 2px solid #7aa2f7;
  }

  .period-cell.has-actual.has-manual {
    border-left: 2px solid;
    border-image: linear-gradient(to bottom, #22c55e 50%, #7aa2f7 50%) 1;
  }

  /* Legend styles for A/M/Auto */
  .legend-actual {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    font-weight: 700;
  }

  .legend-manual {
    background: rgba(122, 162, 247, 0.15);
    color: #7aa2f7;
    font-weight: 700;
  }

  .legend-auto {
    background: rgba(169, 177, 214, 0.15);
    color: #a9b1d6;
    font-weight: 500;
  }

  .legend-sep {
    color: #3b4261;
    margin: 0 4px;
  }

  .forecast-table .total-price {
    color: #9ece6a;
    font-weight: 500;
  }

  .forecast-table .total-price.grand {
    color: #9ece6a;
    font-weight: 700;
    font-size: 12px;
  }

  .forecast-table tfoot .totals-row {
    background: #1a1b26;
    font-weight: 600;
  }

  .forecast-table tfoot .totals-row td {
    border-top: 2px solid #3d59a1;
  }

  .forecast-table .totals-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: help;
  }

  .forecast-table .total-lots {
    color: #7aa2f7;
    font-weight: 700;
  }

  .forecast-table .total-price-small {
    font-size: 9px;
    color: #9ece6a;
  }

  /* Stage name with date badges */
  .stage-name-with-dates {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stage-date-badges {
    display: flex;
    gap: 3px;
  }

  .stage-date-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 3px;
    text-transform: uppercase;
    border: 1px solid;
  }

  /* Milestone indicator in period cells */
  .milestone-indicator {
    position: absolute;
    top: 1px;
    right: 2px;
    font-size: 8px;
    opacity: 0.8;
  }

  /* Period cells with milestone backgrounds */
  .forecast-table .period-cell.has-registration {
    background: rgba(255, 158, 100, 0.2) !important;
    border-left: 2px solid #ff9e64;
  }

  .forecast-table .period-cell.has-settlement {
    background: rgba(100, 200, 255, 0.2) !important;
    border-left: 2px solid #7dcfff;
  }

  /* Combined mode cell content */
  .combined-cell-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1px;
    flex-wrap: wrap;
  }

  .combined-category {
    font-weight: 600;
    font-size: 10px;
    white-space: nowrap;
  }

  .combined-sep {
    color: #565f89;
    font-size: 9px;
    margin: 0 1px;
  }

  .combined-cell-content.totals .combined-category {
    font-size: 11px;
    font-weight: 700;
  }

  /* Combined mode legend */
  .forecast-legend {
    display: flex;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(36, 40, 59, 0.5);
    border-top: 1px solid #24283b;
    font-size: 10px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    font-size: 8px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .legend-label {
    color: #565f89;
  }

  .legend-title {
    color: #7aa2f7;
    font-weight: 600;
    margin-right: 8px;
  }


  .date-input {
    background: #1a1b26;
    border: 1px solid #3d59a1;
    border-radius: 4px;
    color: #a9b1d6;
    padding: 4px 8px;
    font-family: inherit;
  }

  .date-value.registration {
    color: #ff9e64;
    font-weight: 500;
  }

  .date-value.settlement {
    color: #7dcfff;
    font-weight: 500;
  }

  /* ===== RESPONSIVE DESIGN ===== */
  
  /* Large tablets and small desktops */
  @media (max-width: 1200px) {
    .main {
      grid-template-columns: 220px 1fr;
    }
    
    .tree-panel {
      min-width: 220px;
    }
    
    th, td {
      padding: 6px 8px;
      font-size: 11px;
    }
  }
  
  /* Tablets */
  @media (max-width: 992px) {
    .main {
      grid-template-columns: 180px 1fr;
    }
    
    .tree-panel {
      min-width: 180px;
    }
    
    .table-content {
      max-height: calc(100vh - 240px);
    }
    
    .properties-grid {
      grid-template-columns: 1fr;
    }
    
    .panel-header {
      padding: 6px 10px;
      font-size: 11px;
    }
    
    .btn-edit, .btn-save, .btn-cancel, .btn-delete {
      padding: 3px 8px;
      font-size: 10px;
    }
  }
  
  /* Small tablets and large phones */
  @media (max-width: 768px) {
    .main {
      flex-direction: column;
    }
    
    .tree-toggle-btn {
      display: inline-flex;
      background: none;
      border: none;
      color: #7aa2f7;
      cursor: pointer;
      padding: 2px 6px;
      font-size: 12px;
    }
    
    .tree-panel {
      width: 100%;
      max-height: none;
      border-right: none;
      border-bottom: 1px solid #3b4261;
      flex-shrink: 0;
    }
    
    .tree-panel.collapsed {
      max-height: none;
    }
    
    .tree-panel.collapsed .tree-content {
      display: none;
    }
    
    .tree-content {
      max-height: 150px;
      overflow-y: auto;
    }
    
    .tree-content.hidden {
      display: none;
    }
    
    .table-panel {
      flex: 1;
      min-height: 0;
    }
    
    .hierarchy-path {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #1a1b26;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      border-bottom: 1px solid #3b4261;
    }
    
    .hierarchy-path::-webkit-scrollbar {
      display: none;
    }
    
    .table-content {
      max-height: calc(100vh - 280px);
      min-height: 200px;
      flex: 1;
      position: sticky;
      top: 0;
    }
    
    .table-scroll-wrapper {
      overflow: auto;
      flex: 1;
      min-height: 0;
    }
    
    thead {
      position: sticky;
      top: 0;
      z-index: 3;
      background: #1a1b26;
    }
    
    th {
      position: sticky;
      top: 0;
      background: #1a1b26;
      z-index: 2;
    }
    
    .land-budget-panel {
      margin: 4px 8px;
    }
    
    .lb-row {
      grid-template-columns: 50px 1fr 20px 70px 25px 25px;
      font-size: 11px;
    }
    
    .stage-tabs {
      overflow-x: auto;
      scrollbar-width: none;
    }
    
    .stage-tabs::-webkit-scrollbar {
      display: none;
    }
    
    /* Forecast Tool - compact text stats */
    .forecast-stats-text {
      font-size: 10px;
      gap: 4px;
    }
    
    .forecast-stats-text .stat-link {
      padding: 1px 4px;
    }
    
    /* Forecast legend - inline compact */
    .forecast-legend {
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 8px;
      font-size: 9px;
    }
    
    .legend-item {
      gap: 2px;
    }
    
    .legend-color {
      width: 10px;
      height: 10px;
      font-size: 7px;
    }
    
    /* Forecast controls compact */
    .forecast-controls {
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px;
    }
    
    .period-buttons {
      gap: 2px;
    }
    
    .period-btn, .period-buttons button {
      padding: 4px 8px;
      font-size: 10px;
    }
  }
  
  /* Phones */
  @media (max-width: 480px) {
    .top-bar {
      padding: 8px 12px;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .app-title {
      font-size: 14px;
    }
    
    .tree-panel {
      max-height: 150px;
    }
    
    .tree-content {
      max-height: 100px;
    }
    
    .table-content {
      max-height: calc(100vh - 280px);
      min-height: 150px;
      padding: 4px;
    }
    
    th, td {
      padding: 4px 6px;
      font-size: 10px;
    }
    
    .th-actions, .actions-col {
      min-width: 80px;
    }
    
    .btn-edit, .btn-delete {
      padding: 2px 6px;
      font-size: 9px;
    }
    
    .panel-header {
      padding: 4px 8px;
      font-size: 10px;
    }
    
    .properties-grid {
      gap: 4px;
    }
    
    .property-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }
    
    .land-budget-panel {
      margin: 4px;
    }
    
    .land-budget-tree {
      padding: 8px;
      font-size: 10px;
    }
    
    .lb-row {
      grid-template-columns: 40px 1fr 16px 60px 20px 20px;
      gap: 2px;
    }
    
    .log-panel {
      height: 60px;
      font-size: 9px;
    }
  }
  
  /* Handle very small screens */
  @media (max-width: 360px) {
    .main {
      min-width: 320px;
    }
    
    .table-scroll-wrapper {
      min-width: 300px;
    }
  }
  
  /* Landscape phone orientation */
  @media (max-height: 500px) and (orientation: landscape) {
    .tree-panel {
      max-height: 120px;
    }
    
    .table-content {
      max-height: calc(100vh - 180px);
      min-height: 120px;
    }
    
    .log-panel {
      height: 40px;
    }
  }
</style>
