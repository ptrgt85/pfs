import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { invoices } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const stageId = url.searchParams.get('stageId');
    if (stageId) {
      const invoicesList = await db.query.invoices.findMany({
        where: eq(invoices.stageId, parseInt(stageId))
      });
      return json(invoicesList);
    }
    const allInvoices = await db.query.invoices.findMany();
    return json(allInvoices);
  } catch (error) {
    return json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const [newInvoice] = await db.insert(invoices).values(data).returning();
    return json(newInvoice, { status: 201 });
  } catch (error) {
    return json({ error: 'Failed to create invoice' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const { id, ...updateData } = data;
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return json(updatedInvoice);
  } catch (error) {
    return json({ error: 'Failed to update invoice' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    await db.delete(invoices).where(eq(invoices.id, id));
    return json({ success: true });
  } catch (error) {
    return json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
};
