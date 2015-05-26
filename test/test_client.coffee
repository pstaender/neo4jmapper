expect        = require('expect.js')
Join          = require('join')
#_             = require('underscore')
#require('mocha')

config = {
  url: "http://localhost:7000"
  user: "neo4j"
  password: "neo4j"
}

Neo4jMapper = require("../lib/")

{client,Graph,Node,Relationship} = new Neo4jMapper({
  server: 'http://localhost:7000'
})

describe 'Initializing a connection', ->

  it 'expect to query a Graph custom', (done) ->
    Graph.query 'MATCH (n) return COUNT(n)', (err, count) ->
      expect(err).to.be null
      expect(count).to.be.a 'number'
      done()

  it 'expect to query a Graph', (done) ->

    Graph
      .match('(n)')
      .return 'COUNT (n)', (err, count) ->
        expect(err).to.be null
        expect(count).to.be.a 'number'
        done()


#   it 'expect to initialize a connection', (done) ->
#     
#     client.post 'db/data/cypher', {
#       query: "MATCH (x {name: {startName}})-[r]-(friend) WHERE friend.name = {name} RETURN TYPE(r)",
#       params : {
#         startName : "I",
#         name : "you"
#       }
#     }, (err, res) ->
#       console.log err
#       done()

