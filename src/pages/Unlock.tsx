import { useEffect, useState } from "react";
import { DollarSign, Lock, Eye, EyeOff, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/stores/useAppStore";
import * as api from "@/lib/tauri";

export function Unlock() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setUnlocked } = useAppStore();

  // Check if database exists on mount
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const exists = await api.databaseExists();
        setIsNewUser(!exists);
      } catch {
        // If check fails, assume existing user (safer default)
        setIsNewUser(false);
      } finally {
        setIsChecking(false);
      }
    };
    checkDatabase();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isNewUser) {
        if (password.length > 0 && password !== confirmPassword) {
          setError("Passwords do not match");
          setIsLoading(false);
          return;
        }
        if (password.length > 0 && password.length < 8) {
          setError("Password must be at least 8 characters");
          setIsLoading(false);
          return;
        }
      }

      const success = await api.unlockDatabase(password);
      if (success) {
        setUnlocked(true);
      } else {
        setError("Incorrect password");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
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
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? isNewUser ? "Setting up..." : "Unlocking..."
                : isNewUser
                ? "Get Started"
                : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
