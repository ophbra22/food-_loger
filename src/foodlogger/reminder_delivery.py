"""Explicit one-shot worker; no scheduler starts inside the API process.

Production invocation requires two flags and a separate operational review. Unit
and integration tests inject an HTTPX MockTransport. Never logs tokens or payloads.
"""

import json
import os

import httpx

from foodlogger.database import Database
from foodlogger.habits import Habits
from foodlogger.security import Settings


class ExpoSender:
    def __init__(self, client):
        self.client = client

    def __call__(self, message):
        response = self.client.post("https://exp.host/--/api/v2/push/send", json=message)
        response.raise_for_status()
        ticket = response.json()["data"]
        if ticket.get("details", {}).get("error") == "DeviceNotRegistered":
            return "DeviceNotRegistered"
        if ticket.get("status") != "ok" or not isinstance(ticket.get("id"), str):
            raise ValueError("Push not accepted.")
        # Acceptance is not evidence of delivery. No uncertain automatic retry.
        return "accepted"


def main():
    settings = Settings.from_environment()
    if not settings.habits_enabled or os.getenv("FOODLOGGER_PUSH_DELIVERY_ENABLED") != "1":
        print("Reminder delivery disabled.")
        return
    database = Database(os.environ.get("DATABASE_URL") or os.environ["FOODLOGGER_DB"])
    headers = {}
    if os.getenv("FOODLOGGER_EXPO_ACCESS_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["FOODLOGGER_EXPO_ACCESS_TOKEN"]
    with httpx.Client(timeout=5, headers=headers, follow_redirects=False) as client:
        print(json.dumps(Habits(database).tick(ExpoSender(client), enabled=True)))


if __name__ == "__main__":
    main()
