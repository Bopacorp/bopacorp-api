ALTER TABLE "catalog"."categories" ADD COLUMN "slug" varchar(120);--> statement-breakpoint
UPDATE "catalog"."categories" SET "slug" = lower(regexp_replace(replace("name", ' ', '-'), '[^a-z0-9\-]', '', 'g')) WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog"."categories" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."categories" ADD CONSTRAINT "categories_slug_unique" UNIQUE("slug");
