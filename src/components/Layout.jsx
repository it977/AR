import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PERMISSIONS } from '../lib/rbac'

// AR finance navigation items.
const arItems = [
  {
    label: 'Bill Management',
    sublabel: 'Bill Management',
    path: '/bills',
    permission: PERMISSIONS.PAGE_BILLS,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Debt Management',
    sublabel: 'Debt Management',
    path: '/debt',
    permission: PERMISSIONS.PAGE_DEBT,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'Daily Report',
    sublabel: 'Daily Report',
    path: '/',
    permission: PERMISSIONS.PAGE_DAILY_SALES,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Customers & Services',
    sublabel: 'Customers and Services',
    path: '/customer-service',
    permission: PERMISSIONS.PAGE_CUSTOMER_SERVICE,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Payment Channels',
    sublabel: 'Payment Channels',
    path: '/payment-channel',
    permission: PERMISSIONS.PAGE_PAYMENT_CHANNEL,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    label: 'Outstanding Debt',
    sublabel: 'Outstanding Debt',
    path: '/outstanding-debt',
    permission: PERMISSIONS.PAGE_OUTSTANDING_DEBT,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Aging Report',
    sublabel: 'Aging Report',
    path: '/aging-report',
    permission: PERMISSIONS.PAGE_AGING_REPORT,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

// Other Items
const otherItems = [
  {
    label: 'Upload Excel',
    sublabel: 'Upload Data',
    path: '/upload',
    permission: PERMISSIONS.PAGE_UPLOAD,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
]

const adminItems = [
  {
    label: 'General Settings',
    sublabel: 'General Settings',
    path: '/settings',
    permission: PERMISSIONS.PAGE_SETTINGS,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'RBAC',
    sublabel: 'Users & Permissions',
    path: '/rbac',
    permission: PERMISSIONS.PAGE_RBAC,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
]

function NavItem({ item, collapsed, isActive }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
      }
      title={collapsed ? (item.label || item.sublabel) : ''}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight">{item.label}</p>
          <p className="text-[10px] opacity-60 leading-tight">{item.sublabel}</p>
        </div>
      )}
    </NavLink>
  )
}

function NavGroup({ label, items, collapsed, defaultOpen = false, isSubgroup = false }) {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(true) // Open by default
  
  // Check whether any path in this group is active.
  const hasActive = items.some(item => {
    if (item.path === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  })
  
  // Keep the active group open.
  if (hasActive && !isOpen) setIsOpen(true)
  
  if (isSubgroup) {
    // Subgroups do not have a collapse control.
    return (
      <div className="ml-2 mt-1 space-y-0.5">
        {items.map((item, idx) => (
          <NavItem key={`${item.path}-${idx}`} item={item} collapsed={collapsed} isActive={false} />
        ))}
      </div>
    )
  }
  
  return (
    <div className="mb-2">
      <button
        onClick={() => !collapsed && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          hasActive 
            ? 'bg-primary-600/10 text-primary-400' 
            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
        }`}
        title={collapsed ? label : ''}
      >
        <span className="flex items-center gap-2">
          {!collapsed && <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>}
        </span>
        {!collapsed && (
          <svg 
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      
      {isOpen && (
        <div className="ml-2 mt-1 space-y-0.5">
          {items.map((item, idx) => (
            <NavItem key={`${item.path}-${idx}`} item={item} collapsed={collapsed} isActive={false} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile, roleLabel, signOut, can } = useAuth()
  const visibleArItems = arItems.filter(item => !item.permission || can(item.permission))
  const visibleOtherItems = otherItems.filter(item => !item.permission || can(item.permission))
  const visibleAdminItems = adminItems.filter(item => !item.permission || can(item.permission))
  const collapsed = !sidebarOpen

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
        onFocus={() => setSidebarOpen(true)}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar shadow-2xl shadow-slate-950/20 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <p className="text-white font-bold text-sm leading-tight">AR Finance System</p>
              <p className="text-slate-400 text-xs">OneMeds Dashboard</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          {/* AR Group */}
          <NavGroup
            label="AR Finance"
            items={visibleArItems}
            collapsed={collapsed}
            defaultOpen={true}
          />

          {/* Other Group */}
          {visibleOtherItems.length > 0 && (
            <NavGroup
              label="Other"
              items={visibleOtherItems}
              collapsed={collapsed}
              defaultOpen={false}
            />
          )}

          {visibleAdminItems.length > 0 && (
            <NavGroup
              label="Admin"
              items={visibleAdminItems}
              collapsed={collapsed}
              defaultOpen={false}
            />
          )}
        </nav>

        {/* User + Auto-hide hint */}
        <div className="px-2 py-3 border-t border-slate-700/50">
          {!collapsed && (
            <div className="mb-3 rounded-xl border border-slate-700/70 bg-slate-900/50 px-3 py-2">
              <p className="truncate text-xs font-semibold text-white">{profile?.full_name || profile?.email || 'User'}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="rounded-full bg-primary-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-200">
                  {roleLabel}
                </span>
                <button onClick={signOut} className="text-[10px] font-semibold text-slate-400 hover:text-white">
                  Logout
                </button>
              </div>
            </div>
          )}
          <div className="nav-item nav-item-inactive w-full justify-center cursor-default">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0l-4-4m4 4l-4 4" />
            </svg>
            {!collapsed && <span className="text-xs">Auto-hide</span>}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pl-16">
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
