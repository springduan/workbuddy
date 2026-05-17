const Database = require('better-sqlite3');
const db = new Database('dispatch.db');

// 清掉旧的测试数据
db.prepare("DELETE FROM users WHERE phone IN ('13800001111','13800002222')").run();

// 插入测试司机
const insertDriver = db.prepare(`
  INSERT INTO users (openid, name, phone, role, subscribed, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);
insertDriver.run('test_driver_openid_001', '测试司机', '13800001111', 'driver', 1);

// 插入测试业务员
const insertSales = db.prepare(`
  INSERT INTO users (openid, name, phone, role, subscribed, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);
insertSales.run('test_sales_openid_001', '测试业务员', '13800002222', 'salesperson', 1);

// 查询结果验证
const users = db.prepare('SELECT openid, name, phone, role, subscribed FROM users').all();
console.log('当前 users 表数据：');
console.log(JSON.stringify(users, null, 2));

db.close();
