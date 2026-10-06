import type {Metadata,Viewport} from 'next';import './globals.css'
export const metadata:Metadata={title:'لمتنا',description:'مساحتك للتعارف والتواصل',applicationName:'لمتنا',appleWebApp:{capable:true,title:'لمتنا',statusBarStyle:'default'},robots:{index:false,follow:false}}
export const viewport:Viewport={themeColor:'#1560BD'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}