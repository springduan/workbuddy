import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAppData } from '@/hooks/useAppData';
import { Login } from '@/pages/Login';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { CustomerList } from '@/pages/CustomerList';
import { VehicleList } from '@/pages/VehicleList';
import { Schedule } from '@/pages/Schedule';
import { DashboardKanban } from '@/pages/DashboardKanban';

function App() {
  const {
    isLoggedIn,
    currentUser,
    customers,
    vehicles,
    scheduleTasks,
    login,
    logout,
    addCustomer,
    importCustomers,
    deleteCustomer,
    clearAllCustomers,
    addVehicle,
    importVehicles,
    deleteVehicle,
    clearAllVehicles,
    generateSchedule,
    clearSchedule,
    getStats,
    groupCustomers,
    markCustomerDelayed,
    markCustomerCancelled,
    restoreCustomerNormal,
    updateTaskStatus,
  } = useAppData();

  const stats = getStats();

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        {/* 登录页 */}
        <Route
          path="/login"
          element={
            isLoggedIn ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={login} />
            )
          }
        />

        {/* 受保护的路由 */}
        <Route
          path="/"
          element={
            isLoggedIn ? (
              <Layout onLogout={logout} userName={currentUser?.name || '用户'}>
                <Outlet />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <Dashboard
                stats={stats}
                onImportCustomers={importCustomers}
                onImportVehicles={importVehicles}
                customerCount={customers.length}
                vehicleCount={vehicles.length}
                allCustomers={customers}
              />
            }
          />
          <Route
            path="customers"
            element={
              <CustomerList
                customers={customers}
                onDelete={deleteCustomer}
                onClearAll={clearAllCustomers}
                onMarkDelayed={markCustomerDelayed}
                onMarkCancelled={markCustomerCancelled}
                onRestoreNormal={restoreCustomerNormal}
                onReschedule={generateSchedule}
                onAdd={addCustomer}
              />
            }
          />
          <Route
            path="vehicles"
            element={
              <VehicleList
                vehicles={vehicles}
                onAdd={addVehicle}
                onDelete={deleteVehicle}
                onClearAll={clearAllVehicles}
              />
            }
          />
          <Route
            path="schedule"
            element={
              <Schedule
                scheduleTasks={scheduleTasks}
                vehicles={vehicles}
                customerGroups={groupCustomers(customers)}
                onGenerateSchedule={generateSchedule}
                onClearSchedule={clearSchedule}
                delayedCount={stats.delayedCount}
              />
            }
          />
          <Route
            path="vehicle-timeline"
            element={
              <DashboardKanban
                scheduleTasks={scheduleTasks}
                vehicles={vehicles}
                customerGroups={groupCustomers(customers)}
                onUpdateTaskStatus={updateTaskStatus}
              />
            }
          />
        </Route>

        {/* 未匹配的路由重定向 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
