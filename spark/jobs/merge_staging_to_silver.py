import pyodbc
from dotenv import load_dotenv

load_dotenv()

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost,1433;DATABASE=FxAnalytics;"
    "Trusted_Connection=yes;"
    "Encrypt=yes;TrustServerCertificate=yes;"
)

MERGE_SQL = """
MERGE silver.stg_fx_rates AS tgt
USING silver.stg_fx_rates_staging AS src
ON tgt.base_currency = src.base_currency
   AND tgt.target_currency = src.target_currency
   AND tgt.rate_date = src.rate_date
   AND tgt.source_api = src.source_api
WHEN MATCHED THEN
    UPDATE SET exchange_rate = src.exchange_rate, loaded_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (base_currency, target_currency, exchange_rate, rate_date, source_api)
    VALUES (src.base_currency, src.target_currency, src.exchange_rate, src.rate_date, src.source_api);
"""

if __name__ == "__main__":
    conn = pyodbc.connect(CONN_STR)
    try:
        cursor = conn.cursor()
        cursor.execute(MERGE_SQL)
        print(f"Merged {cursor.rowcount} rows into silver.stg_fx_rates")
        conn.commit()
    finally:
        conn.close()
