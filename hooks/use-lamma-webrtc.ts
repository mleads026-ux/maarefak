'use client'

import {useRef,type Dispatch,type MutableRefObject,type SetStateAction} from 'react'
import type {LammaVoiceParticipant} from '@/lib/lamma-room'

type Args={
  s:any
  id:string
  uid:string
  localStreamRef:MutableRefObject<MediaStream|null>
  setVoiceMembers:Dispatch<SetStateAction<LammaVoiceParticipant[]>>
  setMicEnabled:Dispatch<SetStateAction<boolean>>
  setVoiceStreams:Dispatch<SetStateAction<MediaStream[]>>
  setNotice:Dispatch<SetStateAction<string>>
}

export function useLammaWebRtc({
  s,id,uid,localStreamRef,setVoiceMembers,setMicEnabled,setVoiceStreams,setNotice,
}:Args){
  const peersRef=useRef<Map<string,RTCPeerConnection>>(new Map())
  const audiosRef=useRef<Map<string,HTMLAudioElement>>(new Map())
  const peerStreamsRef=useRef<Map<string,MediaStream>>(new Map())
  const pendingIceRef=useRef<Map<string,RTCIceCandidateInit[]>>(new Map())
  const voiceChannelRef=useRef<any>(null)

  function ensurePeer(peerId:string){
    const existing=peersRef.current.get(peerId)
    if(existing)return existing

    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]})
    pc.oniceconnectionstatechange=()=>{
      if(pc.iceConnectionState==='failed'){
        setNotice('تعذر اتصال الصوت بأحد المشاركين على هذه الشبكة. يلزم TURN لضمان الاتصال على الشبكات المقيدة.')
      }
    }
    localStreamRef.current?.getTracks().forEach(track=>pc.addTrack(track,localStreamRef.current!))

    pc.onicecandidate=async(event)=>{
      if(!event.candidate)return
      await s.from('space_voice_signals').insert({
        space_id:id,sender_id:uid,target_id:peerId,signal_type:'ice',payload:event.candidate.toJSON()
      })
    }

    pc.ontrack=(event)=>{
      let audio=audiosRef.current.get(peerId)
      if(!audio){
        audio=new Audio()
        audio.autoplay=true
        audiosRef.current.set(peerId,audio)
      }
      const incoming=event.streams[0]
      peerStreamsRef.current.set(peerId,incoming)
      setVoiceStreams(current=>current.some(x=>x.id===incoming.id)?current:[...current,incoming])
      audio.srcObject=incoming
      audio.play().catch(()=>{})
    }

    peersRef.current.set(peerId,pc)
    return pc
  }

  async function makeOffer(peerId:string){
    const pc=ensurePeer(peerId)
    if(pc.signalingState!=='stable'||pc.localDescription)return
    const offer=await pc.createOffer()
    await pc.setLocalDescription(offer)
    await s.from('space_voice_signals').insert({
      space_id:id,sender_id:uid,target_id:peerId,signal_type:'offer',payload:offer
    })
  }

  async function handleSignal(signal:any){
    const peerId=signal.sender_id
    const pc=ensurePeer(peerId)

    if(signal.signal_type==='offer'){
      await pc.setRemoteDescription(signal.payload)
      const queue=pendingIceRef.current.get(peerId)||[]
      for(const candidate of queue)await pc.addIceCandidate(candidate).catch(()=>{})
      pendingIceRef.current.delete(peerId)
      const answer=await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await s.from('space_voice_signals').insert({
        space_id:id,sender_id:uid,target_id:peerId,signal_type:'answer',payload:answer
      })
      return
    }

    if(signal.signal_type==='answer'){
      if(!pc.remoteDescription)await pc.setRemoteDescription(signal.payload)
      return
    }

    if(signal.signal_type==='ice'){
      if(pc.remoteDescription)await pc.addIceCandidate(signal.payload).catch(()=>{})
      else{
        const queue=pendingIceRef.current.get(peerId)||[]
        queue.push(signal.payload)
        pendingIceRef.current.set(peerId,queue)
      }
    }
  }

  function closePeer(peerId:string){
    peersRef.current.get(peerId)?.close()
    peersRef.current.delete(peerId)

    const audio=audiosRef.current.get(peerId)
    if(audio){audio.pause();audio.srcObject=null}
    audiosRef.current.delete(peerId)

    const stream=peerStreamsRef.current.get(peerId)
    if(stream){
      peerStreamsRef.current.delete(peerId)
      setVoiceStreams(current=>current.filter(x=>x.id!==stream.id))
    }
    pendingIceRef.current.delete(peerId)
  }

  async function refreshVoiceMembers(){
    const {data}=await s.from('space_voice_participants')
      .select('user_id,mic_enabled,profiles(display_name,avatar_url)')
      .eq('space_id',id)

    const rows=(data||[]) as LammaVoiceParticipant[]
    setVoiceMembers(rows)

    const own=rows.find(x=>x.user_id===uid)
    if(own){
      const allowed=Boolean(own.mic_enabled)
      setMicEnabled(allowed)
      localStreamRef.current?.getAudioTracks().forEach(track=>{track.enabled=allowed})
    }

    for(const participant of rows){
      if(participant.user_id===uid)continue
      if(uid<participant.user_id)await makeOffer(participant.user_id)
      else ensurePeer(participant.user_id)
    }
  }

  async function startVoiceRealtime(){
    if(voiceChannelRef.current)return

    const channel=s.channel(`lamma-voice-${id}-${uid}`)
      .on('postgres_changes',{
        event:'*',schema:'public',table:'space_voice_participants',filter:`space_id=eq.${id}`
      },async(payload:any)=>{
        await refreshVoiceMembers()
        if(payload.eventType==='DELETE')closePeer(payload.old.user_id)
      })
      .on('postgres_changes',{
        event:'INSERT',schema:'public',table:'space_voice_signals',filter:`space_id=eq.${id}`
      },async(payload:any)=>{
        const signal=payload.new
        if(signal.target_id!==uid)return
        await handleSignal(signal)
      })
      .subscribe()

    voiceChannelRef.current=channel
  }

  function cleanupVoice(){
    if(voiceChannelRef.current){
      s.removeChannel(voiceChannelRef.current)
      voiceChannelRef.current=null
    }
    peersRef.current.forEach(pc=>pc.close())
    peersRef.current.clear()
    audiosRef.current.forEach(audio=>{audio.pause();audio.srcObject=null})
    audiosRef.current.clear()
    peerStreamsRef.current.clear()
    localStreamRef.current?.getTracks().forEach(track=>track.stop())
    localStreamRef.current=null
    pendingIceRef.current.clear()
  }

  return {
    refreshVoiceMembers,
    startVoiceRealtime,
    cleanupVoice,
  }
}
