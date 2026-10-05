import { db } from './db.js'

// Hinglish number words
const NUM = { ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4, panch: 5, paanch: 5, five: 5, chhe: 6, che: 6, six: 6, saat: 7, seven: 7, aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10, dozen: 12, darjan: 12, aadha: 1, half: 1 }

// alias words -> product name keyword (matched with LIKE against the catalog)
const ALIAS = [
  [['doodh', 'milk', 'dudh'], 'Toned Milk'], [['ande', 'anda', 'egg', 'eggs'], 'Farm Eggs'],
  [['kela', 'kele', 'banana', 'bananas'], 'Banana'], [['seb', 'apple', 'apples'], 'Apple'],
  [['tamatar', 'tomato', 'tomatoes'], 'Tomato'], [['pyaaz', 'pyaz', 'onion', 'onions', 'pyaj'], 'Onion'],
  [['gajar', 'carrot', 'carrots'], 'Carrot'], [['palak', 'spinach'], 'Spinach'],
  [['paneer'], 'Paneer'], [['dahi', 'curd', 'yogurt'], 'Curd'], [['makhan', 'butter'], 'Butter'],
  [['chips', 'wafers'], 'Potato Chips'], [['maggi', 'noodles', 'noodle'], 'Masala Noodles'],
  [['cookies', 'cookie'], 'Choco Cookies'], [['biscuit', 'biscuits'], 'Chocolate Biscuits'],
  [['popcorn'], 'Popcorn'], [['chocolate', 'choclate', 'chocolates'], 'Dark Chocolate'],
  [['cola', 'coke', 'coldrink', 'cold drink', 'pepsi'], 'Cola'], [['juice', 'ras'], 'Orange Juice'],
  [['pani', 'paani', 'water'], 'Mineral Water'], [['bread', 'double roti'], 'Brown Bread'],
  [['pav', 'bun', 'buns'], 'Pav'], [['croissant'], 'Croissant'], [['shampoo'], 'Shampoo'],
  [['toothpaste', 'paste', 'colgate'], 'Toothpaste'], [['sabun', 'soap'], 'Bath Soap'],
  [['icecream', 'ice cream'], 'Ice Cream'], [['coffee', 'kaafi'], 'Instant Coffee'],
  [['chai', 'tea'], 'Iced Tea'], [['cup noodles'], 'Cup Noodles'], [['protein'], 'Protein Bar'],
  [['ors'], 'ORS'], [['soup'], 'Instant Soup'], [['energy'], 'Energy Drink'],
]
const FILLER = new Set(['add', 'karo', 'kar', 'do', 'de', 'dena', 'daal', 'dal', 'chahiye', 'chahie', 'mangao', 'mangwao', 'bhej', 'bhejo', 'mujhe', 'mereko', 'please', 'plz', 'cart', 'mein', 'me', 'main', 'ko', 'aur', 'and', 'ka', 'ki', 'ke', 'packet', 'pack', 'wala', 'wali', 'bottle', 'kilo', 'kg', 'piece', 'pieces', 'pcs', 'order', 'i', 'want', 'need', 'get', 'a', 'an', 'the', 'some', 'thoda', 'thodi', 'bas'])

export function parseVoice(text) {
  const clean = text.toLowerCase().replace(/[.!?]/g, ' ')
  // split into chunks on separators, then 'aur'/'and'
  const chunks = clean.split(/,|\band\b|\baur\b|\+|\bphir\b|\bplus\b|\bthen\b/).map((c) => c.trim()).filter(Boolean)
  const found = [], unmatched = []
  for (const chunk of chunks) {
    const words = chunk.split(/\s+/)
    let qty = 1
    for (const w of words) {
      if (/^\d+$/.test(w)) { qty = Math.min(Number(w), 20); break }
      if (NUM[w]) { qty = NUM[w]; break }
    }
    // longest alias first so "ice cream" beats "cream"
    let hit = null
    const padded = ` ${chunk} `
    for (const [keys, kw] of ALIAS) {
      for (const k of keys) {
        if (padded.includes(` ${k} `) || padded.includes(` ${k}s `)) { if (!hit || k.length > hit.k.length) hit = { k, kw } }
      }
    }
    // "cup noodles" must beat "noodles"
    const product = hit && db.prepare('SELECT id,name,emoji,price,mrp,unit,stock FROM products WHERE active=1 AND name LIKE ? LIMIT 1').get(`%${hit.kw}%`)
    if (product) {
      if (product.stock <= 0) unmatched.push(`${product.name} (out of stock)`)
      else found.push({ productId: product.id, name: product.name, emoji: product.emoji, price: product.price, unit: product.unit, qty: Math.min(qty, product.stock), heard: chunk })
    } else {
      const rest = words.filter((w) => !FILLER.has(w) && !/^\d+$/.test(w) && !NUM[w]).join(' ')
      if (rest) unmatched.push(rest)
    }
  }
  // merge duplicates
  const merged = {}
  found.forEach((f) => { merged[f.productId] = merged[f.productId] ? { ...merged[f.productId], qty: merged[f.productId].qty + f.qty } : f })
  return { items: Object.values(merged), unmatched }
}
