import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { permits } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const stageId = url.searchParams.get('stageId');
    if (stageId) {
      const permitsList = await db.query.permits.findMany({
        where: eq(permits.stageId, parseInt(stageId))
      });
      return json(permitsList);
    }
    const allPermits = await db.query.permits.findMany();
    return json(allPermits);
  } catch (error) {
    return json({ error: 'Failed to fetch permits' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const [newPermit] = await db.insert(permits).values(data).returning();
    return json(newPermit, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create permit' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const { id, ...updateData } = data;
    const [updatedPermit] = await db
      .update(permits)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(permits.id, id))
      .returning();
    return json(updatedPermit);
  } catch (error) {
    return json({ error: 'Failed to update permit' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    await db.delete(permits).where(eq(permits.id, id));
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete permit' }, { status: 500 });
  }
};
