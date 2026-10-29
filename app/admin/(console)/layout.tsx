import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireStaff();
  return (
    <div className="min-h-screen">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/admin" className="flex items-center gap-2 font-bold">
              <Logo size={30} onDark />
              <span className="text-slate-400">Portal admin</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
              <Link href="/admin" className="hover:text-white">
                Clients
              </Link>
              {profile.role === "admin" && (
                <>
                  <Link href="/admin/team" className="hover:text-white">
                    Team directory
                  </Link>
                  <Link href="/admin/users" className="hover:text-white">
                    Staff access
                  </Link>
                  <Link href="/admin/audit" className="hover:text-white">
                    Audit log
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-300 sm:inline">
              {profile.full_name || profile.email}
            </span>
            <Link
              href="/auth/set-password"
              className="text-xs font-semibold text-slate-300 hover:text-white"
            >
              Change password
            </Link>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
