import DailySales from '../pages/DailySales'
import CustomerService from '../pages/CustomerService'
import PaymentChannel from '../pages/PaymentChannel'
import OutstandingDebt from '../pages/OutstandingDebt'
import AgingReport from '../pages/AgingReport'

const dashboardPages = [
  { key: 'daily-sales', label: 'Daily Sales Report', Component: DailySales },
  { key: 'customer-service', label: 'Customer Service Report', Component: CustomerService },
  { key: 'payment-channel', label: 'Payment Channel Report', Component: PaymentChannel },
  { key: 'outstanding-debt', label: 'Outstanding Debt Report', Component: OutstandingDebt },
  { key: 'aging-report', label: 'Aging Report', Component: AgingReport },
]

export default function FullReportExport() {
  return (
    <div
      id="full-report-export"
      className="fixed top-0 bg-slate-50 text-slate-900 pointer-events-none"
      style={{ left: '-30000px', width: '2200px', zIndex: -10 }}
      aria-hidden="true"
    >
      {dashboardPages.map(({ key, label, Component }) => (
        <section key={key} className="pdf-dashboard-page bg-slate-50" data-pdf-page-label={label}>
          <Component />
        </section>
      ))}
    </div>
  )
}
