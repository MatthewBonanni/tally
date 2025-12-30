import { useEffect, useState, useMemo } from "react";
import { TrendingUp, TrendingDown, PieChart, RefreshCw } from "lucide-react";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { listHoldings } from "@/lib/tauri";
import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Holding {
  id: string;
  accountId: string;
  accountName: string;
  symbol: string;
  name: string | null;
  securityType: string | null;
  quantity: number;
  currentPrice: number | null;
  costBasis: number | null;
  marketValue: number;
  gainLoss: number | null;
  gainLossPercent: number | null;
}

const COLORS = [
  "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8",
  "#82CA9D", "#FFC658", "#8DD1E1", "#A4DE6C", "#D0ED57",
];

const SECURITY_TYPE_LABELS: Record<string, string> = {
  stock: "Stocks",
  etf: "ETFs",
  mutual_fund: "Mutual Funds",
  bond: "Bonds",
  crypto: "Cryptocurrency",
  other: "Other",
};

export function Investments() {
  const { accounts, fetchAccounts } = useAccountStore();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
    loadHoldings();
  }, [fetchAccounts]);

  const loadHoldings = async () => {
    try {
      const data = await listHoldings();
      setHoldings(data as Holding[]);
    } catch (err) {
      console.error("Failed to load holdings:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const totalCostBasis = holdings.reduce((sum, h) => sum + (h.costBasis || 0), 0);
    const totalGainLoss = totalValue - totalCostBasis;
    const totalGainLossPercent = totalCostBasis > 0
      ? (totalGainLoss / totalCostBasis) * 100
      : 0;

    return { totalValue, totalCostBasis, totalGainLoss, totalGainLossPercent };
  }, [holdings]);

  // Group by security type for pie chart
  const allocationData = useMemo(() => {
    const byType: Record<string, number> = {};

    holdings.forEach((h) => {
      const type = h.securityType || "other";
      byType[type] = (byType[type] || 0) + h.marketValue;
    });

    return Object.entries(byType).map(([type, value]) => ({
      name: SECURITY_TYPE_LABELS[type] || type,
      value: value / 100,
      percentage: totals.totalValue > 0 ? (value / totals.totalValue) * 100 : 0,
    }));
  }, [holdings, totals.totalValue]);

  // Investment accounts
  const investmentAccounts = accounts.filter(
    (a) => a.accountType === "investment" || a.accountType === "retirement"
  );

  return (
    <>
      <Header
        title="Investments"
        actions={
          <Button variant="outline" onClick={loadHoldings}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        }
      />
      <PageContainer>
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(totals.totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cost Basis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(totals.totalCostBasis)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Gain/Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {totals.totalGainLoss >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
                <p
                  className={cn(
                    "text-2xl font-bold",
                    totals.totalGainLoss >= 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {formatMoney(totals.totalGainLoss)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Return
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-2xl font-bold",
                  totals.totalGainLossPercent >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {totals.totalGainLossPercent >= 0 ? "+" : ""}
                {totals.totalGainLossPercent.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Asset Allocation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Asset Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {holdings.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No holdings data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percentage }) =>
                        `${name} (${percentage.toFixed(0)}%)`
                      }
                    >
                      {allocationData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatMoney(value * 100)}
                    />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Holdings Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Holdings
              </CardTitle>
              <CardDescription>
                Your investment positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading holdings...</p>
              ) : holdings.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">
                    No investment holdings yet.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Holdings will appear here when you import investment account data.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Gain/Loss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((holding) => (
                      <TableRow key={holding.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{holding.symbol}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {holding.name || holding.symbol}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {holding.accountName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {holding.quantity.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right">
                          {holding.currentPrice
                            ? formatMoney(holding.currentPrice)
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(holding.marketValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {holding.gainLoss !== null ? (
                            <div
                              className={cn(
                                "font-medium",
                                holding.gainLoss >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              )}
                            >
                              {formatMoney(holding.gainLoss)}
                              {holding.gainLossPercent !== null && (
                                <span className="text-xs ml-1">
                                  ({holding.gainLossPercent >= 0 ? "+" : ""}
                                  {holding.gainLossPercent.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Investment Accounts */}
        {investmentAccounts.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Investment Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {investmentAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {account.accountType}
                      </Badge>
                    </div>
                    <p className="text-lg font-semibold">
                      {formatMoney(account.currentBalance)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </>
  );
}
