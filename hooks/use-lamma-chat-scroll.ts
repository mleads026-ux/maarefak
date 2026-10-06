'use client'

import {useCallback,useEffect,useRef,useState} from 'react'

type LammaChatMessage={
  id:string
  sender_id:string
}

export function useLammaChatScroll(
  messages:LammaChatMessage[],
  currentUserId:string,
){
  const scrollRef=useRef<HTMLDivElement|null>(null)
  const endRef=useRef<HTMLDivElement|null>(null)
  const atBottomRef=useRef(true)
  const previousLatestIdRef=useRef<string|null>(null)
  const readTimerRef=useRef<number|null>(null)
  const [unreadFromId,setUnreadFromId]=useState<string|null>(null)

  const clearReadTimer=useCallback(()=>{
    if(readTimerRef.current!=null){
      window.clearTimeout(readTimerRef.current)
      readTimerRef.current=null
    }
  },[])

  useEffect(()=>{
    const latest=messages[messages.length-1]
    if(!latest)return

    const previousLatestId=previousLatestIdRef.current
    const firstLoad=previousLatestId==null
    const sentByMe=latest.sender_id===currentUserId

    if(firstLoad||atBottomRef.current||sentByMe){
      requestAnimationFrame(()=>{
        endRef.current?.scrollIntoView({
          behavior:firstLoad?'auto':'smooth',
          block:'end',
        })
      })
      setUnreadFromId(null)
    }else if(!unreadFromId){
      const previousIndex=messages.findIndex(message=>message.id===previousLatestId)
      const firstUnread=messages[Math.max(0,previousIndex+1)]
      if(firstUnread)setUnreadFromId(firstUnread.id)
    }

    previousLatestIdRef.current=latest.id
  },[messages,currentUserId,unreadFromId])

  const onScroll=useCallback(()=>{
    const element=scrollRef.current
    if(!element)return

    const distance=element.scrollHeight-element.scrollTop-element.clientHeight
    const atBottom=distance<56
    atBottomRef.current=atBottom

    clearReadTimer()
    if(atBottom&&unreadFromId){
      readTimerRef.current=window.setTimeout(()=>{
        if(atBottomRef.current)setUnreadFromId(null)
      },1200)
    }
  },[clearReadTimer,unreadFromId])

  useEffect(()=>clearReadTimer,[clearReadTimer])

  return {
    scrollRef,
    endRef,
    unreadFromId,
    onScroll,
  }
}
