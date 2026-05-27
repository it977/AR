import { Navigate, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { FilterProvider } from './context/FilterContext'
import { PERMISSIONS } from './lib/rbac'
import Login from './pages/Login'
import DailySales from './pages/DailySales'
import CustomerService from './pages/CustomerService'
import PaymentChannel from './pages/PaymentChannel'
import OutstandingDebt from './pages/OutstandingDebt'
import AgingReport from './pages/AgingReport'
import UploadExcel from './pages/UploadExcel'
import BillsManagement from './pages/BillsManagement'
import DebtManagement from './pages/DebtManagement'
import RBACManagement from './pages/RBACManagement'
import GeneralSettings from './pages/GeneralSettings'
import FullReportExport from './components/FullReportExport'
import AutoBackupRunner from './components/AutoBackupRunner'

export default function App() {
  return (
    <AuthProvider>
      <FilterProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AutoBackupRunner />
                <Layout>
                  <Routes>
                    <Route path="/" element={<ProtectedRoute permission={PERMISSIONS.PAGE_DAILY_SALES}><DailySales /></ProtectedRoute>} />
                    <Route path="/customer-service" element={<ProtectedRoute permission={PERMISSIONS.PAGE_CUSTOMER_SERVICE}><CustomerService /></ProtectedRoute>} />
                    <Route path="/payment-channel" element={<ProtectedRoute permission={PERMISSIONS.PAGE_PAYMENT_CHANNEL}><PaymentChannel /></ProtectedRoute>} />
                    <Route path="/outstanding-debt" element={<ProtectedRoute permission={PERMISSIONS.PAGE_OUTSTANDING_DEBT}><OutstandingDebt /></ProtectedRoute>} />
                    <Route path="/aging-report" element={<ProtectedRoute permission={PERMISSIONS.PAGE_AGING_REPORT}><AgingReport /></ProtectedRoute>} />
                    <Route path="/upload" element={<ProtectedRoute permission={PERMISSIONS.PAGE_UPLOAD}><UploadExcel /></ProtectedRoute>} />
                    <Route path="/bills" element={<ProtectedRoute permission={PERMISSIONS.PAGE_BILLS}><BillsManagement /></ProtectedRoute>} />
                    <Route path="/debt" element={<ProtectedRoute permission={PERMISSIONS.PAGE_DEBT}><DebtManagement /></ProtectedRoute>} />
                    <Route path="/rbac" element={<ProtectedRoute permission={PERMISSIONS.PAGE_RBAC}><RBACManagement /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute permission={PERMISSIONS.PAGE_SETTINGS}><GeneralSettings /></ProtectedRoute>} />
                    <Route path="/dashboard-pdf" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
                <FullReportExport />
              </ProtectedRoute>
            }
          />
        </Routes>
      </FilterProvider>
    </AuthProvider>
  )
}
