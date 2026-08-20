*** Begin Patch
*** Add File: frontend/src/routes/reset-password.tsx
+import { createFileRoute, useNavigate } from "@tanstack/react-router";
+import { useState, useEffect } from "react";
+import { Button } from "@/components/ui/button";
+import { Input } from "@/components/ui/input";
+import { Label } from "@/components/ui/label";
+import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
+import { toast } from "sonner";
+import { authService } from "@/services";
+
+export const Route = createFileRoute("/reset-password")({
+  validateSearch: (search: Record<string, unknown>) => {
+    return { token: typeof search.token === "string" ? search.token : undefined };
+  },
+  head: () => ({ meta: [{ title: "Set a new password — CEN" }] }),
+  component: ResetPassword,
+});
+
+function ResetPassword() {
+  const nav = useNavigate();
+  const { token } = Route.useSearch() as { token?: string };
+  const [password, setPassword] = useState("");
+  const [loading, setLoading] = useState(false);
+
+  useEffect(() => {
+    if (!token) {
+      toast.error("Missing reset token.");
+      nav({ to: "/forgot-password" });
+    }
+  }, [token, nav]);
+
+  const submit = async (e: React.FormEvent) => {
+    e.preventDefault();
+    if (!password.trim() || password.length < 8) {
+      return toast.warning("Choose a stronger password (min 8 characters).");
+    }
+    setLoading(true);
+    try {
+      await authService.resetPassword(token || "", password);
+      toast.success("Password updated. Please sign in.");
+      nav({ to: "/login" });
+    } catch (err: any) {
+      toast.error(err?.message || "Failed to reset password.");
+    } finally {
+      setLoading(false);
+    }
+  };
+
+  return (
+    <div className="min-h-screen flex items-center justify-center p-6">
+      <Card className="max-w-md w-full">
+        <CardHeader>
+          <CardTitle>Set a new password</CardTitle>
+          <CardDescription className="text-xs">Enter a new secure password for your account.</CardDescription>
+        </CardHeader>
+        <CardContent>
+          <form onSubmit={submit} className="space-y-4">
+            <div>
+              <Label className="text-xs font-bold">New password</Label>
+              <Input
+                type="password"
+                value={password}
+                onChange={(e) => setPassword(e.target.value)}
+                required
+                className="h-10 text-xs rounded-lg"
+              />
+            </div>
+            <div className="flex gap-2">
+              <Button type="submit" className="w-full" disabled={loading}>
+                {loading ? "Saving..." : "Save new password"}
+              </Button>
+            </div>
+          </form>
+        </CardContent>
+      </Card>
+    </div>
+  );
+}
+
