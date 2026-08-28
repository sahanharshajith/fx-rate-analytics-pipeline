from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator


PROJECT_ROOT = "/mnt/e/Project/fx-rate-analytics-pipeline/fx-rate-analytics-pipeline"

MAIN_PY = "$HOME/venvs/main/bin/python"
DBT_BIN = "$HOME/venvs/dbt/bin/dbt"

MSSQL_SERVER = "172.17.224.1"
MSSQL_PORT = "1433"
MSSQL_USER = "sa"
MSSQL_SA_PASSWORD = "MSSQL_SA_PASSWORD"
MSSQL_DATABASE = "FxAnalytics"

MSSQL_ENV = (
    f"MSSQL_SERVER='{MSSQL_SERVER}' "
    f"MSSQL_PORT='{MSSQL_PORT}' "
    f"MSSQL_USER='{MSSQL_USER}' "
    f"MSSQL_SA_PASSWORD='{MSSQL_SA_PASSWORD}' "
    f"MSSQL_DATABASE='{MSSQL_DATABASE}' "
    "MSSQL_ENCRYPT='yes' "
    "MSSQL_TRUST_CERT='yes'"
)

default_args = {
    "owner": "sahan",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="fx_ingestion_dag",
    default_args=default_args,
    schedule="@daily",
    start_date=datetime(2026, 8, 1),
    catchup=False,
    tags=["fx-pipeline"],
) as dag:

    fetch_rates = BashOperator(
        task_id="fetch_fx_rates",
        bash_command=(
            f"{MSSQL_ENV} "
            f"{MAIN_PY} "
            f"{PROJECT_ROOT}/python_app/fetch_fx_data.py"
        ),
    )

    load_bronze_silver = BashOperator(
        task_id="load_bronze_and_silver",
        bash_command=(
            f"{MSSQL_ENV} "
            f"{MAIN_PY} "
            f"{PROJECT_ROOT}/python_app/load_to_mssql.py"
        ),
    )

    spark_transform = BashOperator(
        task_id="spark_transform_bronze_to_staging",
        bash_command=(
            f"{MSSQL_ENV} "
            f"{MAIN_PY} "
            f"{PROJECT_ROOT}/spark/jobs/transform_bronze_to_silver.py"
        ),
    )

    spark_merge = BashOperator(
        task_id="merge_staging_to_silver",
        bash_command=(
            f"{MSSQL_ENV} "
            f"{MAIN_PY} "
            f"{PROJECT_ROOT}/spark/jobs/merge_staging_to_silver.py"
        ),
    )

    dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command=(
            f"cd {PROJECT_ROOT}/dbt_fx && "
            f"{DBT_BIN} run"
        ),
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=(
            f"cd {PROJECT_ROOT}/dbt_fx && "
            f"{DBT_BIN} test"
        ),
    )

    detect_anomalies = BashOperator(
        task_id="detect_anomalies",
        bash_command=(
            f"{MSSQL_ENV} "
            f"{MAIN_PY} "
            f"{PROJECT_ROOT}/ml/detect_anomalies.py"
        ),
    )

    (
        fetch_rates
        >> load_bronze_silver
        >> spark_transform
        >> spark_merge
        >> dbt_run
        >> dbt_test
        >> detect_anomalies
    )
