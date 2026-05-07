// server/db.js - 数据库初始化
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'dispatch.db')

const db = new Database(DB_PATH)

// 初始化表结构
db.exec(`
  -- 用户表（业务员和司机）
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

  -- 行程通知记录表
  CREATE TABLE IF NOT EXISTS task_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    openid TEXT NOT NULL,
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
    sent_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(task_id, openid)
  );

  -- 推送日志表
  CREATE TABLE IF NOT EXISTS push_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT,
    openid TEXT,
    success INTEGER,
    error_msg TEXT,
    pushed_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- 管理后台用户表
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin', 'employee')),
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );
`)

export default db
