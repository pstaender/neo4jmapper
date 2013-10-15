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

client.constructor::log = Graph::log = configForTest.doLog if configForTest.doLog

# TODO: fix test / find transaction that stays open

describe 'Neo4jMapper (transaction)', ->

  it 'create new open transaction', (done) ->
    query = 'START n=node(*) MATCH (n)-[r]-() RETURN n, r LIMIT {l}'
    params = { l: 1 }
    # w/o cb and w/o args
    t = new Transaction()
    # without cb
    t = new Transaction query, params
    expect(t.neo4jrestful.absoluteUrl()).to.be.a 'string'
    expect(t.status).to.be 'new'
    # # with cb
    # TODO: fix test
    new Transaction query, params, (err, transaction) ->
      expect(err).to.be null
      expect(transaction.status).to.be 'open'
      # this is not a part of the test but must be done, to close the transaction to prevent (other) tests failing
      transaction.close (err, t) ->
        expect(t.status).to.be 'committed'
        done()

  it 'expect to create, add statements and close a transaction', (done) ->
    query = 'CREATE (n {props}) RETURN n AS node, id(n) AS id'
    paramsWith = (name) -> { props: { name: name } }
    t = new Transaction(query, paramsWith('Foo Fighters')).add(query, paramsWith('Metallica'))
    expect(t.statements).to.have.length 2
    expect(t.statements[0].statement).to.be.equal query
    expect(t.statements[0].parameters.props.name).to.be.equal 'Foo Fighters'
    expect(t.statements[1].statement).to.be.equal query
    expect(t.statements[1].parameters.props.name).to.be.equal 'Metallica'
    expect(t.status).to.be 'new'
    expect(t.id).to.be null
    t.add query, paramsWith('Tomte'), (err, transaction) ->
      expect(err).to.be null
      expect(transaction.statements).to.have.length 3
      expect(transaction.statements[2].statement).to.be.equal query
      expect(transaction.statements[2].parameters.props.name).to.be.equal 'Tomte'
      expect(transaction.statements[0].status).not.to.be null
      expect(transaction.statements[1].status).not.to.be null
      expect(transaction.statements[2].status).not.to.be null
      expect(transaction.status).to.be 'open'
      id = transaction.id
      expect(id).to.be.above 0
      transaction.add query, paramsWith('Pink Floyd'), (err, transaction) ->
        expect(err).to.be null
        expect(transaction.statements).to.have.length 4
        expect(transaction.statements[3].parameters.props.name).to.be.equal 'Pink Floyd'
        expect(transaction.statements[0].status).not.to.be null
        expect(transaction.statements[1].status).not.to.be null
        expect(transaction.statements[2].status).not.to.be null
        expect(transaction.statements[3].status).not.to.be null
        expect(transaction.status).to.be 'open'
        # ensure that we work with the same transaction
        expect(transaction.id).to.be.equal id
        transaction.close (err, transaction) ->
          expect(err).to.be null
          expect(transaction.id).to.be.equal id
          expect(transaction.status).to.be.equal 'committed'
          return done()
    expect(t.status).to.be.equal 'creating'

  it 'expect to handle many statements in a transaction asnyc', (done) ->
    query = 'START n=node(*) MATCH (n)-[r]-() RETURN n LIMIT {l}'
    Transaction.begin(query, { l: 1 }).add(query, { l: 2 }).commit (err, transaction) ->
      expect(err).to.be null
      expect(transaction.untransmittedStatements().length).to.be 0
      expect(transaction.status).to.be.equal 'committed'
      # create = begin, close = commit
      Transaction.create(query, { l: 1 }).add(query, { l: 2 }).close (err, transaction) ->
        expect(err).to.be null
        expect(transaction.status).to.be.equal 'committed'
        done()

  it 'expect to get errors on wrong transactions', (done) ->
    query = 'CREATE (n {props}) RETURN n AS node, id(n), as ID'
    Transaction.commit query, { props: { name: 'Philipp' } }, (err, transaction) ->
      expect(err).to.be null
      expect(transaction.status).to.be.equal 'committed'
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
      expect(transaction.status).to.be.equal 'committed'
      done()

  it 'expect to execute rollbacks', (done) ->
    query = 'CREATE (n {props}) RETURN n AS node, id(n) AS ID'
    Transaction.open()
      .add(query, { props: { name: 'Dave' } })
      .add query, { props: { name: 'Nate' } }, (err, transaction) ->
        expect(err).to.be null
        expect(transaction.status).not.to.be.equal 'finalized'
        transaction.add query, { props: { name: 'Taylor' } }, (err, transaction) ->
          expect(err).to.be null
          expect(transaction.status).not.to.be.equal 'finalized'
          id = transaction.results[0].data[0][1]
          expect(transaction.results).to.have.length 3
          expect(transaction.results[0].data[0][0].name).to.be.equal 'Dave'
          expect(transaction.results[1].data[0][0].name).to.be.equal 'Nate'
          expect(transaction.results[2].data[0][0].name).to.be.equal 'Taylor'
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

