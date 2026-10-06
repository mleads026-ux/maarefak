'use client'

import type {Dispatch,MutableRefObject,SetStateAction} from 'react'
import type {LammaVoiceParticipant} from '@/lib/lamma-room'

type VoiceRequestStatus='none'|'pending'|'accepted'|'rejected'|'host'

type Args={
  s:any
  id:string
  uid:string
  isHost:boolean
  inVoice:boolean
  micEnabled:boolean
  voiceRequestStatus:VoiceRequestStatus
  localStreamRef:MutableRefObject<MediaStream|null>
  setVoiceRequestStatus:Dispatch<SetStateAction<VoiceRequestStatus>>
  setInVoice:Dispatch<SetStateAction<boolean>>
  setMicEnabled:Dispatch<SetStateAction<boolean>>
  setVoiceMembers:Dispatch<SetStateAction<LammaVoiceParticipant[]>>
  setVoiceStreams:Dispatch<SetStateAction<MediaStream[]>>
  setNotice:Dispatch<SetStateAction<string>>
  startVoiceRealtime:()=>Promise<void>
  refreshVoiceMembers:()=>Promise<void>
  cleanupVoice:()=>void
  onReload:()=>Promise<void>
}

export function useLammaVoiceControls({
  s,id,uid,isHost,inVoice,micEnabled,voiceRequestStatus,localStreamRef,
  setVoiceRequestStatus,setInVoice,setMicEnabled,setVoiceMembers,setVoiceStreams,
  setNotice,startVoiceRealtime,refreshVoiceMembers,cleanupVoice,onReload,
}:Args){
  async function requestVoiceApproval(){
    if(isHost){await joinVoice();return}
    if(voiceRequestStatus==='accepted'){await joinVoice();return}
    const {error}=await s.rpc('request_lamma_voice_join',{p_space:id})
    if(error){setNotice('تعذر إرسال طلب الانضمام للصوت.');return}
    setVoiceRequestStatus('pending')
    setNotice('تم إرسال طلب المايك إلى الـHost.')
  }

  async function hostVoiceDecision(userId:string,accept:boolean){
    const {error}=await s.rpc('host_respond_lamma_voice_request',{
      p_space:id,
      p_user:userId,
      p_accept:accept,
    })
    setNotice(error?'تعذر تنفيذ القرار.':accept?'تمت الموافقة على طلب المايك.':'تم رفض طلب المايك.')
    await onReload()
  }

  async function joinVoice(){
    if(inVoice)return
    setNotice('')
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false})
      localStreamRef.current=stream
      setVoiceStreams([stream])

      const {error}=await s.rpc('enter_lamma_voice',{p_space:id})
      if(error){
        stream.getTracks().forEach(track=>track.stop())
        localStreamRef.current=null
        setVoiceStreams([])
        setNotice(error.message.includes('voice_requires_host_approval')?'لازم موافقة الـHost أولًا.':'تعذر دخول الصوت.')
        return
      }

      setInVoice(true)
      await startVoiceRealtime()
      await refreshVoiceMembers()
    }catch{
      setNotice('اسمح للموقع باستخدام الميكروفون ثم حاول مرة أخرى.')
    }
  }

  async function leaveVoice(){
    await s.rpc('leave_lamma_voice',{p_space:id})
    cleanupVoice()
    setVoiceStreams([])
    setInVoice(false)
    setMicEnabled(false)
    setVoiceMembers(current=>current.filter(member=>member.user_id!==uid))
  }

  async function toggleMic(){
    const next=!micEnabled
    const {error}=await s.rpc('set_lamma_mic',{p_space:id,p_enabled:next})
    if(error){
      setNotice(error.message.includes('mic_requires_seat')?'المايك متاح للمضيف أو الأشخاص الذين سمح لهم النظام بالكلام.':'تعذر تغيير حالة الميكروفون.')
      return
    }
    localStreamRef.current?.getAudioTracks().forEach(track=>{track.enabled=next})
    setMicEnabled(next)
  }

  return {
    requestVoiceApproval,
    hostVoiceDecision,
    joinVoice,
    leaveVoice,
    toggleMic,
  }
}
