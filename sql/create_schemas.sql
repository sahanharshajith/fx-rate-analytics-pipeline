-- Sets up the FxAnalytics database and Bronze-Silver-Gold schemas

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'FxAnalytics')
BEGIN
    CREATE DATABASE FxAnalytics;
END
GO

USE FxAnalytics;
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'bronze')
    EXEC('CREATE SCHEMA bronze');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'silver')
    EXEC('CREATE SCHEMA silver');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'gold')
    EXEC('CREATE SCHEMA gold');
GO