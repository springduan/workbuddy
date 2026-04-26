import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Car,
  CalendarClock,
  Upload,
  AlertCircle,
  CheckCircle,
  Info,
  UserX,
  AlertTriangle,
  Navigation,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Customer, Vehicle } from '@/types';
import { SCHEDULE_CONFIG } from '@/types';

// 生成唯一ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// 模拟排班任务结构
interface SimTask {
  id: string;
  customer: Customer;
  pickupTimeMinutes: number; // 从0点开始的分钟数
  arrivalTime: string;
  arrivalDate: string;
  transportType: string;
  pickupDuration: number; // 接机耗时
}

// 预计用车计算算法 - 基于排班逻辑（考虑时间间隔、趟次限制和每车6人限制）
const calculateEstimatedVehiclesFromStats = (customers: Customer[]) => {
  // 过滤需要用车的客户（排除取消、自驾）
  const customersNeedingVehicle = customers.filter(c =>
    c.transportType !== '自驾' &&
    c.guestStatus !== 'cancelled' &&
    c.needVehicle !== false
  );

  if (customersNeedingVehicle.length === 0) return 0;

  // 生成模拟任务（考虑每车6人限制，超过6人拆分为多个任务）
  const tasks: SimTask[] = [];
  
  for (const customer of customersNeedingVehicle) {
    const pickupDuration = customer.transportType === '飞机'
      ? SCHEDULE_CONFIG.flightPickupDuration
      : SCHEDULE_CONFIG.trainPickupDuration;

    const [arrHour, arrMin] = customer.arrivalTime.split(':').map(Number);
    const arrivalMinutes = arrHour * 60 + arrMin;
    const pickupTimeMinutes = arrivalMinutes - pickupDuration;

    // 计算需要多少辆车（每车最多6人）
    const vehicleCount = Math.ceil(customer.peopleCount / SCHEDULE_CONFIG.maxPassengersPerVehicle);
    
    // 创建对应数量的任务
    for (let i = 0; i < vehicleCount; i++) {
      tasks.push({
        id: generateId(),
        customer,
        pickupTimeMinutes,
        arrivalTime: customer.arrivalTime,
        arrivalDate: customer.arrivalDate,
        transportType: customer.transportType,
        pickupDuration,
      });
    }
  }

  // 按到达时间排序
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateCompare = a.arrivalDate.localeCompare(b.arrivalDate);
    if (dateCompare !== 0) return dateCompare;
    return a.arrivalTime.localeCompare(b.arrivalTime);
  });

  // 分配车辆（考虑时间间隔和趟次限制）
  const vehicleSchedule: Map<string, { lastEndMinutes: number; tripCount: number }> = new Map();

  for (const task of sortedTasks) {
    // 计算当前任务的结束时间
    const taskEndMinutes = task.pickupTimeMinutes + task.pickupDuration + 30;

    // 尝试找到可用的车辆
    let assignedVehicle = false;

    for (const [vehicleId, vehicleInfo] of vehicleSchedule) {
      // 检查趟次上限
      if (vehicleInfo.tripCount >= SCHEDULE_CONFIG.maxTripsPerVehicle) continue;

      // 检查时间间隔是否满足
      const interval = task.pickupTimeMinutes - vehicleInfo.lastEndMinutes;
      
      if (interval >= task.pickupDuration) {
        // 可以分配给这辆车
        vehicleInfo.lastEndMinutes = taskEndMinutes;
        vehicleInfo.tripCount += 1;
        assignedVehicle = true;
        break;
      }
    }

    if (!assignedVehicle) {
      // 需要新分配一辆车
      vehicleSchedule.set(generateId(), {
        lastEndMinutes: taskEndMinutes,
        tripCount: 1,
      });
    }
  }

  return vehicleSchedule.size;
};

interface DashboardProps {
  stats: {
    groupCount: number;
    totalPeople: number;
    estimatedVehicles: number;
    registeredVehicles: number;
    scheduledTasks: number;
    scheduledCustomerGroups: number;
    scheduledPeople: number;
    pendingCustomerGroups: number;
    pendingPeople: number;
    normalCount: number;
    delayedCount: number;
    cancelledCount: number;
    selfDriveCount: number;
  };
  onImportCustomers: (customers: Omit<Customer, 'id' | 'createdAt' | 'status' | 'source'>[]) => void;
  onImportVehicles: (vehicles: Omit<Vehicle, 'id' | 'createdAt' | 'status' | 'source'>[]) => void;
  customerCount: number;
  vehicleCount: number;
  allCustomers: Customer[];
}

export function Dashboard({
  stats,
  onImportCustomers,
  onImportVehicles,
  customerCount,
  vehicleCount,
  allCustomers,
}: DashboardProps) {
  // 客户名单导入处理
  const handleCustomerImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const customers = jsonData.map((row: any) => ({
          name: row['姓名'] || row['name'] || '',
          phone: row['电话'] || row['phone'] || '',
          type: (row['类型'] || row['type'] || '个人') === '家庭' ? '家庭' as const : '个人' as const,
          peopleCount: parseInt(row['人数'] || row['peopleCount'] || '1') || 1,
          transportType: (row['入黔方式'] || row['transportType'] || '飞机') as '高铁' | '飞机' | '自驾',
          flightNumber: row['航班号'] || row['高铁班次'] || row['flightNumber'] || '',
          arrivalDate: row['落地日期'] || row['arrivalDate'] || '',
          arrivalTime: row['落地时间'] || row['arrivalTime'] || '',
          salesman: row['业务员'] || row['salesman'] || '',
          salesmanPhone: row['业务员电话'] || row['salesmanPhone'] || '',
          company: row['业务员所属公司'] || row['company'] || '',
          needVehicle: row['入黔方式'] !== '自驾',
        }));

        const validCustomers = customers.filter(
          (c) => c.name && c.arrivalDate && c.arrivalTime
        );

        if (validCustomers.length > 0) {
          onImportCustomers(validCustomers);
          // 计算本次导入客户的预计用车数量（使用排班算法模拟）
          const estimatedCount = calculateEstimatedVehiclesFromStats(validCustomers);
          alert(
            `✅ 成功导入 ${validCustomers.length} 条客户信息\n\n` +
            `📊 预计用车：${estimatedCount} 辆\n` +
            `（基于排班算法计算，含时间间隔和趟次限制）\n\n` +
            `💡 请前往「客户管理」页面，点击「重新排班」生成详细排班方案`
          );
        } else {
          alert('导入数据格式不正确，请检查模板');
        }
      } catch (error) {
        alert('文件读取失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // 车辆信息导入处理
  const handleVehicleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const vehicles = jsonData.map((row: any) => ({
          plateNumber: row['车牌'] || row['plateNumber'] || '',
          driver: row['师傅'] || row['driver'] || '',
          driverPhone: row['电话'] || row['phone'] || row['driverPhone'] || '',
          vehicleType: row['车型'] || row['vehicleType'] || '',
          maxTrips: parseInt(row['趟次限制'] || row['maxTrips'] || '4') || 4,
        }));

        const validVehicles = vehicles.filter((v) => v.plateNumber && v.driver);

        if (validVehicles.length > 0) {
          onImportVehicles(validVehicles);
          alert(`成功导入 ${validVehicles.length} 辆车辆信息`);
        } else {
          alert('导入数据格式不正确，请检查模板');
        }
      } catch (error) {
        alert('文件读取失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // 实时计算预计用车（基于所有客户）
  const estimatedVehiclesPreview = calculateEstimatedVehiclesFromStats(allCustomers);

  // 下载导入模板
  const downloadTemplate = (type: 'customer' | 'vehicle') => {
    let data: any[];
    let filename: string;

    if (type === 'customer') {
      filename = '客户名单导入模板.xlsx';
      data = [
        {
          '姓名': '示例：张三',
          '电话': '13800138000',
          '类型': '个人',
          '人数': 2,
          '入黔方式': '飞机',
          '航班号': 'CA1234',
          '高铁班次': '',
          '落地日期': '2024-03-15',
          '落地时间': '14:30',
          '业务员': '李四',
          '业务员电话': '13900139000',
          '业务员所属公司': '某某公司',
        },
      ];
    } else {
      filename = '车辆信息导入模板.xlsx';
      data = [
        {
          '车牌': '贵A12345',
          '师傅': '王师傅',
          '电话': '13700137000',
          '车型': '商务别克GL8',
          '趟次限制': 4,
        },
      ];
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">数据看板</h1>
        <p className="text-gray-500 mt-1">查看会议车辆调度系统概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="参会组数"
          value={stats.groupCount}
          subtitle={`共 ${stats.totalPeople} 人`}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="预计用车"
          value={estimatedVehiclesPreview}
          subtitle="辆"
          icon={Car}
          color="green"
        />
        <StatCard
          title="录入车辆"
          value={stats.registeredVehicles}
          subtitle="辆"
          icon={CalendarClock}
          color="purple"
        />
        <StatCard
          title="延误客户"
          value={stats.delayedCount}
          subtitle="人"
          icon={AlertTriangle}
          color="yellow"
        />
        <StatCard
          title="取消客户"
          value={stats.cancelledCount}
          subtitle="人"
          icon={UserX}
          color="red"
        />
        <StatCard
          title="自驾客户"
          value={stats.selfDriveCount}
          subtitle="人"
          icon={Navigation}
          color="green"
        />
      </div>

      {/* 车辆状态提示 */}
      {stats.registeredVehicles > 0 && stats.estimatedVehicles > stats.registeredVehicles && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-orange-800">车辆数量不足</p>
              <p className="text-sm text-orange-700">
                当前录入 {stats.registeredVehicles} 辆车，预计需要 {stats.estimatedVehicles} 辆，
                请及时补充车辆信息。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 已完成排班提示 */}
      {stats.scheduledTasks > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-800">排班已完成</p>
              <p className="text-sm text-green-700">
                已生成 {stats.scheduledTasks} 个排班任务，可前往排班方案页面查看详情。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 数据导入区域 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 客户名单导入 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              导入客户名单
            </CardTitle>
            <CardDescription>
              当前已录入 {customerCount} 条客户信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleCustomerImport}
                className="hidden"
                id="customer-import"
              />
              <label htmlFor="customer-import" className="cursor-pointer">
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1">点击上传客户名单</p>
                <p className="text-xs text-gray-400">支持 .xlsx, .xls, .csv 格式</p>
              </label>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => downloadTemplate('customer')}
            >
              <Info className="w-4 h-4" />
              下载客户名单模板
            </Button>
            <div className="text-xs text-gray-500 space-y-1">
              <p className="font-medium">模板字段说明：</p>
              <p>姓名、电话、类型（家庭/个人）、人数</p>
              <p>入黔方式（高铁/飞机/自驾）</p>
              <p>航班号/高铁班次、落地日期、落地时间</p>
              <p>业务员、业务员电话、业务员所属公司</p>
            </div>
          </CardContent>
        </Card>

        {/* 车辆信息导入 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-green-600" />
              导入车辆信息
            </CardTitle>
            <CardDescription>
              当前已录入 {vehicleCount} 辆车
              <Badge variant="outline" className="ml-2 text-xs">
                每车最多 {4} 趟
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-green-300 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleVehicleImport}
                className="hidden"
                id="vehicle-import"
              />
              <label htmlFor="vehicle-import" className="cursor-pointer">
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1">点击上传车辆信息</p>
                <p className="text-xs text-gray-400">支持 .xlsx, .xls, .csv 格式</p>
              </label>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => downloadTemplate('vehicle')}
            >
              <Info className="w-4 h-4" />
              下载车辆信息模板
            </Button>
            <div className="text-xs text-gray-500 space-y-1">
              <p className="font-medium">模板字段说明：</p>
              <p>车牌、师傅、电话、车型</p>
              <p>趟次限制（默认4趟）</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 排班规则说明 - 已隐藏 */}
      <Card className="bg-gray-50 hidden">
        <CardHeader>
          <CardTitle className="text-base">排班规则说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">1.</span>
              <span>每组客人独立用车，超过6人分配2辆车</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">2.</span>
              <span>飞机提前60分钟出发，高铁提前40分钟出发</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">3.</span>
              <span>趟次间隔：飞机150分钟，高铁100分钟</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">4.</span>
              <span>每辆车最多4趟次，趟次均衡分配</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">5.</span>
              <span>类型均衡：机场/高铁任务平均分配给每辆车</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">6.</span>
              <span>自驾客户不安排接机车辆</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// 统计卡片组件
interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'red';
}

function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {value}
              <span className="text-sm font-normal text-gray-400 ml-1">{subtitle}</span>
            </p>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
