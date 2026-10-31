import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


def valid(**overrides):
    return dict(full_name="Alex Kim", email="alex@example.com", session="repair",
                experience="first-time", agreement=True, **overrides)


def test_practice_registration_is_a_real_request_with_receipt(client):
    response = client.post("/api/practice/registrations", json=valid())
    assert response.status_code == 200
    assert response.json()["reference"].startswith("CG-")
    assert "No real booking" in response.json()["message"]


def test_server_rejects_full_workshop_and_accepts_correction(client):
    data = valid()
    data["session"] = "laser"
    response = client.post("/api/practice/registrations", json=data)
    assert response.status_code == 422
    assert "full" in response.json()["detail"]["fields"]["session"]
    data["session"] = "sewing"
    assert client.post("/api/practice/registrations", json=data).status_code == 200


def test_field_errors_have_names_the_website_can_associate(client):
    data = dict(full_name="A", email="not-an-email", session="", experience="", agreement=False)
    response = client.post("/api/practice/registrations", json=data)
    assert response.status_code == 422
    assert set(response.json()["detail"]["fields"]) == {"full_name", "email", "session", "experience", "agreement"}


def test_oversized_and_extra_data_rejected(client):
    data = valid()
    data["full_name"] = "x" * 101
    assert client.post("/api/practice/registrations", json=data).status_code == 422
    data = valid()
    data["unknown"] = "not accepted"
    assert client.post("/api/practice/registrations", json=data).status_code == 422
