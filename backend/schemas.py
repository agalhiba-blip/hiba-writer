from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── Projects ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str
    subtitle: str = ""
    author: str = ""
    genre: str = ""
    synopsis: str = ""
    cover_color: str = "#727B57"
    word_goal: int = 0
    tense: str = "passé"
    pov: str = ""
    series_name: str = ""


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    author: Optional[str] = None
    genre: Optional[str] = None
    synopsis: Optional[str] = None
    cover_color: Optional[str] = None
    word_goal: Optional[int] = None
    tense: Optional[str] = None
    pov: Optional[str] = None
    series_name: Optional[str] = None


class ProjectOut(BaseModel):
    id: int
    title: str
    subtitle: str
    author: str
    genre: str
    synopsis: str
    cover_color: str
    word_count: int
    word_goal: int
    tense: str
    pov: str
    series_name: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Chapters ───────────────────────────────────────────────────────────────────

class ChapterCreate(BaseModel):
    project_id: int
    title: str
    content: str = ""
    status: str = "brouillon"
    summary: str = ""
    notes: str = ""
    pov: str = ""
    word_goal: int = 0
    subtitle: str = ""
    beats: str = ""
    archived: bool = False


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    order_index: Optional[int] = None
    status: Optional[str] = None
    summary: Optional[str] = None
    notes: Optional[str] = None
    pov: Optional[str] = None
    word_goal: Optional[int] = None
    subtitle: Optional[str] = None
    beats: Optional[str] = None
    archived: Optional[bool] = None


class ChapterOut(BaseModel):
    id: int
    project_id: int
    title: str
    content: str
    order_index: int
    word_count: int
    word_goal: int
    status: str
    summary: str
    notes: str
    pov: str
    subtitle: str
    beats: str
    archived: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ChapterReorder(BaseModel):
    items: List[dict]


# ── Characters ─────────────────────────────────────────────────────────────────

class CharacterCreate(BaseModel):
    project_id: int
    name: str
    role: str = ""
    age: str = ""
    description: str = ""
    personality: str = ""
    backstory: str = ""
    goals: str = ""
    notes: str = ""
    relations: str = "[]"
    aliases: str = ""
    tags: str = ""
    color_tag: str = "#727B57"


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    age: Optional[str] = None
    description: Optional[str] = None
    personality: Optional[str] = None
    backstory: Optional[str] = None
    goals: Optional[str] = None
    notes: Optional[str] = None
    relations: Optional[str] = None
    aliases: Optional[str] = None
    tags: Optional[str] = None
    color_tag: Optional[str] = None


class CharacterOut(BaseModel):
    id: int
    project_id: int
    name: str
    role: str
    age: str
    description: str
    personality: str
    backstory: str
    goals: str
    notes: str
    relations: str
    aliases: str
    tags: str
    image_path: str
    color_tag: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Locations ──────────────────────────────────────────────────────────────────

class LocationCreate(BaseModel):
    project_id: int
    name: str
    type: str = ""
    description: str = ""
    atmosphere: str = ""
    history: str = ""
    notes: str = ""
    tags: str = ""


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    atmosphere: Optional[str] = None
    history: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None


class LocationOut(BaseModel):
    id: int
    project_id: int
    name: str
    type: str
    description: str
    atmosphere: str
    history: str
    notes: str
    tags: str
    image_path: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Notes ──────────────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    project_id: int
    title: str
    content: str = ""
    category: str = "général"
    pinned: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    pinned: Optional[bool] = None


class NoteOut(BaseModel):
    id: int
    project_id: int
    title: str
    content: str
    category: str
    pinned: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── AI ─────────────────────────────────────────────────────────────────────────

class AIRequest(BaseModel):
    text: str
    project_id: Optional[int] = None
    chapter_id: Optional[int] = None
    context: Optional[str] = ""


class TranslateRequest(BaseModel):
    text: str
    language: str  # "en", "ar", "ja", "zh"
    project_id: Optional[int] = None
    chapter_id: Optional[int] = None


class AIConfigUpdate(BaseModel):
    anthropic_api_key: str
    claude_model: str = "claude-sonnet-4-6"


# ── Settings ───────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    theme: Optional[str] = None
    autosave_interval: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    claude_model: Optional[str] = None
