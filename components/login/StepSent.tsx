import { FiArrowLeft, FiMail } from "react-icons/fi";
import { StepHeader, linkClass } from "./StepHeader";
import type { StepProps } from "./types";

export function StepSent({ onNext }: StepProps) {
  return (
    <>
      <StepHeader
        title="Check your email"
        text="If that email has an account, a reset link is on its way. It works once and expires soon."
      />
      <div className="card space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <FiMail aria-hidden className="h-6 w-6" />
        </div>
        <p className="text-sm text-slate-600">
          Did not get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => onNext(2)}
            className="font-medium text-brand-700 underline"
          >
            try again
          </button>
          .
        </p>
        <button type="button" onClick={() => onNext(1)} className={linkClass}>
          <FiArrowLeft aria-hidden className="h-4 w-4" />
          Back to sign in
        </button>
      </div>
    </>
  );
}
