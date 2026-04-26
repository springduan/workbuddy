import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DEFAULT_SCHEDULE_CONFIG, type ScheduleConfig } from '@/types';
import { RotateCcw, Save, Plane, Train } from 'lucide-react';

interface ConfigSettingsProps {
  currentConfig: ScheduleConfig;
  onSave: (config: ScheduleConfig) => void;
  onReset: () => void;
}

export function ConfigSettings({ currentConfig, onSave, onReset }: ConfigSettingsProps) {
  const [config, setConfig] = useState<ScheduleConfig>(currentConfig);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setConfig(currentConfig);
    setHasChanges(false);
  }, [currentConfig]);

  const handleChange = (key: keyof ScheduleConfig, value: string) => {
    const numValue = parseInt(value) || 0;
    setConfig(prev => ({ ...prev, [key]: numValue }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(config);
    setHasChanges(false);
    toast.success('配置已保存');
  };

  const handleReset = () => {
    if (confirm('确定要恢复默认配置吗？')) {
      onReset();
      setHasChanges(false);
      toast.success('已恢复默认配置');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">排班配置</h1>
          <p className="text-gray-500 mt-1">设置排班相关的时间参数和限制</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            恢复默认
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4" />
            保存配置
          </Button>
        </div>
      </div>

      {/* 出发提前量配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plane className="w-5 h-5 text-blue-600" />
            出发提前量配置
          </CardTitle>
          <CardDescription>
            设置车辆出发时间相对于客户到达时间的提前量
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="flightLeadTime" className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-blue-500" />
                飞机出发提前量（分钟）
              </Label>
              <Input
                id="flightLeadTime"
                type="number"
                min="0"
                value={config.flightDepartureLeadTime}
                onChange={(e) => handleChange('flightDepartureLeadTime', e.target.value)}
                placeholder="例如：60"
              />
              <p className="text-xs text-gray-500">
                车辆在客户到达前多少分钟出发（建议：40-90分钟）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trainLeadTime" className="flex items-center gap-2">
                <Train className="w-4 h-4 text-green-500" />
                高铁出发提前量（分钟）
              </Label>
              <Input
                id="trainLeadTime"
                type="number"
                min="0"
                value={config.trainDepartureLeadTime}
                onChange={(e) => handleChange('trainDepartureLeadTime', e.target.value)}
                placeholder="例如：40"
              />
              <p className="text-xs text-gray-500">
                车辆在客户到达前多少分钟出发（建议：20-60分钟）
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 趟次间隔配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            趟次间隔配置
          </CardTitle>
          <CardDescription>
            设置同一辆车执行两个任务之间的最小时间间隔
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="flightDuration" className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-blue-500" />
                飞机趟次间隔（分钟）
              </Label>
              <Input
                id="flightDuration"
                type="number"
                min="0"
                value={config.flightPickupDuration}
                onChange={(e) => handleChange('flightPickupDuration', e.target.value)}
                placeholder="例如：150"
              />
              <p className="text-xs text-gray-500">
                从出发到返回的完整时间（建议：120-180分钟）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trainDuration" className="flex items-center gap-2">
                <Train className="w-4 h-4 text-green-500" />
                高铁趟次间隔（分钟）
              </Label>
              <Input
                id="trainDuration"
                type="number"
                min="0"
                value={config.trainPickupDuration}
                onChange={(e) => handleChange('trainPickupDuration', e.target.value)}
                placeholder="例如：100"
              />
              <p className="text-xs text-gray-500">
                从出发到返回的完整时间（建议：60-120分钟）
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 车辆限制配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
            车辆限制配置
          </CardTitle>
          <CardDescription>
            设置车辆的人员和趟次限制
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="maxPassengers">每车最大载客数</Label>
              <Input
                id="maxPassengers"
                type="number"
                min="1"
                value={config.maxPassengersPerVehicle}
                onChange={(e) => handleChange('maxPassengersPerVehicle', e.target.value)}
                placeholder="例如：6"
              />
              <p className="text-xs text-gray-500">
                超过此人数将自动分配2辆车
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTrips">每车最大趟次</Label>
              <Input
                id="maxTrips"
                type="number"
                min="1"
                value={config.maxTripsPerVehicle}
                onChange={(e) => handleChange('maxTripsPerVehicle', e.target.value)}
                placeholder="例如：4"
              />
              <p className="text-xs text-gray-500">
                同一辆车一天内最多执行的趟数
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 计算公式说明 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg text-blue-800">计算公式说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <div className="bg-white/50 rounded-lg p-3">
            <p className="font-medium mb-1">📍 出发时间计算：</p>
            <p>出发时间 = 客户到达时间 - 出发提前量</p>
            <p className="text-xs text-blue-600 mt-1">
              例如：飞机08:00到达，提前60分钟 → 出发时间 = 07:00
            </p>
          </div>
          <div className="bg-white/50 rounded-lg p-3">
            <p className="font-medium mb-1">🔄 返回时间计算：</p>
            <p>返回时间 = 出发时间 + 趟次间隔</p>
            <p className="text-xs text-blue-600 mt-1">
              例如：飞机07:00出发，间隔150分钟 → 返回时间 = 09:30
            </p>
          </div>
          <div className="bg-white/50 rounded-lg p-3">
            <p className="font-medium mb-1">⏱️ 趟次间隔说明：</p>
            <p>同一辆车两次任务的出发时间，必须间隔至少一趟的时间</p>
            <p className="text-xs text-blue-600 mt-1">
              确保车辆完成上一趟任务后，有足够时间返回并执行下一趟
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 默认配置参考 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">默认配置参考</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-500">飞机出发提前量</p>
              <p className="font-semibold">{DEFAULT_SCHEDULE_CONFIG.flightDepartureLeadTime} 分钟</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-500">高铁出发提前量</p>
              <p className="font-semibold">{DEFAULT_SCHEDULE_CONFIG.trainDepartureLeadTime} 分钟</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-500">飞机趟次间隔</p>
              <p className="font-semibold">{DEFAULT_SCHEDULE_CONFIG.flightPickupDuration} 分钟</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-500">高铁趟次间隔</p>
              <p className="font-semibold">{DEFAULT_SCHEDULE_CONFIG.trainPickupDuration} 分钟</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-500">每车最大载客数</p>
              <p className="font-semibold">{DEFAULT_SCHEDULE_CONFIG.maxPassengersPerVehicle} 人</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-500">每车最大趟次</p>
              <p className="font-semibold">{DEFAULT_SCHEDULE_CONFIG.maxTripsPerVehicle} 趟</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
