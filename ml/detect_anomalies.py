import os

import pandas as pd
import pyodbc
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest

load_dotenv()

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    f"SERVER={os.getenv('MSSQL_SERVER')},{os.getenv('MSSQL_PORT', '1433')};"
    f"DATABASE={os.getenv('MSSQL_DATABASE', 'FxAnalytics')};"
    f"UID={os.getenv('MSSQL_USER')};"
    f"PWD={os.getenv('MSSQL_SA_PASSWORD')};"
    "Encrypt=yes;"
    "TrustServerCertificate=yes;"
)

CONTAMINATION = 0.05  # our prior belief: ~5% of days are genuinely anomalous


def load_volatility_data(conn) -> pd.DataFrame:
    """Pull the already-computed rolling stats from Gold."""
    query = """
        SELECT base_currency, target_currency, rate_date, exchange_rate,
               rolling_7d_avg, rolling_7d_volatility
        FROM gold.daily_volatility
        WHERE rolling_7d_avg IS NOT NULL
    """
    return pd.read_sql(query, conn)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Turn raw rate + rolling stats into a feature that's comparable across currency pairs."""
    df = df.copy()
    df["pct_deviation"] = (df["exchange_rate"] - df["rolling_7d_avg"]) / df["rolling_7d_avg"]
    return df


def detect_for_pair(pair_df: pd.DataFrame) -> pd.DataFrame:
    """Fit and score one Isolation Forest per currency pair — see Step 3 for why."""
    features = pair_df[["pct_deviation", "rolling_7d_volatility"]].fillna(0)

    if len(features) < 10:
        # Too little history for a meaningful model yet — skip rather than force a bad fit
        pair_df["is_anomaly"] = False
        pair_df["anomaly_score"] = 0.0
        return pair_df

    model = IsolationForest(
        n_estimators=100,
        contamination=CONTAMINATION,
        random_state=42,  # fixed seed = reproducible results, important for a portfolio demo
    )
    predictions = model.fit_predict(features)          # -1 = anomaly, 1 = normal
    scores = model.decision_function(features)          # higher = more normal, lower = more anomalous

    pair_df["is_anomaly"] = predictions == -1
    pair_df["anomaly_score"] = -scores  # flip sign: now higher score = more anomalous (more intuitive)
    return pair_df


def main():
    conn = pyodbc.connect(CONN_STR)
    try:
        df = load_volatility_data(conn)
        print(f"Loaded {len(df)} rows across {df.groupby(['base_currency', 'target_currency']).ngroups} currency pairs")

        df = engineer_features(df)

        # Group by currency pair, run detection independently on each group
        results = (
            df.groupby(["base_currency", "target_currency"], group_keys=False)
              .apply(detect_for_pair)
        )

        anomalies = results[results["is_anomaly"]].copy()
        print(f"Flagged {len(anomalies)} anomalies out of {len(results)} total rows")

        cursor = conn.cursor()
        cursor.execute("TRUNCATE TABLE gold.anomaly_alerts")  # full recompute each run — see note below

        for _, row in anomalies.iterrows():
            cursor.execute(
                """
                INSERT INTO gold.anomaly_alerts
                    (base_currency, target_currency, rate_date, exchange_rate, anomaly_score)
                VALUES (?, ?, ?, ?, ?)
                """,
                row["base_currency"], row["target_currency"], row["rate_date"],
                float(row["exchange_rate"]), float(row["anomaly_score"]),
            )
        conn.commit()
        print(f"Wrote {len(anomalies)} rows to gold.anomaly_alerts")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
