/**
 * Deneyim formu alanları — oluşturma (deneyim-yaz) ve düzenleme
 * (deneyim-duzenle) sayfalarının TEK kaynağı (Faz 9 review: ~90 satır
 * kopyaydı, min/max değişimi iki dosyada ayrışıyordu).
 */
import { Input } from "@/components/ui/input";

export interface ExperienceFormDefaults {
  purpose?: string;
  durationDays?: number | null;
  effectiveness?: number;
  body?: string;
  sideEffectIds?: string[];
}

export function ExperienceFormFields({
  terms,
  defaults = {},
}: {
  terms: { id: string; nameTr: string }[];
  defaults?: ExperienceFormDefaults;
}) {
  const selected = new Set(defaults.sideEffectIds ?? []);
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="purpose" className="text-sm font-medium">
          Amaç
        </label>
        <Input
          id="purpose"
          name="purpose"
          type="text"
          required
          minLength={3}
          maxLength={200}
          placeholder="Örn. baş ağrısı"
          defaultValue={defaults.purpose}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="durationDays" className="text-sm font-medium">
          Süre (gün, opsiyonel)
        </label>
        <Input
          id="durationDays"
          name="durationDays"
          type="number"
          min={1}
          max={3650}
          defaultValue={defaults.durationDays ?? ""}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Etki (1-5)</legend>
        <div className="flex items-center gap-3">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="effectiveness"
                value={value}
                required
                defaultChecked={value === (defaults.effectiveness ?? 3)}
              />
              {"★".repeat(value)}
            </label>
          ))}
        </div>
      </fieldset>

      {terms.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">Yan etkiler (varsa)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {terms.map((term) => (
              <label key={term.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="sideEffectIds"
                  value={term.id}
                  defaultChecked={selected.has(term.id)}
                />
                {term.nameTr}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-sm font-medium">
          Deneyiminizi anlatın
        </label>
        <textarea
          id="body"
          name="body"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          defaultValue={defaults.body}
          className="border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
          placeholder="Ne zaman başladınız, nasıl hissettiniz, önerir misiniz..."
        />
      </div>
    </>
  );
}
