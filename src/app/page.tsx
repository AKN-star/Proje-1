import { brand } from "@/config/brand";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{brand.name}</h1>
      <p className="max-w-md text-muted-foreground">{brand.tagline.tr}</p>
      <p className="text-sm text-muted-foreground">Yapım aşamasında.</p>
    </main>
  );
}
