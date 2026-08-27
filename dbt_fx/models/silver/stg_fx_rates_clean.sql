select
    base_currency,
    target_currency,
    exchange_rate,
    rate_date,
    source_api,
    loaded_at
from {{ source('silver', 'stg_fx_rates') }}
where exchange_rate > 0
    and base_currency is not null
    and target_currency is not null