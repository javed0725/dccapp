ALTER TABLE "subject_master_list" DROP CONSTRAINT "subject_master_list_name_unique";--> statement-breakpoint
ALTER TABLE "subject_master_list" ADD COLUMN "batch_id" integer;--> statement-breakpoint
ALTER TABLE "subject_master_list" ADD COLUMN "total_marks" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "subject_master_list" ADD CONSTRAINT "subject_master_list_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subject_master_list_name_scope_unique" ON "subject_master_list" USING btree (lower("name"),coalesce("batch_id", 0));