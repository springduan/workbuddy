import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Trash2,
  Edit2,
  Upload,
  Download,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface AdminUser {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'employee';
  created_at: string;
}

interface UserFormData {
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'employee';
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    name: '',
    role: 'employee',
  });
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('auth_token');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        toast.error(data.message || '获取用户列表失败');
      }
    } catch (err) {
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openAddDialog = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', name: '', role: 'employee' });
    setDialogOpen(true);
  };

  const openEditDialog = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '', // 不显示密码
      name: user.name,
      role: user.role,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.username || !formData.name || (!editingUser && !formData.password)) {
      toast.error('请填写完整信息');
      return;
    }

    setSaving(true);
    try {
      const url = editingUser
        ? `${API_URL}/api/admin/users/${editingUser.id}`
        : `${API_URL}/api/admin/users`;
      const method = editingUser ? 'PUT' : 'POST';

      const body: any = {
        name: formData.name,
        role: formData.role,
      };
      if (formData.password) {
        body.password = formData.password;
      }
      if (!editingUser) {
        body.username = formData.username;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingUser ? '更新成功' : '添加成功');
        setDialogOpen(false);
        fetchUsers();
      } else {
        toast.error(data.message || '操作失败');
      }
    } catch (err) {
      toast.error('操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('删除成功');
        setDeleteDialogOpen(false);
        fetchUsers();
      } else {
        toast.error(data.message || '删除失败');
      }
    } catch (err) {
      toast.error('删除失败');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        const users = rows
          .filter(row => row['姓名'] && row['账号'] && row['初始密码'])
          .map(row => ({
            name: String(row['姓名']),
            username: String(row['账号']),
            password: String(row['初始密码']),
            role: row['角色'] === '管理员' ? 'admin' : 'employee',
          }));

        if (users.length === 0) {
          toast.error('未找到有效数据，请检查Excel格式');
          return;
        }

        const res = await fetch(`${API_URL}/api/admin/users/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ users }),
        });

        const result = await res.json();
        if (result.success) {
          const { success, failed } = result.data;
          toast.success(`导入完成：成功 ${success} 条，失败 ${failed} 条`);
          fetchUsers();
        } else {
          toast.error(result.message || '导入失败');
        }
      } catch (err) {
        toast.error('解析文件失败');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const data = [
      { '姓名': '示例姓名', '账号': 'example', '初始密码': '123456', '角色': '员工' },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '用户导入');
    XLSX.writeFile(wb, '用户导入模板.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理系统用户账户</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            下载模板
          </Button>
          <label>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <Button variant="outline" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                批量导入
              </span>
            </Button>
          </label>
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            添加用户
          </Button>
        </div>
      </div>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            用户列表
          </CardTitle>
          <CardDescription>共 {users.length} 个用户</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无用户</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>账号</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? '管理员' : '员工'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(user.created_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingUser(user);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 添加/编辑用户对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? '编辑用户' : '添加用户'}</DialogTitle>
            <DialogDescription>
              {editingUser ? '修改用户信息' : '创建新的管理后台用户'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="username">账号</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="请输入账号"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入姓名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{editingUser ? '新密码（留空则不修改）' : '密码'}</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingUser ? '不修改请留空' : '请输入密码'}
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={formData.role === 'admin'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'employee' })}
                  />
                  管理员
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="employee"
                    checked={formData.role === 'employee'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'employee' })}
                  />
                  员工
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除用户「{deletingUser?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
