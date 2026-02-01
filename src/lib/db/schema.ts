import { pgTable, serial, text, timestamp, integer, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  abn: text('abn'),
  owners: text('owners'),
  createdBy: integer('created_by'), // User who created this company (null for legacy/system companies)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const precincts = pgTable('precincts', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const stages = pgTable('stages', {
  id: serial('id').primaryKey(),
  precinctId: integer('precinct_id').references(() => precincts.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  registrationDate: timestamp('registration_date'),
  registrationDateActual: integer('registration_date_actual').default(0), // 0 = forecast/pending, 1 = actual confirmed
  settlementDate: timestamp('settlement_date'),
  settlementDateActual: integer('settlement_date_actual').default(0), // 0 = forecast/pending, 1 = actual confirmed
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const permits = pgTable('permits', {
  id: serial('id').primaryKey(),
  stageId: integer('stage_id').references(() => stages.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  permitNumber: text('permit_number'),
  status: text('status'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const approvals = pgTable('approvals', {
  id: serial('id').primaryKey(),
  stageId: integer('stage_id').references(() => stages.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  approvalNumber: text('approval_number'),
  status: text('status'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  stageId: integer('stage_id').references(() => stages.id, { onDelete: 'cascade' }).notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }),
  status: text('status'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const lots = pgTable('lots', {
  id: serial('id').primaryKey(),
  stageId: integer('stage_id').references(() => stages.id, { onDelete: 'cascade' }).notNull(),
  lotNumber: text('lot_number').notNull(),
  address: text('address'),
  area: numeric('area', { precision: 10, scale: 2 }),
  frontage: numeric('frontage', { precision: 10, scale: 2 }),
  depth: numeric('depth', { precision: 10, scale: 2 }),
  streetName: text('street_name'),
  status: text('status'),
  price: numeric('price', { precision: 12, scale: 2 }),
  pricePerSqm: numeric('price_per_sqm', { precision: 10, scale: 2 }),
  customData: text('custom_data'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const customFields = pgTable('custom_fields', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  fieldKey: text('field_key').notNull(),
  fieldLabel: text('field_label').notNull(),
  fieldType: text('field_type').default('text'),
  isActive: integer('is_active').default(1),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const lotSubgroups = pgTable('lot_subgroups', {
  id: serial('id').primaryKey(),
  lotId: integer('lot_id').references(() => lots.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  documentType: text('document_type').default('other'), // 'permit_plan', 'plan_subdivision', 'other'
  extractedData: text('extracted_data'),
  aiProcessed: timestamp('ai_processed'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const companiesRelations = relations(companies, ({ many }) => ({
  projects: many(projects)
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  company: one(companies, {
    fields: [projects.companyId],
    references: [companies.id]
  }),
  precincts: many(precincts)
}));

export const precinctsRelations = relations(precincts, ({ one, many }) => ({
  project: one(projects, {
    fields: [precincts.projectId],
    references: [projects.id]
  }),
  stages: many(stages)
}));

export const stagesRelations = relations(stages, ({ one, many }) => ({
  precinct: one(precincts, {
    fields: [stages.precinctId],
    references: [precincts.id]
  }),
  permits: many(permits),
  approvals: many(approvals),
  invoices: many(invoices),
  lots: many(lots)
}));

export const permitsRelations = relations(permits, ({ one }) => ({
  stage: one(stages, {
    fields: [permits.stageId],
    references: [stages.id]
  })
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  stage: one(stages, {
    fields: [approvals.stageId],
    references: [stages.id]
  })
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  stage: one(stages, {
    fields: [invoices.stageId],
    references: [stages.id]
  })
}));

export const lotsRelations = relations(lots, ({ one, many }) => ({
  stage: one(stages, {
    fields: [lots.stageId],
    references: [stages.id]
  }),
  subgroups: many(lotSubgroups)
}));

export const lotSubgroupsRelations = relations(lotSubgroups, ({ one }) => ({
  lot: one(lots, {
    fields: [lotSubgroups.lotId],
    references: [lots.id]
  })
}));

// ===== USER AUTHENTICATION & AUTHORIZATION =====

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  isMaster: integer('is_master').default(0), // 1 = master user (can manage roles/users)
  isActive: integer('is_active').default(1),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Sessions for auth
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // UUID token
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Roles define permission sets
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // e.g., "Admin", "Viewer", "Editor"
  description: text('description'),
  canView: integer('can_view').default(1),
  canEdit: integer('can_edit').default(0),
  canDelete: integer('can_delete').default(0),
  canInvite: integer('can_invite').default(0),
  canManageRoles: integer('can_manage_roles').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// User access to entities (company, project, precinct, etc.)
export const userAccess = pgTable('user_access', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  entityType: text('entity_type').notNull(), // 'company', 'project', 'precinct', etc.
  entityId: integer('entity_id').notNull(),
  grantedBy: integer('granted_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Password reset tokens
export const passwordResets = pgTable('password_resets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Invitations for new users
export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(), // UUID for invitation link
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  invitedBy: integer('invited_by').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// User Preferences - stores UI state per entity (e.g., showForecast for precinct)
export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'precinct', 'project', etc.
  entityId: integer('entity_id').notNull(),
  prefKey: text('pref_key').notNull(), // 'showForecastTool', 'showSummary', etc.
  prefValue: text('pref_value').notNull(), // 'true', 'false', or other values
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Activity Log for audit trail
export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'create', 'update', 'delete', 'invite', 'login', etc.
  entityType: text('entity_type').notNull(), // 'company', 'project', 'user', etc.
  entityId: integer('entity_id'),
  details: text('details'), // JSON string with additional details
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Land Budget for Stages (editable at Stage level, aggregated at Precinct level)
export const landBudgetItems = pgTable('land_budget_items', {
  id: serial('id').primaryKey(),
  precinctId: integer('precinct_id').references(() => precincts.id, { onDelete: 'cascade' }),
  stageId: integer('stage_id').references(() => stages.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // Main category key (fixed)
  subcategory: text('subcategory'), // Subcategory key (can be null for main category totals)
  customName: text('custom_name'), // User-defined name for custom subcategories
  areaHa: numeric('area_ha', { precision: 10, scale: 4 }), // Area in hectares
  isCustom: integer('is_custom').default(0), // 1 = user-added subcategory
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const landBudgetItemsRelations = relations(landBudgetItems, ({ one }) => ({
  precinct: one(precincts, {
    fields: [landBudgetItems.precinctId],
    references: [precincts.id]
  }),
  stage: one(stages, {
    fields: [landBudgetItems.stageId],
    references: [stages.id]
  })
}));

// Product Pricing table for Project Groups
export const productPricing = pgTable('product_pricing', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  productName: text('product_name').notNull(),
  frontage: numeric('frontage', { precision: 10, scale: 2 }).notNull(),
  depth: numeric('depth', { precision: 10, scale: 2 }).notNull(),
  baseArea: numeric('base_area', { precision: 10, scale: 2 }).notNull(),
  basePrice: numeric('base_price', { precision: 12, scale: 2 }).notNull(),
  pricePerSqm: numeric('price_per_sqm', { precision: 10, scale: 2 }).notNull(),
  balanceRate: numeric('balance_rate', { precision: 5, scale: 2 }).default('50'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
