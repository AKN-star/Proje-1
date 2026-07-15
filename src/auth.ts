import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import type { EmailConfig } from "next-auth/providers/email";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/auth-schema";
import { sendMagicLink } from "@/lib/email/send";
import { generateUsername } from "@/lib/auth/username";

// `getDb()` async'tir (Neon/PGlite seçimi runtime'da yapılır); NextAuth
// config'i eşzamanlı bir adapter nesnesi ister. Next.js RSC/route handler
// modülleri ESM olduğu için üst seviye await desteklenir — modül yalnızca
// bir kez değerlendirilir ve `db` burada çözülür.
const db = await getDb();

const baseAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
}) as Adapter;

const MAX_USERNAME_ATTEMPTS = 3;

/**
 * `users.username` NOT NULL + UNIQUE'tir (spec T1) ama Auth.js'in
 * AdapterUser tipi username bilmez; adapter'ın createUser'ını sarmalayıp
 * insert'ten ÖNCE üretilen kullanıcı adını ekliyoruz (spec madde 5).
 * Unique çakışmasında yeni 4 hane ile 3 deneme.
 */
const adapter: Adapter = {
  ...baseAdapter,
  async createUser(data) {
    if (!baseAdapter.createUser) {
      throw new Error("Adapter createUser tanımlı değil.");
    }
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
      const username = generateUsername(data.email);
      try {
        return await baseAdapter.createUser({
          ...data,
          username,
        } as typeof data & { username: string });
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  },
};

const emailProvider: EmailConfig = {
  id: "email",
  type: "email",
  name: "E-posta",
  from: "onboarding@resend.dev",
  maxAge: 24 * 60 * 60,
  async sendVerificationRequest({ identifier, url }) {
    await sendMagicLink(identifier, url);
  },
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter,
  // Vercel'de AUTH_TRUST_HOST otomatik; yerel `next start` ve benzeri
  // ortamlar için host'a açıkça güvenilir (reverse proxy arkası dahil).
  trustHost: true,
  providers: [emailProvider],
  session: { strategy: "database" },
  pages: {
    verifyRequest: "/giris/gonderildi",
  },
});
