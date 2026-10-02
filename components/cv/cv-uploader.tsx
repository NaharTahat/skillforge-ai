"use client";

import { useRouter } from "next/navigation";
import { FileText, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { AnalysisStages } from "@/components/cv/analysis-stages";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CV_ACCEPT, CV_KINDS, formatBytes } from "@/lib/cv/constants";
import { extensionOf } from "@/lib/cv/file-validation";
import { cn } from "@/lib/utils";

type Phase =
  | { name: "idle" }
  | { name: "selected"; file: File }
  | { name: "uploading"; file: File; percent: number }
  | { name: "processing"; file: File }
  | { name: "redirecting"; file: File };

type ApiError = { error?: { message?: string } };

const SUPPORTED_EXTENSIONS: string[] = Object.values(CV_KINDS).map((k) => k.extension);

/** Quick client-side checks for instant feedback; the server re-validates everything. */
function precheck(file: File, maxBytes: number): string | null {
  if (!SUPPORTED_EXTENSIONS.includes(extensionOf(file.name))) {
    return "Unsupported file type. Upload a PDF or DOCX file.";
  }
  if (file.size === 0) return "This file is empty. Choose a CV that contains text.";
  if (file.size > maxBytes)
    return `This file is too large. The maximum size is ${formatBytes(maxBytes)}.`;
  return null;
}

export function CvUploader({ maxBytes }: { maxBytes: number }) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const busy =
    phase.name === "uploading" || phase.name === "processing" || phase.name === "redirecting";

  function choose(file: File | undefined) {
    if (!file || busy) return;
    const problem = precheck(file, maxBytes);
    setError(problem);
    setPhase(problem ? { name: "idle" } : { name: "selected", file });
  }

  function reset() {
    setPhase({ name: "idle" });
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  function upload() {
    if (phase.name !== "selected") return;
    const file = phase.file;
    setError(null);
    setPhase({ name: "uploading", file, percent: 0 });

    // XHR (not fetch) because it reports real upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/cv");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setPhase({ name: "uploading", file, percent: Math.round((e.loaded / e.total) * 100) });
      }
    };
    // Bytes are sent; the server is now validating and extracting text.
    xhr.upload.onload = () => setPhase({ name: "processing", file });
    xhr.onload = () => {
      const body = xhr.response as ({ cvId: string; analysisId: string } & ApiError) | null;
      if (xhr.status === 201 && body?.cvId) {
        setPhase({ name: "redirecting", file });
        router.push(`/dashboard/cv/${body.cvId}?analysis=${body.analysisId}`);
        return;
      }
      if (xhr.status === 401) {
        router.push("/login?callbackUrl=/dashboard/cv");
        return;
      }
      setError(body?.error?.message ?? "Upload failed. Please try again.");
      // The file itself was rejected: retrying it can't succeed, so offer a new pick.
      // Server/network failures keep the file selected for a retry.
      if (xhr.status >= 400 && xhr.status < 500) {
        setPhase({ name: "idle" });
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setPhase({ name: "selected", file });
      }
    };
    xhr.onerror = () => {
      setError("Upload failed. Check your connection and try again.");
      setPhase({ name: "selected", file });
    };

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  }

  const file = phase.name === "idle" ? null : phase.file;

  return (
    <Card>
      <CardContent className="grid gap-5">
        {error && <FormAlert>{error}</FormAlert>}

        {!file ? (
          <label
            htmlFor={inputId}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors outline-none has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50 sm:py-14",
              dragging ? "border-brand bg-brand/5" : "hover:border-foreground/25 hover:bg-muted/30",
            )}
          >
            <span className="grid size-12 place-items-center rounded-xl bg-brand/10">
              <FileUp className="size-5 text-brand" />
            </span>
            <span className="mt-4 text-sm font-medium">
              <span className="hidden sm:inline">Drag and drop your CV here, or </span>
              <span className="text-brand sm:underline sm:underline-offset-4">choose a file</span>
            </span>
            <span className="mt-1.5 text-xs text-muted-foreground">
              PDF or DOCX · up to {formatBytes(maxBytes)}
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              name="file"
              accept={CV_ACCEPT}
              className="sr-only"
              aria-label="Choose a CV file (PDF or DOCX)"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
        ) : (
          <div className="grid gap-5">
            <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-background">
                <FileText className="size-5 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {extensionOf(file.name).slice(1).toUpperCase()} · {formatBytes(file.size)}
                </p>
              </div>
              {phase.name === "selected" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 sm:size-8"
                  onClick={reset}
                  aria-label="Remove file"
                >
                  <X />
                </Button>
              )}
            </div>

            {busy && (
              <AnalysisStages
                current={phase.name === "uploading" ? "upload" : "extract"}
                currentNote={phase.name === "uploading" ? `${phase.percent}%` : undefined}
              />
            )}

            {phase.name === "selected" && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" className="h-10 md:h-9" onClick={reset}>
                  Choose another file
                </Button>
                <Button className="h-10 md:h-9" onClick={upload}>
                  <Sparkles /> Upload &amp; analyze
                </Button>
              </div>
            )}
            {phase.name === "redirecting" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Opening your analysis…
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Your CV is stored privately and is only visible to you. It is never shown on your public
          Skill Passport.
        </p>
      </CardContent>
    </Card>
  );
}
