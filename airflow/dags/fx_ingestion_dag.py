from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator

PROJECT_ROOT = "/opt/airflow/project"

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
        bash_command=f"python {PROJECT_ROOT}/python_app/fetch_fx_data.py",
    )

    load_bronze = BashOperator(
        task_id="load_bronze",
        bash_command=f"python {PROJECT_ROOT}/python_app/load_to_mssql.py",
    )

    spark_transform = BashOperator(
        task_id="spark_transform_bronze_to_staging",
        bash_command=f"python {PROJECT_ROOT}/spark/jobs/transform_bronze_to_silver.py",
    )

    spark_merge = BashOperator(
        task_id="merge_staging_to_silver",
        bash_command=f"python {PROJECT_ROOT}/spark/jobs/merge_staging_to_silver.py",
    )

    dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command=f"cd {PROJECT_ROOT}/dbt_fx && dbt run --profiles-dir {PROJECT_ROOT}/dbt_fx",
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=f"cd {PROJECT_ROOT}/dbt_fx && dbt test --profiles-dir {PROJECT_ROOT}/dbt_fx",
    )

    detect_anomalies = BashOperator(
        task_id="detect_anomalies",
        bash_command=f"python {PROJECT_ROOT}/ml/detect_anomalies.py",
    )

    (
        fetch_rates
        >> load_bronze
        >> spark_transform
        >> spark_merge
        >> dbt_run
        >> dbt_test
        >> detect_anomalies
    )
