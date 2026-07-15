import { brand } from "@/config/brand";

/**
 * Magic link e-postası gönderir. `resend` paketi (SDK) BAĞIMLILIK
 * YASAĞI kapsamında eklenmez — RESEND_API_KEY varsa Resend REST API'sine
 * çıplak `fetch` ile POST edilir; yoksa dev modunda konsola loglanır.
 */
// Gönderici adresi tek yerde (auth.ts provider'ı da bunu kullanır);
// özel domain doğrulanınca yalnız burası değişir.
export const EMAIL_FROM = "onboarding@resend.dev";

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

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject: `${brand.name} — giriş bağlantınız`,
      html: `<p>${brand.name} hesabınıza giriş yapmak için aşağıdaki bağlantıya tıklayın:</p><p><a href="${url}">${url}</a></p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend gönderim hatası (${res.status}): ${body}`);
  }
}
