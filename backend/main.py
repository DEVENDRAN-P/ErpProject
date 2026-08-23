import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from backend.api.router import api_router
from backend.core.config import settings
from backend.core.rate_limit import RateLimitMiddleware
from backend.db.init_db import init_db
from backend.reference_data import load_reference_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist and validation reference data is loaded on a clean install.
    init_db()
    load_reference_data()

    # ── Startup validation: warn about missing critical env vars ────────
    missing = []
    if not settings.gemini_api_key and not settings.openai_api_key:
        missing.append("GEMINI_API_KEY or OPENAI_API_KEY (AI extraction will use rule-based fallback only)")
    if not os.environ.get("FIREBASE_CLIENT_EMAIL") and not os.environ.get("FIREBASE_SERVICE_ACCOUNT"):
        missing.append("FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (backend cannot verify Firebase tokens)")
    if settings.environment != "production":
        print(f"[STARTUP WARNING] ENVIRONMENT is '{settings.environment}' — set to 'production' on Render")
    if missing:
        print("[STARTUP WARNING] Missing environment variables:")
        for m in missing:
            print(f"  - {m}")
    else:
        print("[STARTUP] All critical environment variables configured.")
    print(f"[STARTUP] Environment: {settings.environment}")
    print(f"[STARTUP] Gemini configured: {bool(settings.gemini_api_key)}")
    print(f"[STARTUP] OpenAI configured: {bool(settings.openai_api_key)}")
    print(f"[STARTUP] Firebase Admin configured: {bool(os.environ.get('FIREBASE_CLIENT_EMAIL') or os.environ.get('FIREBASE_SERVICE_ACCOUNT'))}")

    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

# ── CORS: only allow the configured frontend URL ──────────────────────────
# Production must set FRONTEND_URL to the actual deployed domain.
allowed_origins = [
    settings.frontend_url,
    "https://nexgenplus-erp.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://nexgenplus-erp\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


# ── Security Headers Middleware ───────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # Only add HSTS in production
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


# ── Rate Limiting ────────────────────────────────────────────────────────
app.add_middleware(RateLimitMiddleware)


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "NexGen backend is running."}
