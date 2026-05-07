import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Car,
  CalendarClock,
  LogOut,
  Menu,
  X,
  BarChart3,
  Settings,
  UserCog,
} from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
  userName: string;
  userRole?: 'admin' | 'employee';
}

const navItems = [
  { path: '/dashboard', label: '首页', icon: LayoutDashboard, adminOnly: false },
  { path: '/customers', label: '客户管理', icon: Users, adminOnly: false },
  { path: '/vehicles', label: '车辆管理', icon: Car, adminOnly: false },
  { path: '/schedule', label: '排班方案', icon: CalendarClock, adminOnly: false },
  { path: '/vehicle-timeline', label: '调度看板', icon: BarChart3, adminOnly: false },
  { path: '/settings', label: '配置', icon: Settings, adminOnly: true },
  { path: '/users', label: '用户管理', icon: UserCog, adminOnly: true },
];

export function Layout({ children, onLogout, userName, userRole = 'employee' }: LayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 根据角色过滤菜单
  const visibleNavItems = navItems.filter(item => !item.adminOnly || userRole === 'admin');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Car className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 hidden sm:block">
                会议车辆排班系统
              </span>
            </div>

            {/* 桌面导航 */}
            <nav className="hidden md:flex items-center gap-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      className={cn(
                        'gap-2',
                        isActive && 'bg-blue-600 hover:bg-blue-700'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>

            {/* 用户信息和登出 */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span>{userName}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="gap-2 text-red-600 hover:text-red-700 hover:border-red-300"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">退出</span>
              </Button>

              {/* 移动端菜单按钮 */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 移动端导航菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-4 py-3 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* 主内容区域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
