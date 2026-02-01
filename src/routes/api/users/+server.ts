import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users, sessions, userAccess, roles, companies } from '$lib/db/schema';
import { eq, and, gt, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Helper to get current user from session
async function getCurrentUser(cookies: any) {
  const sessionId = cookies.get('session');
  if (!sessionId) return null;
  
  const [session] = await db.select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));
  
  if (!session) return null;
  
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user?.isActive ? user : null;
}

// Helper to get user's admin companies (companies where user has Admin role)
async function getUserAdminCompanies(userId: number) {
  const adminRole = await db.select().from(roles).where(eq(roles.name, 'Admin'));
  if (!adminRole.length) return [];
  
  const access = await db.select()
    .from(userAccess)
    .where(and(
      eq(userAccess.userId, userId),
      eq(userAccess.roleId, adminRole[0].id),
      eq(userAccess.entityType, 'company')
    ));
  
  return access.map(a => a.entityId);
}

// GET /api/users - list users (master sees all, admin sees users in their companies)
export const GET: RequestHandler = async ({ cookies }) => {
  const currentUser = await getCurrentUser(cookies);
  
  if (!currentUser) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Get all access records with roles and entity info
  const accessList = await db.select({
    userId: userAccess.userId,
    roleId: userAccess.roleId,
    roleName: roles.name,
    entityType: userAccess.entityType,
    entityId: userAccess.entityId
  })
  .from(userAccess)
  .innerJoin(roles, eq(userAccess.roleId, roles.id));
  
  let allUsers;
  let adminCompanyIds: number[] = [];
  
  if (currentUser.isMaster) {
    // Master sees all users
    allUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      isMaster: users.isMaster,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt
    }).from(users);
  } else {
    // Admin sees users in their companies
    adminCompanyIds = await getUserAdminCompanies(currentUser.id);
    if (adminCompanyIds.length === 0) {
      return json([]);
    }
    
    // Get user IDs that have access to these companies
    const companyUserAccess = accessList.filter(a => 
      a.entityType === 'company' && adminCompanyIds.includes(a.entityId)
    );
    const userIdsInCompanies = [...new Set(companyUserAccess.map(a => a.userId))];
    
    if (userIdsInCompanies.length === 0) {
      return json([]);
    }
    
    allUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      isMaster: users.isMaster,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt
    }).from(users).where(inArray(users.id, userIdsInCompanies));
  }
  
  // Map role info to users (include company access info)
  const usersWithRoles = allUsers.map(user => {
    const userAccessList = accessList.filter(a => a.userId === user.id);
    const primaryAccess = userAccessList.find(a => a.entityType === 'company');
    return {
      ...user,
      roleId: primaryAccess?.roleId || null,
      roleName: primaryAccess?.roleName || null,
      companyId: primaryAccess?.entityId || null,
      accessList: userAccessList
    };
  });
  
  return json(usersWithRoles);
};

// POST /api/users - create user (master only)
export const POST: RequestHandler = async ({ request, cookies }) => {
  const currentUser = await getCurrentUser(cookies);
  
  if (!currentUser || !currentUser.isMaster) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const { email, password, name, isMaster, roleId, entityType, entityId } = await request.json();
  
  if (!email || !password || !name) {
    return json({ error: 'Email, password, and name are required' }, { status: 400 });
  }
  
  // Check if exists
  const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existing) {
    return json({ error: 'Email already exists' }, { status: 400 });
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  const [newUser] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
    name,
    isMaster: isMaster ? 1 : 0
  }).returning();
  
  // If role is specified, grant access to the entity
  if (roleId && roleId > 0 && entityId && entityId > 0) {
    await db.insert(userAccess).values({
      userId: newUser.id,
      roleId: roleId,
      entityType: entityType || 'company',
      entityId: entityId,
      grantedBy: currentUser.id
    });
  }
  
  return json({
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    isMaster: newUser.isMaster === 1
  });
};

// PUT /api/users - update user
export const PUT: RequestHandler = async ({ request, cookies }) => {
  const currentUser = await getCurrentUser(cookies);
  if (!currentUser) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const { id, name, email, password, isActive, isMaster, roleId, companyId } = await request.json();
  
  // Check permissions:
  // 1. Users can always update their own profile (name, email, password)
  // 2. Master users can update anyone and change roles/master status
  // 3. Admin users can update users in their companies (not master status)
  
  const isSelf = id === currentUser.id;
  let canEdit = isSelf;
  let canChangeRole = false;
  let canChangeMaster = false;
  let adminCompanyIds: number[] = [];
  
  if (currentUser.isMaster) {
    canEdit = true;
    canChangeRole = true;
    canChangeMaster = true;
  } else if (!isSelf) {
    // Check if current user is admin for target user's company
    adminCompanyIds = await getUserAdminCompanies(currentUser.id);
    const targetAccess = await db.select().from(userAccess)
      .where(and(eq(userAccess.userId, id), eq(userAccess.entityType, 'company')));
    
    const targetCompanyId = targetAccess[0]?.entityId;
    if (targetCompanyId && adminCompanyIds.includes(targetCompanyId)) {
      canEdit = true;
      canChangeRole = true; // Admin can change roles within their company
    }
  }
  
  if (!canEdit) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const updates: any = { updatedAt: new Date() };
  if (name) updates.name = name;
  if (email) updates.email = email.toLowerCase();
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);
  
  // Only users with permission can change these
  if (canChangeRole || canChangeMaster) {
    if (isActive !== undefined) updates.isActive = isActive ? 1 : 0;
  }
  if (canChangeMaster) {
    if (isMaster !== undefined) updates.isMaster = isMaster ? 1 : 0;
  }
  
  // Handle role/company assignment
  if (canChangeRole && roleId && roleId > 0) {
    // Delete existing access
    await db.delete(userAccess).where(eq(userAccess.userId, id));
    
    // Determine company ID
    let targetCompanyId = companyId;
    if (!targetCompanyId && currentUser.isMaster) {
      targetCompanyId = 1; // Default for master
    } else if (!targetCompanyId && adminCompanyIds.length > 0) {
      targetCompanyId = adminCompanyIds[0]; // Admin assigns to their company
    }
    
    if (targetCompanyId) {
      await db.insert(userAccess).values({
        userId: id,
        roleId: roleId,
        entityType: 'company',
        entityId: targetCompanyId,
        grantedBy: currentUser.id
      });
    }
  }
  
  // Master users can assign company access directly
  if (currentUser.isMaster && companyId && companyId > 0 && !roleId) {
    // Just updating company assignment without changing role
    const existingAccess = await db.select().from(userAccess).where(eq(userAccess.userId, id));
    if (existingAccess.length > 0) {
      await db.update(userAccess)
        .set({ entityId: companyId })
        .where(eq(userAccess.userId, id));
    }
  }
  
  await db.update(users).set(updates).where(eq(users.id, id));
  
  return json({ success: true });
};
