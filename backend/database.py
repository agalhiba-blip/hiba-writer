import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Support PostgreSQL (Vercel/Neon) ou SQLite (local)
_DATABASE_URL = os.environ.get("DATABASE_URL", "")

if _DATABASE_URL:
    # PostgreSQL pour la production (Neon, Supabase, etc.)
    if _DATABASE_URL.startswith("postgres://"):
        _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif _DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in _DATABASE_URL:
        _DATABASE_URL = _DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    DATABASE_URL = _DATABASE_URL
    engine = create_async_engine(DATABASE_URL, echo=False)
else:
    # SQLite — local: dossier data/, Vercel: /tmp/
    if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
        DB_PATH = "/tmp/roman_writer.db"
    else:
        DB_PATH = os.path.join(BASE_DIR, "data", "roman_writer.db")
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"
    engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    from backend import models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Insérer les paramètres par défaut
    async with AsyncSessionLocal() as session:
        from backend.models import Setting
        from sqlalchemy import select
        defaults = {
            "anthropic_api_key": "",
            "claude_model": "claude-sonnet-4-6",
            "theme": "dark",
            "autosave_interval": "30",
        }
        for key, value in defaults.items():
            result = await session.execute(select(Setting).where(Setting.key == key))
            if not result.scalar_one_or_none():
                session.add(Setting(key=key, value=value))
        await session.commit()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
