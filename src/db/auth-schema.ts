// T1 ile AYNI tablo tanımı; merge'de tek kopya schema.ts'te kalacak, buradan
// import edilecek (kontrolcü birleştirir). T1 ve T3 aynı dalgada (W1)
// paralel çalıştığı için `users` tablosu burada da tanımlanır — nihai
// birleştirmede schema.ts'teki tanım referans kabul edilir ve bu dosyadaki
// kopya schema.ts'ten import edilecek şekilde güncellenir.
//
// Auth.js (@auth/drizzle-adapter) Postgres adapter'ının beklediği ek
// tablolar: account, session, verificationToken. Adapter dokümantasyonundaki
// varsayılan Postgres şemasıyla birebir aynı sütun adları/ tipleri kullanılır
// (bkz. node_modules/@auth/drizzle-adapter/src/lib/pg.ts:defineTables).
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

/**
 * docs/master-plan.md "Veri Modeli" + spec T1 sözleşmesi.
 * Auth.js AdapterUser arayüzü için gerekli name/emailVerified/image
 * sütunları da (nullable) eklenmiştir; bunlar master plan sözleşmesinin
 * dışında Auth.js'in kendi ihtiyacıdır.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  locale: text("locale").notNull().default("tr"),
  role: text("role").notNull().default("user"),
  proBadge: text("pro_badge"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Auth.js AdapterUser alanları:
  name: text("name"),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// authenticator tablosu Faz 1 kapsamı dışında (passkey/WebAuthn yok);
// adapter bu tablo olmadan da çalışır (optional alan).
