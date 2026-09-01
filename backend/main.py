import os
from datetime import date
from pathlib import Path
from typing import List, Optional

import pyodbc
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="FX Rate Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:3000")],
    allow_methods=["GET"],
    allow_headers=["*"],
)

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    f"SERVER={os.getenv('MSSQL_SERVER', 'localhost')},{os.getenv('MSSQL_PORT', '1433')};"
    f"DATABASE={os.getenv('MSSQL_DATABASE', 'FxAnalytics')};"
    f"UID={os.getenv('MSSQL_USER', 'sa')};"
    f"PWD={os.environ['MSSQL_SA_PASSWORD']};"
    f"Encrypt={os.getenv('MSSQL_ENCRYPT', 'yes')};"
    f"TrustServerCertificate={os.getenv('MSSQL_TRUST_CERT', 'yes')};"
)


def get_db():
    conn = pyodbc.connect(CONN_STR)
    try:
        yield conn
    finally:
        conn.close()


def rows_to_dicts(cursor) -> List[dict]:
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


class RateOut(BaseModel):
    base_currency: str
    target_currency: str
    exchange_rate: float
    rate_date: date
    source_api: str


class VolatilityOut(BaseModel):
    rate_date: date
    exchange_rate: float
    rolling_7d_avg: Optional[float]
    rolling_7d_volatility: Optional[float]
    volatility_pct: Optional[float]


class AnomalyOut(BaseModel):
    base_currency: str
    target_currency: str
    rate_date: date
    exchange_rate: float
    anomaly_score: float


class PerformanceOut(BaseModel):
    base_currency: str
    target_currency: str
    month_start: date
    avg_rate: float
    mom_change_pct: Optional[float]


class SummaryOut(BaseModel):
    total_pairs: int
    latest_date: Optional[date]
    total_anomalies: int
    pairs: List[str]


@app.get("/api/rates", response_model=List[RateOut])
def get_latest_rates(conn=Depends(get_db)):
    # One row per currency pair: its single most recent rate_date/load
    query = """
        WITH ranked AS (
            SELECT base_currency, target_currency, exchange_rate, rate_date, source_api,
                   ROW_NUMBER() OVER (
                       PARTITION BY base_currency, target_currency
                       ORDER BY rate_date DESC, loaded_at DESC
                   ) AS rn
            FROM silver.stg_fx_rates
        )
        SELECT base_currency, target_currency, exchange_rate, rate_date, source_api
        FROM ranked WHERE rn = 1
        ORDER BY target_currency
    """
    cursor = conn.cursor()
    cursor.execute(query)
    return rows_to_dicts(cursor)


@app.get("/api/volatility", response_model=List[VolatilityOut])
def get_volatility(
    base_currency: str = Query("USD"),
    target_currency: str = Query("EUR"),
    days: int = Query(30, le=365),
    conn=Depends(get_db),
):
    query = """
        SELECT TOP (?) rate_date, exchange_rate, rolling_7d_avg, rolling_7d_volatility, volatility_pct
        FROM gold.daily_volatility
        WHERE base_currency = ? AND target_currency = ?
        ORDER BY rate_date DESC
    """
    cursor = conn.cursor()
    cursor.execute(query, days, base_currency, target_currency)
    return rows_to_dicts(cursor)[::-1]  # reverse: chart wants oldest -> newest


@app.get("/api/anomalies", response_model=List[AnomalyOut])
def get_anomalies(limit: int = Query(20, le=100), conn=Depends(get_db)):
    query = """
        SELECT TOP (?) base_currency, target_currency, rate_date, exchange_rate, anomaly_score
        FROM gold.anomaly_alerts
        ORDER BY anomaly_score DESC
    """
    cursor = conn.cursor()
    cursor.execute(query, limit)
    return rows_to_dicts(cursor)


@app.get("/api/performance", response_model=List[PerformanceOut])
def get_performance(
    base_currency: Optional[str] = Query(None),
    target_currency: Optional[str] = Query(None),
    conn=Depends(get_db),
):
    where_clauses = []
    params = []
    if base_currency:
        where_clauses.append("base_currency = ?")
        params.append(base_currency)
    if target_currency:
        where_clauses.append("target_currency = ?")
        params.append(target_currency)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    query = f"""
        SELECT base_currency, target_currency, month_start, avg_rate, mom_change_pct
        FROM gold.currency_performance
        {where_sql}
        ORDER BY month_start DESC, target_currency ASC
    """
    cursor = conn.cursor()
    cursor.execute(query, *params)
    return rows_to_dicts(cursor)


@app.get("/api/summary", response_model=SummaryOut)
def get_summary(conn=Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT base_currency + '/' + target_currency FROM silver.stg_fx_rates ORDER BY 1")
    pairs = [r[0] for r in cursor.fetchall()]

    cursor.execute("SELECT MAX(rate_date) FROM silver.stg_fx_rates")
    row = cursor.fetchone()
    latest_date = row[0] if row else None

    cursor.execute("SELECT COUNT(*) FROM gold.anomaly_alerts")
    row = cursor.fetchone()
    total_anomalies = row[0] if row else 0

    return {
        "total_pairs": len(pairs),
        "latest_date": latest_date,
        "total_anomalies": total_anomalies,
        "pairs": pairs if pairs else ["USD/EUR", "USD/GBP", "USD/JPY"],
    }

