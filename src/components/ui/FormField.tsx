import { cn } from "@/lib/utils";
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-forest">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-wood">{error}</p>}
    </div>
  );
}

const inputCls =
  "mt-1 block w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const { label, error, ...rest } = props;
  return (
    <Field label={label} error={error}>
      <input className={cn(inputCls, error && "border-wood")} {...rest} />
    </Field>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  const { label, error, ...rest } = props;
  return (
    <Field label={label} error={error}>
      <textarea className={cn(inputCls, error && "border-wood")} {...rest} />
    </Field>
  );
}

export function Select(
  props: SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    error?: string;
    options: { value: string; label: string }[];
  }
) {
  const { label, error, options, ...rest } = props;
  return (
    <Field label={label} error={error}>
      <select className={cn(inputCls, error && "border-wood")} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}