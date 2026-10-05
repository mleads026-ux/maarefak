'use client'

import type {RefObject} from 'react'
import {Gift,ImagePlus,Send} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

type Props={
  fileInputRef:RefObject<HTMLInputElement|null>
  body:string
  onBodyChange:(value:string)=>void
  onSend:()=>void
  onOpenGifts:()=>void
  onMediaFile:(file:File)=>void
  mediaEnabled:boolean
}

export function ChatComposer({
  fileInputRef,body,onBodyChange,onSend,onOpenGifts,onMediaFile,mediaEnabled,
}:Props){
  return <>
    <input
      ref={fileInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
      className="hidden"
      onChange={e=>{
        const file=e.target.files?.[0]
        if(file)onMediaFile(file)
        e.currentTarget.value=''
      }}
    />

    <div className="sticky bottom-20 flex gap-2 rounded-3xl border border-slate-200 bg-white p-2">
      <Button
        size="icon"
        variant="ghost"
        aria-label="إرسال هدية"
        onClick={onOpenGifts}
        className="text-[#a76500]"
      >
        <Gift size={19}/>
      </Button>

      <Button
        size="icon"
        variant="ghost"
        aria-label="إرسال صورة أو فيديو حتى 10 ثواني"
        onClick={()=>fileInputRef.current?.click()}
      disabled={!mediaEnabled}
      title={mediaEnabled?'إرسال صورة أو فيديو':'إرسال الصور والفيديو متوقف مؤقتًا لحين تفعيل فحص المحتوى'}
      >
        <ImagePlus size={19}/>
      </Button>

      <Input
        placeholder="اكتب رسالة..."
        value={body}
        onChange={e=>onBodyChange(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter')onSend()}}
      />

      <Button size="icon" onClick={onSend}>
        <Send size={18}/>
      </Button>
    </div>
  </>
}
