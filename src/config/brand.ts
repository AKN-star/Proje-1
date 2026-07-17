/**
 * Marka kararı sonraya bırakıldı. Tüm marka string'leri BURADAN gelir;
 * isim değişince yalnızca bu dosya değişir. Kod tarafında nötr `app`
 * adlandırması kullanılır — marka adını koda gömme.
 */
export const brand = {
  /** Çalışma adı — nihai marka değil. */
  name: "Kullanılır mı",
  tagline: {
    tr: "İlaç ve tedavi deneyimlerini yapılandırılmış biçimde paylaş, gerçek kullanıcı istatistiklerini gör.",
    en: "Share structured medication and treatment experiences, see real user statistics.",
  },
  /** Rozet başvuruları ve operasyonel bildirimlerin gideceği adres. */
  contactEmail: "hepteqsadeceteq@gmail.com",
} as const;
