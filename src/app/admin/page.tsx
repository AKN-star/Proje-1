import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { requireModerator } from "@/lib/admin/guard";
import { listModerationQueue, listOpenReports } from "@/lib/admin/queries";
import { REPORT_REASONS } from "@/lib/reports/report";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  approveExperience,
  banUser,
  removeExperience,
  resolveReport,
} from "@/app/actions/admin";
import { cn } from "@/lib/utils";

// Canlı DB verisi gösterir; build sırasında prerender edilmez (topic
// sayfasıyla aynı gerekçe — bkz. src/app/baslik/[slug]/page.tsx).
export const dynamic = "force-dynamic";

const REPORT_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.value, r.label]),
);

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    notFound();
  }

  const db = await getDb();
  const actor = await requireModerator(db, session.user.id);
  if (!actor) {
    notFound();
  }

  const [queue, openReports] = await Promise.all([
    listModerationQueue(db),
    listOpenReports(db),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Admin paneli</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Moderasyon kuyruğu</h2>
        {queue.length === 0 ? (
          <p className="text-muted-foreground">Kuyruk boş.</p>
        ) : (
          queue.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">@{item.authorUsername}</CardTitle>
                    <Badge
                      variant="outline"
                      className={
                        item.status === "flagged"
                          ? "border-amber-300 text-amber-700 dark:text-amber-400"
                          : "border-blue-300 text-blue-700 dark:text-blue-400"
                      }
                    >
                      {item.status === "flagged" ? "flagged" : "pending"}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm">
                  <strong>Konu:</strong>{" "}
                  <Link href={`/baslik/${item.topicSlug}`} className="hover:underline">
                    {item.topicName}
                  </Link>{" "}
                  · <strong>Amaç:</strong> {item.purpose}
                </p>
                {item.aiReasons.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    AI gerekçesi: {item.aiReasons.join(", ")}
                  </p>
                )}
                <p className="max-h-40 overflow-hidden whitespace-pre-wrap text-sm">
                  {item.body}
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={approveExperience}>
                    <input type="hidden" name="experienceId" value={item.id} />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                    >
                      Onayla
                    </button>
                  </form>
                  <form action={removeExperience}>
                    <input type="hidden" name="experienceId" value={item.id} />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
                    >
                      Kaldır
                    </button>
                  </form>
                  <form action={banUser}>
                    <input type="hidden" name="userId" value={item.authorId} />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Yazarı banla
                    </button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Açık raporlar</h2>
        {openReports.length === 0 ? (
          <p className="text-muted-foreground">Açık rapor yok.</p>
        ) : (
          openReports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {REPORT_REASON_LABELS[report.reason] ?? report.reason}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(report.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Raporlayan: @{report.reporterUsername}
                </p>
                <p className="text-sm">
                  <strong>Hedef:</strong> @{report.targetAuthorUsername} —{" "}
                  <Link
                    href={`/baslik/${report.targetTopicSlug}`}
                    className="hover:underline"
                  >
                    konu sayfası
                  </Link>
                </p>
                <p className="text-sm text-muted-foreground">{report.targetBodyPreview}</p>
                <div className="flex flex-wrap gap-2">
                  <form action={resolveReport}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                    >
                      Çözüldü
                    </button>
                  </form>
                  {report.targetStatus === "published" && (
                    <form action={removeExperience}>
                      <input
                        type="hidden"
                        name="experienceId"
                        value={report.targetExperienceId}
                      />
                      <button
                        type="submit"
                        className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
                      >
                        Kaldır
                      </button>
                    </form>
                  )}
                  <form action={banUser}>
                    <input type="hidden" name="userId" value={report.targetAuthorId} />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Yazarı banla
                    </button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
