import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { companies, users, sessions, userAccess, roles, activityLog } from '$lib/db/schema';
import { eq, and, gt, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';

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

// Get companies user has access to
async function getUserCompanyIds(userId: number): Promise<number[]> {
  const access = await db.select({ entityId: userAccess.entityId })
    .from(userAccess)
    .where(and(
      eq(userAccess.userId, userId),
      eq(userAccess.entityType, 'company')
    ));
  return access.map(a => a.entityId);
}

// Log activity
async function logActivity(userId: number | null, action: string, entityType: string, entityId: number | null, details?: any) {
  try {
    await db.insert(activityLog).values({
      userId,
      action,
      entityType,
      entityId,
      details: details ? JSON.stringify(details) : null
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let allCompanies;
    
    if (currentUser.isMaster) {
      // Master sees ALL companies
      allCompanies = await db.query.companies.findMany({
        with: { projects: true }
      });
    } else {
      // Regular users see only companies they have access to
      const companyIds = await getUserCompanyIds(currentUser.id);
      if (companyIds.length === 0) {
        return json([]);
      }
      allCompanies = await db.query.companies.findMany({
        where: inArray(companies.id, companyIds),
        with: { projects: true }
      });
    }
    
    return json(allCompanies);
  } catch (error) {
    return json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await request.json();
    
    // Set createdBy to current user
    const [newCompany] = await db.insert(companies).values({
      ...data,
      createdBy: currentUser.id
    }).returning();
    
    // Auto-grant Admin role to creator
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, 'Admin'));
    if (adminRole) {
      await db.insert(userAccess).values({
        userId: currentUser.id,
        roleId: adminRole.id,
        entityType: 'company',
        entityId: newCompany.id,
        grantedBy: currentUser.id
      });
    }
    
    // Log activity
    await logActivity(currentUser.id, 'create', 'company', newCompany.id, { name: newCompany.name });
    
    return json(newCompany, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create company' }, { status: 500 });
  }
};

// Check if user can edit company (has Admin/Editor role or is master)
async function canEditCompany(userId: number, companyId: number, isMaster: number): Promise<boolean> {
  if (isMaster) return true;
  
  const [access] = await db.select()
    .from(userAccess)
    .innerJoin(roles, eq(userAccess.roleId, roles.id))
    .where(and(
      eq(userAccess.userId, userId),
      eq(userAccess.entityType, 'company'),
      eq(userAccess.entityId, companyId),
      eq(roles.canEdit, 1)
    ));
  
  return !!access;
}

export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await request.json();
    const { id, ...updateData } = data;
    
    // Check permission
    const canEdit = await canEditCompany(currentUser.id, id, currentUser.isMaster || 0);
    if (!canEdit) {
      return json({ error: 'You do not have permission to edit this company' }, { status: 403 });
    }
    
    const [updatedCompany] = await db
      .update(companies)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    
    await logActivity(currentUser.id, 'update', 'company', id, updateData);
    
    return json(updatedCompany);
  } catch (error) {
    return json({ error: 'Failed to update company' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await request.json();
    
    // Only master or company creator can delete
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (!company) {
      return json({ error: 'Company not found' }, { status: 404 });
    }
    
    if (!currentUser.isMaster && company.createdBy !== currentUser.id) {
      return json({ error: 'Only the creator or master can delete this company' }, { status: 403 });
    }
    
    await db.delete(companies).where(eq(companies.id, id));
    await logActivity(currentUser.id, 'delete', 'company', id, { name: company.name });
    
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete company' }, { status: 500 });
  }
};
