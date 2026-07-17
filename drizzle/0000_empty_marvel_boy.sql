CREATE TABLE "drug_details" (
	"topic_id" uuid NOT NULL,
	"active_ingredient" text,
	"form" text,
	"strength" text,
	"source" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "drug_details_topic_id_unique" UNIQUE("topic_id")
);
--> statement-breakpoint
CREATE TABLE "experience_side_effects" (
	"experience_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	CONSTRAINT "experience_side_effects_experience_id_term_id_pk" PRIMARY KEY("experience_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"duration_days" integer,
	"effectiveness" integer NOT NULL,
	"body" text NOT NULL,
	"lang" text DEFAULT 'tr' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "effectiveness_range" CHECK ("experiences"."effectiveness" >= 1 AND "experiences"."effectiveness" <= 5)
);
--> statement-breakpoint
CREATE TABLE "side_effect_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text NOT NULL,
	CONSTRAINT "side_effect_terms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "topic_i18n" (
	"topic_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	CONSTRAINT "topic_i18n_topic_id_locale_pk" PRIMARY KEY("topic_id","locale")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"canonical_name" text NOT NULL,
	"atc_code" text,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"locale" text DEFAULT 'tr' NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"pro_badge" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "drug_details" ADD CONSTRAINT "drug_details_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_side_effects" ADD CONSTRAINT "experience_side_effects_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_side_effects" ADD CONSTRAINT "experience_side_effects_term_id_side_effect_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."side_effect_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_i18n" ADD CONSTRAINT "topic_i18n_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;