-- Add registration and settlement dates to stages table
ALTER TABLE "stages" ADD COLUMN IF NOT EXISTS "registration_date" timestamp;
ALTER TABLE "stages" ADD COLUMN IF NOT EXISTS "settlement_date" timestamp;
