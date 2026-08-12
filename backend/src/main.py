from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.exceptions import APIException, api_exception_handler, validation_exception_handler
from src.auth.router import router as auth_router
from src.users.router import router as users_router
from src.societies.router import router as societies_router
from src.wallet.router import router as wallet_router
from src.marketplace.router import router as marketplace_router
from src.events.router import router as events_router
from src.complaints.router import router as complaints_router
from src.ai.router import router as ai_router
from src.chat.router import router as chat_router
from src.notices.router import router as notice_router
from src.analytics.router import router as analytics_router

from src.database import Base, engine
# Import models to ensure table schemas are registered with Base metadata
import src.users.models  # noqa
import src.societies.models  # noqa
import src.wallet.models  # noqa
import src.marketplace.models  # noqa
import src.events.models  # noqa
import src.complaints.models  # noqa
import src.notices.models  # noqa
import src.chat.models  # noqa

# Create tables if not exist
Base.metadata.create_all(bind=engine)

from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from src.ai.service import generate_user_summaries_job

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run the user summary generation every day at 2 AM
    scheduler.add_job(generate_user_summaries_job, "cron", hour=2)
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Exception Handlers
app.add_exception_handler(APIException, api_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Include Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(societies_router, prefix=settings.API_V1_STR)
app.include_router(wallet_router, prefix=settings.API_V1_STR)
app.include_router(marketplace_router, prefix=settings.API_V1_STR)
app.include_router(events_router, prefix=settings.API_V1_STR)
app.include_router(complaints_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)
app.include_router(chat_router, prefix=settings.API_V1_STR)
app.include_router(notice_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)

# CORS Setup
origins = settings.BACKEND_CORS_ORIGINS
if isinstance(origins, str):
    origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME}
