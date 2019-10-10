const assert = require('chai').assert
const expect = require('chai').expect
const uuid = require('uuid')
const reduct = require('reduct')
const levelup = require('levelup')
const memdown = require('memdown')
const WebMonetization = require('../src/models/web-monetization')

var deps
var webMonetization

var amount = 100
var assetCode = 'USD'
var assetScale = 2
var webhook = 'http://example.com'
var additionalFields = {
  test: 'test'
}

describe('WebMonetization', function () {
  beforeEach(function () {
    deps = reduct()
    webMonetization = deps(WebMonetization)
    webMonetization.db = levelup(memdown())
  })
  describe('.create()', function () {
    it('should create a webMonetization', async function () {
      const id = uuid()
      await webMonetization.create(id)
      const createdAt = new Date()
      const retrieval = JSON.parse(await webMonetization.db.get(id))
      console.log(retrieval)
      expect(retrieval.balance).to.equal('0')
      expect(retrieval.createdAt).to.be.a('string')
      expect(new Date(retrieval.createdAt)).to.be.within(createdAt, new Date())
    })
  })
  describe('.pay()', function () {
    var id
    var createdAt
    beforeEach(async function () {
      id = uuid()
      createdAt = new Date()
      await webMonetization.create(id)
    })
    it('should adjust the balance', async function () {
      const amount = 50
      await webMonetization.pay({ id, amount })
      await webMonetization.writeQueue
      const retrieval = JSON.parse(await webMonetization.db.get(id))
      expect(retrieval.balance).to.equal('50')
      expect(retrieval.createdAt).to.be.a('string')
      expect(new Date(retrieval.createdAt)).to.be.within(createdAt, new Date())
    })
  })
})
