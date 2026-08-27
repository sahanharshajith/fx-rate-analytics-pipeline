with monthly_avg as (
    select
        base_currency,
        target_currency,
        datefromparts(year(rate_date), month(rate_date), 1) as month_start,
        avg(exchange_rate) as avg_rate
    from {{ ref('stg_fx_rates_clean') }}
    group by base_currency, target_currency, datefromparts(year(rate_date), month(rate_date), 1)
),

with_lag as (
    select
        *,
        lag(avg_rate) over (
            partition by base_currency, target_currency
            order by month_start
        ) as prev_month_avg_rate
    from monthly_avg
)

select
    base_currency,
    target_currency,
    month_start,
    round(avg_rate, 6) as avg_rate,
    round(
        (avg_rate - prev_month_avg_rate) / nullif(prev_month_avg_rate, 0) * 100,
        4
    ) as mom_change_pct
from with_lag