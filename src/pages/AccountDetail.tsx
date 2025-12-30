import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAccountStore } from "@/stores/useAccountStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import * as api from "@/lib/tauri";
import { formatMoney, formatDate } from "@/lib/formatters";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accounts, fetchAccounts } = useAccountStore();
  const { categories, fetchCategories } = useCategoryStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const account = accounts.find((a) => a.id === id);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  useEffect(() => {
    if (id) {
      loadTransactions();
    }
  }, [id]);

  const loadTransactions = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.listTransactions({ accountId: id });
      setTransactions(data);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (transactions.length === 0) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        transactionCount: 0,
        avgTransaction: 0,
      };
    }

    let totalIncome = 0;
    let totalExpenses = 0;

    transactions.forEach((t) => {
      if (t.amount > 0) {
        totalIncome += t.amount;
      } else {
        totalExpenses += Math.abs(t.amount);
      }
    });

    return {
      totalIncome,
      totalExpenses,
      transactionCount: transactions.length,
      avgTransaction: transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length,
    };
  }, [transactions]);

  // Generate balance history for chart
  const balanceHistory = useMemo(() => {
    if (transactions.length === 0 || !account) return [];

    // Sort transactions by date (oldest first)
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate running balance going backwards from current balance
    let runningBalance = account.currentBalance;
    const history: Array<{ date: string; balance: number }> = [];

    // Work backwards to calculate historical balances
    const reverseSorted = [...sorted].reverse();
    const balances: number[] = [runningBalance];

    reverseSorted.forEach((t) => {
      runningBalance -= t.amount;
      balances.unshift(runningBalance);
    });

    // Create chart data with the calculated balances
    sorted.forEach((t, i) => {
      history.push({
        date: t.date,
        balance: balances[i + 1],
      });
    });

    // Add current balance at the end
    if (history.length > 0) {
      history.push({
        date: new Date().toISOString().split("T")[0],
        balance: account.currentBalance,
      });
    }

    // Limit to last 90 days of data points for readability
    return history.slice(-90);
  }, [transactions, account]);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Uncategorized";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown";
  };

  if (!account) {
    return (
      <>
        <Header title="Account Not Found" />
        <PageContainer>
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">Account not found</p>
            <Button onClick={() => navigate("/accounts")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Accounts
            </Button>
          </div>
        </PageContainer>
      </>
    );
  }

  const typeInfo = ACCOUNT_TYPES[account.accountType];

  return (
    <>
      <Header
        title={account.name}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadTransactions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/accounts")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        }
      />
      <PageContainer>
        {/* Account Summary */}
        <div className="flex items-center gap-4 mb-6">
          <Badge variant="secondary">{typeInfo?.label || account.accountType}</Badge>
          <span className="text-3xl font-bold">
            {formatMoney(account.currentBalance)}
          </span>
          {account.notes && (
            <span className="text-muted-foreground">{account.notes}</span>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-green-600" />
                Total Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatMoney(stats.totalIncome)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-red-600" />
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {formatMoney(stats.totalExpenses)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.transactionCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Avg. Transaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatMoney(stats.avgTransaction)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Balance Chart */}
        {balanceHistory.length > 1 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {account.currentBalance >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
                Balance History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={balanceHistory}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatMoney(value)}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatMoney(value), "Balance"]}
                    labelFormatter={(label) => formatDate(label)}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorBalance)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">
                Loading transactions...
              </p>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No transactions yet</p>
                <p className="text-sm text-muted-foreground">
                  Import transactions or add them manually
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 50).map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {formatDate(transaction.date)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{transaction.payee || "—"}</p>
                          {transaction.memo && (
                            <p className="text-xs text-muted-foreground">
                              {transaction.memo}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCategoryName(transaction.categoryId)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium",
                          transaction.amount >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {formatMoney(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {transactions.length > 50 && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/transactions?account=${id}`)}
                >
                  View all {transactions.length} transactions
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
