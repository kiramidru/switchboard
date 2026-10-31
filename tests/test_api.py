import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.config import Settings, get_settings
from backend.examples import EXAMPLES, get_demo
from backend.main import app
from backend.provider import AnalysisUnavailable


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None, openai_api_key="")
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def enable_ai():
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None, openai_api_key="test-key")


def image_data(format="PNG"):
    data = io.BytesIO()
    Image.new("RGB", (100, 100), "white").save(data, format=format)
    return data.getvalue()


def test_health_does_not_expose_key(client):
    enable_ai()
    response = client.get("/api/health")
    assert response.json()["ai_configured"] is True
    assert "test-key" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_examples_are_available(client):
    response = client.get("/api/examples")
    assert response.status_code == 200
    assert len(response.json()) == 3
    assert all("Fictional notice" in item["text"] for item in response.json())


@pytest.mark.parametrize("example", EXAMPLES, ids=lambda item: item.id)
def test_each_demo_has_real_evidence(client, example):
    response = client.post("/api/analyze", data={"example_id": example.id})
    assert response.status_code == 200
    result = response.json()
    assert result["mode"] == "demo"
    assert len(result["actions"]) == 3
    for action in result["actions"]:
        evidence = action["evidence"]
        assert example.text[evidence["start"]:evidence["end"]] == evidence["quote"]
        assert action["due_date"] is not None
        assert action["deadline_evidence"] is not None
    assert not any("omitted" in warning for warning in result["warnings"])


def test_custom_notice_never_gets_canned_analysis(client):
    response = client.post("/api/analyze", data={"text": "Please call your school."})
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


@pytest.mark.parametrize("data", [
    {}, {"text": "   "}, {"text": "Some text", "example_id": "school-trip"},
    {"text": "Some text", "use_demo": "true"},
])
def test_invalid_input_combinations(client, data):
    assert client.post("/api/analyze", data=data).status_code == 422


def test_unknown_example(client):
    assert client.post("/api/analyze", data={"example_id": "unknown"}).status_code == 404


def test_long_text(client):
    assert client.post("/api/analyze", data={"text": "x" * 20001}).status_code == 413


def test_explicit_demo_skips_live_provider(client, monkeypatch):
    enable_ai()

    async def unexpected(*args, **kwargs):
        pytest.fail("A forced demo should not call AI")

    monkeypatch.setattr("backend.main.extract_notice", unexpected)
    response = client.post("/api/analyze", data={"example_id": "school-trip", "use_demo": "true"})
    assert response.json()["mode"] == "demo"


def test_live_text_keeps_original_not_ai_rewrite(client, monkeypatch):
    enable_ai()

    async def fake(*args, **kwargs):
        assert kwargs["text"] == "Original notice, not rewritten."
        return get_demo("school-trip")

    monkeypatch.setattr("backend.main.extract_notice", fake)
    response = client.post("/api/analyze", data={"text": "Original notice, not rewritten."})
    result = response.json()
    assert result["mode"] == "live"
    assert result["source_text"] == "Original notice, not rewritten."
    assert result["actions"] == []
    assert any("omitted" in warning for warning in result["warnings"])


def test_failure_falls_back_only_for_example(client, monkeypatch):
    enable_ai()

    async def fail(*args, **kwargs):
        raise AnalysisUnavailable("Try again later.")

    monkeypatch.setattr("backend.main.extract_notice", fail)
    example = client.post("/api/analyze", data={"example_id": "school-trip"})
    assert example.json()["mode"] == "demo"
    assert "unavailable" in example.json()["mode_reason"]
    custom = client.post("/api/analyze", data={"text": "A private custom notice."})
    assert custom.status_code == 502
    assert custom.json()["detail"] == "Try again later."


@pytest.mark.parametrize("name,content,content_type,status", [
    ("bad.png", b"not an image", "image/png", 422),
    ("vector.svg", b"<svg></svg>", "image/svg+xml", 415),
    ("disguised.png", image_data("GIF"), "image/png", 422),
    ("huge.png", b"a" * (8 * 1024 * 1024 + 1), "image/png", 413),
])
def test_bad_uploads(client, name, content, content_type, status):
    assert client.post("/api/analyze", files={"image": (name, content, content_type)}).status_code == status


def test_live_image_transcript_has_review_warning(client, monkeypatch):
    enable_ai()

    async def fake(*args, **kwargs):
        assert kwargs["image"].startswith(b"\xff\xd8")  # normalized JPEG
        assert kwargs["text"] is None
        return get_demo("school-trip")

    monkeypatch.setattr("backend.main.extract_notice", fake)
    response = client.post("/api/analyze", files={"image": ("notice.png", image_data(), "image/png")})
    assert response.status_code == 200
    result = response.json()
    assert result["source_type"] == "image"
    assert "transcribed" in result["warnings"][0]
    assert result["mode"] == "live"
