import Link from "next/link";
import { Logo } from "@/components/Logo";

// DRAFT wording in plain language. Have Josh (Legal) review and edit before go-live.
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <Logo size={36} />
      </div>
      <h1 className="mb-2 text-2xl font-bold">Privacy and security</h1>
      <p className="mb-6 text-sm text-slate-500">
        How we look after what you share in the RampRate Client Portal.
      </p>
      <div className="space-y-5 text-[15px] leading-relaxed">
        <section>
          <h2 className="mb-1 font-semibold">What is in the portal</h2>
          <p>
            Your engagement overview, documents (such as NDAs, MSAs and SOWs),
            updates, meeting details, questions you send us, and the RampRate
            team contacts for your engagement.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">Who can see it</h2>
          <p>
            Only the people at your company that we invite, and the RampRate
            team members working on your engagement. Other clients can never see
            your information. Access rules are enforced in our database, not
            just on the screen.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">How it is protected</h2>
          <p>
            Connections are encrypted. Documents are stored privately and opened
            through short-lived links. RampRate staff sign in with two-step
            verification. We keep a record of who views, downloads or changes
            information in the portal so that activity can be reviewed if
            needed. We keep regular backups.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">Emails from the portal</h2>
          <p>
            We email you when something new is added and send a short weekly
            summary. You can turn these off under Account at any time.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">
            Your information when we finish working together
          </h2>
          <p>
            When an engagement ends, portal access is closed. Documents are kept
            or returned as set out in your agreement with RampRate. Ask your
            engagement owner if you want a copy of everything in your portal.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">Questions or concerns</h2>
          <p>
            Contact your RampRate engagement owner, or email{" "}
            <a
              className="text-brand-700 underline"
              href="mailto:admin@ramprate.com"
            >
              admin@ramprate.com
            </a>
            .
          </p>
        </section>
      </div>
      <p className="mt-8">
        <Link href="/login" className="text-sm font-semibold text-brand-700">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
