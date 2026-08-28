import os
import sys
import json
import tempfile
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, DoubleType
from pyspark.sql.functions import col

# On Windows there is no 'python3' executable; tell PySpark to use the
# same interpreter that is running this script (works inside a venv too).
os.environ["PYSPARK_PYTHON"] = sys.executable
os.environ["PYSPARK_DRIVER_PYTHON"] = sys.executable

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BRONZE_DIR = PROJECT_ROOT / "data" / "bronze"


def parse_frankfurter(data: dict, filename: str) -> list:
    base = data["base"]
    rate_date = data["date"]
    return [{"base_currency": base, "target_currency": target,
             "exchange_rate": float(rate), "rate_date": rate_date,
             "source_api": "frankfurter", "source_file": filename}
            for target, rate in data["rates"].items()]


def parse_open_er(data: dict, filename: str) -> list:
    base = data["base_code"]
    # e.g. "Mon, 25 Aug 2026 00:00:01 +0000" -> "2026-08-25"
    rate_date = datetime.strptime(
        data["time_last_update_utc"], "%a, %d %b %Y %H:%M:%S %z"
    ).date().isoformat()
    return [{"base_currency": base, "target_currency": target,
             "exchange_rate": float(rate), "rate_date": rate_date,
             "source_api": "open_er", "source_file": filename}
            for target, rate in data["rates"].items()]


def parse_record(filename, content):
    """Detect which API's schema this file matches, then flatten it into dict rows."""
    data = json.loads(content)
    if "base" in data and "date" in data:
        return parse_frankfurter(data, filename)
    elif "base_code" in data:
        return parse_open_er(data, filename)
    return []  # unknown schema — skip rather than crash the whole batch


def main():
    spark = (
        SparkSession.builder
        .appName("FxSilverBatchLoad")
        .master("local[*]")
        .config(
            "spark.jars",
            "file:///mnt/c/Users/Acer/.ivy2/jars/com.microsoft.sqlserver_mssql-jdbc-12.8.1.jre11.jar"
        )
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")  # Spark's default INFO logging is very noisy

    # Read bronze JSON files with plain Python
    all_rows = []
    for json_file in BRONZE_DIR.glob("*.json"):
        with open(json_file, "r", encoding="utf-8") as f:
            content = f.read()
        all_rows.extend(parse_record(json_file.name, content))

    if not all_rows:
        print("No bronze data found — nothing to load.")
        spark.stop()
        return

    # Write parsed rows to a temp JSON Lines file, then read with
    # spark.read.json() — a pure JVM path that avoids Python worker issues.
    schema = StructType([
        StructField("base_currency", StringType(), False),
        StructField("target_currency", StringType(), False),
        StructField("exchange_rate", DoubleType(), False),
        StructField("rate_date", StringType(), False),
        StructField("source_api", StringType(), False),
        StructField("source_file", StringType(), False),
    ])

    tmp_file = tempfile.NamedTemporaryFile(
        mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
    )
    try:
        for row in all_rows:
            tmp_file.write(json.dumps(row) + "\n")
        tmp_file.close()
        df = spark.read.schema(schema).json(tmp_file.name)

        # Data quality: drop invalid rates, drop exact duplicates
        clean_df = (
            df.filter(col("exchange_rate") > 0)
              .dropDuplicates(["base_currency", "target_currency", "rate_date", "source_api"])
        )

        print(f"Cleaned batch: {clean_df.count()} rows ready for staging")

        mssql_server = os.environ["MSSQL_SERVER"]
        mssql_port = os.environ.get("MSSQL_PORT", "1433")
        mssql_database = os.environ["MSSQL_DATABASE"]
        mssql_user = os.environ["MSSQL_USER"]
        mssql_password = os.environ["MSSQL_SA_PASSWORD"]

        jdbc_url = (
            f"jdbc:sqlserver://{mssql_server}:{mssql_port};"
            f"databaseName={mssql_database};"
            "encrypt=true;"
            "trustServerCertificate=true;"
        )

        print(
            f"Connecting to SQL Server at {mssql_server}, "
            f"database={mssql_database}, user={mssql_user}"
        )

        (
            clean_df.write
            .format("jdbc")
            .option("url", jdbc_url)
            .option("dbtable", "silver.stg_fx_rates_staging")
            .option("user", mssql_user)
            .option("password", mssql_password)
            .option("driver", "com.microsoft.sqlserver.jdbc.SQLServerDriver")
            .mode("overwrite")
            .save()
        )
        print("Staging table loaded.")
    finally:
        os.unlink(tmp_file.name)
    spark.stop()


if __name__ == "__main__":
    main()
