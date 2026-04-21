import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Mail, AlertCircle } from "lucide-react";
import { PageShell } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingOverlay, Spinner } from "@/components/LoadingOverlay";
import { api } from "@/lib/api";
import { getDeviceId, getStoredEmail, setStoredEmail } from "@/lib/device";
import { toast } from "sonner";

const DOMAINS = ["gmail.com", "yahoo.com.tw", "hotmail.com", "icloud.com", "outlook.com"];

// 常見 typo → 正確網域
const TYPO_MAP: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.cm": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.com.t": "yahoo.com.tw",
  "hotnail.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "icloud.con": "icloud.com",
  "icloud.co": "icloud.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.con": "outlook.com",
};

const EMAIL_RE = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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

  const [mode, setMode] = useState<"quick" | "full">("quick");
  // quick mode
  const [account, setAccount] = useState("");
  const [domain, setDomain] = useState(DOMAINS[0]);
  // full mode
  const [fullEmail, setFullEmail] = useState("");

  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [pulse, setPulse] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = getStoredEmail();
    if (stored) {
      navigate({ to: "/$lang/coupons", params: { lang }, replace: true });
    }
  }, [lang, navigate]);

  useEffect(() => {
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, []);

  // 計算最終 email
  const email =
    mode === "quick"
      ? `${account.trim().toLowerCase()}@${domain}`
      : fullEmail.trim().toLowerCase();

  const isComplete = EMAIL_RE.test(email);
  const finalDomain = email.includes("@") ? email.split("@")[1] : "";
  const typoSuggestion = finalDomain && TYPO_MAP[finalDomain] ? TYPO_MAP[finalDomain] : null;

  function flashCard(detectedEmail: string) {
    setPulse(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(false), 1500);
    toast.success(`${t("welcome.autofilled")}：${detectedEmail}`);
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  /**
   * Quick mode: account 欄變更
   * - 偵測到完整 email：若網域在預設清單，拆解；否則自動切到 full 模式
   */
  function handleAccountChange(value: string) {
    const trimmed = value.trim();
    const atIdx = trimmed.indexOf("@");
    if (atIdx > 0 && atIdx < trimmed.length - 1) {
      const acc = trimmed.slice(0, atIdx);
      const dom = trimmed.slice(atIdx + 1).toLowerCase();
      const detected = `${acc.toLowerCase()}@${dom}`;
      if (DOMAINS.includes(dom)) {
        setAccount(acc);
        setDomain(dom);
        flashCard(detected);
      } else {
        // 不在預設清單 → 切到 full 模式
        setFullEmail(detected);
        setMode("full");
        flashCard(detected);
      }
      return;
    }
    setAccount(trimmed.replace(/@/g, ""));
  }

  function handleFullEmailChange(value: string) {
    const trimmed = value.trim().toLowerCase();
    setFullEmail(trimmed);
    // 若使用者貼上 / autofill 完整且合法 email，閃爍提示
    if (EMAIL_RE.test(trimmed) && trimmed !== fullEmail) {
      flashCard(trimmed);
    }
  }

  function applyTypoFix() {
    if (!typoSuggestion) return;
    if (mode === "quick") {
      if (DOMAINS.includes(typoSuggestion)) {
        setDomain(typoSuggestion);
      } else {
        // 不在 chip 清單 → 切到 full
        setFullEmail(`${account.trim().toLowerCase()}@${typoSuggestion}`);
        setMode("full");
      }
    } else {
      const acc = fullEmail.split("@")[0] ?? "";
      setFullEmail(`${acc}@${typoSuggestion}`);
    }
  }

  async function submit() {
    if (!isComplete) {
      toast.error(t("welcome.invalidAccount"));
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
      setRedirecting(true);
      navigate({ to: "/$lang/coupons", params: { lang } });
    } catch (e) {
      console.error(e);
      toast.error(String(e));
      setRedirecting(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("welcome.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("welcome.hint")}</p>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "quick" | "full")}
        className="mt-5"
      >
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="quick" className="text-sm">
            {t("welcome.tabQuick")}
          </TabsTrigger>
          <TabsTrigger value="full" className="text-sm">
            {t("welcome.tabFull")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quick" className="mt-4 space-y-4">
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
                onChange={(e) => handleAccountChange(e.target.value)}
                placeholder="yourname"
                className="rounded-r-none text-base h-11"
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
            </div>
            <button
              type="button"
              onClick={() => setMode("full")}
              className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {t("welcome.notCommonDomain")}
            </button>
          </div>
        </TabsContent>

        <TabsContent value="full" className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("welcome.fullEmailLabel")}
            </label>
            <Input
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={fullEmail}
              onChange={(e) => handleFullEmailChange(e.target.value)}
              placeholder="yourname@example.com"
              className="text-base h-11"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* 確認卡 */}
      <div
        ref={cardRef}
        className={`mt-5 rounded-xl border-2 p-4 transition-all duration-300 ${
          isComplete
            ? "border-primary bg-primary/5"
            : "border-dashed border-border bg-muted/30"
        } ${pulse ? "animate-pulse ring-4 ring-primary/30" : ""}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {isComplete ? <CheckCircle2 className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-muted-foreground">
              {t("welcome.notifyAt")}
            </div>
            <div
              className={`mt-1 break-all font-mono text-base font-semibold ${
                isComplete ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {isComplete ? email : t("welcome.placeholder")}
            </div>
          </div>
        </div>

        {typoSuggestion && (
          <button
            type="button"
            onClick={applyTypoFix}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {t("welcome.typoSuggestion", { domain: typoSuggestion })}
            </span>
            <span className="font-semibold underline underline-offset-2">
              {t("welcome.typoFix")}
            </span>
          </button>
        )}
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm">
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
        className="mt-4 h-14 w-full text-base font-semibold"
        onClick={submit}
        disabled={loading || redirecting}
      >
        {loading ? (
          <>
            <Spinner /> {t("common.processing")}
          </>
        ) : (
          t("welcome.submit")
        )}
      </Button>

      <LoadingOverlay
        open={loading || redirecting}
        message={redirecting ? t("common.preparing") : t("common.processing")}
      />
    </PageShell>
  );
}