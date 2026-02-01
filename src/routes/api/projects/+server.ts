import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { projects } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getCurrentUser, getUserPermissions, logActivity } from '$lib/permissions';

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canView) {
      return json({ error: 'You do not have permission to view projects' }, { status: 403 });
    }
    
    const companyId = url.searchParams.get('companyId');
    if (companyId) {
      const projectsList = await db.query.projects.findMany({
        where: eq(projects.companyId, parseInt(companyId)),
        with: { precincts: true }
      });
      return json(projectsList);
    }
    const allProjects = await db.query.projects.findMany({
      with: { precincts: true, company: true }
    });
    return json(allProjects);
  } catch (error) {
    return json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canEdit) {
      return json({ error: 'You do not have permission to create projects' }, { status: 403 });
    }
    
    const data = await request.json();
    const [newProject] = await db.insert(projects).values(data).returning();
    
    await logActivity(currentUser.id, 'create', 'project', newProject.id, { name: newProject.name });
    
    return json(newProject, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create project' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canEdit) {
      return json({ error: 'You do not have permission to edit projects' }, { status: 403 });
    }
    
    const data = await request.json();
    const { id, ...updateData } = data;
    const [updatedProject] = await db
      .update(projects)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    
    await logActivity(currentUser.id, 'update', 'project', id, updateData);
    
    return json(updatedProject);
  } catch (error) {
    return json({ error: 'Failed to update project' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canDelete) {
      return json({ error: 'You do not have permission to delete projects' }, { status: 403 });
    }
    
    const { id } = await request.json();
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    
    await db.delete(projects).where(eq(projects.id, id));
    
    await logActivity(currentUser.id, 'delete', 'project', id, { name: project?.name });
    
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete project' }, { status: 500 });
  }
};
