Benchmark = require('benchmark')
{graph,neo4j,neo4jmapper,Node,client} = require './init'

suite = new Benchmark.Suite

ids = []
# we need **one** id for running benchmarks
Node.find().limit 2, (err, nodes) ->
  ids.push(nodes[0].id)
  ids.push(nodes[1].id)

suite.add 'query 1st node              (node--neo4j)', (deferred) ->
  graph.query "START n=node(*) LIMIT 1 RETURN n;", (err, found) ->
    deferred.resolve()
, defer: true

suite.add 'query 1st node w/o loading  (neo4jmapper)', (deferred) ->
  Node.disable_loading();
  client.query "START n=node(*) LIMIT 1 RETURN n;", (err, found) ->
    deferred.resolve()
, defer: true

suite.add 'findOne node                 (neo4jmapper)', (deferred) ->
  Node.enable_loading();
  Node.findOne (err, found) ->
    deferred.resolve()
, defer: true

suite.add 'find node by id              (node--neo4j)', (deferred) ->
  graph.getNodeById ids[0], (err, found) ->
    deferred.resolve()
, defer: true

suite.add 'findById node                (neo4jmapper)', (deferred) ->
  Node.findById ids[1], (err, found) ->
    deferred.resolve()
, defer: true

suite.add 'findOne node with label      (neo4jmapper)', (deferred) ->
  Person = Node.register_model Node
  Person.findOne (err, found) ->
    deferred.resolve()
, defer: true


i = 1
suite.on "cycle", (event) ->
  console.log "  " + i++ + ") " + String(event.target)

exports = module.exports = {suite}