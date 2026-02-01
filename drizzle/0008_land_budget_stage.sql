-- Add stageId to land_budget_items (move from precinct to stage level)
ALTER TABLE land_budget_items ADD COLUMN stage_id INTEGER REFERENCES stages(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_land_budget_stage ON land_budget_items(stage_id);
