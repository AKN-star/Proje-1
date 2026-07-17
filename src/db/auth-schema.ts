// Auth.js adapter tabloları. `users`ın kanonik tanımı src/db/schema.ts'te;
// buradan yalnız yeniden dışa verilir.
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
import { users } from "./schema";

// W1 birleştirmesi tamamlandı: `users`'ın tek kanonik tanımı schema.ts'te
// (Auth.js'in name/emailVerified/image alanları oraya eklendi); burası
// yalnız adapter'ın ek tablolarını tanımlar ve users'ı yeniden dışa verir.
export { users };

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
