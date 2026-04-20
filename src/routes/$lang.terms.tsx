import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/Header";

export const Route = createFileRoute("/$lang/terms")({
  head: ({ params }) => ({ meta: [{ title: `Privacy — (${params.lang})` }] }),
  component: TermsPage,
});

interface TermsSection {
  title: string;
  body: string;
}

function TermsPage() {
  const { t } = useTranslation();
  const sections = (t("terms.sections", { returnObjects: true }) ?? []) as TermsSection[];
  const intro = (t("terms.intro") ?? "") as string;
  const updated = (t("terms.updated", { defaultValue: "" }) ?? "") as string;

  return (
    <PageShell>
      <h1 className="text-xl font-bold text-primary">{t("terms.title")}</h1>

      {updated && (
        <p className="mt-2 text-xs text-muted-foreground">{updated}</p>
      )}

      {intro
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line, idx) => (
          <p key={idx} className="mt-3 text-sm leading-7 text-foreground">
            {line}
          </p>
        ))}

      <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm leading-7 text-foreground">
        {Array.isArray(sections) &&
          sections.map((section, idx) => (
            <li key={idx}>
              <p className="font-semibold">{section.title}</p>
              {section.body
                .split("\n")
                .filter((line) => line.trim().length > 0)
                .map((line, lineIdx) => (
                  <p key={lineIdx} className="mt-1 text-muted-foreground">
                    {line}
                  </p>
                ))}
            </li>
          ))}
      </ol>
    </PageShell>
  );
}
