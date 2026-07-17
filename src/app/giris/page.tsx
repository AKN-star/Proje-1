import { brand } from "@/config/brand";
import { googleEnabled, signIn } from "@/auth";
import { safeInternalPath } from "@/lib/url";

async function sendMagicLinkAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const redirectTo = safeInternalPath(formData.get("next"));
  await signIn("email", { email, redirectTo });
}

async function googleSignInAction(formData: FormData) {
  "use server";
  const redirectTo = safeInternalPath(formData.get("next"));
  await signIn("google", { redirectTo });
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
      {googleEnabled ? (
        <form action={googleSignInAction} className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span className="h-px flex-1 bg-neutral-200" />
            veya
            <span className="h-px flex-1 bg-neutral-200" />
          </div>
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Google ile devam et
          </button>
        </form>
      ) : null}
    </main>
  );
}
