expect        = require('expect.js')

{client,Graph,Node,Relationship} = require('./neoj4mapperForTesting')

class DoneWith

  done: null
  max: 0
  number: 0
  results = []

  constructor: (max, done) ->
    @cb = done
    @max = max
    @results = []

  done: (cb) ->
    @number++
    if typeof cb is 'function'
      cb (err, args) ->
        @results.push({err, args})
    if @number >= @max
      @cb(null, @results)

describe 'Initializing a connection', ->

  it 'expect to query a Graph with a custom query', (done) ->
    Graph
      .query('MATCH (n) return COUNT(n)')
      .first (err, count) ->
        console.log err, count
        expect(err).to.be null
        expect(count).to.be.a 'number'
        done()

  it 'expect to query a Graph', (done) ->

    Graph
      .match('(n)')
      .return('COUNT (n)')
      .first (err, count) ->
        expect(err).to.be null
        expect(count).to.be.a 'number'
        done()

  it.skip 'expect to create more than one Neo4jMapper instance on different servers', (done) ->
    Neo4jMapper = require("../lib/")
    
    isDone = new DoneWith 2, ->
      done()
    
    server1 = 'http://localhost:7000'
    n4j1 = new Neo4jMapper({ server: server1 })
    expect(n4j1.client.server).to.be server1
    n4j1.Graph.query 'MATCH (n) return COUNT(n)', (err, count) ->
      isDone.done()

    server2 = 'http://localhost:7002'

    expect(server1).not.be server2

    n4j2 = new Neo4jMapper({ server: server2 })
    expect(n4j2.client.server).to.be server2

    n4j2.Graph.query 'MATCH (n) return COUNT(n)', (err, count) ->
      expect(err).to.be null
      expect(count).to.be.a 'number'
      isDone.done()
