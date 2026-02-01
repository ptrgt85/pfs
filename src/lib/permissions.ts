import { db } from '$lib/db';
import { users, sessions, userAccess, roles, activityLog } from '$lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export interface UserPermissions {
  userId: number;
  isMaster: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canInvite: boolean;
  canManageRoles: boolean;
  companyIds: number[]; // Companies the user has access to
}

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  isMaster: number | null;
  isActive: number | null;
}

// Get current user from session cookie
export async function getCurrentUser(cookies: any): Promise<CurrentUser | null> {
  const sessionId = cookies.get('session');
  if (!sessionId) return null;
  
  const [session] = await db.select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));
  
  if (!session) return null;
  
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user?.isActive ? user : null;
}

// Get user's permissions for a specific company
export async function getUserPermissions(userId: number, isMaster: number): Promise<UserPermissions> {
  // Get all access records for user
  const accessRecords = await db.select({
    entityType: userAccess.entityType,
    entityId: userAccess.entityId,
    canView: roles.canView,
    canEdit: roles.canEdit,
    canDelete: roles.canDelete,
    canInvite: roles.canInvite,
    canManageRoles: roles.canManageRoles
  })
  .from(userAccess)
  .innerJoin(roles, eq(userAccess.roleId, roles.id))
  .where(eq(userAccess.userId, userId));
  
  // Aggregate permissions (OR across all access records)
  const permissions: UserPermissions = {
    userId,
    isMaster: !!isMaster,
    canView: !!isMaster || accessRecords.some(a => a.canView === 1),
    canEdit: !!isMaster || accessRecords.some(a => a.canEdit === 1),
    canDelete: !!isMaster || accessRecords.some(a => a.canDelete === 1),
    canInvite: !!isMaster || accessRecords.some(a => a.canInvite === 1),
    canManageRoles: !!isMaster || accessRecords.some(a => a.canManageRoles === 1),
    companyIds: accessRecords.filter(a => a.entityType === 'company').map(a => a.entityId)
  };
  
  return permissions;
}

// Check if user can perform action on a specific company
export async function canUserAccessCompany(userId: number, companyId: number, isMaster: number): Promise<UserPermissions | null> {
  if (isMaster) {
    return {
      userId,
      isMaster: true,
      canView: true,
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageRoles: true,
      companyIds: [companyId]
    };
  }
  
  // Check if user has access to this company
  const [access] = await db.select({
    canView: roles.canView,
    canEdit: roles.canEdit,
    canDelete: roles.canDelete,
    canInvite: roles.canInvite,
    canManageRoles: roles.canManageRoles
  })
  .from(userAccess)
  .innerJoin(roles, eq(userAccess.roleId, roles.id))
  .where(and(
    eq(userAccess.userId, userId),
    eq(userAccess.entityType, 'company'),
    eq(userAccess.entityId, companyId)
  ));
  
  if (!access) return null;
  
  return {
    userId,
    isMaster: false,
    canView: access.canView === 1,
    canEdit: access.canEdit === 1,
    canDelete: access.canDelete === 1,
    canInvite: access.canInvite === 1,
    canManageRoles: access.canManageRoles === 1,
    companyIds: [companyId]
  };
}

// Log activity
export async function logActivity(
  userId: number | null, 
  action: string, 
  entityType: string, 
  entityId: number | null, 
  details?: any,
  ipAddress?: string
) {
  try {
    await db.insert(activityLog).values({
      userId,
      action,
      entityType,
      entityId,
      details: details ? JSON.stringify(details) : null,
      ipAddress: ipAddress || null
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}

// Permission check helpers
export function requireView(permissions: UserPermissions): void {
  if (!permissions.canView) {
    throw new PermissionError('You do not have permission to view this resource');
  }
}

export function requireEdit(permissions: UserPermissions): void {
  if (!permissions.canEdit) {
    throw new PermissionError('You do not have permission to edit this resource');
  }
}

export function requireDelete(permissions: UserPermissions): void {
  if (!permissions.canDelete) {
    throw new PermissionError('You do not have permission to delete this resource');
  }
}

export function requireInvite(permissions: UserPermissions): void {
  if (!permissions.canInvite) {
    throw new PermissionError('You do not have permission to invite users');
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}
