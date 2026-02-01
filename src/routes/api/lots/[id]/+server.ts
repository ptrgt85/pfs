import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { lots } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ error: 'Invalid lot ID' }, { status: 400 });
    }
    
    const data = await request.json();
    const [updatedLot] = await db
      .update(lots)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(lots.id, id))
      .returning();
    
    if (!updatedLot) {
      return json({ error: 'Lot not found' }, { status: 404 });
    }
    
    return json(updatedLot);
  } catch (error) {
    console.error('Failed to update lot:', error);
    return json({ error: 'Failed to update lot' }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ params }) => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ error: 'Invalid lot ID' }, { status: 400 });
    }
    
    const lot = await db.query.lots.findFirst({
      where: eq(lots.id, id),
      with: { subgroups: true }
    });
    
    if (!lot) {
      return json({ error: 'Lot not found' }, { status: 404 });
    }
    
    return json(lot);
  } catch (error) {
    return json({ error: 'Failed to fetch lot' }, { status: 500 });
  }
};
