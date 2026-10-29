export function IconField({
  id,
  label,
  icon,
  ...input
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          {icon}
        </span>
        <input id={id} name={id} required className="input pl-10" {...input} />
      </div>
    </div>
  );
}
