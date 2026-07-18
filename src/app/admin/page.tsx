import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { requireModerator } from "@/lib/admin/guard";
import {
  listModerationQueue,
  listOpenReports,
  listPendingTopicProposals,
  searchUsers,
} from "@/lib/admin/queries";
import { Input } from "@/components/ui/input";
import { REPORT_REASONS } from "@/lib/reports/report";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  approveExperience,
  approveTopic,
  banUser,
  rejectTopic,
  removeExperience,
  resolveReport,
  reviewBadge,
} from "@/app/actions/admin";
import {
  CLAIMED_ROLE_LABELS,
  listPendingBadgeRequests,
} from "@/lib/badges/requests";
import { cn } from "@/lib/utils";

// Canlı DB verisi gösterir; build sırasında prerender edilmez (topic
// sayfasıyla aynı gerekçe — bkz. src/app/baslik/[slug]/page.tsx).
export const dynamic = "force-dynamic";

const REPORT_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.value, r.label]),
);

const TOPIC_TYPE_LABELS: Record<string, string> = {
  drug: "İlaç",
  condition: "Durum / hastalık",
  treatment: "Tedavi",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ kullanici?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    notFound();
  }

  const db = await getDb();
  const actor = await requireModerator(db, session.user.id);
  if (!actor) {
    notFound();
  }

  const { kullanici } = await searchParams;
  const userResults = kullanici ? await searchUsers(db, kullanici) : [];

  const [queue, openReports, pendingTopics, pendingBadges] = await Promise.all([
    listModerationQueue(db),
    listOpenReports(db),
    listPendingTopicProposals(db),
    listPendingBadgeRequests(db),
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

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Başlık önerileri</h2>
        {pendingTopics.length === 0 ? (
          <p className="text-muted-foreground">Bekleyen öneri yok.</p>
        ) : (
          pendingTopics.map((proposal) => (
            <Card key={proposal.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{proposal.name}</CardTitle>
                  <Badge variant="outline">
                    {TOPIC_TYPE_LABELS[proposal.type] ?? proposal.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Öneren: @{proposal.proposerUsername}
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={approveTopic}>
                    <input type="hidden" name="topicId" value={proposal.id} />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                    >
                      Onayla
                    </button>
                  </form>
                  <form action={rejectTopic}>
                    <input type="hidden" name="topicId" value={proposal.id} />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
                    >
                      Reddet
                    </button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Kullanıcılar</h2>
        <form method="GET" className="flex max-w-md gap-2">
          <Input
            type="search"
            name="kullanici"
            defaultValue={kullanici ?? ""}
            placeholder="Takma ad veya e-posta ara..."
            aria-label="Kullanıcı ara"
          />
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            Ara
          </button>
        </form>
        {kullanici &&
          (userResults.length === 0 ? (
            <p className="text-muted-foreground">Kullanıcı bulunamadı.</p>
          ) : (
            userResults.map((user) => (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">@{user.username}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{user.role}</Badge>
                      {user.bannedAt && (
                        <Badge variant="outline" className="border-red-300 text-red-700 dark:border-red-800 dark:text-red-400">
                          Banlı
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {user.email} · {user.experienceCount} deneyim ·{" "}
                    {user.questionCount} soru · {user.answerCount} yanıt
                  </span>
                  {!user.bannedAt && user.role !== "admin" && user.role !== "mod" && (
                    <form action={banUser}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input
                        type="hidden"
                        name="returnPath"
                        value={`/admin?kullanici=${encodeURIComponent(kullanici ?? "")}`}
                      />
                      <button
                        type="submit"
                        className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
                      >
                        Banla
                      </button>
                    </form>
                  )}
                </CardContent>
              </Card>
            ))
          ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Rozet başvuruları</h2>
        {pendingBadges.length === 0 ? (
          <p className="text-muted-foreground">Bekleyen başvuru yok.</p>
        ) : (
          pendingBadges.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">@{request.username}</CardTitle>
                  <Badge variant="outline">
                    {CLAIMED_ROLE_LABELS[request.claimedRole]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {request.email} · {formatDate(request.createdAt)}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Kurum:</span> {request.institution}
                </p>
                <p className="whitespace-pre-wrap text-sm">{request.documentNote}</p>
                <div className="flex flex-wrap gap-2">
                  <form action={reviewBadge}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                    >
                      Onayla
                    </button>
                  </form>
                  <form action={reviewBadge}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
                    >
                      Reddet
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
