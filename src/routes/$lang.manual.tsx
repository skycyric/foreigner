import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, isValidTnFormat, TN_FORMAT } from "@/lib/api";
import { getStoredEmail } from "@/lib/device";
import { toast } from "sonner";

export const Route = createFileRoute("/$lang/manual")({
  head: ({ params }) => ({ meta: [{ title: `Enter T/N — (${params.lang})` }] }),
  component: ManualPage,
});

function ManualPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/manual" });
  const navigate = useNavigate();
  const [letters, setLetters] = useState("");
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const digitsRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const lettersUp = letters.toUpperCase();
    const tn = `${lettersUp}${digits}`;
    if (!isValidTnFormat(tn)) {
      toast.error(t("manual.invalidFormat"));
      return;
    }
    const email = getStoredEmail();
    if (!email) {
      navigate({ to: "/$lang/welcome", params: { lang } });
      return;
    }
    setLoading(true);
    try {
      const result = await api.submitLotteryEntry({ tn, email, source: "manual" });
      if (result.alreadyUsed) {
        toast.error(t("manual.alreadyUsed"));
        return;
      }
      navigate({ to: "/$lang/result", params: { lang }, search: { tn }, replace: true });
    } catch (e) {
      console.error(e);
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <h1 className="text-xl font-bold">{t("manual.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("manual.hint")}</p>

      <div className="mt-6 space-y-4">
        <div className="flex items-end gap-2">
          <div className="w-24">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("manual.letters")}
            </label>
            <Input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={TN_FORMAT.letters}
              value={letters}
              onChange={(e) => {
                const v = e.target.value
                  .replace(/[^a-zA-Z]/g, "")
                  .toUpperCase()
                  .slice(0, TN_FORMAT.letters);
                setLetters(v);
                if (v.length === TN_FORMAT.letters) digitsRef.current?.focus();
              }}
              placeholder={"A".repeat(TN_FORMAT.letters)}
              className="h-14 text-center text-2xl font-bold tracking-widest font-mono uppercase"
            />
          </div>
          <span className="pb-3 text-2xl font-bold text-muted-foreground">-</span>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("manual.digits")}
            </label>
            <Input
              ref={digitsRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={TN_FORMAT.digits}
              value={digits}
              onChange={(e) =>
                setDigits(e.target.value.replace(/\D/g, "").slice(0, TN_FORMAT.digits))
              }
              placeholder={"0".repeat(TN_FORMAT.digits)}
              className="h-14 text-center text-2xl font-bold tracking-wider font-mono"
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted px-3 py-2 text-center font-mono text-sm">
          T/N：<span className="font-bold text-primary">{letters || digits ? `${letters}${digits}` : "—"}</span>
        </div>

        <Button
          size="lg"
          className="h-14 w-full text-base font-semibold"
          onClick={submit}
          disabled={loading}
        >
          {loading ? t("common.loading") : t("manual.submit")}
        </Button>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate({ to: "/$lang/coupons", params: { lang }, replace: true })}
        >
          {t("common.back")}
        </Button>
      </div>
    </PageShell>
  );
}
