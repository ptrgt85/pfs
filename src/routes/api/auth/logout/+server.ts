import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ cookies }) => {
  const sessionId = cookies.get('session');
  
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    cookies.delete('session', { path: '/' });
  }
  
  return json({ success: true });
};
