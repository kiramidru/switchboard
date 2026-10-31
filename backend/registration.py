"""Independent fictional workshop service. No Switchboard-specific input channel."""

import re
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/api/practice", tags=["Practice website"])


class Registration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(max_length=100)
    email: str = Field(max_length=200)
    session: str = Field(max_length=40)
    experience: str = Field(max_length=30)
    access_notes: str = Field(default="", max_length=500)
    newsletter: bool = False
    agreement: bool = False


@router.post("/registrations")
async def register(data: Registration):
    errors = {}
    if len(data.full_name.strip()) < 2:
        errors["full_name"] = "Enter at least two characters for your name."
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", data.email.strip()):
        errors["email"] = "Enter an email address with a domain, such as alex@example.com."
    if data.session not in {"repair", "sewing", "laser"}:
        errors["session"] = "Choose a workshop."
    elif data.session == "laser":
        errors["session"] = "The laser-cutting workshop is now full. Choose sewing or repair instead."
    if data.experience not in {"first-time", "returning"}:
        errors["experience"] = "Choose your experience level."
    if not data.agreement:
        errors["agreement"] = "Confirm that you understand this is a fictional practice booking."
    if errors:
        raise HTTPException(422, detail={"message": "Please check the highlighted fields.", "fields": errors})
    return {
        "reference": "CG-" + uuid4().hex[:8].upper(),
        "message": "Practice registration received. No real booking or email has been created.",
        "session": data.session,
    }
