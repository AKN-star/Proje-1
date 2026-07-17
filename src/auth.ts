import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import type { EmailConfig } from "next-auth/providers/email";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/auth-schema";
import { EMAIL_FROM, sendMagicLink } from "@/lib/email/send";

// `getDb()` async'tir (Neon/PGlite seçimi runtime'da yapılır); NextAuth
// config'i eşzamanlı bir adapter nesnesi ister. Next.js RSC/route handler
// modülleri ESM olduğu için üst seviye await desteklenir — modül yalnızca
// bir kez değerlendirilir ve `db` burada çözülür.
const db = await getDb();

// Kullanıcı username'siz (NULL) yaratılır: master plan sözleşmesi gereği
// takma ad + KVKK rızası ilk girişteki onboarding adımında toplanır
// (/hosgeldin); yazma eylemleri o adım tamamlanmadan reddedilir.
const adapter: Adapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
}) as Adapter;

const emailProvider: EmailConfig = {
  id: "email",
  type: "email",
  name: "E-posta",
  from: EMAIL_FROM,
  maxAge: 24 * 60 * 60,
  async sendVerificationRequest({ identifier, url }) {
    await sendMagicLink(identifier, url);
  },
};

// Google OAuth (Faz 6): env yoksa provider hiç eklenmez — /giris'te
// buton da görünmez (anahtarsız zarif düşüş). Hesap birleştirme
// (allowDangerousEmailAccountLinking) bilinçle KAPALI (varsayılan):
// aynı e-postayla daha önce magic-link hesabı açılmışsa Google girişi
// OAuthAccountNotLinked ile reddedilir (users.email unique — ikinci
// hesap açılamaz); kullanıcı /giris/hata sayfasında e-posta ile giriş
// yapmaya yönlendirilir. Hesap ele geçirme riskine karşı bu tercih.
export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

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
  providers: googleEnabled ? [emailProvider, Google] : [emailProvider],
  session: { strategy: "database" },
  pages: {
    verifyRequest: "/giris/gonderildi",
    error: "/giris/hata",
  },
});
