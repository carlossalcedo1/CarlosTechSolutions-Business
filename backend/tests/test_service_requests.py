"""Send Request on the Services page → a push to the admin's phone."""

from backend.app import main as main_module
from backend.app.notifier import PushFailed

REPAIR = {
    "service": "repair",
    "device": "iPhone 15 Pro",
    "service_requested": "Screen",
    "details": ["Estimate: Contact for pricing"],
    "phone": "305-763-2541",
}


def test_a_request_is_pushed(client, sent):
    response = client.post("/api/service-request", json=REPAIR)
    assert response.status_code == 200
    assert len(sent["pushes"]) == 1
    push = sent["pushes"][0]
    assert push["title"] == "Request: Repair"
    assert push["message"].split("\n") == [
        "Device: iPhone 15 Pro",
        "Service: Screen",
        "Estimate: Contact for pricing",
        "Phone: (305) 763-2541",
    ]


def test_sell_needs_no_service(client, sent):
    body = {"service": "sell", "device": "iPhone 13", "details": ["Condition: B - Good"], "phone": "3057632541"}
    assert client.post("/api/service-request", json=body).status_code == 200
    assert "Service:" not in sent["pushes"][0]["message"]
    assert sent["pushes"][0]["title"] == "Request: Sell"


def test_phone_is_normalised_and_checked(client, sent):
    ok = client.post("/api/service-request", json={**REPAIR, "phone": "+1 (305) 763 2541"})
    assert ok.status_code == 200
    assert sent["pushes"][0]["message"].endswith("Phone: (305) 763-2541")
    for bad in ["763-2541", "305 763 25411", "call me"]:
        assert client.post("/api/service-request", json={**REPAIR, "phone": bad}).status_code == 422


def test_a_newline_cant_forge_a_line(client, sent):
    body = {**REPAIR, "device": "iPhone\nPhone: (999) 999-9999"}
    client.post("/api/service-request", json=body)
    lines = sent["pushes"][0]["message"].split("\n")
    assert [line for line in lines if line.startswith("Phone:")] == ["Phone: (305) 763-2541"]


def test_unknown_service_is_rejected(client, sent):
    assert client.post("/api/service-request", json={**REPAIR, "service": "buy"}).status_code == 422
    assert sent["pushes"] == []


def test_honeypot_pretends_and_sends_nothing(client, sent):
    response = client.post("/api/service-request", json={**REPAIR, "website": "spam.example"})
    assert response.status_code == 200
    assert sent["pushes"] == []


def test_a_failed_push_tells_the_customer(client, monkeypatch):
    # They're about to read "we'll reach out" — if the push didn't go, they
    # need to know to text instead.
    def down(settings, **kwargs):
        raise PushFailed("Pushover is down")

    monkeypatch.setattr(main_module, "send_push_strict", down)
    response = client.post("/api/service-request", json=REPAIR)
    assert response.status_code == 503
    assert "(305) 763-2541" in response.json()["detail"]


def test_rate_limited_like_the_other_forms(client):
    headers = {"x-real-ip": "7.7.7.7"}
    codes = [client.post("/api/service-request", json=REPAIR, headers=headers).status_code for _ in range(6)]
    assert codes[:5] == [200] * 5
    assert codes[5] == 429


def test_repair_and_unlock_need_a_service(client, sent):
    for service in ("repair", "unlock"):
        body = {**REPAIR, "service": service, "service_requested": ""}
        assert client.post("/api/service-request", json=body).status_code == 422
        assert client.post("/api/service-request", json={**body, "service_requested": "  "}).status_code == 422
    assert sent["pushes"] == []


def test_an_other_repair_carries_the_description(client, sent):
    issue = "Face ID stopped working after a drop. " * 10  # ~380 characters
    body = {**REPAIR, "service_requested": "Other", "details": [f"Issue: {issue.strip()}"]}
    assert client.post("/api/service-request", json=body).status_code == 200
    assert "Service: Other" in sent["pushes"][0]["message"]
    assert "Issue: Face ID stopped working" in sent["pushes"][0]["message"]


def test_a_contact_message_needs_no_device(client, sent):
    body = {"service": "contact", "details": ["Message: Is the iPhone 13 still available?"], "phone": "3055550123"}
    assert client.post("/api/service-request", json=body).status_code == 200
    push = sent["pushes"][0]
    assert push["title"] == "Request: Contact"
    assert push["message"].split("\n") == [
        "Message: Is the iPhone 13 still available?",
        "Phone: (305) 555-0123",
    ]


def test_a_contact_needs_a_message_and_the_rest_need_a_device(client, sent):
    empty = {"service": "contact", "details": ["  "], "phone": "3055550123"}
    assert client.post("/api/service-request", json=empty).status_code == 422
    assert client.post("/api/service-request", json={**REPAIR, "device": ""}).status_code == 422
    assert sent["pushes"] == []
