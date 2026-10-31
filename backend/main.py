from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from .config import Settings, get_settings
from .examples import EXAMPLES, get_demo, get_example
from .grounding import ground_extraction
from .images import ALLOWED_TYPES, MAX_IMAGE_BYTES, prepare_image
from .models import Analysis, Example, Health
from .provider import AnalysisUnavailable, extract_notice
from .registration import router as registration_router

app = FastAPI(title="Switchboard practice site & Notice → Action", version="0.2.0")
app.include_router(registration_router)


@app.middleware("http")
async def privacy_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/api/health", response_model=Health)
async def health(settings: Annotated[Settings, Depends(get_settings)]):
    return Health(ai_configured=settings.ai_configured, model=settings.openai_model)


@app.get("/api/examples", response_model=list[Example])
async def examples():
    return EXAMPLES


@app.post("/api/analyze", response_model=Analysis)
async def analyze(
    settings: Annotated[Settings, Depends(get_settings)],
    text: Annotated[str | None, Form()] = None,
    example_id: Annotated[str | None, Form()] = None,
    image: Annotated[UploadFile | None, File()] = None,
    use_demo: Annotated[bool, Form()] = False,
):
    text = text.strip() if text else None
    if sum([bool(text), bool(example_id), image is not None]) != 1:
        raise HTTPException(422, "Provide exactly one notice: pasted text, a photo, or an example.")
    if use_demo and not example_id:
        raise HTTPException(422, "Demo mode works only with the provided fictional examples.")
    source_type = "image" if image else "text"
    image_bytes = None
    if example_id:
        example = get_example(example_id)
        if not example:
            raise HTTPException(404, "Example not found. Choose one of the available examples.")
        text = example.text
        source_type = "example"
    if text and len(text) > 20000:
        raise HTTPException(413, "Keep your notice under 20,000 characters.")
    if image:
        try:
            if image.content_type not in ALLOWED_TYPES:
                raise HTTPException(415, "Use a JPEG, PNG, or WebP image.")
            data = await image.read(MAX_IMAGE_BYTES + 1)
            if len(data) > MAX_IMAGE_BYTES:
                raise HTTPException(413, "Keep your photo under 8 MB.")
            try:
                image_bytes = await run_in_threadpool(prepare_image, data)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
        finally:
            await image.close()
    mode = "live"
    reason = "Analyzed by AI. Quotes matched to the notice; review the interpretation before acting."
    if example_id and (use_demo or not settings.ai_configured):
        extraction = get_demo(example_id)
        mode = "demo"
        reason = "Fictional example with prewritten results. No live AI analysis was used."
    elif not settings.ai_configured:
        raise HTTPException(503, "Live AI is not configured. Add OPENAI_API_KEY to the server .env file "
                            "and restart, or choose a demo example.")
    else:
        try:
            extraction = await extract_notice(settings, text=text, image=image_bytes)
        except AnalysisUnavailable as exc:
            if not example_id:
                raise HTTPException(502, str(exc)) from exc
            extraction = get_demo(example_id)
            mode = "demo"
            reason = "Live AI was unavailable. Showing prewritten results for this fictional example instead."
    source = extraction.source_text if image_bytes else (text or "")
    return ground_extraction(extraction, source=source, mode=mode, mode_reason=reason,
                             source_type=source_type)


# A built frontend is served by the same origin. During development Vite proxies /api.
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
    if (DIST / "fixtures").is_dir():
        app.mount("/fixtures", StaticFiles(directory=DIST / "fixtures", html=True), name="fixtures")
    if (DIST / "switchboard-extension.zip").is_file():
        @app.get("/switchboard-extension.zip", include_in_schema=False)
        async def extension_download():
            return FileResponse(DIST / "switchboard-extension.zip", filename="switchboard-extension.zip")

    @app.get("/", include_in_schema=False)
    @app.get("/notice", include_in_schema=False)
    async def index():
        return FileResponse(DIST / "index.html")
