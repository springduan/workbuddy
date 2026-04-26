import { useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { Car, Plus, Trash2, Search, Phone, User } from 'lucide-react';
import type { Vehicle } from '@/types';
import { toast } from 'sonner';

interface VehicleListProps {
  vehicles: Vehicle[];
  onAdd: (vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'status' | 'source'>) => Vehicle;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

interface AddVehicleForm {
  plateNumber: string;
  driver: string;
  driverPhone: string;
  vehicleType: string;
  maxTrips: number;
}

export function VehicleList({ vehicles, onAdd, onDelete, onClearAll }: VehicleListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddVehicleForm>({
    defaultValues: {
      plateNumber: '',
      driver: '',
      driverPhone: '',
      vehicleType: '',
      maxTrips: 4,
    },
  });

  // 过滤车辆
  const filteredVehicles = vehicles.filter((vehicle) => {
    return (
      vehicle.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.driverPhone.includes(searchTerm)
    );
  });

  // 添加车辆
  const onSubmitAdd = (data: AddVehicleForm) => {
    onAdd(data);
    toast.success('车辆信息添加成功');
    reset();
    setAddDialogOpen(false);
  };

  // 删除确认
  const handleDelete = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (vehicleToDelete) {
      onDelete(vehicleToDelete.id);
      toast.success('车辆信息已删除');
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
    }
  };

  // 清除全部车辆
  const handleClearAll = () => {
    setClearDialogOpen(true);
  };

  const confirmClearAll = () => {
    onClearAll();
    toast.success('已清除全部车辆信息');
    setClearDialogOpen(false);
  };

  // 获取状态标签
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      available: 'default',
      in_use: 'secondary',
      maintenance: 'destructive',
    };
    const labels: Record<string, string> = {
      available: '可用',
      in_use: '使用中',
      maintenance: '维护中',
    };
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">车辆管理</h1>
          <p className="text-gray-500 mt-1">
            共 {vehicles.length} 辆车辆，已筛选 {filteredVehicles.length} 辆
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            添加车辆
          </Button>
          {vehicles.length > 0 && (
            <Button
              variant="outline"
              onClick={handleClearAll}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4" />
              清除车辆
            </Button>
          )}
        </div>
      </div>

      {/* 搜索 */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索车牌、师傅姓名、电话..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* 车辆列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>车牌</TableHead>
                  <TableHead>师傅</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>车型</TableHead>
                  <TableHead>最大趟次</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      {vehicles.length === 0
                        ? '暂无车辆数据，请先导入或添加车辆'
                        : '没有匹配的车辆记录'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVehicles.map((vehicle, index) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="text-gray-400">{index + 1}</TableCell>
                      <TableCell className="font-mono font-medium">
                        {vehicle.plateNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          {vehicle.driver}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {vehicle.driverPhone}
                        </div>
                      </TableCell>
                      <TableCell>{vehicle.vehicleType || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{vehicle.maxTrips} 趟</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(vehicle)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 添加车辆对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              添加车辆
            </DialogTitle>
            <DialogDescription>填写车辆信息</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitAdd)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plateNumber">
                车牌 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="plateNumber"
                {...register('plateNumber', { required: '请输入车牌号' })}
                placeholder="贵A12345"
                className="font-mono"
              />
              {errors.plateNumber && (
                <p className="text-xs text-red-500">{errors.plateNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver">
                师傅姓名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="driver"
                {...register('driver', { required: '请输入师傅姓名' })}
                placeholder="请输入师傅姓名"
              />
              {errors.driver && (
                <p className="text-xs text-red-500">{errors.driver.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="driverPhone">
                电话 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="driverPhone"
                {...register('driverPhone', {
                  required: '请输入电话',
                  pattern: {
                    value: /^1[3-9]\d{9}$/,
                    message: '请输入正确的手机号',
                  },
                })}
                placeholder="13700137000"
              />
              {errors.driverPhone && (
                <p className="text-xs text-red-500">{errors.driverPhone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicleType">车型</Label>
              <Input
                id="vehicleType"
                {...register('vehicleType')}
                placeholder="商务别克GL8"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTrips">最大趟次</Label>
              <Input
                id="maxTrips"
                type="number"
                min={1}
                max={10}
                {...register('maxTrips', {
                  valueAsNumber: true,
                  min: { value: 1, message: '最少1趟' },
                  max: { value: 10, message: '最多10趟' },
                })}
                placeholder="4"
              />
              {errors.maxTrips && (
                <p className="text-xs text-red-500">{errors.maxTrips.message}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setAddDialogOpen(false);
                }}
              >
                取消
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                添加
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除车辆 "{vehicleToDelete?.plateNumber}" 吗？此操作不可撤销。
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

      {/* 清除全部车辆确认对话框 */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认清除全部车辆</DialogTitle>
            <DialogDescription>
              确定要清除所有 <strong className="text-red-600">{vehicles.length}</strong> 辆车辆信息吗？
              <br /><span className="text-amber-600">⚠️ 此操作不可撤销，车辆数据将全部删除</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmClearAll}>
              清除全部
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
