export type LoginState = { email: string };

export type StepProps = {
  state: LoginState;
  updateState: (data: Partial<LoginState>) => void;
  onNext: (specificStep?: number) => void;
  error?: string;
  signIn: (formData: FormData) => Promise<void>;
  sendReset: (formData: FormData) => Promise<void>;
};
