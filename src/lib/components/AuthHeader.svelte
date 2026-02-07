<script lang="ts">
  // AuthHeader Component - Top navigation bar with user menu and theme selector
  
  type ThemeId = 'default' | 'tokyo-night' | 'console' | 'ocean' | 'high-contrast';
  
  interface User {
    id: number;
    email: string;
    name: string;
    isMaster: boolean;
    theme?: string;
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
  
  let {
    currentUser,
    version,
    isAdmin,
    canManageUsers,
    userPrimaryRole,
    userCanView,
    userCanEdit,
    userCanDelete,
    onOpenUserManagement,
    onLogout
  }: {
    currentUser: User | null;
    version: string;
    isAdmin: boolean;
    canManageUsers: boolean;
    userPrimaryRole: string | null;
    userCanView: boolean;
    userCanEdit: boolean;
    userCanDelete: boolean;
    onOpenUserManagement: () => void;
    onLogout: () => void;
  } = $props();
  
  // Local state
  let showUserMenu = $state(false);
  let currentTheme: ThemeId = $state('default');
  
  const themes: { id: ThemeId; name: string; tooltip: string }[] = [
    { id: 'default', name: 'Default', tooltip: 'Tokyo Night Dark' },
    { id: 'tokyo-night', name: 'Light', tooltip: 'Tokyo Night Light' },
    { id: 'console', name: 'Console', tooltip: 'Classic Console' },
    { id: 'ocean', name: 'Ocean', tooltip: 'Ocean Blue' },
    { id: 'high-contrast', name: 'Hi-Con', tooltip: 'High Contrast' }
  ];
  
  function applyTheme(theme: ThemeId) {
    currentTheme = theme;
    if (typeof document !== 'undefined') {
      if (theme === 'default') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  }
  
  async function setTheme(theme: ThemeId) {
    applyTheme(theme);
    // Save to server if logged in
    if (currentUser) {
      try {
        await fetch('/api/user/theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme })
        });
      } catch (e) {
        console.error('Failed to save theme preference:', e);
      }
    }
  }
  
  // Apply user's saved theme on mount
  $effect(() => {
    if (currentUser?.theme) {
      applyTheme(currentUser.theme as ThemeId);
    }
  });
</script>

<div class="header">
  <span class="title">◆ Filing System</span>
  <span class="subtitle">v{version}</span>
  <div class="user-section">
    <button class="user-btn" onclick={() => showUserMenu = !showUserMenu}>
      <span class="user-avatar">{currentUser?.name.charAt(0).toUpperCase()}</span>
      <span class="user-name">{currentUser?.name}</span>
      {#if currentUser?.isMaster}<span class="master-badge">Master</span>{/if}
    </button>
    {#if showUserMenu}
      <div class="user-dropdown">
        <div class="dropdown-header">
          <strong>{currentUser?.name}</strong>
          <span class="user-email">{currentUser?.email}</span>
          <span class="user-role-badge" class:master={currentUser?.isMaster} class:admin={isAdmin && !currentUser?.isMaster}>
            {currentUser?.isMaster ? 'Master' : userPrimaryRole || 'No Role'}
          </span>
        </div>
        <div class="dropdown-permissions">
          <span class="perm-item" class:enabled={userCanView}>👁 View</span>
          <span class="perm-item" class:enabled={userCanEdit}>✏️ Edit</span>
          <span class="perm-item" class:enabled={userCanDelete}>🗑 Delete</span>
          <span class="perm-item" class:enabled={isAdmin}>📨 Invite</span>
        </div>
        <div class="dropdown-divider"></div>
        <div class="theme-selector">
          <span class="theme-selector-label">Theme:</span>
          {#each themes as theme}
            <button 
              class="theme-btn {theme.id}" 
              class:active={currentTheme === theme.id}
              onclick={() => setTheme(theme.id)}
              title={theme.tooltip}
            ></button>
          {/each}
        </div>
        <div class="dropdown-divider"></div>
        {#if canManageUsers}
          <button class="dropdown-item" onclick={() => { onOpenUserManagement(); showUserMenu = false; }}>
            Manage Users & Roles
          </button>
          <div class="dropdown-divider"></div>
        {/if}
        <button class="dropdown-item logout" onclick={onLogout}>
          Sign Out
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
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
    color: var(--text-muted);
    font-size: 12px;
  }
  
  .user-section {
    margin-left: auto;
    position: relative;
  }
  
  .user-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 6px 12px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .user-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--accent-primary);
  }
  
  .user-avatar {
    width: 24px;
    height: 24px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 11px;
  }
  
  .master-badge {
    background: var(--accent-secondary);
    color: var(--bg-primary);
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
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
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
    color: var(--text-primary);
  }
  
  .user-email {
    color: var(--text-muted);
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
    color: var(--text-secondary);
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
    color: var(--text-muted);
  }
  
  .perm-item.enabled {
    background: rgba(122, 162, 247, 0.2);
    color: #7aa2f7;
  }
  
  .dropdown-divider {
    height: 1px;
    background: var(--border-color);
  }
  
  .dropdown-item {
    display: block;
    width: 100%;
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .dropdown-item:hover {
    background: var(--bg-tertiary);
  }
  
  .dropdown-item.logout {
    color: #f7768e;
  }
  
  .theme-selector {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    align-items: center;
  }
  
  .theme-selector-label {
    font-size: 11px;
    color: var(--text-muted);
    margin-right: 4px;
  }
  
  .theme-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
  }
  
  .theme-btn:hover {
    transform: scale(1.1);
  }
  
  .theme-btn.active {
    border-color: var(--accent-primary);
    box-shadow: 0 0 8px var(--accent-primary);
  }
  
  .theme-btn.default {
    background: linear-gradient(135deg, #1a1b26 50%, #7aa2f7 50%);
  }
  
  .theme-btn.tokyo-night {
    background: linear-gradient(135deg, #d5d6db 50%, #34548a 50%);
  }
  
  .theme-btn.console {
    background: linear-gradient(135deg, #0a0a0a 50%, #33ff33 50%);
  }
  
  .theme-btn.ocean {
    background: linear-gradient(135deg, #1e3a5f 50%, #5dade2 50%);
  }
  
  .theme-btn.high-contrast {
    background: linear-gradient(135deg, #000000 50%, #ffffff 50%);
  }
</style>
