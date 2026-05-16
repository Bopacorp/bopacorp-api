CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "employability";
--> statement-breakpoint
CREATE TYPE "public"."audit_operation" AS ENUM('I', 'U', 'D');--> statement-breakpoint
CREATE TYPE "public"."login_status" AS ENUM('success', 'failed', 'locked');--> statement-breakpoint
CREATE TYPE "public"."permission_type" AS ENUM('crud', 'action', 'report', 'view', 'approval');--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('refresh', 'password_reset', 'email_verify');--> statement-breakpoint
CREATE TYPE "public"."application_state" AS ENUM('DRAFT', 'PENDING', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "auth"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"record_id" uuid NOT NULL,
	"operation" "audit_operation" NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"user_id" uuid NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(500) NOT NULL,
	"type" "token_type" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "auth_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."login_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"status" "login_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "modules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "auth"."permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"code" varchar(150) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"type" "permission_type" DEFAULT 'crud' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "auth"."role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"is_granted" boolean DEFAULT true NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "roles_name_unique" UNIQUE("name"),
	CONSTRAINT "roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "auth"."user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "catalog"."age_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"min_age" integer NOT NULL,
	"max_age" integer,
	CONSTRAINT "age_conditions_item_id_unique" UNIQUE("item_id"),
	CONSTRAINT "chk_min_age" CHECK (min_age >= 0),
	CONSTRAINT "chk_max_age" CHECK (max_age >= 0),
	CONSTRAINT "chk_age_range" CHECK (max_age IS NULL OR max_age >= min_age)
);
--> statement-breakpoint
CREATE TABLE "catalog"."benefit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "benefit_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "catalog"."catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"item_type_id" uuid NOT NULL,
	"contract_type_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"price" numeric(15, 2) NOT NULL,
	"activation_code" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"permanence_months" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_price" CHECK (price >= 0),
	CONSTRAINT "chk_permanence" CHECK (permanence_months >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catalog"."connectivity_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"bandwidth_mbps" numeric(10, 2) NOT NULL,
	CONSTRAINT "connectivity_details_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "catalog"."contact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid,
	"client_name" varchar(200) NOT NULL,
	"client_email" varchar(150) NOT NULL,
	"client_phone" varchar(20),
	"message" text,
	"is_attended" boolean DEFAULT false NOT NULL,
	"attended_at" timestamp with time zone,
	"attended_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catalog"."content_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_key" varchar(100) NOT NULL,
	"content_type_id" uuid NOT NULL,
	"title" varchar(200),
	"body" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "catalog"."content_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "content_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "catalog"."contract_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "contract_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "catalog"."device_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"brand" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"storage_gb" integer,
	"financing_months" integer,
	"financing_monthly" numeric(15, 2),
	CONSTRAINT "device_details_item_id_unique" UNIQUE("item_id"),
	CONSTRAINT "chk_financing_months" CHECK (financing_months > 0),
	CONSTRAINT "chk_financing_monthly" CHECK (financing_monthly >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."digital_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"provider" varchar(100) NOT NULL,
	CONSTRAINT "digital_details_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "catalog"."geo_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "geo_zones_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "catalog"."item_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"benefit_type_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"duration_days" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_benefit_duration" CHECK (duration_days > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."item_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "item_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "catalog"."legal_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"legal_requirement" text NOT NULL,
	"description" varchar(255),
	CONSTRAINT "legal_conditions_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "catalog"."roaming_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"geo_zone_id" uuid NOT NULL,
	"data_mb" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"has_throttle" boolean DEFAULT false NOT NULL,
	CONSTRAINT "roaming_details_item_id_unique" UNIQUE("item_id"),
	CONSTRAINT "chk_data_mb" CHECK (data_mb > 0),
	CONSTRAINT "chk_roaming_duration" CHECK (duration_days > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "segments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "catalog"."temporal_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date,
	CONSTRAINT "temporal_conditions_item_id_unique" UNIQUE("item_id"),
	CONSTRAINT "chk_temporal_range" CHECK (expiration_date IS NULL OR expiration_date >= effective_date)
);
--> statement-breakpoint
CREATE TABLE "catalog"."tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tiers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "catalog"."voice_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"gigas_structural" integer NOT NULL,
	"gigas_loyalty" integer DEFAULT 0 NOT NULL,
	"minutes_national" integer,
	"minutes_ldi" integer DEFAULT 0 NOT NULL,
	"sms" integer DEFAULT 0 NOT NULL,
	"has_unlimited_minutes" boolean DEFAULT false NOT NULL,
	"has_unlimited_whatsapp" boolean DEFAULT true NOT NULL,
	"has_social_networks" boolean DEFAULT false NOT NULL,
	"included_roaming_gb" numeric(5, 1) DEFAULT '0' NOT NULL,
	CONSTRAINT "voice_details_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "core"."advisor_supervisors" (
	"advisor_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "advisor_supervisors_advisor_id_supervisor_id_pk" PRIMARY KEY("advisor_id","supervisor_id"),
	CONSTRAINT "chk_no_self_supervision" CHECK (advisor_id <> supervisor_id)
);
--> statement-breakpoint
CREATE TABLE "core"."profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"second_name" varchar(100),
	"last_name" varchar(100) NOT NULL,
	"second_last_name" varchar(100),
	"national_id" varchar(20) NOT NULL,
	"phone" varchar(20),
	"avatar_url" varchar(500),
	"employee_code" varchar(20),
	"address" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "profiles_national_id_unique" UNIQUE("national_id"),
	CONSTRAINT "profiles_employee_code_unique" UNIQUE("employee_code")
);
--> statement-breakpoint
CREATE TABLE "employability"."candidate_resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"application_id" uuid,
	"filename" varchar(255) NOT NULL,
	"file_extension" varchar(10) NOT NULL,
	"file_size_mb" numeric(8, 2) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_file_size" CHECK (file_size_mb > 0 AND file_size_mb <= 50)
);
--> statement-breakpoint
CREATE TABLE "employability"."candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"national_id" varchar(20) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(150) NOT NULL,
	"phone" varchar(20),
	"address" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "candidates_national_id_unique" UNIQUE("national_id"),
	CONSTRAINT "candidates_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "employability"."job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"reviewed_by" uuid,
	"state" "application_state" DEFAULT 'DRAFT' NOT NULL,
	"cover_letter" text,
	"review_notes" text,
	"review_date" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "employability"."job_vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"requirements" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"publication_date" timestamp with time zone,
	"closing_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_vacancy_dates" CHECK (closing_date IS NULL OR publication_date IS NULL OR closing_date >= publication_date)
);
--> statement-breakpoint
ALTER TABLE "auth"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."login_logs" ADD CONSTRAINT "login_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."modules" ADD CONSTRAINT "modules_parent_id_modules_id_fk" FOREIGN KEY ("parent_id") REFERENCES "auth"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."permissions" ADD CONSTRAINT "permissions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "auth"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "auth"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."age_conditions" ADD CONSTRAINT "age_conditions_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."catalog_items" ADD CONSTRAINT "catalog_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "catalog"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."catalog_items" ADD CONSTRAINT "catalog_items_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "catalog"."item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."catalog_items" ADD CONSTRAINT "catalog_items_contract_type_id_contract_types_id_fk" FOREIGN KEY ("contract_type_id") REFERENCES "catalog"."contract_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."catalog_items" ADD CONSTRAINT "catalog_items_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "catalog"."segments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."catalog_items" ADD CONSTRAINT "catalog_items_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "catalog"."tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "catalog"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."connectivity_details" ADD CONSTRAINT "connectivity_details_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."contact_requests" ADD CONSTRAINT "contact_requests_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."contact_requests" ADD CONSTRAINT "contact_requests_attended_by_users_id_fk" FOREIGN KEY ("attended_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."content_blocks" ADD CONSTRAINT "content_blocks_content_type_id_content_types_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "catalog"."content_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."content_blocks" ADD CONSTRAINT "content_blocks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."device_details" ADD CONSTRAINT "device_details_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."digital_details" ADD CONSTRAINT "digital_details_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."item_benefits" ADD CONSTRAINT "item_benefits_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."item_benefits" ADD CONSTRAINT "item_benefits_benefit_type_id_benefit_types_id_fk" FOREIGN KEY ("benefit_type_id") REFERENCES "catalog"."benefit_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."legal_conditions" ADD CONSTRAINT "legal_conditions_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."roaming_details" ADD CONSTRAINT "roaming_details_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."roaming_details" ADD CONSTRAINT "roaming_details_geo_zone_id_geo_zones_id_fk" FOREIGN KEY ("geo_zone_id") REFERENCES "catalog"."geo_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."temporal_conditions" ADD CONSTRAINT "temporal_conditions_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."voice_details" ADD CONSTRAINT "voice_details_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "catalog"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."advisor_supervisors" ADD CONSTRAINT "advisor_supervisors_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."advisor_supervisors" ADD CONSTRAINT "advisor_supervisors_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employability"."candidate_resumes" ADD CONSTRAINT "candidate_resumes_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "employability"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employability"."candidate_resumes" ADD CONSTRAINT "candidate_resumes_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "employability"."job_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employability"."job_applications" ADD CONSTRAINT "job_applications_vacancy_id_job_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "employability"."job_vacancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employability"."job_applications" ADD CONSTRAINT "job_applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "employability"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employability"."job_applications" ADD CONSTRAINT "job_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employability"."job_vacancies" ADD CONSTRAINT "job_vacancies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_table" ON "auth"."audit_logs" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_record" ON "auth"."audit_logs" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "auth"."audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "auth"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_auth_tokens_user_type" ON "auth"."auth_tokens" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "idx_auth_tokens_expires" ON "auth"."auth_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_login_logs_user" ON "auth"."login_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_login_logs_created" ON "auth"."login_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_permissions_module" ON "auth"."permissions" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "idx_permissions_type" ON "auth"."permissions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_permission" ON "auth"."role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_role" ON "auth"."user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "auth"."users" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_username" ON "auth"."users" USING btree ("username") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_active" ON "auth"."users" USING btree ("is_active") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_age_conditions_item" ON "catalog"."age_conditions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_catalog_items_category" ON "catalog"."catalog_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_catalog_items_item_type" ON "catalog"."catalog_items" USING btree ("item_type_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_catalog_items_contract_type" ON "catalog"."catalog_items" USING btree ("contract_type_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_catalog_items_segment" ON "catalog"."catalog_items" USING btree ("segment_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_catalog_items_tier" ON "catalog"."catalog_items" USING btree ("tier_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_catalog_items_published" ON "catalog"."catalog_items" USING btree ("is_published") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "catalog"."categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_connectivity_details_item" ON "catalog"."connectivity_details" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_contact_requests_item" ON "catalog"."contact_requests" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_contact_requests_attended" ON "catalog"."contact_requests" USING btree ("is_attended");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_content_blocks_key" ON "catalog"."content_blocks" USING btree ("content_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_content_blocks_type" ON "catalog"."content_blocks" USING btree ("content_type_id");--> statement-breakpoint
CREATE INDEX "idx_content_blocks_updated_by" ON "catalog"."content_blocks" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "idx_device_details_item" ON "catalog"."device_details" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_digital_details_item" ON "catalog"."digital_details" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_item_benefits_item" ON "catalog"."item_benefits" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_item_benefits_type" ON "catalog"."item_benefits" USING btree ("benefit_type_id");--> statement-breakpoint
CREATE INDEX "idx_legal_conditions_item" ON "catalog"."legal_conditions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_roaming_details_item" ON "catalog"."roaming_details" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_roaming_details_geo_zone" ON "catalog"."roaming_details" USING btree ("geo_zone_id");--> statement-breakpoint
CREATE INDEX "idx_temporal_conditions_item" ON "catalog"."temporal_conditions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_voice_details_item" ON "catalog"."voice_details" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_advisor_supervisors_supervisor" ON "core"."advisor_supervisors" USING btree ("supervisor_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_user" ON "core"."profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profiles_national_id" ON "core"."profiles" USING btree ("national_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_profiles_employee" ON "core"."profiles" USING btree ("employee_code") WHERE employee_code IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_candidate_resumes_candidate" ON "employability"."candidate_resumes" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_candidate_resumes_application" ON "employability"."candidate_resumes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_candidates_email" ON "employability"."candidates" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_candidates_national_id" ON "employability"."candidates" USING btree ("national_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_application_per_vacancy" ON "employability"."job_applications" USING btree ("vacancy_id","candidate_id");--> statement-breakpoint
CREATE INDEX "idx_job_applications_vacancy" ON "employability"."job_applications" USING btree ("vacancy_id");--> statement-breakpoint
CREATE INDEX "idx_job_applications_candidate" ON "employability"."job_applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_job_applications_reviewed" ON "employability"."job_applications" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "idx_job_applications_state" ON "employability"."job_applications" USING btree ("state") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_job_vacancies_created_by" ON "employability"."job_vacancies" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_job_vacancies_published" ON "employability"."job_vacancies" USING btree ("is_published") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_job_vacancies_active" ON "employability"."job_vacancies" USING btree ("is_active") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_job_vacancies_closing" ON "employability"."job_vacancies" USING btree ("closing_date") WHERE deleted_at IS NULL;