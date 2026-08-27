-- This test PASSES when the query below returns 0 rows.
-- Any row returned here means exchange_rate <= 0 slipped through — a real problem.
select *
from {{ ref('stg_fx_rates_clean') }}
where exchange_rate <= 0