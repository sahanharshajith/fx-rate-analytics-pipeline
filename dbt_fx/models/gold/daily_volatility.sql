with daily_rates as (
    select
        base_currency,
        target_currency,
        rate_date,
        exchange_rate
    from {{ ref('stg_fx_rates_clean') }}
),

with_rolling_stats as (
    select
        base_currency,
        target_currency,
        rate_date,
        exchange_rate,
        avg(exchange_rate) over (
            partition by base_currency, target_currency
            order by rate_date
            rows between 6 preceding and current row
        ) as rolling_7d_avg,
        stdev(exchange_rate) over (
            partition by base_currency, target_currency
            order by rate_date
            rows between 6 preceding and current row
        ) as rolling_7d_stdev
    from daily_rates
)

select
    base_currency,
    target_currency,
    rate_date,
    exchange_rate,
    round(rolling_7d_avg, 6) as rolling_7d_avg,
    round(rolling_7d_stdev, 6) as rolling_7d_volatility,
    round(rolling_7d_stdev / nullif(rolling_7d_avg, 0) * 100, 4) as volatility_pct
from with_rolling_stats