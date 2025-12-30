import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Wallet,
  PiggyBank,
  CreditCard,
  TrendingUp,
  Landmark,
  Banknote,
  CircleDollarSign,
  MoreHorizontal,
  Pencil,
  Trash2,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAccountStore } from "@/stores/useAccountStore";
import { formatMoney, parseMoney } from "@/lib/formatters";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Account } from "@/types";

const iconMap = {
  Wallet,
  PiggyBank,
  CreditCard,
  TrendingUp,
  Landmark,
  Banknote,
  CircleDollarSign,
};

export function Accounts() {
  const navigate = useNavigate();
  const { accounts, fetchAccounts, createAccount, updateAccount, deleteAccount } =
    useAccountStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    accountType: "checking" as AccountType,
    currentBalance: "",
    notes: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleOpenDialog = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        accountType: account.accountType,
        currentBalance: (account.currentBalance / 100).toFixed(2),
        notes: account.notes || "",
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: "",
        accountType: "checking",
        currentBalance: "",
        notes: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      accountType: formData.accountType,
      currentBalance: parseMoney(formData.currentBalance),
      notes: formData.notes || null,
      institutionId: null,
      accountNumberMasked: null,
      currency: "USD",
      availableBalance: null,
      creditLimit: null,
      interestRate: null,
      isActive: true,
      isHidden: false,
      displayOrder: accounts.length,
      ofxAccountId: null,
      lastSyncAt: null,
    };

    if (editingAccount) {
      await updateAccount(editingAccount.id, data);
    } else {
      await createAccount(data);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this account? This action cannot be undone.")) {
      await deleteAccount(id);
    }
  };

  const groupedAccounts = {
    assets: accounts.filter((a) =>
      ["checking", "savings", "investment", "cash"].includes(a.accountType)
    ),
    liabilities: accounts.filter((a) =>
      ["credit_card", "loan"].includes(a.accountType)
    ),
    other: accounts.filter((a) => a.accountType === "other"),
  };

  return (
    <>
      <Header
        title="Accounts"
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        }
      />
      <PageContainer>
        <div className="space-y-8">
          {/* Assets */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Assets</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupedAccounts.assets.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={() => handleOpenDialog(account)}
                  onDelete={() => handleDelete(account.id)}
                  onHide={() => updateAccount(account.id, { isHidden: !account.isHidden })}
                  onViewDetails={() => navigate(`/accounts/${account.id}`)}
                />
              ))}
              {groupedAccounts.assets.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Wallet className="h-8 w-8 mb-2 opacity-50" />
                    <p>No asset accounts</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => handleOpenDialog()}
                    >
                      Add your first account
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>

          {/* Liabilities */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Liabilities</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupedAccounts.liabilities.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={() => handleOpenDialog(account)}
                  onDelete={() => handleDelete(account.id)}
                  onHide={() => updateAccount(account.id, { isHidden: !account.isHidden })}
                  onViewDetails={() => navigate(`/accounts/${account.id}`)}
                />
              ))}
              {groupedAccounts.liabilities.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mb-2 opacity-50" />
                    <p>No liability accounts</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        </div>
      </PageContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Edit Account" : "Add Account"}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Update your account details"
                : "Add a new account to track"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Chase Checking"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Account Type</Label>
              <Select
                value={formData.accountType}
                onValueChange={(value) =>
                  setFormData({ ...formData, accountType: value as AccountType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="balance">Current Balance</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={formData.currentBalance}
                  onChange={(e) =>
                    setFormData({ ...formData, currentBalance: e.target.value })
                  }
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Any additional notes..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingAccount ? "Save Changes" : "Add Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface AccountCardProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  onHide: () => void;
  onViewDetails: () => void;
}

function AccountCard({ account, onEdit, onDelete, onHide, onViewDetails }: AccountCardProps) {
  const typeInfo = ACCOUNT_TYPES[account.accountType];
  const Icon = iconMap[typeInfo.icon as keyof typeof iconMap] || Wallet;

  return (
    <Card className={cn(account.isHidden && "opacity-50")}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{account.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{typeInfo.label}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onViewDetails}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onHide}>
              <EyeOff className="h-4 w-4 mr-2" />
              {account.isHidden ? "Show" : "Hide"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-2xl font-bold",
            account.currentBalance < 0 ? "text-red-600" : "text-foreground"
          )}
        >
          {formatMoney(account.currentBalance)}
        </p>
        {account.notes && (
          <p className="text-sm text-muted-foreground mt-1">{account.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
