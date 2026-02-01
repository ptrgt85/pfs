CREATE TABLE "custom_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"field_key" text NOT NULL,
	"field_label" text NOT NULL,
	"field_type" text DEFAULT 'text',
	"is_active" integer DEFAULT 1,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_type" text DEFAULT 'other';--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "frontage" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "depth" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "street_name" text;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "custom_data" text;