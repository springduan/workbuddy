import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAppData } from '@/hooks/useAppData';
import { Login } from '@/pages/Login';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { CustomerList } from '@/pages/CustomerList';
import { VehicleList } from '@/pages/VehicleList';
import { Schedule } from '@/pages/Schedule';
import { DashboardKanban } from '@/pages/DashboardKanban';
import { ConfigSettings } from '@/pages/ConfigSettings';
import { UserManagement } from '@/pages/UserManagement';

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

// 包装组件用于使用 useNavigate
function AppContent() {
  const navigate = useNavigate();
  const {
    isLoggedIn,
    currentUser,
    customers,
    vehicles,
    scheduleTasks,
    scheduleConfig,
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
    saveScheduleConfig,
    resetScheduleConfig,
  } = useAppData();

  const stats = getStats();

  // 包装 navigate 函数给 Dashboard 用
  const navigateTo = (path: string) => {
    navigate(path);
  };

  return (
    <>
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
              <Layout onLogout={logout} userName={currentUser?.name || '用户'} userRole={currentUser?.role || 'employee'}>
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
                onGenerateSchedule={generateSchedule}
                navigateTo={navigateTo}
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
          <Route
            path="settings"
            element={
              <ConfigSettings
                currentConfig={scheduleConfig}
                onSave={saveScheduleConfig}
                onReset={resetScheduleConfig}
              />
            }
          />
          <Route
            path="users"
            element={
              currentUser?.role === 'admin' ? (
                <UserManagement />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
        </Route>

        {/* 未匹配的路由重定向 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default App;
