'use client'
import {useEffect,useMemo,useRef,useState} from 'react'

type Props={streams:MediaStream[];active?:boolean;compact?:boolean}
const BAR_COUNT=18
const idleLevels=[.24,.42,.68,.5,.82,.58,.36,.72,.94,.62,.48,.8,.56,.34,.66,.86,.52,.3]

export function VoiceGlowBar({streams,active=true,compact=false}:Props){
  const [levels,setLevels]=useState<number[]>(idleLevels)
  const raf=useRef<number|null>(null)
  const streamKey=useMemo(()=>streams.map(x=>x.id).sort().join('|'),[streams])

  useEffect(()=>{
    if(raf.current){cancelAnimationFrame(raf.current);raf.current=null}
    if(!active||!streams.length){setLevels(idleLevels);return}
    const AudioContextCtor=window.AudioContext||(window as any).webkitAudioContext
    if(!AudioContextCtor)return
    const ctx=new AudioContextCtor() as AudioContext
    const analysers:AnalyserNode[]=[];const sources:MediaStreamAudioSourceNode[]=[]
    for(const stream of streams){
      if(!stream.getAudioTracks().some(t=>t.readyState==='live'))continue
      try{const source=ctx.createMediaStreamSource(stream);const analyser=ctx.createAnalyser();analyser.fftSize=128;analyser.smoothingTimeConstant=.72;source.connect(analyser);sources.push(source);analysers.push(analyser)}catch{}
    }
    ctx.resume().catch(()=>{})
    const data=new Uint8Array(64)
    const tick=()=>{
      let energy=0
      for(const analyser of analysers){analyser.getByteFrequencyData(data);let sum=0;for(let i=0;i<data.length;i++)sum+=data[i];energy=Math.max(energy,sum/(data.length*255))}
      const now=performance.now()/220
      setLevels(Array.from({length:BAR_COUNT},(_,i)=>Math.max(.12,Math.min(1,.16+energy*2.8*(.58+.24*Math.sin(now+i*.72)+.12*Math.sin(now*.67+i*1.31))))))
      raf.current=requestAnimationFrame(tick)
    }
    tick()
    return()=>{if(raf.current){cancelAnimationFrame(raf.current);raf.current=null}for(const source of sources){try{source.disconnect()}catch{}}for(const analyser of analysers){try{analyser.disconnect()}catch{}}ctx.close().catch(()=>{})}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[active,streamKey])

  return <div className={`voice-glow-bar ${compact?'voice-glow-bar--compact':''}`} data-active={active?'true':'false'} data-live={active&&streams.length>0?'true':'false'} aria-hidden="true">
    {levels.slice(0,BAR_COUNT).map((level,i)=><span key={i} className="voice-glow-bar__bar" style={{['--bar-i' as any]:i,transform:`scaleY(${active?level:.12})`,opacity:active?.96:.36}}/>)}
  </div>
}
