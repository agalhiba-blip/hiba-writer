from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    subtitle = Column(String(255), default="")
    author = Column(String(255), default="")
    genre = Column(String(100), default="")
    synopsis = Column(Text, default="")
    cover_color = Column(String(7), default="#727B57")
    word_count = Column(Integer, default=0)
    word_goal = Column(Integer, default=0)          # Objectif de mots total
    tense = Column(String(50), default="passé")     # passé / présent
    pov = Column(String(100), default="")           # 1ère personne, 3ème...
    series_name = Column(String(255), default="")   # Nom de la série
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    chapters = relationship("Chapter", back_populates="project", cascade="all, delete-orphan")
    characters = relationship("Character", back_populates="project", cascade="all, delete-orphan")
    locations = relationship("Location", back_populates="project", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="project", cascade="all, delete-orphan")
    ai_history = relationship("AIHistory", back_populates="project", cascade="all, delete-orphan")


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, default="")
    order_index = Column(Integer, default=0)
    word_count = Column(Integer, default=0)
    word_goal = Column(Integer, default=0)          # Objectif de mots du chapitre
    status = Column(String(50), default="brouillon")
    pov = Column(String(255), default="")           # Point de vue du chapitre
    summary = Column(Text, default="")
    notes = Column(Text, default="")
    beats = Column(Text, default="")                # Scene beats (JSON string)
    archived = Column(Boolean, default=False)       # Archive (masqué mais non supprimé)
    subtitle = Column(String(255), default="")      # Sous-titre / annotation temporelle
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="chapters")
    ai_history = relationship("AIHistory", back_populates="chapter", cascade="all, delete-orphan")


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(100), default="")
    age = Column(String(50), default="")
    description = Column(Text, default="")
    personality = Column(Text, default="")
    backstory = Column(Text, default="")
    goals = Column(Text, default="")
    notes = Column(Text, default="")
    relations = Column(Text, default="[]")          # JSON: [{name, type, description}]
    aliases = Column(Text, default="")              # Surnoms / alias séparés par virgule
    tags = Column(Text, default="")                 # Tags séparés par virgule
    image_path = Column(String(500), default="")
    color_tag = Column(String(7), default="#727B57")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="characters")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(100), default="")
    description = Column(Text, default="")
    atmosphere = Column(Text, default="")
    history = Column(Text, default="")
    notes = Column(Text, default="")
    tags = Column(Text, default="")
    image_path = Column(String(500), default="")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="locations")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, default="")
    category = Column(String(100), default="général")
    pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="notes")


class AIHistory(Base):
    __tablename__ = "ai_history"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    action_type = Column(String(50), nullable=False)
    input_text = Column(Text, default="")
    output_text = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())

    project = relationship("Project", back_populates="ai_history")
    chapter = relationship("Chapter", back_populates="ai_history")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, default="")
