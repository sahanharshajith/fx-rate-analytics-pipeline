import json
import os
import requests
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv


load_dotenv()  # Load environment variables from .env file


FRANKFURTER_URL = os.getenv("FRANKFURTER_URL", "https://api.frankfurter.dev/v1/latest")
OPEN_ER_URL = os.getenv("OPEN_ER_URL", "https://open.er-api.com/v6/latest")
BASE_CURRENCY = os.getenv("BASE_CURRENCY", "USD")
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "bronze"


def save_to_json(data: dict, prefix: str) -> Path:
    """Save the raw response, untouched, as a timestamped JSON file — this IS the Bronze layer"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    file_path = DATA_DIR / f"{prefix}_{timestamp}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Saved raw {prefix} response to {file_path}")
    return file_path


def fetch_frankfurter():
    """Call Frankfurter API and return the raw JSON response"""
    response = requests.get(FRANKFURTER_URL, params={"base": BASE_CURRENCY}, timeout=10)
    response.raise_for_status()
    data = response.json()
    save_to_json(data, "frankfurter")
    return data


def fetch_open_er():
    """Call Open ER API (ExchangeRate-API) and return the raw JSON response"""
    url = f"{OPEN_ER_URL.rstrip('/')}/{BASE_CURRENCY}"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    data = response.json()
    save_to_json(data, "open_er")
    return data


def fetch_all():
    """Fetch from all supported FX data providers"""
    print(f"Fetching FX rates (Base: {BASE_CURRENCY})...")
    try:
        fetch_frankfurter()
    except Exception as e:
        print(f"Error fetching Frankfurter data: {e}")

    try:
        fetch_open_er()
    except Exception as e:
        print(f"Error fetching Open ER data: {e}")


if __name__ == "__main__":
    fetch_all()