import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Car,
  CalendarClock,
  Upload,
  AlertCircle,
  CheckCircle,
  UserX,
  AlertTriangle,
  Navigation,
  Play,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Customer, Vehicle } from '@/types';
import { SCHEDULE_CONFIG } from '@/types';

// 生成唯一ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// 智能解析时间格式，支持多种输入并标准化为 HH:MM
const normalizeTime = (raw: string): string | null => {
  const str = String(raw).trim();
  if (!str) return null;

  // Excel 日期序列号（0.388888... 表示小数时间部分）
  if (/^\d+(\.\d+)?$/.test(str) && !/^\d{4}$/.test(str)) {
    const num = parseFloat(str);
    if (num > 0 && num < 1) {
      const totalMinutes = Math.round(num * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // HH:MM:SS 或 H:MM:SS
  let match = str.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (match) {
    const h = parseInt(match[1]);
    const m = parseInt(match[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // HH:MM 或 H:MM
  match = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const h = parseInt(match[1]);
    const m = parseInt(match[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // HH时MM分 或 H时M分 等中文格式
  match = str.match(/^(\d{1,2})\s*[时点:：]\s*(\d{1,2})\s*分?$/);
  if (match) {
    const h = parseInt(match[1]);
    const m = parseInt(match[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  return null;
};

// 智能解析日期格式，支持多种输入并标准化为 YYYY-MM-DD
const normalizeDate = (raw: string): string | null => {
  const str = String(raw).trim();
  if (!str) return null;

  // 已是标准格式 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // YYYY/MM/DD
  let match = str.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  // YYYY年MM月DD日
  match = str.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  // Excel 日期序列号（如 44927 表示 2025-01-01）
  if (/^\d{4,5}$/.test(str)) {
    const num = parseInt(str);
    if (num > 40000 && num < 60000) {
      // Excel 日期起始点为 1900-01-01，但有一个闰年 bug（1900-02-29 不存在但 Excel 认为存在）
      const epoch = new Date(1899, 11, 30);
      const date = new Date(epoch.getTime() + num * 86400000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return null;
};

// 模拟排班任务结构
interface SimTask {
  id: string;
  customer: Customer;
  pickupTimeMinutes: number; // 从0点开始的分钟数（出发时间）
  arrivalDate: string;
  transportType: string;
  tripDuration: number; // 该趟次的往返耗时（飞机150/高铁100）
}

// 预计用车计算算法 - 与实际排班算法保持完全一致
const calculateEstimatedVehiclesFromStats = (customers: Customer[]) => {
  // 过滤需要用车的客户（排除取消、自驾）
  const customersNeedingVehicle = customers.filter(c =>
    c.transportType !== '自驾' &&
    c.guestStatus !== 'cancelled' &&
    c.needVehicle !== false
  );

  if (customersNeedingVehicle.length === 0) return 0;

  // 导入排班配置
  const { flightDepartureLeadTime, trainDepartureLeadTime, flightPickupDuration, trainPickupDuration, maxPassengersPerVehicle, maxTripsPerVehicle } = SCHEDULE_CONFIG;

  // 生成模拟任务
  const tasks: SimTask[] = [];

  for (const customer of customersNeedingVehicle) {
    // 出发提前量：飞机60分钟，高铁40分钟
    const departureLeadTime = customer.transportType === '飞机'
      ? flightDepartureLeadTime
      : trainDepartureLeadTime;

    // 完整往返耗时（趟次间隔）：飞机150分钟，高铁100分钟
    const tripDuration = customer.transportType === '飞机'
      ? flightPickupDuration
      : trainPickupDuration;

    // 处理延误客人
    let effectiveArrivalTime = customer.arrivalTime || '';
    let effectiveArrivalDate = customer.arrivalDate || '';
    if (customer.guestStatus === 'delayed' && customer.actualArrivalTime) {
      const parts = customer.actualArrivalTime.split(/[T\s]/);
      effectiveArrivalDate = parts[0] || customer.arrivalDate || '';
      effectiveArrivalTime = parts[1] || customer.arrivalTime || '';
    }

    // 跳过无效时间数据
    if (!effectiveArrivalTime || typeof effectiveArrivalTime !== 'string') continue;

    const [arrHour, arrMin] = String(effectiveArrivalTime).split(':').map(Number);
    const arrivalMinutes = arrHour * 60 + arrMin;
    const pickupTimeMinutes = arrivalMinutes - departureLeadTime;  // 出发时间 = 到达时间 - 出发提前量

    // 计算需要多少辆车（每车最多6人）
    const vehicleCount = Math.ceil(customer.peopleCount / maxPassengersPerVehicle);

    // 创建对应数量的任务
    for (let i = 0; i < vehicleCount; i++) {
      tasks.push({
        id: generateId(),
        customer,
        pickupTimeMinutes,
        arrivalDate: effectiveArrivalDate,
        transportType: customer.transportType,
        tripDuration,  // 该趟次自身的往返耗时
      });
    }
  }

  // 按到达时间排序
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateCompare = a.arrivalDate.localeCompare(b.arrivalDate);
    if (dateCompare !== 0) return dateCompare;
    return a.pickupTimeMinutes - b.pickupTimeMinutes;
  });

  // 分配车辆 - 与实际排班算法完全一致
  // 核心逻辑：遍历已分配车辆，检查趟次上限和时间间隔
  // 时间间隔判断：需要与时间上最近的前后任务都检查
  // 如果都不满足，则分配新车辆（模拟无限车辆池）
  // 每辆车记录所有已分配任务的出发时间和往返耗时
  const vehicleSchedule: Map<string, {
    assignedTasks: { pickupMinutes: number; duration: number }[];
    tripCount: number;
    flightCount: number;
    trainCount: number;
  }> = new Map();
  let vehicleCounter = 0;

  for (const task of sortedTasks) {
    let assigned = false;

    // 遍历所有已分配的车辆，找到第一个满足条件的
    for (const [_vehicleId, vehicleInfo] of vehicleSchedule) {
      // 检查趟次上限（每车最多4趟）
      if (vehicleInfo.tripCount >= maxTripsPerVehicle) continue;

      // 检查时间间隔 - 与实际排班完全一致
      // 后向检查：当前出发 - 之前最近出发 >= 之前最近一趟的往返耗时
      // 前向检查：之后最近出发 - 当前出发 >= 当前往返耗时
      let timeIntervalOk = true;
      const earlierTasks = vehicleInfo.assignedTasks
        .filter(t => t.pickupMinutes <= task.pickupTimeMinutes)
        .sort((a, b) => b.pickupMinutes - a.pickupMinutes);
      
      if (earlierTasks.length > 0) {
        const nearest = earlierTasks[0];
        if (task.pickupTimeMinutes - nearest.pickupMinutes < nearest.duration) {
          timeIntervalOk = false;
        }
      }

      if (timeIntervalOk) {
        const laterTasks = vehicleInfo.assignedTasks
          .filter(t => t.pickupMinutes > task.pickupTimeMinutes)
          .sort((a, b) => a.pickupMinutes - b.pickupMinutes);
        
        if (laterTasks.length > 0) {
          const nearest = laterTasks[0];
          if (nearest.pickupMinutes - task.pickupTimeMinutes < task.tripDuration) {
            timeIntervalOk = false;
          }
        }
      }

      if (timeIntervalOk) {
        // 可以分配给这辆车
        vehicleInfo.assignedTasks.push({
          pickupMinutes: task.pickupTimeMinutes,
          duration: task.tripDuration,
        });
        vehicleInfo.tripCount += 1;
        if (task.transportType === '飞机') {
          vehicleInfo.flightCount += 1;
        } else {
          vehicleInfo.trainCount += 1;
        }
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // 需要新分配一辆车
      vehicleCounter++;
      vehicleSchedule.set(`temp_v_${vehicleCounter}`, {
        assignedTasks: [{
          pickupMinutes: task.pickupTimeMinutes,
          duration: task.tripDuration,
        }],
        tripCount: 1,
        flightCount: task.transportType === '飞机' ? 1 : 0,
        trainCount: task.transportType === '高铁' ? 1 : 0,
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
  onImportCustomers: (customers: Omit<Customer, 'id' | 'createdAt' | 'status' | 'source'>[]) => { skippedCount: number } | void;
  onImportVehicles: (vehicles: Omit<Vehicle, 'id' | 'createdAt' | 'status' | 'source'>[]) => { skippedCount: number } | void;
  onGenerateSchedule: () => void;
  navigateTo: (path: string) => void;
  customerCount: number;
  vehicleCount: number;
  allCustomers: Customer[];
}

export function Dashboard({
  stats,
  onImportCustomers,
  onImportVehicles,
  onGenerateSchedule,
  navigateTo,
  customerCount,
  vehicleCount,
  allCustomers,
}: DashboardProps) {

  // 生成排班并跳转到排班方案页面
  const handleGenerateSchedule = () => {
    onGenerateSchedule();
    navigateTo('/schedule');
  };
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

        if (!jsonData || jsonData.length === 0) {
          alert('⚠️ 导入失败：文件内容为空，请检查Excel文件是否有数据');
          return;
        }

        // 检查表头是否有必要的字段
        const firstRow = jsonData[0] as any;
        const hasName = firstRow['姓名'] !== undefined || firstRow['name'] !== undefined;
        const hasDate = firstRow['落地日期'] !== undefined || firstRow['arrivalDate'] !== undefined;
        const hasTime = firstRow['落地时间'] !== undefined || firstRow['arrivalTime'] !== undefined;

        if (!hasName && !hasDate && !hasTime) {
          alert('⚠️ 导入失败：未找到必要的表头字段（姓名、落地日期、落地时间），请下载最新模板');
          return;
        }

        const validCustomers: any[] = [];
        const errorRows: { row: number; name: string; errors: string[] }[] = [];

        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2; // Excel行号从2开始（1是表头）
          const errors: string[] = [];

          // 提取字段
          const name = String(row['姓名'] || row['name'] || '').trim();
          const phone = String(row['电话'] || row['phone'] || '').trim();
          const type = row['类型'] || row['type'] || '个人';
          const peopleCount = parseInt(row['人数'] || row['peopleCount'] || '1') || 1;
          const transportType = row['入黔方式'] || row['transportType'] || '飞机';
          const flightNumber = String(row['航班号'] || row['高铁班次'] || row['flightNumber'] || '').trim();
          let arrivalDate = String(row['落地日期'] || row['arrivalDate'] || '').trim();
          let arrivalTime = String(row['落地时间'] || row['arrivalTime'] || '').trim();
          const salesman = String(row['业务员'] || row['salesman'] || '').trim();
          const salesmanPhone = String(row['业务员电话'] || row['salesmanPhone'] || '').trim();
          const company = String(row['业务员所属公司'] || row['company'] || '').trim();

          // 验证必填字段
          if (!name) {
            errors.push('缺少姓名');
          }

          // 智能解析日期格式
          const normalizedDate = normalizeDate(arrivalDate);
          if (arrivalDate && !normalizedDate) {
            errors.push('日期格式无法识别（支持：2025-01-15、2025/01/15、2025年1月15日）');
          } else if (normalizedDate) {
            arrivalDate = normalizedDate;
          }

          // 智能解析时间格式
          const normalizedTime = normalizeTime(arrivalTime);
          if (arrivalTime && !normalizedTime) {
            errors.push('时间格式无法识别（支持：9:20、09:20、9:20:00、9时20分）');
          } else if (normalizedTime) {
            arrivalTime = normalizedTime;
          }

          // 验证入黔方式
          if (!['飞机', '高铁', '自驾'].includes(transportType)) {
            errors.push('入黔方式只能是：飞机、高铁、自驾');
          }

          // 验证类型
          if (!['个人', '家庭'].includes(type)) {
            errors.push('类型只能是：个人、家庭');
          }

          if (errors.length > 0) {
            errorRows.push({ row: rowNum, name: name || '(无姓名)', errors });
            return;
          }

          validCustomers.push({
            name,
            phone,
            type: type === '家庭' ? '家庭' as const : '个人' as const,
            peopleCount,
            transportType: transportType as '高铁' | '飞机' | '自驾',
            flightNumber,
            arrivalDate,
            arrivalTime,
            salesman,
            salesmanPhone,
            company,
            needVehicle: transportType !== '自驾',
          });
        });

        if (validCustomers.length > 0) {
          const importResult = onImportCustomers(validCustomers);
          const skippedCount = importResult?.skippedCount ?? 0;
          const addedCount = validCustomers.length - skippedCount;
          const estimatedCount = calculateEstimatedVehiclesFromStats(
            validCustomers as unknown as Customer[]
          );

          let message = `✅ 成功导入 ${addedCount} 条客户信息`;
          if (skippedCount > 0) {
            message += `\n⏭️ 跳过 ${skippedCount} 条重复数据（姓名+手机号相同）`;
          }
          message += `\n📊 预计用车：${estimatedCount} 辆`;
          message += `\n\n💡 请前往「客户管理」页面，点击「重新排班」生成详细排班方案`;

          if (errorRows.length > 0) {
            message += `\n\n⚠️ 有 ${errorRows.length} 行数据未通过验证：`;
            errorRows.slice(0, 5).forEach(err => {
              message += `\n第${err.row}行「${err.name}」：${err.errors.join('、')}`;
            });
            if (errorRows.length > 5) {
              message += `\n...还有 ${errorRows.length - 5} 行错误`;
            }
            message += `\n\n请修正后重新导入`;
          }

          alert(message);
        } else {
          let errorMsg = '⚠️ 导入失败：所有行都存在数据问题\n\n';
          errorRows.slice(0, 5).forEach(err => {
            errorMsg += `第${err.row}行「${err.name}」：${err.errors.join('、')}\n`;
          });
          if (errorRows.length > 5) {
            errorMsg += `\n...还有 ${errorRows.length - 5} 行错误`;
          }
          alert(errorMsg);
        }
      } catch (error) {
        console.error('导入错误:', error);
        alert('❌ 文件读取失败：\n1. 请确认文件是有效的Excel格式（.xlsx/.xls）\n2. 文件没有被其他程序打开\n3. 尝试重新保存文件后再导入');
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

        if (!jsonData || jsonData.length === 0) {
          alert('⚠️ 导入失败：文件内容为空，请检查Excel文件是否有数据');
          return;
        }

        const validVehicles: any[] = [];
        const errorRows: { row: number; plate: string; errors: string[] }[] = [];

        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2;
          const errors: string[] = [];

          const plateNumber = String(row['车牌'] || row['plateNumber'] || '').trim();
          const driver = String(row['师傅'] || row['driver'] || '').trim();
          const driverPhone = String(row['电话'] || row['phone'] || row['driverPhone'] || '').trim();
          const vehicleType = String(row['车型'] || row['vehicleType'] || '').trim();
          const maxTrips = parseInt(row['趟次限制'] || row['maxTrips'] || '4') || 4;

          if (!plateNumber) {
            errors.push('缺少车牌');
          }

          if (!driver) {
            errors.push('缺少师傅姓名');
          }

          if (driverPhone && !/^1[3-9]\d{9}$/.test(driverPhone)) {
            errors.push('电话号码格式错误');
          }

          if (maxTrips < 1 || maxTrips > 10) {
            errors.push('趟次限制应在1-10之间');
          }

          if (errors.length > 0) {
            errorRows.push({ row: rowNum, plate: plateNumber || '(无车牌)', errors });
            return;
          }

          validVehicles.push({
            plateNumber,
            driver,
            driverPhone,
            vehicleType,
            maxTrips,
          });
        });

        if (validVehicles.length > 0) {
          const importResult = onImportVehicles(validVehicles);
          const skippedCount = importResult?.skippedCount ?? 0;
          const addedCount = validVehicles.length - skippedCount;

          let message = `✅ 成功导入 ${addedCount} 辆车辆信息`;
          if (skippedCount > 0) {
            message += `\n⏭️ 跳过 ${skippedCount} 条重复数据（车牌号相同）`;
          }

          if (errorRows.length > 0) {
            message += `\n\n⚠️ 有 ${errorRows.length} 行数据未通过验证：`;
            errorRows.slice(0, 5).forEach(err => {
              message += `\n第${err.row}行「${err.plate}」：${err.errors.join('、')}`;
            });
            if (errorRows.length > 5) {
              message += `\n...还有 ${errorRows.length - 5} 行错误`;
            }
            message += `\n\n请修正后重新导入`;
          }

          alert(message);
        } else {
          let errorMsg = '⚠️ 导入失败：所有行都存在数据问题\n\n';
          errorRows.slice(0, 5).forEach(err => {
            errorMsg += `第${err.row}行「${err.plate}」：${err.errors.join('、')}\n`;
          });
          alert(errorMsg);
        }
      } catch (error) {
        console.error('车辆导入错误:', error);
        alert('❌ 文件读取失败：\n1. 请确认文件是有效的Excel格式（.xlsx/.xls）\n2. 文件没有被其他程序打开\n3. 尝试重新保存文件后再导入');
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
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">数据看板</h1>
          <p className="text-gray-500 text-sm">会议车辆调度系统概览</p>
        </div>
        {/* 快捷入口按钮 */}
        {customerCount > 0 && vehicleCount > 0 && (
          <Button
            onClick={handleGenerateSchedule}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
            size="sm"
          >
            <Play className="w-4 h-4" />
            生成排班
          </Button>
        )}
      </div>

      {/* 紧凑统计卡片 - 一行6列 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatCardCompact
          title="参会组数"
          value={stats.groupCount}
          suffix={`${stats.totalPeople}人`}
          icon={Users}
          color="blue"
        />
        <StatCardCompact
          title="预计用车"
          value={estimatedVehiclesPreview}
          suffix="辆"
          icon={Car}
          color="green"
        />
        <StatCardCompact
          title="录入车辆"
          value={stats.registeredVehicles}
          suffix="辆"
          icon={CalendarClock}
          color="purple"
        />
        <StatCardCompact
          title="延误"
          value={stats.delayedCount}
          suffix="人"
          icon={AlertTriangle}
          color="yellow"
        />
        <StatCardCompact
          title="取消"
          value={stats.cancelledCount}
          suffix="人"
          icon={UserX}
          color="red"
        />
        <StatCardCompact
          title="自驾"
          value={stats.selfDriveCount}
          suffix="人"
          icon={Navigation}
          color="gray"
        />
      </div>

      {/* 状态提示栏 - 一行显示多个提示 */}
      {(stats.registeredVehicles > 0 && estimatedVehiclesPreview > stats.registeredVehicles) ||
       stats.scheduledTasks > 0 ||
       customerCount === 0 || vehicleCount === 0 ? (
        <div className="flex flex-wrap gap-3">
          {/* 车辆不足提示 */}
          {stats.registeredVehicles > 0 && estimatedVehiclesPreview > stats.registeredVehicles && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span className="text-orange-800">
                车辆不足：需要 <strong>{estimatedVehiclesPreview}</strong> 辆，已有 <strong>{stats.registeredVehicles}</strong> 辆
              </span>
            </div>
          )}

          {/* 排班完成提示 */}
          {stats.scheduledTasks > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-green-800">
                已生成 <strong>{stats.scheduledTasks}</strong> 个任务
              </span>
            </div>
          )}

          {/* 数据缺失提示 */}
          {customerCount === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">请先导入客户名单</span>
            </div>
          )}

          {vehicleCount === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">请先导入车辆信息</span>
            </div>
          )}
        </div>
      ) : null}

      {/* 数据导入区域 - 紧凑两列 */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 客户名单导入 */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">客户名单</span>
                <Badge variant="outline" className="text-xs">{customerCount} 条</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => downloadTemplate('customer')}
              >
                下载模板
              </Button>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleCustomerImport}
                className="hidden"
                id="customer-import"
              />
              <label htmlFor="customer-import" className="cursor-pointer block">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">点击上传 Excel</p>
                <p className="text-xs text-gray-400">.xlsx .xls .csv</p>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 车辆信息导入 */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-green-50 border-b border-green-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-900">车辆信息</span>
                <Badge variant="outline" className="text-xs">{vehicleCount} 辆</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => downloadTemplate('vehicle')}
              >
                下载模板
              </Button>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-green-300 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleVehicleImport}
                className="hidden"
                id="vehicle-import"
              />
              <label htmlFor="vehicle-import" className="cursor-pointer block">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">点击上传 Excel</p>
                <p className="text-xs text-gray-400">.xlsx .xls .csv</p>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 紧凑统计卡片组件
interface StatCardCompactProps {
  title: string;
  value: number;
  suffix: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'red' | 'gray';
}

function StatCardCompact({ title, value, suffix, icon: Icon, color }: StatCardCompactProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{title}</p>
          <p className="text-lg font-bold text-gray-900">
            {value}
            <span className="text-xs font-normal text-gray-400 ml-1">{suffix}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

