import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { Accounts } from "@/pages/Accounts";
import { Transactions } from "@/pages/Transactions";
import { Import } from "@/pages/Import";
import { Reports } from "@/pages/Reports";
import { Categories } from "@/pages/Categories";
import { Rules } from "@/pages/Rules";
import { Settings } from "@/pages/Settings";
import { Placeholder } from "@/pages/Placeholder";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "accounts",
        element: <Accounts />,
      },
      {
        path: "accounts/:id",
        element: <Placeholder title="Account Details" />,
      },
      {
        path: "transactions",
        element: <Transactions />,
      },
      {
        path: "import",
        element: <Import />,
      },
      {
        path: "budgets",
        element: <Placeholder title="Budgets" />,
      },
      {
        path: "goals",
        element: <Placeholder title="Goals" />,
      },
      {
        path: "reports",
        element: <Reports />,
      },
      {
        path: "categories",
        element: <Categories />,
      },
      {
        path: "recurring",
        element: <Placeholder title="Recurring Transactions" />,
      },
      {
        path: "investments",
        element: <Placeholder title="Investments" />,
      },
      {
        path: "rules",
        element: <Rules />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
