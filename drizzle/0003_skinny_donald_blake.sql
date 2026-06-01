ALTER TABLE "core"."profiles" DROP CONSTRAINT "profiles_employee_code_unique";--> statement-breakpoint
DROP INDEX "core"."idx_profiles_employee";--> statement-breakpoint
ALTER TABLE "core"."profiles" DROP COLUMN "employee_code";