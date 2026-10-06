import {BottomNav} from './bottom-nav'
export function AppShell({children}:{children:React.ReactNode}){
 return <div className="relative mx-auto min-h-[100dvh] w-full max-w-md overflow-x-hidden bg-[linear-gradient(180deg,#F9FCFF_0%,#F4FAFF_46%,#EEF7FF_100%)] pb-28 shadow-[0_0_70px_rgba(12,55,110,.10)]">{children}<BottomNav/></div>
}
