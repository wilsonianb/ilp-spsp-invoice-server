const { createServer } = require('ilp-protocol-stream')
const crypto = require('crypto')

const debug = require('debug')('ilp-spsp-invoice:server')

const Config = require('./config')
const Exchange = require('ilp-exchange-rate')
const Webhooks = require('./webhooks')
const InvoiceModel = require('../models/invoice')
const WebMonetization = require('../models/web-monetization')

class Server {
  constructor (deps) {
    this.config = deps(Config)
    this.invoices = deps(InvoiceModel)
    this.webMonetizations = deps(WebMonetization)
    this.webhooks = deps(Webhooks)
    this.plugin = this.config.plugin
    this.server = null
  }

  async listen () {
    this.server = await createServer({
      plugin: this.plugin,
      serverSecret: crypto.randomBytes(32)
    })

    this.server.on('connection', async (connection) => {
      debug('server got connection')

      const id = connection.connectionTag
      const invoice = await this.invoices.get(id)
      const webMonetization = await this.webMonetizations.get(id)

      connection.on('stream', async (stream) => {
        if (invoice) {
          const exchangeRate = await Exchange.fetchRate(invoice.assetCode, invoice.assetScale, this.server.serverAssetCode, this.server.serverAssetScale)
          if (exchangeRate) {
            const receivable = Math.ceil((invoice.amount - invoice.balance) * exchangeRate)
            stream.setReceiveMax(receivable)

            stream.on('money', async (received) => {
              debug('Received ' + received + ' units to pay invoice ' + id)
              const amount = Math.floor(received / exchangeRate)
              const paid = await this.invoices.pay({ id, amount })

              if (paid) {
                this.webhooks.call(id)
                  .catch(e => {
                    debug('failed to call webhook. error=', e)
                  })
              }
            })
          }
        } else if (webMonetization) {
          stream.setReceiveMax('100000000')
          stream.on('money', async (received) => {
            debug('Received ' + received + ' units to pay web-monetization ' + id)
            await this.webMonetizations.pay({ id, received })
          })
        }
      })
    })
  }

  generateAddressAndSecret (connectionTag) {
    return this.server.generateAddressAndSecret(connectionTag)
  }
}

module.exports = Server
