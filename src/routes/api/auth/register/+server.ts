import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, invitations, userAccess, sessions } from '$lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { email, password, name, inviteToken } = await request.json();
  
  if (!email || !password || !name) {
    return json({ error: 'Email, password, and name are required' }, { status: 400 });
  }
  
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  
  // Check if user already exists
  const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existing) {
    return json({ error: 'Email already registered' }, { status: 400 });
  }
  
  // If invite token provided, validate it
  let invitation = null;
  if (inviteToken) {
    [invitation] = await db.select()
      .from(invitations)
      .where(and(
        eq(invitations.token, inviteToken),
        gt(invitations.expiresAt, new Date())
      ));
    
    if (!invitation) {
      return json({ error: 'Invalid or expired invitation' }, { status: 400 });
    }
    
    if (invitation.acceptedAt) {
      return json({ error: 'Invitation already used' }, { status: 400 });
    }
    
    // Check email matches invitation
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return json({ error: 'Email does not match invitation' }, { status: 400 });
    }
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Create user
  const [newUser] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
    name,
    isMaster: 0
  }).returning();
  
  // If invitation, grant access and mark as accepted
  if (invitation) {
    await db.insert(userAccess).values({
      userId: newUser.id,
      roleId: invitation.roleId,
      entityType: invitation.entityType,
      entityId: invitation.entityId,
      grantedBy: invitation.invitedBy
    });
    
    await db.update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
  }
  
  // Create session
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await db.insert(sessions).values({
    id: sessionId,
    userId: newUser.id,
    expiresAt
  });
  
  cookies.set('session', sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt
  });
  
  return json({
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      isMaster: false
    }
  });
};
