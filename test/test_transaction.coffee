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
    query = 'START n=node(*) MATCH (n)-[r]-() RETURN n, r LIMIT {l}'
    params = { l: 1 }
    # w/o cb and w/o args
    t = new Transaction()
    # without cb
    t = new Transaction query, params
    expect(t.statements).to.have.length 1
    expect(t.statements[0].statement).to.be.equal query
    expect(t.statements[0].parameters).to.be.equal params
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
      expect(transaction.statements[0].isTransmitted).to.be true
      expect(transaction.status).to.be 'open'
      done()

  it 'expect to handle many statements in a transaction asnyc', (done) ->
    query = 'START n=node(*) MATCH (n)-[r]-() RETURN n LIMIT {l}'
    t = new Transaction(query, { l: 1 }).add query, { l: 2 }, (err, transaction) ->
      expect(err).to.be null
      expect(transaction.untransmittedStatements().length).to.be 0
      new Transaction(query, { l: 1 }).add(query, { l: 2 }).commit (err, transaction) ->
        expect(err).to.be null
        result = transaction.statements[1].results        
        query = 'CREATE (n {props}) RETURN id(n)'
        Transaction.commit query, { props: { name: 'Philipp' } }, (err, transaction) ->
          expect(err).to.be null
          done()

  it 'expect to get errors on wrong transactions', (done) ->
    query = 'CREATE (n {props}) RETURN n AS node, id(n), as ID'
    Transaction.commit query, { props: { name: 'Philipp' } }, (err, transaction) ->
      expect(err).to.be null
      expect(transaction.errors).to.have.length 1
      done()


  it 'expect to get usable results', (done) ->
    query = 'CREATE (n {props}) RETURN n AS node, id(n) AS ID'
    Transaction.commit query, { props: { name: 'Linda' } }, (err, transaction) ->
      expect(err).to.be null
      expect(transaction.results).to.have.length 1
      expect(transaction.results[0].columns).to.have.length 2
      expect(transaction.results[0].data[0][0].name).to.be.equal 'Linda'
      expect(transaction.results[0].data[0][1]).to.be.above 0
      expect(transaction.status).to.be.equal 'finalized'
      done()

  it.only 'expect to execute rollbacks', (done) ->
    query = 'CREATE (n {props}) RETURN n AS node, id(n) AS ID'
    Transaction.open query, { props: { name: 'Philipp' } }, (err, transaction) ->
      expect(err).to.be null
      id = transaction.results[0].data[0][1]#).to.be.above 0
      expect(id).to.be.above 0
      # check that node exists
      client.get "/node/#{id}", (err, found) ->
        expect(err).to.be null
        expect(found.id).to.be.equal id
        transaction.rollback (err) ->
          expect(err).to.be null
          # check that node doen't exists anymore
          client.get "/node/#{id}", (err, found) ->
            expect(err).to.be null
            expect(found).to.be null
            done()

