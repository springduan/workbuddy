// server/index.js - 后端主服务
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import 'dotenv/config'
import db from './db.js'
import { getOpenid, getAccessToken, sendSubscribeMessage } from './wechat.js'

const app = express()
const PORT = process.env.PORT || 3000
const APPID = process.env.WECHAT_APPID
const SECRET = process.env.WECHAT_SECRET
const TEMPLATE_ID = process.env.TEMPLATE_ID

// JWT secret for admin authentication
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('⚠️ 未设置 JWT_SECRET 环境变量，使用临时密钥。生产环境请配置 .env 文件！')
  return crypto.randomBytes(32).toString('hex')
})()

// Simple token storage (in production, use Redis)
const activeTokens = new Map()

// Generate simple token
function generateToken(user) {
  const token = crypto.randomBytes(32).toString('hex')
  activeTokens.set(token, {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role
  })
  return token
}

// Verify token middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未登录或登录已过期' })
  }
  const token = authHeader.slice(7)
  const user = activeTokens.get(token)
  if (!user) {
    return res.status(401).json({ success: false, message: '未登录或登录已过期' })
  }
  req.user = user
  next()
}

// Admin only middleware
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '权限不足，仅管理员可操作' })
  }
  next()
}

// Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

app.use(cors({
  origin: [
    'https://bybus.asia',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  credentials: true,
}))
app.use(express.json())

// ─────────────────────────────────────────────
// 用户相关接口
// ─────────────────────────────────────────────

// 注册/登录（小程序端调用）
app.post('/api/user/register', async (req, res) => {
  const { code, name, phone, role } = req.body

  if (!code || !name || !phone || !role) {
    return res.json({ success: false, message: '参数不完整' })
  }

  try {
    const openid = await getOpenid(APPID, SECRET, code)

    // 插入或更新用户
    db.prepare(`
      INSERT INTO users (openid, name, phone, role, updated_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(openid) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        role = excluded.role,
        updated_at = excluded.updated_at
    `).run(openid, name, phone, role)

    res.json({ success: true, data: { openid, name, phone, role } })
  } catch (err) {
    console.error('注册失败', err)
    res.json({ success: false, message: err.message })
  }
})

// 更新订阅状态
app.post('/api/user/subscribe', (req, res) => {
  const { openid, subscribed } = req.body

  if (!openid) {
    return res.json({ success: false, message: '缺少 openid' })
  }

  db.prepare(`
    UPDATE users SET subscribed = ?, updated_at = datetime('now', 'localtime')
    WHERE openid = ?
  `).run(subscribed ? 1 : 0, openid)

  res.json({ success: true })
})

// 获取用户列表（排班系统端调用）
app.get('/api/users', (req, res) => {
  const { role } = req.query
  let users

  if (role) {
    users = db.prepare('SELECT * FROM users WHERE role = ? AND subscribed = 1').all(role)
  } else {
    users = db.prepare('SELECT * FROM users WHERE subscribed = 1').all()
  }

  res.json({ success: true, data: users })
})

// 批量检查手机号注册状态（推送前预检）
app.post('/api/users/check', (req, res) => {
  const { phones } = req.body  // [{ phone, role }]
  if (!phones || !Array.isArray(phones)) {
    return res.json({ success: false, message: '缺少 phones 参数' })
  }

  const result = phones.map(({ phone, role }) => {
    if (!phone) return { phone: '', role, registered: false, subscribed: false, reason: '手机号为空' }
    const user = db.prepare('SELECT * FROM users WHERE phone = ? AND role = ?').get(phone, role)
    if (!user) return { phone, role, registered: false, subscribed: false, reason: '未注册小程序' }
    if (!user.subscribed) return { phone, role, registered: true, subscribed: false, reason: '已取消订阅通知' }
    return { phone, role, registered: true, subscribed: true, name: user.name, reason: null }
  })

  res.json({ success: true, data: result })
})

// ─────────────────────────────────────────────
// 任务相关接口
// ─────────────────────────────────────────────

// 获取某用户的任务列表（小程序端调用）
app.get('/api/tasks', (req, res) => {
  const { openid } = req.query

  if (!openid) {
    return res.json({ success: false, message: '缺少 openid' })
  }

  const tasks = db.prepare(`
    SELECT * FROM task_notifications
    WHERE openid = ?
    ORDER BY task_date DESC, departure_time DESC
    LIMIT 50
  `).all(openid)

  // 同时获取该用户当前注册的信息
  const user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid)

  // 格式化给小程序使用
  const formatted = tasks.map(t => ({
    id: t.id,
    date: t.task_date,
    departureTime: t.departure_time,
    customerName: t.customer_name,
    customerPhone: t.customer_phone,
    flightInfo: t.flight_info,
    destination: t.destination,
    vehiclePlate: t.vehicle_plate,
    driverName: t.driver_name,
    driverPhone: t.driver_phone,
    salespersonName: t.salesperson_name,
    salespersonPhone: t.salesperson_phone,
    status: t.status,
    statusText: t.status === 'normal' ? '正常' : t.status === 'delay' ? '延误' : '取消'
  }))

  res.json({ success: true, data: formatted, user: user ? {
    openid: user.openid,
    name: user.name,
    phone: user.phone,
    role: user.role
  } : null })
})

// 清除用户的所有任务记录（用于换手机号后清理旧数据）
app.delete('/api/tasks', (req, res) => {
  const { openid } = req.body

  if (!openid) {
    return res.json({ success: false, message: '缺少 openid' })
  }

  const result = db.prepare('DELETE FROM task_notifications WHERE openid = ?').run(openid)

  res.json({ success: true, message: `已清除 ${result.changes} 条任务记录` })
})

// ─────────────────────────────────────────────
// 推送接口（排班系统调用，核心功能）
// ─────────────────────────────────────────────

/**
 * 发送行程通知
 * 接收排班系统传来的任务列表，向每个任务的业务员和司机推送消息
 *
 * 请求体格式：
 * {
 *   tasks: [
 *     {
 *       taskId: "uuid",
 *       date: "2026-05-06",
 *       departureTime: "08:30",
 *       customerName: "张三",
 *       customerPhone: "138xxxx",
 *       flightInfo: "CZ1234",
 *       destination: "龙洞堡T2",
 *       vehiclePlate: "贵A·88888",
 *       driverPhone: "139xxxx",     // 用于匹配已注册的司机
 *       salespersonPhone: "137xxxx" // 用于匹配已注册的业务员
 *     }
 *   ]
 * }
 */
app.post('/api/notify', async (req, res) => {
  const { tasks } = req.body

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.json({ success: false, message: '任务列表为空' })
  }

  // 调试日志：记录推送请求的所有手机号，方便排查"未注册"问题
  console.log('[NOTIFY] 推送请求：')
  tasks.forEach((t, i) => {
    console.log(`  任务${i+1} taskId=${t.taskId} driverPhone=${t.driverPhone || '(空)'} salespersonPhone=${t.salespersonPhone || '(空)'}`)
  })

  const results = []
  let token

  try {
    token = await getAccessToken(APPID, SECRET)
  } catch (err) {
    return res.json({ success: false, message: `获取微信 token 失败: ${err.message}` })
  }

  for (const task of tasks) {
    const taskResult = { taskId: task.taskId, pushed: [], failed: [] }

    // 查找匹配的司机（通过手机号）
    const driver = task.driverPhone
      ? db.prepare('SELECT * FROM users WHERE phone = ? AND role = ?').get(task.driverPhone, 'driver')
      : null
    console.log(`  [查询司机] phone=${task.driverPhone || '(空)'} → ${driver ? `found: ${driver.name} subscribed=${driver.subscribed}` : 'NOT FOUND'}`)

    // 查找匹配的业务员（通过手机号）
    const salesperson = task.salespersonPhone
      ? db.prepare('SELECT * FROM users WHERE phone = ? AND role = ?').get(task.salespersonPhone, 'salesperson')
      : null
    console.log(`  [查询业务员] phone=${task.salespersonPhone || '(空)'} → ${salesperson ? `found: ${salesperson.name} subscribed=${salesperson.subscribed}` : 'NOT FOUND'}`)

    // 构建推送数据（根据模板字段调整）
    // 新模板字段：thing3=用车时间, car_number8=车牌, thing7=驾驶员姓名, phone_number9=电话, thing18=使用地点
    const buildMessageData = (recipientRole) => {
      // 根据接收方角色决定显示内容
      if (recipientRole === 'driver') {
        // 司机收到：业务员联系方式 + 接机信息
        return {
          thing3: { value: task.departureTime || '待确认' },
          car_number8: { value: task.vehiclePlate || '待确认' },
          thing7: { value: salesperson ? salesperson.name : '业务员' },
          phone_number9: { value: task.salespersonPhone || '待确认' },
          thing18: { value: task.departureLocation || task.destination || '待确认' }
        }
      } else {
        // 业务员收到：客户信息 + 司机车牌/电话
        return {
          thing3: { value: task.departureTime || '待确认' },
          car_number8: { value: task.vehiclePlate || '待确认' },
          thing7: { value: driver ? driver.name : '司机' },
          phone_number9: { value: task.driverPhone || '待确认' },
          thing18: { value: task.destination || '待确认' }
        }
      }
    }

    // 向司机推送
    if (driver && driver.subscribed) {
      // 检查是否已经推送过（防止重复发送）
      const alreadyPushed = db.prepare(
        'SELECT id FROM task_notifications WHERE task_id = ? AND openid = ?'
      ).get(task.taskId, driver.openid)

      if (alreadyPushed) {
        // 已推送过，跳过（返回成功，不报错）
        taskResult.pushed.push({ role: 'driver', name: driver.name, phone: driver.phone, duplicate: true })
      } else {
        try {
          await sendSubscribeMessage({
            accessToken: token,
            openid: driver.openid,
            templateId: TEMPLATE_ID,
            data: buildMessageData('driver')
          })

          // 记录任务通知
          db.prepare(`
            INSERT INTO task_notifications
            (task_id, openid, task_date, customer_name, customer_phone, flight_info,
             destination, departure_time, vehicle_plate, salesperson_name, salesperson_phone, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal')
          `).run(
            task.taskId, driver.openid, task.date,
            task.customerName, task.customerPhone, task.flightInfo,
            task.destination, task.departureTime, task.vehiclePlate,
            salesperson?.name, task.salespersonPhone
          )

          db.prepare(`INSERT INTO push_logs (task_id, openid, success) VALUES (?, ?, 1)`)
            .run(task.taskId, driver.openid)

          taskResult.pushed.push({ role: 'driver', name: driver.name, phone: driver.phone })
        } catch (err) {
          db.prepare(`INSERT INTO push_logs (task_id, openid, success, error_msg) VALUES (?, ?, 0, ?)`)
            .run(task.taskId, driver.openid, err.message)
          taskResult.failed.push({ role: 'driver', phone: task.driverPhone, error: err.message })
        }
      }
    } else if (task.driverPhone) {
      // 区分未注册和已取消订阅
      const driverByPhone = db.prepare('SELECT * FROM users WHERE phone = ? AND role = ?').get(task.driverPhone, 'driver')
      if (driverByPhone) {
        taskResult.failed.push({ role: 'driver', phone: task.driverPhone, error: '该用户已取消订阅通知，请联系用户重新授权' })
      } else {
        taskResult.failed.push({ role: 'driver', phone: task.driverPhone, error: '该手机号未注册小程序或角色不匹配' })
      }
    }

    // 向业务员推送
    if (salesperson && salesperson.subscribed) {
      // 检查是否已经推送过（防止重复发送）
      const alreadyPushedSales = db.prepare(
        'SELECT id FROM task_notifications WHERE task_id = ? AND openid = ?'
      ).get(task.taskId, salesperson.openid)

      if (alreadyPushedSales) {
        // 已推送过，跳过（返回成功，不报错）
        taskResult.pushed.push({ role: 'salesperson', name: salesperson.name, phone: salesperson.phone, duplicate: true })
      } else {
        try {
          await sendSubscribeMessage({
            accessToken: token,
            openid: salesperson.openid,
            templateId: TEMPLATE_ID,
            data: buildMessageData('salesperson')
          })

          // 记录任务通知
          db.prepare(`
            INSERT INTO task_notifications
            (task_id, openid, task_date, customer_name, customer_phone, flight_info,
             destination, departure_time, vehicle_plate, driver_name, driver_phone, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal')
          `).run(
            task.taskId, salesperson.openid, task.date,
            task.customerName, task.customerPhone, task.flightInfo,
            task.destination, task.departureTime, task.vehiclePlate,
            driver?.name, task.driverPhone
          )

          db.prepare(`INSERT INTO push_logs (task_id, openid, success) VALUES (?, ?, 1)`)
            .run(task.taskId, salesperson.openid)

          taskResult.pushed.push({ role: 'salesperson', name: salesperson.name, phone: salesperson.phone })
        } catch (err) {
          db.prepare(`INSERT INTO push_logs (task_id, openid, success, error_msg) VALUES (?, ?, 0, ?)`)
            .run(task.taskId, salesperson.openid, err.message)
          taskResult.failed.push({ role: 'salesperson', phone: task.salespersonPhone, error: err.message })
        }
      }
    } else if (task.salespersonPhone) {
      // 区分未注册和已取消订阅
      const salespersonByPhone = db.prepare('SELECT * FROM users WHERE phone = ? AND role = ?').get(task.salespersonPhone, 'salesperson')
      if (salespersonByPhone) {
        taskResult.failed.push({ role: 'salesperson', phone: task.salespersonPhone, error: '该用户已取消订阅通知，请联系用户重新授权' })
      } else {
        taskResult.failed.push({ role: 'salesperson', phone: task.salespersonPhone, error: '该手机号未注册小程序或角色不匹配' })
      }
    }

    results.push(taskResult)
  }

  res.json({ success: true, data: results })
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常', time: new Date().toLocaleString('zh-CN') })
})

// ─────────────────────────────────────────────
// 管理后台用户接口
// ─────────────────────────────────────────────

// 管理员登录
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.json({ success: false, message: '请输入账号和密码' })
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username)
  if (!user) {
    return res.json({ success: false, message: '账号或密码错误' })
  }

  const hash = hashPassword(password)
  if (hash !== user.password_hash) {
    return res.json({ success: false, message: '账号或密码错误' })
  }

  const token = generateToken(user)
  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    }
  })
})

// 获取当前用户信息
app.get('/api/admin/me', authMiddleware, (req, res) => {
  res.json({ success: true, data: req.user })
})

// 登出
app.post('/api/admin/logout', authMiddleware, (req, res) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    activeTokens.delete(token)
  }
  res.json({ success: true })
})

// 获取用户列表（仅管理员）
app.get('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id, username, name, role, created_at FROM admin_users ORDER BY id DESC').all()
  res.json({ success: true, data: users })
})

// 创建用户（仅管理员）
app.post('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  const { username, password, name, role } = req.body

  if (!username || !password || !name || !role) {
    return res.json({ success: false, message: '参数不完整' })
  }

  if (!['admin', 'employee'].includes(role)) {
    return res.json({ success: false, message: '角色无效' })
  }

  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username)
  if (existing) {
    return res.json({ success: false, message: '账号已存在' })
  }

  const hash = hashPassword(password)
  const result = db.prepare('INSERT INTO admin_users (username, password_hash, name, role) VALUES (?, ?, ?, ?)')
    .run(username, hash, name, role)

  res.json({
    success: true,
    data: {
      id: result.lastInsertRowid,
      username,
      name,
      role
    }
  })
})

// 更新用户（仅管理员）
app.put('/api/admin/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params
  const { password, name, role } = req.body

  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id)
  if (!user) {
    return res.json({ success: false, message: '用户不存在' })
  }

  const updates = []
  const values = []

  if (name) {
    updates.push('name = ?')
    values.push(name)
  }

  if (role && ['admin', 'employee'].includes(role)) {
    updates.push('role = ?')
    values.push(role)
  }

  if (password) {
    updates.push('password_hash = ?')
    values.push(hashPassword(password))
  }

  if (updates.length === 0) {
    return res.json({ success: false, message: '没有要更新的字段' })
  }

  updates.push('updated_at = datetime("now", "localtime")')
  values.push(id)

  db.prepare(`UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  res.json({ success: true, message: '更新成功' })
})

// 删除用户（仅管理员）
app.delete('/api/admin/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params

  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id)
  if (!user) {
    return res.json({ success: false, message: '用户不存在' })
  }

  // 不允许删除自己
  if (user.id === req.user.id) {
    return res.json({ success: false, message: '不能删除自己的账号' })
  }

  db.prepare('DELETE FROM admin_users WHERE id = ?').run(id)
  res.json({ success: true, message: '删除成功' })
})

// 批量导入用户（仅管理员）
app.post('/api/admin/users/batch', authMiddleware, adminOnly, (req, res) => {
  const { users } = req.body

  if (!users || !Array.isArray(users) || users.length === 0) {
    return res.json({ success: false, message: '用户数据为空' })
  }

  const results = { success: 0, failed: 0, errors: [] }

  const insert = db.prepare('INSERT INTO admin_users (username, password_hash, name, role) VALUES (?, ?, ?, ?)')
  const check = db.prepare('SELECT id FROM admin_users WHERE username = ?')

  for (const u of users) {
    if (!u.username || !u.password || !u.name) {
      results.failed++
      results.errors.push(`${u.username || '未知'}: 信息不完整`)
      continue
    }

    if (check.get(u.username)) {
      results.failed++
      results.errors.push(`${u.username}: 账号已存在`)
      continue
    }

    try {
      insert.run(u.username, hashPassword(u.password), u.name, u.role || 'employee')
      results.success++
    } catch (e) {
      results.failed++
      results.errors.push(`${u.username}: ${e.message}`)
    }
  }

  res.json({ success: true, data: results })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 调度通知服务已启动：http://0.0.0.0:${PORT}`)
  console.log(`   AppID: ${APPID}`)
})
