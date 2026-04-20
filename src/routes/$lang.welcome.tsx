import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { getDeviceId, getStoredEmail, setStoredEmail } from "@/lib/device";
import { toast } from "sonner";

const DOMAINS = ["gmail.com", "yahoo.com.tw", "hotmail.com", "icloud.com", "outlook.com"];

export const Route = createFileRoute("/$lang/welcome")({
  head: ({ params }) => ({
    meta: [{ title: `Register — Lucky Draw (${params.lang})` }],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/welcome" });
  const navigate = useNavigate();
  const [account, setAccount] = useState("");
  const [domain, setDomain] = useState(DOMAINS[0]);
  const [customDomain, setCustomDomain] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = getStoredEmail();
    if (stored) {
      navigate({ to: "/$lang/coupons", params: { lang }, replace: true });
    }
  }, [lang, navigate]);

  const isCustom = domain === "__custom__";
  const finalDomain = isCustom ? customDomain.trim().toLowerCase() : domain;
  const email = `${account.trim().toLowerCase()}@${finalDomain}`;

  /**
   * 處理 account 欄位變更：
   * - 若使用者貼上 / autofill 完整 email（含 @），自動拆成 account + domain
   * - domain 若在預設清單 → 選對應 chip；否則切 custom 並填入
   * - 一般輸入時只過濾掉 @
   */
  function handleAccountChange(value: string) {
    const trimmed = value.trim();
    const atIdx = trimmed.indexOf("@");
    if (atIdx > 0 && atIdx < trimmed.length - 1) {
      const acc = trimmed.slice(0, atIdx);
      const dom = trimmed.slice(atIdx + 1).toLowerCase();
      setAccount(acc);
      if (DOMAINS.includes(dom)) {
        setDomain(dom);
        setCustomDomain("");
      } else {
        setDomain("__custom__");
        setCustomDomain(dom);
      }
      return;
    }
    setAccount(trimmed.replace(/@/g, ""));
  }

  async function submit() {
    if (!account.trim() || !/^[a-zA-Z0-9._+-]+$/.test(account.trim())) {
      toast.error(t("welcome.invalidAccount"));
      return;
    }
    if (!finalDomain || !/\./.test(finalDomain)) {
      toast.error(t("welcome.invalidDomain"));
      return;
    }
    if (!agree) {
      toast.error(t("welcome.mustAgree"));
      return;
    }
    setLoading(true);
    try {
      await api.getOrCreateParticipant({
        email,
        device_id: getDeviceId(),
        language: lang,
      });
      setStoredEmail(email);
      navigate({ to: "/$lang/coupons", params: { lang } });
    } catch (e) {
      console.error(e);
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("welcome.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("welcome.hint")}</p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("welcome.account")}
          </label>
          <div className="flex items-stretch gap-0">
            <Input
              type="text"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={account}
              onChange={(e) => setAccount(e.target.value.replace(/@/g, ""))}
              placeholder="yourname"
              className="rounded-r-none text-base"
            />
            <span className="flex items-center justify-center border border-l-0 border-input bg-muted px-3 text-base font-semibold text-foreground">
              @
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("welcome.domain")}
          </label>
          <div className="flex flex-wrap gap-2">
            {DOMAINS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDomain(d)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  domain === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                @{d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDomain("__custom__")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isCustom
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              + {t("welcome.customDomain")}
            </button>
          </div>
          {isCustom && (
            <Input
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value.replace(/@/g, ""))}
              placeholder="example.com"
              className="mt-2 text-base"
            />
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">Email：</span>
          <span className="font-mono font-semibold text-foreground break-all">{email}</span>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={agree}
            onCheckedChange={(v) => setAgree(v === true)}
            className="mt-0.5"
          />
          <span className="text-foreground">
            {t("welcome.agree")}{" "}
            <Link to="/$lang/terms" params={{ lang }} className="text-foreground underline underline-offset-2">
              {t("welcome.terms")}
            </Link>
          </span>
        </label>

        <Button
          size="lg"
          className="h-14 w-full text-base font-semibold"
          onClick={submit}
          disabled={loading}
        >
          {loading ? t("common.loading") : t("welcome.submit")}
        </Button>
      </div>
    </PageShell>
  );
}
