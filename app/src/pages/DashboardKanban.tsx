import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plane,
  Train,
  CalendarClock,
  Car,
  Users,
  AlertTriangle,
  Clock,
  Play,
  CheckCircle2,
  RotateCcw,
  ClipboardCheck,
  Search,
} from 'lucide-react';
import type { ScheduleTask, Vehicle, CustomerGroup, Customer } from '@/types';

interface DashboardKanbanProps {
  scheduleTasks: ScheduleTask[];
  vehicles: Vehicle[];
  customerGroups: CustomerGroup[];
  onUpdateTaskStatus?: (taskId: string, newStatus: ScheduleTask['status'], remark?: string) => boolean;
}

type ViewMode = 'gantt' | 'execution';
type ExecutionFilter = 'all' | 'pending' | 'in_progress' | 'completed';

export function DashboardKanban({
  scheduleTasks,
  vehicles,
  customerGroups,
  onUpdateTaskStatus,
}: DashboardKanbanProps) {
  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>('gantt');
  // 任务执行视图的状态筛选
  const [executionFilter, setExecutionFilter] = useState<ExecutionFilter>('all');
  // 搜索词
  const [searchTerm, setSearchTerm] = useState('');

  // 获取车辆信息
  const getVehicle = (vehicleId: string) => {
    return vehicles.find((v) => v.id === vehicleId);
  };

  // 过滤排班任务（基于搜索词）
  const filteredTasks = useMemo(() => {
    if (!searchTerm) return scheduleTasks;
    const term = searchTerm.toLowerCase();
    return scheduleTasks.filter((task) => {
      const vehicle = getVehicle(task.vehicleId);
      // 匹配客户姓名、航班号、车牌、司机姓名
      const customerMatch = task.customers.some((c) =>
        c.name.toLowerCase().includes(term) ||
        (c.flightNumber && c.flightNumber.toLowerCase().includes(term))
      );
      const vehicleMatch = vehicle && (
        vehicle.plateNumber.toLowerCase().includes(term) ||
        vehicle.driver.toLowerCase().includes(term)
      );
      return customerMatch || vehicleMatch;
    });
  }, [scheduleTasks, searchTerm, vehicles]);

  // 直接显示所有排班任务（不做日期筛选）
  const tasksForDate = useMemo(() => filteredTasks, [filteredTasks]);

  // 按车辆分组任务
  const tasksByVehicle = useMemo(() => {
    const grouped: Record<string, ScheduleTask[]> = {};
    tasksForDate.forEach((task) => {
      if (!grouped[task.vehicleId]) {
        grouped[task.vehicleId] = [];
      }
      grouped[task.vehicleId].push(task);
    });
    // 按趟次排序
    Object.keys(grouped).forEach((vehicleId) => {
      grouped[vehicleId].sort((a, b) => a.tripNumber - b.tripNumber);
    });
    return grouped;
  }, [tasksForDate]);

  // 统计数据
  const stats = useMemo(() => {
    const totalTrips = tasksForDate.length;
    const usedVehicles = Object.keys(tasksByVehicle).length;
    const totalCustomers = tasksForDate.reduce(
      (sum, task) => sum + task.customers.length,
      0
    );
    const availableVehicles = vehicles.length - usedVehicles;

    // 任务状态统计
    const pendingCount = tasksForDate.filter(t => t.status === 'pending').length;
    const inProgressCount = tasksForDate.filter(t => t.status === 'in_progress').length;
    const completedCount = tasksForDate.filter(t => t.status === 'completed').length;

    return {
      totalTrips,
      usedVehicles,
      totalCustomers,
      availableVehicles,
      pendingCount,
      inProgressCount,
      completedCount,
    };
  }, [tasksForDate, tasksByVehicle, vehicles, customerGroups]);

  // 时间刻度（5:00 - 24:00）
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 5; hour <= 24; hour++) {
      slots.push(hour);
    }
    return slots;
  }, []);

  // 计算任务在甘特图中的位置和宽度
  const getTaskStyle = (task: ScheduleTask) => {
    const pickupTime = task.pickupTime.split(' ')[1] || '00:00';
    const [hour, min] = pickupTime.split(':').map(Number);
    const startMinutes = hour * 60 + min;

    // 结束时间 = 到达时间 + 30分钟（机场停留）
    const [endHour, endMin] = task.arrivalTime.split(':').map(Number);
    const endMinutes = endHour * 60 + endMin + 30;

    // 转换百分比
    const dayStartMinutes = 5 * 60; // 5:00
    const dayEndMinutes = 24 * 60; // 24:00
    const totalMinutes = dayEndMinutes - dayStartMinutes;

    const left = ((startMinutes - dayStartMinutes) / totalMinutes) * 100;
    const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - left, width)}%`,
    };
  };

  // 格式化时间显示
  const formatHour = (hour: number) => {
    return hour === 24 ? '00:00' : `${hour.toString().padStart(2, '0')}:00`;
  };

  // 处理任务状态变更
  const handleStatusChange = (taskId: string, newStatus: ScheduleTask['status']) => {
    if (!onUpdateTaskStatus) return;
    onUpdateTaskStatus(taskId, newStatus);
  };

  // 判断任务是否超期（当前时间已过出发时间但仍为 pending）
  const isOverdue = (task: ScheduleTask) => {
    if (task.status !== 'pending') return false;
    const now = new Date();
    // 从 pickupTime 中提取日期和时间
    const datePart = task.pickupTime.split(' ')[0];
    const timePart = task.pickupTime.split(' ')[1] || '00:00';
    const [h, m] = timePart.split(':').map(Number);
    const pickupMinutes = h * 60 + m;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 同一天且当前时间超过出发时间
    if (datePart === now.toISOString().split('T')[0]) {
      return currentMinutes > pickupMinutes;
    }
    return false;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">排班看板</h1>
        <p className="text-gray-500 mt-1">可视化查看每日排班与任务执行</p>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="排班趟数"
          value={stats.totalTrips}
          icon={CalendarClock}
          color="blue"
        />
        <StatCard
          title="使用车辆数"
          value={stats.usedVehicles}
          icon={Car}
          color="green"
        />
        <StatCard
          title="服务客户数"
          value={stats.totalCustomers}
          icon={Users}
          color="purple"
        />
        <StatCard
          title="空闲车辆数"
          value={stats.availableVehicles}
          icon={Clock}
          color="orange"
        />
      </div>

      {/* 搜索框 */}
      {scheduleTasks.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索客户姓名、航班号、车牌、司机..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-gray-400 hover:text-gray-600"
                >
                  清除
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 视图切换 Tab */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList className="w-full max-w-md mx-auto">
          <TabsTrigger value="gantt" className="flex-1 flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            甘特图视图
          </TabsTrigger>
          <TabsTrigger value="execution" className="flex-1 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            任务执行视图
          </TabsTrigger>
        </TabsList>

        {/* ========== 甘特图视图 ========== */}
        <div hidden={viewMode !== 'gantt'} className="mt-6">
          <GanttView
            vehicles={vehicles}
            tasksByVehicle={tasksByVehicle}
            timeSlots={timeSlots}
            formatHour={formatHour}
            getTaskStyle={getTaskStyle}
          />
        </div>

        {/* ========== 任务执行视图 ========== */}
        <div hidden={viewMode !== 'execution'} className="mt-6">
          <ExecutionView
            vehicles={vehicles}
            tasksByVehicle={tasksByVehicle}
            pendingCount={stats.pendingCount}
            inProgressCount={stats.inProgressCount}
            completedCount={stats.completedCount}
            onStatusChange={handleStatusChange}
            isOverdue={isOverdue}
            filter={executionFilter}
            onFilterChange={setExecutionFilter}
          />
        </div>
      </Tabs>
    </div>
  );
}

// ==================== 统计卡片组件 ====================

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== 甘特图视图 ====================

function GanttView({
  vehicles,
  tasksByVehicle,
  timeSlots,
  formatHour,
  getTaskStyle,
}: {
  vehicles: Vehicle[];
  tasksByVehicle: Record<string, ScheduleTask[]>;
  timeSlots: number[];
  formatHour: (hour: number) => string;
  getTaskStyle: (task: ScheduleTask) => { left: string; width: string };
}) {
  // 获取车辆序号（基于车辆管理列表顺序）
  const getVehicleIndex = (vehicleId: string) => {
    const index = vehicles.findIndex((v) => v.id === vehicleId);
    return index >= 0 ? index + 1 : 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">甘特图时间线</CardTitle>
        <CardDescription>蓝色 = 飞机接机，绿色 = 高铁接机</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* 时间刻度表头 */}
            <div className="flex border-b sticky top-0 bg-white z-10">
              <div className="w-32 flex-shrink-0 p-2 border-r font-medium text-sm">
                车辆
              </div>
              <div className="flex-1 flex">
                {timeSlots.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 text-center text-xs text-gray-500 py-2 border-r"
                    style={{ minWidth: '60px' }}
                  >
                    {formatHour(hour)}
                  </div>
                ))}
              </div>
            </div>

            {/* 甘特图内容 */}
            {vehicles.length === 0 ? (
              <div className="p-8 text-center text-gray-500">暂无车辆数据</div>
            ) : (
              <div className="divide-y">
                {vehicles.map((vehicle) => {
                  const vehicleTasks = tasksByVehicle[vehicle.id] || [];
                  return (
                    <div key={vehicle.id} className="flex min-h-[60px]">
                      {/* 车辆信息 */}
                      <div className="w-32 flex-shrink-0 p-2 border-r bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            #{getVehicleIndex(vehicle.id)}
                          </span>
                          <div className="font-mono font-medium text-sm truncate">
                            {vehicle.plateNumber}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 truncate pl-8">
                          {vehicle.driver}
                        </div>
                      </div>

                      {/* 时间线 */}
                      <div className="flex-1 relative">
                        {/* 网格线 */}
                        {timeSlots.map((hour) => (
                          <div
                            key={hour}
                            className="absolute top-0 bottom-0 border-r border-gray-100"
                            style={{
                              left: `${((hour - 5) / 19) * 100}%`,
                            }}
                          />
                        ))}

                        {/* 任务色块 */}
                        <TooltipProvider>
                          {vehicleTasks.map((task) => {
                            const style = getTaskStyle(task);
                            const isFlight =
                              task.customers[0]?.transportType === '飞机';
                            const hasDelayed = task.customers.some(
                              (c) => c.guestStatus === 'delayed'
                            );
                            return (
                              <Tooltip key={task.id}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`absolute top-2 bottom-2 rounded-md px-2 py-1 cursor-pointer overflow-hidden ${
                                      isFlight
                                        ? 'bg-blue-500 hover:bg-blue-600'
                                        : 'bg-green-500 hover:bg-green-600'
                                    }`}
                                    style={{
                                      left: style.left,
                                      width: style.width,
                                      minWidth: '40px',
                                    }}
                                  >
                                    <div className="text-white text-xs font-medium truncate">
                                      {task.customers[0]?.flightNumber ||
                                        task.pickupTime.split(' ')[1]}
                                    </div>
                                    {hasDelayed && (
                                      <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center">
                                        <span className="text-white text-[8px] font-bold">
                                          !
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="w-64 p-0 bg-white border shadow-lg" sideOffset={8}>
                                  <TaskDetail 
                                    task={task} 
                                    vehicle={vehicle} 
                                    vehicleIndex={vehicles.findIndex(v => v.id === vehicle.id) + 1}
                                  />
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </TooltipProvider>

                        {/* 无任务提示 */}
                        {vehicleTasks.length === 0 && (
                          <div className="flex items-center justify-center h-full text-xs text-gray-400">
                            无排班任务
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== 任务执行视图 ====================

function ExecutionView({
  vehicles,
  tasksByVehicle,
  pendingCount,
  inProgressCount,
  completedCount,
  onStatusChange,
  isOverdue,
  filter,
  onFilterChange,
}: {
  vehicles: Vehicle[];
  tasksByVehicle: Record<string, ScheduleTask[]>;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  onStatusChange: (taskId: string, newStatus: ScheduleTask['status']) => void;
  isOverdue: (task: ScheduleTask) => boolean;
  filter: ExecutionFilter;
  onFilterChange: (filter: ExecutionFilter) => void;
}) {
  // 过滤出有任务的车辆并排序
  const activeVehicles = useMemo(() => {
    return vehicles
      .filter((v) => (tasksByVehicle[v.id]?.length ?? 0) > 0)
      .map((v) => ({
        vehicle: v,
        // 根据筛选条件过滤每个车辆的任务
        tasks: (tasksByVehicle[v.id] || []).filter((task) => {
          if (filter === 'all') return true;
          return task.status === filter;
        }),
      }))
      .filter((item) => item.tasks.length > 0)
      .sort((a, b) => a.tasks[0]?.tripNumber - b.tasks[0]?.tripNumber);
  }, [vehicles, tasksByVehicle, filter]);

  return (
    <div className="space-y-4">
      {/* 执行统计概览 - 可点击筛选 */}
      <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
        <ExecutionStatCard
          label="待派出"
          count={pendingCount}
          color="amber"
          icon={Clock}
          active={filter === 'pending'}
          onClick={() => onFilterChange(filter === 'pending' ? 'all' : 'pending')}
        />
        <ExecutionStatCard
          label="途中"
          count={inProgressCount}
          color="blue"
          icon={Play}
          active={filter === 'in_progress'}
          onClick={() => onFilterChange(filter === 'in_progress' ? 'all' : 'in_progress')}
        />
        <ExecutionStatCard
          label="已完成"
          count={completedCount}
          color="green"
          icon={CheckCircle2}
          active={filter === 'completed'}
          onClick={() => onFilterChange(filter === 'completed' ? 'all' : 'completed')}
        />
      </div>

      {/* 筛选状态提示 */}
      {filter !== 'all' && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-gray-500">当前筛选：</span>
          <Badge variant="secondary" className="gap-1">
            {filter === 'pending' && <><Clock className="w-3 h-3" /> 待派出 ({pendingCount})</>}
            {filter === 'in_progress' && <><Play className="w-3 h-3" /> 途中 ({inProgressCount})</>}
            {filter === 'completed' && <><CheckCircle2 className="w-3 h-3" /> 已完成 ({completedCount})</>}
          </Badge>
          <button
            onClick={() => onFilterChange('all')}
            className="text-blue-600 hover:text-blue-800 text-xs underline"
          >
            显示全部
          </button>
        </div>
      )}

      {/* 车辆任务卡片列表 */}
      {activeVehicles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{filter !== 'all' ? '该状态下暂无任务' : '当天暂无排班任务'}</p>
            {filter !== 'all' && (
              <button
                onClick={() => onFilterChange('all')}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                查看全部任务
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeVehicles.map(({ vehicle, tasks }) => (
            <VehicleTaskCard
              key={vehicle.id}
              vehicle={vehicle}
              vehicleIndex={vehicles.findIndex(v => v.id === vehicle.id) + 1}
              tasks={tasks}
              onStatusChange={onStatusChange}
              isOverdue={isOverdue}
            />
          ))}
        </div>
      )}

      {/* 无任务的空闲车辆提示（仅在"全部"模式下显示） */}
      {filter === 'all' && vehicles.length > activeVehicles.length && (
        <p className="text-sm text-gray-400 text-center">
          还有 {vehicles.length - activeVehicles.length} 辆车当天无排班任务
        </p>
      )}
    </div>
  );
}

// 执行统计小卡
function ExecutionStatCard({
  label,
  count,
  color,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: 'amber' | 'blue' | 'green';
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}) {
  const colors = {
    amber: active
      ? 'bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-300'
      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    blue: active
      ? 'bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-300'
      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    green: active
      ? 'bg-green-100 text-green-800 border-green-300 ring-2 ring-green-300'
      : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  };

  return (
    <Card
      className={`${colors[color]} border cursor-pointer transition-all`}
      onClick={onClick}
    >
      <CardContent className="p-3 text-center">
        <Icon className={`w-5 h-5 mx-auto mb-1 ${active ? '' : 'opacity-70'}`} />
        <p className="text-xl font-bold">{count}</p>
        <p className="text-xs opacity-80">{label}</p>
        {active && (
          <div className="mt-1.5 flex justify-center">
            <div className="w-5 h-0.5 bg-current rounded-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 单个车辆的任务卡片
function VehicleTaskCard({
  vehicle,
  vehicleIndex,
  tasks,
  onStatusChange,
  isOverdue,
}: {
  vehicle: Vehicle;
  vehicleIndex: number;
  tasks: ScheduleTask[];
  onStatusChange: (taskId: string, newStatus: ScheduleTask['status']) => void;
  isOverdue: (task: ScheduleTask) => boolean;
}) {
  // 计算完成进度
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;

  return (
    <Card className="overflow-hidden">
      {/* 车辆头部 */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                #{vehicleIndex}
              </span>
              <div className="bg-white/10 px-2.5 py-1 rounded-md">
                <span className="font-mono text-white font-bold text-sm">
                  {vehicle.plateNumber}
                </span>
              </div>
            </div>
            <span className="text-slate-300 text-sm">{vehicle.driver}</span>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
              {tasks.length} 趟
            </Badge>
          </div>
          {/* 进度指示 */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={`w-2 h-2 rounded-full ${
                    t.status === 'completed'
                      ? 'bg-green-400'
                      : t.status === 'in_progress'
                        ? 'bg-blue-400'
                        : isOverdue(t)
                          ? 'bg-red-400 animate-pulse'
                          : 'bg-slate-500'
                  }`}
                />
              ))}
            </div>
            <span className="text-slate-300 text-xs">
              {completedTasks}/{tasks.length}
            </span>
          </div>
        </div>
      </div>

      {/* 趟次列表 */}
      <div className="divide-y">
        {tasks.map((task, idx) => (
          <TaskRow
            key={task.id}
            task={task}
            index={idx + 1}
            onStatusChange={onStatusChange}
            isOverdue={isOverdue(task)}
          />
        ))}
      </div>
    </Card>
  );
}

// 单行任务
function TaskRow({
  task,
  index,
  onStatusChange,
  isOverdue,
}: {
  task: ScheduleTask;
  index: number;
  onStatusChange: (taskId: string, newStatus: ScheduleTask['status']) => void;
  isOverdue: boolean;
}) {
  const isFlight = task.customers[0]?.transportType === '飞机';
  const hasDelayed = task.customers.some(
    (c) => c.guestStatus === 'delayed'
  );

  return (
    <div
      className={`p-3 sm:p-4 transition-colors ${
        task.status === 'completed'
          ? 'bg-green-50/50'
          : task.status === 'in_progress'
            ? 'bg-blue-50/50'
            : isOverdue
              ? 'bg-red-50/50'
              : ''
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* 左侧：任务信息 */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* 标题栏：趟次号 + 航班信息 + 状态标签 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs shrink-0">
              第 {index} 趟
            </Badge>
            <div className="flex items-center gap-1.5">
              {isFlight ? (
                <Plane className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              ) : (
                <Train className="w-3.5 h-3.5 text-green-600 shrink-0" />
              )}
              <span className="font-semibold text-sm">
                {task.customers[0]?.flightNumber || '-'}
              </span>
            </div>
            {/* 延误标记 */}
            {hasDelayed && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                <AlertTriangle className="w-3 h-3 mr-0.5" />
                延误
              </Badge>
            )}
            {/* 超期提醒 */}
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200 hover:bg-red-200">
                ⚠ 已超出发时间
              </Badge>
            )}
            {/* 当前状态标签 */}
            <Badge
              variant={
                task.status === 'completed'
                  ? 'default'
                  : task.status === 'in_progress'
                    ? 'default'
                    : 'secondary'
              }
              className={`text-[10px] px-1.5 py-0 ${
                task.status === 'completed'
                  ? 'bg-green-600 text-white'
                  : task.status === 'in_progress'
                    ? 'bg-blue-600 text-white'
                    : ''
              }`}
            >
              {task.status === 'pending'
                ? '待派出'
                : task.status === 'in_progress'
                  ? '途中'
                  : '已完成'}
            </Badge>
          </div>

          {/* 时间和地点 */}
          <div className="text-xs text-gray-500 space-y-0.5 pl-1">
            <div>
              出发 <span className="font-mono font-medium text-gray-700">{task.pickupTime.split(' ')[1]}</span>
              {' → '}
              到达 <span className="font-mono font-medium text-gray-700">{task.pickupLocation}</span>
            </div>
            {task.dispatchTime && (
              <div className="text-blue-600">
                实际派出：<span className="font-mono">{task.dispatchTime.split(' ')[1] || task.dispatchTime}</span>
              </div>
            )}
            {task.completeTime && (
              <div className="text-green-600">
                接回完成：<span className="font-mono">{task.completeTime.split(' ')[1] || task.completeTime}</span>
              </div>
            )}
          </div>

          {/* 客户列表 */}
          <div className="flex flex-wrap gap-1 pl-1">
            {task.customers.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-0.5 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded"
              >
                <Users className="w-3 h-3 text-gray-400" />
                {c.name} ({c.peopleCount}人)
              </span>
            ))}
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex flex-col gap-1.5 sm:shrink-0">
          {task.status === 'pending' && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
              onClick={() => onStatusChange(task.id, 'in_progress')}
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              派出执行
            </Button>
          )}
          {task.status === 'in_progress' && (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                onClick={() => onStatusChange(task.id, 'completed')}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                标记接回完成
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 text-gray-500"
                onClick={() => onStatusChange(task.id, 'pending')}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                退回待派出
              </Button>
            </>
          )}
          {task.status === 'completed' && (
            <>
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium px-2 py-1">
                <CheckCircle2 className="w-4 h-4" />
                ✓ 已完成
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 text-gray-500 border-gray-200 hover:text-red-600 hover:border-red-300"
                onClick={() => onStatusChange(task.id, 'in_progress')}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                撤销完成
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== 任务详情弹窗（甘特图 tooltip） ====================

function TaskDetail({
  task,
  vehicle,
  vehicleIndex,
}: {
  task: ScheduleTask;
  vehicle: Vehicle;
  vehicleIndex: number;
}) {
  const isFlight = task.customers[0]?.transportType === '飞机';

  // 格式化延误时间
  const formatDelayTime = (timeStr: string) => {
    if (!timeStr) return '';
    const normalized = timeStr.replace('T', ' ');
    const parts = normalized.split(' ');
    return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : normalized;
  };

  return (
    <div className="p-3 space-y-3">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isFlight ? (
            <Plane className="w-4 h-4 text-blue-600" />
          ) : (
            <Train className="w-4 h-4 text-green-600" />
          )}
          <span className="font-bold text-gray-900 text-sm">
            {isFlight ? '飞机接机' : '高铁接机'}
          </span>
        </div>
        <Badge variant="outline" className="text-xs">第 {task.tripNumber} 趟</Badge>
      </div>

      {/* 车辆信息 */}
      <div className="text-sm space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 font-medium">车辆</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">#{vehicleIndex}</span>
            <span className="font-mono font-semibold text-gray-800">{vehicle.plateNumber}</span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">司机</span>
          <span className="text-gray-800">{vehicle.driver}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">电话</span>
          <span className="text-gray-800">{vehicle.driverPhone}</span>
        </div>
      </div>

      {/* 时间信息 */}
      <div className="text-sm space-y-1 pt-2 border-t border-gray-200">
        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">出发时间</span>
          <span className="font-mono font-semibold text-gray-800">{task.pickupTime.split(' ')[1] || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">到达时间</span>
          <span className="font-mono font-semibold text-gray-800">{task.arrivalTime}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">接机地点</span>
          <span className="text-gray-800">{task.pickupLocation}</span>
        </div>
        {task.dispatchTime && (
          <div className="flex justify-between text-blue-700">
            <span className="font-medium">实际派出</span>
            <span className="font-mono">{task.dispatchTime}</span>
          </div>
        )}
        {task.completeTime && (
          <div className="flex justify-between text-green-700">
            <span className="font-medium">接回完成</span>
            <span className="font-mono">{task.completeTime}</span>
          </div>
        )}
      </div>

      {/* 客户信息 */}
      <div className="text-sm space-y-1 pt-2 border-t border-gray-200">
        <div className="font-bold text-gray-900 mb-1 text-sm">客户列表</div>
        {task.customers.map((customer: Customer) => (
          <div key={customer.id}
            className="bg-gray-50 p-2 rounded space-y-0.5"
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-800">{customer.name}</span>
              <span className="text-gray-700">{customer.peopleCount}人</span>
            </div>
            {(customer.salesman || customer.salesmanPhone || customer.company) && (
              <div className="text-gray-600 text-xs mt-0.5">
                {customer.salesman && <span>{customer.salesman}</span>}
                {customer.salesmanPhone && <span> {customer.salesmanPhone}</span>}
                {customer.company && <span> · {customer.company}</span>}
              </div>
            )}
            {customer.guestStatus === 'delayed' && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                <span>延误</span>
                {customer.actualArrivalTime && (
                  <span className="font-mono">
                    → {formatDelayTime(customer.actualArrivalTime)}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="flex justify-between font-bold text-gray-900 pt-1">
          <span>合计</span>
          <span className="text-gray-800">
            {task.customers.reduce(
              (sum: number, c: Customer) => sum + c.peopleCount,
              0
            )}{' '}
            人
          </span>
        </div>
      </div>
    </div>
  );
}
