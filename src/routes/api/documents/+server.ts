import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { documents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = 'static/uploads';

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
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const entityType = formData.get('entityType') as string;
  const entityId = parseInt(formData.get('entityId') as string);
  const documentType = (formData.get('documentType') as string) || 'other';
  
  if (!file || !entityType || !entityId) {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  // Ensure upload directory exists
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
  
  // Generate unique filename
  const ext = path.extname(file.name);
  const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  
  // Write file
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);
  
  // Save to database
  const [newDoc] = await db.insert(documents).values({
    entityType,
    entityId,
    filename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    documentType
  }).returning();
  
  return json(newDoc);
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  await db.delete(documents).where(eq(documents.id, id));
  return json({ success: true });
};
