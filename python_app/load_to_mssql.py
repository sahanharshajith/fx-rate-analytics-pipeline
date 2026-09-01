import json
import os
from pathlib import Path
from dotenv import load_dotenv
import pyodbc

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "bronze"

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    f"SERVER={os.getenv('MSSQL_SERVER', 'localhost')},{os.getenv('MSSQL_PORT', '1433')};"
    f"DATABASE={os.getenv('MSSQL_DATABASE', 'FxAnalytics')};"
    f"UID={os.getenv('MSSQL_USER', 'sa')};"
    f"PWD={os.environ['MSSQL_SA_PASSWORD']};"
    f"Encrypt={os.getenv('MSSQL_ENCRYPT', 'yes')};"
    f"TrustServerCertificate={os.getenv('MSSQL_TRUST_CERT', 'yes')};"
)


def get_latest_files() -> list[Path]:
    """Get the latest JSON file for each data source provider (frankfurter, open_er)."""
    providers = ["frankfurter", "open_er"]
    latest_files = []
    for provider in providers:
        files = sorted(DATA_DIR.glob(f"{provider}_*.json"))
        if files:
            latest_files.append(files[-1])
    if not latest_files:
        raise FileNotFoundError("No bronze JSON files found in data/bronze. Run fetch_fx_data.py first.")
    return latest_files


def detect_source_api(data: dict, filename: str) -> str:
    """Detect which provider produced this payload."""
    if "base" in data and "date" in data:
        return "frankfurter"
    elif "base_code" in data:
        return "open_er"
    elif filename.startswith("frankfurter"):
        return "frankfurter"
    elif filename.startswith("open_er"):
        return "open_er"
    return "unknown"


def load_bronze_raw(conn, source_api: str, raw_json_text: str):
    """Store the raw unmodified JSON into bronze.raw_api_responses"""
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO bronze.raw_api_responses (source_api, raw_json) VALUES (?, ?)",
        source_api, raw_json_text
    )
    conn.commit()
    print(f"Loaded raw {source_api} response into bronze.raw_api_responses")


def main():
    latest_files = get_latest_files()
    conn = pyodbc.connect(CONN_STR)
    try:
        for file_path in latest_files:
            print(f"Processing bronze file: {file_path.name}")
            raw_text = file_path.read_text(encoding="utf-8")
            data = json.loads(raw_text)
            source_api = detect_source_api(data, file_path.name)

            if source_api == "unknown":
                print(f"Skipping unrecognized schema in {file_path.name}")
                continue

            load_bronze_raw(conn, source_api, raw_text)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
