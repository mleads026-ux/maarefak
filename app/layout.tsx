import type {Metadata,Viewport} from 'next'
import './globals.css'

export const metadata:Metadata={
  title:'لمتنا',
  description:'مكانك للتعارف واللمة الصوتية',
  applicationName:'لمتنا',
  manifest:'/manifest.webmanifest',
  icons:{
    icon:[{url:'/icon-192.png',sizes:'192x192',type:'image/png'},{url:'/icon-512.png',sizes:'512x512',type:'image/png'}],
    apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}],
  },
  appleWebApp:{capable:true,title:'لمتنا',statusBarStyle:'default'},
  robots:{index:false,follow:false}
}

export const viewport:Viewport={themeColor:'#1268F5'}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="ar" dir="rtl"><body>{children}</body></html>
}
