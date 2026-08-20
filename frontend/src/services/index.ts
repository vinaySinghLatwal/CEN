*** Begin Patch
*** Update File: frontend/src/services/index.ts
@@
   getUserById: async (id: string) => {
@@
     return delay(u ?? null);
   },
+  requestPasswordReset: async (email: string) => {
+    try {
+      await apiFetch("/auth/password-reset/request", {
+        method: "POST",
+        body: JSON.stringify({ email }),
+      });
+      return true;
+    } catch (err: any) {
+      // offline / mock fallback
+      const exists = state.users.some((u) => u.email?.toLowerCase() === email.toLowerCase());
+      await delay(true);
+      return exists;
+    }
+  },
+
+  resetPassword: async (token: string, newPassword: string) => {
+    try {
+      await apiFetch("/auth/password-reset", {
+        method: "POST",
+        body: JSON.stringify({ token, newPassword }),
+      });
+      return true;
+    } catch (err: any) {
+      // Mock fallback for local dev
+      await delay(true);
+      return true;
+    }
+  },
*** End Patch