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

  return (
    <PageShell>
      <h1 className="text-xl font-bold text-primary">{t("terms.title")}</h1>

      <p className="mt-4 text-sm leading-7 text-foreground">{t("terms.intro")}</p>

      <h2 className="mt-6 text-base font-semibold text-foreground">
        {t("terms.noticeHeading")}
      </h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {t("terms.noticeIntro")}
      </p>

      <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm leading-7 text-foreground">
        {Array.isArray(sections) &&
          sections.map((section, idx) => (
            <li key={idx}>
              <p className="font-semibold">{section.title}</p>
              <p className="mt-1 text-muted-foreground">{section.body}</p>
            </li>
          ))}
      </ol>
    </PageShell>
  );
}
