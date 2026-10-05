'use client'

import {useEffect,useRef} from 'react'
import type {ChatCallRow} from '@/lib/chat-room'

type Args={
  s:any
  uid:string
  activeCall:ChatCallRow|null
  setNotice:(message:string)=>void
}

export function useChatWebRtc({s,uid,activeCall,setNotice}:Args){
  const peerRef=useRef<RTCPeerConnection|null>(null)
  const localStreamRef=useRef<MediaStream|null>(null)
  const remoteAudioRef=useRef<HTMLAudioElement|null>(null)
  const localVideoRef=useRef<HTMLVideoElement|null>(null)
  const remoteVideoRef=useRef<HTMLVideoElement|null>(null)
  const signalChannelRef=useRef<any>(null)
  const handledSignalsRef=useRef<Set<number>>(new Set())
  const pendingIceRef=useRef<RTCIceCandidateInit[]>([])

  function cleanupPeer(){
    if(signalChannelRef.current){
      s.removeChannel(signalChannelRef.current)
      signalChannelRef.current=null
    }

    peerRef.current?.close()
    peerRef.current=null

    localStreamRef.current?.getTracks().forEach(track=>track.stop())
    localStreamRef.current=null

    if(remoteAudioRef.current)remoteAudioRef.current.srcObject=null
    if(localVideoRef.current)localVideoRef.current.srcObject=null
    if(remoteVideoRef.current)remoteVideoRef.current.srcObject=null
  }

  useEffect(()=>{
    if(!activeCall||activeCall.status!=='accepted'||!uid)return

    let cancelled=false
    const callId=activeCall.id
    const callKind:ChatCallRow['call_kind']=activeCall.call_kind
    const isCaller=activeCall.caller_id===uid

    async function processSignal(signal:any){
      const pc=peerRef.current
      if(!pc)return
      if(signal.sender_id===uid)return
      if(handledSignalsRef.current.has(signal.id))return

      handledSignalsRef.current.add(signal.id)

      if(signal.signal_type==='offer'&&!isCaller){
        await pc.setRemoteDescription(signal.payload)

        for(const candidate of pendingIceRef.current.splice(0)){
          await pc.addIceCandidate(candidate).catch(()=>{})
        }

        const answer=await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await s.from('voice_call_signals').insert({
          call_id:callId,
          sender_id:uid,
          signal_type:'answer',
          payload:answer,
        })
        return
      }

      if(signal.signal_type==='answer'&&isCaller){
        if(!pc.remoteDescription){
          await pc.setRemoteDescription(signal.payload)
          for(const candidate of pendingIceRef.current.splice(0)){
            await pc.addIceCandidate(candidate).catch(()=>{})
          }
        }
        return
      }

      if(signal.signal_type==='ice'){
        if(pc.remoteDescription){
          await pc.addIceCandidate(signal.payload).catch(()=>{})
        }else{
          pendingIceRef.current.push(signal.payload)
        }
      }
    }

    async function beginRtc(){
      cleanupPeer()
      handledSignalsRef.current=new Set()
      pendingIceRef.current=[]

      try{
        const isVideo=callKind==='video'
        const stream=await navigator.mediaDevices.getUserMedia({
          audio:true,
          video:isVideo,
        })

        if(cancelled){
          stream.getTracks().forEach(track=>track.stop())
          return
        }

        localStreamRef.current=stream
        if(callKind==='video'&&localVideoRef.current){
          localVideoRef.current.srcObject=stream
          localVideoRef.current.muted=true
          localVideoRef.current.play().catch(()=>{})
        }

        const pc=new RTCPeerConnection({
          iceServers:[{urls:'stun:stun.l.google.com:19302'}],
        })
        peerRef.current=pc

        pc.oniceconnectionstatechange=()=>{
          if(pc.iceConnectionState==='failed'){
            setNotice('تعذر إنشاء اتصال صوتي مباشر على هذه الشبكة. يلزم TURN لضمان الاتصال على الشبكات المقيدة.')
          }
        }

        stream.getTracks().forEach(track=>pc.addTrack(track,stream))

        pc.ontrack=event=>{
          const incoming=event.streams[0]
          if(callKind==='video'&&remoteVideoRef.current){
            remoteVideoRef.current.srcObject=incoming
            remoteVideoRef.current.play().catch(()=>{})
          }else if(remoteAudioRef.current){
            remoteAudioRef.current.srcObject=incoming
            remoteAudioRef.current.play().catch(()=>{})
          }
        }

        pc.onicecandidate=async event=>{
          if(!event.candidate)return
          await s.from('voice_call_signals').insert({
            call_id:callId,
            sender_id:uid,
            signal_type:'ice',
            payload:event.candidate.toJSON(),
          })
        }

        const signalChannel=s
          .channel(`voice-signal-${callId}-${uid}`)
          .on(
            'postgres_changes',
            {
              event:'INSERT',
              schema:'public',
              table:'voice_call_signals',
              filter:`call_id=eq.${callId}`,
            },
            async(payload:any)=>{
              await processSignal(payload.new)
            }
          )
          .subscribe()

        signalChannelRef.current=signalChannel

        const {data:existing}=await s
          .from('voice_call_signals')
          .select('*')
          .eq('call_id',callId)
          .order('id',{ascending:true})

        for(const signal of existing||[])await processSignal(signal)

        if(isCaller&&!pc.localDescription){
          const offer=await pc.createOffer()
          await pc.setLocalDescription(offer)

          await s.from('voice_call_signals').insert({
            call_id:callId,
            sender_id:uid,
            signal_type:'offer',
            payload:offer,
          })
        }
      }catch{
        setNotice(callKind==='video'
          ?'تعذر تشغيل الكاميرا أو الميكروفون. اسمح بالوصول ثم حاول مرة أخرى.'
          :'تعذر تشغيل الميكروفون. اسمح للموقع باستخدام الميكروفون وحاول مرة أخرى.')
      }
    }

    beginRtc()

    return()=>{
      cancelled=true
      cleanupPeer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeCall?.id,activeCall?.status,uid])

  return {
    remoteAudioRef,
    localVideoRef,
    remoteVideoRef,
    cleanupPeer,
  }
}
