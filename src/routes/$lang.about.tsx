import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/Header";

export const Route = createFileRoute("/$lang/about")({
  head: ({ params }) => ({ meta: [{ title: `Rules — (${params.lang})` }] }),
  component: AboutPage,
});

function AboutPage() {
  const { t } = useTranslation();
  return (
    <PageShell>
      <h1 className="text-xl font-bold text-primary">{t("about.title")}</h1>
      <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7 text-foreground">
        {t("about.body")}
      </pre>
    </PageShell>
  );
}
