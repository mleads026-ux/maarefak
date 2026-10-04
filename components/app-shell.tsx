import {BottomNav} from './bottom-nav'
import {InteractionDialogHost} from './interaction-dialog'

export function AppShell({children}:{children:React.ReactNode}){
  return <div className="relative mx-auto min-h-[100dvh] w-full max-w-[432px] overflow-x-hidden bg-[linear-gradient(180deg,#fbfdff_0%,#f5faff_50%,#edf7ff_100%)] pb-[108px] shadow-[0_0_70px_rgba(12,55,110,.10)]">
    {children}
    <BottomNav/>
    <InteractionDialogHost/>
  </div>
}
