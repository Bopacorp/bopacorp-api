CREATE SCHEMA "crm";
--> statement-breakpoint
CREATE TABLE "crm"."business_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisor_id" uuid,
	"ruc" varchar(13) NOT NULL,
	"business_name" varchar(200) NOT NULL,
	"contact_name" varchar(200) NOT NULL,
	"contact_phone" varchar(20),
	"contact_email" varchar(150),
	"address" text,
	"active_services_count" integer DEFAULT 0 NOT NULL,
	"current_monthly_billing" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "business_clients_ruc_unique" UNIQUE("ruc"),
	CONSTRAINT "chk_services_count" CHECK (active_services_count >= 0),
	CONSTRAINT "chk_monthly_billing" CHECK (current_monthly_billing >= 0)
);
--> statement-breakpoint
CREATE TABLE "crm"."negotiation_state_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"previous_state_id" uuid,
	"new_state_id" uuid NOT NULL,
	"changed_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm"."negotiation_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "negotiation_states_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."negotiations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"advisor_id" uuid NOT NULL,
	"state_id" uuid NOT NULL,
	"start_date" date DEFAULT CURRENT_DATE NOT NULL,
	"estimated_close_date" date,
	"observations" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_negotiation_dates" CHECK (estimated_close_date IS NULL OR estimated_close_date >= start_date)
);
--> statement-breakpoint
CREATE TABLE "crm"."visit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "visit_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid,
	"client_id" uuid NOT NULL,
	"advisor_id" uuid NOT NULL,
	"verified_by" uuid,
	"visit_type_id" uuid NOT NULL,
	"visit_date" timestamp with time zone NOT NULL,
	"observations" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"supervisor_comment" text,
	"gps_latitude" numeric(10, 7),
	"gps_longitude" numeric(10, 7),
	"gps_accuracy" numeric(8, 2),
	"gps_timestamp" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "crm"."business_clients" ADD CONSTRAINT "business_clients_advisor_id_employees_user_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "core"."employees"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."negotiation_state_history" ADD CONSTRAINT "negotiation_state_history_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "crm"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."negotiation_state_history" ADD CONSTRAINT "negotiation_state_history_previous_state_id_negotiation_states_id_fk" FOREIGN KEY ("previous_state_id") REFERENCES "crm"."negotiation_states"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."negotiation_state_history" ADD CONSTRAINT "negotiation_state_history_new_state_id_negotiation_states_id_fk" FOREIGN KEY ("new_state_id") REFERENCES "crm"."negotiation_states"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."negotiation_state_history" ADD CONSTRAINT "negotiation_state_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."negotiations" ADD CONSTRAINT "negotiations_client_id_business_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "crm"."business_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."negotiations" ADD CONSTRAINT "negotiations_advisor_id_employees_user_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "core"."employees"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."negotiations" ADD CONSTRAINT "negotiations_state_id_negotiation_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "crm"."negotiation_states"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."visits" ADD CONSTRAINT "visits_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "crm"."negotiations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."visits" ADD CONSTRAINT "visits_client_id_business_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "crm"."business_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."visits" ADD CONSTRAINT "visits_advisor_id_employees_user_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "core"."employees"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."visits" ADD CONSTRAINT "visits_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "app_auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."visits" ADD CONSTRAINT "visits_visit_type_id_visit_types_id_fk" FOREIGN KEY ("visit_type_id") REFERENCES "crm"."visit_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_business_clients_advisor" ON "crm"."business_clients" USING btree ("advisor_id");--> statement-breakpoint
CREATE INDEX "idx_business_clients_ruc" ON "crm"."business_clients" USING btree ("ruc") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_business_clients_active" ON "crm"."business_clients" USING btree ("is_active") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_neg_state_history_negotiation" ON "crm"."negotiation_state_history" USING btree ("negotiation_id");--> statement-breakpoint
CREATE INDEX "idx_neg_state_history_prev_state" ON "crm"."negotiation_state_history" USING btree ("previous_state_id");--> statement-breakpoint
CREATE INDEX "idx_neg_state_history_new_state" ON "crm"."negotiation_state_history" USING btree ("new_state_id");--> statement-breakpoint
CREATE INDEX "idx_neg_state_history_created" ON "crm"."negotiation_state_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_neg_state_history_changed_by" ON "crm"."negotiation_state_history" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "idx_negotiations_client" ON "crm"."negotiations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_negotiations_advisor" ON "crm"."negotiations" USING btree ("advisor_id");--> statement-breakpoint
CREATE INDEX "idx_negotiations_state" ON "crm"."negotiations" USING btree ("state_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_negotiations_active" ON "crm"."negotiations" USING btree ("is_active") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_negotiations_dates" ON "crm"."negotiations" USING btree ("start_date","estimated_close_date");--> statement-breakpoint
CREATE INDEX "idx_visits_negotiation" ON "crm"."visits" USING btree ("negotiation_id");--> statement-breakpoint
CREATE INDEX "idx_visits_client" ON "crm"."visits" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_visits_advisor" ON "crm"."visits" USING btree ("advisor_id");--> statement-breakpoint
CREATE INDEX "idx_visits_verified_by" ON "crm"."visits" USING btree ("verified_by");--> statement-breakpoint
CREATE INDEX "idx_visits_visit_type" ON "crm"."visits" USING btree ("visit_type_id");--> statement-breakpoint
CREATE INDEX "idx_visits_date" ON "crm"."visits" USING btree ("visit_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_visits_verified" ON "crm"."visits" USING btree ("is_verified") WHERE deleted_at IS NULL;