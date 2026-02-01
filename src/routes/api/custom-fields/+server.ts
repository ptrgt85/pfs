import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { customFields } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const entityType = url.searchParams.get('entityType');
    if (entityType) {
      const fields = await db.select().from(customFields)
        .where(and(
          eq(customFields.entityType, entityType),
          eq(customFields.isActive, 1)
        ));
      return json(fields);
    }
    const allFields = await db.select().from(customFields);
    return json(allFields);
  } catch (error) {
    return json({ error: 'Failed to fetch custom fields' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    // Check if field already exists
    const existing = await db.select().from(customFields)
      .where(and(
        eq(customFields.entityType, data.entityType),
        eq(customFields.fieldKey, data.fieldKey)
      ));
    
    if (existing.length > 0) {
      // Reactivate if it exists but was inactive
      const [updated] = await db.update(customFields)
        .set({ isActive: 1 })
        .where(eq(customFields.id, existing[0].id))
        .returning();
      return json(updated);
    }
    
    const [newField] = await db.insert(customFields).values(data).returning();
    return json(newField, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create custom field' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    // Soft delete by setting isActive to 0
    await db.update(customFields)
      .set({ isActive: 0 })
      .where(eq(customFields.id, id));
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete custom field' }, { status: 500 });
  }
};
