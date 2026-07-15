/**
 * İlk girişte kullanıcı adı üretimi (spec T3): e-posta local-part'ının
 * alfanumerik dışı karakterleri temizlenir + '-' + rastgele 4 hane.
 * Saf fonksiyon — çakışma çözümü (deneme sayısı) çağıran tarafta.
 */
export function generateUsername(
  email: string,
  rand: () => number = Math.random,
): string {
  const localPart = email.split("@")[0] ?? "";
  const cleaned = localPart.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const base = cleaned.length > 0 ? cleaned : "kullanici";
  const digits = Math.floor(rand() * 10000)
    .toString()
    .padStart(4, "0");
  return `${base}-${digits}`;
}
