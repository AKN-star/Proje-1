CREATE TABLE "topic_stats" (
	"topic_id" uuid PRIMARY KEY NOT NULL,
	"experience_count" integer DEFAULT 0 NOT NULL,
	"avg_effectiveness" real,
	"effective_pct" integer,
	"top_side_effects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "votes_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id"),
	CONSTRAINT "vote_value" CHECK ("votes"."value" IN (1, -1))
);
--> statement-breakpoint
ALTER TABLE "topic_stats" ADD CONSTRAINT "topic_stats_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;