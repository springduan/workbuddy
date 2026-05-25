import { useState, useEffect, useCallback } from 'react';
import type { Customer, Vehicle, ScheduleTask, User, CustomerGroup, StatusLog, GuestStatus, ScheduleConfig } from '@/types';
import { DEFAULT_SCHEDULE_CONFIG, updateScheduleConfig, SCHEDULE_CONFIG } from '@/types';

// 本地存储键名
const STORAGE_KEYS = {
  USERS: 'scheduler_users',
  CUSTOMERS: 'scheduler_customers',
  VEHICLES: 'scheduler_vehicles',
  SCHEDULE: 'scheduler_schedule',
  CURRENT_USER: 'scheduler_current_user',
  STATUS_LOGS: 'scheduler_status_logs',
  SCHEDULE_CONFIG: 'scheduler_config',
  VEHICLE_STATS: 'scheduler_vehicle_stats',
};

// 初始管理员账户
const DEFAULT_ADMIN: User = {
  id: 'admin',
  username: 'admin',
  password: 'admin123',
  name: '管理员',
  role: 'admin',
};

// 生成唯一ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function useAppData() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [scheduleTasks, setScheduleTasks] = useState<ScheduleTask[]>([]);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化加载数据
  useEffect(() => {
    // 初始化用户（如果没有的话）
    const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!storedUsers) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([DEFAULT_ADMIN]));
    }

    // 加载数据
    const storedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const storedVehicles = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    const storedSchedule = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
    const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const storedLogs = localStorage.getItem(STORAGE_KEYS.STATUS_LOGS);
    const storedConfig = localStorage.getItem(STORAGE_KEYS.SCHEDULE_CONFIG);

    if (storedCustomers) setCustomers(JSON.parse(storedCustomers));
    if (storedVehicles) setVehicles(JSON.parse(storedVehicles));
    if (storedSchedule) setScheduleTasks(JSON.parse(storedSchedule));
    if (storedLogs) setStatusLogs(JSON.parse(storedLogs));
    if (storedConfig) {
      const config = JSON.parse(storedConfig);
      setScheduleConfig(config);
      updateScheduleConfig(config);
    }
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setCurrentUser(user);
      setIsLoggedIn(true);
    }

    setIsLoading(false);
  }, []);

  // 保存数据到本地存储
  const saveCustomers = useCallback((data: Customer[]) => {
    setCustomers(data);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(data));
  }, []);

  const saveVehicles = useCallback((data: Vehicle[]) => {
    setVehicles(data);
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(data));
  }, []);

  const saveScheduleTasks = useCallback((data: ScheduleTask[]) => {
    setScheduleTasks(data);
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(data));
  }, []);

  const saveStatusLogs = useCallback((data: StatusLog[]) => {
    setStatusLogs(data);
    localStorage.setItem(STORAGE_KEYS.STATUS_LOGS, JSON.stringify(data));
  }, []);

  // 添加变更日志
  const addStatusLog = useCallback((
    customerId: string,
    customerName: string,
    flightNumber: string,
    action: StatusLog['action'],
    fromStatus: string,
    toStatus: string,
    originalArrivalTime?: string,
    actualArrivalTime?: string,
    remark?: string
  ) => {
    const newLog: StatusLog = {
      id: generateId(),
      customerId,
      customerName,
      flightNumber,
      action,
      fromStatus,
      toStatus,
      originalArrivalTime,
      actualArrivalTime,
      remark,
      time: new Date().toISOString(),
    };
    const updatedLogs = [newLog, ...statusLogs].slice(0, 200); // 最多保留200条
    saveStatusLogs(updatedLogs);
    return newLog;
  }, [statusLogs, saveStatusLogs]);

  // 标记客户为延误
  const markCustomerDelayed = useCallback((
    id: string,
    actualArrivalTime: string,
    remark?: string
  ) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return false;

    // 统一格式：将 datetime-local 的 "2026-04-25T18:00" 转为 "2026-04-25 18:00"
    const normalizedTime = actualArrivalTime.replace('T', ' ');

    // 保存原始到达时间
    const originalTime = `${customer.arrivalDate} ${customer.arrivalTime}`;

    // 更新客户状态
    const updatedCustomer: Customer = {
      ...customer,
      guestStatus: 'delayed' as GuestStatus,
      originalArrivalTime: originalTime,
      actualArrivalTime: normalizedTime,
      delayRemark: remark,
      statusUpdateTime: new Date().toISOString(),
    };

    const updatedCustomers = customers.map(c => c.id === id ? updatedCustomer : c);
    saveCustomers(updatedCustomers);

    // 添加日志
    addStatusLog(
      id,
      customer.name,
      customer.flightNumber,
      'mark_delayed',
      customer.guestStatus || 'normal',
      'delayed',
      originalTime,
      normalizedTime,
      remark
    );

    return true;
  }, [customers, saveCustomers, addStatusLog]);

  // 标记客户为取消
  const markCustomerCancelled = useCallback((
    id: string,
    remark?: string
  ) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return false;

    const updatedCustomer: Customer = {
      ...customer,
      guestStatus: 'cancelled' as GuestStatus,
      cancelRemark: remark,
      statusUpdateTime: new Date().toISOString(),
    };

    const updatedCustomers = customers.map(c => c.id === id ? updatedCustomer : c);
    saveCustomers(updatedCustomers);

    // 添加日志
    addStatusLog(
      id,
      customer.name,
      customer.flightNumber,
      'mark_cancelled',
      customer.guestStatus || 'normal',
      'cancelled',
      undefined,
      undefined,
      remark
    );

    return true;
  }, [customers, saveCustomers, addStatusLog]);

  // 恢复正常状态
  const restoreCustomerNormal = useCallback((id: string) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return false;

    const updatedCustomer: Customer = {
      ...customer,
      guestStatus: 'normal' as GuestStatus,
      actualArrivalTime: undefined,
      delayRemark: undefined,
      cancelRemark: undefined,
      statusUpdateTime: new Date().toISOString(),
    };

    const updatedCustomers = customers.map(c => c.id === id ? updatedCustomer : c);
    saveCustomers(updatedCustomers);

    // 添加日志
    addStatusLog(
      id,
      customer.name,
      customer.flightNumber,
      'restore_normal',
      customer.guestStatus || 'normal',
      'normal'
    );

    return true;
  }, [customers, saveCustomers, addStatusLog]);

  // 登录（调用后端 API）
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        const user = data.data.user;
        const token = data.data.token;
        // 保存 token 和用户信息
        localStorage.setItem('auth_token', token);
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        setCurrentUser(user);
        setIsLoggedIn(true);
        return true;
      } else {
        throw new Error(data.message || '登录失败');
      }
    } catch (err) {
      console.error('登录失败:', err);
      throw err; // 让调用方处理错误显示
    }
  }, []);

  // 登出
  const logout = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch (e) {
        // 忽略错误
      }
    }
    localStorage.removeItem('auth_token');
    setCurrentUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }, []);

  // 添加客户
  const addCustomer = useCallback((customer: Omit<Customer, 'id' | 'createdAt' | 'status' | 'source'>) => {
    const newCustomer: Customer = {
      ...customer,
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      source: 'manual',
    };
    saveCustomers([...customers, newCustomer]);
    return newCustomer;
  }, [customers, saveCustomers]);

  // 批量添加客户（从导入）
  const importCustomers = useCallback((newCustomers: Omit<Customer, 'id' | 'createdAt' | 'status' | 'source'>[]) => {
    // 去重：姓名 + 手机号 相同视为重复，跳过已有数据中存在的记录
    const existingKeys = new Set(customers.map(c => `${c.name}__${c.phone}`));
    // 同时对本次导入文件内部也去重
    const seenKeys = new Set<string>();
    const dedupedNewCustomers = newCustomers.filter(c => {
      const key = `${c.name}__${c.phone}`;
      if (existingKeys.has(key) || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    const skippedCount = newCustomers.length - dedupedNewCustomers.length;
    const customersWithIds = dedupedNewCustomers.map(c => ({
      ...c,
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: 'pending' as const,
      source: 'import' as const,
    }));
    saveCustomers([...customers, ...customersWithIds]);
    return { added: customersWithIds, skippedCount };
  }, [customers, saveCustomers]);

  // 删除客户
  const deleteCustomer = useCallback((id: string) => {
    saveCustomers(customers.filter(c => c.id !== id));
  }, [customers, saveCustomers]);

  // 更新客户
  const updateCustomer = useCallback((id: string, updates: Partial<Customer>) => {
    saveCustomers(customers.map(c => c.id === id ? { ...c, ...updates } : c));
  }, [customers, saveCustomers]);

  // 添加车辆
  const addVehicle = useCallback((vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'status' | 'source'>) => {
    const newVehicle: Vehicle = {
      ...vehicle,
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: 'available',
      source: 'manual',
    };
    saveVehicles([...vehicles, newVehicle]);
    return newVehicle;
  }, [vehicles, saveVehicles]);

  // 批量添加车辆（从导入）
  const importVehicles = useCallback((newVehicles: Omit<Vehicle, 'id' | 'createdAt' | 'status' | 'source'>[]) => {
    // 去重：车牌号相同视为重复，跳过已有数据中存在的记录
    const existingPlates = new Set(vehicles.map(v => v.plateNumber));
    // 同时对本次导入文件内部也去重
    const seenPlates = new Set<string>();
    const dedupedNewVehicles = newVehicles.filter(v => {
      if (existingPlates.has(v.plateNumber) || seenPlates.has(v.plateNumber)) return false;
      seenPlates.add(v.plateNumber);
      return true;
    });
    const skippedCount = newVehicles.length - dedupedNewVehicles.length;
    const vehiclesWithIds = dedupedNewVehicles.map(v => ({
      ...v,
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: 'available' as const,
      source: 'import' as const,
    }));
    saveVehicles([...vehicles, ...vehiclesWithIds]);
    return { added: vehiclesWithIds, skippedCount };
  }, [vehicles, saveVehicles]);

  // 删除车辆
  const deleteVehicle = useCallback((id: string) => {
    saveVehicles(vehicles.filter(v => v.id !== id));
  }, [vehicles, saveVehicles]);

  // 将客户分组（每组客人独立用车，不再合并同一航班的客人）
  const groupCustomers = useCallback((customerList: Customer[]): CustomerGroup[] => {
    // 只处理需要用车的客户，且不是取消状态
    const customersNeedingVehicle = customerList.filter(c =>
      c.guestStatus !== 'cancelled' &&
      c.transportType !== '自驾' &&
      (c.needVehicle !== false)
    );

    // 每个客户单独成为一个组（独立用车）
    const groups: CustomerGroup[] = customersNeedingVehicle.map(customer => {
      // 确定排班用的到达时间（延误客人用实际到达时间）
      let effectiveArrivalTime = customer.arrivalTime;
      let effectiveArrivalDate = customer.arrivalDate;

      if (customer.guestStatus === 'delayed' && customer.actualArrivalTime) {
        // 延误客人使用实际到达时间
        // 兼容两种格式："2026-04-25 18:00" 和 "2026-04-25T18:00"
        const parts = customer.actualArrivalTime.split(/[T\s]/);
        effectiveArrivalDate = parts[0] || customer.arrivalDate;
        effectiveArrivalTime = parts[1] || customer.arrivalTime;
      }

      // 根据航班类型确定接机地点
      let pickupLocation = '';
      if (customer.transportType === '飞机') {
        pickupLocation = '贵阳龙洞堡机场';
      } else if (customer.transportType === '高铁') {
        pickupLocation = '贵阳北站';
      }

      // 每组客人独立用车
      return {
        id: generateId(),
        customers: [customer],
        transportType: customer.transportType,
        flightNumber: customer.flightNumber,
        arrivalDate: effectiveArrivalDate,
        arrivalTime: effectiveArrivalTime,
        pickupLocation,
        vehicleCount: customer.peopleCount > SCHEDULE_CONFIG.maxPassengersPerVehicle ? 2 : 1,
        scheduled: false,
      };
    });

    return groups;
  }, []);

  // 智能排班算法 - 支持趟次均衡和交通类型均衡
  const generateSchedule = useCallback(() => {
    const customerGroups = groupCustomers(customers);
    const availableVehicles = vehicles.filter(v => v.status === 'available');

    if (availableVehicles.length === 0) {
      return { success: false, message: '没有可用车辆' };
    }

    if (customerGroups.length === 0) {
      return { success: false, message: '没有需要排班的客户' };
    }

    const newTasks: ScheduleTask[] = [];
    
    // 统计每辆车的趟次和交通类型
    const vehicleStats: Map<string, { tripCount: number; flightCount: number; trainCount: number }> = new Map();
    availableVehicles.forEach(v => {
      vehicleStats.set(v.id, { tripCount: 0, flightCount: 0, trainCount: 0 });
    });

    // 按到达时间排序客户组
    const sortedGroups = [...customerGroups].sort((a, b) => {
      const dateCompare = a.arrivalDate.localeCompare(b.arrivalDate);
      if (dateCompare !== 0) return dateCompare;
      return a.arrivalTime.localeCompare(b.arrivalTime);
    });

    // ============================================================
    // 贪心分配 + 后处理重平衡算法 v3
    // 第一阶段：贪心分配（每组全部车槽一次性分配，优先选趟数最少的车）
    // 第二阶段：重平衡（从趟数最多的车挪任务到趟数最少的车）
    // ============================================================
    console.log('[排班v3] 贪心+重平衡，车辆数:', availableVehicles.length, '客户组数:', sortedGroups.length);

    // --- 辅助：时间窗检查 ---
    const isTimeWindowOk = (
      vehicleId: string,
      pickupTimeMinutes: number,
      tripDuration: number,
      currentTasks: ScheduleTask[]
    ): boolean => {
      const vehicleTasks = currentTasks.filter(t => t.vehicleId === vehicleId);
      if (vehicleTasks.length === 0) return true;
      const existing = vehicleTasks.map(t => {
        const parts = t.pickupTime.split(' ');
        const timePart = parts[parts.length - 1];
        const [h, m] = timePart.split(':').map(Number);
        return {
          minutes: h * 60 + m,
          duration: t.customers.some(c => c.transportType === '飞机')
            ? SCHEDULE_CONFIG.flightPickupDuration
            : SCHEDULE_CONFIG.trainPickupDuration,
        };
      });
      const earlier = existing.filter(t => t.minutes <= pickupTimeMinutes).sort((a, b) => b.minutes - a.minutes);
      if (earlier.length > 0 && pickupTimeMinutes - earlier[0].minutes < earlier[0].duration) return false;
      const later = existing.filter(t => t.minutes > pickupTimeMinutes).sort((a, b) => a.minutes - b.minutes);
      if (later.length > 0 && later[0].minutes - pickupTimeMinutes < tripDuration) return false;
      return true;
    };

    // --- 辅助：选择趟数最少+历史轮换+类型均衡的车 ---
    const pickBestVehicle = (feasible: typeof availableVehicles, isFlight: boolean) => {
      const minTrips = Math.min(...feasible.map(v => vehicleStats.get(v.id)!.tripCount));
      let candidates = feasible.filter(v => vehicleStats.get(v.id)!.tripCount === minTrips);
      if (candidates.length === 1) return candidates[0];
      // 历史轮换权重：趟次相同时，优先选历史累计趟次少的车
      const storedHist = localStorage.getItem(STORAGE_KEYS.VEHICLE_STATS);
      if (storedHist) {
        const histStats: Record<string, number> = JSON.parse(storedHist);
        const minHist = Math.min(...candidates.map(v => histStats[v.id] || 0));
        candidates = candidates.filter(v => (histStats[v.id] || 0) === minHist);
        if (candidates.length === 1) return candidates[0];
      }
      // 类型均衡：趟次和历史都相同时，选该交通类型任务最少的车
      let best = candidates[0], bestType = Infinity;
      for (const v of candidates) {
        const s = vehicleStats.get(v.id)!;
        const tc = isFlight ? s.flightCount : s.trainCount;
        if (tc < bestType) { bestType = tc; best = v; }
      }
      return best;
    };

    // --- 辅助：创建任务对象 ---
    const createTask = (
      vehicleId: string, group: CustomerGroup,
      pickupTimeMinutes: number, tripDuration: number,
      arrHour: number, arrMin: number,
      tripNumber: number,
    ): ScheduleTask => ({
      id: generateId(),
      vehicleId,
      customerGroupId: group.id,
      customers: group.customers,
      pickupLocation: group.pickupLocation,
      pickupTime: formatTimeFromMinutes(pickupTimeMinutes, group.arrivalDate),
      arrivalTime: `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`,
      returnTime: formatTimeFromMinutes(pickupTimeMinutes + tripDuration, group.arrivalDate),
      tripNumber,
      status: 'pending',
    });

    // ===== 第一阶段：贪心分配 =====
    for (const group of sortedGroups) {
      const departureLeadTime = group.transportType === '飞机'
        ? SCHEDULE_CONFIG.flightDepartureLeadTime
        : SCHEDULE_CONFIG.trainDepartureLeadTime;
      const tripDuration = group.transportType === '飞机'
        ? SCHEDULE_CONFIG.flightPickupDuration
        : SCHEDULE_CONFIG.trainPickupDuration;
      const [arrHour, arrMin] = group.arrivalTime.split(':').map(Number);
      const pickupTimeMinutes = arrHour * 60 + arrMin - departureLeadTime;
      const isFlight = group.transportType === '飞机';

      for (let i = 0; i < group.vehicleCount; i++) {
        const feasible: typeof availableVehicles = [];
        for (const v of availableVehicles) {
          const s = vehicleStats.get(v.id)!;
          if (s.tripCount >= SCHEDULE_CONFIG.maxTripsPerVehicle) continue;
          if (!isTimeWindowOk(v.id, pickupTimeMinutes, tripDuration, newTasks)) continue;
          feasible.push(v);
        }
        if (feasible.length === 0) break;
        const selected = pickBestVehicle(feasible, isFlight);
        const s = vehicleStats.get(selected.id)!;
        s.tripCount++;
        if (isFlight) s.flightCount++; else s.trainCount++;
        newTasks.push(createTask(selected.id, group, pickupTimeMinutes, tripDuration, arrHour, arrMin, s.tripCount));
      }
      group.scheduled = true;
    }

    // 更新 group.scheduled（只标记全部排完的）
    const groupTaskCount = new Map<string, number>();
    newTasks.forEach(t => groupTaskCount.set(t.customerGroupId, (groupTaskCount.get(t.customerGroupId) || 0) + 1));
    for (const group of sortedGroups) {
      group.scheduled = (groupTaskCount.get(group.id) || 0) >= group.vehicleCount;
    }

    const beforeRebalance = newTasks.length;
    const tripDistBefore: Record<number, number> = {};
    vehicleStats.forEach(s => { tripDistBefore[s.tripCount] = (tripDistBefore[s.tripCount] || 0) + 1; });
    console.log('[排班v3] 贪心阶段完成，总趟数:', beforeRebalance, '分布:', JSON.stringify(tripDistBefore));

    // ===== 第二阶段：重平衡 =====
    // 从趟数最多的车往趟数最少的车转移任务，最多尝试 5 轮
    const MAX_REBALANCE_ROUNDS = 5;
    for (let round = 0; round < MAX_REBALANCE_ROUNDS; round++) {
      const tripsPerVehicle = new Map<string, number>();
      vehicleStats.forEach((s, vid) => tripsPerVehicle.set(vid, s.tripCount));
      const maxTrips = Math.max(...tripsPerVehicle.values());
      const minTrips = Math.min(...tripsPerVehicle.values());
      if (maxTrips - minTrips <= 1) {
        console.log(`[排班v3] 重平衡第${round}轮：已均衡 (max=${maxTrips}, min=${minTrips})，停止`);
        break;
      }

      const overloaded = [...tripsPerVehicle.entries()]
        .filter(([_vid, c]) => c === maxTrips)
        .map(([vid]) => vid);
      const underloaded = [...tripsPerVehicle.entries()]
        .filter(([_vid, c]) => c <= minTrips)
        .map(([vid]) => vid);

      let movedThisRound = 0;

      for (const fromVid of overloaded) {
        if (movedThisRound >= underloaded.length) break;
        // 找到这辆车的最后一个任务（最后面的最容易转移）
        const fromTasks = newTasks
          .filter(t => t.vehicleId === fromVid)
          .sort((a, b) => newTasks.indexOf(a) - newTasks.indexOf(b));
        if (fromTasks.length === 0) continue;

        const lastTask = fromTasks[fromTasks.length - 1];

        // 解析任务时间
        const lastPickupParts = lastTask.pickupTime.split(' ');
        const lastTimeStr = lastPickupParts[lastPickupParts.length - 1];
        const [lh, lm] = lastTimeStr.split(':').map(Number);
        const lastPickupMin = lh * 60 + lm;
        const lastDuration = lastTask.customers.some(c => c.transportType === '飞机')
          ? SCHEDULE_CONFIG.flightPickupDuration
          : SCHEDULE_CONFIG.trainPickupDuration;

        // 尝试找一个趟数少且时间兼容的车
        let bestTarget: string | null = null;
        for (const toVid of underloaded) {
          const toStats = vehicleStats.get(toVid)!;
          if (toStats.tripCount >= SCHEDULE_CONFIG.maxTripsPerVehicle) continue;
          // 在目标车的时间线上检查（先假装移除 from 车的这个任务）
          const tasksWithoutThis = newTasks.filter(t => t.id !== lastTask.id);
          if (isTimeWindowOk(toVid, lastPickupMin, lastDuration, tasksWithoutThis)) {
            bestTarget = toVid;
            break;
          }
        }
        if (!bestTarget) continue;

        // 执行转移
        const toVid = bestTarget;
        const toStats = vehicleStats.get(toVid)!;
        const fromStats = vehicleStats.get(fromVid)!;
        const isFlightTask = lastTask.customers.some(c => c.transportType === '飞机');

        // 更新统计
        fromStats.tripCount--;
        if (isFlightTask) fromStats.flightCount--; else fromStats.trainCount--;
        toStats.tripCount++;
        if (isFlightTask) toStats.flightCount++; else toStats.trainCount++;

        // 更新任务
        lastTask.vehicleId = toVid;
        lastTask.tripNumber = toStats.tripCount;

        // 重新编号 from 车剩余任务
        const fromRemaining = newTasks
          .filter(t => t.vehicleId === fromVid)
          .sort((a, b) => {
            const pa = a.pickupTime.split(' ').pop()!;
            const pb = b.pickupTime.split(' ').pop()!;
            return pa.localeCompare(pb);
          });
        fromRemaining.forEach((t, idx) => { t.tripNumber = idx + 1; });

        movedThisRound++;
        console.log(`[排班v3] 重平衡: ${fromVid}(${fromStats.tripCount}趟) → ${toVid}(${toStats.tripCount}趟)`);
      }

      if (movedThisRound === 0) {
        console.log(`[排班v3] 重平衡第${round}轮：无任务可转移，停止`);
        break;
      }
    }

    const tripDistAfter: Record<number, number> = {};
    vehicleStats.forEach(s => { tripDistAfter[s.tripCount] = (tripDistAfter[s.tripCount] || 0) + 1; });
    console.log('[排班v3] 最终分布:', JSON.stringify(tripDistAfter), '总趟数:', newTasks.length);

    // 清除旧排班任务，重新生成（重新排班 = 完全重算）
    saveScheduleTasks([]);

    // 更新所有参与排班的客户状态为已排班
    const scheduledCustomerIds = new Set(newTasks.flatMap(t => t.customers.map(c => c.id)));
    const updatedCustomers = customers.map(c => {
      if (scheduledCustomerIds.has(c.id)) {
        return { ...c, status: 'scheduled' as const };
      }
      // 未参与排班的客户重置为待排班
      if (c.status === 'scheduled') {
        return { ...c, status: 'pending' as const };
      }
      return c;
    });

    saveCustomers(updatedCustomers);
    saveScheduleTasks(newTasks);

    // 累加本轮趟次到历史统计（跨排班公平轮换）
    const histStats: Record<string, number> = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.VEHICLE_STATS) || '{}'
    );
    vehicleStats.forEach((stats, vid) => {
      histStats[vid] = (histStats[vid] || 0) + stats.tripCount;
    });
    localStorage.setItem(STORAGE_KEYS.VEHICLE_STATS, JSON.stringify(histStats));

    // 统计延误和取消客户
    const delayedInSchedule = newTasks.filter(t =>
      t.customers.some(c => c.guestStatus === 'delayed')
    ).length;
    const cancelledExcluded = customers.filter(c => c.guestStatus === 'cancelled' && c.transportType !== '自驾' && c.needVehicle !== false).length;

    let message = `排班完成：${newTasks.length} 个任务`;
    if (delayedInSchedule > 0) {
      message += `，其中 ${delayedInSchedule} 个任务含延误客户`;
    }
    if (cancelledExcluded > 0) {
      message += `，${cancelledExcluded} 位取消客户已排除`;
    }

    return {
      success: true,
      message,
      tasks: newTasks,
    };
  }, [customers, vehicles, scheduleTasks, groupCustomers, saveCustomers, saveScheduleTasks]);

  // 清除排班
  const clearSchedule = useCallback(() => {
    // 重置客户状态
    const resetCustomers = customers.map(c => ({
      ...c,
      status: 'pending' as const,
    }));
    saveCustomers(resetCustomers);
    saveScheduleTasks([]);
  }, [customers, saveCustomers, saveScheduleTasks]);

  // 更新任务状态（任务执行登记：派出 / 接回完成 / 撤销）
  const updateTaskStatus = useCallback((
    taskId: string,
    newStatus: ScheduleTask['status'],
    remark?: string
  ) => {
    const task = scheduleTasks.find(t => t.id === taskId);
    if (!task) return false;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const updatedTasks = scheduleTasks.map(t => {
      if (t.id !== taskId) return t;

      const updated: ScheduleTask = { ...t, status: newStatus };

      if (newStatus === 'in_progress') {
        // 如果是从 pending → in_progress（首次派出），记录派出时间
        if (task.status !== 'completed') {
          updated.dispatchTime = timeStr;
        }
        // 撤销完成（completed → in_progress）：清除完成时间，但保留派出时间
        updated.completeTime = undefined;
      } else if (newStatus === 'completed') {
        updated.completeTime = timeStr;
      } else if (newStatus === 'pending') {
        // 完全退回：清除所有时间记录
        updated.dispatchTime = undefined;
        updated.completeTime = undefined;
      }

      if (remark) {
        updated.dispatchRemark = remark;
      }
      return updated;
    });

    saveScheduleTasks(updatedTasks);
    return true;
  }, [scheduleTasks, saveScheduleTasks]);

  // 清除全部客户
  const clearAllCustomers = useCallback(() => {
    saveCustomers([]);
  }, [saveCustomers]);

  // 清除全部车辆
  const clearAllVehicles = useCallback(() => {
    saveVehicles([]);
  }, [saveVehicles]);

  // 保存排班配置
  const saveScheduleConfig = useCallback((config: ScheduleConfig) => {
    setScheduleConfig(config);
    updateScheduleConfig(config);
    localStorage.setItem(STORAGE_KEYS.SCHEDULE_CONFIG, JSON.stringify(config));
  }, []);

  // 重置排班配置为默认值
  const resetScheduleConfig = useCallback(() => {
    saveScheduleConfig(DEFAULT_SCHEDULE_CONFIG);
  }, [saveScheduleConfig]);

  // 统计数据
  const getStats = useCallback(() => {
    // 按客人状态统计
    const normalCount = customers.filter(c => c.guestStatus === 'normal' || !c.guestStatus).length;
    const delayedCount = customers.filter(c => c.guestStatus === 'delayed').length;
    const cancelledCount = customers.filter(c => c.guestStatus === 'cancelled').length;

    // 参会人数（按组计算，排除取消客人）
    const activeCustomers = customers.filter(c => c.guestStatus !== 'cancelled');
    const groupCount = activeCustomers.length;
    const totalPeople = activeCustomers.reduce((sum, c) => sum + c.peopleCount, 0);

    // 预计用车数量（按智能排班算法实际使用的车辆数）
    // 使用排班任务中实际分配的不同车辆数
    const estimatedVehicles = new Set(scheduleTasks.map(t => t.vehicleId)).size;

    // 录入车辆数
    const registeredVehicles = vehicles.length;

    // 已安排客户组数和人数（从排班任务中获取）
    const customerGroups = groupCustomers(customers);
    const scheduledCustomerIds = new Set(scheduleTasks.flatMap(t => t.customers.map(c => c.id)));
    const scheduledCustomerGroups = customerGroups.filter((g: CustomerGroup) =>
      g.customers.some((c: Customer) => scheduledCustomerIds.has(c.id))
    ).length;
    const scheduledPeople = scheduleTasks.reduce((sum, task) =>
      sum + task.customers.reduce((s, c) => s + c.peopleCount, 0), 0
    );

    // 待安排客户组数和人数（需要用车但未排班的）
    const pendingCustomerGroups = customerGroups.filter((g: CustomerGroup) =>
      !g.customers.some((c: Customer) => scheduledCustomerIds.has(c.id))
    ).length;
    const pendingPeople = customers
      .filter((c: Customer) =>
        c.guestStatus !== 'cancelled' &&
        c.transportType !== '自驾' &&
        c.needVehicle !== false &&
        !scheduledCustomerIds.has(c.id)
      )
      .reduce((sum, c) => sum + c.peopleCount, 0);

    // 自驾客户人数
    const selfDriveCount = customers
      .filter(c => c.transportType === '自驾' && c.guestStatus !== 'cancelled')
      .reduce((sum, c) => sum + c.peopleCount, 0);

    return {
      groupCount,
      totalPeople,
      estimatedVehicles,
      registeredVehicles,
      scheduledTasks: scheduleTasks.length,
      scheduledCustomerGroups,
      scheduledPeople,
      pendingCustomerGroups,
      pendingPeople,
      normalCount,
      delayedCount,
      cancelledCount,
      selfDriveCount,
    };
  }, [customers, vehicles, scheduleTasks, groupCustomers]);

  return {
    isLoggedIn,
    currentUser,
    customers,
    vehicles,
    scheduleTasks,
    statusLogs,
    scheduleConfig,
    isLoading,
    login,
    logout,
    addCustomer,
    importCustomers,
    deleteCustomer,
    clearAllCustomers,
    updateCustomer,
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
    addStatusLog,
    updateTaskStatus,
    saveScheduleConfig,
    resetScheduleConfig,
  };
}

// 辅助函数：从分钟数格式化为时间
function formatTimeFromMinutes(minutes: number, date: string): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${date} ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
