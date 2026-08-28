import os
import json
from datetime import datetime
import pyodbc
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "bronze"

# ODBC connection string (supports Windows Authentication and SQL Authentication fallback)
if os.getenv("MSSQL_USER"):
    CONN_STR = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={os.getenv('MSSQL_SERVER', 'localhost,1433')};"
        f"DATABASE={os.getenv('MSSQL_DATABASE', 'FxAnalytics')};"
        f"UID={os.getenv('MSSQL_USER', 'sa')};"
        f"PWD={os.getenv('MSSQL_SA_PASSWORD')};"
        f"Encrypt={os.getenv('MSSQL_ENCRYPT', 'yes')};"
        f"TrustServerCertificate={os.getenv('MSSQL_TRUST_CERT', 'yes')};"
    )
else:
    CONN_STR = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={os.getenv('MSSQL_SERVER', 'localhost,1433')};"
        f"DATABASE={os.getenv('MSSQL_DATABASE', 'FxAnalytics')};"
        "Trusted_Connection=yes;"
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


def parse_record(data: dict, filename: str) -> tuple[str, list[tuple]]:
    """
    Detect schema, extract standardized rates list of tuples:
    (base_currency, target_currency, exchange_rate, rate_date, source_api)
    """
    if "base" in data and "date" in data:
        source_api = "frankfurter"
        base = data["base"]
        rate_date = data["date"]
        rows = [
            (base, target, float(rate), rate_date, source_api)
            for target, rate in data["rates"].items()
        ]
        return source_api, rows

    elif "base_code" in data:
        source_api = "open_er"
        base = data["base_code"]
        # e.g. "Mon, 25 Aug 2026 00:00:01 +0000" -> "2026-08-25"
        rate_date = datetime.strptime(
            data["time_last_update_utc"], "%a, %d %b %Y %H:%M:%S %z"
        ).date().isoformat()
        rows = [
            (base, target, float(rate), rate_date, source_api)
            for target, rate in data["rates"].items()
        ]
        return source_api, rows

    return "unknown", []


def load_bronze_raw(conn, source_api: str, raw_json_text: str):
    """Store the raw unmodified JSON into bronze.raw_api_responses"""
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO bronze.raw_api_responses (source_api, raw_json) VALUES (?, ?)",
        source_api, raw_json_text
    )
    conn.commit()


def load_silver_rates(conn, rows: list[tuple]):
    """Upsert standardized exchange rate records into silver.stg_fx_rates"""
    if not rows:
        return
    cursor = conn.cursor()
    cursor.fast_executemany = True

    merge_sql = """
        MERGE silver.stg_fx_rates AS tgt
        USING (SELECT ? AS base_currency, ? AS target_currency, ? AS rate_date, ? AS source_api) AS src
        ON tgt.base_currency = src.base_currency
           AND tgt.target_currency = src.target_currency
           AND tgt.rate_date = src.rate_date
           AND tgt.source_api = src.source_api
        WHEN MATCHED THEN
            UPDATE SET exchange_rate = ?, loaded_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (base_currency, target_currency, exchange_rate, rate_date, source_api)
            VALUES (?, ?, ?, ?, ?);
    """

    # Format params: (base, target, date, source, rate, base, target, rate, date, source)
    param_list = [
        (r[0], r[1], r[3], r[4], r[2], r[0], r[1], r[2], r[3], r[4])
        for r in rows
    ]
    cursor.executemany(merge_sql, param_list)
    conn.commit()
    print(f"Upserted {len(rows)} rate records into silver.stg_fx_rates")


def main():
    latest_files = get_latest_files()
    conn = pyodbc.connect(CONN_STR)
    try:
        for file_path in latest_files:
            print(f"Processing bronze file: {file_path.name}")
            raw_text = file_path.read_text(encoding="utf-8")
            data = json.loads(raw_text)
            source_api, rows = parse_record(data, file_path.name)

            if not rows:
                print(f"Skipping unrecognized schema in {file_path.name}")
                continue

            load_bronze_raw(conn, source_api, raw_text)
            load_silver_rates(conn, rows)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
