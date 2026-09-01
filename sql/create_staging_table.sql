USE FxAnalytics;
GO

IF OBJECT_ID('silver.stg_fx_rates_staging', 'U') IS NULL
BEGIN
    CREATE TABLE silver.stg_fx_rates_staging (
        base_currency       CHAR(3)         NOT NULL,
        target_currency     CHAR(3)         NOT NULL,
        exchange_rate       DECIMAL(18,6)   NOT NULL,
        rate_date           DATE            NOT NULL,
        source_api          VARCHAR(50)     NOT NULL,
        source_file         VARCHAR(255)    NOT NULL
    );
END
GO