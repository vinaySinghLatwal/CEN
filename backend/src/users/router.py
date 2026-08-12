from typing import List
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from src.database import get_db
from src.dependencies import get_current_user_from_token, require_roles
from src.users import service as user_service
from src.users.models import User
from src.users.schemas import IdProofUploadPayload, OnboardingSurveyPayload, UserResponse, UserUpdate
from src.ai.service import generate_and_save_onboarding_summary

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user_from_token)):
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(user_id: str, db: Session = Depends(get_db)):
    return user_service.get_user_by_id(db, user_id)


@router.post("/me/id-proof", response_model=UserResponse)
def upload_id_proof(
    payload: IdProofUploadPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    return user_service.upload_id_proof(db, current_user.id, payload.id_proof_url)


@router.post("/{user_id}/verify-id-proof", response_model=UserResponse)
def verify_id_proof(
    user_id: str,
    verified: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["owner", "admin"])),
):
    return user_service.verify_user_id_proof(db, user_id, verified)


@router.get("", response_model=List[UserResponse])
def list_society_users(
    society_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    return user_service.list_users_by_society(db, society_id)


@router.get("/coordinators", response_model=List[UserResponse])
def get_coordinators(
    society_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    return user_service.list_coordinators_by_society(db, society_id)


@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    update_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    return user_service.update_user_profile(db, current_user.id, update_in)


@router.post("/me/survey", response_model=UserResponse)
def update_onboarding_survey(
    payload: OnboardingSurveyPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    res = user_service.update_onboarding_survey(
        db,
        current_user.id,
        payload.interests,
        payload.offered_skills_text or "",
        payload.volunteer_interest or "",
    )
    background_tasks.add_task(generate_and_save_onboarding_summary, current_user.id)
    return res


@router.get("/me/summary", response_model=dict)
def get_my_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    from src.users.models import UserSummary
    summary = db.query(UserSummary).filter(UserSummary.user_id == current_user.id).first()
    if summary:
        return {"summary": summary.summary_text, "generated_at": summary.generated_at}
    return {"summary": "Your personalized community summary is being generated and will be available soon.", "generated_at": None}


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    return user_service.get_user_by_id(db, user_id)


@router.post("/{user_id}/promote", response_model=UserResponse)
def promote_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["owner", "admin"])),
):
    return user_service.promote_user_to_coordinator(db, user_id)


@router.post("/{user_id}/demote", response_model=UserResponse)
def demote_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["owner", "admin"])),
):
    return user_service.demote_coordinator(db, user_id)
