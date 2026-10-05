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

export type DiscoveryMode='new'|'vibe'|'mystery'|'voice'

export const discoveryFallback=[
  '/demo/face-2.jpg',
  '/demo/face-1.jpg',
  '/demo/face-3.jpg',
  '/demo/face-4.jpg',
]

export function discoveryRpcForMode(mode:Exclude<DiscoveryMode,'new'>){
  return mode==='mystery'
    ? 'mystery_discovery_cards'
    : mode==='voice'
      ? 'voice_first_discovery'
      : 'people_on_my_vibe'
}

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
    display_name:profile.display_name,
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

export function normalizeNewFace(row:any,age:number|null){
  return {
    ...row,
    city_name:row.cities?.name_ar||null,
    age,
    shared_interests:0,
  }
}

export function getDiscoveryCardView(mode:DiscoveryMode,first:any){
  const fullyKnown=mode==='new'||mode==='vibe'
  const mysteryShowsName=mode==='mystery'&&first?.reveal_mode==='name'
  const mysteryShowsPhoto=mode==='mystery'&&first?.reveal_mode==='photo'&&Boolean(first?.avatar_url)
  const showName=fullyKnown||mysteryShowsName
  const showImage=fullyKnown||mysteryShowsPhoto
  return {
    target:first?.id||first?.user_id,
    showName,
    showImage,
    knownImage:first?.avatar_url||discoveryFallback[0],
    cardName:showName
      ? (first?.display_name||'شخص جديد')
      : (mode==='voice'?'صوت جديد':'شخص غامض'),
    cardCity:first?.city_name||'بالقرب منك',
    cardMood:first?.mood||'جاهز للتعارف',
    promptText:mode==='mystery'?(first?.prompt_text||null):null,
  }
}
