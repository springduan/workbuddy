import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2, Search, User, Plane, Train, Car as CarIcon, RefreshCw, Plus, Save, RotateCcw } from 'lucide-react';
import type { Customer, CustomerType, TransportType } from '@/types';
import { toast } from 'sonner';

interface CustomerListProps {
  customers: Customer[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onMarkDelayed: (id: string, actualArrivalTime: string, remark?: string) => void;
  onMarkCancelled: (id: string, remark?: string) => void;
  onRestoreNormal: (id: string) => void;
  onReschedule: () => { success: boolean; message: string };
  onAdd: (customer: Omit<Customer, 'id' | 'createdAt' | 'status' | 'source'>) => Customer;
}

export function CustomerList({
  customers,
  onDelete,
  onClearAll,
  onMarkDelayed,
  onMarkCancelled,
  onRestoreNormal,
  onReschedule,
  onAdd,
}: CustomerListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [guestStatusFilter, setGuestStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // 延误弹窗
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [customerToDelay, setCustomerToDelay] = useState<Customer | null>(null);
  const [delayActualTime, setDelayActualTime] = useState('');
  const [delayRemark, setDelayRemark] = useState('');

  // 取消弹窗
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [customerToCancel, setCustomerToCancel] = useState<Customer | null>(null);
  const [cancelRemark, setCancelRemark] = useState('');

  // 确认弹窗
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState<React.ReactNode>('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  // 新增客户弹窗
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    phone: '',
    type: '个人' as CustomerType,
    peopleCount: 1,
    transportType: '飞机' as TransportType,
    flightNumber: '',
    arrivalDate: '',
    arrivalTime: '',
    salesman: '',
    salesmanPhone: '',
    company: '',
    hotel: '',
    needVehicle: true,
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // 重置新增表单
  const resetAddForm = () => {
    setAddForm({
      name: '',
      phone: '',
      type: '个人',
      peopleCount: 1,
      transportType: '飞机',
      flightNumber: '',
      arrivalDate: '',
      arrivalTime: '',
      salesman: '',
      salesmanPhone: '',
      company: '',
      hotel: '',
      needVehicle: true,
    });
    setAddErrors({});
  };

  // 打开新增弹窗
  const openAddDialog = () => {
    resetAddForm();
    setAddDialogOpen(true);
  };

  // 验证新增表单
  const validateAddForm = () => {
    const errors: Record<string, string> = {};
    if (!addForm.name.trim()) errors.name = '请输入姓名';
    if (!addForm.phone.trim()) {
      errors.phone = '请输入电话号码';
    } else if (!/^1[3-9]\d{9}$/.test(addForm.phone)) {
      errors.phone = '请输入正确的手机号';
    }
    if (!addForm.arrivalDate) errors.arrivalDate = '请选择落地日期';
    if (!addForm.arrivalTime) errors.arrivalTime = '请选择落地时间';
    setAddErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 提交新增表单
  const submitAddForm = async () => {
    if (!validateAddForm()) return;

    setAddSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      onAdd({
        ...addForm,
        flightNumber: addForm.transportType === '自驾' ? '自驾' : addForm.flightNumber,
      });
      toast.success('客户信息录入成功');
      setAddDialogOpen(false);
      resetAddForm();
    } catch (error) {
      toast.error('录入失败，请重试');
    }

    setAddSubmitting(false);
  };

  // 统计客人状态
  const guestStatusCounts = {
    all: customers.length,
    normal: customers.filter(c => c.guestStatus === 'normal' || !c.guestStatus).length,
    delayed: customers.filter(c => c.guestStatus === 'delayed').length,
    cancelled: customers.filter(c => c.guestStatus === 'cancelled').length,
  };

  const hasPendingChanges = guestStatusCounts.delayed > 0 || guestStatusCounts.cancelled > 0;

  // 过滤客户
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.salesman.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.flightNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || customer.type === filterType;
    const matchesGuestStatus = guestStatusFilter === 'all' || customer.guestStatus === guestStatusFilter;

    return matchesSearch && matchesType && matchesGuestStatus;
  });

  // 排序（按落地日期和时间）
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const dateA = String(a.arrivalDate || '');
    const dateB = String(b.arrivalDate || '');
    const dateCompare = dateA.localeCompare(dateB);
    if (dateCompare !== 0) return dateCompare;
    const timeA = String(a.arrivalTime || '');
    const timeB = String(b.arrivalTime || '');
    return timeA.localeCompare(timeB);
  });

  // 获取交通工具图标
  const getTransportIcon = (type: string) => {
    switch (type) {
      case '飞机':
        return <Plane className="w-4 h-4" />;
      case '高铁':
        return <Train className="w-4 h-4" />;
      case '自驾':
        return <CarIcon className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  // 获取客人状态标签
  const getGuestStatusBadge = (customer: Customer) => {
    const status = customer.guestStatus || 'normal';
    const labels: Record<string, string> = {
      normal: '正常',
      delayed: '⚠️ 延误',
      cancelled: '❌ 取消',
    };

    let badgeClass = '';
    if (status === 'delayed') {
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    } else if (status === 'cancelled') {
      badgeClass = 'bg-red-100 text-red-800 border-red-300';
    } else {
      badgeClass = 'bg-gray-100 text-gray-800';
    }

    return (
      <Badge className={badgeClass}>
        {labels[status]}
      </Badge>
    );
  };

  // 获取行样式
  const getRowClass = (customer: Customer) => {
    const status = customer.guestStatus || 'normal';
    if (status === 'delayed') return 'bg-amber-50 border-l-4 border-l-amber-400';
    if (status === 'cancelled') return 'bg-gray-50 opacity-60';
    return '';
  };

  // 打开延误弹窗
  const openDelayDialog = (customer: Customer) => {
    setCustomerToDelay(customer);
    setDelayActualTime('');
    setDelayRemark('');
    setDelayDialogOpen(true);
  };

  // 提交延误
  const submitDelay = () => {
    if (!customerToDelay || !delayActualTime) return;

    // 验证时间必须晚于原到达时间
    const originalTime = `${customerToDelay.arrivalDate} ${customerToDelay.arrivalTime}`;
    if (new Date(delayActualTime) <= new Date(originalTime)) {
      alert('实际到达时间必须晚于原计划到达时间');
      return;
    }

    setDelayDialogOpen(false);
    setConfirmTitle('确认标记延误');
    setConfirmMessage(
      <>
        确认将 <strong className="text-red-600">{customerToDelay.name}</strong> 标记为延误？
        <br />实际到达时间将设为 <strong className="text-red-600">{formatDateTime(delayActualTime)}</strong>
        <br /><span className="text-gray-500 text-sm">📌 标记后需手动点击「重新排班」生效</span>
      </>
    );
    setConfirmAction(() => () => {
      onMarkDelayed(customerToDelay.id, delayActualTime, delayRemark || undefined);
      setConfirmDialogOpen(false);
    });
    setConfirmDialogOpen(true);
  };

  // 打开取消弹窗
  const openCancelDialog = (customer: Customer) => {
    setCustomerToCancel(customer);
    setCancelRemark('');
    setCancelDialogOpen(true);
  };

  // 提交取消
  const submitCancel = () => {
    if (!customerToCancel) return;

    setCancelDialogOpen(false);
    setConfirmTitle('确认取消客户');
    setConfirmMessage(
      <>
        确认将 <strong className="text-red-600">{customerToCancel.name}</strong> 标记为取消？
        <br /><span className="text-gray-500 text-sm">📌 取消后该客户将不再参与排班，需手动点击「重新排班」生效</span>
      </>
    );
    setConfirmAction(() => () => {
      onMarkCancelled(customerToCancel.id, cancelRemark || undefined);
      setConfirmDialogOpen(false);
    });
    setConfirmDialogOpen(true);
  };

  // 恢复正常
  const handleRestore = (customer: Customer) => {
    const action = customer.guestStatus === 'delayed' ? '恢复延误客户' : '恢复取消客户';
    setConfirmTitle(action);
    setConfirmMessage(
      <>
        确认将 <strong>{customer.name}</strong> 恢复为正常状态？
        <br /><span className="text-gray-500 text-sm">📌 恢复后需手动点击「重新排班」生效</span>
      </>
    );
    setConfirmAction(() => () => {
      onRestoreNormal(customer.id);
      setConfirmDialogOpen(false);
    });
    setConfirmDialogOpen(true);
  };

  // 删除客户
  const handleDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  // 清除全部客户
  const handleClearAll = () => {
    setConfirmTitle('确认清除全部客户');
    setConfirmMessage(
      <>
        确定要清除所有 <strong className="text-red-600">{customers.length}</strong> 位客户信息吗？
        <br /><span className="text-gray-500 text-sm">⚠️ 此操作不可撤销，客户数据将全部删除</span>
      </>
    );
    setConfirmAction(() => () => {
      onClearAll();
      setConfirmDialogOpen(false);
    });
    setConfirmDialogOpen(true);
  };

  const confirmDelete = () => {
    if (customerToDelete) {
      onDelete(customerToDelete.id);
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  // 格式化时间
  const formatDateTime = (isoString: string) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // 计算原到达时间（datetime-local格式的最小值）
  const getMinTime = (customer: Customer) => {
    const [year, month, day] = customer.arrivalDate.split('-');
    return `${year}-${month}-${day}T${customer.arrivalTime}`;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客户管理</h1>
          <p className="text-gray-500 mt-1">
            共 {customers.length} 条客户记录，已筛选 {sortedCustomers.length} 条
          </p>
        </div>
        <Button
          onClick={openAddDialog}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          新增客户
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{guestStatusCounts.normal}</div>
            <div className="text-sm text-green-700">正常客户</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{guestStatusCounts.delayed}</div>
            <div className="text-sm text-amber-700">延误客户</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{guestStatusCounts.cancelled}</div>
            <div className="text-sm text-red-700">取消客户</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{guestStatusCounts.all}</div>
            <div className="text-sm text-blue-700">总记录数</div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索姓名、电话、业务员、航班号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* 筛选标签 */}
            <div className="flex flex-wrap gap-1 border rounded-lg p-1 bg-gray-50">
              {[
                { key: 'all', label: '全部', count: guestStatusCounts.all },
                { key: 'normal', label: '正常', count: guestStatusCounts.normal },
                { key: 'delayed', label: '⚠️延误', count: guestStatusCounts.delayed, pending: guestStatusCounts.delayed > 0 },
                { key: 'cancelled', label: '❌取消', count: guestStatusCounts.cancelled, pending: guestStatusCounts.cancelled > 0 },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setGuestStatusFilter(tab.key)}
                  className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    guestStatusFilter === tab.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:bg-white'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1 font-bold">{tab.count}</span>
                  {tab.pending && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              ))}
            </div>

            {/* 类型筛选 */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="个人">个人</SelectItem>
                <SelectItem value="家庭">家庭</SelectItem>
              </SelectContent>
            </Select>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              {customers.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleClearAll}
                  className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                  清除客户
                </Button>
              )}
              <Button
                onClick={() => {
                  const result = onReschedule();
                  if (result.success) {
                    toast.success(result.message);
                  } else {
                    toast.error(result.message);
                  }
                }}
                className={`gap-2 ${hasPendingChanges ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <RefreshCw className="w-4 h-4" />
                重新排班
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 客户列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>人数</TableHead>
                  <TableHead>交通</TableHead>
                  <TableHead>航班/车次</TableHead>
                  <TableHead>原到达时间</TableHead>
                  <TableHead>实际到达时间</TableHead>
                  <TableHead>业务员</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                      {customers.length === 0 ? '暂无客户数据，请先导入或录入客户' : '没有匹配的客户记录'}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCustomers.map((customer, index) => (
                    <TableRow key={customer.id} className={getRowClass(customer)}>
                      <TableCell className="text-gray-400">{index + 1}</TableCell>
                      <TableCell className={`font-medium ${customer.guestStatus === 'cancelled' ? 'line-through text-gray-400' : ''}`}>
                        <div className="flex items-center gap-2">
                          {customer.name}
                          {customer.source === 'manual' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                              新增
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{customer.type}</Badge>
                      </TableCell>
                      <TableCell>{customer.peopleCount}人</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getTransportIcon(customer.transportType)}
                          <span className="text-xs">{customer.transportType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {customer.flightNumber || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{customer.arrivalDate}</div>
                          <div className="text-gray-500">{customer.arrivalTime}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.actualArrivalTime ? (
                          <span className="text-sm text-amber-600 font-semibold">
                            {formatDateTime(customer.actualArrivalTime)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.salesman ? (
                          <div className="text-xs">
                            <div className="font-medium">{customer.salesman}</div>
                            {customer.salesmanPhone && (
                              <div className="text-gray-400">{customer.salesmanPhone}</div>
                            )}
                            {customer.company && (
                              <div className="text-gray-400 truncate max-w-[80px]" title={customer.company}>
                                {customer.company}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getGuestStatusBadge(customer)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {customer.guestStatus !== 'cancelled' && customer.guestStatus !== 'delayed' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDelayDialog(customer)}
                                className="text-amber-600 border-amber-300 hover:bg-amber-50"
                              >
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                延误
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCancelDialog(customer)}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                取消
                              </Button>
                            </>
                          )}
                          {(customer.guestStatus === 'delayed' || customer.guestStatus === 'cancelled') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(customer)}
                              className="text-green-600 border-green-300 hover:bg-green-50"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              恢复
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(customer)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 延误登记弹窗 */}
      <Dialog open={delayDialogOpen} onOpenChange={setDelayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              登记延误信息
            </DialogTitle>
            <DialogDescription>
              请填写客户的实际到达时间
            </DialogDescription>
          </DialogHeader>

          {customerToDelay && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg text-sm">
                <div>
                  <span className="text-gray-500">客户姓名：</span>
                  <span className="font-medium">{customerToDelay.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">航班/车次：</span>
                  <span className="font-medium">{customerToDelay.flightNumber}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">原到达时间：</span>
                  <span className="font-medium">{customerToDelay.arrivalDate} {customerToDelay.arrivalTime}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actualTime">
                  实际到达时间 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="actualTime"
                  type="datetime-local"
                  value={delayActualTime}
                  onChange={(e) => setDelayActualTime(e.target.value)}
                  min={getMinTime(customerToDelay)}
                />
                <p className="text-xs text-amber-600">
                  ⚠️ 必须晚于原计划到达时间。如需修改，可先恢复为正常状态后重新登记
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delayRemark">备注（选填）</Label>
                <Input
                  id="delayRemark"
                  placeholder="如：航空公司通知延误4小时"
                  value={delayRemark}
                  onChange={(e) => setDelayRemark(e.target.value)}
                />
              </div>

              <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
                📌 确认后该客户将标记为延误状态，排班时间将更新为实际到达时间，需手动点击「重新排班」后生效
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDelayDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={submitDelay}
              disabled={!delayActualTime}
              className="bg-amber-500 hover:bg-amber-600"
            >
              ✅ 确认登记
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 取消确认弹窗 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-red-500">❌</span>
              取消客户
            </DialogTitle>
            <DialogDescription>
              确认要取消该客户吗？
            </DialogDescription>
          </DialogHeader>

          {customerToCancel && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg text-sm">
                <div>
                  <span className="text-gray-500">客户姓名：</span>
                  <span className="font-medium">{customerToCancel.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">航班/车次：</span>
                  <span className="font-medium">{customerToCancel.flightNumber}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">原到达时间：</span>
                  <span className="font-medium">{customerToCancel.arrivalDate} {customerToCancel.arrivalTime}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancelReason">取消原因（选填）</Label>
                <Input
                  id="cancelReason"
                  placeholder="如：客人因事临时取消行程"
                  value={cancelRemark}
                  onChange={(e) => setCancelRemark(e.target.value)}
                />
              </div>

              <p className="text-sm text-gray-500 bg-amber-50 p-3 rounded-lg">
                ⚠️ 取消后该客户将不再参与排班，客户信息会保留备查，需手动点击「重新排班」后生效
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              返回
            </Button>
            <Button
              onClick={submitCancel}
              className="bg-red-500 hover:bg-red-600"
            >
              ❌ 确认取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 二次确认弹窗 */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="text-gray-700">{confirmMessage}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => confirmAction?.()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除客户 "{customerToDelete?.name}" 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增客户弹窗 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              临时录入客户
            </DialogTitle>
            <DialogDescription>
              填写客户详细信息，带 * 的为必填项
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 基本信息 */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User className="w-4 h-4" />
                基本信息
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="add-name">
                    姓名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="add-name"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="请输入客户姓名"
                  />
                  {addErrors.name && <p className="text-xs text-red-500">{addErrors.name}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-phone">
                    电话 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="add-phone"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="13800138000"
                  />
                  {addErrors.phone && <p className="text-xs text-red-500">{addErrors.phone}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-type">类型</Label>
                  <Select value={addForm.type} onValueChange={(v) => setAddForm({ ...addForm, type: v as CustomerType })}>
                    <SelectTrigger id="add-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="个人">个人</SelectItem>
                      <SelectItem value="家庭">家庭</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-peopleCount">人数</Label>
                  <Input
                    id="add-peopleCount"
                    type="number"
                    min={1}
                    value={addForm.peopleCount}
                    onChange={(e) => setAddForm({ ...addForm, peopleCount: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
            </div>

            {/* 交通信息 */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {addForm.transportType === '飞机' ? <Plane className="w-4 h-4" /> : addForm.transportType === '高铁' ? <Train className="w-4 h-4" /> : <CarIcon className="w-4 h-4" />}
                交通信息
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="add-transportType">入黔方式</Label>
                  <Select value={addForm.transportType} onValueChange={(v) => setAddForm({ ...addForm, transportType: v as TransportType })}>
                    <SelectTrigger id="add-transportType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="飞机">
                        <div className="flex items-center gap-2"><Plane className="w-4 h-4" />飞机</div>
                      </SelectItem>
                      <SelectItem value="高铁">
                        <div className="flex items-center gap-2"><Train className="w-4 h-4" />高铁</div>
                      </SelectItem>
                      <SelectItem value="自驾">
                        <div className="flex items-center gap-2"><CarIcon className="w-4 h-4" />自驾</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-flightNumber">
                    {addForm.transportType === '飞机' ? '航班号' : addForm.transportType === '高铁' ? '高铁班次' : '备注'}
                  </Label>
                  <Input
                    id="add-flightNumber"
                    value={addForm.flightNumber}
                    onChange={(e) => setAddForm({ ...addForm, flightNumber: e.target.value })}
                    placeholder={addForm.transportType === '飞机' ? 'CA1234' : addForm.transportType === '高铁' ? 'G1234' : '自驾'}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-arrivalDate">
                    落地日期 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="add-arrivalDate"
                    type="date"
                    value={addForm.arrivalDate}
                    onChange={(e) => setAddForm({ ...addForm, arrivalDate: e.target.value })}
                  />
                  {addErrors.arrivalDate && <p className="text-xs text-red-500">{addErrors.arrivalDate}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-arrivalTime">
                    落地时间 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="add-arrivalTime"
                    type="time"
                    value={addForm.arrivalTime}
                    onChange={(e) => setAddForm({ ...addForm, arrivalTime: e.target.value })}
                  />
                  {addErrors.arrivalTime && <p className="text-xs text-red-500">{addErrors.arrivalTime}</p>}
                </div>
              </div>
            </div>

            {/* 酒店 */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">酒店信息</h3>
              <div className="space-y-1">
                <Label htmlFor="add-hotel">入住酒店</Label>
                <Input
                  id="add-hotel"
                  value={addForm.hotel}
                  onChange={(e) => setAddForm({ ...addForm, hotel: e.target.value })}
                  placeholder="请输入入住酒店名称"
                />
              </div>
            </div>

            {/* 业务员信息 */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">业务员信息</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="add-salesman">业务员姓名</Label>
                  <Input
                    id="add-salesman"
                    value={addForm.salesman}
                    onChange={(e) => setAddForm({ ...addForm, salesman: e.target.value })}
                    placeholder="请输入业务员姓名"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-salesmanPhone">业务员电话</Label>
                  <Input
                    id="add-salesmanPhone"
                    value={addForm.salesmanPhone}
                    onChange={(e) => setAddForm({ ...addForm, salesmanPhone: e.target.value })}
                    placeholder="请输入业务员电话"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-company">所属公司</Label>
                  <Input
                    id="add-company"
                    value={addForm.company}
                    onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                    placeholder="请输入所属公司"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="outline"
              onClick={resetAddForm}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </Button>
            <Button
              onClick={submitAddForm}
              disabled={addSubmitting}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              {addSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}