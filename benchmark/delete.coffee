Benchmark = require('benchmark')
{graph,neo4j,neo4jmapper,Node,client} = require './init'

suite = new Benchmark.Suite

suite.add 'create + delete nodes        (node--neo4j)', (deferred) ->
  graph.createNode( value: String(new Date) ).save (err, node) ->
    node.delete ->
      deferred.resolve()
, defer: true

suite.add 'create + delete nodes        (neo4jmapper)', (deferred) ->
  new Node( value: String(new Date) ).save (err, node) ->
    node.delete ->
      deferred.resolve()
, defer: true

i = 1
suite.on "cycle", (event) ->
  console.log "  " + i++ + ") " + String(event.target)

exports = module.exports = {suite}