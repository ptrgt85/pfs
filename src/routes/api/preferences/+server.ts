import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { userPreferences } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/preferences?entityType=precinct&entityId=1
export const GET: RequestHandler = async ({ url }) => {
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  
  if (!entityType || !entityId) {
    return json({ error: 'entityType and entityId are required' }, { status: 400 });
  }
  
  const prefs = await db.select()
    .from(userPreferences)
    .where(and(
      eq(userPreferences.entityType, entityType),
      eq(userPreferences.entityId, parseInt(entityId))
    ));
  
  // Convert to key-value object
  const result: Record<string, string> = {};
  for (const pref of prefs) {
    result[pref.prefKey] = pref.prefValue;
  }
  
  return json(result);
};

// POST /api/preferences - upsert a preference
export const POST: RequestHandler = async ({ request }) => {
  const { entityType, entityId, prefKey, prefValue } = await request.json();
  
  if (!entityType || !entityId || !prefKey || prefValue === undefined) {
    return json({ error: 'entityType, entityId, prefKey, and prefValue are required' }, { status: 400 });
  }
  
  // Check if preference exists
  const existing = await db.select()
    .from(userPreferences)
    .where(and(
      eq(userPreferences.entityType, entityType),
      eq(userPreferences.entityId, entityId),
      eq(userPreferences.prefKey, prefKey)
    ));
  
  if (existing.length > 0) {
    // Update
    await db.update(userPreferences)
      .set({ prefValue: String(prefValue), updatedAt: new Date() })
      .where(eq(userPreferences.id, existing[0].id));
  } else {
    // Insert
    await db.insert(userPreferences).values({
      entityType,
      entityId,
      prefKey,
      prefValue: String(prefValue)
    });
  }
  
  return json({ success: true });
};
