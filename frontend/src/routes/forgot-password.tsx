*** Begin Patch
*** Add File: frontend/src/routes/forgot-password.tsx
+import { createFileRoute, useNavigate } from "@tanstack/react-router";
+import { useState } from "react";
+import { Button } from "@/components/ui/button";
+import { Input } from "@/components/ui/input";
+import { Label } from "@/components/ui/label";
+import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
+import { toast } from "sonner";
+import { authService } from "@/services";
+
+export const Route = createFileRoute("/forgot-password")({
+  head: () => ({ meta: [{ title: "Forgot Password — CEN" }] }),
+  component: ForgotPassword,
+});
+
+function ForgotPassword() {
+  const nav = useNavigate();
+  const [email, setEmail] = useState("");
+  const [loading, setLoading] = useState(false);
+
+  const submit = async (e: React.FormEvent) => {
+    e.preventDefault();
+    if (!email.trim()) return toast.warning("Please provide your email address.");
+    setLoading(true);
+    try {
+      await authService.requestPasswordReset(email.trim());
+      toast.success("If an account exists, a reset link has been sent to that email.");
+      nav({ to: "/login" });
+    } catch (err: any) {
+      toast.error(err?.message || "Failed to send reset link.");
+    } finally {
+      setLoading(false);
+    }
+  };
+
+  return (
+    <div className="min-h-screen flex items-center justify-center p-6">
+      <Card className="max-w-md w-full">
+        <CardHeader>
+          <CardTitle>Reset your password</CardTitle>
+          <CardDescription className="text-xs">Enter your account email and we'll send instructions to reset your password.</CardDescription>
+        </CardHeader>
+        <CardContent>
+          <form onSubmit={submit} className="space-y-4">
+            <div>
+              <Label className="text-xs font-bold">Email</Label>
+              <Input
+                type="email"
+                value={email}
+                onChange={(e) => setEmail(e.target.value)}
+                required
+                className="h-10 text-xs rounded-lg"
+              />
+            </div>
+            <div className="flex gap-2">
+              <Button type="submit" className="w-full" disabled={loading}>
+                {loading ? "Sending..." : "Send reset link"}
+              </Button>
+            </div>
+          </form>
+        </CardContent>
+      </Card>
+    </div>
+  );
+}
+
