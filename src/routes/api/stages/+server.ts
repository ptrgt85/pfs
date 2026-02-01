import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { stages } from '$lib/db/schema';
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
      return json({ error: 'You do not have permission to view stages' }, { status: 403 });
    }
    
    const precinctId = url.searchParams.get('precinctId');
    if (precinctId) {
      const stagesList = await db.query.stages.findMany({
        where: eq(stages.precinctId, parseInt(precinctId)),
        with: { permits: true, approvals: true, invoices: true, lots: true }
      });
      return json(stagesList);
    }
    const allStages = await db.query.stages.findMany({
      with: { permits: true, approvals: true, invoices: true, lots: true, precinct: true }
    });
    return json(allStages);
  } catch (error) {
    return json({ error: 'Failed to fetch stages' }, { status: 500 });
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
      return json({ error: 'You do not have permission to create stages' }, { status: 403 });
    }
    
    const data = await request.json();
    const [newStage] = await db.insert(stages).values(data).returning();
    
    await logActivity(currentUser.id, 'create', 'stage', newStage.id, { name: newStage.name });
    
    return json(newStage, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create stage' }, { status: 500 });
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
      return json({ error: 'You do not have permission to edit stages' }, { status: 403 });
    }
    
    const data = await request.json();
    const { id, ...updateData } = data;
    
    // Convert date strings to Date objects for timestamp fields
    if (updateData.registrationDate) {
      updateData.registrationDate = new Date(updateData.registrationDate);
    }
    if (updateData.settlementDate) {
      updateData.settlementDate = new Date(updateData.settlementDate);
    }
    // Handle actual confirmation fields (convert to integer)
    if (updateData.registrationDateActual !== undefined) {
      updateData.registrationDateActual = updateData.registrationDateActual ? 1 : 0;
    }
    if (updateData.settlementDateActual !== undefined) {
      updateData.settlementDateActual = updateData.settlementDateActual ? 1 : 0;
    }
    
    const [updatedStage] = await db
      .update(stages)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(stages.id, id))
      .returning();
    
    await logActivity(currentUser.id, 'update', 'stage', id, updateData);
    
    return json(updatedStage);
  } catch (error) {
    console.error('Stage update error:', error);
    return json({ error: 'Failed to update stage' }, { status: 500 });
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
      return json({ error: 'You do not have permission to delete stages' }, { status: 403 });
    }
    
    const { id } = await request.json();
    const [stage] = await db.select().from(stages).where(eq(stages.id, id));
    
    await db.delete(stages).where(eq(stages.id, id));
    
    await logActivity(currentUser.id, 'delete', 'stage', id, { name: stage?.name });
    
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete stage' }, { status: 500 });
  }
};
