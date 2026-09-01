import glob
import os
import re
import pyodbc

CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    f"SERVER={os.getenv('MSSQL_SERVER', 'localhost')},{os.getenv('MSSQL_PORT', '1433')};"
    f"UID={os.getenv('MSSQL_USER', 'sa')};"
    f"PWD={os.environ['MSSQL_SA_PASSWORD']};"
    f"Encrypt={os.getenv('MSSQL_ENCRYPT', 'yes')};"
    f"TrustServerCertificate={os.getenv('MSSQL_TRUST_CERT', 'yes')};"
)

SQL_DIR = os.path.dirname(__file__)


def run_sql_file(cursor, path):
    with open(path, "r", encoding="utf-8") as f:
        script = f.read()
    batches = re.split(r"^\s*GO\s*$", script, flags=re.MULTILINE | re.IGNORECASE)
    for batch in batches:
        batch = batch.strip()
        if batch:
            cursor.execute(batch)


if __name__ == "__main__":
    conn = pyodbc.connect(CONN_STR, autocommit=True)
    cursor = conn.cursor()
    for sql_file in sorted(glob.glob(os.path.join(SQL_DIR, "*.sql"))):
        print(f"Running {sql_file}...")
        try:
            run_sql_file(cursor, sql_file)
        except pyodbc.Error as e:
            if "already exists" in str(e) or "There is already an object" in str(e):
                print("  (already applied, skipping)")
            else:
                raise
    conn.close()
    print("Database initialization complete.")
