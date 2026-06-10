CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE SCHEMA "reports";
--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('COMMERCIAL_PERFORMANCE', 'OPERATIONAL', 'ADVISOR_DASHBOARD');--> statement-breakpoint
CREATE TABLE "notifications"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports"."report_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generated_by" uuid NOT NULL,
	"report_type" "report_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_extension" varchar(10) NOT NULL,
	"file_size_mb" numeric(8, 2) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_report_size" CHECK (file_size_mb > 0 AND file_size_mb <= 50)
);
--> statement-breakpoint
CREATE TABLE "reports"."sales_objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"advisor_id" uuid,
	"target_sales_amount" numeric(15, 2) NOT NULL,
	"target_closed_deals" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_objective_period" CHECK (period_end >= period_start)
);
--> statement-breakpoint
ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports"."report_exports" ADD CONSTRAINT "report_exports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports"."sales_objectives" ADD CONSTRAINT "sales_objectives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports"."sales_objectives" ADD CONSTRAINT "sales_objectives_advisor_id_employees_user_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "core"."employees"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications"."notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications"."notifications" USING btree ("recipient_id","is_read") WHERE is_read = FALSE;--> statement-breakpoint
CREATE INDEX "idx_notifications_ref" ON "notifications"."notifications" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_created" ON "notifications"."notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_report_exports_generated_by" ON "reports"."report_exports" USING btree ("generated_by");--> statement-breakpoint
CREATE INDEX "idx_report_exports_type" ON "reports"."report_exports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_report_exports_generated_at" ON "reports"."report_exports" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_sales_objectives_created_by" ON "reports"."sales_objectives" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_sales_objectives_advisor" ON "reports"."sales_objectives" USING btree ("advisor_id");--> statement-breakpoint
CREATE INDEX "idx_sales_objectives_period" ON "reports"."sales_objectives" USING btree ("period_start","period_end");