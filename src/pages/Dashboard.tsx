import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  CreditCard,
  PiggyBank,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { CashFlowChart } from "@/components/charts/CashFlowChart";
import { SpendingChart } from "@/components/charts/SpendingChart";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTransactionStore } from "@/stores/useTransactionStore";
import { formatMoney, formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useCategoryStore } from "@/stores/useCategoryStore";
import type { CashFlowData, SpendingByCategory, NetWorthSnapshot } from "@/types";

export function Dashboard() {
  const { accounts, fetchAccounts, getTotalAssets, getTotalLiabilities, getNetWorth } =
    useAccountStore();
  const { transactions, fetchTransactions } = useTransactionStore();
  const { categories, fetchCategories } = useCategoryStore();
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [spendingData, setSpendingData] = useState<SpendingByCategory[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>([]);

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
    fetchCategories();
  }, [fetchAccounts, fetchTransactions, fetchCategories]);

  // Compute chart data from transactions
  useEffect(() => {
    if (transactions.length === 0) return;

    // Get last 6 months
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7)); // "YYYY-MM"
    }

    // Compute cash flow by month
    const cashFlowMap = new Map<string, { income: number; expenses: number }>();
    months.forEach((m) => cashFlowMap.set(m, { income: 0, expenses: 0 }));

    transactions.forEach((tx) => {
      const month = tx.date.slice(0, 7);
      if (cashFlowMap.has(month)) {
        const entry = cashFlowMap.get(month)!;
        if (tx.amount >= 0) {
          entry.income += tx.amount;
        } else {
          entry.expenses += tx.amount;
        }
      }
    });

    const cashFlow: CashFlowData[] = months.map((period) => {
      const entry = cashFlowMap.get(period)!;
      return {
        period,
        income: entry.income,
        expenses: entry.expenses,
        net: entry.income + entry.expenses,
      };
    });
    setCashFlowData(cashFlow);

    // Compute spending by category (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      .toISOString()
      .split("T")[0] as string;
    const spendingMap = new Map<string, number>();

    transactions
      .filter((tx) => tx.date >= sixMonthsAgo && tx.amount < 0)
      .forEach((tx) => {
        const catId = tx.categoryId || "uncategorized";
        spendingMap.set(catId, (spendingMap.get(catId) || 0) + Math.abs(tx.amount));
      });

    const totalSpending = Array.from(spendingMap.values()).reduce((a, b) => a + b, 0);
    const spending: SpendingByCategory[] = Array.from(spendingMap.entries())
      .map(([categoryId, amount]) => {
        const cat = categories.find((c) => c.id === categoryId);
        return {
          categoryId,
          categoryName: cat?.name || "Uncategorized",
          amount,
          percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
          color: cat?.color || null,
        };
      })
      .sort((a, b) => b.amount - a.amount);
    setSpendingData(spending);

    // Compute net worth history by month
    // Start with current balances and work backwards
    const currentNetWorth = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
    const currentAssets = accounts
      .filter((a) => ["checking", "savings", "investment", "cash"].includes(a.accountType))
      .reduce((sum, a) => sum + a.currentBalance, 0);
    const currentLiabilities = accounts
      .filter((a) => ["credit_card", "loan"].includes(a.accountType))
      .reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);

    // Group transactions by month to calculate deltas
    const monthlyDeltas = new Map<string, number>();
    transactions.forEach((tx) => {
      const month = tx.date.slice(0, 7);
      monthlyDeltas.set(month, (monthlyDeltas.get(month) || 0) + tx.amount);
    });

    // Build history working backwards from current
    const netWorthHistoryData: NetWorthSnapshot[] = [];
    let runningNetWorth = currentNetWorth;

    // Start from current month and go back
    for (let i = 0; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toISOString().slice(0, 7);
      const snapshotDate = `${month}-01`;

      netWorthHistoryData.unshift({
        id: month,
        snapshotDate,
        totalAssets: currentAssets, // Simplified - would need per-account tracking for accuracy
        totalLiabilities: currentLiabilities,
        netWorth: runningNetWorth,
        createdAt: snapshotDate,
      });

      // Subtract this month's transactions to get previous month's balance
      const delta = monthlyDeltas.get(month) || 0;
      runningNetWorth -= delta;
    }

    setNetWorthHistory(netWorthHistoryData);
  }, [transactions, accounts, categories]);

  const totalAssets = getTotalAssets();
  const totalLiabilities = getTotalLiabilities();
  const netWorth = getNetWorth();

  const recentTransactions = transactions.slice(0, 10);

  return (
    <>
      <Header title="Dashboard" />
      <PageContainer>
        <div className="space-y-6">
          {/* Net Worth Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Assets
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatMoney(totalAssets)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Checking, savings, investments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Liabilities
                </CardTitle>
                <CreditCard className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatMoney(totalLiabilities)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Credit cards, loans
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Worth
                </CardTitle>
                <PiggyBank className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    netWorth >= 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {formatMoney(netWorth)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Assets minus liabilities
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Net Worth Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Net Worth Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <NetWorthChart data={netWorthHistory} />
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cash Flow</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <CashFlowChart data={cashFlowData} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <SpendingChart data={spendingData} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Accounts */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Accounts</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/accounts">View All</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {accounts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No accounts yet</p>
                          <Button variant="link" asChild className="mt-2">
                            <Link to="/accounts">Add your first account</Link>
                          </Button>
                        </div>
                      ) : (
                        accounts
                          .filter((a) => a.isActive && !a.isHidden)
                          .slice(0, 8)
                          .map((account) => (
                            <Link
                              key={account.id}
                              to={`/accounts/${account.id}`}
                              className="flex items-center justify-between rounded-lg p-2 hover:bg-accent transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                                  <Wallet className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">
                                    {account.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {account.accountType.replace("_", " ")}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "font-medium text-sm",
                                  account.currentBalance < 0
                                    ? "text-red-600"
                                    : "text-foreground"
                                )}
                              >
                                {formatMoney(account.currentBalance)}
                              </span>
                            </Link>
                          ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Recent Transactions */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recent Transactions</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/transactions">View All</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {recentTransactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <ArrowUpRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No transactions yet</p>
                          <p className="text-sm mt-1">
                            Import transactions or add them manually
                          </p>
                        </div>
                      ) : (
                        recentTransactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full",
                                  tx.amount >= 0
                                    ? "bg-green-100 text-green-600"
                                    : "bg-red-100 text-red-600"
                                )}
                              >
                                {tx.amount >= 0 ? (
                                  <ArrowDownRight className="h-4 w-4" />
                                ) : (
                                  <ArrowUpRight className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {tx.payee || "Unknown"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatRelativeDate(tx.date)}
                                </p>
                              </div>
                            </div>
                            <span
                              className={cn(
                                "font-medium",
                                tx.amount >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              )}
                            >
                              {formatMoney(tx.amount)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
