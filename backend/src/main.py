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
from src.disputes.router import router as disputes_router

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
import src.disputes.models  # noqa

from contextlib import asynccontextmanager
from sqlalchemy import text

def auto_migrate_sqlite_schema(engine):
    """
    Ensures that any newly added columns in SQLAlchemy ORM models
    are automatically created in the existing SQLite database without data loss.
    """
    try:
        with engine.connect() as conn:
            for table_name, table in Base.metadata.tables.items():
                res = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                if not res:
                    continue
                existing_cols = {row[1] for row in res}
                for column in table.columns:
                    if column.name not in existing_cols:
                        col_type = column.type.compile(engine.dialect)
                        alter_query = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type}"
                        conn.execute(text(alter_query))
                        conn.commit()
                        print(f" [DB Migration] Added missing column '{column.name}' to table '{table_name}'")
    except Exception as err:
        print(f" [DB Migration Notice] {err}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
        auto_migrate_sqlite_schema(engine)
    except Exception as err:
        print(f"Table init notice: {err}")

    banner = "=" * 65
    print(f"\n{banner}")
    print(f" >> {settings.PROJECT_NAME} API Backend Running")
    print(f"{banner}")
    print(f" -- Swagger UI (Interactive Docs) : http://127.0.0.1:8000/docs")
    print(f" -- ReDoc Documentation          : http://127.0.0.1:8000/redoc")
    print(f" -- OpenAPI Spec JSON            : http://127.0.0.1:8000{settings.API_V1_STR}/openapi.json")
    print(f"{banner}\n")
    yield


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
app.include_router(disputes_router, prefix=settings.API_V1_STR)

# CORS Setup
origins = settings.BACKEND_CORS_ORIGINS
if isinstance(origins, str):
    origins = [i.strip() for i in origins.split(",") if i.strip()]
elif not isinstance(origins, list):
    origins = [str(origins)]

default_origins = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

all_origins = list(set((origins or []) + default_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=all_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app|https://.*\.pages\.dev|https://.*\.netlify\.app|https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME}
