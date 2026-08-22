"""Firebase Admin SDK configuration for FastAPI backend.

Supports three credential strategies (checked in order):
  1. FIREBASE_SERVICE_ACCOUNT env var — JSON string of the service account key.
  2. FIREBASE_SERVICE_ACCOUNT_FILE env var — path to the service-account JSON file.
  3. Application Default Credentials (ADC) — useful in GCP / Cloud Run.

Environment variables required:
  FIREBASE_PROJECT_ID — Firebase project ID
  FIREBASE_CLIENT_EMAIL — service account email
  FIREBASE_PRIVATE_KEY — service account private key (PEM, with escaped newlines)
"""

import json
import os
from functools import lru_cache
from typing import Optional

import firebase_admin
from firebase_admin import credentials


@lru_cache(maxsize=1)
def _get_firebase_creds():
    """Resolve Firebase credentials from the environment.

    Returns None when no credentials are configured, allowing the app to
    continue with a dev-mode auth fallback.
    """

    # Strategy 1: Inline JSON service account key
    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if service_account_json:
        info = json.loads(service_account_json)
        return credentials.Certificate(info)

    # Strategy 2: Path to service-account file
    sa_file = os.environ.get("FIREBASE_SERVICE_ACCOUNT_FILE")
    if sa_file and os.path.isfile(sa_file):
        return credentials.Certificate(sa_file)

    # Strategy 3: Individual env vars (project_id, client_email, private_key)
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")
    if project_id and client_email and private_key:
        # Normalize newlines: the private key may contain literal "\\n" strings
        # instead of actual newline characters (common when set via .env files).
        normalized_key = private_key.replace("\\n", "\n")
        info = {
            "type": "service_account",
            "project_id": project_id,
            "client_email": client_email,
            "private_key": normalized_key,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        return credentials.Certificate(info)

    # Strategy 4: Application Default Credentials (GCP environments)
    try:
        return credentials.ApplicationDefault()
    except Exception:
        pass

    # No credentials found — return None so the app can fall back to dev auth
    print("[WARN] Firebase Admin credentials not found. Running in dev mode — "
          "API token verification will use JWT decode fallback.")
    return None


def get_firebase_app() -> Optional[firebase_admin.App]:
    """Return the singleton Firebase Admin app, initializing if needed.

    Returns None when Firebase credentials are not configured.
    """
    cred = _get_firebase_creds()
    if cred is None:
        return None
    if not firebase_admin._apps:
        app = firebase_admin.initialize_app(cred)
        return app
    return firebase_admin.get_app()
