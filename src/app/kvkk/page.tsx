import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { LegalDraftBanner } from "@/components/legal-draft-banner";

export const metadata: Metadata = { title: "KVKK Aydınlatma Metni" };

/**
 * KVKK aydınlatma metni TASLAĞI (Faz 7 T3). Yayın öncesi bir hukukçu
 * tarafından gözden geçirilmesi master planda insan adımıdır; banner
 * onay gelene kadar kalır.
 */
export default function KvkkPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Kişisel Verilerin Korunması — Aydınlatma Metni
      </h1>
      <LegalDraftBanner />

      <section className="space-y-4 text-sm leading-6">
        <p>
          Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;)
          kapsamında, {brand.name} platformunu kullanan kişilerin kişisel
          verilerinin işlenmesine ilişkin aydınlatma yükümlülüğünün yerine
          getirilmesi amacıyla hazırlanmıştır.
        </p>

        <h2 className="text-base font-semibold">İşlenen kişisel veriler</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Kimlik ve iletişim: e-posta adresi, seçtiğiniz takma ad.</li>
          <li>
            Özel nitelikli sağlık verisi: paylaştığınız ilaç/tedavi
            deneyimleri, yan etki seçimleri, soru ve yanıt içerikleri.
            Bu veriler yalnızca açık rızanızla işlenir ve takma adınızla
            yayınlanır; gerçek kimliğinizle ilişkilendirilerek gösterilmez.
          </li>
          <li>
            İşlem güvenliği: oturum kayıtları, içerik oluşturma zamanları.
          </li>
        </ul>

        <h2 className="text-base font-semibold">İşleme amaçları ve hukuki sebep</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Hizmetin sunulması (üyelik, içerik yayınlama, istatistik
            üretimi) — açık rıza (KVKK m.6/2, sağlık verisi için).
          </li>
          <li>
            İçerik güvenliği ve moderasyon (yapay zekâ destekli ön
            inceleme dahil) — meşru menfaat ve hukuki yükümlülük.
          </li>
          <li>
            Talebiniz üzerine içeriğin başka dile çevrilmesi — açık rıza
            kapsamındaki yayın amacının devamı.
          </li>
        </ul>

        <h2 className="text-base font-semibold">Aktarım</h2>
        <p>
          Veriler; barındırma (Vercel), veritabanı (Neon), e-posta iletimi
          (Resend) ve içerik moderasyonu/çevirisi (Anthropic) hizmet
          sağlayıcılarına, hizmetin gerektirdiği ölçüde ve sözleşmesel
          güvencelerle aktarılabilir. Bu sağlayıcıların sunucuları yurt
          dışında olabilir; açık rızanız bu aktarımı da kapsar.
        </p>

        <h2 className="text-base font-semibold">Saklama süresi</h2>
        <p>
          Hesabınız aktif olduğu sürece; hesap silme talebinizde kimlikle
          ilişkili veriler silinir, yayınlanmış anonim içerik istatistik
          bütünlüğü için anonim biçimde korunabilir.
        </p>

        <h2 className="text-base font-semibold">Haklarınız (KVKK m.11)</h2>
        <p>
          Verilerinizin işlenip işlenmediğini öğrenme, düzeltme, silme,
          işlemeye itiraz ve zararın giderilmesini talep etme haklarına
          sahipsiniz. Talepleriniz için: {brand.contactEmail}
        </p>
      </section>
    </main>
  );
}
