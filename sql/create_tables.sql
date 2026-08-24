USE FxAnalytics;
GO

-- BRONZE: raw, untouched API responses
CREATE TABLE bronze.raw_api_responses (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    source_api      VARCHAR(50)     NOT NULL,
    raw_json        NVARCHAR(MAX)   NOT NULL,
    fetched_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- SILVER: cleaned, standardized rates (both APIs normalized to this shape)
CREATE TABLE silver.stg_fx_rates (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    base_currency       CHAR(3)         NOT NULL,
    target_currency     CHAR(3)         NOT NULL,
    exchange_rate       DECIMAL(18,6)   NOT NULL,
    rate_date           DATE            NOT NULL,
    source_api          VARCHAR(50)     NOT NULL,
    loaded_at           DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_fx_rate UNIQUE (base_currency, target_currency, rate_date, source_api)
);
GO

-- GOLD: daily volatility metrics
CREATE TABLE gold.daily_volatility (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    base_currency       CHAR(3)         NOT NULL,
    target_currency     CHAR(3)         NOT NULL,
    rate_date           DATE            NOT NULL,
    daily_high          DECIMAL(18,6),
    daily_low           DECIMAL(18,6),
    volatility_pct      DECIMAL(10,4),
    calculated_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- GOLD: monthly currency performance (MoM change)
CREATE TABLE gold.currency_performance (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    base_currency       CHAR(3)         NOT NULL,
    target_currency     CHAR(3)         NOT NULL,
    month_start         DATE            NOT NULL,
    avg_rate            DECIMAL(18,6),
    mom_change_pct      DECIMAL(10,4),
    calculated_at       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- GOLD: anomaly alerts flagged by the ML model
CREATE TABLE gold.anomaly_alerts (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    base_currency       CHAR(3)         NOT NULL,
    target_currency     CHAR(3)         NOT NULL,
    rate_date           DATE            NOT NULL,
    exchange_rate       DECIMAL(18,6)   NOT NULL,
    anomaly_score       DECIMAL(10,6),
    detected_at         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO