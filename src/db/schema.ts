/**
 * Drizzle şeması. Tablolar docs/master-plan.md "Veri Modeli" sözleşmesine
 * göre Faz 1'den itibaren buraya eklenir. Sözleşmeyi değiştiren her şema
 * değişikliği önce master plandaki tabloyu güncellemeli.
 */
import {
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  locale: text("locale").notNull().default("tr"),
  role: text("role").notNull().default("user"),
  proBadge: text("pro_badge"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Auth.js AdapterUser'ın gerektirdiği alanlar (master plan sözleşmesi
  // dışında, Auth.js'in kendi ihtiyacı; hepsi nullable):
  name: text("name"),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull().$type<"drug" | "condition" | "treatment">(),
  status: text("status").notNull().default("active"),
  createdBy: uuid("created_by").references(() => users.id),
  canonicalName: text("canonical_name").notNull(),
  atcCode: text("atc_code"),
});

export const topicI18n = pgTable(
  "topic_i18n",
  {
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    summary: text("summary"),
  },
  (table) => [primaryKey({ columns: [table.topicId, table.locale] })],
);

export const drugDetails = pgTable("drug_details", {
  topicId: uuid("topic_id")
    .notNull()
    .unique()
    .references(() => topics.id),
  activeIngredient: text("active_ingredient"),
  form: text("form"),
  strength: text("strength"),
  source: text("source").notNull().default("manual"),
});

export const sideEffectTerms = pgTable("side_effect_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nameTr: text("name_tr").notNull(),
  nameEn: text("name_en").notNull(),
});

export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    purpose: text("purpose").notNull(),
    durationDays: integer("duration_days"),
    effectiveness: integer("effectiveness").notNull(),
    body: text("body").notNull(),
    lang: text("lang").notNull().default("tr"),
    status: text("status").notNull().default("published"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "effectiveness_range",
      sql`${table.effectiveness} >= 1 AND ${table.effectiveness} <= 5`,
    ),
  ],
);

export const experienceSideEffects = pgTable(
  "experience_side_effects",
  {
    experienceId: uuid("experience_id")
      .notNull()
      .references(() => experiences.id),
    termId: uuid("term_id")
      .notNull()
      .references(() => sideEffectTerms.id),
  },
  (table) => [primaryKey({ columns: [table.experienceId, table.termId] })],
);
