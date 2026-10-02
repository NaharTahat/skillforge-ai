import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";

/** Live checklist of the same rules the server enforces. */
export function PasswordRequirements({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              met ? "text-success" : "text-muted-foreground",
            )}
          >
            {met ? (
              <Check className="size-3" aria-hidden />
            ) : (
              <Circle className="size-2.5" aria-hidden />
            )}
            <span>
              {rule.label}
              <span className="sr-only">{met ? " (met)" : " (not met)"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
