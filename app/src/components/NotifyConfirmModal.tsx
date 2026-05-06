import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plane, Train, Users, Car, Phone, User, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { ScheduleTask, Vehicle } from '@/types';

interface NotifyConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ScheduleTask | null;
  vehicle: Vehicle | null;
}

interface PushResult {
  role: string;
  name: string;
  phone: string;
  status: 'success' | 'failed' | 'pending';
  error?: string;
}

export function NotifyConfirmModal({
  open,
  onOpenChange,
  task,
  vehicle,
}: NotifyConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PushResult[] | null>(null);

  if (!task || !vehicle) return null;

  const isFlight = task.customers[0]?.transportType === '飞机';

  // 收集推送目标
  const pushTargets: { role: string; name: string; phone: string }[] = [];

  // 司机信息
  if (vehicle.driverPhone) {
    pushTargets.push({
      role: '司机',
      name: vehicle.driver,
      phone: vehicle.driverPhone,
    });
  }

  // 业务员信息（从客户中获取）
  const salesmanSet = new Set<string>();
  task.customers.forEach(c => {
    if (c.salesmanPhone && !salesmanSet.has(c.salesmanPhone)) {
      salesmanSet.add(c.salesmanPhone);
      pushTargets.push({
        role: '业务员',
        name: c.salesman || '未知',
        phone: c.salesmanPhone,
      });
    }
  });

  const handleConfirm = async () => {
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('http://192.168.2.38:3000/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: [{
            taskId: task.id,
            date: task.pickupTime.split(' ')[0],
            departureTime: task.pickupTime.split(' ')[1],
            customerName: task.customers.map(c => c.name).join('、'),
            customerPhone: task.customers.map(c => c.phone).filter(Boolean).join('、'),
            flightInfo: task.customers[0]?.flightNumber || '',
            destination: task.pickupLocation,
            vehiclePlate: vehicle.plateNumber,
            driverPhone: vehicle.driverPhone || '',
            salespersonPhone: task.customers[0]?.salesmanPhone || '',
          }],
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 处理推送结果
        const pushResults: PushResult[] = [];

        for (const taskResult of data.data) {
          for (const pushed of taskResult.pushed) {
            pushResults.push({
              role: pushed.role === 'driver' ? '司机' : '业务员',
              name: pushed.name,
              phone: pushed.phone,
              status: 'success',
            });
          }
          for (const failed of taskResult.failed) {
            pushResults.push({
              role: failed.role === 'driver' ? '司机' : '业务员',
              name: '未知',
              phone: failed.phone,
              status: 'failed',
              error: failed.error,
            });
          }
        }

        setResults(pushResults);
      } else {
        setResults([{
          role: '系统',
          name: '错误',
          phone: '',
          status: 'failed',
          error: data.message || '发送失败',
        }]);
      }
    } catch (err: any) {
      setResults([{
        role: '系统',
        name: '错误',
        phone: '',
        status: 'failed',
        error: err.message || '网络请求失败，请检查后端服务是否运行',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResults(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>发送行程通知</span>
            {!results && (
              <Badge variant="outline" className="text-xs">待确认</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            确认发送微信订阅消息给相关人员
          </DialogDescription>
        </DialogHeader>

        {/* 任务详情 */}
        <div className="space-y-3 py-2">
          {/* 交通类型和航班 */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            {isFlight ? (
              <Plane className="w-5 h-5 text-blue-600" />
            ) : (
              <Train className="w-5 h-5 text-green-600" />
            )}
            <div>
              <div className="font-semibold">
                {isFlight ? '飞机接机' : '高铁接站'} · {task.customers[0]?.flightNumber || '-'}
              </div>
              <div className="text-sm text-gray-500">
                {task.pickupTime.split(' ')[1]} · {task.pickupLocation}
              </div>
            </div>
          </div>

          {/* 车辆信息 */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Car className="w-5 h-5 text-gray-600" />
            <div>
              <div className="font-semibold">{vehicle.plateNumber}</div>
              <div className="text-sm text-gray-500">{vehicle.driver}</div>
            </div>
          </div>

          {/* 客户列表 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
              <Users className="w-4 h-4" />
              <span>客户列表</span>
            </div>
            <div className="space-y-1">
              {task.customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name} ({c.peopleCount}人)</span>
                  {c.salesman && (
                    <span className="text-gray-400 text-xs">{c.salesman}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 推送目标 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
              <User className="w-4 h-4" />
              <span>通知对象</span>
            </div>
            <div className="space-y-1">
              {pushTargets.map((target, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {target.role}
                    </Badge>
                    <span>{target.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Phone className="w-3 h-3" />
                    <span>{target.phone}</span>
                  </div>
                </div>
              ))}
              {pushTargets.length === 0 && (
                <div className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>未找到推送目标（司机和业务员电话）</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 推送结果 */}
        {results && (
          <div className="space-y-2 py-2">
            <div className="text-sm font-medium text-gray-700">推送结果</div>
            <div className="space-y-2">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    result.status === 'success' ? 'bg-green-50' :
                    result.status === 'failed' ? 'bg-red-50' : 'bg-gray-50'
                  }`}
                >
                  {result.status === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {result.role}
                      </Badge>
                      <span className="font-medium">{result.name}</span>
                    </div>
                    {result.error && (
                      <div className="text-xs text-red-600 mt-1">{result.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={handleClose}>关闭</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                取消
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading || pushTargets.length === 0}
              >
                {loading ? '发送中...' : '确认发送'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
