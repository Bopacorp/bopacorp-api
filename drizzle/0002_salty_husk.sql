ALTER TABLE "core"."advisor_supervisors" DROP CONSTRAINT "advisor_supervisors_advisor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "core"."advisor_supervisors" DROP CONSTRAINT "advisor_supervisors_supervisor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "core"."advisor_supervisors" ADD CONSTRAINT "advisor_supervisors_advisor_id_employees_user_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "core"."employees"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."advisor_supervisors" ADD CONSTRAINT "advisor_supervisors_supervisor_id_employees_user_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "core"."employees"("user_id") ON DELETE restrict ON UPDATE no action;