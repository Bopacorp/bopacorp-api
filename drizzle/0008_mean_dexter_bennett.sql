CREATE SCHEMA "documents";
--> statement-breakpoint
CREATE TYPE "public"."document_state" AS ENUM('PENDING_APPROVAL', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "documents"."document_state_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"previousState" "document_state",
	"newState" "document_state" NOT NULL,
	"changed_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents"."document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "document_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "documents"."negotiation_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"state" "document_state" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_extension" varchar(10) NOT NULL,
	"file_size_mb" numeric(8, 2) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"review_date" timestamp with time zone,
	"coordinator_message" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_file_size_mb" CHECK (file_size_mb > 0 AND file_size_mb <= 50)
);
--> statement-breakpoint
ALTER TABLE "documents"."document_state_history" ADD CONSTRAINT "document_state_history_document_id_negotiation_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"."negotiation_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."document_state_history" ADD CONSTRAINT "document_state_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."negotiation_documents" ADD CONSTRAINT "negotiation_documents_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "crm"."negotiations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."negotiation_documents" ADD CONSTRAINT "negotiation_documents_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "documents"."document_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."negotiation_documents" ADD CONSTRAINT "negotiation_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "app_auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."negotiation_documents" ADD CONSTRAINT "negotiation_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "app_auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_doc_state_history_document" ON "documents"."document_state_history" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_doc_state_history_new" ON "documents"."document_state_history" USING btree ("newState");--> statement-breakpoint
CREATE INDEX "idx_doc_state_history_changed" ON "documents"."document_state_history" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "idx_doc_state_history_created" ON "documents"."document_state_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_negotiation_docs_negotiation" ON "documents"."negotiation_documents" USING btree ("negotiation_id");--> statement-breakpoint
CREATE INDEX "idx_negotiation_docs_type" ON "documents"."negotiation_documents" USING btree ("document_type_id");--> statement-breakpoint
CREATE INDEX "idx_negotiation_docs_uploaded_by" ON "documents"."negotiation_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_negotiation_docs_reviewed_by" ON "documents"."negotiation_documents" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "idx_negotiation_docs_state" ON "documents"."negotiation_documents" USING btree ("state") WHERE deleted_at IS NULL;