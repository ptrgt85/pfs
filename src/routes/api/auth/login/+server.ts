import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { email, password } = await request.json();
  
  if (!email || !password) {
    return json({ error: 'Email and password are required' }, { status: 400 });
  }
  
  // Find user
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  
  if (!user) {
    return json({ error: 'Invalid email or password' }, { status: 401 });
  }
  
  if (!user.isActive) {
    return json({ error: 'Account is disabled' }, { status: 401 });
  }
  
  // Check password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return json({ error: 'Invalid email or password' }, { status: 401 });
  }
  
  // Create session
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt
  });
  
  // Update last login
  await db.update(users)
    .set({ lastLogin: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  
  // Set cookie
  cookies.set('session', sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt
  });
  
  return json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isMaster: user.isMaster === 1
    }
  });
};
