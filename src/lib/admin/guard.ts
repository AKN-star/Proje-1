/**
 * Admin/mod yetki denetimi (T4, faz-3-moderasyon-admin.md). users.role
 * 'mod'|'admin' değilse null döner — çağıran taraf (server action veya
 * /admin sayfası) buna göre redirect/notFound karar verir.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { users } from "@/db/schema";

export interface ModeratorActor {
  id: string;
  role: "mod" | "admin";
}

export async function requireModerator(
  db: Db,
  userId: string,
): Promise<ModeratorActor | null> {
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || (user.role !== "mod" && user.role !== "admin")) {
    return null;
  }

  return { id: user.id, role: user.role };
}
