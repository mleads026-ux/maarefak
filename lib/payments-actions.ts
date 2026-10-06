export async function convertEarningsToStars(s:any,stars:number){
  return s.rpc('convert_earnings_to_stars',{p_stars:stars})
}

export async function useLammaEarnings(s:any,action:'convert'|'withdraw',stars:number){
  return s.rpc('use_lamma_earnings',{p_action:action,p_stars:stars})
}

export async function requestWithdrawalToSavedMethod(s:any,stars:number,methodId:string){
  return s.rpc('request_withdrawal_to_saved_method',{p_stars:stars,p_method:methodId})
}

export async function lookupUserForStarTransfer(s:any,publicUserId:string){
  const {data,error}=await s.rpc('lookup_user_for_star_transfer',{p_public_user_id:publicUserId})
  return {
    data:Array.isArray(data)?data[0]:data,
    error,
  }
}

export async function transferStarsByPublicUserId(
  s:any,
  publicUserId:string,
  amount:number,
  clientReferenceId:string
){
  return s.rpc('transfer_stars_by_user_id',{
    p_public_user_id:publicUserId,
    p_amount:amount,
    p_client_reference_id:clientReferenceId,
  })
}

export async function startIdentityVerification(s:any){
  return s.rpc('start_identity_verification')
}
