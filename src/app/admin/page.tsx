import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireSession();

  if (session.role !== "ADMIN") redirect("/dashboard");

  redirect("/dashboard");
}
