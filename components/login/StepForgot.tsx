import { FiArrowLeft, FiMail } from "react-icons/fi";
import { SubmitButton } from "@/components/SubmitButton";
import { IconField } from "./IconField";
import { StepHeader, linkClass } from "./StepHeader";
import type { StepProps } from "./types";

export function StepForgot({ state, updateState, onNext, sendReset }: StepProps) {
  return (
    <>
      <StepHeader
        title="Reset your password"
        text="Enter the email you use for the portal and we will send you a link to choose a new password."
      />
      <div className="card">
        <form action={sendReset} className="space-y-4">
          <IconField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            autoFocus
            value={state.email}
            onChange={(e) => updateState({ email: e.target.value })}
            icon={<FiMail aria-hidden className="h-4 w-4" />}
          />
          <SubmitButton pendingText="Sending..." className="btn w-full">
            Send reset link
          </SubmitButton>
        </form>
        <div className="mt-5 text-center">
          <button type="button" onClick={() => onNext(1)} className={linkClass}>
            <FiArrowLeft aria-hidden className="h-4 w-4" />
            Back to sign in
          </button>
        </div>
      </div>
    </>
  );
}
