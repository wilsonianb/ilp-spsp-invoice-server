const InvoiceModel = require('../models/invoice')
const Server = require('../lib/server')
const WebMonetization = require('../models/web-monetization')
const debug = require('debug')('ilp-spsp-invoice:payment-pointer')

class PaymentPointerController {
  constructor (deps) {
    this.invoices = deps(InvoiceModel)
    this.server = deps(Server)
    this.webMonetizations = deps(WebMonetization)
  }

  async init (router) {
    await this.server.listen()

    router.get('/:invoice_id', async ctx => {
      if (ctx.get('Accept').indexOf('application/spsp4+json') === -1) {
        return ctx.throw(404)
      }

      const invoice = await this.invoices.get(ctx.params.invoice_id)
      if (!invoice) {
        return ctx.throw(404, 'Invoice not found')
      }

      const { destinationAccount, sharedSecret } =
        this.server.generateAddressAndSecret(ctx.params.invoice_id)

      ctx.body = {
        destination_account: destinationAccount,
        shared_secret: sharedSecret.toString('base64'),
        push: {
          balance: String(invoice.balance),
          invoice: {
            amount: String(invoice.amount),
            asset: {
              code: invoice.assetCode,
              scale: invoice.assetScale
            },
            additional_fields: invoice.additionalFields
          }
        }
      }
      ctx.set('Content-Type', 'application/spsp4+json')
    })

    router.get('/', async ctx => {
      const webMonetizationId = ctx.get('web-monetization-id')

      if (ctx.get('Accept').includes('application/spsp4+json')) {
        if (webMonetizationId) {
          const webMonetization = await this.webMonetizations.get(webMonetizationId)
          if (!webMonetization) {
            debug('creating web-monetization')
            await this.webMonetizations.create(webMonetizationId)
          }
        }

        const { destinationAccount, sharedSecret } =
          this.server.generateAddressAndSecret(ctx.params.invoice_id)

        ctx.body = {
          destination_account: destinationAccount,
          shared_secret: sharedSecret.toString('base64')
        }

        ctx.set('Content-Type', 'application/spsp4+json')
      } else if (webMonetizationId && ctx.get('Accept').includes('application/json')) {
        const webMonetization = await this.webMonetizations.get(webMonetizationId)
        if (!webMonetization) {
          return ctx.throw(404, 'Web Monetization Id not found')
        }
        ctx.body = {
          balance: webMonetization.balance,
          created_at: webMonetization.createdAt
        }
        ctx.set('Content-Type', 'application/json')
      } else {
        return ctx.throw(404)
      }
    })
  }
}

module.exports = PaymentPointerController
