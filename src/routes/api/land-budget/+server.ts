import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { landBudgetItems, lots, stages, precincts } from '$lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getCurrentUser, getUserPermissions, logActivity } from '$lib/permissions';

// Fixed category structure - these cannot be changed by users
const _LAND_BUDGET_CATEGORIES = {
  totalSiteArea: {
    name: 'Total Site Area',
    isHeader: true,
    subcategories: []
  },
  transport: {
    name: 'Transport',
    isHeader: true,
    subcategories: [
      { key: 'arterialRoads', name: 'Arterial Roads' },
      { key: 'roadWidening', name: 'Road Widening' }
    ]
  },
  community: {
    name: 'Community',
    isHeader: true,
    subcategories: [
      { key: 'community', name: 'Community' },
      { key: 'communityConstructed', name: 'Community (constructed)' },
      { key: 'communityStadiumDrive', name: 'Community (stadium drive)' }
    ]
  },
  education: {
    name: 'Education',
    isHeader: true,
    subcategories: [
      { key: 'governmentSchool', name: 'Government School' },
      { key: 'nonGovernmentSchool', name: 'Non Government School' }
    ]
  },
  openSpaceNetwork: {
    name: 'Open Space Network',
    isHeader: true,
    subcategories: []
  },
  encumberedOpenSpace: {
    name: 'Encumbered Open Space',
    isHeader: true,
    parent: 'openSpaceNetwork',
    subcategories: [
      { key: 'infrastructureEasements', name: 'Infrastructure Easements' },
      { key: 'drainage', name: 'Drainage' },
      { key: 'conservationAreas', name: 'Conservation Areas' }
    ]
  },
  creditedOpenSpace: {
    name: 'Credited Open Space',
    isHeader: true,
    parent: 'openSpaceNetwork',
    subcategories: [
      { key: 'regionalPark', name: 'Regional Park' },
      { key: 'sportsReservesInside', name: 'Sports Reserves inside regional parks' },
      { key: 'sportsReservesOutside', name: 'Sports Reserves outside regional parks' },
      { key: 'localNetworkParks', name: 'Local Network Parks' },
      { key: 'linearParks', name: 'Linear Parks' }
    ]
  },
  total: {
    name: 'Total',
    isHeader: true,
    isCalculated: true,
    subcategories: []
  },
  netResidentialArea: {
    name: 'Net Residential Area (NRA)',
    isHeader: true,
    subcategories: []
  },
  residential: {
    name: 'Residential',
    isHeader: true,
    parent: 'netResidentialArea',
    subcategories: [
      { key: 'standardResidential', name: 'Standard Residential Areas' },
      { key: 'townCentreResidential', name: 'Town Centre Residential Areas' },
      { key: 'mixedUseResidential', name: 'Mixed Use Sites with Residential (Section B)' }
    ]
  },
  roads: {
    name: 'Roads',
    isHeader: true,
    parent: 'netResidentialArea',
    subcategories: [
      { key: 'connectorRoads', name: 'Connector Roads' },
      { key: 'localRoads', name: 'Local Roads', isPercentOfNSA: true }
    ]
  },
  totalNRA: {
    name: 'Total Net Residential Area (NRA)',
    isHeader: true,
    isCalculated: true,
    subcategories: []
  },
  nonResidentialAreas: {
    name: 'Non Residential Areas',
    isHeader: true,
    subcategories: [
      { key: 'majorActivityCentre', name: 'Major Activity Centre' },
      { key: 'localActivityCentre', name: 'Local Activity Centre' }
    ]
  },
  totalNDA: {
    name: 'Total Net Developable Area (NDA)',
    isHeader: true,
    isCalculated: true,
    subcategories: []
  }
};

// GET - Fetch land budget for a stage or precinct (aggregated)
export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canView) {
      return json({ error: 'You do not have permission to view land budget' }, { status: 403 });
    }
    
    const stageId = url.searchParams.get('stageId');
    const precinctId = url.searchParams.get('precinctId');
    
    if (!stageId && !precinctId) {
      return json({ error: 'stageId or precinctId is required' }, { status: 400 });
    }
    
    if (stageId) {
      // Stage-level: return editable items for this stage
      const items = await db.select().from(landBudgetItems)
        .where(eq(landBudgetItems.stageId, parseInt(stageId)))
        .orderBy(landBudgetItems.sortOrder);
      
      // Get lot area for this stage
      const lotAreaResult = await db.select({
        totalArea: sql<string>`COALESCE(SUM(${lots.area}), 0)`
      })
      .from(lots)
      .where(eq(lots.stageId, parseInt(stageId)));
      
      const totalLotAreaSqm = parseFloat(lotAreaResult[0]?.totalArea || '0');
      const totalLotAreaHa = totalLotAreaSqm / 10000;
      
      return json({
        items,
        categories: _LAND_BUDGET_CATEGORIES,
        lotAreaHa: totalLotAreaHa,
        lotAreaSqm: totalLotAreaSqm,
        mode: 'stage'
      });
    } else {
      // Precinct-level: aggregate data from all stages in this precinct
      // First get all stages in this precinct
      const precinctStages = await db.select({ id: stages.id, name: stages.name })
        .from(stages)
        .where(eq(stages.precinctId, parseInt(precinctId!)));
      
      const stageIds = precinctStages.map(s => s.id);
      
      let items: any[] = [];
      let stageData: Record<number, { name: string; items: any[] }> = {};
      
      if (stageIds.length > 0) {
        // Get all land budget items for stages in this precinct
        items = await db.select().from(landBudgetItems)
          .where(inArray(landBudgetItems.stageId, stageIds))
          .orderBy(landBudgetItems.sortOrder);
        
        // Group items by stage
        for (const stage of precinctStages) {
          stageData[stage.id] = {
            name: stage.name,
            items: items.filter(i => i.stageId === stage.id)
          };
        }
      }
      
      // Get total lot area for all stages in precinct
      const lotAreaResult = await db.select({
        totalArea: sql<string>`COALESCE(SUM(${lots.area}), 0)`
      })
      .from(lots)
      .innerJoin(stages, eq(lots.stageId, stages.id))
      .where(eq(stages.precinctId, parseInt(precinctId!)));
      
      const totalLotAreaSqm = parseFloat(lotAreaResult[0]?.totalArea || '0');
      const totalLotAreaHa = totalLotAreaSqm / 10000;
      
      return json({
        items,
        stageData,
        stages: precinctStages,
        categories: _LAND_BUDGET_CATEGORIES,
        lotAreaHa: totalLotAreaHa,
        lotAreaSqm: totalLotAreaSqm,
        mode: 'precinct'
      });
    }
  } catch (error) {
    console.error('Land budget GET error:', error);
    return json({ error: 'Failed to fetch land budget' }, { status: 500 });
  }
};

// POST - Create or update land budget item
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canEdit) {
      return json({ error: 'You do not have permission to edit land budget' }, { status: 403 });
    }
    
    const data = await request.json();
    const { precinctId, category, subcategory, customName, areaHa, isCustom, sortOrder } = data;
    
    if (!precinctId || !category) {
      return json({ error: 'precinctId and category are required' }, { status: 400 });
    }
    
    // Check if item already exists
    const existing = await db.select().from(landBudgetItems)
      .where(and(
        eq(landBudgetItems.precinctId, precinctId),
        eq(landBudgetItems.category, category),
        subcategory ? eq(landBudgetItems.subcategory, subcategory) : sql`${landBudgetItems.subcategory} IS NULL`
      ));
    
    let result;
    if (existing.length > 0) {
      // Update existing
      [result] = await db.update(landBudgetItems)
        .set({ 
          areaHa: areaHa?.toString() || null,
          customName,
          isCustom: isCustom || 0,
          sortOrder: sortOrder || 0,
          updatedAt: new Date()
        })
        .where(eq(landBudgetItems.id, existing[0].id))
        .returning();
      
      await logActivity(currentUser.id, 'update', 'landBudget', result.id, { category, subcategory, areaHa });
    } else {
      // Insert new
      [result] = await db.insert(landBudgetItems)
        .values({
          precinctId,
          category,
          subcategory,
          customName,
          areaHa: areaHa?.toString() || null,
          isCustom: isCustom || 0,
          sortOrder: sortOrder || 0
        })
        .returning();
      
      await logActivity(currentUser.id, 'create', 'landBudget', result.id, { category, subcategory, areaHa });
    }
    
    return json(result, { status: 201 });
  } catch (error) {
    console.error('Land budget POST error:', error);
    return json({ error: 'Failed to save land budget item' }, { status: 500 });
  }
};

// PUT - Bulk update land budget items for a stage
export const PUT: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canEdit) {
      return json({ error: 'You do not have permission to edit land budget' }, { status: 403 });
    }
    
    const { stageId, items } = await request.json();
    
    if (!stageId || !items) {
      return json({ error: 'stageId and items are required' }, { status: 400 });
    }
    
    // Process each item
    for (const item of items) {
      const { category, subcategory, customName, areaHa, isCustom, sortOrder } = item;
      
      const existing = await db.select().from(landBudgetItems)
        .where(and(
          eq(landBudgetItems.stageId, stageId),
          eq(landBudgetItems.category, category),
          subcategory ? eq(landBudgetItems.subcategory, subcategory) : sql`${landBudgetItems.subcategory} IS NULL`
        ));
      
      if (existing.length > 0) {
        await db.update(landBudgetItems)
          .set({ 
            areaHa: areaHa?.toString() || null,
            customName,
            isCustom: isCustom || 0,
            sortOrder: sortOrder || 0,
            updatedAt: new Date()
          })
          .where(eq(landBudgetItems.id, existing[0].id));
      } else if (areaHa !== null && areaHa !== undefined && areaHa !== '') {
        await db.insert(landBudgetItems)
          .values({
            stageId,
            category,
            subcategory,
            customName,
            areaHa: areaHa?.toString() || null,
            isCustom: isCustom || 0,
            sortOrder: sortOrder || 0
          });
      }
    }
    
    await logActivity(currentUser.id, 'update', 'landBudget', stageId, { itemCount: items.length });
    
    return json({ success: true });
  } catch (error) {
    console.error('Land budget PUT error:', error);
    return json({ error: 'Failed to update land budget' }, { status: 500 });
  }
};

// DELETE - Remove a custom subcategory
export const DELETE: RequestHandler = async ({ request, cookies }) => {
  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const permissions = await getUserPermissions(currentUser.id, currentUser.isMaster || 0);
    if (!permissions.canDelete) {
      return json({ error: 'You do not have permission to delete land budget items' }, { status: 403 });
    }
    
    const { id } = await request.json();
    
    // Only allow deleting custom items
    const [item] = await db.select().from(landBudgetItems).where(eq(landBudgetItems.id, id));
    if (!item) {
      return json({ error: 'Item not found' }, { status: 404 });
    }
    
    if (item.isCustom !== 1) {
      return json({ error: 'Cannot delete default categories' }, { status: 400 });
    }
    
    await db.delete(landBudgetItems).where(eq(landBudgetItems.id, id));
    
    await logActivity(currentUser.id, 'delete', 'landBudget', id, { category: item.category, subcategory: item.subcategory });
    
    return json({ success: true });
  } catch (error) {
    console.error('Land budget DELETE error:', error);
    return json({ error: 'Failed to delete land budget item' }, { status: 500 });
  }
};
