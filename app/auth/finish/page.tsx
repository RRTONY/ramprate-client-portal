import { AuthFinish } from "@/components/AuthFinish";
import { Logo } from "@/components/Logo";

export default function AuthFinishPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-6 flex justify-center">
        <Logo size={40} />
      </div>
      <div className="card">
        <h1 className="mb-3 text-xl font-bold">Opening your portal</h1>
        <AuthFinish next={searchParams.next ?? null} />
      </div>
    </main>
  );
}
