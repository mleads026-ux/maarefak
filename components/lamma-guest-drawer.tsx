'use client'

import {
  Check,Crown,MessageSquare,MessageSquareOff,Mic,ShieldCheck,Swords,
  UserMinus,Volume2,VolumeX,X
} from 'lucide-react'
import {findLammaVoiceParticipant,type LammaMember,type LammaVoiceParticipant} from '@/lib/lamma-room'

type VoiceRequest={
  user_id:string
  display_name?:string|null
  avatar_url?:string|null
}

type RoyalAction='mute_voice'|'unmute_voice'|'mute_text'|'unmute_text'|'kick'

type Props={
  open:boolean
  uid:string
  isHost:boolean
  isRoyal:boolean
  royalBusy:boolean
  royalId?:string|null
  ownerId?:string|null
  orderedGuests:LammaMember[]
  royalMember:LammaMember|null
  challengeA:LammaMember|null
  challengeB:LammaMember|null
  spotlight:any
  voiceMembers:LammaVoiceParticipant[]
  voiceRequests:VoiceRequest[]
  challengePick:string[]
  micPick:string[]
  onClose:()=>void
  onSelectMember:(member:LammaMember)=>void
  onAssignRoyal:(member:LammaMember)=>void
  onRoyalAction:(target:string,action:RoyalAction)=>void
  onToggleChallengePick:(userId:string)=>void
  onToggleMicPick:(userId:string)=>void
  onApplySelectedMics:()=>void
  onSetNewChallenge:()=>void
  onVoiceDecision:(userId:string,accept:boolean)=>void
}

export function LammaGuestDrawer({
  open,uid,isHost,isRoyal,royalBusy,royalId,ownerId,orderedGuests,royalMember,
  challengeA,challengeB,spotlight,voiceMembers,voiceRequests,challengePick,micPick,
  onClose,onSelectMember,onAssignRoyal,onRoyalAction,onToggleChallengePick,
  onToggleMicPick,onApplySelectedMics,onSetNewChallenge,onVoiceDecision,
}:Props){
  if(!open)return null

  return <div className="fixed inset-0 z-[100] bg-black/45" onClick={onClose}>
    <div className="relative mx-auto h-full w-full max-w-[432px]">
      <aside onClick={e=>e.stopPropagation()} className="absolute right-0 top-0 h-full w-[89%] overflow-y-auto rounded-l-[30px] bg-white p-4 pb-28 text-[#0b1734] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white pb-3">
          <div><h3 className="text-xl font-black">الضيوف</h3><p className="text-[10px] font-bold text-[#78849a]">بالترتيب داخل اللَمّة</p></div>
          <button onClick={onClose} className="tap-action grid h-10 w-10 place-items-center rounded-full bg-[#eef3f8]"><X size={20}/></button>
        </div>

        {isRoyal?<div className="mb-3 rounded-[20px] bg-[linear-gradient(135deg,#fff8d8,#fff,#eef7ff)] p-3 ring-1 ring-[#ead38a]">
          <div className="flex items-center gap-2"><Crown size={18} className="text-[#b67a00]"/><p className="text-sm font-black">تحكم الضيف الملكي</p></div>
          <p className="mt-1 text-[10px] font-bold text-[#7d6b42]">اختر شخصين للتحدي، أو حدد مين مسموح له بالمايك.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button disabled={challengePick.length!==2||royalBusy} onClick={onSetNewChallenge} className="tap-action rounded-xl bg-[#6e32e8] px-3 py-2 text-[10px] font-black text-white disabled:opacity-40">تعيين التحدي ({challengePick.length}/2)</button>
            <button disabled={royalBusy} onClick={onApplySelectedMics} className="tap-action rounded-xl bg-[#1768f4] px-3 py-2 text-[10px] font-black text-white disabled:opacity-40">تطبيق المايكات المحددة</button>
          </div>
        </div>:null}

        {isHost&&voiceRequests.length?<div className="mb-3 rounded-[20px] bg-[#eef7ff] p-3 ring-1 ring-[#cfe3fb]">
          <p className="mb-2 text-xs font-black">طلبات المايك 🎙️</p>
          <div className="space-y-2">{voiceRequests.map(q=><div key={q.user_id} className="flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-[#e3ebf5]">
            {q.avatar_url?<img src={q.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover"/>:<span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf4fb] text-xs font-black">{(q.display_name||'ض')[0]}</span>}
            <span className="flex-1 truncate text-[10px] font-black">{q.display_name||'ضيف'}</span>
            <button onClick={()=>onVoiceDecision(q.user_id,true)} className="tap-action rounded-lg bg-[#17b984] px-2 py-1 text-[9px] font-black text-white">قبول</button>
            <button onClick={()=>onVoiceDecision(q.user_id,false)} className="tap-action rounded-lg bg-[#fff0f2] px-2 py-1 text-[9px] font-black text-[#d62449]">رفض</button>
          </div>)}</div>
        </div>:null}

        <div className="space-y-2">
          {orderedGuests.map((member,index)=>{
            const isRoyalRow=member.user_id===royalId
            const isChallenge=member.user_id===spotlight?.user_a||member.user_id===spotlight?.user_b
            const voice=findLammaVoiceParticipant(voiceMembers,member.user_id)
            const canRoyalControl=isRoyal&&member.user_id!==uid&&member.user_id!==ownerId

            return <div key={member.user_id} className={`rounded-[20px] p-3 ring-1 ${isRoyalRow?'bg-[#fff8dc] ring-[#edd57e]':isChallenge?'bg-[#f4edff] ring-[#cdb8ff]':'bg-[#f7f9fc] ring-[#e3eaf3]'}`}>
              <div className="flex items-center gap-3">
                <span className={`shrink-0 rounded-full p-[2px] ${isRoyalRow?'royal-avatar-frame':isChallenge?'challenge-avatar-frame':'ornate-silver-ring'}`}>
                  {member.profiles?.avatar_url?<img src={member.profiles.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover"/>:<span className="grid h-11 w-11 place-items-center rounded-full bg-[#dfeaf7] font-black text-[#1768f4]">{(member.profiles?.display_name||'ض')[0]}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{member.profiles?.display_name||'ضيف'}</p>
                  <p className="mt-0.5 text-[9px] font-bold text-[#77849a]">
                    {isRoyalRow?'👑 الضيف الملكي':isChallenge?`⚔️ تحدي ${member.user_id===spotlight?.user_a?'1':'2'}`:`ضيف ${Math.max(1,index-(royalMember?1:0)-(challengeA?1:0)-(challengeB?1:0)+1)}`}
                    {voice?` · ${voice.mic_enabled?'المايك مفتوح':'المايك مقفول'}`:' · خارج الصوت'}
                  </p>
                </div>
                {member.user_id!==uid?<button onClick={()=>onSelectMember(member)} className="tap-action rounded-full bg-white px-2 py-1 text-[9px] font-black text-[#1768f4] ring-1 ring-[#dce7f4]">الملف</button>:null}
              </div>

              {isHost&&!isRoyalRow?<button onClick={()=>onAssignRoyal(member)} className="tap-action mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[#fff5c9] px-3 py-2 text-[10px] font-black text-[#8d6200] ring-1 ring-[#f0d777]"><Crown size={13}/> {member.user_id===uid?'عيّن نفسك ضيف ملكي':'تعيين ضيف ملكي'} · 150 ⭐</button>:null}

              {canRoyalControl?<div className="mt-2 grid grid-cols-3 gap-1.5">
                <button onClick={()=>onRoyalAction(member.user_id,voice?.mic_enabled?'mute_voice':'unmute_voice')} disabled={royalBusy} className="tap-action flex items-center justify-center gap-1 rounded-xl bg-white px-2 py-2 text-[9px] font-black ring-1 ring-[#e0e8f2]">
                  {voice?.mic_enabled?<VolumeX size={12}/>:<Volume2 size={12}/>} {voice?.mic_enabled?'قفل المايك':'فتح المايك'}
                </button>
                <button onClick={()=>onRoyalAction(member.user_id,'mute_text')} disabled={royalBusy} className="tap-action flex items-center justify-center gap-1 rounded-xl bg-white px-2 py-2 text-[9px] font-black ring-1 ring-[#e0e8f2]"><MessageSquareOff size={12}/> قفل الشات</button>
                <button onClick={()=>onRoyalAction(member.user_id,'kick')} disabled={royalBusy} className="tap-action flex items-center justify-center gap-1 rounded-xl bg-[#fff0f2] px-2 py-2 text-[9px] font-black text-[#d62449] ring-1 ring-[#ffd1da]"><UserMinus size={12}/> حذف</button>

                <button onClick={()=>onToggleChallengePick(member.user_id)} className={`tap-action col-span-2 flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[9px] font-black ${challengePick.includes(member.user_id)?'bg-[#6e32e8] text-white':'bg-[#f0eaff] text-[#6e32e8]'}`}>
                  <Swords size={12}/>{challengePick.includes(member.user_id)?'مختار للتحدي':'اختيار للتحدي'}
                </button>
                <button onClick={()=>onToggleMicPick(member.user_id)} className={`tap-action flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[9px] font-black ${micPick.includes(member.user_id)?'bg-[#1768f4] text-white':'bg-[#eaf3ff] text-[#1768f4]'}`}>
                  {micPick.includes(member.user_id)?<Check size={12}/>:<Mic size={12}/>} مايك
                </button>

                <button onClick={()=>onRoyalAction(member.user_id,'unmute_text')} disabled={royalBusy} className="tap-action col-span-3 flex items-center justify-center gap-1 rounded-xl bg-[#ebfaf4] px-2 py-2 text-[9px] font-black text-[#12855f]"><MessageSquare size={12}/> فتح الشات لهذا الضيف</button>
              </div>:null}
            </div>
          })}
        </div>

        {isRoyal?<div className="mt-4 flex items-center gap-2 rounded-[18px] bg-[#eef7ff] p-3 text-[10px] font-bold text-[#315b91]"><ShieldCheck size={18} className="shrink-0 text-[#1768f4]"/>صلاحيات التحكم دي تظهر وتعمل للضيف الملكي الحالي فقط.</div>:null}
      </aside>
    </div>
  </div>
}
