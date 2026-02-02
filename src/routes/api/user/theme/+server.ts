import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const sessionToken = cookies.get('session');
  
  if (!sessionToken) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  // Get session and user
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionToken));
  
  if (!session || new Date(session.expiresAt) < new Date()) {
    return json({ error: 'Session expired' }, { status: 401 });
  }
  
  const { theme } = await request.json();
  
  // Validate theme
  const validThemes = ['default', 'tokyo-night', 'console', 'ocean'];
  if (!validThemes.includes(theme)) {
    return json({ error: 'Invalid theme' }, { status: 400 });
  }
  
  // Update user theme preference
  await db.update(users)
    .set({ theme, updatedAt: new Date() })
    .where(eq(users.id, session.userId));
  
  return json({ success: true, theme });
};

export const GET: RequestHandler = async ({ cookies }) => {
  const sessionToken = cookies.get('session');
  
  if (!sessionToken) {
    return json({ theme: 'default' });
  }
  
  // Get session and user
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionToken));
  
  if (!session || new Date(session.expiresAt) < new Date()) {
    return json({ theme: 'default' });
  }
  
  const [user] = await db.select({ theme: users.theme }).from(users).where(eq(users.id, session.userId));
  
  return json({ theme: user?.theme || 'default' });
};
