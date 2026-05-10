import DailySales from '../pages/DailySales'
import CustomerService from '../pages/CustomerService'
import PaymentChannel from '../pages/PaymentChannel'
import OutstandingDebt from '../pages/OutstandingDebt'
import AgingReport from '../pages/AgingReport'

const dashboardPages = [
  { key: 'daily-sales', Component: DailySales },
  { key: 'customer-service', Component: CustomerService },
  { key: 'payment-channel', Component: PaymentChannel },
  { key: 'outstanding-debt', Component: OutstandingDebt },
  { key: 'aging-report', Component: AgingReport },
]

export default function FullReportExport() {
  return (
    <div
      id="full-report-export"
      className="fixed top-0 bg-slate-50 text-slate-900 pointer-events-none"
      style={{ left: '-30000px', width: '2200px', zIndex: -10 }}
      aria-hidden="true"
    >
      {dashboardPages.map(({ key, Component }) => (
        <section key={key} className="pdf-dashboard-page bg-slate-50">
          <Component />
        </section>
      ))}
    </div>
  )
}
