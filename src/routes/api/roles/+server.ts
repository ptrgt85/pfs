import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, sessions, roles } from '$lib/db/schema';
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

// GET /api/roles - list all roles
export const GET: RequestHandler = async ({ cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const allRoles = await db.select().from(roles);
  return json(allRoles);
};

// POST /api/roles - create role (master only)
export const POST: RequestHandler = async ({ request, cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser || !currentUser.isMaster) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const { name, description, canView, canEdit, canDelete, canInvite, canManageRoles } = await request.json();
  
  if (!name) {
    return json({ error: 'Name is required' }, { status: 400 });
  }
  
  const [newRole] = await db.insert(roles).values({
    name,
    description,
    canView: canView ? 1 : 0,
    canEdit: canEdit ? 1 : 0,
    canDelete: canDelete ? 1 : 0,
    canInvite: canInvite ? 1 : 0,
    canManageRoles: canManageRoles ? 1 : 0
  }).returning();
  
  return json(newRole);
};

// PUT /api/roles - update role (master only)
export const PUT: RequestHandler = async ({ request, cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser || !currentUser.isMaster) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const { id, name, description, canView, canEdit, canDelete, canInvite, canManageRoles } = await request.json();
  
  if (!id) {
    return json({ error: 'id is required' }, { status: 400 });
  }
  
  await db.update(roles).set({
    name,
    description,
    canView: canView ? 1 : 0,
    canEdit: canEdit ? 1 : 0,
    canDelete: canDelete ? 1 : 0,
    canInvite: canInvite ? 1 : 0,
    canManageRoles: canManageRoles ? 1 : 0
  }).where(eq(roles.id, id));
  
  return json({ success: true });
};

// DELETE /api/roles?id=...
export const DELETE: RequestHandler = async ({ url, cookies }) => {
  const currentUser = await getCurrentUser(cookies.get('session'));
  if (!currentUser || !currentUser.isMaster) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const id = url.searchParams.get('id');
  if (!id) {
    return json({ error: 'id is required' }, { status: 400 });
  }
  
  await db.delete(roles).where(eq(roles.id, parseInt(id)));
  
  return json({ success: true });
};
