import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { lotSubgroups } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const lotId = url.searchParams.get('lotId');
    if (lotId) {
      const subgroupsList = await db.query.lotSubgroups.findMany({
        where: eq(lotSubgroups.lotId, parseInt(lotId))
      });
      return json(subgroupsList);
    }
    const allSubgroups = await db.query.lotSubgroups.findMany();
    return json(allSubgroups);
  } catch (error) {
    return json({ error: 'Failed to fetch lot subgroups' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const [newSubgroup] = await db.insert(lotSubgroups).values(data).returning();
    return json(newSubgroup, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create lot subgroup' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const { id, ...updateData } = data;
    const [updatedSubgroup] = await db
      .update(lotSubgroups)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(lotSubgroups.id, id))
      .returning();
    return json(updatedSubgroup);
  } catch (error) {
    return json({ error: 'Failed to update lot subgroup' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    await db.delete(lotSubgroups).where(eq(lotSubgroups.id, id));
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete lot subgroup' }, { status: 500 });
  }
};
