import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { medicalDisclaimer } from "@/config/disclaimer";
import { LegalDraftBanner } from "@/components/legal-draft-banner";

export const metadata: Metadata = { title: "Kullanım Şartları" };

/**
 * Kullanım şartları TASLAĞI (Faz 7 T3). Tıbbi sorumluluk reddi mevcut
 * disclaimer metniyle (src/config/disclaimer.ts) tutarlıdır; hukuk
 * incelemesi insan adımıdır.
 */
export default function KullanimSartlariPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Kullanım Şartları</h1>
      <LegalDraftBanner />

      <section className="space-y-4 text-sm leading-6">
        <h2 className="text-base font-semibold">1. Hizmetin niteliği</h2>
        <p>
          {brand.name}, kullanıcıların ilaç ve tedavi deneyimlerini
          yapılandırılmış biçimde paylaştığı bir platformdur. İçerikler
          kullanıcı beyanıdır; {brand.name} içeriklerin doğruluğunu garanti
          etmez.
        </p>

        <h2 className="text-base font-semibold">2. Tıbbi sorumluluk reddi</h2>
        <p>{medicalDisclaimer.tr}</p>
        <p>
          Platformdaki hiçbir içerik teşhis, tedavi veya ilaç
          kullanımı/bırakımı kararına dayanak yapılamaz. Acil durumlarda
          112&apos;yi arayın; sağlık kararlarınızı mutlaka hekiminize veya
          eczacınıza danışarak alın. &quot;Doğrulanmış&quot; rozeti yalnızca meslek
          beyanının incelendiğini gösterir; rozetli kullanıcıların
          yanıtları da tıbbi tavsiye değildir.
        </p>

        <h2 className="text-base font-semibold">3. Kullanıcı yükümlülükleri</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Yanıltıcı sağlık bilgisi, reklam ve spam paylaşmamak.</li>
          <li>Üçüncü kişilerin kişisel/sağlık verisini paylaşmamak.</li>
          <li>Deneyimleri kendi yaşantısına dayanarak aktarmak.</li>
        </ul>
        <p>
          Aykırı içerikler yapay zekâ destekli ön inceleme ve moderatör
          kararıyla yayından kaldırılabilir; hesap askıya alınabilir.
        </p>

        <h2 className="text-base font-semibold">4. Fikri haklar ve lisans</h2>
        <p>
          Paylaştığınız içeriğin size ait olduğunu beyan eder; {brand.name}
          &apos;a içeriği platformda yayınlama, çoğaltma ve talebiniz üzerine
          başka dillere çevirme hakkı tanırsınız.
        </p>

        <h2 className="text-base font-semibold">5. Değişiklik ve iletişim</h2>
        <p>
          Şartlar güncellenebilir; önemli değişiklikler platformda duyurulur.
          İletişim: {brand.contactEmail}
        </p>
      </section>
    </main>
  );
}
