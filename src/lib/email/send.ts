import { brand } from "@/config/brand";

/**
 * E-posta gönderimi. `resend` paketi (SDK) BAĞIMLILIK YASAĞI kapsamında
 * eklenmez — RESEND_API_KEY varsa Resend REST API'sine çıplak `fetch`
 * ile POST edilir; anahtarsız davranış çağırana bırakılır (magic link:
 * hata/log, bildirim: log).
 */
// Gönderici adresi tek yerde (auth.ts provider'ı da bunu kullanır);
// özel domain doğrulanınca yalnız burası değişir.
export const EMAIL_FROM = "onboarding@resend.dev";

/** Resend REST çağrısının tek kopyası; !res.ok fırlatır. */
async function postResendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend gönderim hatası (${res.status}): ${body}`);
  }
}

export async function sendMagicLink(to: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Prod'da anahtarsız sessizce log'a düşmek giriş linkini sızdırır ve
    // kullanıcıya hiç mail gitmez — açık hata daha güvenli.
    if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
      throw new Error("RESEND_API_KEY tanımlı değil (prod).");
    }
    console.log(`MAGIC LINK (dev): ${to} -> ${url}`);
    return;
  }

  await postResendEmail(
    apiKey,
    to,
    `${brand.name} — giriş bağlantınız`,
    `<p>${brand.name} hesabınıza giriş yapmak için aşağıdaki bağlantıya tıklayın:</p><p><a href="${url}">${url}</a></p>`,
  );
}

/**
 * Yeni rozet başvurusunu operasyon adresine bildirir (Faz 6). Başvuru
 * DB'ye yazıldıktan sonra çağrılır ve admin panelde zaten görünür —
 * e-posta hatası başvuruyu geri almaz; hata burada yutulup loglanır.
 */
export async function sendBadgeRequestNotice(request: {
  username: string;
  claimedRole: string;
  institution: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `ROZET BAŞVURUSU (dev): ${request.username} / ${request.claimedRole} / ${request.institution}`,
    );
    return;
  }

  // Kurum serbest metin — HTML e-postaya kaçırılmadan gömülmez.
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  try {
    await postResendEmail(
      apiKey,
      brand.contactEmail,
      `${brand.name} — yeni rozet başvurusu: ${request.username}`,
      `<p>Yeni rozet başvurusu var:</p><ul><li>Kullanıcı: ${esc(request.username)}</li><li>Rol: ${esc(request.claimedRole)}</li><li>Kurum: ${esc(request.institution)}</li></ul><p>Onay/red için admin paneline gidin.</p>`,
    );
  } catch (err) {
    console.error("Rozet bildirimi gönderilemedi:", err);
  }
}
