import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function friendlyError(message?: string) {
  if (!message) return 'حدث خطأ، حاول مرة أخرى.'

  const value = message.toLowerCase()

  if (message.includes('must_be_18')) {
    return 'التطبيق متاح لمن هم 18 سنة فأكثر.'
  }

  if (message.includes('insufficient_stars')) {
    return 'رصيد النجوم غير كافٍ.'
  }

  if (value.includes('invalid login')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  }

  if (value.includes('email not confirmed')) {
    return 'البريد الإلكتروني غير مؤكد. أكمل رمز التحقق أولًا.'
  }

  if (
    value.includes('token has expired') ||
    value.includes('otp expired') ||
    value.includes('expired')
  ) {
    return 'انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.'
  }

  if (
    value.includes('token is invalid') ||
    value.includes('invalid token') ||
    value.includes('otp') && value.includes('invalid')
  ) {
    return 'رمز التحقق غير صحيح.'
  }

  if (value.includes('rate limit')) {
    return 'تم إرسال محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.'
  }

  if (value.includes('already registered')) {
    return 'هذا البريد مسجل بالفعل.'
  }

  return 'حدث خطأ، حاول مرة أخرى.'
}
