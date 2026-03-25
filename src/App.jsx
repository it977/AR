import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DailySales from './pages/DailySales'
import CustomerService from './pages/CustomerService'
import PaymentChannel from './pages/PaymentChannel'
import OutstandingDebt from './pages/OutstandingDebt'
import AgingReport from './pages/AgingReport'
import UploadExcel from './pages/UploadExcel'
import BillsManagement from './pages/BillsManagement'
import DebtManagement from './pages/DebtManagement'

export default function App() {
  return (
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
      </Routes>
    </Layout>
  )
}
