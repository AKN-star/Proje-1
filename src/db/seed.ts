/**
 * Faz 1 seed verisi: 20 yaygın TR ilacı + yan etki sözlüğü.
 * `seed(db)` idempotent'tir (onConflictDoNothing) — hem dev PGlite
 * ilk-kullanımda otomatik, hem test round-trip'lerinde tekrar tekrar
 * çağrılabilir.
 */
import type { Db } from "./index";
import { drugDetails, sideEffectTerms, topicI18n, topics } from "./schema";

interface DrugSeed {
  slug: string;
  nameTr: string;
  nameEn: string;
  activeIngredient: string;
}

// Marka/ürün adları burada seed verisidir (kullanıcıya gösterilen ilaç
// başlıkları), src/config/brand.ts kuralı platformun kendi markası
// içindir — bu liste kapsam dışıdır.
const DRUGS: DrugSeed[] = [
  { slug: "parol", nameTr: "Parol", nameEn: "Parol", activeIngredient: "parasetamol" },
  { slug: "majezik", nameTr: "Majezik", nameEn: "Majezik", activeIngredient: "flurbiprofen" },
  { slug: "arveles", nameTr: "Arveles", nameEn: "Arveles", activeIngredient: "deksketoprofen" },
  { slug: "nurofen", nameTr: "Nurofen", nameEn: "Nurofen", activeIngredient: "ibuprofen" },
  { slug: "aspirin", nameTr: "Aspirin", nameEn: "Aspirin", activeIngredient: "asetilsalisilik asit" },
  {
    slug: "augmentin",
    nameTr: "Augmentin",
    nameEn: "Augmentin",
    activeIngredient: "amoksisilin+klavulanik asit",
  },
  { slug: "cipralex", nameTr: "Cipralex", nameEn: "Cipralex", activeIngredient: "essitalopram" },
  { slug: "prozac", nameTr: "Prozac", nameEn: "Prozac", activeIngredient: "fluoksetin" },
  { slug: "xanax", nameTr: "Xanax", nameEn: "Xanax", activeIngredient: "alprazolam" },
  { slug: "concerta", nameTr: "Concerta", nameEn: "Concerta", activeIngredient: "metilfenidat" },
  { slug: "euthyrox", nameTr: "Euthyrox", nameEn: "Euthyrox", activeIngredient: "levotiroksin" },
  { slug: "glucophage", nameTr: "Glucophage", nameEn: "Glucophage", activeIngredient: "metformin" },
  {
    slug: "coraspin",
    nameTr: "Coraspin",
    nameEn: "Coraspin",
    activeIngredient: "asetilsalisilik asit",
  },
  { slug: "beloc", nameTr: "Beloc", nameEn: "Beloc", activeIngredient: "metoprolol" },
  { slug: "lustral", nameTr: "Lustral", nameEn: "Lustral", activeIngredient: "sertralin" },
  { slug: "dolorex", nameTr: "Dolorex", nameEn: "Dolorex", activeIngredient: "diklofenak" },
  { slug: "apranax", nameTr: "Apranax", nameEn: "Apranax", activeIngredient: "naproksen" },
  { slug: "calpol", nameTr: "Calpol", nameEn: "Calpol", activeIngredient: "parasetamol" },
  { slug: "zinco", nameTr: "Zinco", nameEn: "Zinco", activeIngredient: "çinko" },
  { slug: "devit-3", nameTr: "Devit-3", nameEn: "Devit-3", activeIngredient: "D3 vitamini" },
];

interface SideEffectSeed {
  slug: string;
  nameTr: string;
  nameEn: string;
}

const SIDE_EFFECTS: SideEffectSeed[] = [
  { slug: "bulanti", nameTr: "bulantı", nameEn: "nausea" },
  { slug: "bas-agrisi", nameTr: "baş ağrısı", nameEn: "headache" },
  { slug: "bas-donmesi", nameTr: "baş dönmesi", nameEn: "dizziness" },
  { slug: "uykusuzluk", nameTr: "uykusuzluk", nameEn: "insomnia" },
  { slug: "uyku-hali", nameTr: "uyku hali", nameEn: "drowsiness" },
  { slug: "ishal", nameTr: "ishal", nameEn: "diarrhea" },
  { slug: "kabizlik", nameTr: "kabızlık", nameEn: "constipation" },
  { slug: "dokuntu", nameTr: "döküntü", nameEn: "rash" },
  { slug: "kasinti", nameTr: "kaşıntı", nameEn: "itching" },
  { slug: "agiz-kurulugu", nameTr: "ağız kuruluğu", nameEn: "dry mouth" },
  { slug: "carpinti", nameTr: "çarpıntı", nameEn: "palpitations" },
  { slug: "istah-artisi", nameTr: "iştah artışı", nameEn: "increased appetite" },
  { slug: "istah-kaybi", nameTr: "iştah kaybı", nameEn: "loss of appetite" },
  { slug: "kilo-alimi", nameTr: "kilo alımı", nameEn: "weight gain" },
  { slug: "mide-agrisi", nameTr: "mide ağrısı", nameEn: "stomach pain" },
  { slug: "yorgunluk", nameTr: "yorgunluk", nameEn: "fatigue" },
  { slug: "titreme", nameTr: "titreme", nameEn: "tremor" },
  { slug: "terleme", nameTr: "terleme", nameEn: "sweating" },
  { slug: "cinsel-isteksizlik", nameTr: "cinsel isteksizlik", nameEn: "low libido" },
  { slug: "huzursuzluk", nameTr: "huzursuzluk", nameEn: "restlessness" },
  { slug: "hafiza-sorunlari", nameTr: "hafıza sorunları", nameEn: "memory problems" },
  { slug: "tansiyon-degisimi", nameTr: "tansiyon değişimi", nameEn: "blood pressure change" },
  { slug: "odem", nameTr: "ödem", nameEn: "edema" },
  {
    slug: "karaciger-enzim-yukselmesi",
    nameTr: "karaciğer enzim yükselmesi",
    nameEn: "elevated liver enzymes",
  },
];

export async function seed(db: Db): Promise<void> {
  for (const drug of DRUGS) {
    const [topic] = await db
      .insert(topics)
      .values({
        slug: drug.slug,
        type: "drug",
        status: "active",
        createdBy: null,
        canonicalName: drug.nameTr,
      })
      .onConflictDoNothing({ target: topics.slug })
      .returning({ id: topics.id });

    // Zaten varsa returning boş döner; id'yi slug üzerinden çekip devam et.
    const topicId =
      topic?.id ??
      (
        await db.query.topics.findFirst({
          where: (t, { eq }) => eq(t.slug, drug.slug),
        })
      )?.id;

    if (!topicId) continue;

    await db
      .insert(topicI18n)
      .values([
        { topicId, locale: "tr", name: drug.nameTr },
        { topicId, locale: "en", name: drug.nameEn },
      ])
      .onConflictDoNothing({ target: [topicI18n.topicId, topicI18n.locale] });

    await db
      .insert(drugDetails)
      .values({
        topicId,
        activeIngredient: drug.activeIngredient,
        source: "manual",
      })
      .onConflictDoNothing({ target: drugDetails.topicId });
  }

  for (const term of SIDE_EFFECTS) {
    await db
      .insert(sideEffectTerms)
      .values({ slug: term.slug, nameTr: term.nameTr, nameEn: term.nameEn })
      .onConflictDoNothing({ target: sideEffectTerms.slug });
  }
}
