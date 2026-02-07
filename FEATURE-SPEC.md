# Feature Specification — Costing & Financial Analysis Module

## Overview

Transform the filing system into a comprehensive **Land Development Feasibility Tool** with:
- Full project costing (consultants, authorities, construction, reimbursements)
- Cash flow projections tied to lot sales and settlements
- Financial metrics (Margin, IRR, NPV, ROC)
- Period-based summary tables

---

## PART 1: COSTING MODULE

### 1.1 Cost Categories Structure

```
PROJECT COSTS
├── LAND ACQUISITION
│   ├── Purchase Price
│   ├── Stamp Duty
│   ├── Legal Fees
│   ├── Due Diligence
│   └── Settlement Costs
│
├── CONSULTANT FEES
│   ├── Surveyor
│   ├── Civil Engineer
│   ├── Traffic Engineer
│   ├── Environmental Consultant
│   ├── Town Planner
│   ├── Landscape Architect
│   ├── Arborist
│   ├── Geotechnical Engineer
│   ├── Acoustic Consultant
│   ├── Heritage Consultant
│   ├── Legal (Planning)
│   ├── Legal (Sales)
│   ├── Project Manager
│   ├── Sales & Marketing Agent
│   └── Custom Consultant...
│
├── AUTHORITY FEES
│   ├── Planning Application Fee
│   ├── Permit Fees
│   ├── Development Contributions (DCP/ICP)
│   ├── Open Space Contribution
│   ├── Community Infrastructure Levy
│   ├── Utility Connection Fees
│   │   ├── Water
│   │   ├── Sewer
│   │   ├── Electricity
│   │   ├── Gas
│   │   └── Telecommunications
│   ├── Council Bonds
│   ├── Inspection Fees
│   └── Plan Sealing/Registration
│
├── CONSTRUCTION COSTS
│   ├── External Estate Works
│   │   ├── Earthworks (Bulk)
│   │   ├── Road Construction
│   │   ├── Drainage Infrastructure
│   │   ├── Stormwater Management
│   │   ├── Sewer Mains
│   │   ├── Water Mains
│   │   ├── Electricity Distribution
│   │   ├── Gas Mains
│   │   ├── Telecommunications
│   │   ├── Street Lighting
│   │   ├── Landscaping (Common Areas)
│   │   ├── Retaining Walls
│   │   ├── Fencing (Perimeter)
│   │   ├── Signage
│   │   └── Entry Features
│   │
│   └── Internal Subdivision Costs (per lot)
│       ├── Lot Earthworks
│       ├── Lot Services Connection
│       ├── Lot Drainage
│       ├── Driveway Crossover
│       ├── Retaining (Individual)
│       └── Fencing (Side/Rear)
│
├── HOLDING COSTS
│   ├── Land Tax
│   ├── Council Rates
│   ├── Insurance
│   ├── Security
│   ├── Maintenance
│   └── Interest (Development Finance)
│
├── SALES & MARKETING
│   ├── Marketing Campaign
│   ├── Display Suite / Sales Office
│   ├── Signage & Hoarding
│   ├── Photography / Renders
│   ├── Website / Digital
│   ├── Print / Brochures
│   ├── Events / Launches
│   └── Agent Commission (% of sales)
│
└── CONTINGENCY
    ├── Construction Contingency (%)
    ├── Cost Escalation (%)
    └── General Contingency (%)
```

### 1.2 Reimbursements / Credits

```
REIMBURSEMENTS
├── Infrastructure Credits (DCP works in kind)
├── Open Space Credit
├── Utility Rebates
├── GST Input Credits
└── Other Government Grants
```

---

## PART 2: DATABASE SCHEMA ADDITIONS

### New Tables

```sql
-- Cost categories (configurable per project)
CREATE TABLE cost_categories (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES cost_categories(id),
  name TEXT NOT NULL,
  code TEXT,                          -- e.g. "CONS-001"
  category_type TEXT NOT NULL,        -- 'land', 'consultant', 'authority', 'construction', 'holding', 'sales', 'contingency', 'reimbursement'
  is_per_lot BOOLEAN DEFAULT FALSE,   -- TRUE for internal subdivision costs
  default_value NUMERIC(12,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cost items (actual line items per stage)
CREATE TABLE cost_items (
  id SERIAL PRIMARY KEY,
  stage_id INTEGER REFERENCES stages(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES cost_categories(id),
  description TEXT,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit TEXT,                          -- 'ea', 'lm', 'sqm', 'lot', '%'
  rate NUMERIC(12,2),
  amount NUMERIC(12,2),               -- calculated: quantity * rate
  gst_inclusive BOOLEAN DEFAULT TRUE,
  timing_type TEXT,                   -- 'upfront', 'progressive', 'on_settlement', 'monthly'
  timing_start_date DATE,
  timing_end_date DATE,
  timing_percentage NUMERIC(5,2),     -- % of cost per period
  actual_amount NUMERIC(12,2),        -- for variance tracking
  actual_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cost templates (reusable cost structures)
CREATE TABLE cost_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_structure JSONB,           -- full category tree as JSON
  created_by INTEGER REFERENCES users(id),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Finance settings per project
CREATE TABLE project_finance_settings (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  discount_rate NUMERIC(5,2) DEFAULT 10.00,     -- for NPV calculation
  finance_rate NUMERIC(5,2) DEFAULT 6.50,       -- interest rate
  gst_rate NUMERIC(5,2) DEFAULT 10.00,
  agent_commission_rate NUMERIC(5,2) DEFAULT 2.50,
  contingency_rate NUMERIC(5,2) DEFAULT 5.00,
  escalation_rate NUMERIC(5,2) DEFAULT 3.00,    -- annual cost escalation
  base_date DATE,                               -- for escalation calculations
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cash flow entries (generated from costs + sales)
CREATE TABLE cash_flow_entries (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  stage_id INTEGER REFERENCES stages(id),
  lot_id INTEGER REFERENCES lots(id),
  cost_item_id INTEGER REFERENCES cost_items(id),
  entry_type TEXT NOT NULL,           -- 'cost', 'revenue', 'reimbursement'
  category TEXT,                      -- high-level category
  description TEXT,
  period_date DATE NOT NULL,          -- the month this falls in
  amount NUMERIC(12,2) NOT NULL,      -- negative for costs, positive for revenue
  is_actual BOOLEAN DEFAULT FALSE,    -- forecast vs actual
  created_at TIMESTAMP DEFAULT NOW()
);

-- Period summaries (pre-calculated for performance)
CREATE TABLE period_summaries (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  stage_id INTEGER REFERENCES stages(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL,          -- 'month', 'quarter', 'year'

  -- Lot counts
  lots_sold INTEGER DEFAULT 0,
  lots_settled INTEGER DEFAULT 0,
  lots_cancelled INTEGER DEFAULT 0,

  -- Revenue
  sales_value NUMERIC(14,2) DEFAULT 0,
  settlement_value NUMERIC(14,2) DEFAULT 0,
  deposits_received NUMERIC(14,2) DEFAULT 0,

  -- Costs by category
  land_costs NUMERIC(14,2) DEFAULT 0,
  consultant_costs NUMERIC(14,2) DEFAULT 0,
  authority_costs NUMERIC(14,2) DEFAULT 0,
  construction_costs NUMERIC(14,2) DEFAULT 0,
  holding_costs NUMERIC(14,2) DEFAULT 0,
  sales_costs NUMERIC(14,2) DEFAULT 0,

  -- Net position
  total_costs NUMERIC(14,2) DEFAULT 0,
  total_revenue NUMERIC(14,2) DEFAULT 0,
  net_cash_flow NUMERIC(14,2) DEFAULT 0,
  cumulative_cash_flow NUMERIC(14,2) DEFAULT 0,

  -- Calculated on save
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

### Lot Table Additions

```sql
-- Add to existing lots table
ALTER TABLE lots ADD COLUMN contract_date DATE;
ALTER TABLE lots ADD COLUMN deposit_amount NUMERIC(12,2);
ALTER TABLE lots ADD COLUMN deposit_paid_date DATE;
ALTER TABLE lots ADD COLUMN exchange_date DATE;
ALTER TABLE lots ADD COLUMN settlement_date DATE;
ALTER TABLE lots ADD COLUMN actual_settlement_date DATE;
ALTER TABLE lots ADD COLUMN settlement_amount NUMERIC(12,2);
ALTER TABLE lots ADD COLUMN buyer_name TEXT;
ALTER TABLE lots ADD COLUMN buyer_solicitor TEXT;
ALTER TABLE lots ADD COLUMN agent_name TEXT;
ALTER TABLE lots ADD COLUMN commission_rate NUMERIC(5,2);
ALTER TABLE lots ADD COLUMN commission_amount NUMERIC(12,2);
ALTER TABLE lots ADD COLUMN internal_costs NUMERIC(12,2);  -- calculated from per-lot costs
```

---

## PART 3: FINANCIAL METRICS

### 3.1 Metrics Definitions

| Metric | Formula | Description |
|--------|---------|-------------|
| **Gross Revenue** | Sum of all lot sale prices | Total expected sales |
| **Net Revenue** | Gross Revenue - Agent Commission - GST | Revenue after selling costs |
| **Total Costs** | Sum of all cost items | All development costs |
| **Gross Profit** | Net Revenue - Total Costs | Profit before tax |
| **Gross Margin %** | (Gross Profit / Net Revenue) × 100 | Profit as % of revenue |
| **ROC** | (Gross Profit / Total Costs) × 100 | Return on capital invested |
| **NPV** | ∑ (Cash Flow / (1 + r)^t) | Net present value at discount rate |
| **IRR** | Rate where NPV = 0 | Internal rate of return |
| **Peak Funding** | Max negative cumulative cash flow | Maximum capital required |
| **Payback Period** | Months until cumulative > 0 | Time to recover investment |

### 3.2 Metrics Calculation Functions

```typescript
interface ProjectMetrics {
  // Revenue
  grossRevenue: number;
  gstOnSales: number;
  agentCommission: number;
  netRevenue: number;

  // Costs
  landCosts: number;
  consultantCosts: number;
  authorityCosts: number;
  constructionCosts: number;
  holdingCosts: number;
  salesCosts: number;
  contingency: number;
  totalCosts: number;

  // Profitability
  grossProfit: number;
  grossMarginPercent: number;
  profitPerLot: number;
  returnOnCost: number;

  // Cash flow metrics
  npv: number;
  irr: number;
  peakFunding: number;
  paybackMonths: number;

  // Per unit metrics
  revenuePerSqm: number;
  costPerLot: number;
  costPerSqm: number;
}

function calculateNPV(cashFlows: number[], discountRate: number): number {
  return cashFlows.reduce((npv, cf, t) => {
    return npv + cf / Math.pow(1 + discountRate / 12, t);
  }, 0);
}

function calculateIRR(cashFlows: number[], guess: number = 0.1): number {
  // Newton-Raphson method
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const npv = calculateNPV(cashFlows, rate * 12);
    const npvDerivative = cashFlows.reduce((d, cf, t) => {
      return d - t * cf / Math.pow(1 + rate, t + 1);
    }, 0);
    const newRate = rate - npv / npvDerivative;
    if (Math.abs(newRate - rate) < 0.0001) return newRate * 12;
    rate = newRate;
  }
  return rate * 12;
}
```

---

## PART 4: UI COMPONENTS

### 4.1 Costing Panel (New)

**Location:** New tab in Stage view or separate "Financials" section

```
┌─────────────────────────────────────────────────────────────────────┐
│  STAGE 1 - COSTING                                    [Edit] [Export]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ▼ CONSULTANT FEES                                          $245,000│
│    ├─ Surveyor                    1 ea    $45,000          $45,000 │
│    ├─ Civil Engineer              1 ea    $85,000          $85,000 │
│    ├─ Town Planner                1 ea    $35,000          $35,000 │
│    ├─ Project Manager             12 mo   $5,000           $60,000 │
│    └─ + Add Item                                                    │
│                                                                     │
│  ▼ AUTHORITY FEES                                           $892,500│
│    ├─ Development Contributions   45 lots $12,500         $562,500 │
│    ├─ Open Space Contribution     45 lots $5,000          $225,000 │
│    ├─ Permit Fees                 1 ea    $15,000          $15,000 │
│    └─ + Add Item                                                    │
│                                                                     │
│  ▼ CONSTRUCTION - EXTERNAL                                $2,450,000│
│    ├─ Earthworks                  15,000 m³  $25          $375,000 │
│    ├─ Road Construction           850 lm     $1,200     $1,020,000 │
│    ├─ Drainage                    1 ea       $450,000     $450,000 │
│    └─ ...                                                           │
│                                                                     │
│  ▼ CONSTRUCTION - INTERNAL (per lot)                        $675,000│
│    ├─ Lot Earthworks              45 lots    $8,000       $360,000 │
│    ├─ Driveway Crossover          45 lots    $3,500       $157,500 │
│    └─ ...                                                           │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  TOTAL COSTS                                              $4,262,500│
│  (-) Reimbursements                                        ($225,000)│
│  NET COSTS                                                $4,037,500│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Cash Flow Table (New)

**Location:** Project or Precinct level view

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  CASH FLOW - PROJECT AURORA                              [Monthly ▼] [Export Excel] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Period       │ Sales │ Settlements │  Costs    │ Net Flow  │ Cumulative │         │
│  ─────────────┼───────┼─────────────┼───────────┼───────────┼────────────┤         │
│  Jan 2025     │   0   │      0      │ -$500,000 │ -$500,000 │  -$500,000 │ ███     │
│  Feb 2025     │   5   │      0      │ -$350,000 │ -$350,000 │  -$850,000 │ █████   │
│  Mar 2025     │   8   │      0      │ -$425,000 │ -$425,000 │ -$1,275,000│ ███████ │
│  Apr 2025     │   6   │      3      │ -$180,000 │ +$1,020,000│  -$255,000│ ██      │
│  May 2025     │   4   │      5      │ -$150,000 │ +$1,850,000│ +$1,595,000│ ▓▓▓▓▓▓  │
│  Jun 2025     │   3   │      8      │ -$120,000 │ +$3,080,000│ +$4,675,000│ ▓▓▓▓▓▓▓▓│
│  ...          │       │             │           │           │            │         │
│  ─────────────┼───────┼─────────────┼───────────┼───────────┼────────────┤         │
│  TOTAL        │  45   │     45      │-$4,037,500│+$15,962,500│+$15,962,500│         │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Financial Summary Card (New)

**Location:** Project/Precinct header or dedicated Financials tab

```
┌────────────────────────────────────────────────────────────────────────────┐
│  FINANCIAL SUMMARY                                                         │
├──────────────────┬──────────────────┬──────────────────┬──────────────────┤
│  REVENUE         │  COSTS           │  PROFITABILITY   │  CASH METRICS    │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│                  │                  │                  │                  │
│  Gross Sales     │  Land            │  Gross Profit    │  NPV (10%)       │
│  $18,500,000     │  $2,500,000      │  $3,962,500      │  $3,245,000      │
│                  │                  │                  │                  │
│  (-) GST         │  Development     │  Margin          │  IRR             │
│  $1,681,818      │  $3,812,500      │  24.2%           │  42.5%           │
│                  │                  │                  │                  │
│  (-) Commission  │  Holding         │  ROC             │  Peak Funding    │
│  $462,500        │  $450,000        │  31.8%           │  $1,850,000      │
│                  │                  │                  │                  │
│  Net Revenue     │  Sales           │  Profit/Lot      │  Payback         │
│  $16,355,682     │  $350,000        │  $88,056         │  4.2 months      │
│                  │                  │                  │                  │
│                  │  Contingency     │                  │                  │
│                  │  $380,000        │                  │                  │
│                  │  ────────────    │                  │                  │
│                  │  TOTAL           │                  │                  │
│                  │  $12,393,182     │                  │                  │
│                  │                  │                  │                  │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

### 4.4 Cost Timing Editor (New)

For scheduling when costs are incurred:

```
┌─────────────────────────────────────────────────────────────────────┐
│  COST TIMING - Road Construction ($1,020,000)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Timing Type:  ○ Upfront (single payment)                           │
│                ○ On Settlement (per lot)                            │
│                ● Progressive (over period)                          │
│                ○ Monthly recurring                                  │
│                                                                     │
│  Start Date:   [Mar 2025  ▼]                                        │
│  End Date:     [Jun 2025  ▼]                                        │
│                                                                     │
│  Distribution:                                                      │
│  ┌──────────┬──────────┬──────────┬──────────┐                      │
│  │ Mar 2025 │ Apr 2025 │ May 2025 │ Jun 2025 │                      │
│  ├──────────┼──────────┼──────────┼──────────┤                      │
│  │   30%    │   30%    │   25%    │   15%    │                      │
│  │ $306,000 │ $306,000 │ $255,000 │ $153,000 │                      │
│  └──────────┴──────────┴──────────┴──────────┘                      │
│                                                                     │
│                                         [Cancel]  [Save Timing]     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## PART 5: API ENDPOINTS

### New Endpoints Required

```typescript
// Cost Categories
GET    /api/cost-categories?projectId=X          // List categories
POST   /api/cost-categories                       // Create category
PUT    /api/cost-categories                       // Update category
DELETE /api/cost-categories?id=X                  // Delete category

// Cost Items
GET    /api/cost-items?stageId=X                  // List items for stage
POST   /api/cost-items                            // Create item
PUT    /api/cost-items                            // Update item
DELETE /api/cost-items?id=X                       // Delete item
POST   /api/cost-items/bulk                       // Bulk create from template

// Cost Templates
GET    /api/cost-templates                        // List templates
POST   /api/cost-templates                        // Create template
PUT    /api/cost-templates                        // Update template
DELETE /api/cost-templates?id=X                   // Delete template
POST   /api/cost-templates/apply                  // Apply template to stage

// Finance Settings
GET    /api/finance-settings?projectId=X         // Get settings
POST   /api/finance-settings                      // Create/update settings

// Cash Flow
GET    /api/cash-flow?projectId=X&period=month   // Get cash flow data
POST   /api/cash-flow/recalculate                 // Recalculate all entries

// Financial Metrics
GET    /api/metrics?projectId=X                   // Get calculated metrics
GET    /api/metrics/stage?stageId=X               // Get stage-level metrics

// Period Summaries
GET    /api/period-summaries?projectId=X&type=month  // Get summaries
POST   /api/period-summaries/refresh              // Recalculate summaries
```

---

## PART 6: OTHER IMPROVEMENTS

### 6.1 Contract Management (Future)

Track the full sales cycle:

```
Lot Status Flow:
  Masterplan → On Market → Hold → Exchanged → Settled
                              ↘ Cancelled

Contract Data:
- Buyer details (name, contact, solicitor)
- Contract date, exchange date, settlement date
- Deposit amount, balance amount
- Special conditions
- Sunset clause date
- Contract documents (upload)
```

### 6.2 Variance Tracking (Budget vs Actual)

```
┌─────────────────────────────────────────────────────────────────────┐
│  VARIANCE REPORT - STAGE 1                                          │
├─────────────────────────────────────────────────────────────────────┤
│  Category          │ Budget     │ Actual     │ Variance  │ Status  │
│  ──────────────────┼────────────┼────────────┼───────────┼─────────│
│  Consultant Fees   │ $245,000   │ $252,000   │ +$7,000   │ ⚠️ +3%  │
│  Authority Fees    │ $892,500   │ $892,500   │ $0        │ ✅ On   │
│  Construction      │ $2,450,000 │ $2,380,000 │ -$70,000  │ ✅ -3%  │
│  ──────────────────┼────────────┼────────────┼───────────┼─────────│
│  TOTAL             │ $4,037,500 │ $3,974,500 │ -$63,000  │ ✅ -1.6%│
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Dashboard Overview (Future)

Project portfolio view:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PORTFOLIO DASHBOARD                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ ACTIVE PROJECTS │  │ TOTAL LOTS      │  │ SETTLED VALUE   │         │
│  │       5         │  │      234        │  │   $42.5M        │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│  PROJECT SUMMARY                                                        │
│  ┌────────────┬───────┬──────────┬─────────┬─────────┬─────────┐       │
│  │ Project    │ Lots  │ Sold     │ Settled │ Revenue │ Margin  │       │
│  ├────────────┼───────┼──────────┼─────────┼─────────┼─────────┤       │
│  │ Aurora     │  45   │ 42 (93%) │ 38 (84%)│ $18.5M  │ 24.2%   │       │
│  │ Horizon    │  120  │ 85 (71%) │ 45 (38%)│ $52.0M  │ 22.8%   │       │
│  │ Summit     │  69   │ 12 (17%) │ 0 (0%)  │ $31.2M  │ 26.5%   │       │
│  └────────────┴───────┴──────────┴─────────┴─────────┴─────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Export / Reporting

- **Excel Export:** Full project feasibility with formulas
- **PDF Report:** Printable summary for stakeholders
- **CSV Export:** Raw data for external analysis

### 6.5 Notifications & Alerts

- Settlement date approaching (7 days, 14 days)
- Sunset clause expiring
- Budget threshold exceeded
- Approval milestones due

### 6.6 Scenario Comparison (Advanced)

Compare different development scenarios:
- Base case vs optimistic vs pessimistic
- Different staging strategies
- Price sensitivity analysis
- Cost escalation scenarios

---

## PART 7: IMPLEMENTATION PHASES

### Phase 1: Foundation (2-3 weeks)
- [ ] Database schema additions
- [ ] Cost categories CRUD
- [ ] Cost items CRUD
- [ ] Basic costing panel UI

### Phase 2: Cash Flow (2 weeks)
- [ ] Cost timing editor
- [ ] Cash flow calculation engine
- [ ] Cash flow table UI
- [ ] Period summaries

### Phase 3: Financial Metrics (1 week)
- [ ] NPV/IRR calculations
- [ ] Margin/ROC calculations
- [ ] Financial summary card
- [ ] Metrics API endpoints

### Phase 4: Integration (1 week)
- [ ] Link costs to land budget
- [ ] Link sales to lot data
- [ ] Auto-calculate agent commission
- [ ] Integrate with forecast tool

### Phase 5: Polish (1 week)
- [ ] Cost templates
- [ ] Excel export
- [ ] Variance tracking
- [ ] Dashboard overview

---

## PART 8: QUESTIONS TO RESOLVE

Before implementation, clarify:

1. **GST Handling:** Are all costs GST-inclusive or do we need to track GST separately?

2. **Multi-currency:** Is this Australia-only or do you need other currencies?

3. **Cost Allocation:** How should shared costs (e.g., marketing) be allocated across stages?

4. **Finance Integration:** Do you need to integrate with accounting software (Xero, MYOB)?

5. **Approval Workflow:** Do cost changes need approval before saving?

6. **Historical Data:** Do you have existing cost data to import?

7. **Access Control:** Who can view/edit financial data? New permission levels?

8. **Reporting Requirements:** What specific reports do stakeholders need?

---

## APPENDIX: Sample Cost Template (JSON)

```json
{
  "name": "Standard 50-Lot Subdivision",
  "categories": [
    {
      "name": "Consultant Fees",
      "type": "consultant",
      "items": [
        { "name": "Surveyor", "unit": "ea", "rate": 45000 },
        { "name": "Civil Engineer", "unit": "ea", "rate": 85000 },
        { "name": "Town Planner", "unit": "ea", "rate": 35000 },
        { "name": "Project Manager", "unit": "mo", "rate": 5000, "quantity": 12 }
      ]
    },
    {
      "name": "Authority Fees",
      "type": "authority",
      "items": [
        { "name": "Development Contributions", "unit": "lot", "rate": 12500, "isPerLot": true },
        { "name": "Open Space Contribution", "unit": "lot", "rate": 5000, "isPerLot": true }
      ]
    },
    {
      "name": "Construction - External",
      "type": "construction",
      "items": [
        { "name": "Earthworks", "unit": "m3", "rate": 25 },
        { "name": "Road Construction", "unit": "lm", "rate": 1200 },
        { "name": "Drainage", "unit": "ea", "rate": 450000 }
      ]
    },
    {
      "name": "Construction - Internal",
      "type": "construction",
      "items": [
        { "name": "Lot Earthworks", "unit": "lot", "rate": 8000, "isPerLot": true },
        { "name": "Driveway Crossover", "unit": "lot", "rate": 3500, "isPerLot": true }
      ]
    }
  ]
}
```

---

*This specification is ready for Windsurf implementation. Start with Phase 1 (Foundation) and iterate.*
