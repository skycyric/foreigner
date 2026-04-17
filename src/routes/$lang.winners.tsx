import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/Header";
import { api, type Winner } from "@/lib/api";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const Route = createFileRoute("/$lang/winners")({
  head: ({ params }) => ({ meta: [{ title: `Winners — (${params.lang})` }] }),
  component: WinnersPage,
});

function WinnersPage() {
  const { t } = useTranslation();
  const [winners, setWinners] = useState<Winner[] | null>(null);

  useEffect(() => {
    api.getWinners().then(setWinners).catch(() => setWinners([]));
  }, []);

  return (
    <PageShell>
      <h1 className="text-xl font-bold text-primary">🏆 {t("winners.title")}</h1>

      {winners === null && (
        <div className="mt-4 rounded-lg bg-muted p-4 text-center text-sm">
          {t("common.loading")}
        </div>
      )}
      {winners && winners.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {t("winners.empty")}
        </div>
      )}
      {winners && winners.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">{t("winners.rank")}</TableHead>
                <TableHead>{t("winners.prize")}</TableHead>
                <TableHead>{t("winners.email")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {winners.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-semibold text-primary">
                    {w.rank}
                    {w.is_backup && (
                      <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                        {t("winners.backup")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{w.prize_name}</TableCell>
                  <TableCell className="font-mono text-xs">{w.masked_email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
