import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { postLoginDestination } from "@/lib/landing-redirect";

export const dynamic = "force-dynamic";

/** Server-side hop after sign-in (credentials or Google) that picks the right contest. */
export default async function PostLoginPage() {
  const session = await auth();
  const h = await headers();
  const dest = await postLoginDestination(session?.user?.id ?? null, h.get("x-forwarded-host") ?? h.get("host"));
  redirect(dest);
}
