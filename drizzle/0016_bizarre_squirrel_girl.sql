DELETE FROM "reports"."sales_objectives";--> statement-breakpoint
ALTER TABLE "reports"."sales_objectives" RENAME TO "sales_targets";--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" DROP CONSTRAINT "chk_objective_period";--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" DROP CONSTRAINT "sales_objectives_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" DROP CONSTRAINT "sales_objectives_advisor_id_employees_user_id_fk";
--> statement-breakpoint
DROP INDEX "reports"."idx_sales_objectives_created_by";--> statement-breakpoint
DROP INDEX "reports"."idx_sales_objectives_advisor";--> statement-breakpoint
DROP INDEX "reports"."idx_sales_objectives_period";--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD COLUMN "tier_code" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD COLUMN "tier_label" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD COLUMN "min_billing" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD COLUMN "max_billing" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD COLUMN "min_closes" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD CONSTRAINT "sales_targets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sales_targets_tier_code" ON "reports"."sales_targets" USING btree ("tier_code");--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" DROP COLUMN "advisor_id";--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" DROP COLUMN "target_sales_amount";--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" DROP COLUMN "target_closed_deals";--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" DROP COLUMN "period_start";--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" DROP COLUMN "period_end";--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD CONSTRAINT "sales_targets_tier_code_unique" UNIQUE("tier_code");--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD CONSTRAINT "chk_min_billing" CHECK (min_billing >= 0);--> statement-breakpoint
ALTER TABLE "reports"."sales_targets" ADD CONSTRAINT "chk_min_closes" CHECK (min_closes >= 0);