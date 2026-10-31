from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ExtractionAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str
    detail: str
    quote: str
    due_date: str | None
    deadline_quote: str | None


class ExtractionDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    quote: str


class Extraction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str
    summary: str
    source_text: str
    actions: list[ExtractionAction]
    documents: list[ExtractionDocument]
    uncertainties: list[str]


class Evidence(BaseModel):
    quote: str
    start: int
    end: int


class Action(BaseModel):
    id: str
    title: str
    detail: str
    evidence: Evidence
    due_date: date | None = None
    deadline_evidence: Evidence | None = None


class RequiredDocument(BaseModel):
    name: str
    evidence: Evidence


class Analysis(BaseModel):
    id: str
    title: str
    summary: str
    source_text: str
    actions: list[Action]
    documents: list[RequiredDocument]
    warnings: list[str]
    mode: Literal["live", "demo"]
    mode_reason: str
    source_type: Literal["text", "image", "example"]
    created_at: datetime


class Example(BaseModel):
    id: str
    label: str
    category: str
    description: str
    text: str


class Health(BaseModel):
    status: str = "ok"
    ai_configured: bool
    model: str
    max_image_bytes: int = Field(default=8 * 1024 * 1024)
