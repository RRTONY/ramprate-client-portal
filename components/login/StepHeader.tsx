export function StepHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-[15px] text-slate-600">{text}</p>
    </div>
  );
}

export const linkClass =
  "inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800";
