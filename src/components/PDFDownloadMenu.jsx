import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const pdfPages = [
  // AR Pages
  { label: 'ລາຍງານປະຈຳວັນ', sublabel: 'Daily Sales', path: '/', filename: 'Daily_Sales' },
  { label: 'ຈັດການໃບບິນ', sublabel: 'Bills Management', path: '/bills', filename: 'AR_Bills_Management' },
  { label: 'ຈັດການໜີ້', sublabel: 'Debt Management', path: '/debt', filename: 'AR_Debt_Management' },
  
  // AP Pages
  { label: 'AP Dashboard', sublabel: 'AP Summary', path: '/ap', filename: 'AP_Daily_Summary' },
  { label: 'Total PO Breakdown', sublabel: 'PO Analysis', path: '/ap-po-breakdown', filename: 'AP_PO_Breakdown' },
  { label: 'AP Balance Breakdown', sublabel: 'Balance Analysis', path: '/ap-balance-breakdown', filename: 'AP_Balance_Breakdown' },
  { label: 'AP Paid Breakdown', sublabel: 'Paid Analysis', path: '/ap-paid-breakdown', filename: 'AP_Paid_Breakdown' },
  { label: 'Outstanding AP Breakdown', sublabel: 'Outstanding Analysis', path: '/ap-outstanding-breakdown', filename: 'AP_Outstanding_Breakdown' },
  { label: 'Cash Need / Payment Plan', sublabel: 'Payment Planning', path: '/ap-cash-plan', filename: 'AP_CashNeed_PaymentPlan' },
]

export default function PDFDownloadMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const handleDownload = (page) => {
    // ນຳທາງໄປໜ້ານັ້ນກ່ອນ
    navigate(page.path)
    
    // ລໍຖ້າໃຫ້ໜ້າຫຼດເສັດແລ້ວຄ່ອຍກົດປຸ່ມ PDF
    setTimeout(() => {
      const pdfBtn = document.getElementById(`pdf-btn-${page.path.replace(/\//g, '')}-content`)
      if (pdfBtn) {
        pdfBtn.click()
      } else {
        // ລອງຊອກຫາ element id ທົ່ວໄປ
        const elementId = [
          'ar-bills-content',
          'ar-debt-content', 
          'ap-dashboard-content',
          'ap-po-content',
          'ap-balance-content',
          'ap-paid-content',
          'ap-outstanding-content',
          'ap-cash-plan-content'
        ].find(id => document.getElementById(id))
        
        if (elementId) {
          const btn = document.getElementById(`pdf-btn-${elementId}`)
          if (btn) btn.click()
        }
      }
    }, 500)
    
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-xl border border-red-200 transition-colors"
        title="ດາວໂຫຼດ PDF"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        PDF
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 max-h-96 overflow-y-auto">
            <div className="p-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase">ເລືອກໜ້າທີ່ຕ້ອງດາວໂຫຼດ</p>
              <p className="text-[10px] text-slate-400 mt-0.5">ລະບົບຈະໄປໜ້ານັ້ນ ແລະ ດາວໂຫຼດ PDF ໃຫ້ອັດຕະໂນມັດ</p>
            </div>
            
            {/* AR Section */}
            <div className="p-2">
              <p className="text-[10px] font-bold text-primary-600 uppercase mb-2 px-2">AR Finance - ລາຍຮັບ</p>
              <div className="space-y-0.5">
                {pdfPages.filter(p => !p.path.startsWith('/ap-') && p.path !== '/ap').map(page => (
                  <button
                    key={page.path}
                    onClick={() => handleDownload(page)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary-50 transition-colors group"
                  >
                    <p className="text-xs font-semibold text-slate-700 group-hover:text-primary-700">{page.label}</p>
                    <p className="text-[10px] text-slate-400">{page.sublabel}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* AP Section */}
            <div className="p-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-red-600 uppercase mb-2 px-2">AP Finance - ລາຍຈ່າຍ</p>
              <div className="space-y-0.5">
                {pdfPages.filter(p => p.path.startsWith('/ap-') || p.path === '/ap').map(page => (
                  <button
                    key={page.path}
                    onClick={() => handleDownload(page)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 transition-colors group"
                  >
                    <p className="text-xs font-semibold text-slate-700 group-hover:text-red-700">{page.label}</p>
                    <p className="text-[10px] text-slate-400">{page.sublabel}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
