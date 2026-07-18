import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Nasıl çalışır?" };

/** Güven sayfası (Faz 8 T3): moderasyon, rozet, istatistik ve çeviri
 * mekanizmalarının kullanıcıya açıklanması. */
export default function NasilCalisirPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {brand.name} nasıl çalışır?
      </h1>

      <section className="space-y-4 text-sm leading-6">
        <h2 className="text-base font-semibold">İçerikler nereden geliyor?</h2>
        <p>
          Buradaki her deneyim, soru ve yanıt gerçek kullanıcılar
          tarafından yazılır. {brand.name} tıbbi içerik üretmez; içerikler
          kişisel deneyim aktarımıdır ve hiçbir zaman hekim/eczacı
          tavsiyesinin yerine geçmez.
        </p>

        <h2 className="text-base font-semibold">Moderasyon nasıl işliyor?</h2>
        <p>
          Yayınlanan her içerik önce yapay zekâ destekli bir ön
          incelemeden geçer: açık şekilde zararlı içerik (tehlikeli doz
          önerisi, yanıltıcı tedavi iddiası vb.) yayınlanmaz; şüpheli
          içerik işaretlenip insan moderatör kuyruğuna düşer. Ayrıca her
          kullanıcı her içeriği &quot;Bildir&quot; ile raporlayabilir; raporlar
          moderatörlerce incelenir. Kuralları tekrarlı ihlal eden
          hesaplar askıya alınır.
        </p>

        <h2 className="text-base font-semibold">✔ rozeti ne anlama geliyor?</h2>
        <p>
          Adının yanında ✔ görünen kullanıcılar, doktor veya eczacı
          olduklarını beyan edip yönetici incelemesinden geçmiş
          kişilerdir. Rozet, mesleğin beyan ve incelemeyle doğrulandığını
          gösterir; rozetli kullanıcıların yazdıkları da kişisel görüş
          olup tıbbi tavsiye değildir.
        </p>

        <h2 className="text-base font-semibold">İstatistikler nasıl hesaplanıyor?</h2>
        <p>
          Her başlıktaki istatistik kartı (deneyim sayısı, ortalama etki
          puanı, sık bildirilen yan etkiler) yalnızca yayında olan
          deneyimlerden hesaplanır ve içerik eklenip kaldırıldıkça
          güncellenir. Yan etkiler serbest metinden değil, kontrollü bir
          listeden seçildiği için sayılabilir ve karşılaştırılabilirdir.
        </p>

        <h2 className="text-base font-semibold">Çeviriler</h2>
        <p>
          &quot;Çevir&quot; butonu içerikleri yapay zekâ ile çevirir. Çeviriler
          otomatiktir, hatalı olabilir ve orijinal metnin yerine geçmez;
          bu yüzden her çeviri bloğunda uyarı notu bulunur.
        </p>

        <h2 className="text-base font-semibold">Verileriniz</h2>
        <p>
          İçerikleriniz takma adınızla yayınlanır; kimlik bilgileriniz
          gösterilmez. Ayrıntı için{" "}
          <Link href="/kvkk" className="underline underline-offset-2">
            KVKK Aydınlatma Metni
          </Link>
          &apos;ne ve{" "}
          <Link href="/kullanim-sartlari" className="underline underline-offset-2">
            Kullanım Şartları
          </Link>
          &apos;na bakabilirsiniz. Paylaşımlarınızı{" "}
          <Link href="/profil" className="underline underline-offset-2">
            profil sayfanızdan
          </Link>{" "}
          istediğiniz an kaldırabilir, hesabınızı silebilirsiniz.
        </p>
      </section>
    </main>
  );
}
