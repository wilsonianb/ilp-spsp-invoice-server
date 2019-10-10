const levelup = require('levelup')
const leveldown = require('leveldown')
const memdown = require('memdown')
const BigNumber = require('bignumber.js')

const Config = require('../lib/config')

class WebMonetizationModel {
  constructor (deps) {
    this.config = deps(Config)
    this.db = levelup(this.config.dbPath
      ? leveldown(this.config.dbPath)
      : memdown())

    this.balanceCache = new Map()
    this.writeQueue = Promise.resolve()
  }

  async pay ({ id, amount }) {
    const webMonetization = await this.get(id)

    if (!this.balanceCache.get(id)) {
      this.balanceCache.set(id, webMonetization.balance)
    }

    const balance = new BigNumber(this.balanceCache.get(id))
    const newBalance = BigNumber(balance).plus(amount)

    // TODO: debounce instead of writeQueue
    this.balanceCache.set(id, newBalance.toString())
    this.writeQueue = this.writeQueue.then(async () => {
      const loaded = await this.get(id)
      loaded.balance = newBalance.toString()
      return this.db.put(id, JSON.stringify(loaded))
    })
  }

  async get (id) {
    return JSON.parse(await this.db.get(id))
  }

  async create (id) {
    await this.db.put(id, JSON.stringify({
      balance: String(0),
      createdAt: new Date()
    }))
  }
}

module.exports = WebMonetizationModel
