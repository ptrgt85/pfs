import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, sessions, userAccess, roles } from '$lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

// Helper to get current user from session
async function getCurrentUser(sessionId: string | undefined) {
  if (!sessionId) return null;
  
  const [session] = await db.select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));
  
  if (!session) return null;
  
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user?.isActive ? user : null;
}

// GET /api/user-access?entityType=...&entityId=...
export const GET: RequestHandler = async ({ url, cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  const userId = url.searchParams.get('userId');
  
  let conditions = [];
  if (entityType && entityId) {
    conditions.push(eq(userAccess.entityType, entityType));
    conditions.push(eq(userAccess.entityId, parseInt(entityId)));
  }
  if (userId) {
    conditions.push(eq(userAccess.userId, parseInt(userId)));
  }
  
  const result = await db.select({
    id: userAccess.id,
    userId: userAccess.userId,
    userName: users.name,
    userEmail: users.email,
    roleId: userAccess.roleId,
    roleName: roles.name,
    entityType: userAccess.entityType,
    entityId: userAccess.entityId,
    canView: roles.canView,
    canEdit: roles.canEdit,
    canDelete: roles.canDelete,
    canInvite: roles.canInvite,
    canManageRoles: roles.canManageRoles,
    createdAt: userAccess.createdAt
  })
  .from(userAccess)
  .innerJoin(users, eq(userAccess.userId, users.id))
  .innerJoin(roles, eq(userAccess.roleId, roles.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return json(result);
};

// POST /api/user-access - grant access
export const POST: RequestHandler = async ({ request, cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const { userId, roleId, entityType, entityId } = await request.json();
  
  if (!userId || !roleId || !entityType || !entityId) {
    return json({ error: 'userId, roleId, entityType, and entityId are required' }, { status: 400 });
  }
  
  // Check if master or has canManageRoles permission
  if (!currentUser.isMaster) {
    const [access] = await db.select()
      .from(userAccess)
      .innerJoin(roles, eq(userAccess.roleId, roles.id))
      .where(and(
        eq(userAccess.userId, currentUser.id),
        eq(userAccess.entityType, entityType),
        eq(userAccess.entityId, entityId),
        eq(roles.canManageRoles, 1)
      ));
    
    if (!access) {
      return json({ error: 'Unauthorized' }, { status: 403 });
    }
  }
  
  // Check if access already exists
  const [existing] = await db.select()
    .from(userAccess)
    .where(and(
      eq(userAccess.userId, userId),
      eq(userAccess.entityType, entityType),
      eq(userAccess.entityId, entityId)
    ));
  
  if (existing) {
    // Update existing
    await db.update(userAccess)
      .set({ roleId })
      .where(eq(userAccess.id, existing.id));
  } else {
    // Create new
    await db.insert(userAccess).values({
      userId,
      roleId,
      entityType,
      entityId,
      grantedBy: currentUser.id
    });
  }
  
  return json({ success: true });
};

// DELETE /api/user-access?id=...
export const DELETE: RequestHandler = async ({ url, cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const id = url.searchParams.get('id');
  if (!id) {
    return json({ error: 'id is required' }, { status: 400 });
  }
  
  // Get access to check permission
  const [access] = await db.select().from(userAccess).where(eq(userAccess.id, parseInt(id)));
  if (!access) {
    return json({ error: 'Access not found' }, { status: 404 });
  }
  
  // Check permission
  if (!currentUser.isMaster) {
    const [perm] = await db.select()
      .from(userAccess)
      .innerJoin(roles, eq(userAccess.roleId, roles.id))
      .where(and(
        eq(userAccess.userId, currentUser.id),
        eq(userAccess.entityType, access.entityType),
        eq(userAccess.entityId, access.entityId),
        eq(roles.canManageRoles, 1)
      ));
    
    if (!perm) {
      return json({ error: 'Unauthorized' }, { status: 403 });
    }
  }
  
  await db.delete(userAccess).where(eq(userAccess.id, parseInt(id)));
  
  return json({ success: true });
};
