export async function fetchPaymentsSnapshot(s:any,userId:string){
  const [w,p,e,ew,r,pr,m,wr,fs,is,pid]=await Promise.all([
    s.from('star_wallets').select('balance,promotional_balance').eq('user_id',userId).maybeSingle(),
    s.rpc('get_my_star_packs'),
    s.rpc('my_lamma_earnings_summary'),
    s.from('earning_wallets').select('available_stars,held_stars,paid_out_stars').eq('user_id',userId).maybeSingle(),
    s.from('financial_risk_state').select('iap_debt_stars,manual_payout_hold,manual_hold_reason').eq('user_id',userId).maybeSingle(),
    s.from('profiles').select('verification_status,verified_at').eq('id',userId).single(),
    s.from('payout_methods').select('id,route,country_code,wallet_issuer,label,destination_masked,bank_name_masked,is_default,active').eq('user_id',userId).eq('active',true),
    s.from('withdrawal_requests').select('id,requested_stars,cash_amount_egp,payout_method,payout_provider,destination_masked,status,requested_at,paid_at,provider_status,provider_currency,provider_amount,bank_name_masked').eq('user_id',userId).order('requested_at',{ascending:false}).limit(10),
    s.from('app_financial_settings').select('payouts_enabled,min_withdrawal_stars,require_verified_payouts').eq('id',1).single(),
    s.from('app_identity_settings').select('provider,enabled,liveness_required').eq('id',1).single(),
    s.rpc('my_public_user_id'),
  ])

  return {
    wallet:Number(w.data?.balance||0),
    promotionalWallet:Number(w.data?.promotional_balance||0),
    transferableWallet:Math.max(0,Number(w.data?.balance||0)-Number(w.data?.promotional_balance||0)),
    packs:p.data||[],
    earnings:Array.isArray(e.data)?e.data[0]||{}:e.data||{},
    earningWallet:ew.data||{},
    risk:r.data||{},
    profile:pr.data||{},
    publicId:(pid.data as string)||'',
    methods:m.data||[],
    withdrawals:wr.data||[],
    settings:fs.data||{},
    identity:is.data||{},
  }
}
