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
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost,1433;DATABASE=FxAnalytics;"
    "Trusted_Connection=yes;"
    "Encrypt=yes;TrustServerCertificate=yes;"
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
