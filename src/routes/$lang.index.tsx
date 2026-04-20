import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { getStoredEmail } from "@/lib/device";

export const Route = createFileRoute("/$lang/")({
  head: ({ params }) => ({
    meta: [
      { title: `Lucky Draw (${params.lang})` },
      { name: "description", content: "Lucky draw event — register and win" },
      { property: "og:locale", content: params.lang },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });
  const navigate = useNavigate();

  useEffect(() => {
    const stored = getStoredEmail();
    if (stored) {
      navigate({ to: "/$lang/coupons", params: { lang }, replace: true });
    }
  }, [lang, navigate]);

  return (
    <PageShell>
      <div className="space-y-10">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-border">
            <Sparkles className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
            {t("home.title")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("home.subtitle")}
          </p>
        </div>

        <Button asChild size="lg" className="h-14 w-full text-base font-medium">
          <Link to="/$lang/welcome" params={{ lang }}>
            {t("home.cta")}
            <ArrowRight className="ml-1 h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>

        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          <Link to="/$lang/about" params={{ lang }} className="underline-offset-2 hover:underline">
            {t("nav.about")}
          </Link>
          <Link to="/$lang/winners" params={{ lang }} className="underline-offset-2 hover:underline">
            {t("nav.winners")}
          </Link>
          <Link to="/$lang/terms" params={{ lang }} className="underline-offset-2 hover:underline">
            {t("nav.terms")}
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
