*** Begin Patch
*** Update File: frontend/src/routes/login.tsx
@@
-                    <div className="flex justify-between items-center">
-                    <Label className="text-xs font-bold text-ink">Password</Label>
-                    <a className="text-[10px] text-on-surface-variant hover:underline cursor-pointer">Forgot password?</a>
-                  </div>
+                    <div className="flex justify-between items-center">
+                    <Label className="text-xs font-bold text-ink">Password</Label>
+                    <Link to="/forgot-password" className="text-[10px] text-on-surface-variant hover:underline">
+                      Forgot password?
+                    </Link>
+                  </div>
*** End Patch