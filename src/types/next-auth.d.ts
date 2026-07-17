/**
 * NextAuth v5 database session stratejisinde varsayılan `session` callback
 * adapter kullanıcısının `id`sini `session.user.id`e ekler ancak paketin
 * tip tanımı bunu bilmez. T5'in server action'ı session.user.id'i
 * (deneyim yazarını) doğrudan kullandığı için tip burada genişletilir.
 * Auth mantığına dokunmaz — yalnızca tip bilgisi.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
