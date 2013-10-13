if root?
  # external modules
  require('source-map-support').install()
  expect        = require('expect.js')
  Join          = require('join')
  _             = require('underscore')

  # load config
  configForTest = require('./config')

  # neo4j mapper modules
  Neo4j         = require("../#{configForTest.srcFolder}/index.js")

  # patter matching for objects we will need for the tests
  {Graph,Node,helpers,client,Transaction}  = new Neo4j(configForTest.neo4jURL)

else if window?
  # tests in browser
  configForTest = _.extend({
    doLog: false
    wipeDatabase: false
    neo4jURL: 'http://yourserver:0000/'
    startInstantly: false
  }, configForTest or {})
  Join = window.Join
  neo4jmapper = Neo4jMapper.init(configForTest.neo4jURL)
  {Graph,Node,helpers,client,Transaction} = neo4jmapper
  Neo4j = Neo4jMapper.init

describe 'Neo4jMapper (transaction)', ->

  it 'create new transaction', (done) ->
    query = 'START n=node(*) RETURN n LIMIT {l}'
    params = { l: 1 }
    # w/o cb and w/o args
    t = new Transaction()
    # without cb
    t = new Transaction query, params
    expect(t.statements).to.have.length 1
    expect(t.statements[0].statement).to.be.equal query
    expect(t.statements[0].parameters).to.be.equal params
    expect(t.statements[0].transmitted).to.be false
    expect(t.status).to.be 'begin'
    expect(t.neo4jrestful.absoluteUrl()).to.be.a 'string'
    # with cb
    transaction = new Transaction query, params, (err, response) ->
      expect(err).to.be null
      # check client is included as well
      o = transaction.toObject()
      expect(o.uri).to.be.a 'string'
      expect(o.id).to.be.above 0
      expect(o.expires.constructor).to.be Date
      expect(transaction.statements[0].transmitted).to.be true
      expect(transaction.status).to.be 'open'
      done()

  it.only 'expect to handle many statements in a transaction asnyc', (done) ->
    query = 'START n=node(*) RETURN n LIMIT {l}'
    t = new Transaction(query, { l: 1 }).add query, { l: 2 }, (err, transaction) ->
      expect(err).to.be null
      expect(transaction.untransmittedStatements().length).to.be 0
      done()



