import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, passwordResets } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
  const { email } = await request.json();
  
  if (!email) {
    return json({ error: 'Email is required' }, { status: 400 });
  }
  
  // Find user
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  
  // Always return success to prevent email enumeration
  if (!user) {
    return json({ success: true, message: 'If an account exists, a reset link has been sent' });
  }
  
  // Create reset token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  await db.insert(passwordResets).values({
    userId: user.id,
    token,
    expiresAt
  });
  
  // In production, you would send an email here
  // For now, log the reset link
  const resetUrl = `/reset-password?token=${token}`;
  console.log(`Password reset requested for ${email}. Reset URL: ${resetUrl}`);
  
  return json({ 
    success: true, 
    message: 'If an account exists, a reset link has been sent',
    // DEV ONLY: Include token in response for testing
    _devToken: token,
    _devResetUrl: resetUrl
  });
};
