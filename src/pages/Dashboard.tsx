import { useEffect } from "react";
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
import { useAccountStore } from "@/stores/useAccountStore";
import { useTransactionStore } from "@/stores/useTransactionStore";
import { formatMoney, formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function Dashboard() {
  const { accounts, fetchAccounts, getTotalAssets, getTotalLiabilities, getNetWorth } =
    useAccountStore();
  const { transactions, fetchTransactions } = useTransactionStore();

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, [fetchAccounts, fetchTransactions]);

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
