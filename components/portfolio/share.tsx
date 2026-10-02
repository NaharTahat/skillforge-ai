"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies an absolute public URL built from the current origin and the real username. */
export function CopyLinkButton({
  path,
  label = "Copy public link",
}: {
  path: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      className="h-10 md:h-9"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success("Link copied");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error(`Couldn't copy automatically. The link is ${url}`);
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}
