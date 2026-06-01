CREATE TABLE "core"."departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "core"."org_roles" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."org_roles" ADD CONSTRAINT "org_roles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "core"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_org_roles_department" ON "core"."org_roles" USING btree ("department_id");--> statement-breakpoint
ALTER TABLE "core"."org_roles" DROP COLUMN "department";--> statement-breakpoint
ALTER TABLE "core"."org_roles" DROP COLUMN "level";