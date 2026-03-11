from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from backend.database import init_db
from backend.routers import projects, chapters, characters, locations, notes, ai, export, import_word

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

IS_VERCEL = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="HIBA-WRITER API",
    description="Backend pour l'outil de rédaction de roman HIBA-WRITER",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS (nécessaire pour Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers API
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(chapters.router, prefix="/api/chapters", tags=["chapters"])
app.include_router(characters.router, prefix="/api/characters", tags=["characters"])
app.include_router(locations.router, prefix="/api/locations", tags=["locations"])
app.include_router(notes.router, prefix="/api/notes", tags=["notes"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(import_word.router, prefix="/api/import/word", tags=["import"])

# Fichiers statiques (local uniquement — sur Vercel, servis via routes Vercel)
if not IS_VERCEL:
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    if os.path.isdir(UPLOADS_DIR):
        app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Sert le frontend SPA pour toutes les routes non-API."""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    return FileResponse(index_path)
