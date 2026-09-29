import { useId, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Field({
  label,
  error,
  htmlFor,
  errorId,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-forest">
        {label}
      </label>
      {children}
      {error && errorId && (
        <p id={errorId} className="mt-1 text-xs text-wood">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "mt-1 block min-h-11 w-full rounded-md border border-wood/30 bg-cream px-4 py-2.5 text-sm text-forest placeholder:text-muted/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const { label, error, ...rest } = props;
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <Field label={label} error={error} htmlFor={id} errorId={errorId}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={inputCls}
        {...rest}
      />
    </Field>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  const { label, error, ...rest } = props;
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <Field label={label} error={error} htmlFor={id} errorId={errorId}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={inputCls}
        {...rest}
      />
    </Field>
  );
}

export function Select(
  props: SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    error?: string;
    options: { value: string; label: string }[];
  },
) {
  const { label, error, options, ...rest } = props;
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <Field label={label} error={error} htmlFor={id} errorId={errorId}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={inputCls}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
