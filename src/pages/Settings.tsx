import { useState, useEffect } from "react";
import { Moon, Sun, Lock, FileText, FileJson, FolderOpen, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAppStore } from "@/stores/useAppStore";
import * as api from "@/lib/tauri";

export function Settings() {
  const { theme, setTheme } = useAppStore();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDbPathDialogOpen, setIsDbPathDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Database path state
  const [dbPath, setDbPath] = useState<string>("");
  const [defaultDbPath, setDefaultDbPath] = useState<string>("");
  const [newDbPath, setNewDbPath] = useState<string>("");
  const [dbPathError, setDbPathError] = useState<string | null>(null);
  const [isSavingDbPath, setIsSavingDbPath] = useState(false);

  useEffect(() => {
    loadDbPaths();
  }, []);

  const loadDbPaths = async () => {
    try {
      const [current, defaultPath] = await Promise.all([
        api.getDatabasePath(),
        api.getDefaultDatabasePath(),
      ]);
      setDbPath(current);
      setDefaultDbPath(defaultPath);
    } catch (err) {
      console.error("Failed to load database paths:", err);
    }
  };

  const handleOpenDbPathDialog = () => {
    setNewDbPath(dbPath);
    setDbPathError(null);
    setIsDbPathDialogOpen(true);
  };

  const handleSaveDbPath = async () => {
    setDbPathError(null);
    setIsSavingDbPath(true);

    try {
      // Validate path ends with .db
      if (newDbPath && !newDbPath.endsWith(".db")) {
        setDbPathError("Database path must end with .db");
        setIsSavingDbPath(false);
        return;
      }

      const updatedPath = await api.setDatabasePath(newDbPath || null);
      setDbPath(updatedPath);
      setIsDbPathDialogOpen(false);
    } catch (err) {
      setDbPathError(String(err));
    } finally {
      setIsSavingDbPath(false);
    }
  };

  const handleResetDbPath = async () => {
    setNewDbPath("");
  };

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordForm.new.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      const success = await api.changePassword(passwordForm.current, passwordForm.new);
      if (success) {
        setIsPasswordDialogOpen(false);
        setPasswordForm({ current: "", new: "", confirm: "" });
      } else {
        setPasswordError("Current password is incorrect");
      }
    } catch (err) {
      setPasswordError(String(err));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleExportJson = async () => {
    try {
      const json = await api.exportToJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tally-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await api.exportToCsv({});
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export failed:", err);
    }
  };

  return (
    <>
      <Header title="Settings" />
      <PageContainer>
        <div className="max-w-2xl space-y-6">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the app looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="mb-3 block">Theme</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      onClick={() => handleThemeChange("light")}
                    >
                      <Sun className="h-4 w-4 mr-2" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      onClick={() => handleThemeChange("dark")}
                    >
                      <Moon className="h-4 w-4 mr-2" />
                      Dark
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Manage your encryption password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Change Password</p>
                    <p className="text-sm text-muted-foreground">
                      Update your encryption password
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsPasswordDialogOpen(true)}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Change
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data */}
          <Card>
            <CardHeader>
              <CardTitle>Data</CardTitle>
              <CardDescription>
                Export and import your financial data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Export Full Backup</p>
                    <p className="text-sm text-muted-foreground">
                      Download all accounts, transactions, and settings
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleExportJson}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export JSON
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Export Transactions</p>
                    <p className="text-sm text-muted-foreground">
                      Download transactions as CSV for spreadsheets
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleExportCsv}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced</CardTitle>
              <CardDescription>
                Database location and advanced settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-medium">Database Location</p>
                    <p className="text-sm text-muted-foreground font-mono truncate">
                      {dbPath || "Loading..."}
                    </p>
                    {dbPath !== defaultDbPath && dbPath && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Using custom location
                      </p>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleOpenDbPathDialog}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Change
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span>0.1.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Built with</span>
                  <span>Tauri + React</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current Password</Label>
              <Input
                id="current"
                type="password"
                value={passwordForm.current}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, current: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <Input
                id="new"
                type="password"
                value={passwordForm.new}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, new: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm New Password</Label>
              <Input
                id="confirm"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirm: e.target.value })
                }
                required
              />
            </div>
            {passwordError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {passwordError}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPasswordDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? "Changing..." : "Change Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Database Path Dialog */}
      <Dialog open={isDbPathDialogOpen} onOpenChange={setIsDbPathDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Database Location</DialogTitle>
            <DialogDescription>
              Specify a custom location for your encrypted database file.
              The app will need to be restarted after changing this setting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dbPath">Database Path</Label>
              <div className="flex gap-2">
                <Input
                  id="dbPath"
                  type="text"
                  value={newDbPath}
                  onChange={(e) => setNewDbPath(e.target.value)}
                  placeholder={defaultDbPath}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleResetDbPath}
                  title="Reset to default"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Default: <span className="font-mono">{defaultDbPath}</span>
              </p>
            </div>
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-700 dark:text-amber-400">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Important</p>
                  <p className="mt-1">
                    Changing the database location will require you to unlock the database again.
                    Make sure the new path is accessible and has write permissions.
                  </p>
                </div>
              </div>
            </div>
            {dbPathError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {dbPathError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDbPathDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveDbPath} disabled={isSavingDbPath}>
              {isSavingDbPath ? "Saving..." : "Save & Restart"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
