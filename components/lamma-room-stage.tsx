'use client'

import {ChevronLeft,Crown,Headphones,Mic,MicOff,Swords,Users} from 'lucide-react'
import {VoiceGlowBar} from '@/components/voice-glow-bar'
import {findLammaVoiceParticipant,type LammaMember,type LammaVoiceParticipant} from '@/lib/lamma-room'

type Props={
  chatExpanded:boolean
  space:any
  members:LammaMember[]
  voiceMembers:LammaVoiceParticipant[]
  voiceStreams:MediaStream[]
  inVoice:boolean
  isHost:boolean
  uid:string
  hostMember:LammaMember|null
  royalMember:LammaMember|null
  challengeA:LammaMember|null
  challengeB:LammaMember|null
  otherGuests:LammaMember[]
  voiceRequestStatus:'none'|'pending'|'accepted'|'rejected'|'host'
  micEnabled:boolean
  voiceRequestsCount:number
  onShowGuests:()=>void
  onBack:()=>void
  onSelectMember:(member:LammaMember)=>void
  onAssignRoyal:(member:LammaMember)=>void
  onRequestVoiceApproval:()=>void
  onToggleMic:()=>void
  onLeaveVoice:()=>void
}

export function LammaRoomStage({
  chatExpanded,space,members,voiceMembers,voiceStreams,inVoice,isHost,uid,
  hostMember,royalMember,challengeA,challengeB,otherGuests,voiceRequestStatus,
  micEnabled,voiceRequestsCount,onShowGuests,onBack,onSelectMember,onAssignRoyal,
  onRequestVoiceApproval,onToggleMic,onLeaveVoice,
}:Props){
  const renderAvatar=(member:LammaMember|null,size='h-12 w-12')=>{
    const name=member?.profiles?.display_name||'ضيف'
    return member?.profiles?.avatar_url
      ? <img src={member.profiles.avatar_url} alt="" className={`${size} rounded-full object-cover`}/>
      : <span className={`${size} grid place-items-center rounded-full bg-white/20 text-lg font-black text-white`}>{name[0]}</span>
  }

  return <>
    <div className={`relative z-10 flex shrink-0 flex-col overflow-hidden transition-[height] duration-300 ${chatExpanded?'h-[18%]':'h-[55%]'}`}>
      <div className="relative flex items-center justify-center pt-1">
        <button onClick={onShowGuests} className="tap-action absolute right-0 top-0 flex items-center gap-2 rounded-full border border-white/30 bg-white/16 px-3 py-2 text-xs font-black backdrop-blur">
          <Users size={17}/> الضيوف <span className="rounded-full bg-white/20 px-2 py-0.5">{members.length}</span>
        </button>
        <button onClick={onBack} aria-label="رجوع" className="tap-action absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-white/16">
          <ChevronLeft size={20}/>
        </button>
        <div className="max-w-[210px] text-center">
          <p className="truncate text-[18px] font-black">{space?.emoji||'🎙️'} {space?.name||'اللَمّة'}</p>
          <p className="mt-0.5 text-[10px] font-bold text-white/75">اللَمّة شغالة · {voiceMembers.length} بالصوت {space?.public_lamma_id?` · ${space.public_lamma_id}`:""}</p>
        </div>
      </div>

      <VoiceGlowBar streams={voiceStreams} active={inVoice||voiceMembers.length>0} compact/>

      <div className="mt-2 grid grid-cols-[1fr_1.25fr] items-center gap-3">
        <div className="rounded-[20px] border border-white/25 bg-white/10 p-2 text-center">
          <p className="mb-1 text-[10px] font-black text-[#ffe083]">👑 الضيف الملكي</p>
          {royalMember
            ? <button onClick={()=>royalMember.user_id!==uid&&onSelectMember(royalMember)} className="tap-action">
                <span className="royal-avatar-frame mx-auto block h-[72px] w-[72px] rounded-full p-[3px]">
                  {renderAvatar(royalMember,'h-full w-full')}
                </span>
                <span className="mt-1 block max-w-[110px] truncate text-[11px] font-black">{royalMember.profiles?.display_name||'الضيف الملكي'}</span>
              </button>
            : isHost&&hostMember
              ? <button onClick={()=>onAssignRoyal(hostMember)} className="tap-action mx-auto flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-2 border-dashed border-[#ffe28e]/70 bg-white/10 text-[9px] font-black">
                  <Crown size={18}/><span>عيّن نفسك ملكي</span><span className="text-[#ffe083]">150 ⭐</span>
                </button>
              : <div className="mx-auto flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-2 border-dashed border-[#ffe28e]/70 bg-white/10 text-[9px] font-black">
                  <Crown size={18}/><span>يختاره الـHost</span><span className="text-[#ffe083]">150 ⭐</span>
                </div>
          }
        </div>

        <div className="rounded-[20px] border border-white/25 bg-white/10 p-2">
          <p className="mb-1 text-center text-[10px] font-black">⚔️ التحدي الآن</p>
          <div className="flex items-center justify-center gap-2">
            {[challengeA,challengeB].map((member,index)=>
              member
                ? <button key={member.user_id} onClick={()=>member.user_id!==uid&&onSelectMember(member)} className="tap-action min-w-0 text-center">
                    <span className="challenge-avatar-frame mx-auto block h-[58px] w-[58px] rounded-full p-[3px]">{renderAvatar(member,'h-full w-full')}</span>
                    <span className="mt-1 block max-w-[70px] truncate text-[9px] font-black">{member.profiles?.display_name||'متحدي'}</span>
                  </button>
                : <span key={index} className="grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-dashed border-white/45 text-lg font-black">؟</span>
            )}
            <Swords size={19} className="shrink-0 text-[#ffe27b]"/>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {Array.from({length:8},(_,index)=>{
          const member=otherGuests[index]||null
          const voice=member?findLammaVoiceParticipant(voiceMembers,member.user_id):null
          return <button
            key={member?.user_id||`empty-${index}`}
            disabled={!member}
            onClick={()=>member&&member.user_id!==uid&&onSelectMember(member)}
            className="tap-action min-w-0 disabled:opacity-45"
          >
            <span className="block px-0.5 py-1 text-center">
              <span className="ornate-silver-ring relative mx-auto block h-[54px] w-[54px] rounded-full p-[4px]">
                {member?renderAvatar(member,'h-full w-full'):<span className="grid h-full w-full place-items-center rounded-full bg-white/12 text-[9px]">فارغ</span>}
                {member&&voice?<span className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full ring-1 ring-white ${voice.mic_enabled?'bg-[#12d79d]':'bg-[#5e7193]'}`}>{voice.mic_enabled?<Mic size={9}/>:<MicOff size={9}/>}</span>:null}
              </span>
              <span className="mt-1 block truncate text-[8px] font-black">{member?.profiles?.display_name||`ضيف ${index+1}`}</span>
            </span>
          </button>
        })}
      </div>
    </div>

    <div className={`relative z-20 mt-2 shrink-0 items-center justify-center gap-2 ${chatExpanded?'hidden':'flex'}`}>
      {!inVoice
        ? <button
            onClick={onRequestVoiceApproval}
            disabled={!isHost&&voiceRequestStatus==='pending'}
            className="tap-action flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#5e25d8] shadow-lg disabled:opacity-65"
          >
            <Headphones size={16}/>
            {isHost?'طلب المايك':voiceRequestStatus==='accepted'?'تمت الموافقة · افتح المايك':voiceRequestStatus==='pending'?'طلب المايك قيد الانتظار':'طلب المايك'}
          </button>
        : <>
            <button onClick={onToggleMic} className={`tap-action grid h-9 w-9 place-items-center rounded-full ${micEnabled?'bg-[#14d29b]':'bg-white/18'}`}>{micEnabled?<Mic size={17}/>:<MicOff size={17}/>}</button>
            <button onClick={onLeaveVoice} className="tap-action rounded-full bg-[#ff337d] px-4 py-2 text-[11px] font-black">خروج من الصوت</button>
          </>
      }
      {isHost&&voiceRequestsCount?<span className="rounded-full bg-[#ffe16d] px-3 py-2 text-[10px] font-black text-[#694000]">{voiceRequestsCount} طلب صوت</span>:null}
    </div>
  </>
}
