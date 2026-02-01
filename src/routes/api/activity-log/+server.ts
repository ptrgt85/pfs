import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { activityLog, users } from '$lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getCurrentUser, getUserPermissions } from '$lib/permissions';

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    
    // Only admins (canInvite) and master users can view activity logs
    if (!permissions.isMaster && !permissions.canInvite) {
      return json({ error: 'You do not have permission to view activity logs' }, { status: 403 });
    }
    
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Get activity logs with user info
    const logs = await db.select({
      id: activityLog.id,
      userId: activityLog.userId,
      userName: users.name,
      userEmail: users.email,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      details: activityLog.details,
      createdAt: activityLog.createdAt
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset);
    
    return json(logs);
  } catch (error) {
    console.error('Activity log error:', error);
    return json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
};
