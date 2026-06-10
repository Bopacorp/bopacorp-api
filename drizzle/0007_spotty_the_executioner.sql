CREATE SCHEMA "matrices";
--> statement-breakpoint
CREATE TYPE "public"."matrix_state" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "matrices"."matrix_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matrix_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"description" varchar(255),
	"filename" varchar(255) NOT NULL,
	"file_extension" varchar(10) NOT NULL,
	"file_size_mb" numeric(8, 2) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_file_size_mb" CHECK (file_size_mb > 0 AND file_size_mb <= 50)
);
--> statement-breakpoint
CREATE TABLE "matrices"."matrix_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matrix_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"total" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_quantity" CHECK (quantity > 0),
	CONSTRAINT "chk_unit_price" CHECK (unit_price >= 0),
	CONSTRAINT "chk_total" CHECK (total >= 0)
);
--> statement-breakpoint
CREATE TABLE "matrices"."matrix_state_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matrix_id" uuid NOT NULL,
	"previousState" "matrix_state",
	"newState" "matrix_state" NOT NULL,
	"changed_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matrices"."offer_matrices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"approved_by" uuid,
	"state" "matrix_state" DEFAULT 'DRAFT' NOT NULL,
	"observations" text,
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"calculated_subsidy" numeric(15, 2) DEFAULT '0' NOT NULL,
	"subsidy_strategy" varchar(50) DEFAULT 'STANDARD' NOT NULL,
	"approval_date" timestamp with time zone,
	"supervisor_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_total_amount" CHECK (total_amount >= 0),
	CONSTRAINT "chk_calculated_subsidy" CHECK (calculated_subsidy >= 0)
);
--> statement-breakpoint
ALTER TABLE "matrices"."matrix_attachments" ADD CONSTRAINT "matrix_attachments_matrix_id_offer_matrices_id_fk" FOREIGN KEY ("matrix_id") REFERENCES "matrices"."offer_matrices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrices"."matrix_attachments" ADD CONSTRAINT "matrix_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrices"."matrix_line_items" ADD CONSTRAINT "matrix_line_items_matrix_id_offer_matrices_id_fk" FOREIGN KEY ("matrix_id") REFERENCES "matrices"."offer_matrices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrices"."matrix_line_items" ADD CONSTRAINT "matrix_line_items_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrices"."matrix_state_history" ADD CONSTRAINT "matrix_state_history_matrix_id_offer_matrices_id_fk" FOREIGN KEY ("matrix_id") REFERENCES "matrices"."offer_matrices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrices"."matrix_state_history" ADD CONSTRAINT "matrix_state_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" ADD CONSTRAINT "offer_matrices_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "crm"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" ADD CONSTRAINT "offer_matrices_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" ADD CONSTRAINT "offer_matrices_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "app_auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_matrix_attachments_matrix" ON "matrices"."matrix_attachments" USING btree ("matrix_id");--> statement-breakpoint
CREATE INDEX "idx_matrix_attachments_uploaded_by" ON "matrices"."matrix_attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_matrix_line_items_matrix" ON "matrices"."matrix_line_items" USING btree ("matrix_id");--> statement-breakpoint
CREATE INDEX "idx_matrix_line_items_item" ON "matrices"."matrix_line_items" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_item_per_matrix" ON "matrices"."matrix_line_items" USING btree ("matrix_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_matrix_state_history_matrix" ON "matrices"."matrix_state_history" USING btree ("matrix_id");--> statement-breakpoint
CREATE INDEX "idx_matrix_state_history_new" ON "matrices"."matrix_state_history" USING btree ("newState");--> statement-breakpoint
CREATE INDEX "idx_matrix_state_history_changed" ON "matrices"."matrix_state_history" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "idx_matrix_state_history_created" ON "matrices"."matrix_state_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_offer_matrices_negotiation" ON "matrices"."offer_matrices" USING btree ("negotiation_id");--> statement-breakpoint
CREATE INDEX "idx_offer_matrices_creator" ON "matrices"."offer_matrices" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_offer_matrices_approved_by" ON "matrices"."offer_matrices" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_offer_matrices_state" ON "matrices"."offer_matrices" USING btree ("state") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_offer_matrices_created" ON "matrices"."offer_matrices" USING btree ("created_at") WHERE deleted_at IS NULL;