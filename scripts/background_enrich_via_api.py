import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from argparse import ArgumentParser
from typing import Any, Dict, Optional, Tuple, Union


@dataclass(frozen=True)
class Config:
    base_url: str
    basic_user: str
    basic_pass: str


# Default to LOCAL entrypoint for stability (tunnel can be flaky / transient 502).
# This does NOT restart anything and will not change the public link.
DEFAULT_BASE_URL = "http://127.0.0.1:8080"
Nginx_BASIC_USER = "Abu-Abbad-Psyjo-App-Test"
Nginx_BASIC_PASS = "Aboshdaif"


def iso_in(days: int, hour: int, minute: int = 0) -> str:
    dt = datetime.now(timezone.utc) + timedelta(days=days)
    dt = dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return dt.isoformat().replace("+00:00", "Z")



def create_slot_with_fallback(
    cfg: Config,
    token: str,
    candidates: list[tuple[str, str]],
    appt_type: str,
    price: int,
) -> str:
    last_error: Optional[Exception] = None
    for start, end in candidates:
        try:
            return create_slot(cfg, token, start, end, appt_type, price)
        except Exception as e:
            last_error = e
            # brief pause to ride out transient proxy/upstream hiccups
            time.sleep(1)
            continue
    raise RuntimeError(f"create_slot_with_fallback failed: {str(last_error)[:200] if last_error else 'unknown'}")

def make_basic_header(user: str, password: str) -> Dict[str, str]:
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


JsonType = Union[Dict[str, Any], list, str, int, float, bool, None]


def http_json(
    cfg: Config,
    method: str,
    path: str,
    body: Optional[JsonType] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = 30,
) -> Tuple[int, Union[JsonType, str]]:
    url = cfg.base_url.rstrip("/") + path

    transient_statuses = {502, 503, 504}
    max_attempts = 6
    base_sleep_s = 0.7

    last: Optional[Tuple[int, Union[JsonType, str]]] = None

    for attempt in range(1, max_attempts + 1):
        hdrs: Dict[str, str] = {"Accept": "application/json", **make_basic_header(cfg.basic_user, cfg.basic_pass)}
        if headers:
            hdrs.update(headers)

        data: Optional[bytes] = None
        if body is not None:
            hdrs["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(url, data=data, method=method.upper(), headers=hdrs)

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                text = raw.decode("utf-8", errors="replace")
                ctype = resp.headers.get("Content-Type", "")
                if "application/json" in ctype:
                    last = (resp.status, json.loads(text) if text else None)
                else:
                    last = (resp.status, text)
        except urllib.error.HTTPError as e:
            raw = e.read() if hasattr(e, "read") else b""
            text = raw.decode("utf-8", errors="replace")
            try:
                last = (e.code, json.loads(text))
            except Exception:
                last = (e.code, text)
        except urllib.error.URLError as e:
            last = (0, f"URLError: {e}")

        if last is None:
            last = (0, "unknown error")

        status = last[0]
        should_retry = status in transient_statuses or status == 0
        if not should_retry:
            return last

        if attempt < max_attempts:
            time.sleep(base_sleep_s * (2 ** (attempt - 1)))

    return last


def status_root(cfg: Config) -> int:
    st, _ = http_json(cfg, "GET", "/")
    return st


def status_health(cfg: Config) -> int:
    st, _ = http_json(cfg, "GET", "/api/health")
    return st


def wait_backend(cfg: Config, timeout_s: int = 30) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        st = status_health(cfg)
        if st == 200:
            return True
        time.sleep(1)
    return False


def register_user(cfg: Config, email: str, password: str, role: str, first: str, last: str) -> int:
    st, _ = http_json(
        cfg,
        "POST",
        "/api/auth/register",
        {
            "email": email,
            "password": password,
            "role": role,
            "firstName": first,
            "lastName": last,
            "gdprConsent": True,
        },
    )
    # 201 = created, 409 = already exists (idempotent)
    if st in (201, 409):
        return st
    raise RuntimeError(f"register failed for {email}: status={st}")


def login_user(cfg: Config, email: str, password: str) -> Tuple[str, str, str]:
    st, resp = http_json(cfg, "POST", "/api/auth/login", {"email": email, "password": password})
    if st != 200 or not isinstance(resp, dict):
        raise RuntimeError(f"login failed for {email}: status={st} resp={str(resp)[:300]}")

    token = resp.get("token")
    user = resp.get("user")
    if not token or not isinstance(user, dict) or not user.get("id"):
        raise RuntimeError(f"unexpected login response for {email}: {resp}")

    return str(token), str(user["id"]), str(user.get("role") or "")


def auth_headers(token: str) -> Dict[str, str]:
    return {"X-Access-Token": token}


def create_slot(cfg: Config, token: str, start: str, end: str, appt_type: str, price: int) -> str:
    st, resp = http_json(
        cfg,
        "POST",
        "/api/appointments",
        {
            "startTime": start,
            "endTime": end,
            "appointmentType": appt_type,
            "price": price,
        },
        headers=auth_headers(token),
    )
    if st == 409:
        # Slot overlap/conflict – treat as idempotent and skip.
        raise RuntimeError(f"create_slot conflict (409) start={start} end={end}")
    # 201 = created
    if st != 201 or not isinstance(resp, dict) or "appointmentId" not in resp:
        raise RuntimeError(f"create_slot failed: status={st} resp={str(resp)[:300]}")
    return str(resp["appointmentId"])


def book_slot(cfg: Config, token: str, appointment_id: str, patient_notes: str) -> None:
    st, resp = http_json(
        cfg,
        "POST",
        f"/api/appointments/{appointment_id}/book",
        {"patientNotes": patient_notes},
        headers=auth_headers(token),
    )
    if st != 200:
        raise RuntimeError(f"book_slot failed: status={st} resp={str(resp)[:300]}")


def patch_apt(cfg: Config, token: str, appointment_id: str, status: str, therapist_notes: str) -> None:
    st, resp = http_json(
        cfg,
        "PATCH",
        f"/api/appointments/{appointment_id}",
        {"status": status, "therapistNotes": therapist_notes},
        headers=auth_headers(token),
    )
    if st != 200:
        raise RuntimeError(f"patch_apt failed: status={st} resp={str(resp)[:300]}")


def delete_apt(cfg: Config, token: str, appointment_id: str) -> None:
    st, resp = http_json(cfg, "DELETE", f"/api/appointments/{appointment_id}", headers=auth_headers(token))
    if st not in (200, 204):
        raise RuntimeError(f"delete_apt failed: status={st} resp={str(resp)[:300]}")


def send_msg(cfg: Config, token: str, receiver_id: str, appointment_id: str, content: str) -> None:
    st, resp = http_json(
        cfg,
        "POST",
        "/api/messages",
        {"receiverId": receiver_id, "appointmentId": appointment_id, "content": content},
        headers=auth_headers(token),
    )
    # 201 = created
    if st != 201:
        raise RuntimeError(f"send_msg failed: status={st} resp={str(resp)[:300]}")


def create_template(cfg: Config, token: str) -> str:
    body = {
        "title": "Schlaf & Stress – Kurzfragebogen",
        "description": "Kurzer Check-in vor dem Termin",
        "category": "Intake",
        "formSchema": {
            "fields": [
                {
                    "id": "sleep_quality",
                    "type": "radio",
                    "label": "Schlafqualität (letzte 7 Tage)",
                    "required": False,
                    "options": ["sehr gut", "gut", "mittel", "schlecht", "sehr schlecht"],
                },
                {"id": "stress_level", "type": "number", "label": "Stresslevel (0-10)", "required": False},
                {
                    "id": "main_goal",
                    "type": "textarea",
                    "label": "Wichtigstes Ziel bis zum nächsten Termin",
                    "required": False,
                },
            ]
        },
        "isTemplate": True,
    }
    st, resp = http_json(cfg, "POST", "/api/questionnaires/templates", body, headers=auth_headers(token))
    # 201 = created
    if st != 201 or not isinstance(resp, dict) or "id" not in resp:
        raise RuntimeError(f"create_template failed: status={st} resp={str(resp)[:300]}")
    return str(resp["id"])


def request_questionnaire(cfg: Config, token: str, template_id: str, patient_id: str, appointment_id: str) -> str:
    body = {
        "templateId": template_id,
        "patientId": patient_id,
        "appointmentId": appointment_id,
        "title": "Bitte vor dem Termin ausfüllen",
        "instructions": "Dauert ~2 Minuten. Hilft mir, mich vorzubereiten.",
        "priority": "normal",
    }
    st, resp = http_json(cfg, "POST", "/api/questionnaires/requests", body, headers=auth_headers(token))
    # 201 = created
    if st != 201 or not isinstance(resp, dict) or "id" not in resp:
        raise RuntimeError(f"request_questionnaire failed: status={st} resp={str(resp)[:300]}")
    return str(resp["id"])


def submit_response(cfg: Config, token: str, request_id: str) -> None:
    body = {
        "requestId": request_id,
        "status": "submitted",
        "responses": {
            "sleep_quality": {"answer": "mittel"},
            "stress_level": {"answer": 7},
            "main_goal": {"answer": "Besser einschlafen + weniger Grübeln am Abend"},
        },
    }
    st, resp = http_json(cfg, "POST", "/api/questionnaires/responses", body, headers=auth_headers(token))
    # 201 = created
    if st != 201:
        raise RuntimeError(f"submit_response failed: status={st} resp={str(resp)[:300]}")


def main() -> int:
    parser = ArgumentParser(description="Background API enrichment for the doctor demo (no restarts).")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("ENRICH_BASE_URL", DEFAULT_BASE_URL),
        help="Base URL (default: local doctor entrypoint). Example: http://127.0.0.1:8080",
    )
    parser.add_argument(
        "--basic-user",
        default=os.environ.get("ENRICH_BASIC_USER", Nginx_BASIC_USER),
        help="Nginx Basic Auth username",
    )
    parser.add_argument(
        "--basic-pass",
        default=os.environ.get("ENRICH_BASIC_PASS", Nginx_BASIC_PASS),
        help="Nginx Basic Auth password",
    )
    args = parser.parse_args()

    cfg = Config(base_url=str(args.base_url), basic_user=str(args.basic_user), basic_pass=str(args.basic_pass))

    if not wait_backend(cfg, timeout_s=45):
        print("WARN: backend not healthy via /api/health; aborting without changes")
        return 0

    before = status_root(cfg)
    print(f"TUNNEL_HTTP_BEFORE:{before}")

    extras = [
        ("musterarzt3@test.de", "ArztDemo3!2026", "therapist", "Dr.", "Sommer"),
        ("musterarzt4@test.de", "ArztDemo4!2026", "therapist", "Dr.", "Brandt"),
        ("musterpatient5@test.de", "PatientDemo5!2026", "patient", "Lea", "Koch"),
        ("musterpatient6@test.de", "PatientDemo6!2026", "patient", "Ben", "Wolf"),
    ]

    for email, pwd, role, first, last in extras:
        try:
            st = register_user(cfg, email, pwd, role, first, last)
            print(f"REGISTER:{email}:{st}")
        except Exception as e:
            print(f"REGISTER_WARN:{email}:{str(e)[:180]}")

    t1_token, t1_id, _ = login_user(cfg, "musterarzt1@test.de", "ArztDemo1!2026")
    t3_token, t3_id, _ = login_user(cfg, "musterarzt3@test.de", "ArztDemo3!2026")
    p1_token, p1_id, _ = login_user(cfg, "musterpatient1@test.de", "PatientDemo1!2026")
    p5_token, p5_id, _ = login_user(cfg, "musterpatient5@test.de", "PatientDemo5!2026")
    print(f"LOGIN_OK:T1:{t1_id}")
    print(f"LOGIN_OK:T3:{t3_id}")
    print(f"LOGIN_OK:P1:{p1_id}")
    print(f"LOGIN_OK:P5:{p5_id}")

    try:
        a_id = create_slot_with_fallback(
            cfg,
            t1_token,
            candidates=[
                (iso_in(3, 10, 0), iso_in(3, 11, 0)),
                (iso_in(3, 10, 15), iso_in(3, 11, 15)),
                (iso_in(3, 10, 30), iso_in(3, 11, 30)),
            ],
            appt_type="video",
            price=95,
        )
        book_slot(cfg, p1_token, a_id, "Ich möchte Schlaf, Stress und Konzentration besprechen.")
        patch_apt(cfg, t1_token, a_id, "booked", "Anamnese geplant. Bitte Schlafprotokoll mitbringen.")
        print(f"APPT_OK:A:{a_id}")
    except Exception as e:
        print(f"APPT_WARN:A:{str(e)[:200]}")
        a_id = ""

    try:
        b_id = create_slot(cfg, t3_token, iso_in(2, 14), iso_in(2, 15), "audio", 75)
        book_slot(cfg, p5_token, b_id, "Thema: Angst vor Präsentationen, Strategien erarbeiten.")
        try:
            delete_apt(cfg, p5_token, b_id)
            print(f"APPT_OK:B_DELETED:{b_id}")
        except Exception as e:
            print(f"APPT_WARN:B_DELETE_FAILED:{b_id}:{str(e)[:160]}")
    except Exception as e:
        print(f"APPT_WARN:B:{str(e)[:200]}")

    try:
        c_id = create_slot(cfg, t3_token, iso_in(-2, 9), iso_in(-2, 10), "video", 110)
        book_slot(cfg, p5_token, c_id, "Follow-up: Stimmungsschwankungen.")
        patch_apt(cfg, t3_token, c_id, "completed", "Follow-up durchgeführt. Übung: Atemtechnik + Journaling.")
        print(f"APPT_OK:C:{c_id}")
    except Exception as e:
        print(f"APPT_WARN:C:{str(e)[:200]}")

    if a_id:
        try:
            send_msg(cfg, p1_token, t1_id, a_id, "Hallo, soll ich etwas vorbereiten (Fragen/Notizen)?")
            send_msg(cfg, t1_token, p1_id, a_id, "Ja, bitte 3 Stichpunkte: Schlaf, Stress, Ziel für die nächsten 2 Wochen.")
            send_msg(cfg, p1_token, t1_id, a_id, "Okay, mache ich. Danke!")
            print("MSG_OK")
        except Exception as e:
            print(f"MSG_WARN:{str(e)[:200]}")

    if a_id:
        try:
            template_id = create_template(cfg, t1_token)
            req_id = request_questionnaire(cfg, t1_token, template_id, p1_id, a_id)
            submit_response(cfg, p1_token, req_id)
            print(f"Q_OK:TEMPLATE:{template_id}:REQUEST:{req_id}")
        except Exception as e:
            print(f"Q_WARN:{str(e)[:220]}")

    after = status_root(cfg)
    print(f"TUNNEL_HTTP_AFTER:{after}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"ERROR:{e}", file=sys.stderr)
        raise
