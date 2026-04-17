import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { isSupportedLang } from "@/lib/i18n";

export const Route = createFileRoute("/$lang")({
  beforeLoad: ({ params }) => {
    if (!isSupportedLang(params.lang)) throw notFound();
  },
  component: () => <Outlet />,
});
