// 客户类型
export type CustomerType = '家庭' | '个人';
export type TransportType = '高铁' | '飞机' | '自驾';

// 客户状态（业务状态）
export type CustomerStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'delayed';

// 客人状态（延误/取消状态）
export type GuestStatus = 'normal' | 'delayed' | 'cancelled';

// 客户信息
export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  peopleCount: number;
  transportType: TransportType;
  flightNumber: string;  // 航班号或高铁班次
  arrivalDate: string;
  arrivalTime: string;
  salesman: string;
  salesmanPhone: string;
  company: string;
  hotel?: string;       // 入住酒店
  needVehicle?: boolean; // 是否需要安排车辆
  status: CustomerStatus;
  createdAt: string;
  source: 'import' | 'manual';  // 数据来源

  // 延误/取消相关字段
  guestStatus?: GuestStatus;     // 客人状态
  originalArrivalTime?: string;   // 原到达时间（延误前）
  actualArrivalTime?: string;     // 延误后的实际到达时间
  delayRemark?: string;           // 延误备注
  cancelRemark?: string;          // 取消原因
  statusUpdateTime?: string;      // 状态变更时间
}

// 变更日志
export interface StatusLog {
  id: string;
  customerId: string;
  customerName: string;
  flightNumber: string;
  action: 'mark_delayed' | 'mark_cancelled' | 'restore_normal' | 'delete' | 'reschedule';
  fromStatus: string;
  toStatus: string;
  originalArrivalTime?: string;
  actualArrivalTime?: string;
  remark?: string;
  time: string;
}

// 车辆信息
export interface Vehicle {
  id: string;
  plateNumber: string;  // 车牌
  driver: string;       // 师傅
  driverPhone: string;
  vehicleType: string;  // 车型
  maxTrips: number;     // 最大趟次
  status: 'available' | 'in_use' | 'maintenance';
  createdAt: string;
  source: 'import' | 'manual';
}

// 排班任务
export interface ScheduleTask {
  id: string;
  vehicleId: string;
  customerGroupId: string;  // 关联的客户组
  customers: Customer[];
  pickupLocation: string;   // 接机地点
  pickupTime: string;       // 出发时间
  arrivalTime: string;      // 预计到达机场时间
  returnTime: string;       // 返回酒店时间
  tripNumber: number;       // 第几趟
  status: 'pending' | 'in_progress' | 'completed';
  // 任务执行登记字段
  dispatchTime?: string;    // 实际派出时间
  completeTime?: string;    // 实际接回完成时间
  dispatchRemark?: string;  // 派出备注
}

// 客户组（用于排班）
export interface CustomerGroup {
  id: string;
  customers: Customer[];
  transportType: TransportType;
  flightNumber: string;
  arrivalDate: string;
  arrivalTime: string;
  pickupLocation: string;
  vehicleCount: number;  // 需要车辆数
  scheduled: boolean;
}

// 用户信息
export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'operator';
}

// 应用状态
export interface AppState {
  isLoggedIn: boolean;
  currentUser: User | null;
  customers: Customer[];
  vehicles: Vehicle[];
  scheduleTasks: ScheduleTask[];
}

// 排班配置接口
export interface ScheduleConfig {
  flightPickupDuration: number;    // 飞机完整往返耗时（分钟）
  trainPickupDuration: number;     // 高铁完整往返耗时（分钟）
  flightDepartureLeadTime: number; // 飞机出发提前量（分钟）
  trainDepartureLeadTime: number;  // 高铁出发提前量（分钟）
  maxPassengersPerVehicle: number; // 每车最大载客数
  maxTripsPerVehicle: number;      // 每车最大趟次
}

// 默认排班配置
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  flightPickupDuration: 150,
  trainPickupDuration: 100,
  flightDepartureLeadTime: 60,
  trainDepartureLeadTime: 40,
  maxPassengersPerVehicle: 6,
  maxTripsPerVehicle: 4,
};

// 运行时使用的排班配置（可从 localStorage 加载）
export let SCHEDULE_CONFIG: ScheduleConfig = { ...DEFAULT_SCHEDULE_CONFIG };

// 更新排班配置
export function updateScheduleConfig(config: ScheduleConfig) {
  SCHEDULE_CONFIG = { ...config };
}
