import { Outlet } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function Layout() {
  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-background">
        <Outlet />
      </div>
    </TooltipProvider>
  )
}
