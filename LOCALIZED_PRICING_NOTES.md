# Lammetna localized star pricing — applied live

Applied to Supabase project: hxinaxjcdwsngiqvdryq

## Egypt anchor pricing
- 100 stars = 70 EGP (0.70 EGP/star)
- 500 stars = 325 EGP (0.65 EGP/star)
- 1200 stars = 720 EGP (0.60 EGP/star)
- 3000 stars = 1650 EGP (0.55 EGP/star)

## Localized display pricing
- EG / EGP: 70.00, 325.00, 720.00, 1650.00
- SA / SAR: 5.03, 23.33, 51.69, 118.46
- AE / AED: 4.91, 22.81, 50.54, 115.82
- JO / JOD: 0.95, 4.40, 9.76, 22.36

Localized non-Egypt values are display/reference prices based on 2026-10-02 FX. Apple App Store / Google Play storefront metadata remains authoritative at checkout.

## Live database migrations applied
- 20261001234255 localized_star_pack_pricing_v2
- 20261001234406 index_star_pack_price_country

## Added live database objects
- public.star_pack_prices
- public.get_my_star_packs()

## Verification
- Egypt authenticated RPC test passed.
- Unit price decreases monotonically as pack size increases.
- New FK performance warning was fixed with star_pack_prices_country_code_idx.
- Security advisor shows no new warning attributable to the localized-pricing RPC; existing project warnings remain for SECURITY DEFINER functions and Leaked Password Protection.

## GitHub status
GitHub App write operations still return 403 Resource not accessible by integration. No repository write was performed.
