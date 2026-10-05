import Database from './sqlite.js'
import bcrypt from 'bcryptjs'
import path from 'path'
import { fileURLToPath } from 'url'
import { categories, products } from '../src/data/products.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
export const db = new Database(process.env.DB_FILE || path.join(dir, 'zippy.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  monthly_budget INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT, color TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  emoji TEXT, price INTEGER NOT NULL, mrp INTEGER NOT NULL, unit TEXT,
  stock INTEGER NOT NULL DEFAULT 50,
  active INTEGER NOT NULL DEFAULT 1,
  late_night INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cart_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL CHECK (qty > 0),
  PRIMARY KEY (user_id, product_id)
);
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  line TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY, kind TEXT NOT NULL, value INTEGER NOT NULL,
  min_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  min_streak INTEGER NOT NULL DEFAULT 0, description TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'placed',
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  address TEXT NOT NULL, phone TEXT NOT NULL,
  subtotal INTEGER NOT NULL, delivery_fee INTEGER NOT NULL, handling_fee INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0, coupon TEXT, total INTEGER NOT NULL,
  flat_id INTEGER,
  tip INTEGER NOT NULL DEFAULT 0,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  rider_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER, name TEXT NOT NULL, emoji TEXT, price INTEGER NOT NULL, qty INTEGER NOT NULL,
  user_id INTEGER
);
CREATE TABLE IF NOT EXISTS wishlist (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, product_id)
);
CREATE TABLE IF NOT EXISTS flats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS flat_members (
  flat_id INTEGER NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (flat_id, user_id)
);
CREATE TABLE IF NOT EXISTS flat_cart_items (
  flat_id INTEGER NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL CHECK (qty > 0),
  PRIMARY KEY (flat_id, product_id, user_id)
);
CREATE TABLE IF NOT EXISTS order_splits (
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (order_id, user_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
`)

// ---- seed (only on first run) ----
if (db.prepare('SELECT COUNT(*) c FROM categories').get().c === 0) {
  const tx = db.transaction(() => {
    const ic = db.prepare('INSERT INTO categories VALUES (?,?,?,?)')
    categories.forEach((c) => ic.run(c.id, c.name, c.emoji, c.color))
    const ip = db.prepare('INSERT INTO products (name,category_id,emoji,price,mrp,unit,stock,late_night) VALUES (?,?,?,?,?,?,?,?)')
    products.forEach((p) => ip.run(p.name, p.category, p.emoji, p.price, p.mrp, p.unit, 40 + (p.id * 7) % 60, p.lateNight ? 1 : 0))
    const iu = db.prepare('INSERT INTO users (name,email,phone,password_hash,role) VALUES (?,?,?,?,?)')
    iu.run('Admin', 'admin@zippy.com', '9999999999', bcrypt.hashSync('admin123', 10), 'admin')
    iu.run('Demo User', 'demo@zippy.com', '9876543210', bcrypt.hashSync('demo123', 10), 'customer')
    const ico = db.prepare('INSERT INTO coupons (code,kind,value,min_order,min_streak,description) VALUES (?,?,?,?,?,?)')
    ico.run('WELCOME50', 'flat', 50, 299, 0, '₹50 off above ₹299')
    ico.run('ZIPPY10', 'percent', 10, 150, 0, '10% off above ₹150')
    ico.run('FREEDEL', 'freedelivery', 0, 0, 0, 'Free delivery')
    ico.run('STREAK3', 'flat', 30, 99, 3, 'Bhookh Streak reward: ₹30 off (3-day streak, one-time)')
    ico.run('STREAK7', 'flat', 75, 199, 7, 'Bhookh Streak reward: ₹75 off (7-day streak, one-time)')
    ico.run('STREAK14', 'freedelivery', 0, 0, 14, 'Bhookh Streak reward: free delivery (14-day streak, one-time)')
  })
  tx()
  seedSampleReviews()
  console.log('Database seeded: admin@zippy.com / admin123, demo@zippy.com / demo123')
}

// Sample reviews so the ratings UI has content. These are demo data, not real customers.
function seedSampleReviews() {
  const names = ['Aarav S.', 'Diya M.', 'Kabir R.', 'Meera K.', 'Rohan P.']
  const comments = [
    [5, 'Super fresh, delivered really fast.'], [4, 'Good quality for the price.'], [5, 'Always order this one. Never disappointed.'],
    [3, 'Okay, packaging could be better.'], [4, 'Value for money.'], [5, 'Perfect for late night cravings!'], [4, 'Tastes great.'],
  ]
  const iu = db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)')
  const ids = names.map((n, i) => iu.run(n, `sample${i + 1}@zippy.local`, bcrypt.hashSync(Math.random().toString(36), 4)).lastInsertRowid)
  const ir = db.prepare('INSERT OR IGNORE INTO reviews (product_id,user_id,rating,comment) VALUES (?,?,?,?)')
  const pids = db.prepare('SELECT id FROM products').all().map((r) => r.id)
  pids.forEach((pid, i) => {
    const n = 2 + (i % 3)
    for (let k = 0; k < n; k++) {
      const [rating, text] = comments[(i * 3 + k) % comments.length]
      ir.run(pid, ids[(i + k) % ids.length], rating, text)
    }
  })
}
