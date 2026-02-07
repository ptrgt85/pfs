<script lang="ts">
  // UserManagementModal Component - User, role, and invite management
  
  interface User {
    id: number;
    email: string;
    name: string;
    isMaster: boolean;
    isActive?: boolean;
    roleName?: string;
    roleId?: number;
    companyId?: number;
    lastLogin?: string;
    password?: string;
  }
  
  interface Role {
    id: number;
    name: string;
    description?: string;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canInvite: boolean;
    canManageRoles: boolean;
  }
  
  interface Company {
    id: number;
    name: string;
  }
  
  let {
    show,
    currentUser,
    onClose,
    onLog
  }: {
    show: boolean;
    currentUser: User | null;
    onClose: () => void;
    onLog: (message: string, type?: 'success' | 'error' | 'loading' | 'info' | 'warning') => void;
  } = $props();
  
  // Local state
  let managementTab: 'users' | 'roles' | 'invites' | 'activity' = $state('users');
  let loadingManagement = $state(false);
  let managementError = $state('');
  
  let allUsers: User[] = $state([]);
  let allRoles: Role[] = $state([]);
  let allCompanies: Company[] = $state([]);
  let editingUser: User | null = $state(null);
  
  let newUserForm = $state({
    name: '',
    email: '',
    password: '',
    roleId: 0,
    isMaster: false
  });
  
  let newRoleForm = $state({
    name: '',
    description: '',
    canView: true,
    canEdit: false,
    canDelete: false,
    canInvite: false,
    canManageRoles: false
  });
  
  // Load data when modal opens
  $effect(() => {
    if (show) {
      loadManagementData();
    }
  });
  
  async function loadManagementData() {
    loadingManagement = true;
    managementError = '';
    
    try {
      const [usersRes, rolesRes, companiesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/roles'),
        fetch('/api/companies')
      ]);
      
      if (usersRes.ok) allUsers = await usersRes.json();
      if (rolesRes.ok) allRoles = await rolesRes.json();
      if (companiesRes.ok) allCompanies = await companiesRes.json();
    } catch (e) {
      managementError = 'Failed to load management data';
    }
    
    loadingManagement = false;
  }
  
  async function createUser() {
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      managementError = 'Name, email and password are required';
      return;
    }
    
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm)
      });
      
      if (res.ok) {
        onLog('User created successfully', 'success');
        newUserForm = { name: '', email: '', password: '', roleId: 0, isMaster: false };
        await loadManagementData();
      } else {
        const data = await res.json();
        managementError = data.error || 'Failed to create user';
      }
    } catch (e) {
      managementError = 'Failed to create user';
    }
  }
  
  function startEditUser(user: User) {
    editingUser = { ...user, password: '' };
  }
  
  function cancelEditUser() {
    editingUser = null;
  }
  
  async function saveEditUser() {
    if (!editingUser) return;
    
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser)
      });
      
      if (res.ok) {
        onLog('User updated successfully', 'success');
        editingUser = null;
        await loadManagementData();
      } else {
        const data = await res.json();
        managementError = data.error || 'Failed to update user';
      }
    } catch (e) {
      managementError = 'Failed to update user';
    }
  }
  
  async function toggleUserStatus(user: User) {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, isActive: !user.isActive })
      });
      
      if (res.ok) {
        onLog(`User ${user.isActive ? 'disabled' : 'enabled'}`, 'success');
        await loadManagementData();
      }
    } catch (e) {
      managementError = 'Failed to update user status';
    }
  }
  
  async function createRole() {
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
      
      if (res.ok) {
        onLog('Role created successfully', 'success');
        newRoleForm = { name: '', description: '', canView: true, canEdit: false, canDelete: false, canInvite: false, canManageRoles: false };
        await loadManagementData();
      } else {
        const data = await res.json();
        managementError = data.error || 'Failed to create role';
      }
    } catch (e) {
      managementError = 'Failed to create role';
    }
  }
</script>

{#if show}
  <div class="modal-overlay" role="presentation">
    <div class="modal user-management-modal" role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <span>👥 User & Role Management</span>
        <button class="btn-cancel" onclick={onClose}>✕</button>
      </div>
      
      <div class="management-tabs">
        <button class:active={managementTab === 'users'} onclick={() => managementTab = 'users'}>Users</button>
        <button class:active={managementTab === 'roles'} onclick={() => managementTab = 'roles'}>Roles</button>
        <button class:active={managementTab === 'invites'} onclick={() => managementTab = 'invites'}>Invitations</button>
        <button class:active={managementTab === 'activity'} onclick={() => managementTab = 'activity'}>Activity Log</button>
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
                {#if currentUser?.isMaster}
                  <label class="checkbox-label">
                    <input type="checkbox" bind:checked={newUserForm.isMaster} /> Master
                  </label>
                {/if}
                <button class="btn-primary" onclick={createUser}>Create User</button>
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
                  <button class="btn-primary" onclick={saveEditUser}>Save</button>
                  <button class="btn-cancel" onclick={cancelEditUser}>Cancel</button>
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
                  <th>Status</th>
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
                    <td>
                      <span class="status-badge" class:active={user.isActive}>{user.isActive ? 'Active' : 'Disabled'}</span>
                    </td>
                    <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <button class="btn-small edit-btn" onclick={() => startEditUser(user)}>Edit</button>
                      <button class="btn-small" onclick={() => toggleUserStatus(user)}>
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
                <button class="btn-primary" onclick={createRole}>Create Role</button>
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
                    <td>{role.name}</td>
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
            <p class="empty-state">Invitation management coming soon...</p>
          </div>
        {:else if managementTab === 'activity'}
          <div class="management-section">
            <p class="empty-state">Activity log coming soon...</p>
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn-cancel" onclick={onClose}>Close</button>
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
  
  .user-management-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    width: 900px;
    max-width: 95vw;
    max-height: 85vh;
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
  
  .management-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-primary);
  }
  
  .management-tabs button {
    padding: 10px 20px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
  }
  
  .management-tabs button:hover {
    color: var(--text-primary);
  }
  
  .management-tabs button.active {
    color: var(--accent-primary);
    border-bottom-color: var(--accent-primary);
  }
  
  .modal-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }
  
  .management-error {
    padding: 10px;
    background: rgba(247, 118, 142, 0.1);
    border: 1px solid var(--accent-error);
    border-radius: 4px;
    color: var(--accent-error);
    margin-bottom: 16px;
    font-size: 12px;
  }
  
  .management-section {
    margin-bottom: 24px;
  }
  
  .management-section h4 {
    margin: 0 0 12px 0;
    color: var(--text-primary);
    font-size: 13px;
  }
  
  .form-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .form-row input,
  .form-row select {
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 12px;
  }
  
  .permissions-row {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-top: 8px;
  }
  
  .permissions-row label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-secondary);
    font-size: 12px;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-secondary);
    font-size: 12px;
  }
  
  .management-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  
  .management-table th,
  .management-table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }
  
  .management-table th {
    background: var(--bg-primary);
    color: var(--text-muted);
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
  }
  
  .management-table tr.inactive {
    opacity: 0.5;
  }
  
  .management-table tr.editing {
    background: rgba(122, 162, 247, 0.1);
  }
  
  .role-badge {
    padding: 2px 8px;
    background: rgba(122, 162, 247, 0.2);
    color: var(--accent-primary);
    border-radius: 3px;
    font-size: 10px;
  }
  
  .status-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 10px;
  }
  
  .status-badge.active {
    background: rgba(158, 206, 106, 0.2);
    color: var(--accent-success);
  }
  
  .btn-small {
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    margin-right: 4px;
  }
  
  .btn-small:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  
  .loading-state, .empty-state {
    color: var(--text-muted);
    font-size: 12px;
    font-style: italic;
    text-align: center;
    padding: 24px;
  }
  
  .modal-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  
  .btn-cancel, .btn-primary {
    padding: 8px 16px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  
  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }
  
  .btn-primary {
    background: var(--accent-primary);
    border: none;
    color: var(--bg-primary);
    font-weight: 600;
  }
</style>
