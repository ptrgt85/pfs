# Refactor Guide — Windsurf Implementation Instructions

Use this file as your source of truth when refactoring `src/routes/+page.svelte`.
Each section maps to a new component file. Follow the instructions IN ORDER.
Do not modify `+page.svelte` until the new component files exist.

---

## RULES FOR WINDSURF

1. Every new component lives in `src/lib/components/`
2. Props use `$props()` (Svelte 5 syntax) — do NOT use `export let`
3. Events use `$props()` callbacks — do NOT use `createEventDispatcher`
4. Keep `$lib/db` imports only in `+server.ts` files — never in `.svelte` components
5. Shared state that multiple components need stays in `+page.svelte`
6. Each component is self-contained: its own state, its own fetch calls, its own styles
7. Do NOT change any business logic — only move code. Behaviour must stay identical.
8. Test each component locally with `npm run dev` before moving to the next one.

---

## SHARED STATE (stays in +page.svelte)

These variables and functions are used by 3+ components.
They MUST remain in `+page.svelte` and be passed down as props.

```typescript
// Core selection — every panel reads this
let selectedNode: TreeNode | null = null;
let tableData: any[] = [];
let currentUser: User | null = null;

// These are read by multiple panels
let customFields: any[] = [];
let hiddenFields: Set<string>;
let orderedFields: string[];

// Reload callbacks — child components call these to refresh shared data
async function reloadTableData()
async function loadDocuments()
async function loadCustomFields()
```

---

## COMPONENT 1 — AuthHeader

**New file:** `src/lib/components/AuthHeader.svelte`

**What it is:**
The top navigation bar: app title, version badge, theme selector, user menu, and the button that opens User Management.

**Move from +page.svelte:**

State (lines ~24–37):
```typescript
let showUserMenu = false;
let currentTheme: ThemeId = 'default';
const themes = [...]; // the 5 theme definitions array
```

Functions (lines ~39–64):
```typescript
function applyTheme(theme: ThemeId)
async function setTheme(theme: ThemeId)
async function logout()
```

HTML (lines ~4799–4848):
The entire header bar block.

**Props it needs:**
```typescript
let {
  currentUser,                    // User | null — display name, show/hide menus
  onOpenUserManagement,           // () => void — opens the management modal
  onLogout                        // () => void — calls logout in parent
}: { ... } = $props();
```

**Props it emits back (via callbacks):**
- `onOpenUserManagement()` — when user clicks "Manage Users"
- `onLogout()` — when user clicks "Sign Out"

---

## COMPONENT 2 — TreePanel

**New file:** `src/lib/components/TreePanel.svelte`

**What it is:**
The left-sidebar tree navigation. Renders the company → project → precinct → stage → lot hierarchy. Handles expand/collapse and node selection.

**Move from +page.svelte:**

State (lines ~330–331):
```typescript
let tree: TreeNode[] = [];
```

Functions (lines ~3005–3198):
```typescript
async function loadCompanies()
async function toggleNode(node)
async function selectNode(node)
function findNodeById(nodes, id)
function findNodeByTypeAndName(nodes, type, name)
```

Type definition (lines ~320–328):
```typescript
interface TreeNode { id, name, type, parentId, children, expanded, loading }
```

HTML (lines ~4851–4874):
The tree panel sidebar block, including the recursive `{#snippet treeNode}` (lines ~4774–4790).

**Props it needs:**
```typescript
let {
  selectedNode,                   // TreeNode | null — highlight active node
  onSelectNode                    // (node: TreeNode) => Promise<void> — parent handles data load
}: { ... } = $props();
```

**Props it emits back:**
- `onSelectNode(node)` — when user clicks a tree node. Parent then runs `selectNode` logic (load table data, custom fields, preferences, documents etc.)

**NOTE:** `selectNode()` has a lot of side effects (loads tableData, customFields, preferences, documents, forecast). Keep the ORCHESTRATION in `+page.svelte`. This component only tells the parent "user clicked node X". The parent decides what to load.

---

## COMPONENT 3 — PropertiesPanel

**New file:** `src/lib/components/PropertiesPanel.svelte`

**What it is:**
The collapsible "Properties" section that shows the selected entity's editable fields (name, description, dates, status etc.).

**Move from +page.svelte:**

State (lines ~351–354):
```typescript
let showProperties = true;       // collapsible toggle
let editingProperty: string | null = null;
let propertyEditValue = '';
let savingProperty = false;
```

Functions (lines ~3200–3251):
```typescript
function startPropertyEdit(field, value)
function cancelPropertyEdit()
async function savePropertyEdit()
```

HTML (lines ~4892–4934):
The Properties section block.

**Props it needs:**
```typescript
let {
  selectedNode,                   // TreeNode | null
  entityDetails: any,             // The full row object for the selected entity
  hasPermission: (action: string) => boolean,  // check edit/delete perms
  onSave                          // (field, value) => Promise<void> — parent persists the edit
}: { ... } = $props();
```

**Props it emits back:**
- `onSave(field, value)` — when user saves a property edit. Parent calls the correct API.

---

## COMPONENT 4 — DocumentPanel

**New file:** `src/lib/components/DocumentPanel.svelte`

**What it is:**
The collapsible Documents section: upload button, document list, inline viewer, preview modal, and the "Extract with AI" button.

**Move from +page.svelte:**

State (lines ~355–380):
```typescript
let documents: any[] = [];
let showDocuments = false;
let uploading = false;
let uploadDocumentType = 'other';
let inlineDocument: any = null;
let inlineZoom = 1;
let inlineViewerHeight = 300;
let previewDocument: any = null;
const documentTypeOptions = [...];
```

Functions (lines ~3252–3299):
```typescript
async function loadDocuments()
async function handleFileUpload(event)
async function deleteDocument(id)
```

HTML (lines ~5226–5387):
The Documents section block + the Document Preview Modal (lines ~7436–7458).

**Props it needs:**
```typescript
let {
  selectedNode,                   // TreeNode | null — used for entityType + entityId on upload
  hasPermission,                  // (action: string) => boolean
  onExtract,                      // (docId: number) => void — opens extraction flow in parent
  onDocumentsLoaded               // (docs: any[]) => void — parent keeps a copy if needed
}: { ... } = $props();
```

**Props it emits back:**
- `onExtract(docId)` — when user clicks "Extract with AI". Parent owns the extraction modals/flow.

---

## COMPONENT 5 — ExtractionModals

**New file:** `src/lib/components/ExtractionModals.svelte`

**What it is:**
ALL extraction-related modals grouped together:
- Pre-Extraction Modal (hints, model selection)
- Extraction Results Modal (show extracted lots/stages, apply/skip)
- Continue Extraction Modal
- POS Analysis Modal
- Verification Modal
- Calibration Modal
- Box Calibration Modal

**Move from +page.svelte:**

State (lines ~358–425, 428–465):
```typescript
let extractingDocId: number | null = null;
let extractionProgress = { current: 0, total: 0, status: '' };
let extractionResult: any = null;
let showExtractionResult = false;
let showPreExtractionModal = false;
let preExtractionDocId: number | null = null;
let extractionHints = '';
let selectedModel = 'gemini';
let showContinueModal = false;
let continuationInfo: any = null;
let showCalibrationModal = false;
let calibrationSamples: any[] = [];
let showVerificationModal = false;
let verificationResult: any = null;
let showBoxCalibration = false;
let boxCalibrationImage: string | null = null;
let boxCalibrationLots: any[] = [];
let posAnalysisResult: any = null;
let showPosAnalysis = false;
let posAnalysisFilter = 'all';
const modelOptions = [...];
```

Functions (lines ~3301–3846, 4035–4505):
```typescript
async function extractFromDocument(docId, reanalyze)
async function extractPermitPlan()
async function continueExtraction()
async function crossReferenceDocument()
async function analyzePlanOfSubdivision()
async function analyzePageForVerification()
async function submitCalibration()
async function startBoxCalibration()
async function submitBoxCalibration()
async function applyCorrection()
async function applyAllCorrections()
async function saveExtractedStages()
async function saveExtractedLots()
async function applyPosCorrection()
async function applyAllPosCorrections()
```

HTML (lines ~7164–7924):
All extraction/calibration/verification modal blocks.

**Props it needs:**
```typescript
let {
  selectedNode,                   // TreeNode | null
  tableData,                      // any[] — existing lots for comparison
  documents,                      // any[] — uploaded docs list
  onDataSaved,                    // () => Promise<void> — reload tableData after applying extracted data
  onDocumentsReloaded             // () => Promise<void> — reload docs after changes
}: { ... } = $props();
```

---

## COMPONENT 6 — LandBudgetPanel

**New file:** `src/lib/components/LandBudgetPanel.svelte`

**What it is:**
Both the Precinct Land Budget and Stage Land Budget panels. They share the same category structure and similar logic so they belong together.

**Move from +page.svelte:**

State (lines ~987–1008):
```typescript
// Stage land budget
let showStageLandBudget = false;
let stageLandBudgetData: any[] = [];
let stageLandBudgetCategories: any[] = [];
let stageLandBudgetLotAreaHa = 0;
let stageLandBudgetEditMode = false;
let stageLandBudgetEditValues: Record<string, string> = {};
let loadingStageLandBudget = false;
let stageLbExpandedCategories: Set<string> = new Set();

// Precinct land budget
let showLandBudget = false;
let landBudgetData: any[] = [];
let landBudgetCategories: any[] = [];
let landBudgetStageData: Record<number, any[]> = {};
let loadingLandBudget = false;
let lbExpandedCategories: Set<string> = new Set();
let lbExpandedStages: Set<number> = new Set();
```

Functions (lines ~1010–1410):
```typescript
async function loadStageLandBudget()
async function loadLandBudget()    // precinct level
function getStageLandBudgetValue(category, subcategory)
async function saveStageLandBudget()
function getLandBudgetValue(stageId, category, subcategory)
// all toggle/expand/collapse functions for categories and stages
```

HTML (lines ~5470–5749 and 6198–6583):
Both land budget panel blocks.

**Props it needs:**
```typescript
let {
  selectedNode,                   // TreeNode | null — determines stage vs precinct context
  hasPermission                   // (action: string) => boolean
}: { ... } = $props();
```

---

## COMPONENT 7 — ForecastPanel

**New file:** `src/lib/components/ForecastPanel.svelte`

**What it is:**
The Forecast Tool: period selector, mode selector, the forecast allocation table, lot drag-and-drop into periods, and save/cancel.

**Move from +page.svelte:**

State (lines ~967–1001):
```typescript
let showForecastTool = false;
let forecastMode = 'sold_date';
let forecastPeriod = 'days';
let forecastData: Map<string, any[]> = new Map();
let forecastRange = { start: '', end: '' };
let forecastPeriodOffset = 0;
let forecastEditMode = false;
let forecastExpandedStages: Set<number> = new Set();
let forecastLotSort = '';
let forecastLotSortAsc = true;
let forecastStages: any[] = [];
```

Functions (lines ~1412–2000):
```typescript
async function loadForecastData()
function toggleForecastStageExpand(stageId)
function getSortedLots(stage)
function startForecastEdit()
function getPeriodKeyForDate(date)
function getUnallocatedLots()
function getStagePeriodStats(stage, periodKey)
function getPeriodTotals(periodKey)
function updateForecastAllocation(lotId, periodKey)
function updateLotForecastDate(lotId, date)
async function saveForecast()
// navigation: prev/next/reset period
```

Reactive statement (lines ~1046–1133):
```typescript
$: forecastPeriods  // computed period columns based on mode + range
```

HTML (lines ~5750–6197):
The Forecast Tool panel block.

**Props it needs:**
```typescript
let {
  selectedNode,                   // TreeNode | null
  tableData,                      // any[] — lot rows for the current stage/precinct
  hasPermission                   // (action: string) => boolean
}: { ... } = $props();
```

---

## COMPONENT 8 — PricingPanel

**New file:** `src/lib/components/PricingPanel.svelte`

**What it is:**
The Product Pricing panel: the price-vs-area graph, product table, trend line, and "Apply Pricing" buttons.

**Move from +page.svelte:**

State (lines ~563–574):
```typescript
let showPricingPanel = false;
let pricingProducts: any[] = [];
let editingPricing = false;
let draggingPointIndex: number | null = null;
let selectedGraphPoint: number | null = null;
let graphSvgRef: SVGElement | null = null;
```

Constants (lines ~577–607):
```typescript
const defaultProducts = [...];   // 22 standard product definitions
```

Functions (lines ~611–957):
```typescript
async function loadPricing(projectId)
async function savePricing()
function updateProductPrice(index, price)
function selectPoint(index)
function selectAndDragPoint(event, index)
function handleGraphMouseMove(event)
function stopDragPoint()
function calculateTrendLine()
function applyTrendToAllProducts()
function addProduct()
function removeProduct(index)
function calculateLotPrice(lot)
async function applyPricingToMasterplanLots()
function acceptIndicativePriceInline()
```

HTML (lines ~4935–5225):
The Pricing Panel block.

**Props it needs:**
```typescript
let {
  selectedNode,                   // TreeNode | null — used to get projectId
  tableData,                      // any[] — lots to apply pricing to
  hasPermission,                  // (action: string) => boolean
  onPricingApplied                // () => Promise<void> — reload tableData after pricing applied
}: { ... } = $props();
```

---

## COMPONENT 9 — PricingReviewModal

**New file:** `src/lib/components/PricingReviewModal.svelte`

**What it is:**
The modal that shows all lots with current vs indicative prices, lets user accept/reject each, and saves in bulk.

**Move from +page.svelte:**

State (lines ~959–961):
```typescript
let showPricingReview = false;
let stagePriceEdits: Map<number, { price: number, indicative: number }> = new Map();
let savingAllPrices = false;
```

Functions (lines ~2463–2609):
```typescript
function startPricingReview()
function updateLotPriceInReview(lotId, price)
function useIndicativePriceInReview(lotId)
function applyIndicativeToAll()
async function saveAllPrices()
function cancelPricingReview()
```

Reactive (lines ~2515–2542):
```typescript
$: totalNewValue
$: totalOriginalValue
$: totalPriceDiff
```

HTML (lines ~7305–7436):
The Pricing Review Modal block.

**Props it needs:**
```typescript
let {
  tableData,                      // any[] — current lots with prices
  show,                           // boolean — controls visibility
  onSaved,                        // () => Promise<void> — reload after save
  onClose                         // () => void
}: { ... } = $props();
```

---

## COMPONENT 10 — UserManagementModal

**New file:** `src/lib/components/UserManagementModal.svelte`

**What it is:**
The full admin modal with 4 tabs: Users, Roles, Invites, Activity Log.

**Move from +page.svelte:**

State (lines ~65–86):
```typescript
let showUserManagement = false;
let managementTab = 'users';
let allUsers: any[] = [];
let allRoles: any[] = [];
let allInvites: any[] = [];
let allCompanies: any[] = [];
let allProjects: any[] = [];
let activityLogs: any[] = [];
// all form state for create/edit user, create role, send invite
```

Functions (lines ~98–280):
```typescript
async function loadManagementData()
async function createUser()
async function toggleUserStatus(user)
function startEditUser()
function cancelEditUser()
async function saveEditUser()
async function createRole()
async function deleteInvite(id)
async function loadActivityLogs()
async function sendInvite()
```

HTML (lines ~8000–8200+):
The User Management Modal block (all 4 tabs).

**Props it needs:**
```typescript
let {
  show,                           // boolean
  currentUser,                    // User | null — used to check master status
  onClose                         // () => void
}: { ... } = $props();
```

---

## COMPONENT 11 — StageTable

**New file:** `src/lib/components/StageTable.svelte`

**What it is:**
The main data table: the tabbed view (Main / Dates / Pricing), inline row editing, add row, bulk select, sort, column resize, and summary bar.

**Move from +page.svelte:**

State (lines ~335–338, 349–350, 383–386, 2017–2020):
```typescript
let editingId: number | null = null;
let editValues: Record<string, string> = {};
let isAdding = false;
let newRowValues: Record<string, string> = {};
let sortColumn = '';
let sortDirection: 'asc' | 'desc' = 'asc';
let selectedRows: Set<number> = new Set();
let stageTableTab = 'main';        // 'main' | 'dates' | 'pricing'
let datesTabEditMode = false;
let pricingTabEditMode = false;
let datesTabEdits: Map<number, any> = new Map();
let pricingTabEdits: Map<number, any> = new Map();
```

Functions (lines ~2608–2705, 2787–2870, 4554–4756):
```typescript
function calculateSummary()
function toggleSort(column)
function sortData(data)
function startEdit(row)
function cancelEdit()
async function saveEdit()
function startAdd()
function cancelAdd()
async function saveAdd()
function formatNumber(value, format)
// column resize handlers
// drag/drop field reorder handlers
// dates tab edit/save/cancel
// pricing tab edit/save/cancel
```

Reactive (lines ~2608, 2646):
```typescript
$: tableSummary
$: sortedTableData
$: orderedFields
```

HTML (lines ~6584–7141):
The Stage Table block (all 3 tabs + summary bar).

**Props it needs:**
```typescript
let {
  selectedNode,                   // TreeNode | null
  tableData,                      // any[] — raw data rows
  customFields,                   // any[] — active custom fields
  orderedFields,                  // string[] — visible field order
  hiddenFields,                   // Set<string>
  hasPermission,                  // (action: string) => boolean
  onRowSaved,                     // (id, values) => Promise<void> — parent persists
  onRowAdded,                     // (values) => Promise<void> — parent persists
  onRowDeleted,                   // (id) => Promise<void> — parent persists
  onDataReloaded                  // () => Promise<void>
}: { ... } = $props();
```

---

## COMPONENT 12 — FieldsManagerModal

**New file:** `src/lib/components/FieldsManagerModal.svelte`

**What it is:**
The modal for adding, removing, reordering, and toggling visibility of custom fields.

**Move from +page.svelte:**

State (lines ~515–530):
```typescript
let showFieldManager = false;
let newFieldKey = '';
let newFieldLabel = '';
let newFieldType = 'text';
let fieldOrder: string[] = [];
```

Functions (lines ~2719–2775):
```typescript
async function addCustomField()
async function removeCustomField(id)
function toggleFieldVisibility(key)
```

HTML (lines ~7924–8000):
The Fields Manager Modal block.

**Props it needs:**
```typescript
let {
  show,                           // boolean
  selectedNode,                   // TreeNode | null — determines entity type
  customFields,                   // any[] — current fields
  hiddenFields,                   // Set<string>
  onFieldAdded,                   // (field) => Promise<void>
  onFieldRemoved,                 // (id) => Promise<void>
  onVisibilityToggled,            // (key) => void
  onClose                         // () => void
}: { ... } = $props();
```

---

## COMPONENT 13 — NewCompanyModal

**New file:** `src/lib/components/NewCompanyModal.svelte`

**What it is:**
Simple modal: name input, ABN input, owners input, create button.

**Move from +page.svelte:**

State (lines ~67–70):
```typescript
let showNewCompanyModal = false;
let newCompanyName = '';
let newCompanyAbn = '';
let newCompanyOwners = '';
```

Functions (lines ~3013–3045):
```typescript
async function createNewCompany()
```

HTML: The New Company Modal block.

**Props it needs:**
```typescript
let {
  show,                           // boolean
  onCreate,                       // (company) => Promise<void> — parent persists + refreshes tree
  onClose                         // () => void
}: { ... } = $props();
```

---

## COMPONENT 14 — SummaryBar

**New file:** `src/lib/components/SummaryBar.svelte`

**What it is:**
The collapsible summary bar above the table: total lots, total area, average price, revenue, pricing progress.

**Move from +page.svelte:**

State (lines ~5388):
```typescript
let showSummary = true;
```

Reactive (lines ~2608–2647):
```typescript
$: tableSummary = calculateSummary()
function calculateSummary()      // computes stats from tableData
```

HTML (lines ~5388–5469):
The Summary section block.

**Props it needs:**
```typescript
let {
  tableData,                      // any[] — current lots
  selectedNode                    // TreeNode | null — determines context
}: { ... } = $props();
```

---

## COMPONENT 15 — ActivityLogPanel

**New file:** `src/lib/components/ActivityLogPanel.svelte`

**What it is:**
The collapsible bottom panel that shows recent activity entries (create, update, delete, upload, extract etc.).

**Move from +page.svelte:**

State (lines ~334, 67):
```typescript
let activityLog: { message: string, type: string, time: string }[] = [];
let logPanelCollapsed = false;
```

Functions (line ~2714–2716):
```typescript
function log(message, type)      // adds entry to activityLog array
```

HTML (lines ~7142–7163):
The Log Panel block.

**Props it needs:**
```typescript
let {
  entries,                        // { message, type, time }[] — log entries
  collapsed                       // boolean
}: { ... } = $props();
```

**NOTE:** `log()` is called from many places across the app. Keep `log()` in `+page.svelte` and pass the `activityLog` array down as a prop. Components do NOT call `log()` directly — they emit events that the parent logs.

---

## PAGINATION — API ROUTES

Add `limit` and `offset` query params to all GET list endpoints.
Default: `limit=100`, `offset=0`.

### Files to update:

```
src/routes/api/lots/+server.ts
src/routes/api/stages/+server.ts
src/routes/api/documents/+server.ts
src/routes/api/activity-log/+server.ts
```

### Pattern to apply (same for every file):

**Before:**
```typescript
export const GET: RequestHandler = async ({ url }) => {
  const stageId = url.searchParams.get('stageId');
  const rows = await db.select().from(lots)
    .where(eq(lots.stageId, parseInt(stageId!)));
  return json(rows);
};
```

**After:**
```typescript
export const GET: RequestHandler = async ({ url }) => {
  const stageId = url.searchParams.get('stageId');
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '100'), 500);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),   0);

  const rows = await db.select().from(lots)
    .where(eq(lots.stageId, parseInt(stageId!)))
    .orderBy(lots.sortOrder)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db.select({ count: sql`count(*)` }).from(lots)
    .where(eq(lots.stageId, parseInt(stageId!)));

  return json({ data: rows, total: Number(count), limit, offset });
};
```

### Frontend fetch update pattern:

**Before:**
```typescript
const res = await fetch(`/api/lots?stageId=${id}`);
tableData = await res.json();
```

**After:**
```typescript
const res  = await fetch(`/api/lots?stageId=${id}&limit=100&offset=0`);
const body = await res.json();
tableData  = body.data;
totalCount = body.total;   // use for "Showing X of Y" display
```

---

## REFACTOR ORDER (do in this sequence)

| # | Component | Risk | Why this order |
|---|-----------|------|----------------|
| 1 | AuthHeader | Low | Isolated, no shared state |
| 2 | ActivityLogPanel | Low | Isolated, read-only |
| 3 | NewCompanyModal | Low | Simple modal, self-contained |
| 4 | FieldsManagerModal | Low | Simple modal |
| 5 | SummaryBar | Low | Read-only, props only |
| 6 | PropertiesPanel | Medium | Edits entity, needs callback |
| 7 | DocumentPanel | Medium | File upload, needs extraction callback |
| 8 | LandBudgetPanel | Medium | Complex state but isolated |
| 9 | PricingPanel | Medium | Graph interaction, isolated |
| 10 | PricingReviewModal | Medium | Modal, bulk save |
| 11 | ForecastPanel | High | Complex reactive state |
| 12 | StageTable | High | Core table, most interactions |
| 13 | ExtractionModals | High | Many modals, complex flow |
| 14 | UserManagementModal | Medium | Admin only, isolated |
| 15 | Pagination | Medium | Touch API + frontend |

---

## VERIFICATION CHECKLIST

After each component is extracted, verify:

- [ ] `npm run dev` starts without errors
- [ ] The component renders in the correct location
- [ ] All interactive features still work (click, edit, save)
- [ ] Activity log still logs the action
- [ ] No console errors in browser DevTools
- [ ] Data persists after page refresh
- [ ] Permissions still block unauthorised actions
