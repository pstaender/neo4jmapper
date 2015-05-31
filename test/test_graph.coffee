expect        = require('expect.js')
Wait          = require('../lib/wait')

n4jmt = require('./neoj4mapperForTesting')
{client,Graph,Node,Relationship} = n4jmt.create()


describe 'Initializing the Graph with a connection', ->

  it 'expect to query a Graph with a custom query', (done) ->
    Graph
      .query('MATCH (n) return COUNT(n)')
      .first (err, count) ->
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

  it 'expect to create more than one Neo4jMapper instance on different servers', (done) ->
    Neo4jMapper = require("../lib/")

    wait = new Wait()
    
    server1 = n4jmt.config.url            # -> http://localhost:7000/
    server2 = n4jmt.config.altServerUrl   # -> http://localhost:7002/

    expect(server1).not.to.be server2

    n4j1 = new Neo4jMapper({ url: server1 })
    expect(n4j1.client.url.href).to.be server1
    
    wait.add (done) ->
      n4j1.Graph.query().first 'MATCH (n) return COUNT(n)', (err, count) ->
        expect(err).to.be null
        expect(count).to.be.a 'number'
        done(err, count)

    expect(server1).not.be server2

    n4j2 = new Neo4jMapper({ url: server2 })
    expect(n4j2.client.url.href).to.be server2

    wait.add (done) ->
      n4j2.Graph.query().first 'MATCH (n) return COUNT(n)', (err, count) ->
        expect(err).to.be null
        expect(count).to.be.a 'number'
        done(err, count)

    wait.done (err, data) ->
      done()

  it 'expect to work on more than one instance seperatly', (done) ->
    
    Neo4jMapper = require("../lib/")
    
    wait = new Wait()
    
    server1 = n4jmt.config.url
    server2 = n4jmt.config.altServerUrl

    expect(server1).not.to.be server2

    randomData = []
    randomDataSorted = {}

    sessions = [
      { url: server1, countBefore: null, countAfter: null, countData: null },
      { url: server2, countBefore: null, countAfter: null, countData: null },
    ]

    sessions.forEach (session, i) ->
      randomData[i] = []
      label = n4jmt.randomString(12)
      maxNodesCount = n4jmt.randomInteger(1)
      [0..maxNodesCount].forEach (j) ->
        uid = n4jmt.randomInteger(10)
        randomData[i][j] = { uid, label }
        randomDataSorted[label] ?= []
        randomDataSorted[label].push(uid)

    wait = new Wait()
    debug = false
    # create random nodes in 4 sessions asynchronously (2 sessions each server instance)
    randomData.forEach (sessionData, i) ->
      session = sessions[i]
      { url, countBefore, countAfter } = session

      _Graph = new Neo4jMapper({ url, debug }).Graph

      label = sessionData[0].label

      # count the node(s) before the insert
      queryStringCountNode = """
        MATCH (n)
        RETURN count(n)
      """

      wait.add (sessionDone) ->

        _Graph.query().first queryStringCountNode, (err, count) ->

          expect(err).to.be null

          waitForSession = new Wait()
          session.countBefore = count

          # sort by uids, sorting for compare data later
          # randomDataSorted[label] = randomDataSorted[label].sort()

          sessionData.forEach (randomNodeData) ->
            { label, uid } = randomNodeData
            waitForSession.add (nodeDone) ->
              label = label
              data  = { uid }
              query = """
              CREATE (n:#{label} { data })
              RETURN n
              """
              _Graph.query().first query, { data }, nodeDone

          
          waitForSession.done (err, nodes) ->
            expect(err).to.be null
            # count after
            _Graph.query().first queryStringCountNode, (err, count) ->
              expect(err).to.be null
              session.countAfter = count
              session.countData = sessionData.length
              sessionDone(err, nodes)
    
    wait.done (err, nodes) ->
      expect(err).to.be null
      # TODO: validate
      sessions.forEach (session, i) ->
        { url, countBefore, countAfter, countData } = session
        expect(countBefore).to.be.above -1
        expect(countAfter - countBefore).to.be countData
      done()