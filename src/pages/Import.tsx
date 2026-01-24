import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAccountStore } from "@/stores/useAccountStore";
import {
  previewCsvFile,
  parseCsvFile,
  importTransactions,
  previewBoaFile,
  parseBoaFile,
  previewPdfFile,
  parsePdfFile,
  type CsvPreview,
  type ColumnMapping,
  type ParsedTransaction,
  type BoaPreview,
  type PdfPreview,
} from "@/lib/tauri";
import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type Step = "upload" | "mapping" | "preview" | "complete";

type FileType = "csv" | "boa" | "pdf";

export function Import() {
  const navigate = useNavigate();
  const { accounts, fetchAccounts } = useAccountStore();
  const [step, setStep] = useState<Step>("upload");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<FileType>("csv");
  const [accountId, setAccountId] = useState<string>("");
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [boaPreview, setBoaPreview] = useState<BoaPreview | null>(null);
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    dateColumn: 0,
    amountColumn: 1,
    payeeColumn: 2,
    memoColumn: undefined,
    categoryColumn: undefined,
    dateFormat: "",
    invertAmounts: false,
  });
  const [useSeparateColumns, setUseSeparateColumns] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch accounts on mount
  useState(() => {
    fetchAccounts();
  });

  const handleSelectFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Bank Statements", extensions: ["csv", "txt", "pdf"] },
        ],
      });

      if (selected && typeof selected === "string") {
        setFilePath(selected);
        const name = selected.split("/").pop() || selected;
        setFileName(name);
        setError(null);

        // Detect file type based on extension
        const isTxtFile = name.toLowerCase().endsWith(".txt");
        const isPdfFile = name.toLowerCase().endsWith(".pdf");

        if (isPdfFile) {
          // Try PDF parser
          try {
            const preview = await previewPdfFile(selected);
            if (preview.transactions.length > 0) {
              setFileType("pdf");
              setPdfPreview(preview);
              setCsvPreview(null);
              setBoaPreview(null);
              setStep("mapping");
              return;
            } else {
              setError("No transactions found in PDF. Try exporting as CSV from your bank.");
              return;
            }
          } catch (err) {
            setError(String(err));
            return;
          }
        }

        if (isTxtFile) {
          // Try Bank of America parser for .txt files
          try {
            const preview = await previewBoaFile(selected);
            if (preview.transactions.length > 0) {
              setFileType("boa");
              setBoaPreview(preview);
              setCsvPreview(null);
              setPdfPreview(null);
              // Skip mapping step for BoA files - go to account selection in preview
              setStep("mapping"); // Still need to select account
              return;
            }
          } catch {
            // Fall back to CSV if BoA parsing fails
          }
        }

        // Standard CSV parsing
        setFileType("csv");
        setBoaPreview(null);
        setPdfPreview(null);
        const preview = await previewCsvFile(selected);
        setCsvPreview(preview);

        // Auto-detect columns based on header names
        const headers = preview.headers.map((h) => h.toLowerCase());
        const dateIdx = headers.findIndex((h) =>
          ["date", "posted", "trans date", "transaction date"].includes(h)
        );
        const amountIdx = headers.findIndex((h) =>
          ["amount", "total", "value"].includes(h)
        );
        const debitIdx = headers.findIndex((h) =>
          ["debit", "withdrawal", "out"].includes(h)
        );
        const creditIdx = headers.findIndex((h) =>
          ["credit", "deposit", "in"].includes(h)
        );
        const payeeIdx = headers.findIndex((h) =>
          ["payee", "description", "merchant", "name", "memo"].includes(h)
        );
        const memoIdx = headers.findIndex((h) =>
          ["memo", "note", "notes", "reference"].includes(h)
        );

        setColumnMapping((prev) => ({
          ...prev,
          dateColumn: dateIdx >= 0 ? dateIdx : 0,
          amountColumn: amountIdx >= 0 ? amountIdx : 1,
          debitColumn: debitIdx >= 0 ? debitIdx : undefined,
          creditColumn: creditIdx >= 0 ? creditIdx : undefined,
          payeeColumn: payeeIdx >= 0 ? payeeIdx : undefined,
          memoColumn: memoIdx >= 0 ? memoIdx : undefined,
        }));

        setUseSeparateColumns(debitIdx >= 0 && creditIdx >= 0);
        setStep("mapping");
      }
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleParseFile = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    setError(null);

    try {
      if (fileType === "boa") {
        // Parse Bank of America file
        const boaTx = await parseBoaFile(filePath);
        const transactions: ParsedTransaction[] = boaTx.map((tx) => ({
          date: tx.date,
          amount: tx.amount,
          payee: tx.payee,
          memo: tx.memo,
          rawData: {},
        }));
        setParsedTransactions(transactions);
        setSelectedTransactions(new Set(transactions.map((_, i) => i)));
        setStep("preview");
      } else if (fileType === "pdf") {
        // Parse PDF file
        const pdfTx = await parsePdfFile(filePath);
        const transactions: ParsedTransaction[] = pdfTx.map((tx) => ({
          date: tx.date,
          amount: tx.amount,
          payee: tx.payee,
          memo: tx.memo,
          rawData: {},
        }));
        setParsedTransactions(transactions);
        setSelectedTransactions(new Set(transactions.map((_, i) => i)));
        setStep("preview");
      } else {
        // Parse CSV file
        const mapping: ColumnMapping = useSeparateColumns
          ? {
              ...columnMapping,
              amountColumn: 0, // Not used when separate columns
              debitColumn: columnMapping.debitColumn,
              creditColumn: columnMapping.creditColumn,
            }
          : {
              ...columnMapping,
              debitColumn: undefined,
              creditColumn: undefined,
            };

        const transactions = await parseCsvFile(filePath, mapping);
        setParsedTransactions(transactions);
        setSelectedTransactions(new Set(transactions.map((_, i) => i)));
        setStep("preview");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [filePath, fileType, columnMapping, useSeparateColumns]);

  const handleImport = useCallback(async () => {
    if (!accountId) {
      setError("Please select an account");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const transactionsToImport = parsedTransactions
        .filter((_, i) => selectedTransactions.has(i))
        .map((tx) => ({
          date: tx.date,
          amount: tx.amount,
          payee: tx.payee,
          memo: tx.memo,
        }));

      const result = await importTransactions(accountId, transactionsToImport);
      setImportResult({ imported: result.imported, skipped: result.skipped });
      setStep("complete");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [accountId, parsedTransactions, selectedTransactions]);

  const toggleTransaction = (index: number) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTransactions.size === parsedTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(parsedTransactions.map((_, i) => i)));
    }
  };

  return (
    <>
      <Header title="Import Transactions" />
      <PageContainer>
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {(["upload", "mapping", "preview", "complete"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["upload", "mapping", "preview", "complete"].indexOf(step) > i
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {["upload", "mapping", "preview", "complete"].indexOf(step) > i ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div
                  className={cn(
                    "h-1 w-16 mx-2",
                    ["upload", "mapping", "preview", "complete"].indexOf(step) > i
                      ? "bg-green-500"
                      : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <Card className="mb-4 border-destructive">
            <CardContent className="py-4 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {error}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Select a File</CardTitle>
              <CardDescription>
                Choose a CSV, TXT, or PDF statement file exported from your bank
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={handleSelectFile}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Click to select a file</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Supports CSV, PDF, and Bank of America TXT statements
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Column Mapping */}
        {step === "mapping" && csvPreview && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>Map Columns</CardTitle>
              <CardDescription>
                Tell us which columns contain which data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {csvPreview.totalRows} rows
                  </p>
                </div>
              </div>

              {/* Account Selection */}
              <div className="space-y-2">
                <Label>Import to Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Column Mapping */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date Column</Label>
                  <Select
                    value={String(columnMapping.dateColumn)}
                    onValueChange={(v) =>
                      setColumnMapping((prev) => ({ ...prev, dateColumn: parseInt(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {csvPreview.headers.map((header, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {header || `Column ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Payee/Description Column</Label>
                  <Select
                    value={columnMapping.payeeColumn !== undefined ? String(columnMapping.payeeColumn) : "none"}
                    onValueChange={(v) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        payeeColumn: v === "none" ? undefined : parseInt(v),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {csvPreview.headers.map((header, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {header || `Column ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amount Type Toggle */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="separateColumns"
                  checked={useSeparateColumns}
                  onCheckedChange={(checked) => setUseSeparateColumns(!!checked)}
                />
                <Label htmlFor="separateColumns">
                  Use separate debit/credit columns
                </Label>
              </div>

              {/* Amount Columns */}
              {useSeparateColumns ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Debit Column (expenses)</Label>
                    <Select
                      value={columnMapping.debitColumn !== undefined ? String(columnMapping.debitColumn) : "none"}
                      onValueChange={(v) =>
                        setColumnMapping((prev) => ({
                          ...prev,
                          debitColumn: v === "none" ? undefined : parseInt(v),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {csvPreview.headers.map((header, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {header || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Credit Column (income)</Label>
                    <Select
                      value={columnMapping.creditColumn !== undefined ? String(columnMapping.creditColumn) : "none"}
                      onValueChange={(v) =>
                        setColumnMapping((prev) => ({
                          ...prev,
                          creditColumn: v === "none" ? undefined : parseInt(v),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {csvPreview.headers.map((header, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {header || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Amount Column</Label>
                    <Select
                      value={String(columnMapping.amountColumn)}
                      onValueChange={(v) =>
                        setColumnMapping((prev) => ({ ...prev, amountColumn: parseInt(v) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {csvPreview.headers.map((header, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {header || `Column ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end pb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="invertAmounts"
                        checked={columnMapping.invertAmounts}
                        onCheckedChange={(checked) =>
                          setColumnMapping((prev) => ({ ...prev, invertAmounts: !!checked }))
                        }
                      />
                      <Label htmlFor="invertAmounts">
                        Invert amounts (expenses are positive)
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div>
                <Label className="mb-2 block">Preview</Label>
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-[200px]">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          {csvPreview.headers.map((header, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium">
                              {header || `Col ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.rows.map((row, i) => (
                          <tr key={i} className="border-t">
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-2 truncate max-w-[150px]">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleParseFile} disabled={loading || !accountId}>
                  {loading ? "Parsing..." : "Continue"}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: BoA File - Simplified account selection */}
        {step === "mapping" && fileType === "boa" && boaPreview && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>Bank of America Statement</CardTitle>
              <CardDescription>
                {boaPreview.totalRows} transactions detected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    Bank of America statement format detected
                  </p>
                </div>
              </div>

              {/* Balance Summary */}
              {(boaPreview.beginningBalance || boaPreview.endingBalance) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {boaPreview.beginningBalance && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Beginning Balance</p>
                      <p className="text-lg font-semibold">{formatMoney(boaPreview.beginningBalance)}</p>
                    </div>
                  )}
                  {boaPreview.endingBalance && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Ending Balance</p>
                      <p className="text-lg font-semibold">{formatMoney(boaPreview.endingBalance)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Account Selection */}
              <div className="space-y-2">
                <Label>Import to Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transaction Preview */}
              <div>
                <Label className="mb-2 block">Preview (first 10 transactions)</Label>
                <ScrollArea className="h-[200px] border rounded-lg">
                  <div className="divide-y">
                    {boaPreview.transactions.slice(0, 10).map((tx, i) => (
                      <div key={i} className="flex items-center justify-between p-3">
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium truncate">{tx.description}</p>
                          <p className="text-sm text-muted-foreground">{tx.date}</p>
                        </div>
                        <span
                          className={cn(
                            "font-semibold",
                            tx.amount >= 0 ? "text-green-600" : "text-red-600"
                          )}
                        >
                          {formatMoney(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleParseFile} disabled={loading || !accountId}>
                  {loading ? "Parsing..." : "Continue"}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: PDF File - Account selection with confidence indicator */}
        {step === "mapping" && fileType === "pdf" && pdfPreview && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>PDF Statement</CardTitle>
              <CardDescription>
                {pdfPreview.totalRows} transactions detected
                {pdfPreview.detectedFormat && ` (${pdfPreview.detectedFormat} format)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Confidence Warning */}
              {pdfPreview.confidence < 0.7 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-400">
                    Low parsing confidence ({Math.round(pdfPreview.confidence * 100)}%). Please review transactions carefully.
                  </span>
                </div>
              )}

              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    PDF statement {pdfPreview.detectedFormat ? `(${pdfPreview.detectedFormat})` : ""}
                  </p>
                </div>
              </div>

              {/* Account Selection */}
              <div className="space-y-2">
                <Label>Import to Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transaction Preview */}
              <div>
                <Label className="mb-2 block">Preview (first 10 transactions)</Label>
                <ScrollArea className="h-[200px] border rounded-lg">
                  <div className="divide-y">
                    {pdfPreview.transactions.slice(0, 10).map((tx, i) => (
                      <div key={i} className="flex items-center justify-between p-3">
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium truncate">{tx.description}</p>
                          <p className="text-sm text-muted-foreground">{tx.date}</p>
                        </div>
                        <span
                          className={cn(
                            "font-semibold",
                            tx.amount >= 0 ? "text-green-600" : "text-red-600"
                          )}
                        >
                          {formatMoney(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleParseFile} disabled={loading || !accountId}>
                  {loading ? "Parsing..." : "Continue"}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview & Confirm */}
        {step === "preview" && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>Review Transactions</CardTitle>
              <CardDescription>
                {selectedTransactions.size} of {parsedTransactions.length} transactions selected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Checkbox
                  checked={selectedTransactions.size === parsedTransactions.length}
                  onCheckedChange={toggleAll}
                />
                <Label>Select all</Label>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <div className="divide-y">
                  {parsedTransactions.map((tx, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-4 p-3 hover:bg-accent",
                        !selectedTransactions.has(i) && "opacity-50"
                      )}
                    >
                      <Checkbox
                        checked={selectedTransactions.has(i)}
                        onCheckedChange={() => toggleTransaction(i)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{tx.payee || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">{tx.date}</p>
                      </div>
                      <span
                        className={cn(
                          "font-semibold",
                          tx.amount >= 0 ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {formatMoney(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading || selectedTransactions.size === 0}
                >
                  {loading ? "Importing..." : `Import ${selectedTransactions.size} Transactions`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && importResult && (
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto mb-6">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Import Complete</h2>
              <p className="text-muted-foreground mb-6">
                Successfully imported {importResult.imported} transactions
                {importResult.skipped > 0 && ` (${importResult.skipped} duplicates skipped)`}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => {
                  setStep("upload");
                  setFilePath(null);
                  setCsvPreview(null);
                  setBoaPreview(null);
                  setPdfPreview(null);
                  setParsedTransactions([]);
                  setImportResult(null);
                }}>
                  Import More
                </Button>
                <Button onClick={() => navigate("/transactions")}>
                  View Transactions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </>
  );
}
