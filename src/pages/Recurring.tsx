import { useEffect, useState } from "react";
import { Repeat, Search, Trash2, Calendar, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { useCategoryStore } from "@/stores/useCategoryStore";
import {
  listRecurringTransactions,
  detectRecurringTransactions,
  createRecurringTransaction,
  deleteRecurringTransaction,
} from "@/lib/tauri";
import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { RecurringTransaction, DetectedRecurring } from "@/types";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function Recurring() {
  const { categories, fetchCategories } = useCategoryStore();
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [detected, setDetected] = useState<DetectedRecurring[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringTransaction | null>(null);
  const [selectedDetected, setSelectedDetected] = useState<DetectedRecurring | null>(null);

  useEffect(() => {
    fetchCategories();
    loadRecurring();
  }, [fetchCategories]);

  const loadRecurring = async () => {
    try {
      const data = await listRecurringTransactions();
      setRecurring(data);
    } catch (err) {
      console.error("Failed to load recurring:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const data = await detectRecurringTransactions();
      setDetected(data);
    } catch (err) {
      console.error("Failed to detect recurring:", err);
    } finally {
      setDetecting(false);
    }
  };

  const handleAddDetected = async (item: DetectedRecurring) => {
    try {
      await createRecurringTransaction({
        accountId: item.accountId,
        payee: item.payee,
        amount: item.averageAmount,
        categoryId: item.categoryId,
        frequency: item.frequency as RecurringTransaction["frequency"],
        startDate: item.transactions[0]?.date ?? new Date().toISOString().split("T")[0]!,
        endDate: null,
        nextExpectedDate: item.nextExpectedDate,
        lastMatchedTransactionId: item.transactions[item.transactions.length - 1]?.id || null,
        toleranceDays: 3,
        toleranceAmount: 500,
        isAutoDetected: true,
        isActive: true,
      });
      await loadRecurring();
      // Remove from detected list
      setDetected((prev) => prev.filter((d) => d.normalizedPayee !== item.normalizedPayee));
    } catch (err) {
      console.error("Failed to add recurring:", err);
    }
  };

  const handleDelete = (item: RecurringTransaction) => {
    setSelectedRecurring(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedRecurring) return;
    try {
      await deleteRecurringTransaction(selectedRecurring.id);
      await loadRecurring();
    } catch (err) {
      console.error("Failed to delete recurring:", err);
    }
    setDeleteDialogOpen(false);
  };

  const showDetails = (item: DetectedRecurring) => {
    setSelectedDetected(item);
    setDetailsOpen(true);
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Uncategorized";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown";
  };

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Calculate totals
  const monthlyTotal = recurring.reduce((sum, r) => {
    const multiplier = {
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 0.33,
      yearly: 0.083,
    }[r.frequency] || 1;
    return sum + Math.abs(r.amount) * multiplier;
  }, 0);

  const yearlyTotal = monthlyTotal * 12;

  return (
    <>
      <Header
        title="Recurring Transactions"
        actions={
          <Button onClick={handleDetect} disabled={detecting}>
            <Search className="h-4 w-4 mr-2" />
            {detecting ? "Detecting..." : "Detect Subscriptions"}
          </Button>
        }
      />
      <PageContainer>
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{recurring.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {formatMoney(Math.round(monthlyTotal))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Yearly Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {formatMoney(Math.round(yearlyTotal))}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tracked" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tracked">
              Tracked ({recurring.length})
            </TabsTrigger>
            <TabsTrigger value="detected">
              Detected ({detected.length})
            </TabsTrigger>
          </TabsList>

          {/* Tracked Tab */}
          <TabsContent value="tracked">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="h-5 w-5" />
                  Tracked Subscriptions
                </CardTitle>
                <CardDescription>
                  Recurring transactions you are tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : recurring.length === 0 ? (
                  <div className="text-center py-8">
                    <Repeat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">
                      No recurring transactions tracked yet. Use &quot;Detect Subscriptions&quot;
                      to find them automatically.
                    </p>
                    <Button onClick={handleDetect} disabled={detecting}>
                      <Search className="h-4 w-4 mr-2" />
                      Detect Subscriptions
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recurring.map((item) => {
                      const daysUntil = getDaysUntil(item.nextExpectedDate);
                      const isUpcoming = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between p-4 border rounded-lg",
                            isUpcoming && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
                          )}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{item.payee}</span>
                              <Badge variant="outline">
                                {FREQUENCY_LABELS[item.frequency] || item.frequency}
                              </Badge>
                              {isUpcoming && (
                                <Badge variant="default" className="bg-yellow-500">
                                  Due in {daysUntil} day{daysUntil !== 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {formatMoney(Math.abs(item.amount))}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Next: {item.nextExpectedDate || "Unknown"}
                              </span>
                              <Badge variant="secondary">
                                {getCategoryName(item.categoryId)}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detected Tab */}
          <TabsContent value="detected">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Detected Patterns
                </CardTitle>
                <CardDescription>
                  Recurring patterns detected from your transactions.
                  Click &quot;Track&quot; to add them to your subscriptions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {detected.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">
                      No recurring patterns detected yet.
                      Click &quot;Detect Subscriptions&quot; to analyze your transactions.
                    </p>
                    <Button onClick={handleDetect} disabled={detecting}>
                      <Search className="h-4 w-4 mr-2" />
                      {detecting ? "Detecting..." : "Detect Subscriptions"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detected.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 cursor-pointer" onClick={() => showDetails(item)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{item.payee}</span>
                            <Badge variant="outline">
                              {FREQUENCY_LABELS[item.frequency] || item.frequency}
                            </Badge>
                            <Badge variant="secondary">
                              {item.occurrences} occurrences
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              ~{formatMoney(Math.abs(item.averageAmount))}
                            </span>
                            <span>Account: {item.accountName}</span>
                            <span>
                              Next expected: {item.nextExpectedDate}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showDetails(item)}
                          >
                            Details
                          </Button>
                          <Button size="sm" onClick={() => handleAddDetected(item)}>
                            Track
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Subscription</AlertDialogTitle>
              <AlertDialogDescription>
                Stop tracking &quot;{selectedRecurring?.payee}&quot;? This won&apos;t delete
                your transactions, just removes it from tracking.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedDetected?.payee}</DialogTitle>
              <DialogDescription>
                Detected {selectedDetected?.frequency} recurring transaction
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Average Amount</p>
                  <p className="font-semibold">
                    {formatMoney(Math.abs(selectedDetected?.averageAmount || 0))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Frequency</p>
                  <p className="font-semibold">
                    {FREQUENCY_LABELS[selectedDetected?.frequency || ""] || selectedDetected?.frequency}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Account</p>
                  <p className="font-semibold">{selectedDetected?.accountName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Occurrences</p>
                  <p className="font-semibold">{selectedDetected?.occurrences}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Transaction History</p>
                <ScrollArea className="h-[200px] border rounded-lg">
                  <div className="divide-y">
                    {selectedDetected?.transactions.map((tx) => (
                      <div key={tx.id} className="flex justify-between p-3">
                        <span className="text-sm">{tx.date}</span>
                        <span className={cn(
                          "text-sm font-medium",
                          tx.amount < 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {formatMoney(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  if (selectedDetected) {
                    handleAddDetected(selectedDetected);
                    setDetailsOpen(false);
                  }
                }}
              >
                Track This Subscription
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </>
  );
}
