import MobileBottomNav from '@/components/MobileBottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-layout">
      {children}
      <div className="mobile-nav-spacer" />
      <MobileBottomNav />
    </div>
  )
}
