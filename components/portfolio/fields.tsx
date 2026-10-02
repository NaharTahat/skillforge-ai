"use client";

import type { ReactNode } from "react";
import { controlClassName, fieldDescribedBy, FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VISIBILITIES, VISIBILITY_LABELS, type Visibility } from "@/lib/portfolio/constants";
import { cn } from "@/lib/utils";

/**
 * Small controlled fields for the portfolio forms. Each one wires label, hint
 * and error to its control so screen readers announce them together.
 */

type Base = { id: string; label: string; error?: string; hint?: ReactNode; className?: string };

export function TextField({
  id,
  label,
  error,
  hint,
  className,
  value,
  onChange,
  type = "text",
  maxLength,
  placeholder,
  required,
  inputMode,
}: Base & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url" | "date";
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  inputMode?: "url" | "text";
}) {
  return (
    <FormField
      id={id}
      label={required ? `${label} *` : label}
      error={error}
      hint={hint}
      className={className}
    >
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode ?? (type === "url" ? "url" : undefined)}
        aria-required={required || undefined}
        className={controlClassName}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescribedBy(id, error, hint)}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  hint,
  className,
  value,
  onChange,
  maxLength,
  rows = 4,
  placeholder,
  labelAction,
}: Base & {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  labelAction?: ReactNode;
}) {
  const counter = maxLength ? `${value.length}/${maxLength} characters` : undefined;
  const fullHint =
    hint || counter ? (
      <>
        {hint}
        {hint && counter ? " · " : null}
        {counter}
      </>
    ) : undefined;
  return (
    <FormField
      id={id}
      label={label}
      error={error}
      hint={fullHint}
      labelAction={labelAction}
      className={className}
    >
      <Textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-24"
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescribedBy(id, error, fullHint)}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}

export const nativeSelectClassName =
  "h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:h-9 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground";

export function SelectField<T extends string>({
  id,
  label,
  error,
  hint,
  className,
  value,
  onChange,
  options,
}: Base & {
  value: T | "";
  onChange: (value: T) => void;
  options: readonly { value: T | ""; label: string }[];
}) {
  return (
    <FormField id={id} label={label} error={error} hint={hint} className={className}>
      <select
        id={id}
        name={id}
        value={value}
        className={nativeSelectClassName}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescribedBy(id, error, hint)}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export function VisibilityField({
  id,
  value,
  onChange,
  className,
  hint = "New items are private until you choose to show them.",
}: {
  id: string;
  value: Visibility;
  onChange: (value: Visibility) => void;
  className?: string;
  hint?: string;
}) {
  return (
    <SelectField
      id={id}
      label="Visibility"
      value={value}
      onChange={onChange}
      hint={hint}
      className={className}
      options={VISIBILITIES.map((v) => ({
        value: v,
        label:
          v === "PUBLIC"
            ? `${VISIBILITY_LABELS[v]} — shown on your public portfolio`
            : `${VISIBILITY_LABELS[v]} — only you`,
      }))}
    />
  );
}

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  description,
  className,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="size-6 shrink-0 accent-[var(--brand)] md:mt-0.5 md:size-4"
      />
      <div className="grid gap-0.5 pt-1 md:pt-0">
        <label htmlFor={id} className="text-sm leading-tight font-medium">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
