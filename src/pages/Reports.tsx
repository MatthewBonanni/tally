import { useEffect, useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { useTransactionStore } from "@/stores/useTransactionStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#8DD1E1",
  "#A4DE6C",
  "#D0ED57",
];

type Period = "thisMonth" | "lastMonth" | "last3Months" | "last6Months" | "thisYear" | "lastYear";

function formatDateStr(date: Date): string {
  return date.toISOString().split("T")[0] as string;
}

function getPeriodDates(period: Period): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case "thisMonth":
      return {
        start: formatDateStr(new Date(year, month, 1)),
        end: formatDateStr(new Date(year, month + 1, 0)),
      };
    case "lastMonth":
      return {
        start: formatDateStr(new Date(year, month - 1, 1)),
        end: formatDateStr(new Date(year, month, 0)),
      };
    case "last3Months":
      return {
        start: formatDateStr(new Date(year, month - 2, 1)),
        end: formatDateStr(new Date(year, month + 1, 0)),
      };
    case "last6Months":
      return {
        start: formatDateStr(new Date(year, month - 5, 1)),
        end: formatDateStr(new Date(year, month + 1, 0)),
      };
    case "thisYear":
      return {
        start: formatDateStr(new Date(year, 0, 1)),
        end: formatDateStr(new Date(year, 11, 31)),
      };
    case "lastYear":
      return {
        start: formatDateStr(new Date(year - 1, 0, 1)),
        end: formatDateStr(new Date(year - 1, 11, 31)),
      };
  }
}

export function Reports() {
  const { transactions, fetchTransactions } = useTransactionStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { accounts, fetchAccounts, getNetWorth } = useAccountStore();
  const [period, setPeriod] = useState<Period>("thisMonth");

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
    fetchAccounts();
  }, [fetchTransactions, fetchCategories, fetchAccounts]);

  const { start, end } = getPeriodDates(period);

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.date >= start && tx.date <= end);
  }, [transactions, start, end]);

  // Calculate spending by category
  const spendingByCategory = useMemo(() => {
    const spending: Record<string, number> = {};

    filteredTransactions
      .filter((tx) => tx.amount < 0 && !tx.transferId)
      .forEach((tx) => {
        const categoryId = tx.categoryId || "uncategorized";
        spending[categoryId] = (spending[categoryId] || 0) + Math.abs(tx.amount);
      });

    return Object.entries(spending)
      .map(([categoryId, amount]) => {
        const category = categories.find((c) => c.id === categoryId);
        return {
          name: category?.name || "Uncategorized",
          value: amount / 100,
          fill: COLORS[categories.indexOf(category!) % COLORS.length] || COLORS[0],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categories]);

  // Calculate income vs expenses
  const incomeVsExpenses = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => tx.amount > 0 && !tx.transferId)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expenses = filteredTransactions
      .filter((tx) => tx.amount < 0 && !tx.transferId)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    return { income: income / 100, expenses: expenses / 100 };
  }, [filteredTransactions]);

  // Calculate monthly trends
  const monthlyTrends = useMemo(() => {
    const months: Record<string, { income: number; expenses: number }> = {};

    transactions
      .filter((tx) => !tx.transferId)
      .forEach((tx) => {
        const month = tx.date.substring(0, 7); // YYYY-MM
        if (!months[month]) {
          months[month] = { income: 0, expenses: 0 };
        }
        if (tx.amount > 0) {
          months[month].income += tx.amount / 100;
        } else {
          months[month].expenses += Math.abs(tx.amount) / 100;
        }
      });

    return Object.entries(months)
      .map(([month, data]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        income: Math.round(data.income),
        expenses: Math.round(data.expenses),
        savings: Math.round(data.income - data.expenses),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [transactions]);

  // Calculate account balances
  const accountBalances = useMemo(() => {
    return accounts
      .filter((a) => a.isActive && !a.isHidden)
      .map((account) => ({
        name: account.name,
        balance: account.currentBalance / 100,
        type: account.accountType,
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [accounts]);

  const totalSpending = spendingByCategory.reduce((sum, cat) => sum + cat.value, 0);
  const netWorth = getNetWorth() / 100;

  return (
    <>
      <Header
        title="Reports"
        actions={
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="last3Months">Last 3 Months</SelectItem>
              <SelectItem value="last6Months">Last 6 Months</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
              <SelectItem value="lastYear">Last Year</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <PageContainer>
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatMoney(incomeVsExpenses.income * 100)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {formatMoney(incomeVsExpenses.expenses * 100)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Savings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-2xl font-bold",
                  incomeVsExpenses.income - incomeVsExpenses.expenses >= 0
                    ? "text-green-600"
                    : "text-red-600"
                )}
              >
                {formatMoney((incomeVsExpenses.income - incomeVsExpenses.expenses) * 100)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Worth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-2xl font-bold",
                  netWorth >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatMoney(netWorth * 100)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="spending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="spending">Spending</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
          </TabsList>

          {/* Spending Tab */}
          <TabsContent value="spending" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Spending by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {spendingByCategory.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No spending data for this period
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={spendingByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                          outerRadius={100}
                          dataKey="value"
                        >
                          {spendingByCategory.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatMoney(value * 100)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {spendingByCategory.slice(0, 8).map((category, index) => (
                      <div key={category.name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm font-medium">{category.name}</span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatMoney(category.value * 100)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(category.value / totalSpending) * 100}%`,
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {spendingByCategory.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No spending data for this period
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyTrends.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No transaction data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `$${value}`} />
                      <Tooltip
                        formatter={(value: number) => formatMoney(value * 100)}
                      />
                      <Legend />
                      <Bar dataKey="income" name="Income" fill="#22c55e" />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Savings Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyTrends.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No transaction data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `$${value}`} />
                      <Tooltip
                        formatter={(value: number) => formatMoney(value * 100)}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="savings"
                        name="Monthly Savings"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: "#3b82f6" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account Balances</CardTitle>
              </CardHeader>
              <CardContent>
                {accountBalances.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No accounts available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={accountBalances} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                      <YAxis type="category" dataKey="name" width={120} />
                      <Tooltip
                        formatter={(value: number) => formatMoney(value * 100)}
                      />
                      <Bar
                        dataKey="balance"
                        name="Balance"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </>
  );
}
