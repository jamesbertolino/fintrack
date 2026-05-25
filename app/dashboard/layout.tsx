import MobileBottomNav from '@/components/MobileBottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-layout">
      <div className="dashboard-scroll-area">
        {children}
      </div>
      <MobileBottomNav />
    </div>
  )
}
