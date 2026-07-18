/**
 * Soru sahibine yanıt bildirimi kararı + gönderimi (Faz 8 T2). Karar
 * guard'ları (kendine yanıt yok, email_optout'a saygı) ve e-posta
 * kompozisyonu tek yerde — kuyruktan onaylanan yanıtlar bildirim
 * gönderecek olursa (spec bilinen sınırı) admin action'ı da BUNU
 * çağırır, guard'lar kopyalanmaz. Hata sendAnswerNotice'ta yutulur;
 * response gönderildikten sonra (next/server after) koşturulmalıdır.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { questions, users } from "@/db/schema";
import { sendAnswerNotice } from "@/lib/email/send";
import { siteUrl } from "@/lib/launch";

export async function notifyQuestionOwner(
  db: Db,
  questionId: string,
  answererId: string,
): Promise<void> {
  const [owner] = await db
    .select({
      id: users.id,
      email: users.email,
      emailOptout: users.emailOptout,
      title: questions.title,
    })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.userId))
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!owner || owner.id === answererId || owner.emailOptout) return;

  await sendAnswerNotice({
    to: owner.email,
    questionTitle: owner.title,
    questionUrl: `${siteUrl()}/soru/${questionId}`,
  });
}
