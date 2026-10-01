import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs:ClassValue[]){return twMerge(clsx(inputs))}
export function friendlyError(message?:string){
  if(!message) return 'حدث خطأ، حاول مرة أخرى.'
  if(message.includes('must_be_18')) return 'التطبيق متاح لمن هم 18 سنة فأكثر.'
  if(message.includes('insufficient_stars')) return 'رصيد النجوم غير كافٍ.'
  if(message.includes('Invalid login')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  if(message.includes('already registered')) return 'هذا البريد مسجل بالفعل.'
  return 'حدث خطأ، حاول مرة أخرى.'
}