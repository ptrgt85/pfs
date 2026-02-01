import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { productPricing } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
  const projectId = url.searchParams.get('projectId');
  
  if (!projectId) {
    return json({ error: 'projectId required' }, { status: 400 });
  }
  
  try {
    const pricing = await db.select().from(productPricing).where(eq(productPricing.projectId, parseInt(projectId)));
    return json(pricing);
  } catch (e) {
    console.error('Failed to fetch pricing:', e);
    return json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  const { projectId, products } = await request.json();
  
  if (!projectId || !products) {
    return json({ error: 'projectId and products required' }, { status: 400 });
  }
  
  try {
    // Delete existing pricing for this project
    await db.delete(productPricing).where(eq(productPricing.projectId, projectId));
    
    // Insert new pricing
    const insertedProducts = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const [inserted] = await db.insert(productPricing).values({
        projectId,
        productName: p.productName || `${p.frontage}x${p.depth}`,
        frontage: p.frontage.toString(),
        depth: p.depth.toString(),
        baseArea: (p.baseArea || p.frontage * p.depth).toString(),
        basePrice: (p.basePrice || 0).toString(),
        pricePerSqm: (p.pricePerSqm || 0).toString(),
        balanceRate: (p.balanceRate || 50).toString(),
        sortOrder: i
      }).returning();
      insertedProducts.push(inserted);
    }
    
    return json(insertedProducts);
  } catch (e) {
    console.error('Failed to save pricing:', e);
    return json({ error: 'Failed to save pricing' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ url }) => {
  const id = url.searchParams.get('id');
  
  if (!id) {
    return json({ error: 'id required' }, { status: 400 });
  }
  
  try {
    await db.delete(productPricing).where(eq(productPricing.id, parseInt(id)));
    return json({ success: true });
  } catch (e) {
    console.error('Failed to delete pricing:', e);
    return json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
};
