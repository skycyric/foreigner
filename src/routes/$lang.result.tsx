import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { getStoredEmail } from "@/lib/device";

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
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!getStoredEmail()) {
      navigate({ to: "/$lang/welcome", params: { lang }, replace: true });
      return;
    }
    setReady(true);
  }, [lang, navigate]);

  if (!ready) return <LoadingOverlay open message={t("common.loading")} />;

  return (
    <PageShell>
      <div className="mt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-foreground">
          <Check className="h-7 w-7 text-foreground" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
          {t("result.successTitle")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("result.successMsg")}
        </p>

        {tn && (
          <div className="mx-auto mt-5 inline-block rounded-md border border-border bg-muted px-4 py-2 font-mono text-sm">
            <span className="text-muted-foreground">{t("result.tnLabel")}：</span>
            <span className="font-semibold text-foreground">{tn.split("__t")[0]}</span>
          </div>
        )}
      </div>

      <div className="mt-10 space-y-2">
        <Button
          size="lg"
          className="h-14 w-full font-medium"
          onClick={() => {
            setRedirecting(true);
            navigate({ to: "/$lang/scan", params: { lang }, replace: true });
          }}
          disabled={redirecting}
        >
          {t("result.again")}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            setRedirecting(true);
            navigate({ to: "/$lang/coupons", params: { lang }, replace: true });
          }}
          disabled={redirecting}
        >
          {t("result.home")}
        </Button>
      </div>
      <LoadingOverlay open={redirecting} message={t("common.redirecting")} />
    </PageShell>
  );
}
