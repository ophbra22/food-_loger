import httpx
import pytest

from foodlogger.reminder_delivery import ExpoSender


@pytest.mark.parametrize("status,result", [("ok", "accepted"), ("error", "DeviceNotRegistered")])
def test_expo_ticket_and_generic_payload(status, result):
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "data": {
                    "status": status,
                    "id": "mock-ticket",
                    "details": {"error": "DeviceNotRegistered"} if status == "error" else {},
                }
            },
        )

    sender = ExpoSender(httpx.Client(transport=httpx.MockTransport(handler)))
    assert sender({"to": "ExpoPushToken[fixture]", "ttl": 0}) == result
    assert len(seen) == 1


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(429),
        httpx.Response(200, json={"data": {"status": "error"}}),
        httpx.Response(200, json={}),
    ],
)
def test_errors_never_retry(response):
    seen = []

    def handler(r):
        seen.append(r)
        return response

    with pytest.raises((httpx.HTTPStatusError, ValueError, KeyError)):
        ExpoSender(httpx.Client(transport=httpx.MockTransport(handler)))({"ttl": 0})
    assert len(seen) == 1
