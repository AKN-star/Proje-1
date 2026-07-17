import Link from "next/link";

/**
 * Auth.js hata sayfası (pages.error). En sık durum: aynı e-postayla
 * daha önce e-posta bağlantısıyla hesap açılmışken Google ile giriş
 * denemesi (OAuthAccountNotLinked — bkz. src/auth.ts notu).
 */
const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "Bu e-posta adresiyle daha önce e-posta bağlantısıyla giriş yapılmış. Lütfen aynı adresle e-posta bağlantısı isteyerek giriş yapın.",
  AccessDenied: "Bu hesapla giriş izni verilmedi.",
  Verification:
    "Giriş bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.",
};

export default async function GirisHataPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    (error && ERROR_MESSAGES[error]) ??
    "Giriş sırasında bir sorun oluştu. Lütfen tekrar deneyin.";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Giriş yapılamadı</h1>
      <p className="text-sm text-neutral-500">{message}</p>
      <Link href="/giris" className="text-sm font-medium underline">
        Giriş sayfasına dön
      </Link>
    </main>
  );
}
