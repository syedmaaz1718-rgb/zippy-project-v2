// Thin wrapper over Node's built-in node:sqlite (Node 22+) that exposes the small
// better-sqlite3 style API the app uses: prepare/get/all/run, exec, pragma, transaction.
// No native module to compile, so nothing can crash on a host with a different toolchain.
import { DatabaseSync } from 'node:sqlite'

export default class Database {
  constructor(file) {
    this.raw = new DatabaseSync(file)
    this.depth = 0
  }
  exec(sql) { return this.raw.exec(sql) }
  pragma(s) { this.raw.exec(`PRAGMA ${s}`) }
  prepare(sql) { return this.raw.prepare(sql) }
  transaction(fn) {
    return (...args) => {
      const outer = this.depth === 0
      const sp = `sp${this.depth}`
      this.raw.exec(outer ? 'BEGIN' : `SAVEPOINT ${sp}`)
      this.depth++
      try {
        const r = fn(...args)
        this.depth--
        this.raw.exec(outer ? 'COMMIT' : `RELEASE ${sp}`)
        return r
      } catch (e) {
        this.depth--
        this.raw.exec(outer ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`)
        throw e
      }
    }
  }
}
