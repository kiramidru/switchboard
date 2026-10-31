import asyncio
import json

import httpx
import pytest

from backend.config import Settings
from backend.examples import get_demo
from backend.provider import AnalysisUnavailable, extract_notice


@pytest.mark.parametrize("kind", ["valid", "refusal", "incomplete", "malformed", "unauthorized"])
def test_provider_contract(monkeypatch, kind):
    original_client = httpx.AsyncClient

    def handle(request):
        payload = json.loads(request.content)
        assert request.url.path == "/v1/responses"
        assert request.headers["authorization"] == "Bearer test-key"
        assert payload["store"] is False
        assert payload["text"]["format"]["strict"] is True
        assert payload["text"]["format"]["schema"]["additionalProperties"] is False
        if kind == "unauthorized":
            return httpx.Response(401, json={"error": {"message": "Never expose raw provider errors"}})
        content = [{"type": "output_text", "text": get_demo("school-trip").model_dump_json()}]
        if kind == "refusal":
            content = [{"type": "refusal", "refusal": "Cannot comply"}]
        elif kind == "malformed":
            content = [{"type": "output_text", "text": "not valid JSON"}]
        return httpx.Response(200, json={
            "status": "incomplete" if kind == "incomplete" else "completed",
            "output": [{"type": "message", "content": content}],
        })

    monkeypatch.setattr("backend.provider.httpx.AsyncClient", lambda **kwargs: original_client(
        transport=httpx.MockTransport(handle), **kwargs,
    ))
    settings = Settings(_env_file=None, openai_api_key="test-key")
    if kind == "valid":
        result = asyncio.run(extract_notice(settings, text="A notice"))
        assert result.title == get_demo("school-trip").title
    else:
        with pytest.raises(AnalysisUnavailable) as exc:
            asyncio.run(extract_notice(settings, text="A notice"))
        assert "Never expose" not in str(exc.value)
