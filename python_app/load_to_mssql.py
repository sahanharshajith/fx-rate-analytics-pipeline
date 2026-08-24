import os
import json
import pyodbc
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "bronze"

# ODBC connection string 
CONN_STR = (
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"SERVER={os.getenv('MSSQL_SERVER')};"
    f"DATABASE={os.getenv('MSSQL_DATABASE')};"
    "Trusted_Connection=yes;"
    f"Encrypt={os.getenv('MSSQL_ENCRYPT', 'yes')};"
    f"TrustServerCertificate={os.getenv('MSSQL_TRUST_CERT', 'yes')};"
)


def get_latest_json_file() -> Path:
    files = sorted(DATA_DIR.glob("frankfurter_*.json"))
    if not files:
        raise FileNotFoundError("No bronze JSON files found. Run fetch_fx_data.py first.")
    return files[-1]

def load_bronze_raw(conn, raw_json_text: str):
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO bronze.raw_api_responses (source_api, raw_json) VALUES (?, ?)",
        "frankfurter", raw_json_text
    )
    conn.commit()

def load_silver_rates(conn, data: dict):
    cursor = conn.cursor()
    base = data["base"]
    rate_date = data["date"]

    for target, rate in data["rates"].items():
        cursor.execute("""
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
        """, base, target, rate_date, "frankfurter", rate,
             base, target, rate, rate_date, "frankfurter")
    conn.commit()
    print(f"Loaded {len(data['rates'])} rate records into silver.stg_fx_rates")

if __name__ == "__main__":
    latest_file = get_latest_json_file()
    raw_text = latest_file.read_text()
    data = json.loads(raw_text)

    conn = pyodbc.connect(CONN_STR)
    try:
        load_bronze_raw(conn, raw_text)
        load_silver_rates(conn, data)
    finally:
        conn.close()