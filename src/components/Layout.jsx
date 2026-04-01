import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// AR Items (ລາຍຮັບ) - ຈັດລຽງໃໝ່: ຈັດການໃບບິນ ແລະ ຈັດການໜີ້ ໄວ້ເທິງ
const arItems = [
  {
    label: 'ຈັດການໃບບິນ',
    sublabel: 'Bills Management',
    path: '/bills',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'ຈັດການໜີ້',
    sublabel: 'Debt Management',
    path: '/debt',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'ລາຍງານປະຈຳວັນ',
    sublabel: 'Daily Sales',
    path: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'ລູກຄ້າ & ການບໍລິການ',
    sublabel: 'Customer & Service',
    path: '/customer-service',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'ຊ່ອງທາງການຊຳລະ',
    sublabel: 'Payment Channel',
    path: '/payment-channel',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    label: 'ໜີ້ຄ້າງຊຳລະ',
    sublabel: 'Outstanding Debt',
    path: '/outstanding-debt',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'ລາຍງານອາຍຸໜີ້',
    sublabel: 'Aging Report',
    path: '/aging-report',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

// AP Items (ລາຍຈ່າຍ) - ຈັດລຽງໃໝ່: ຈັດການໃບເກັບເງິນ ແລະ ່າຍໜີ້ຄ້າງ ໄວ້ເທິງ
const apItems = [
  {
    label: 'ຈັດການໃບເກັບເງິນ',
    sublabel: 'AP Management',
    path: '/ap-management',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'ຈ່າຍໜີ້ຄ້າງ',
    sublabel: 'AP Debt Payment',
    path: '/ap-debt',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'AP Dashboard',
    sublabel: 'AP Summary',
    path: '/ap',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    label: 'Total PO Breakdown',
    sublabel: 'PO Analysis',
    path: '/ap-po-breakdown',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'AP Balance Breakdown',
    sublabel: 'Balance Analysis',
    path: '/ap-balance-breakdown',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A3.005 3.005 0 0121 6v12a3 3 0 01-6 0v-1.344c-2.031.97-4.686.97-6.718 0V18a3 3 0 01-6 0V6c0-.293.04-.577.113-.852" />
      </svg>
    ),
  },
  {
    label: 'AP Paid Breakdown',
    sublabel: 'Paid Analysis',
    path: '/ap-paid-breakdown',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Outstanding AP Breakdown',
    sublabel: 'Outstanding Analysis',
    path: '/ap-outstanding-breakdown',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    label: 'Cash Need / Payment Plan',
    sublabel: 'Payment Planning',
    path: '/ap-cash-plan',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
]

// Other Items
const otherItems = [
  {
    label: 'ອັບໂຫຼດ Excel',
    sublabel: 'Upload Data',
    path: '/upload',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
]

// PDF Download Items - AR
const pdfArItems = [
  { 
    label: 'ລາຍງານປະຈຳວັນ', 
    sublabel: 'Daily Sales', 
    path: '/', 
    filename: 'Daily_Sales',
  },
  { 
    label: 'ຈັດການໃບບິນ', 
    sublabel: 'Bills Management', 
    path: '/bills', 
    filename: 'AR_Bills_Management',
  },
  { 
    label: 'ຈັດການໜີ້', 
    sublabel: 'Debt Management', 
    path: '/debt', 
    filename: 'AR_Debt_Management',
  },
]

// PDF Download Items - AP
const pdfApItems = [
  { 
    label: 'AP Dashboard', 
    sublabel: 'AP Summary', 
    path: '/ap', 
    filename: 'AP_Daily_Summary',
  },
  { 
    label: 'Total PO Breakdown', 
    sublabel: 'PO Analysis', 
    path: '/ap-po-breakdown', 
    filename: 'AP_PO_Breakdown',
  },
  { 
    label: 'AP Balance Breakdown', 
    sublabel: 'Balance Analysis', 
    path: '/ap-balance-breakdown', 
    filename: 'AP_Balance_Breakdown',
  },
  { 
    label: 'AP Paid Breakdown', 
    sublabel: 'Paid Analysis', 
    path: '/ap-paid-breakdown', 
    filename: 'AP_Paid_Breakdown',
  },
  { 
    label: 'Outstanding AP Breakdown', 
    sublabel: 'Outstanding Analysis', 
    path: '/ap-outstanding-breakdown', 
    filename: 'AP_Outstanding_Breakdown',
  },
  { 
    label: 'Cash Need / Payment Plan', 
    sublabel: 'Payment Planning', 
    path: '/ap-cash-plan', 
    filename: 'AP_CashNeed_PaymentPlan',
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
  const [isOpen, setIsOpen] = useState(true) // ເປີດທັງໝົດດຍຄ່າເລີ່ມຕົ້ນ
  
  // ກວດວ່າມີ path ໃດໜຶ່ງ active ໃນກຸ່ມນີ້ບໍ່
  const hasActive = items.some(item => {
    if (item.path === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  })
  
  // ຖ້າມີ active ໃຫ້ເປີດກຸ່ມໄວ້
  if (hasActive && !isOpen) setIsOpen(true)
  
  if (isSubgroup) {
    // ສຳລັບ subgroup ບໍ່ມີປຸ່ມ collapse
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
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const today = new Date().toLocaleDateString('lo-LA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-sidebar transition-all duration-300 ease-in-out shrink-0 ${
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
              <p className="text-white font-bold text-sm leading-tight">ລະບົບ AR-AP Finance</p>
              <p className="text-slate-400 text-xs">LXH Dashboard</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          {/* AR Group */}
          <NavGroup
            label="AR Finance"
            items={arItems}
            collapsed={collapsed}
            defaultOpen={true}
          />

          {/* AP Group */}
          <NavGroup
            label="AP Finance"
            items={apItems}
            collapsed={collapsed}
            defaultOpen={true}
          />

          {/* PDF Download Button */}
          {!collapsed && (
            <div className="mt-4 mb-2 px-3">
              <button
                onClick={async () => {
                  const html2pdf = (await import('html2pdf.js')).default
                  
                  const pages = [
                    { path: '/', name: 'Daily_Sales', elementId: 'daily-sales-content' },
                    { path: '/bills', name: 'AR_Bills_Management', elementId: 'ar-bills-content' },
                    { path: '/debt', name: 'AR_Debt_Management', elementId: 'ar-debt-content' },
                    { path: '/ap', name: 'AP_Daily_Summary', elementId: 'ap-dashboard-content' },
                    { path: '/ap-po-breakdown', name: 'AP_PO_Breakdown', elementId: 'ap-po-content' },
                    { path: '/ap-balance-breakdown', name: 'AP_Balance_Breakdown', elementId: 'ap-balance-content' },
                    { path: '/ap-paid-breakdown', name: 'AP_Paid_Breakdown', elementId: 'ap-paid-content' },
                    { path: '/ap-outstanding-breakdown', name: 'AP_Outstanding_Breakdown', elementId: 'ap-outstanding-content' },
                    { path: '/ap-cash-plan', name: 'AP_CashNeed_PaymentPlan', elementId: 'ap-cash-plan-content' },
                  ]
                  
                  const opt = {
                    margin: 0.3,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape', compress: true },
                    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                  }
                  
                  for (const page of pages) {
                    try {
                      // ນຳທາງໄປໜ້ານັ້ນ
                      window.location.href = page.path
                      
                      // ລໍຖ້າໃຫ້ໜ້າຫຼດ
                      await new Promise(resolve => setTimeout(resolve, 1000))
                      
                      // ດາວໂຫຼດ PDF
                      const element = document.getElementById(page.elementId) || document.body
                      await html2pdf().set(opt).from(element).save()
                      
                      // ລໍຖ້າກ່ອນໄປໜ້າັດໄປ
                      await new Promise(resolve => setTimeout(resolve, 500))
                    } catch (error) {
                      console.error(`Error downloading ${page.name}:`, error)
                    }
                  }
                  
                  // ກັບມາໜ້າເກົ່າ
                  alert('ດາວໂຫຼດ PDF ທັງໝົດສຳເລັດ!')
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                ດາວໂຫຼດ PDF ທັງໝົດ (10 ໜ້າ)
              </button>
              <p className="text-[9px] text-slate-400 mt-2 text-center">
                ກົດແລ້ວຈະດາວໂຫຼດທຸກໜ້າ AR-AP ພ້ອມກັນ
              </p>
            </div>
          )}

          {/* Other Group */}
          <NavGroup
            label="ອື່ນໆ"
            items={otherItems}
            collapsed={collapsed}
            defaultOpen={false}
          />
        </nav>

        {/* Collapse toggle */}
        <div className="px-2 py-3 border-t border-slate-700/50">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="nav-item nav-item-inactive w-full justify-center"
          >
            <svg
              className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span className="text-xs">ຫຍໍ້ sidebar</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
