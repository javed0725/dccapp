CREATE TABLE "admission_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "school" text;--> statement-breakpoint
CREATE UNIQUE INDEX "admission_options_type_name_unique" ON "admission_options" USING btree ("type",lower("name"));
--> statement-breakpoint
INSERT INTO "admission_options" ("type", "name")
VALUES
  ('group', 'Science'),
  ('group', 'Commerce'),
  ('group', 'Arts'),
  ('shift', 'Morning'),
  ('shift', 'Evening')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "admission_options" ("type", "name")
SELECT 'group', trim("academic_group")
FROM "students"
WHERE "academic_group" IS NOT NULL AND trim("academic_group") <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "admission_options" ("type", "name")
SELECT 'shift', trim("shift")
FROM "students"
WHERE "shift" IS NOT NULL AND trim("shift") <> ''
ON CONFLICT DO NOTHING;