export function explainFinancialError(error:any){
  const message=error?.message||''
  if(message.includes('iap_refund_debt_outstanding'))return 'السحب متوقف حتى سداد مديونية استرداد مشتريات النجوم.'
  if(message.includes('financial_account_on_hold'))return 'الحساب المالي تحت المراجعة حاليًا.'
  if(message.includes('verification'))return 'يلزم إكمال التحقق من الهوية قبل السحب.'
  if(message.includes('payouts_disabled'))return 'السحب الحقيقي غير مفعّل حاليًا.'
  return 'تعذر تنفيذ العملية الآن.'
}

export function explainStarTransferError(error:any){
  const message=error?.message||''
  if(message.includes('insufficient_stars'))return 'رصيد النجوم غير كافٍ.'
  if(message.includes('financial')||message.includes('iap_refund'))return 'التحويل متوقف بسبب قيد مالي على الحساب.'
  return 'تعذر تحويل النجوم.'
}

export function calculateStarTransferBreakdown(value:number|string){
  const gross=Math.max(0,Number(value)||0)
  const fee=gross?Math.ceil(gross*0.15):0
  return {
    gross,
    fee,
    net:Math.max(0,gross-fee),
  }
}
