import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

// Lazy load pages for better code splitting and faster initial navigation
const Dashboard = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Accounts = lazy(() => import("@/pages/Accounts").then(m => ({ default: m.Accounts })));
const AccountDetail = lazy(() => import("@/pages/AccountDetail").then(m => ({ default: m.AccountDetail })));
const Transactions = lazy(() => import("@/pages/Transactions").then(m => ({ default: m.Transactions })));
const Import = lazy(() => import("@/pages/Import").then(m => ({ default: m.Import })));
const Reports = lazy(() => import("@/pages/Reports").then(m => ({ default: m.Reports })));
const Budgets = lazy(() => import("@/pages/Budgets").then(m => ({ default: m.Budgets })));
const Goals = lazy(() => import("@/pages/Goals").then(m => ({ default: m.Goals })));
const Categories = lazy(() => import("@/pages/Categories").then(m => ({ default: m.Categories })));
const Recurring = lazy(() => import("@/pages/Recurring").then(m => ({ default: m.Recurring })));
const Investments = lazy(() => import("@/pages/Investments").then(m => ({ default: m.Investments })));
const Rules = lazy(() => import("@/pages/Rules").then(m => ({ default: m.Rules })));
const Settings = lazy(() => import("@/pages/Settings").then(m => ({ default: m.Settings })));

// Wrap component in Suspense with loading skeleton
function withSuspense(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: withSuspense(Dashboard),
      },
      {
        path: "accounts",
        element: withSuspense(Accounts),
      },
      {
        path: "accounts/:id",
        element: withSuspense(AccountDetail),
      },
      {
        path: "transactions",
        element: withSuspense(Transactions),
      },
      {
        path: "import",
        element: withSuspense(Import),
      },
      {
        path: "budgets",
        element: withSuspense(Budgets),
      },
      {
        path: "goals",
        element: withSuspense(Goals),
      },
      {
        path: "reports",
        element: withSuspense(Reports),
      },
      {
        path: "categories",
        element: withSuspense(Categories),
      },
      {
        path: "recurring",
        element: withSuspense(Recurring),
      },
      {
        path: "investments",
        element: withSuspense(Investments),
      },
      {
        path: "rules",
        element: withSuspense(Rules),
      },
      {
        path: "settings",
        element: withSuspense(Settings),
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
