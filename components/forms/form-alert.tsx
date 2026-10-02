import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormAlert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success";
  children: React.ReactNode;
}) {
  if (variant === "success") {
    return (
      <Alert className="border-success/30 bg-success/5">
        <CircleCheck className="text-success" />
        <AlertDescription className="text-foreground/90">{children}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive" role="alert" className="border-destructive/30 bg-destructive/5">
      <CircleAlert />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
