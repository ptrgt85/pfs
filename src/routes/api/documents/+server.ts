import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { documents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { put, del } from '@vercel/blob';

export const GET: RequestHandler = async ({ url }) => {
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  
  if (entityType && entityId) {
    const docs = await db.select().from(documents)
      .where(and(
        eq(documents.entityType, entityType),
        eq(documents.entityId, parseInt(entityId))
      ));
    return json(docs);
  }
  
  const allDocs = await db.select().from(documents);
  return json(allDocs);
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const entityType = formData.get('entityType') as string;
    const entityId = parseInt(formData.get('entityId') as string);
    const documentType = (formData.get('documentType') as string) || 'other';
    
    if (!file || !entityType || !entityId) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
    });
    
    // Save to database with blob URL
    const [newDoc] = await db.insert(documents).values({
      entityType,
      entityId,
      filename: blob.url,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      documentType
    }).returning();
    
    return json(newDoc);
  } catch (error: any) {
    console.error('Upload error:', error);
    return json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  
  // Get document to find blob URL
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  
  if (doc && doc.filename) {
    // Delete from Vercel Blob
    try {
      await del(doc.filename);
    } catch (e) {
      // Ignore blob deletion errors (file may not exist)
    }
  }
  
  await db.delete(documents).where(eq(documents.id, id));
  return json({ success: true });
};
