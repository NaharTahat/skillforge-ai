"use client";

import { useRouter } from "next/navigation";
import {
  Award,
  BriefcaseBusiness,
  GraduationCap,
  Loader2,
  Medal,
  Pencil,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSectionAction } from "@/app/dashboard/portfolio/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ACHIEVEMENT_KIND_LABELS,
  ACHIEVEMENT_KINDS,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  type Visibility,
} from "@/lib/portfolio/constants";
import { DeleteItemButton, VisibilityBadge, VisibilityToggle } from "./item-actions";
import { SelectField, TextAreaField, TextField, VisibilityField } from "./fields";
import { formatMonth, formatRange, toDateInput } from "./format";

export type SectionKind = "education" | "certification" | "achievement" | "experience";

type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "url" | "date" | "textarea" | "select" | "list";
  required?: boolean;
  max?: number;
  options?: readonly { value: string; label: string }[];
  hint?: string;
  wide?: boolean;
};

type Item = { id: string; visibility: Visibility } & Record<string, unknown>;

type SectionConfig = {
  title: string;
  singular: string;
  icon: LucideIcon;
  empty: string;
  fields: FieldSpec[];
  heading: (i: Item) => string;
  sub: (i: Item) => string | null;
  meta: (i: Item) => string | null;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

const CONFIG: Record<SectionKind, SectionConfig> = {
  education: {
    title: "Education",
    singular: "education",
    icon: GraduationCap,
    empty: "Add a degree, diploma, bootcamp or course you've completed.",
    fields: [
      { key: "institution", label: "Institution", type: "text", required: true, max: 200 },
      { key: "degree", label: "Degree", type: "text", max: 200 },
      { key: "field", label: "Field of study", type: "text", max: 200 },
      { key: "grade", label: "Grade", type: "text", max: 60 },
      { key: "startDate", label: "Start date", type: "date" },
      { key: "endDate", label: "End date", type: "date", hint: "Leave empty if ongoing." },
      { key: "description", label: "Description", type: "textarea", max: 2000, wide: true },
    ],
    heading: (i) => str(i.institution),
    sub: (i) => [str(i.degree), str(i.field)].filter(Boolean).join(" · ") || null,
    meta: (i) => formatRange(i.startDate as Date | null, i.endDate as Date | null),
  },
  certification: {
    title: "Certifications",
    singular: "certification",
    icon: Medal,
    empty:
      "Add certifications you've earned. They're shown as user-provided; SkillForge doesn't verify them.",
    fields: [
      { key: "name", label: "Certification name", type: "text", required: true, max: 200 },
      { key: "issuer", label: "Issuer", type: "text", required: true, max: 200 },
      { key: "issueDate", label: "Issue date", type: "date" },
      { key: "expirationDate", label: "Expiration date", type: "date" },
      { key: "credentialId", label: "Credential ID", type: "text", max: 120 },
      { key: "credentialUrl", label: "Credential URL", type: "url" },
      {
        key: "skills",
        label: "Related skills",
        type: "list",
        hint: "Comma-separated, e.g. Python, SQL. Links this certification to those skills as evidence.",
        wide: true,
      },
      { key: "description", label: "Description", type: "textarea", max: 2000, wide: true },
    ],
    heading: (i) => str(i.name),
    sub: (i) => str(i.issuer) || null,
    meta: (i) => {
      const parts = [
        i.issueDate ? `Issued ${formatMonth(i.issueDate as Date)}` : null,
        i.expirationDate ? `Expires ${formatMonth(i.expirationDate as Date)}` : null,
      ];
      return parts.filter(Boolean).join(" · ") || null;
    },
  },
  achievement: {
    title: "Achievements",
    singular: "achievement",
    icon: Award,
    empty: "Add competitions, hackathons, awards, publications or recognitions.",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, max: 200 },
      {
        key: "kind",
        label: "Type",
        type: "select",
        options: ACHIEVEMENT_KINDS.map((k) => ({ value: k, label: ACHIEVEMENT_KIND_LABELS[k] })),
      },
      { key: "issuer", label: "Issuer / organizer", type: "text", max: 200 },
      { key: "date", label: "Date", type: "date" },
      { key: "url", label: "Link", type: "url", wide: true },
      { key: "description", label: "Description", type: "textarea", max: 2000, wide: true },
    ],
    heading: (i) => str(i.title),
    sub: (i) =>
      [ACHIEVEMENT_KIND_LABELS[i.kind as keyof typeof ACHIEVEMENT_KIND_LABELS], str(i.issuer)]
        .filter(Boolean)
        .join(" · ") || null,
    meta: (i) => (i.date ? formatMonth(i.date as Date) : null),
  },
  experience: {
    title: "Experience",
    singular: "experience",
    icon: BriefcaseBusiness,
    empty: "Add jobs, internships, freelance or volunteer work.",
    fields: [
      { key: "title", label: "Job title", type: "text", required: true, max: 200 },
      { key: "company", label: "Company / organization", type: "text", required: true, max: 200 },
      {
        key: "employmentType",
        label: "Employment type",
        type: "select",
        options: [
          { value: "", label: "Not specified" },
          ...EMPLOYMENT_TYPES.map((k) => ({ value: k, label: EMPLOYMENT_TYPE_LABELS[k] })),
        ],
      },
      { key: "location", label: "Location", type: "text", max: 100 },
      { key: "startDate", label: "Start date", type: "date" },
      { key: "endDate", label: "End date", type: "date", hint: "Leave empty if current." },
      { key: "description", label: "Description", type: "textarea", max: 2000, wide: true },
    ],
    heading: (i) => str(i.title),
    sub: (i) =>
      [
        str(i.company),
        EMPLOYMENT_TYPE_LABELS[i.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS],
      ]
        .filter(Boolean)
        .join(" · ") || null,
    meta: (i) => formatRange(i.startDate as Date | null, i.endDate as Date | null),
  },
};

function toForm(fields: FieldSpec[], item: Item | null): Record<string, string> {
  const values: Record<string, string> = { visibility: item?.visibility ?? "PRIVATE" };
  for (const f of fields) {
    const raw = item?.[f.key];
    if (f.type === "date") values[f.key] = toDateInput(raw as Date | null);
    else if (f.type === "list") values[f.key] = Array.isArray(raw) ? raw.join(", ") : "";
    else if (f.type === "select")
      values[f.key] = typeof raw === "string" ? raw : (f.options?.[0]?.value ?? "");
    else values[f.key] = str(raw);
  }
  return values;
}

function fromForm(fields: FieldSpec[], values: Record<string, string>) {
  const data: Record<string, unknown> = { visibility: values.visibility };
  for (const f of fields) {
    const v = values[f.key] ?? "";
    data[f.key] =
      f.type === "list"
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : v;
  }
  return data;
}

function SectionForm({
  kind,
  item,
  onDone,
}: {
  kind: SectionKind;
  item: Item | null;
  onDone: () => void;
}) {
  const cfg = CONFIG[kind];
  const router = useRouter();
  const [values, setValues] = useState(() => toForm(cfg.fields, item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prefix = `${kind}-${item?.id ?? "new"}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await saveSectionAction({
          kind,
          id: item?.id ?? null,
          data: fromForm(cfg.fields, values),
        });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.error ?? null);
          return;
        }
        toast.success(
          item
            ? `${cfg.singular[0]!.toUpperCase()}${cfg.singular.slice(1)} updated`
            : `${cfg.singular[0]!.toUpperCase()}${cfg.singular.slice(1)} added`,
        );
        onDone();
        router.refresh();
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {cfg.fields.map((f) => {
          const id = `${prefix}-${f.key}`;
          const common = {
            id,
            label: f.label,
            error: errors[f.key],
            hint: f.hint,
            className: f.wide ? "sm:col-span-2" : undefined,
          };
          const onChange = (v: string) => setValues((s) => ({ ...s, [f.key]: v }));
          if (f.type === "textarea")
            return (
              <TextAreaField
                key={f.key}
                {...common}
                value={values[f.key] ?? ""}
                onChange={onChange}
                maxLength={f.max}
                rows={3}
              />
            );
          if (f.type === "select")
            return (
              <SelectField
                key={f.key}
                {...common}
                value={values[f.key] ?? ""}
                onChange={onChange}
                options={f.options ?? []}
              />
            );
          return (
            <TextField
              key={f.key}
              {...common}
              type={f.type === "list" ? "text" : f.type}
              required={f.required}
              maxLength={f.max}
              value={values[f.key] ?? ""}
              onChange={onChange}
              placeholder={f.type === "url" ? "https://…" : undefined}
            />
          );
        })}
        <VisibilityField
          id={`${prefix}-visibility`}
          value={values.visibility as Visibility}
          onChange={(v) => setValues((s) => ({ ...s, visibility: v }))}
          className="sm:col-span-2"
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          className="h-10 md:h-9"
          disabled={pending}
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button type="submit" className="h-10 md:h-9" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {item ? "Save changes" : `Add ${cfg.singular}`}
        </Button>
      </div>
    </form>
  );
}

export function SectionManager({ kind, items }: { kind: SectionKind; items: Item[] }) {
  const cfg = CONFIG[kind];
  const Icon = cfg.icon;
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const headingId = `${kind}-heading`;

  return (
    <section
      id={
        kind === "certification" ? "certifications" : kind === "achievement" ? "achievements" : kind
      }
      aria-labelledby={headingId}
      className="scroll-mt-24 rounded-xl border bg-card p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-brand" aria-hidden />
          <h2 id={headingId} className="font-medium">
            {cfg.title}
          </h2>
          <span className="text-sm text-muted-foreground">({items.length})</span>
        </div>
        <Button variant="outline" className="h-10 md:h-9" onClick={() => setEditing("new")}>
          <Plus />
          Add {cfg.singular}
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {cfg.empty}
        </p>
      ) : (
        <ul className="grid gap-3" aria-label={cfg.title}>
          {items.map((item) => {
            const heading = cfg.heading(item);
            const sub = cfg.sub(item);
            const meta = cfg.meta(item);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
                data-testid={`${kind}-item`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium break-words">{heading}</h3>
                    <VisibilityBadge visibility={item.visibility} />
                  </div>
                  {sub && <p className="text-sm break-words text-muted-foreground">{sub}</p>}
                  {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
                  {kind === "certification" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      User-provided · not verified by SkillForge
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 sm:h-8"
                    aria-label={`Edit ${heading}`}
                    onClick={() => setEditing(item)}
                  >
                    <Pencil />
                    Edit
                  </Button>
                  <VisibilityToggle
                    kind={kind}
                    id={item.id}
                    visibility={item.visibility}
                    label={heading}
                  />
                  <DeleteItemButton kind={kind} id={item.id} label={heading} what={cfg.singular} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? `Add ${cfg.singular}` : `Edit ${cfg.singular}`}
            </DialogTitle>
            <DialogDescription>
              Only add real details. Fields marked * are required.
            </DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <SectionForm
              key={editing === "new" ? "new" : editing.id}
              kind={kind}
              item={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
