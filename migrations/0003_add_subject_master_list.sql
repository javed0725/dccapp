CREATE TABLE "subject_master_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mcq_enabled" boolean DEFAULT false NOT NULL,
	"cq_enabled" boolean DEFAULT false NOT NULL,
	"practical_enabled" boolean DEFAULT false NOT NULL,
	"mcq_max" integer DEFAULT 0 NOT NULL,
	"cq_max" integer DEFAULT 0 NOT NULL,
	"practical_max" integer DEFAULT 0 NOT NULL,
	"all_groups" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subject_master_list_name_unique" UNIQUE("name")
);
