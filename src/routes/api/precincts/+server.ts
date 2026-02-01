import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { precincts } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getCurrentUser, getUserPermissions, logActivity } from '$lib/permissions';

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canView) {
      return json({ error: 'You do not have permission to view precincts' }, { status: 403 });
    }
    
    const projectId = url.searchParams.get('projectId');
    if (projectId) {
      const precinctsList = await db.query.precincts.findMany({
        where: eq(precincts.projectId, parseInt(projectId)),
        with: { stages: true }
      });
      return json(precinctsList);
    }
    const allPrecincts = await db.query.precincts.findMany({
      with: { stages: true, project: true }
    });
    return json(allPrecincts);
  } catch (error) {
    return json({ error: 'Failed to fetch precincts' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canEdit) {
      return json({ error: 'You do not have permission to create precincts' }, { status: 403 });
    }
    
    const data = await request.json();
    const [newPrecinct] = await db.insert(precincts).values(data).returning();
    
    await logActivity(currentUser.id, 'create', 'precinct', newPrecinct.id, { name: newPrecinct.name });
    
    return json(newPrecinct, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create precinct' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canEdit) {
      return json({ error: 'You do not have permission to edit precincts' }, { status: 403 });
    }
    
    const data = await request.json();
    const { id, ...updateData } = data;
    const [updatedPrecinct] = await db
      .update(precincts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(precincts.id, id))
      .returning();
    
    await logActivity(currentUser.id, 'update', 'precinct', id, updateData);
    
    return json(updatedPrecinct);
  } catch (error) {
    return json({ error: 'Failed to update precinct' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canDelete) {
      return json({ error: 'You do not have permission to delete precincts' }, { status: 403 });
    }
    
    const { id } = await request.json();
    const [precinct] = await db.select().from(precincts).where(eq(precincts.id, id));
    
    await db.delete(precincts).where(eq(precincts.id, id));
    
    await logActivity(currentUser.id, 'delete', 'precinct', id, { name: precinct?.name });
    
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete precinct' }, { status: 500 });
  }
};
