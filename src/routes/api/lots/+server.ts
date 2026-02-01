import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { lots, stages, precincts, projects } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getCurrentUser, getUserPermissions, logActivity } from '$lib/permissions';

// Helper to get company ID from a lot (via stage -> precinct -> project -> company)
async function getCompanyIdFromStage(stageId: number): Promise<number | null> {
  const [stage] = await db.select({ precinctId: stages.precinctId }).from(stages).where(eq(stages.id, stageId));
  if (!stage) return null;
  
  const [precinct] = await db.select({ projectId: precincts.projectId }).from(precincts).where(eq(precincts.id, stage.precinctId));
  if (!precinct) return null;
  
  const [project] = await db.select({ companyId: projects.companyId }).from(projects).where(eq(projects.id, precinct.projectId));
  return project?.companyId || null;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canView) {
      return json({ error: 'You do not have permission to view lots' }, { status: 403 });
    }
    
    const stageId = url.searchParams.get('stageId');
    if (stageId) {
      const lotsList = await db.query.lots.findMany({
        where: eq(lots.stageId, parseInt(stageId)),
        with: { subgroups: true }
      });
      return json(lotsList);
    }
    const allLots = await db.query.lots.findMany({
      with: { subgroups: true }
    });
    return json(allLots);
  } catch (error) {
    return json({ error: 'Failed to fetch lots' }, { status: 500 });
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
      return json({ error: 'You do not have permission to create lots' }, { status: 403 });
    }
    
    const data = await request.json();
    const [newLot] = await db.insert(lots).values(data).returning();
    
    // Log activity
    await logActivity(currentUser.id, 'create', 'lot', newLot.id, { 
      lotNumber: newLot.lotNumber,
      stageId: newLot.stageId 
    });
    
    return json(newLot, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create lot' }, { status: 500 });
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
      return json({ error: 'You do not have permission to edit lots' }, { status: 403 });
    }
    
    const data = await request.json();
    const { id, ...updateData } = data;
    const [updatedLot] = await db
      .update(lots)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(lots.id, id))
      .returning();
    
    // Log activity
    await logActivity(currentUser.id, 'update', 'lot', id, updateData);
    
    return json(updatedLot);
  } catch (error) {
    return json({ error: 'Failed to update lot' }, { status: 500 });
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
      return json({ error: 'You do not have permission to delete lots' }, { status: 403 });
    }
    
    const { id } = await request.json();
    
    // Get lot info before deletion for logging
    const [lot] = await db.select().from(lots).where(eq(lots.id, id));
    
    await db.delete(lots).where(eq(lots.id, id));
    
    // Log activity
    await logActivity(currentUser.id, 'delete', 'lot', id, { 
      lotNumber: lot?.lotNumber 
    });
    
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete lot' }, { status: 500 });
  }
};
