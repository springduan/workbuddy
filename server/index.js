// server/index.js - 后端主服务
import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import db from './db.js'
import { getOpenid, getAccessToken, sendSubscribeMessage } from './wechat.js'

const app = express()
const PORT = process.env.PORT || 3000
const APPID = process.env.WECHAT_APPID
const SECRET = process.env.WECHAT_SECRET
const TEMPLATE_ID = process.env.TEMPLATE_ID

app.use(cors())
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

  res.json({ success: true, data: formatted })
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

    // 查找匹配的业务员（通过手机号）
    const salesperson = task.salespersonPhone
      ? db.prepare('SELECT * FROM users WHERE phone = ? AND role = ?').get(task.salespersonPhone, 'salesperson')
      : null

    // 构建推送数据（根据模板字段调整）
    // 模板字段：car_number3=车牌, thing2=联系人, phone_number4=电话, thing12=出发地, thing13=目的地
    const buildMessageData = (recipientRole) => {
      // 根据接收方角色决定显示内容
      if (recipientRole === 'driver') {
        // 司机收到：业务员联系方式 + 接机信息
        return {
          car_number3: { value: task.vehiclePlate || '待确认' },
          thing2: { value: salesperson ? salesperson.name : '业务员' },
          phone_number4: { value: task.salespersonPhone || '待确认' },
          thing12: { value: task.departureLocation || task.destination || '待确认' },
          thing13: { value: task.destination || '待确认' }
        }
      } else {
        // 业务员收到：客户信息 + 司机车牌/电话
        return {
          car_number3: { value: task.vehiclePlate || '待确认' },
          thing2: { value: driver ? driver.name : '司机' },
          phone_number4: { value: task.driverPhone || '待确认' },
          thing12: { value: task.departureLocation || task.destination || '待确认' },
          thing13: { value: task.destination || '待确认' }
        }
      }
    }

    // 向司机推送
    if (driver && driver.subscribed) {
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
    } else if (task.driverPhone) {
      taskResult.failed.push({ role: 'driver', phone: task.driverPhone, error: '司机未注册小程序或未订阅通知' })
    }

    // 向业务员推送
    if (salesperson && salesperson.subscribed) {
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
    } else if (task.salespersonPhone) {
      taskResult.failed.push({ role: 'salesperson', phone: task.salespersonPhone, error: '业务员未注册小程序或未订阅通知' })
    }

    results.push(taskResult)
  }

  res.json({ success: true, data: results })
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常', time: new Date().toLocaleString('zh-CN') })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 调度通知服务已启动：http://0.0.0.0:${PORT}`)
  console.log(`   AppID: ${APPID}`)
})
