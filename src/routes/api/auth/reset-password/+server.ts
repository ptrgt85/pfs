import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, passwordResets, sessions } from '$lib/db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { token, password } = await request.json();
  
  if (!token || !password) {
    return json({ error: 'Token and password are required' }, { status: 400 });
  }
  
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  
  // Find valid reset token
  const [resetRecord] = await db.select()
    .from(passwordResets)
    .where(and(
      eq(passwordResets.token, token),
      gt(passwordResets.expiresAt, new Date()),
      isNull(passwordResets.usedAt)
    ));
  
  if (!resetRecord) {
    return json({ error: 'Invalid or expired reset link' }, { status: 400 });
  }
  
  // Hash new password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Update user password
  await db.update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, resetRecord.userId));
  
  // Mark token as used
  await db.update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.id, resetRecord.id));
  
  // Create session and log user in
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await db.insert(sessions).values({
    id: sessionId,
    userId: resetRecord.userId,
    expiresAt
  });
  
  cookies.set('session', sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt
  });
  
  // Get user details
  const [user] = await db.select().from(users).where(eq(users.id, resetRecord.userId));
  
  return json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isMaster: user.isMaster === 1
    }
  });
};
