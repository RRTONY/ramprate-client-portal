"use client";

import { useState } from "react";
import { StepForgot } from "./StepForgot";
import { StepSent } from "./StepSent";
import { StepSignIn } from "./StepSignIn";
import type { LoginState, StepProps } from "./types";

const steps: Record<number, (props: StepProps) => React.ReactElement> = {
  1: StepSignIn,
  2: StepForgot,
  3: StepSent,
};

/** Sign in, forgot password, and check-your-email, one step at a time. */
export function LoginSteps({
  initialStep,
  ...rest
}: { initialStep: number } & Pick<StepProps, "error" | "signIn" | "sendReset">) {
  const [state, setState] = useState<LoginState>({ email: "" });
  const [step, setStep] = useState(initialStep);

  const updateState = (data: Partial<LoginState>) =>
    setState((s) => ({ ...s, ...data }));

  const onNext = (specificStep?: number) =>
    setStep(specificStep ?? step + 1);

  const Step = steps[step];
  return <Step state={state} updateState={updateState} onNext={onNext} {...rest} />;
}
