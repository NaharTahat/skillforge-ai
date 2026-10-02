import type { Metadata } from "next";
import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";

export const metadata: Metadata = { title: "Settings" };

// Profile details moved to /dashboard/profile in phase 2.
export default function SettingsPage() {
  return (
    <FeaturePlaceholder
      href="/dashboard/settings"
      phase={9}
      capabilities={[
        "Change password",
        "Connected accounts",
        "Privacy controls",
        "Data export & deletion",
      ]}
    />
  );
}
