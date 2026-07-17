CREATE TABLE "translations" (
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"field" text NOT NULL,
	"locale" text NOT NULL,
	"text" text NOT NULL,
	"model" text NOT NULL,
	"source_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translations_target_type_target_id_field_locale_pk" PRIMARY KEY("target_type","target_id","field","locale")
);
