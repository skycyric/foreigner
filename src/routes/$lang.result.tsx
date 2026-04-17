import { createFileRoute, Link, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/$lang/result")({
  validateSearch: (search: Record<string, unknown>) => ({
    tn: typeof search.tn === "string" ? search.tn : "",
  }),
  head: ({ params }) => ({ meta: [{ title: `Registered — (${params.lang})` }] }),
  component: ResultPage,
});

function ResultPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/result" });
  const { tn } = useSearch({ from: "/$lang/result" });

  return (
    <PageShell>
      <div className="mt-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent text-4xl">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-bold text-primary">{t("result.successTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("result.successMsg")}</p>

        {tn && (
          <div className="mx-auto mt-4 inline-block rounded-lg bg-muted px-4 py-2 font-mono text-sm">
            {t("result.tnLabel")}：<span className="font-bold text-primary">{tn}</span>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-2">
        <Button asChild size="lg" className="h-14 w-full font-semibold">
          <Link to="/$lang/coupons" params={{ lang }}>{t("result.again")}</Link>
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link to="/$lang" params={{ lang }}>{t("result.home")}</Link>
        </Button>
      </div>
    </PageShell>
  );
}
