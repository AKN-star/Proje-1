import { brand } from "@/config/brand";

export default function GirisGonderildiPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Bağlantı gönderildi</h1>
      <p className="text-sm text-neutral-500">
        {brand.name} hesabınıza giriş yapmak için e-postanıza gönderdiğimiz
        bağlantıya tıklayın.
      </p>
    </main>
  );
}
