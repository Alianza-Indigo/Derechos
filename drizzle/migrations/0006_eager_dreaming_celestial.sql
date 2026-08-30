ALTER TABLE "cases" ADD COLUMN "incident_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "incident_location" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "right_violated" text;