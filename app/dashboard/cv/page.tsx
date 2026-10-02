import type { Metadata } from "next";
import { FileSearch, ListChecks, Target, TrendingUp } from "lucide-react";
import { AnalysisHistoryList } from "@/components/cv/analysis-history";
import { CvCard } from "@/components/cv/cv-card";
import { CvUploader } from "@/components/cv/cv-uploader";
import { PageHeader } from "@/components/shared/page-header";
import { maxUploadBytes } from "@/lib/cv/service";
import { listMyCvs, listMyRecentAnalyses } from "@/lib/data/cv";

export const metadata: Metadata = { title: "CV Analyzer" };

const benefits = [
  {
    icon: FileSearch,
    title: "Skills with evidence",
    text: "Every detected skill is quoted from your CV.",
  },
  {
    icon: TrendingUp,
    title: "A transparent score",
    text: "Seven weighted dimensions, each explained.",
  },
  {
    icon: Target,
    title: "Honest gaps",
    text: "Missing, weak and not-specified areas, kept distinct.",
  },
  {
    icon: ListChecks,
    title: "Prioritized fixes",
    text: "Concrete recommendations ranked by impact.",
  },
] as const;

export default async function CvAnalyzerPage() {
  const [cvs, history] = await Promise.all([listMyCvs(), listMyRecentAnalyses()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="CV Analyzer"
        description="Upload your CV for a structured, evidence-based breakdown of your strengths and gaps."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <CvUploader maxBytes={maxUploadBytes()} />

        {cvs.length === 0 ? (
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-medium">What you&apos;ll get</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a PDF or DOCX to receive a report based only on what your CV says.
            </p>
            <ul className="mt-5 grid gap-4">
              {benefits.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10">
                    <Icon className="size-4 text-brand" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-sm text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <section aria-labelledby="history-heading" className="min-w-0">
            <h2 id="history-heading" className="mb-3 font-medium">
              Analysis history
            </h2>
            <AnalysisHistoryList
              showFileName
              entries={history.map((a) => ({
                id: a.id,
                cvId: a.cv.id,
                fileName: a.cv.fileName,
                status: a.status,
                score: a.score,
                provider: a.provider,
                createdAt: a.createdAt,
              }))}
            />
          </section>
        )}
      </div>

      {cvs.length > 0 && (
        <section aria-labelledby="cvs-heading">
          <h2 id="cvs-heading" className="mb-3 font-medium">
            Your CVs <span className="text-muted-foreground">({cvs.length})</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cvs.map((cv) => (
              <CvCard key={cv.id} cv={cv} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
