import type { Metadata } from "next";
import { ProfileEditor } from "@/components/portfolio/profile-editor";
import { SectionManager } from "@/components/portfolio/section-manager";
import { PageHeader } from "@/components/shared/page-header";
import { getPortfolioEditor } from "@/lib/data/portfolio";

export const metadata: Metadata = { title: "Edit portfolio" };

export default async function PortfolioEditPage() {
  const data = await getPortfolioEditor();
  const p = data.profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile & sections"
        description="Add only real details. Each item stays private until you make it public, and certifications are always shown as user-provided."
      />
      <ProfileEditor
        initial={{
          headline: p?.headline ?? "",
          bio: p?.bio ?? "",
          location: p?.location ?? "",
          websiteUrl: p?.websiteUrl ?? "",
          githubUrl: p?.githubUrl ?? "",
          linkedinUrl: p?.linkedinUrl ?? "",
        }}
      />
      <SectionManager kind="experience" items={data.experiences} />
      <SectionManager kind="education" items={data.educations} />
      <SectionManager kind="certification" items={data.certifications} />
      <SectionManager kind="achievement" items={data.achievements} />
    </div>
  );
}
