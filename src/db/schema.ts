/**
 * Drizzle şeması. Tablolar docs/master-plan.md "Veri Modeli" sözleşmesine
 * göre Faz 1'den itibaren buraya eklenir. Sözleşmeyi değiştiren her şema
 * değişikliği önce master plandaki tabloyu güncellemeli.
 */
import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // NULL = takma ad onboarding'i bekliyor (master plan sözleşmesi);
  // yazma eylemleri username + kvkk_consent_at dolmadan reddedilir.
  username: text("username").unique(),
  locale: text("locale").notNull().default("tr"),
  role: text("role").notNull().default("user"),
  proBadge: text("pro_badge"),
  // KVKK açık rıza anı (sağlık verisi = özel nitelikli kişisel veri);
  // onboarding'de checkbox işaretlenince yazılır.
  kvkkConsentAt: timestamp("kvkk_consent_at", { withTimezone: true }),
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

/** İstatistik bloğunun tek kaynağı (kritik sözleşme #3): canlı sorgu
 * değil, deneyim yazımıyla birlikte yeniden hesaplanan özet satırı. */
export const topicStats = pgTable("topic_stats", {
  topicId: uuid("topic_id")
    .primaryKey()
    .references(() => topics.id),
  experienceCount: integer("experience_count").notNull().default(0),
  avgEffectiveness: real("avg_effectiveness"),
  effectivePct: integer("effective_pct"),
  topSideEffects: jsonb("top_side_effects")
    .$type<{ termId: string; count: number }[]>()
    .notNull()
    .default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const votes = pgTable(
  "votes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type")
      .notNull()
      .$type<"experience" | "answer">(),
    targetId: uuid("target_id").notNull(),
    value: integer("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.targetType, table.targetId] }),
    check("vote_value", sql`${table.value} IN (1, -1)`),
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
