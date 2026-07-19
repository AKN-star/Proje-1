/**
 * Drizzle şeması. Tablolar docs/master-plan.md "Veri Modeli" sözleşmesine
 * göre Faz 1'den itibaren buraya eklenir. Sözleşmeyi değiştiren her şema
 * değişikliği önce master plandaki tabloyu güncellemeli.
 */
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
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
  // NULL = aktif; dolu = banlı (yazamaz/oylayamaz; okuma serbest).
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  // Yanıt bildirimi e-postası tercihi (Faz 8): true = gönderme.
  emailOptout: boolean("email_optout").notNull().default(false),
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
    // Rate-limit COUNT'u ve topic sayfası listesi için (Faz 9 T1).
    index("experiences_user_created_idx").on(table.userId, table.createdAt),
    index("experiences_topic_status_idx").on(table.topicId, table.status),
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

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    body: text("body"),
    lang: text("lang").notNull().default("tr"),
    status: text("status")
      .notNull()
      .default("published")
      .$type<"published" | "pending" | "flagged" | "removed">(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("questions_user_created_idx").on(table.userId, table.createdAt)],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    lang: text("lang").notNull().default("tr"),
    status: text("status")
      .notNull()
      .default("published")
      .$type<"published" | "pending" | "flagged" | "removed">(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("answers_user_created_idx").on(table.userId, table.createdAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    // Faz 10: soru/yanıt raporları da desteklenir (sözleşme zaten
    // generic target_type tanımlar; text kolon — migration yok).
    targetType: text("target_type").notNull().$type<"experience" | "question" | "answer">(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason")
      .notNull()
      .$type<"spam" | "medical_misinfo" | "personal_data" | "abuse" | "other">(),
    status: text("status").notNull().default("open").$type<"open" | "resolved">(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Aynı kullanıcı aynı hedefi yalnız bir kez raporlar (sözleşme).
    unique("reports_reporter_target").on(
      table.reporterId,
      table.targetType,
      table.targetId,
    ),
    index("reports_reporter_created_idx").on(table.reporterId, table.createdAt),
  ],
);

/** LLM çeviri önbelleği (Faz 5). source_hash içerik düzenlenince bayat
 * çevirinin servis edilmemesini sağlar (kickoff kararı #8). */
export const translations = pgTable(
  "translations",
  {
    targetType: text("target_type")
      .notNull()
      .$type<"experience" | "question" | "answer">(),
    targetId: uuid("target_id").notNull(),
    field: text("field").notNull(),
    locale: text("locale").notNull(),
    text: text("text").notNull(),
    model: text("model").notNull(),
    sourceHash: text("source_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.targetType, table.targetId, table.field, table.locale],
    }),
    // Global çeviri rate-limit penceresi COUNT'u için (Faz 9 T1).
    index("translations_created_idx").on(table.createdAt),
  ],
);

export const moderationLog = pgTable("moderation_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  action: text("action")
    .notNull()
    .$type<
      | "ai_flag"
      | "ai_block"
      | "ai_timeout"
      | "mod_remove"
      | "mod_restore"
      | "mod_ban"
      | "user_edit"
    >(),
  detail: jsonb("detail").$type<{ reasons?: string[]; note?: string }>(),
  actorType: text("actor_type").notNull().$type<"ai" | "user">(),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Profesyonel rozet başvuruları (Faz 6). Belge yükleme yok — beyan
 * (document_note); onay users.pro_badge + role'e yansır. */
export const badgeRequests = pgTable(
  "badge_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    claimedRole: text("claimed_role").notNull().$type<"doctor" | "pharmacist">(),
    institution: text("institution").notNull(),
    documentNote: text("document_note").notNull(),
    status: text("status")
      .notNull()
      .default("pending")
      .$type<"pending" | "approved" | "rejected">(),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("badge_requests_user_created_idx").on(table.userId, table.createdAt),
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
