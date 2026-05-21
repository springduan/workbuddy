import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Plane,
  Train,
  CalendarClock,
  Car,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import type { ScheduleTask, Vehicle, CustomerGroup } from '@/types';
import { SCHEDULE_CONFIG } from '@/types';
import { toast } from 'sonner';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface ScheduleProps {
  scheduleTasks: ScheduleTask[];
  vehicles: Vehicle[];
  customerGroups: CustomerGroup[];
  onGenerateSchedule: () => { success: boolean; message: string };
  onClearSchedule: () => void;
  delayedCount?: number;
}

export function Schedule({ scheduleTasks, vehicles, customerGroups, onGenerateSchedule, onClearSchedule, delayedCount = 0 }: ScheduleProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 获取车辆信息
  const getVehicle = (vehicleId: string) => {
    return vehicles.find((v) => v.id === vehicleId);
  };

  // 获取车辆序号（基于车辆管理列表顺序）
  const getVehicleIndex = (vehicleId: string) => {
    const index = vehicles.findIndex((v) => v.id === vehicleId);
    return index >= 0 ? index + 1 : 0;
  };

  // 过滤排班任务（基于搜索词）
  const filteredTasks = scheduleTasks.filter((task) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
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

  // 按搜索结果更新分组
  const filteredTasksByVehicle = filteredTasks.reduce((acc, task) => {
    const vehicleId = task.vehicleId;
    if (!acc[vehicleId]) {
      acc[vehicleId] = [];
    }
    acc[vehicleId].push(task);
    return acc;
  }, {} as Record<string, ScheduleTask[]>);

  const filteredTasksByDate = filteredTasks.reduce((acc, task) => {
    const date = task.pickupTime.split(' ')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(task);
    return acc;
  }, {} as Record<string, ScheduleTask[]>);

  // 生成排班
  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = onGenerateSchedule();
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setIsGenerating(false);
  };

  // 清除排班
  const handleClear = () => {
    onClearSchedule();
    toast.success('排班已清除');
  };

  // 获取交通工具图标
  const getTransportIcon = (type: string) => {
    switch (type) {
      case '飞机':
        return <Plane className="w-4 h-4" />;
      case '高铁':
        return <Train className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // 统计（基于过滤后数据）
  const scheduledCustomerIds = new Set(filteredTasks.flatMap(t => t.customers.map(c => c.id)));
  const pendingGroups = customerGroups.filter((g) =>
    !g.customers.some(c => scheduledCustomerIds.has(c.id))
  );
  const stats = {
    totalTasks: filteredTasks.length,
    totalVehicles: Object.keys(filteredTasksByVehicle).length,
    scheduledCustomerGroups: customerGroups.filter((g) =>
      g.customers.some(c => scheduledCustomerIds.has(c.id))
    ).length,
    scheduledPeople: filteredTasks.reduce((sum, t) =>
      sum + t.customers.reduce((s, c) => s + c.peopleCount, 0), 0
    ),
    pendingCustomerGroups: pendingGroups.length,
    pendingPeople: pendingGroups.reduce((sum, g) => sum + g.customers.reduce((s, c) => s + c.peopleCount, 0), 0),
  };

  // 计算待安排原因
  const getPendingReasons = () => {
    const reasons: string[] = [];
    const totalGroups = customerGroups.length;
    const hasSchedule = scheduleTasks.length > 0;

    if (!hasSchedule) {
      reasons.push('尚未生成排班，请点击「智能排班」按钮');
    }
    if (totalGroups === 0) {
      reasons.push('暂无需要安排的客户');
    }
    if (vehicles.length === 0) {
      reasons.push('未录入车辆信息，无法排班');
    }
    if (hasSchedule && pendingGroups.length > 0 && totalGroups > 0) {
      // 已生成排班但仍有未安排的——列出具体客户
      const names = pendingGroups
        .slice(0, 5)
        .map(g => {
          const customer = g.customers[0];
          return `${customer.name}（${customer.arrivalDate} ${customer.arrivalTime} ${customer.transportType}）`;
        })
        .join('；');
      const totalPendingPeople = pendingGroups.reduce((sum, g) => sum + g.customers.reduce((s, c) => s + c.peopleCount, 0), 0);
      reasons.push(`以下客户未排入：${names}${pendingGroups.length > 5 ? `等${pendingGroups.length}组` : ''}`);
      reasons.push(`共 ${totalPendingPeople} 人未安排接送`);

      // 分析具体原因
      const usedVehicleIds = new Set(scheduleTasks.map(t => t.vehicleId));
      const allVehicleIds = new Set(vehicles.map(v => v.id));
      const unusedVehicleIds = [...allVehicleIds].filter(id => !usedVehicleIds.has(id));
      
      if (unusedVehicleIds.length > 0) {
        reasons.push(`有 ${unusedVehicleIds.length} 辆车未参与排班（可能趟次已满或时间冲突）`);
      } else {
        // 所有车辆都在使用，可能是全部趟次用完
        const maxTripsPerVehicle = SCHEDULE_CONFIG.maxTripsPerVehicle;
        const totalCapacity = vehicles.length * maxTripsPerVehicle;
        if (scheduleTasks.length >= totalCapacity) {
          reasons.push(`所有 ${vehicles.length} 辆车均已达最大趟次限制（${maxTripsPerVehicle}趟）`);
        } else {
          reasons.push('可能与现有任务存在时间间隔冲突');
        }
      }
    }
    return reasons;
  };

  const pendingReasons = stats.pendingCustomerGroups > 0 ? getPendingReasons() : [];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">排班方案</h1>
          <p className="text-gray-500 mt-1">智能生成并管理车辆排班</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClear}
            className="gap-2 text-red-600 hover:text-red-700"
            disabled={scheduleTasks.length === 0}
          >
            <Trash2 className="w-4 h-4" />
            清除排班
          </Button>
          <Button
            onClick={handleGenerate}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            disabled={isGenerating || customerGroups.length === 0 || vehicles.length === 0}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                智能排班
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="排班任务"
          value={stats.totalTasks}
          unit="趟"
          icon={CalendarClock}
          color="blue"
        />
        <StatCard
          title="使用车辆"
          value={stats.totalVehicles}
          unit="辆"
          icon={Car}
          color="green"
        />
        <StatCard
          title="已安排客户"
          value={stats.scheduledCustomerGroups}
          unit="组"
          subtitle={`${stats.scheduledPeople} 人`}
          icon={CheckCircle}
          color="green"
        />
        {pendingReasons.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <StatCard
                  title="待安排客户"
                  value={stats.pendingCustomerGroups}
                  unit="组"
                  subtitle={`${stats.pendingPeople} 人`}
                  icon={Clock}
                  color="orange"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={8}
              className="bg-white text-gray-700 border border-gray-200 shadow-lg max-w-xs"
            >
              <div className="space-y-1.5">
                <p className="font-medium text-orange-600 text-xs">待安排原因：</p>
                {pendingReasons.map((reason, idx) => (
                  <p key={idx} className="text-xs leading-relaxed">{reason}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <StatCard
            title="待安排客户"
            value={stats.pendingCustomerGroups}
            unit="组"
            subtitle={`${stats.pendingPeople} 人`}
            icon={Clock}
            color="orange"
          />
        )}
        <StatCard
          title="延误客户"
          value={delayedCount}
          unit="组"
          icon={AlertTriangle}
          color="yellow"
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

      {/* 提示信息 */}
      {(customerGroups.length === 0 || vehicles.length === 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-orange-800">无法生成排班</p>
              <p className="text-sm text-orange-700">
                {customerGroups.length === 0 && vehicles.length === 0
                  ? '请先导入客户名单和车辆信息'
                  : customerGroups.length === 0
                  ? '请先导入客户名单'
                  : '请先导入车辆信息'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 排班规则说明 - 已隐藏 */}
      <Card className="bg-gray-50 hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            排班规则
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">1.</span>
              <span>飞机提前{SCHEDULE_CONFIG.flightDepartureLeadTime}分钟出发，高铁提前{SCHEDULE_CONFIG.trainDepartureLeadTime}分钟出发</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">2.</span>
              <span>趟次间隔：飞机{SCHEDULE_CONFIG.flightPickupDuration}分钟，高铁{SCHEDULE_CONFIG.trainPickupDuration}分钟</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">3.</span>
              <span>每车最多{SCHEDULE_CONFIG.maxTripsPerVehicle}趟，趟次均衡分配</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">4.</span>
              <span>类型均衡：机场/高铁任务平均分配给每辆车</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 排班结果 */}
      {filteredTasks.length > 0 ? (
        <Tabs defaultValue="by-vehicle" className="space-y-4">
          <TabsList>
            <TabsTrigger value="by-vehicle" className="gap-2">
              <Car className="w-4 h-4" />
              按车辆
            </TabsTrigger>
            <TabsTrigger value="by-date" className="gap-2">
              <CalendarClock className="w-4 h-4" />
              按日期
            </TabsTrigger>
          </TabsList>

          {/* 按车辆查看 */}
          <TabsContent value="by-vehicle" className="space-y-4">
            {Object.entries(filteredTasksByVehicle).map(([vehicleId, tasks]) => {
              const vehicle = getVehicle(vehicleId);
              return (
                <Card key={vehicleId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-blue-600 font-bold">{getVehicleIndex(vehicleId)}</span>
                        </div>
                        <div>
                          <CardTitle className="text-lg font-mono">
                            {vehicle?.plateNumber || '未知车牌'}
                          </CardTitle>
                          <CardDescription>
                            {vehicle?.driver || '未知司机'} · {vehicle?.vehicleType || '-'}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge>{tasks.length} 趟</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>趟次</TableHead>
                          <TableHead>出发时间</TableHead>
                          <TableHead>到达时间</TableHead>
                          <TableHead>返回时间</TableHead>
                          <TableHead>接机地点</TableHead>
                          <TableHead>客户</TableHead>
                          <TableHead>交通</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              <Badge variant="outline">第 {task.tripNumber} 趟</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {task.pickupTime.split(' ')[1] || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {task.arrivalTime}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-gray-600">
                              {task.returnTime.split(' ')[1] || '-'}
                            </TableCell>
                            <TableCell>{task.pickupLocation}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {task.customers.map((c) => (
                                  <div key={c.id} className="text-sm">
                                    <div className="flex items-center gap-1">
                                      <span>{c.name} ({c.peopleCount}人)</span>
                                      {c.guestStatus === 'delayed' && (
                                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-amber-100 text-amber-700 text-xs rounded border border-amber-200">
                                          <AlertTriangle className="w-2.5 h-2.5" />
                                          延误
                                        </span>
                                      )}
                                    </div>
                                    {c.guestStatus === 'delayed' && c.actualArrivalTime && (
                                      <div className="text-xs text-amber-600 mt-0.5">
                                        实际到达：{c.actualArrivalTime.replace('T', ' ').substring(0, 16)}
                                      </div>
                                    )}
                                    {(c.salesman || c.salesmanPhone || c.company) && (
                                      <div className="text-xs text-gray-400 mt-0.5">
                                        {c.salesman && <span>{c.salesman}</span>}
                                        {c.salesmanPhone && <span> {c.salesmanPhone}</span>}
                                        {c.company && <span> · {c.company}</span>}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {getTransportIcon(task.customers[0]?.transportType)}
                                <span className="text-xs">
                                  {task.customers[0]?.flightNumber || '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  task.status === 'completed'
                                    ? 'default'
                                    : task.status === 'in_progress'
                                    ? 'secondary'
                                    : 'outline'
                                }
                              >
                                {task.status === 'pending'
                                  ? '待执行'
                                  : task.status === 'in_progress'
                                  ? '进行中'
                                  : '已完成'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* 按日期查看 */}
          <TabsContent value="by-date" className="space-y-4">
            {Object.entries(filteredTasksByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, tasks]) => (
                <Card key={date}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalendarClock className="w-5 h-5 text-blue-600" />
                      {date}
                    </CardTitle>
                    <CardDescription>共 {tasks.length} 个任务</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>时间</TableHead>
                          <TableHead>车辆</TableHead>
                          <TableHead>趟次</TableHead>
                          <TableHead>出发时间</TableHead>
                          <TableHead>到达时间</TableHead>
                          <TableHead>返回时间</TableHead>
                          <TableHead>接机地点</TableHead>
                          <TableHead>客户信息</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks
                          .sort((a, b) =>
                            (a.pickupTime.split(' ')[1] || '').localeCompare(
                              b.pickupTime.split(' ')[1] || ''
                            )
                          )
                          .map((task) => {
                            const vehicle = getVehicle(task.vehicleId);
                            return (
                              <TableRow key={task.id}>
                                <TableCell className="font-mono">
                                  {task.pickupTime.split(' ')[1] || '-'}
                                </TableCell>
                                <TableCell className="font-mono">
                                  <span className="text-gray-400 mr-1">#{getVehicleIndex(task.vehicleId)}</span>
                                  {vehicle?.plateNumber || '-'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    第 {task.tripNumber} 趟
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono">
                                  {task.pickupTime.split(' ')[1] || '-'}
                                </TableCell>
                                <TableCell className="font-mono">
                                  {task.arrivalTime}
                                </TableCell>
                                <TableCell className="font-mono text-gray-600">
                                  {task.returnTime.split(' ')[1] || '-'}
                                </TableCell>
                                <TableCell>{task.pickupLocation}</TableCell>
                                <TableCell>
                                  <div className="text-sm space-y-1">
                                    {task.customers.map((c) => (
                                      <div key={c.id}>
                                        <div className="flex items-center gap-1">
                                          <span>{c.name} · {c.flightNumber || '-'} · {c.peopleCount}人</span>
                                          {c.guestStatus === 'delayed' && (
                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-amber-100 text-amber-700 text-xs rounded border border-amber-200">
                                              <AlertTriangle className="w-2.5 h-2.5" />
                                              延误
                                            </span>
                                          )}
                                        </div>
                                        {c.guestStatus === 'delayed' && c.actualArrivalTime && (
                                          <div className="text-xs text-amber-600">
                                            实际到达：{c.actualArrivalTime.replace('T', ' ').substring(0, 16)}
                                          </div>
                                        )}
                                        {(c.salesman || c.salesmanPhone || c.company) && (
                                          <div className="text-xs text-gray-400">
                                            {c.salesman && <span>{c.salesman}</span>}
                                            {c.salesmanPhone && <span> {c.salesmanPhone}</span>}
                                            {c.company && <span> · {c.company}</span>}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      task.status === 'completed'
                                        ? 'default'
                                        : task.status === 'in_progress'
                                        ? 'secondary'
                                        : 'outline'
                                    }
                                  >
                                    {task.status === 'pending'
                                      ? '待执行'
                                      : task.status === 'in_progress'
                                      ? '进行中'
                                      : '已完成'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarClock className="w-16 h-16 text-gray-300 mb-4" />
            {searchTerm ? (
              <>
                <p className="text-lg text-gray-500 mb-2">未找到匹配的排班任务</p>
                <p className="text-sm text-gray-400">
                  尝试其他关键词搜索
                </p>
              </>
            ) : (
              <>
                <p className="text-lg text-gray-500 mb-2">暂无排班方案</p>
                <p className="text-sm text-gray-400">
                  点击"智能排班"按钮生成排班方案
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 统计卡片组件
interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow';
}

function StatCard({ title, value, subtitle, unit, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
            </p>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
