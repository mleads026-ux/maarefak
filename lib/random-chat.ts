export type RandomMatch={
  session_id:string
  matched_user_id:string
  display_name:string
  avatar_url:string|null
  city_name:string|null
  country_name:string|null
  mood:string|null
  age:number|null
  user_a:string
  user_b:string
  user_a_accepted:boolean
  user_b_accepted:boolean
}

export const randomChatFallback='/demo/face-1.jpg'

export function createRandomMatch({
  session,
  profile,
  age,
  currentUserId,
}:{
  session:any
  profile:any
  age:any
  currentUserId:string
}):RandomMatch{
  const other=session.user_a===currentUserId?session.user_b:session.user_a
  return {
    session_id:session.id,
    matched_user_id:other,
    display_name:profile.display_name||'مستخدم لمتنا',
    avatar_url:profile.avatar_url,
    city_name:profile.cities?.name_ar||null,
    country_name:profile.countries?.name_ar||null,
    mood:profile.mood,
    age:age==null?null:Number(age),
    user_a:session.user_a,
    user_b:session.user_b,
    user_a_accepted:Boolean(session.user_a_accepted),
    user_b_accepted:Boolean(session.user_b_accepted),
  }
}
