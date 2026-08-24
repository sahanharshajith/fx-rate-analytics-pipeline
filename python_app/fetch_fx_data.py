import json, os
import requests
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

FRANKFURTER_URL = os.getenv("FRANKFURTER_URL")
BASE_CURRENCY = os.getenv("BASE_CURRENCY")
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "bronze"

def fetch_rate():
    """Call Frankfurter API and return the raw JSON response"""
    response = requests.get(FRANKFURTER_URL, params={"base": BASE_CURRENCY}, timeout=10)
    response.raise_for_status()  # raises an exception on HTTP errors
    return response.json()

def save_to_json(data: dict) -> Path:
    """Save the raw response, untouched, as a timestamped JSON file — this IS the Bronze layer"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    file_path = DATA_DIR / f"frankfurter_{timestamp}.json"
    with open(file_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Saved raw response to {file_path}")
    return file_path

if __name__ == "__main__":
    raw_data = fetch_rate()
    save_to_json(raw_data)

