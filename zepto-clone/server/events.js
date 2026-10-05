import { EventEmitter } from 'events'

// Tiny pub/sub used by the live order tracking stream (Server-Sent Events).
const bus = new EventEmitter()
bus.setMaxListeners(0)
export const emitOrder = (code, order) => bus.emit('order:' + code, order)
export const onOrder = (code, fn) => { bus.on('order:' + code, fn); return () => bus.off('order:' + code, fn) }
