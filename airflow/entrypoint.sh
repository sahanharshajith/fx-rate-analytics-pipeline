#!/bin/bash
set -e
echo "Initializing database schema (idempotent)..."
python /opt/airflow/project/sql/init_db.py
echo "Starting Airflow..."
exec airflow standalone
