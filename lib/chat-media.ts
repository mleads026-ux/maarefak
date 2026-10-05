export type ChatMediaUploadResult=
  | {ok:true;isVideo:boolean}
  | {
      ok:false
      code:'invalid_type'|'too_large'|'duration_read'|'too_long'|'upload'|'message'
      isVideo:boolean
    }

async function readVideoDuration(file:File){
  return new Promise<number>((resolve,reject)=>{
    const url=URL.createObjectURL(file)
    const video=document.createElement('video')
    video.preload='metadata'
    video.onloadedmetadata=()=>{
      const duration=Number(video.duration||0)
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror=()=>{
      URL.revokeObjectURL(url)
      reject(new Error('invalid_video'))
    }
    video.src=url
  })
}

export async function uploadConversationMedia(
  s:any,
  conversationId:string,
  userId:string,
  file:File
):Promise<ChatMediaUploadResult>{
  const imageTypes=['image/jpeg','image/png','image/webp']
  const videoTypes=['video/mp4','video/webm','video/quicktime']
  const isImage=imageTypes.includes(file.type)
  const isVideo=videoTypes.includes(file.type)

  if(!isImage&&!isVideo)return {ok:false,code:'invalid_type',isVideo:false}
  if(file.size>25*1024*1024)return {ok:false,code:'too_large',isVideo}

  let duration:number|null=null
  if(isVideo){
    try{
      duration=await readVideoDuration(file)
    }catch{
      return {ok:false,code:'duration_read',isVideo:true}
    }
    if(!duration||duration>10.05)return {ok:false,code:'too_long',isVideo:true}
  }

  const ext=file.name.split('.').pop()?.toLowerCase()||(isVideo?'mp4':'jpg')
  const path=`${conversationId}/${userId}/${crypto.randomUUID()}.${ext}`

  const {error:uploadError}=await s.storage
    .from('chat-media-approved')
    .upload(path,file,{upsert:false,contentType:file.type})

  if(uploadError)return {ok:false,code:'upload',isVideo}

  const {error}=await s.rpc('create_media_message',{
    p_conversation:conversationId,
    p_media_path:path,
    p_kind:isVideo?'video':'image',
    p_duration_seconds:duration,
  })

  if(error)return {ok:false,code:'message',isVideo}
  return {ok:true,isVideo}
}
