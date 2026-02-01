import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { approvals } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const stageId = url.searchParams.get('stageId');
    if (stageId) {
      const approvalsList = await db.query.approvals.findMany({
        where: eq(approvals.stageId, parseInt(stageId))
      });
      return json(approvalsList);
    }
    const allApprovals = await db.query.approvals.findMany();
    return json(allApprovals);
  } catch (error) {
    return json({ error: 'Failed to fetch approvals' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const [newApproval] = await db.insert(approvals).values(data).returning();
    return json(newApproval, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create approval' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const { id, ...updateData } = data;
    const [updatedApproval] = await db
      .update(approvals)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(approvals.id, id))
      .returning();
    return json(updatedApproval);
  } catch (error) {
    return json({ error: 'Failed to update approval' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    await db.delete(approvals).where(eq(approvals.id, id));
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete approval' }, { status: 500 });
  }
};
