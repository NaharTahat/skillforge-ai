import type { Metadata } from "next";
import { ProfileCompletionCard } from "@/components/profile/profile-completion-card";
import { ProfileForm } from "@/components/profile/profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { getMyProfile } from "@/lib/data/profile";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { values, hasPassword, completion } = await getMyProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your details help tailor roadmaps, job matches and interview practice."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="lg:sticky lg:top-24 lg:order-2">
          <ProfileCompletionCard completion={completion} />
        </div>
        <div className="min-w-0 lg:order-1">
          <ProfileForm defaultValues={values} hasPassword={hasPassword} />
        </div>
      </div>
    </div>
  );
}
