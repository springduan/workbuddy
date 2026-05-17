import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'dispatch.db');

console.log('连接数据库：', DB_PATH);
const db = new Database(DB_PATH);

// 初始化表结构（如果不存在）
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('salesperson', 'driver')),
    subscribed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS task_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    openid TEXT NOT NULL,
    UNIQUE(task_id, openid),
    task_date TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    flight_info TEXT,
    destination TEXT,
    departure_location TEXT,
    departure_time TEXT,
    vehicle_plate TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    salesperson_name TEXT,
    salesperson_phone TEXT,
    status TEXT DEFAULT 'normal',
    sent_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS push_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT,
    openid TEXT,
    success INTEGER,
    error_msg TEXT,
    pushed_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

console.log('✅ 表结构初始化完成');

// 清掉旧的测试数据
db.prepare("DELETE FROM users WHERE phone IN ('13800001111','13800002222')").run();
console.log('🧹 清理旧测试数据');

// 插入测试司机
const insertDriver = db.prepare(`
  INSERT INTO users (openid, name, phone, role, subscribed, created_at, updated_at)
  VALUES (?, ?, ?, ?, 1, datetime('now','localtime'), datetime('now','localtime'))
`);
insertDriver.run('test_driver_openid_001', '测试司机', '13800001111', 'driver');
console.log('✅ 插入测试司机：13800001111');

// 插入测试业务员
const insertSales = db.prepare(`
  INSERT INTO users (openid, name, phone, role, subscribed, created_at, updated_at)
  VALUES (?, ?, ?, ?, 1, datetime('now','localtime'), datetime('now','localtime'))
`);
insertSales.run('test_sales_openid_001', '测试业务员', '13800002222', 'salesperson');
console.log('✅ 插入测试业务员：13800002222');

// 验证结果
const users = db.prepare('SELECT openid, name, phone, role, subscribed FROM users').all();
console.log('\n📋 当前 users 表数据：');
console.log(JSON.stringify(users, null, 2));

db.close();
console.log('\n完成！');
