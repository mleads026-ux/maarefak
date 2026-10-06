'use client'

import {useEffect,useRef,useState} from 'react'
import type {ChatCallRow} from '@/lib/chat-room'
import {loadRtcIceServers} from '@/lib/rtc-client'

type Args={
  s:any
  uid:string
  activeCall:ChatCallRow|null
  setNotice:(message:string)=>void
}

export function useChatWebRtc({s,uid,activeCall,setNotice}:Args){
  const peerRef=useRef<RTCPeerConnection|null>(null)
  const localStreamRef=useRef<MediaStream|null>(null)
  const remoteStreamRef=useRef<MediaStream|null>(null)
  const remoteAudioRef=useRef<HTMLAudioElement|null>(null)
  const localVideoRef=useRef<HTMLVideoElement|null>(null)
  const remoteVideoRef=useRef<HTMLVideoElement|null>(null)
  const signalChannelRef=useRef<any>(null)
  const handledSignalsRef=useRef<Set<number>>(new Set())
  const pendingIceRef=useRef<RTCIceCandidateInit[]>([])
  const videoSenderRef=useRef<RTCRtpSender|null>(null)
  const privacyStreamRef=useRef<MediaStream|null>(null)
  const privacyVideoRef=useRef<HTMLVideoElement|null>(null)
  const privacyCanvasRef=useRef<HTMLCanvasElement|null>(null)
  const privacyFrameRef=useRef<number|null>(null)
  const videoPrivacyModeRef=useRef<'normal'|'blur'|'hidden'>('normal')
  const [micMuted,setMicMuted]=useState(false)
  const [cameraFacing,setCameraFacing]=useState<'user'|'environment'>('user')
  const [videoPrivacyMode,setVideoPrivacyModeState]=useState<'normal'|'blur'|'hidden'>('normal')

  function bindLocalVideo(el:HTMLVideoElement|null){
    localVideoRef.current=el
    if(el&&localStreamRef.current){
      el.srcObject=localStreamRef.current
      el.muted=true
      void el.play().catch(()=>{})
    }
  }

  function bindRemoteVideo(el:HTMLVideoElement|null){
    remoteVideoRef.current=el
    if(el&&remoteStreamRef.current){
      el.srcObject=remoteStreamRef.current
      void el.play().catch(()=>{})
    }
  }

  function setPrivacyState(mode:'normal'|'blur'|'hidden'){
    videoPrivacyModeRef.current=mode
    setVideoPrivacyModeState(mode)
  }

  function stopPrivacyPipeline(){
    if(privacyFrameRef.current!=null){
      cancelAnimationFrame(privacyFrameRef.current)
      privacyFrameRef.current=null
    }
    privacyStreamRef.current?.getTracks().forEach(track=>track.stop())
    privacyStreamRef.current=null
    if(privacyVideoRef.current){
      privacyVideoRef.current.pause()
      privacyVideoRef.current.srcObject=null
    }
    privacyVideoRef.current=null
    privacyCanvasRef.current=null
  }

  async function buildPrivacyTrack(mode:'blur'|'hidden'){
    const source=localStreamRef.current?.getVideoTracks()[0]
    if(!source)throw new Error('camera_unavailable')

    const canvas=document.createElement('canvas')
    const capture=(canvas as HTMLCanvasElement & {captureStream?:(fps?:number)=>MediaStream}).captureStream
    if(typeof capture!=='function')throw new Error('canvas_capture_unsupported')

    const settings=source.getSettings()
    canvas.width=Math.max(320,Number(settings.width)||640)
    canvas.height=Math.max(240,Number(settings.height)||480)
    const ctx=canvas.getContext('2d')
    if(!ctx)throw new Error('canvas_context_unavailable')
    if(mode==='blur'){
      const previousFilter=ctx.filter
      ctx.filter='blur(22px)'
      if(!ctx.filter||ctx.filter==='none')throw new Error('canvas_blur_unsupported')
      ctx.filter=previousFilter
    }

    let processor:HTMLVideoElement|null=null
    if(mode==='blur'){
      processor=document.createElement('video')
      processor.muted=true
      processor.playsInline=true
      processor.srcObject=new MediaStream([source])
      await processor.play()
      privacyVideoRef.current=processor
    }

    const draw=()=>{
      const width=canvas.width
      const height=canvas.height
      ctx.save()
      ctx.clearRect(0,0,width,height)
      if(mode==='hidden'){
        ctx.fillStyle='#05070b'
        ctx.fillRect(0,0,width,height)
      }else if(processor&&processor.readyState>=2){
        ctx.filter='blur(22px)'
        const bleed=34
        ctx.drawImage(processor,-bleed,-bleed,width+bleed*2,height+bleed*2)
        ctx.filter='none'
        ctx.fillStyle='rgba(4,10,25,.10)'
        ctx.fillRect(0,0,width,height)
      }else{
        ctx.fillStyle='#05070b'
        ctx.fillRect(0,0,width,height)
      }
      ctx.restore()
      privacyFrameRef.current=requestAnimationFrame(draw)
    }
    draw()

    const privacyStream=capture.call(canvas,15)
    const track=privacyStream.getVideoTracks()[0]
    if(!track)throw new Error('privacy_track_unavailable')
    privacyCanvasRef.current=canvas
    privacyStreamRef.current=privacyStream
    return track
  }

  async function applyVideoPrivacy(mode:'normal'|'blur'|'hidden'){
    if(activeCall?.call_kind!=='video')return false
    const sender=videoSenderRef.current
    const source=localStreamRef.current?.getVideoTracks()[0]
    if(!sender||!source){
      setNotice('الكاميرا غير جاهزة بعد.')
      return false
    }

    try{
      if(mode==='normal'){
        source.enabled=true
        await sender.replaceTrack(source)
        stopPrivacyPipeline()
        setPrivacyState('normal')
        return true
      }

      stopPrivacyPipeline()
      source.enabled=true
      const privacyTrack=await buildPrivacyTrack(mode)
      await sender.replaceTrack(privacyTrack)
      setPrivacyState(mode)
      return true
    }catch{
      // Security-first fallback: if real-time blur processing is unsupported,
      // never fall back to sending the clear camera feed.
      stopPrivacyPipeline()
      await sender.replaceTrack(null).catch(()=>{})
      source.enabled=false
      setPrivacyState('hidden')
      setNotice(mode==='blur'
        ?'الـ Blur غير مدعوم على هذا المتصفح؛ تم إخفاء الفيديو عن الطرف الآخر بدلًا منه.'
        :'تم إخفاء الفيديو عن الطرف الآخر.')
      return false
    }
  }

  async function cycleVideoPrivacy(){
    const current=videoPrivacyModeRef.current
    const next=current==='normal'?'blur':current==='blur'?'hidden':'normal'
    await applyVideoPrivacy(next)
  }

  function cleanupPeer(){
    if(signalChannelRef.current){
      s.removeChannel(signalChannelRef.current)
      signalChannelRef.current=null
    }
    stopPrivacyPipeline()
    peerRef.current?.close()
    peerRef.current=null
    videoSenderRef.current=null
    localStreamRef.current?.getTracks().forEach(track=>track.stop())
    localStreamRef.current=null
    remoteStreamRef.current=null
    if(remoteAudioRef.current)remoteAudioRef.current.srcObject=null
    if(localVideoRef.current)localVideoRef.current.srcObject=null
    if(remoteVideoRef.current)remoteVideoRef.current.srcObject=null
    setMicMuted(false)
    setCameraFacing('user')
    setPrivacyState('normal')
  }

  function toggleMic(){
    const track=localStreamRef.current?.getAudioTracks()[0]
    if(!track){
      setNotice('الميكروفون غير متاح بعد.')
      return
    }
    track.enabled=!track.enabled
    setMicMuted(!track.enabled)
  }

  async function switchCamera(){
    if(activeCall?.call_kind!=='video')return
    const pc=peerRef.current
    const stream=localStreamRef.current
    if(!pc||!stream){
      setNotice('الكاميرا غير جاهزة بعد.')
      return
    }
    const next=cameraFacing==='user'?'environment':'user'
    try{
      const nextStream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:next}},
        audio:false,
      })
      const nextTrack=nextStream.getVideoTracks()[0]
      if(!nextTrack)throw new Error('camera_unavailable')
      const sender=videoSenderRef.current
      if(videoPrivacyModeRef.current==='normal'&&sender)await sender.replaceTrack(nextTrack)
      const old=stream.getVideoTracks()[0]
      if(old){
        stream.removeTrack(old)
        old.stop()
      }
      stream.addTrack(nextTrack)
      if(localVideoRef.current){
        localVideoRef.current.srcObject=stream
        void localVideoRef.current.play().catch(()=>{})
      }
      setCameraFacing(next)
      if(videoPrivacyModeRef.current!=='normal')await applyVideoPrivacy(videoPrivacyModeRef.current)
    }catch{
      setNotice('تعذر تبديل الكاميرا على هذا الجهاز.')
    }
  }

  async function chooseAudioOutput(){
    const mediaDevices:any=navigator.mediaDevices
    const audio:any=remoteAudioRef.current
    if(!mediaDevices||typeof mediaDevices.selectAudioOutput!=='function'||!audio||typeof audio.setSinkId!=='function'){
      setNotice('اختيار السماعة أو مخرج الصوت غير مدعوم من هذا المتصفح. استخدم تحكم الصوت في الجهاز.')
      return false
    }
    try{
      const device=await mediaDevices.selectAudioOutput()
      await audio.setSinkId(device.deviceId)
      setNotice('تم تغيير مخرج الصوت.')
      return true
    }catch{
      setNotice('لم يتم تغيير مخرج الصوت.')
      return false
    }
  }

  useEffect(()=>{
    if(!activeCall||activeCall.status!=='accepted'||!uid)return

    let cancelled=false
    const callId=activeCall.id
    const callKind=activeCall.call_kind
    const isCaller=activeCall.caller_id===uid
    const acceptedAt=activeCall.accepted_at

    async function processSignal(signal:any){
      const pc=peerRef.current
      if(!pc||signal.sender_id===uid||handledSignalsRef.current.has(signal.id))return
      handledSignalsRef.current.add(signal.id)

      try{
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
          if(pc.localDescription&&!pc.remoteDescription){
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
      }catch{
        // Stale signaling rows can exist when reconnecting a call.
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
          video:isVideo?{facingMode:{ideal:cameraFacing}}:false,
        })

        if(cancelled){
          stream.getTracks().forEach(track=>track.stop())
          return
        }

        localStreamRef.current=stream
        if(isVideo&&localVideoRef.current){
          localVideoRef.current.srcObject=stream
          localVideoRef.current.muted=true
          void localVideoRef.current.play().catch(()=>{})
        }

        const pc=new RTCPeerConnection({
          iceServers:await loadRtcIceServers(),
        })
        peerRef.current=pc

        pc.oniceconnectionstatechange=()=>{
          if(pc.iceConnectionState==='failed'){
            setNotice('تعذر إنشاء الاتصال المباشر على هذه الشبكة. يلزم TURN لضمان المكالمات على الشبكات المقيدة.')
          }
        }

        stream.getTracks().forEach(track=>{
          const sender=pc.addTrack(track,stream)
          if(track.kind==='video')videoSenderRef.current=sender
        })

        pc.ontrack=event=>{
          const incoming=event.streams[0]
          remoteStreamRef.current=incoming

          // Keep remote audio attached to the persistent hidden audio element.
          // This preserves sound when a video call is minimized and its video UI unmounts.
          if(remoteAudioRef.current){
            remoteAudioRef.current.srcObject=incoming
            void remoteAudioRef.current.play().catch(()=>{})
          }

          if(callKind==='video'&&remoteVideoRef.current){
            remoteVideoRef.current.srcObject=incoming
            void remoteVideoRef.current.play().catch(()=>{})
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
            async(payload:any)=>{await processSignal(payload.new)}
          )
          .subscribe()

        signalChannelRef.current=signalChannel

        let q=s
          .from('voice_call_signals')
          .select('*')
          .eq('call_id',callId)
          .order('id',{ascending:true})

        if(acceptedAt)q=q.gte('created_at',acceptedAt)
        const {data:existing}=await q
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

    void beginRtc()

    return()=>{
      cancelled=true
      cleanupPeer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeCall?.id,activeCall?.status,uid])

  return {
    remoteAudioRef,
    bindLocalVideo,
    bindRemoteVideo,
    cleanupPeer,
    micMuted,
    cameraFacing,
    videoPrivacyMode,
    toggleMic,
    switchCamera,
    applyVideoPrivacy,
    cycleVideoPrivacy,
    chooseAudioOutput,
  }
}
