import { MfaForm } from "@/components/MfaForm";
import { Logo } from "@/components/Logo";

export default function MfaPage({
  searchParams,
}: {
  searchParams: { enroll?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center">
        <Logo size={40} />
      </div>
      <div className="card">
        <h1 className="mb-3 text-xl font-bold">Two-step sign-in</h1>
        <MfaForm forceEnroll={searchParams.enroll === "1"} />
        <form action="/auth/signout" method="post" className="mt-4 text-center">
          <button className="text-sm text-slate-500 underline">Sign out</button>
        </form>
      </div>
    </main>
  );
}
