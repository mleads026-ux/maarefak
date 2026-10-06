export {createRandomMatch} from './random-chat'
export type {RandomMatch} from './random-chat'

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
