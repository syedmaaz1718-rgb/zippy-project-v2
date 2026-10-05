import { useState } from 'react'

// Real photo from /products/<id>.jpg, falling back to the emoji if the file is missing (e.g. admin-added products).
export default function ProductImage({ product }) {
  const [broken, setBroken] = useState(false)
  if (broken || !product.id) return <span className="emoji">{product.emoji}</span>
  return <img src={`/products/${product.id}.jpg`} alt={product.name} loading="lazy" onError={() => setBroken(true)} />
}
