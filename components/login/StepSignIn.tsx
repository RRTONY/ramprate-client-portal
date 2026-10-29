import { FiKey, FiLock, FiMail } from "react-icons/fi";
import { SubmitButton } from "@/components/SubmitButton";
import { PendingOverlay } from "@/components/PendingOverlay";
import { Notice } from "@/components/ui";
import { IconField } from "./IconField";
import { StepHeader, linkClass } from "./StepHeader";
import type { StepProps } from "./types";

export function StepSignIn({ state, updateState, onNext, error, signIn }: StepProps) {
  return (
    <>
      <StepHeader
        title="Welcome back"
        text="Sign in to your RampRate client portal to see where your engagement stands."
      />
      <div className="card">
        {error && <Notice kind="error">{error}</Notice>}
        <form action={signIn} className="space-y-4">
          <IconField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={state.email}
            onChange={(e) => updateState({ email: e.target.value })}
            icon={<FiMail aria-hidden className="h-4 w-4" />}
          />
          <IconField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            icon={<FiLock aria-hidden className="h-4 w-4" />}
          />
          <PendingOverlay label="Opening your portal" />
          <SubmitButton pendingText="Signing in..." className="btn w-full">
            Sign in
          </SubmitButton>
        </form>
        <div className="mt-5 text-center">
          <button type="button" onClick={() => onNext(2)} className={linkClass}>
            <FiKey aria-hidden className="h-4 w-4" />
            Forgot your password?
          </button>
        </div>
      </div>
    </>
  );
}
