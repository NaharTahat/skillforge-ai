import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Keep the hint visible alongside an error (e.g. a live requirements checklist). */
  persistentHint?: boolean;
  /** Right-aligned element on the label row, e.g. "Forgot password?". */
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Label + control + message. The control must set `id`, `aria-invalid` and
 * `aria-describedby={fieldDescribedBy(id, error, hint)}`.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  persistentHint = false,
  labelAction,
  className,
  children,
}: FormFieldProps) {
  const showHint = Boolean(hint) && (persistentHint || !error);

  return (
    // content-start keeps label and control together when a grid row is taller.
    <div className={cn("grid content-start gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children}
      {showHint && (
        <div id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </div>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function fieldDescribedBy(
  id: string,
  error?: string,
  hint?: unknown,
  persistentHint = false,
) {
  if (error) return hint && persistentHint ? `${id}-error ${id}-hint` : `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

/** Comfortable control height on touch devices; compact on desktop. */
export const controlClassName = "h-10 md:h-9";

/** Select triggers size via a data attribute, so their height needs the same variant. */
export const selectTriggerClassName = "w-full data-[size=default]:h-10 md:data-[size=default]:h-9";
