import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, sessions, userAccess, roles } from '$lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies }) => {
  const sessionId = cookies.get('session');
  
  if (!sessionId) {
    return json({ user: null });
  }
  
  // Get session and check expiry
  const [session] = await db.select()
    .from(sessions)
    .where(and(
      eq(sessions.id, sessionId),
      gt(sessions.expiresAt, new Date())
    ));
  
  if (!session) {
    cookies.delete('session', { path: '/' });
    return json({ user: null });
  }
  
  // Get user
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  
  if (!user || !user.isActive) {
    cookies.delete('session', { path: '/' });
    return json({ user: null });
  }
  
  // Get user's access permissions
  const access = await db.select({
    entityType: userAccess.entityType,
    entityId: userAccess.entityId,
    roleName: roles.name,
    canView: roles.canView,
    canEdit: roles.canEdit,
    canDelete: roles.canDelete,
    canInvite: roles.canInvite,
    canManageRoles: roles.canManageRoles
  })
  .from(userAccess)
  .innerJoin(roles, eq(userAccess.roleId, roles.id))
  .where(eq(userAccess.userId, user.id));
  
  return json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isMaster: user.isMaster === 1,
      theme: user.theme || 'default',
      access
    }
  });
};
