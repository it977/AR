import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { FilterProvider } from './context/FilterContext'
import DailySales from './pages/DailySales'
import CustomerService from './pages/CustomerService'
import PaymentChannel from './pages/PaymentChannel'
import OutstandingDebt from './pages/OutstandingDebt'
import AgingReport from './pages/AgingReport'
import UploadExcel from './pages/UploadExcel'
import BillsManagement from './pages/BillsManagement'
import DebtManagement from './pages/DebtManagement'
import APDashboard from './pages/APDashboard'
import APManagement from './pages/APManagement'
import APDebtManagement from './pages/APDebtManagement'
import APPOBreakdown from './pages/APPOBreakdown'
import APBalanceBreakdown from './pages/APBalanceBreakdown'
import APPaidBreakdown from './pages/APPaidBreakdown'
import APOutstandingBreakdown from './pages/APOutstandingBreakdown'
import APCashNeedPlan from './pages/APCashNeedPlan'
import VendorMasterData from './pages/VendorMasterData'
import PRLog from './pages/PRLog'
import POLog from './pages/POLog'
import APRegister from './pages/APRegister'

export default function App() {
  return (
    <FilterProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<DailySales />} />
          <Route path="/customer-service" element={<CustomerService />} />
          <Route path="/payment-channel" element={<PaymentChannel />} />
          <Route path="/outstanding-debt" element={<OutstandingDebt />} />
          <Route path="/aging-report" element={<AgingReport />} />
          <Route path="/upload" element={<UploadExcel />} />
          <Route path="/bills" element={<BillsManagement />} />
          <Route path="/debt" element={<DebtManagement />} />
          {/* AP Routes - ເກົ່າ */}
          <Route path="/ap" element={<APDashboard />} />
          <Route path="/ap-management" element={<APManagement />} />
          <Route path="/ap-debt" element={<APDebtManagement />} />
          <Route path="/ap-po-breakdown" element={<APPOBreakdown />} />
          <Route path="/ap-balance-breakdown" element={<APBalanceBreakdown />} />
          <Route path="/ap-paid-breakdown" element={<APPaidBreakdown />} />
          <Route path="/ap-outstanding-breakdown" element={<APOutstandingBreakdown />} />
          <Route path="/ap-cash-plan" element={<APCashNeedPlan />} />
          {/* AP Routes - ໃໝ່ (ຕາມ Excel) */}
          <Route path="/vendor-master" element={<VendorMasterData />} />
          <Route path="/pr-log" element={<PRLog />} />
          <Route path="/po-log" element={<POLog />} />
          <Route path="/ap-register" element={<APRegister />} />
        </Routes>
      </Layout>
    </FilterProvider>
  )
}
