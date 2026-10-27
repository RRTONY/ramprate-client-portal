import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await requireProfile();
  if (profile.role === "client") {
    if (!profile.client_id) redirect("/login?error=no-client");
    redirect(`/portal/${profile.client_id}`);
  }
  redirect("/admin");
}
