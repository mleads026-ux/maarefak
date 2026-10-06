-- Applied live on Supabase. Do not replay against the incomplete GitHub migration chain without first syncing all missing migrations.
create table public.star_pack_prices (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.star_packs(id) on delete cascade,
  country_code text not null references public.countries(code) on update cascade,
  currency_code text not null check (char_length(currency_code)=3),
  display_price numeric(12,2) not null check (display_price > 0),
  pricing_version text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pack_id,country_code)
);

alter table public.star_pack_prices enable row level security;
create policy star_pack_prices_read_active on public.star_pack_prices for select to authenticated using (active = true);
revoke all on table public.star_pack_prices from anon, authenticated;
grant select on table public.star_pack_prices to authenticated;

update public.star_packs
set target_price_egp = case code
  when 'stars_100' then 70.00
  when 'stars_500' then 325.00
  when 'stars_1200' then 720.00
  when 'stars_3000' then 1650.00
  else target_price_egp
end,
pricing_version='2026-10-local-v2',
benchmark_note='EGP anchor: 0.70/star for 100; 0.65 for 500; 0.60 for 1200; 0.55 for 3000. Localized reference prices are shown by profile country; Apple/Google storefront price is authoritative at checkout.',
updated_at=now()
where code in ('stars_100','stars_500','stars_1200','stars_3000');

insert into public.star_pack_prices(pack_id,country_code,currency_code,display_price,pricing_version)
select sp.id, x.country_code, x.currency_code, x.display_price, '2026-10-local-v2'
from public.star_packs sp
join (
  values
    ('stars_100','EG','EGP',70.00::numeric),('stars_500','EG','EGP',325.00::numeric),('stars_1200','EG','EGP',720.00::numeric),('stars_3000','EG','EGP',1650.00::numeric),
    ('stars_100','SA','SAR',5.03::numeric),('stars_500','SA','SAR',23.33::numeric),('stars_1200','SA','SAR',51.69::numeric),('stars_3000','SA','SAR',118.46::numeric),
    ('stars_100','AE','AED',4.91::numeric),('stars_500','AE','AED',22.81::numeric),('stars_1200','AE','AED',50.54::numeric),('stars_3000','AE','AED',115.82::numeric),
    ('stars_100','JO','JOD',0.95::numeric),('stars_500','JO','JOD',4.40::numeric),('stars_1200','JO','JOD',9.76::numeric),('stars_3000','JO','JOD',22.36::numeric)
) as x(pack_code,country_code,currency_code,display_price) on x.pack_code=sp.code
on conflict(pack_id,country_code) do update set currency_code=excluded.currency_code, display_price=excluded.display_price, pricing_version=excluded.pricing_version, active=true, updated_at=now();

create or replace function public.get_my_star_packs()
returns table(pack_id uuid, code text, stars_amount bigint, google_product_id text, apple_product_id text, country_code text, currency_code text, display_price numeric, unit_price numeric, savings_percent numeric, pricing_version text)
language sql stable set search_path=public as $$
  with my_country as (
    select coalesce((select c.code from public.profiles p join public.countries c on c.id=p.country_id where p.id=(select auth.uid()) limit 1),'EG') as code
  ),
  effective as (
    select sp.id as pack_id,sp.code,sp.stars_amount,sp.google_product_id,sp.apple_product_id,pp.country_code,pp.currency_code,pp.display_price,pp.pricing_version,(pp.display_price/sp.stars_amount::numeric) as unit_price_raw
    from public.star_packs sp cross join my_country mc
    join lateral (
      select spp.country_code,spp.currency_code,spp.display_price,spp.pricing_version
      from public.star_pack_prices spp
      where spp.pack_id=sp.id and spp.active=true and spp.country_code in (mc.code,'EG')
      order by case when spp.country_code=mc.code then 0 else 1 end limit 1
    ) pp on true
    where sp.active=true
  ),
  priced as (
    select e.*,first_value(e.unit_price_raw) over(order by e.stars_amount,e.code) as starter_unit_price from effective e
  )
  select p.pack_id,p.code,p.stars_amount,p.google_product_id,p.apple_product_id,p.country_code,p.currency_code,p.display_price,
         round(p.unit_price_raw,4),
         round(greatest(0::numeric,(1-(p.unit_price_raw/nullif(p.starter_unit_price,0)))*100),1),
         p.pricing_version
  from priced p order by p.stars_amount,p.code;
$$;
revoke all on function public.get_my_star_packs() from public, anon;
grant execute on function public.get_my_star_packs() to authenticated;
