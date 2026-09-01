FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates openjdk-17-jre-headless pipx \
    && curl -sSL -O https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

WORKDIR /opt/airflow

# Airflow + pipeline deps in the main venv (proven compatible via your WSL2 run)
ARG AIRFLOW_VERSION=2.10.3
ARG PY_VERSION=3.11
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --default-timeout=120 --retries=10 \
        "apache-airflow==${AIRFLOW_VERSION}" \
        --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PY_VERSION}.txt" \
    && pip install --no-cache-dir --default-timeout=120 --retries=10 -r requirements.txt

# dbt in its own pipx-isolated venv — same container, no version conflicts with Airflow
ENV PIPX_HOME=/opt/pipx
ENV PIPX_BIN_DIR=/usr/local/bin
RUN pipx install dbt-core==1.12.3 && pipx inject dbt-core dbt-sqlserver==1.11.1

# JDBC driver baked in at build time — fixes the hardcoded host path bug
RUN mkdir -p /opt/spark-jars && \
    curl -sSL -o /opt/spark-jars/mssql-jdbc.jar \
    https://repo1.maven.org/maven2/com/microsoft/sqlserver/mssql-jdbc/12.8.1.jre11/mssql-jdbc-12.8.1.jre11.jar

ENV AIRFLOW_HOME=/opt/airflow/home
ENV AIRFLOW__CORE__LOAD_EXAMPLES=False
ENV AIRFLOW__CORE__DAGS_FOLDER=/opt/airflow/project/airflow/dags
ENV SPARK_JDBC_JAR=/opt/spark-jars/mssql-jdbc.jar

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
