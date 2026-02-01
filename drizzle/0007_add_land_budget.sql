-- Land Budget Items table for Precinct-level land budget tracking
CREATE TABLE IF NOT EXISTS land_budget_items (
  id SERIAL PRIMARY KEY,
  precinct_id INTEGER NOT NULL REFERENCES precincts(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subcategory TEXT,
  custom_name TEXT,
  area_ha NUMERIC(10, 4),
  is_custom INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_land_budget_precinct ON land_budget_items(precinct_id);
CREATE INDEX IF NOT EXISTS idx_land_budget_category ON land_budget_items(category);
