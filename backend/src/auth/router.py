*** Begin Patch
*** Update File: backend/src/auth/router.py
@@
-from fastapi import APIRouter, Depends, status
+from fastapi import APIRouter, Depends, status, BackgroundTasks, HTTPException
 from sqlalchemy.orm import Session
 
 from src.auth import service as auth_service
 from src.auth.security import create_access_token
 from src.database import get_db
 from src.dependencies import get_current_user_from_token
 from src.users.models import User
 from src.users.schemas import TokenResponse, UserCreate, UserLogin, UserResponse
+from pydantic import BaseModel, EmailStr
+from datetime import timedelta
+import jwt
+from src.config import settings
@@
 router = APIRouter(prefix="/auth", tags=["Authentication"])
@@
 def login(login_in: UserLogin, db: Session = Depends(get_db)):
     user = auth_service.authenticate_user(db, login_in)
     access_token = create_access_token(subject=user.id)
     return TokenResponse(access_token=access_token, user=user)
@@
 def get_me(current_user: User = Depends(get_current_user_from_token)):
     return current_user
+
+
+# Password reset models
+class PasswordResetRequest(BaseModel):
+    email: EmailStr
+
+
+class PasswordResetApply(BaseModel):
+    token: str
+    newPassword: str
+
+
+@router.post("/password-reset/request")
+def request_password_reset(payload: PasswordResetRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
+    # Generic response to avoid account enumeration
+    user = db.query(User).filter(User.email == payload.email).first()
+    if user:
+        # Short lived token (1 hour)
+        token = create_access_token(subject=user.id, expires_delta=timedelta(hours=1))
+        frontend = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
+        reset_link = f"{frontend.rstrip('/')}" + f"/reset-password?token={token}"
+        # TODO: send email via background task
+        print(f"[password-reset] link for {payload.email}: {reset_link}")
+    return {"detail": "If an account exists we have emailed instructions to reset the password."}
+
+
+@router.post("/password-reset")
+def password_reset(data: PasswordResetApply, db: Session = Depends(get_db)):
+    try:
+        payload = jwt.decode(data.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
+        user_id: str = payload.get("sub")
+        if not user_id:
+            raise HTTPException(status_code=400, detail="Invalid token payload")
+    except jwt.ExpiredSignatureError:
+        raise HTTPException(status_code=400, detail="Token expired")
+    except jwt.PyJWTError:
+        raise HTTPException(status_code=400, detail="Invalid token")
+
+    user = db.query(User).filter(User.id == user_id).first()
+    if not user:
+        raise HTTPException(status_code=400, detail="Invalid token")
+
+    from src.auth.security import get_password_hash
+    user.hashed_password = get_password_hash(data.newPassword)
+    db.commit()
+
+    return {"detail": "Password reset successful"}
*** End Patch