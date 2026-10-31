"""Optional local preview: uv run uvicorn scripts.demo.serve:app --port 8004."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(docs_url=None, redoc_url=None)
app.mount(
    "/",
    StaticFiles(directory=Path(__file__).resolve().parents[2] / "docs/demo", html=True),
    name="demo",
)
