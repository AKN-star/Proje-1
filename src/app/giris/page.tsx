import { brand } from "@/config/brand";
import { signIn } from "@/auth";

async function sendMagicLinkAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const next = String(formData.get("next") ?? "");
  // Açık redirect engeli: yalnız site içi yollar.
  const redirectTo =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";
  await signIn("email", { email, redirectTo });
}

export default async function GirisPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/" } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">{brand.name}</h1>
        <p className="text-sm text-neutral-500">
          E-posta adresinizi girin, size bir giriş bağlantısı gönderelim.
        </p>
      </div>
      <form action={sendMagicLinkAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          type="email"
          name="email"
          required
          placeholder="ornek@eposta.com"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Giriş bağlantısı gönder
        </button>
      </form>
    </main>
  );
}
