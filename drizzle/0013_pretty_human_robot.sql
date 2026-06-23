ALTER TABLE "matrices"."matrix_line_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matrices"."matrix_state_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "matrices"."matrix_line_items" CASCADE;--> statement-breakpoint
DROP TABLE "matrices"."matrix_state_history" CASCADE;--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP CONSTRAINT "chk_total_amount";--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP CONSTRAINT "chk_calculated_subsidy";--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP CONSTRAINT "offer_matrices_approved_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "matrices"."idx_offer_matrices_approved_by";--> statement-breakpoint
DROP INDEX "matrices"."idx_offer_matrices_state";--> statement-breakpoint
ALTER TABLE "matrices"."matrix_attachments" ADD COLUMN "attachment_type" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP COLUMN "approved_by";--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP COLUMN "total_amount";--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP COLUMN "calculated_subsidy";--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP COLUMN "subsidy_strategy";--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP COLUMN "approval_date";--> statement-breakpoint
ALTER TABLE "matrices"."offer_matrices" DROP COLUMN "supervisor_message";--> statement-breakpoint
DROP TYPE "public"."matrix_state";