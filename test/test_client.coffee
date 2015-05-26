expect        = require('expect.js')
Join          = require('join')
#_             = require('underscore')
#require('mocha')

config = {
  url: "http://localhost:7010"
  user: "neo4j"
  password: "neo4j"
}

Neo4jMapper   = require("../lib/")

# describe 'Initializing a connection', ->

#   it 'expect to initialize a connection', (done) ->
#     {client} = new Neo4jMapper({
#       server: 'http://localhost:7010'
#     })
#     client.post 'db/data/cypher', {
#       query: "MATCH (x {name: {startName}})-[r]-(friend) WHERE friend.name = {name} RETURN TYPE(r)",
#       params : {
#         startName : "I",
#         name : "you"
#       }
#     }, (err, res) ->
#       console.log err
#       done()

