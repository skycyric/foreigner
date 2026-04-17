import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
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
  return (
    <PageShell>
      <div className="space-y-8">
        <div
          className="rounded-2xl p-8 text-center text-primary-foreground shadow-[var(--shadow-festive)]"
          style={{ background: "var(--gradient-festive)" }}
        >
          <div className="mb-4 text-5xl">🎉</div>
          <h1 className="text-2xl font-bold leading-tight">{t("home.title")}</h1>
          <p className="mt-3 text-sm opacity-90">{t("home.subtitle")}</p>
        </div>

        <Button asChild size="lg" className="h-14 w-full text-base font-semibold">
          <Link to="/$lang/welcome" params={{ lang }}>
            {t("home.cta")} →
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
