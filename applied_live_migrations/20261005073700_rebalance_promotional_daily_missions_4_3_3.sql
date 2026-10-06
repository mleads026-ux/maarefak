-- Applied live on 2026-10-05.
-- Rebalance promotional daily mission rewards to 4/3/3.
-- Profile completion remains a one-time 10-star promotional reward.

update public.daily_mission_definitions
set reward_stars = case code
  when 'answer_daily' then 4
  when 'join_lamma' then 3
  when 'send_message' then 3
  else reward_stars
end
where code in ('answer_daily','join_lamma','send_message');

update public.daily_mission_definitions
set reward_stars=10,
    cadence='once'
where code='complete_profile';
