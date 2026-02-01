import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, sessions, invitations, userAccess, roles } from '$lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';

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

// Check if user can invite to entity
async function canInvite(userId: number, entityType: string, entityId: number, isMaster: number) {
  if (isMaster) return true;
  
  const [access] = await db.select()
    .from(userAccess)
    .innerJoin(roles, eq(userAccess.roleId, roles.id))
    .where(and(
      eq(userAccess.userId, userId),
      eq(userAccess.entityType, entityType),
      eq(userAccess.entityId, entityId),
      eq(roles.canInvite, 1)
    ));
  
  return !!access;
}

// GET /api/invitations?entityType=...&entityId=...
export const GET: RequestHandler = async ({ url, cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  
  let query = db.select({
    id: invitations.id,
    email: invitations.email,
    token: invitations.token,
    entityType: invitations.entityType,
    entityId: invitations.entityId,
    roleName: roles.name,
    expiresAt: invitations.expiresAt,
    acceptedAt: invitations.acceptedAt,
    createdAt: invitations.createdAt
  })
  .from(invitations)
  .innerJoin(roles, eq(invitations.roleId, roles.id));
  
  if (entityType && entityId) {
    query = query.where(and(
      eq(invitations.entityType, entityType),
      eq(invitations.entityId, parseInt(entityId))
    )) as typeof query;
  }
  
  const result = await query;
  return json(result);
};

// POST /api/invitations - create invitation
export const POST: RequestHandler = async ({ request, cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const { email, roleId, entityType, entityId } = await request.json();
  
  if (!email || !roleId || !entityType || !entityId) {
    return json({ error: 'email, roleId, entityType, and entityId are required' }, { status: 400 });
  }
  
  // Check permission
  const allowed = await canInvite(currentUser.id, entityType, entityId, currentUser.isMaster || 0);
  if (!allowed) {
    return json({ error: 'You do not have permission to invite users to this group' }, { status: 403 });
  }
  
  // Check if user already exists
  const [existingUser] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existingUser) {
    // User exists - grant access directly instead of invitation
    const [existingAccess] = await db.select()
      .from(userAccess)
      .where(and(
        eq(userAccess.userId, existingUser.id),
        eq(userAccess.entityType, entityType),
        eq(userAccess.entityId, entityId)
      ));
    
    if (existingAccess) {
      return json({ error: 'User already has access to this group' }, { status: 400 });
    }
    
    await db.insert(userAccess).values({
      userId: existingUser.id,
      roleId,
      entityType,
      entityId,
      grantedBy: currentUser.id
    });
    
    return json({ success: true, message: 'Access granted to existing user' });
  }
  
  // Create invitation
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const [invitation] = await db.insert(invitations).values({
    email: email.toLowerCase(),
    token,
    roleId,
    entityType,
    entityId,
    invitedBy: currentUser.id,
    expiresAt
  }).returning();
  
  return json({
    id: invitation.id,
    token: invitation.token,
    inviteUrl: `/invite/${token}`
  });
};

// DELETE /api/invitations?id=...
export const DELETE: RequestHandler = async ({ url, cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const id = url.searchParams.get('id');
  if (!id) {
    return json({ error: 'id is required' }, { status: 400 });
  }
  
  // Get invitation to check permission
  const [invitation] = await db.select().from(invitations).where(eq(invitations.id, parseInt(id)));
  if (!invitation) {
    return json({ error: 'Invitation not found' }, { status: 404 });
  }
  
  const allowed = await canInvite(currentUser.id, invitation.entityType, invitation.entityId, currentUser.isMaster || 0);
  if (!allowed) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  await db.delete(invitations).where(eq(invitations.id, parseInt(id)));
  
  return json({ success: true });
};
