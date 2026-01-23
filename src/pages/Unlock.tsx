import { useEffect, useState } from "react";
import { DollarSign, Lock, Eye, EyeOff, Shield, Sparkles, AlertTriangle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAppStore } from "@/stores/useAppStore";
import * as api from "@/lib/tauri";

export function Unlock() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [dbPath, setDbPath] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState(false);
  const { setUnlocked } = useAppStore();

  // Check if database exists on mount
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const [exists, path] = await Promise.all([
          api.databaseExists(),
          api.getDatabasePath(),
        ]);
        setIsNewUser(!exists);
        setDbPath(path);
      } catch {
        // If check fails, assume existing user (safer default)
        setIsNewUser(false);
      } finally {
        setIsChecking(false);
      }
    };
    checkDatabase();
  }, []);

  const handleDeleteDatabase = async () => {
    try {
      await api.deleteDatabase();
      // Reset state to show new user flow
      setShowFinalDeleteConfirm(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
      setShowForgotPassword(false);
      setError(null);
      setPassword("");
      setIsNewUser(true);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isNewUser) {
      if (password.length > 0 && password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length > 0 && password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
    }

    try {
      const success = await api.unlockDatabase(password);
      if (success) {
        setUnlocked(true);
      } else {
        setError("Incorrect password");
        setErrorKey((k) => k + 1);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/20" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <DollarSign className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">
            {isNewUser ? "Welcome to Tally" : "Welcome Back"}
          </CardTitle>
          <CardDescription>
            {isNewUser
              ? "Your private, local-first personal finance app"
              : "Enter your password to unlock your data"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isNewUser && (
            <div className="mb-6 space-y-3">
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>All your data stays on your device, encrypted with your password</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>Track accounts, transactions, budgets, and goals in one place</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-destructive">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <span><strong>Warning:</strong> There is NO password recovery. If you forget your password, your data cannot be recovered.</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">
                {isNewUser ? "Create a Password" : "Password"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder={isNewUser ? "Choose a password (optional)" : "Enter password"}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {isNewUser && (
                <p className="text-xs text-muted-foreground">
                  Leave blank for no password, or use 8+ characters for encryption
                </p>
              )}
            </div>

            {isNewUser && password.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    placeholder="Confirm password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This password encrypts all your data. There is no recovery - please remember it!
                </p>
              </div>
            )}

            {error && (
              <div
                key={errorKey}
                className="animate-shake rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <Button type="submit" className="w-full">
              {isNewUser ? "Get Started" : "Unlock"}
            </Button>
          </form>

          {/* Forgot Password Section - only for existing users */}
          {!isNewUser && (
            <div className="mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowForgotPassword(!showForgotPassword)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
              >
                {showForgotPassword ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Forgot your password?
              </button>

              {showForgotPassword && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="font-semibold text-destructive">There is no way to recover your password</p>
                        <p className="text-muted-foreground">
                          Your data is encrypted with your password. Without it, your data cannot be decrypted or recovered.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md bg-muted p-4 text-sm space-y-2">
                    <p className="font-medium">Your database location:</p>
                    <code className="block text-xs bg-background p-2 rounded border break-all">
                      {dbPath}
                    </code>
                    <p className="text-muted-foreground text-xs">
                      You can move this file elsewhere if you want to preserve it before starting fresh.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Database and Start Fresh
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* First Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete All Data?
            </DialogTitle>
            <DialogDescription>
              This action is <strong className="text-destructive">permanent and irreversible</strong>. All your accounts, transactions, budgets, and goals will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm">
              <p className="font-medium text-destructive mb-2">To confirm, type DELETE below:</p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteConfirmText !== "DELETE"}
              onClick={() => {
                setShowDeleteDialog(false);
                setShowFinalDeleteConfirm(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Delete Confirmation Dialog */}
      <Dialog open={showFinalDeleteConfirm} onOpenChange={setShowFinalDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Final Confirmation
            </DialogTitle>
            <DialogDescription>
              Are you absolutely sure? This is your last chance to cancel.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm space-y-2">
            <p className="font-semibold text-destructive">The following will be permanently deleted:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>All accounts and balances</li>
              <li>All transactions and history</li>
              <li>All budgets and goals</li>
              <li>All categories and rules</li>
              <li>All settings and preferences</li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowFinalDeleteConfirm(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteDatabase}
            >
              Yes, Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
