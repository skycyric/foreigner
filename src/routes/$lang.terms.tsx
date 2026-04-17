import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/Header";

export const Route = createFileRoute("/$lang/terms")({
  head: ({ params }) => ({ meta: [{ title: `Privacy — (${params.lang})` }] }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useTranslation();
  return (
    <PageShell>
      <h1 className="text-xl font-bold text-primary">{t("terms.title")}</h1>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">{t("terms.body")}</p>
    </PageShell>
  );
}
