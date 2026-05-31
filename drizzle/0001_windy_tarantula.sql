CREATE TABLE "core"."employees" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"org_role_id" uuid NOT NULL,
	"territory" varchar(100),
	"hired_at" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."org_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"department" varchar(100),
	"level" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "org_roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "core"."employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employees" ADD CONSTRAINT "employees_org_role_id_org_roles_id_fk" FOREIGN KEY ("org_role_id") REFERENCES "core"."org_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employees_org_role" ON "core"."employees" USING btree ("org_role_id");--> statement-breakpoint
CREATE INDEX "idx_employees_active" ON "core"."employees" USING btree ("is_active") WHERE deleted_at IS NULL;