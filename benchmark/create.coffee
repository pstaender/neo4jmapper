Benchmark = require('benchmark')
{graph,neo4j,neo4jmapper,Node,client} = require './init'

suite = new Benchmark.Suite

suite.add 'create + save a node         (node--neo4j)', (deferred) ->
  graph.createNode( value: String(new Date) ).save (err, node) ->
    if err or not node.id
      throw Error("Error on creating node "+err.message)
    deferred.resolve()
, defer: true

suite.add 'create + save a node         (neo4jmapper)', (deferred) ->
  new Node( value: String(new Date) ).save (err, node) ->
    if err or not node.id
      throw Error("Error on creating node "+err.message)
    deferred.resolve()
, defer: true

suite.add 'create + save a labeled node (neo4jmapper)', (deferred) ->
  class Person extends Node
  Node.register_model Person
  new Person( value: String(new Date) ).save (err, node) ->
    if err or not node.id
      throw Error("Error on creating node "+err.message)
    deferred.resolve()
, defer: true


i = 1
suite.on "cycle", (event) ->
  console.log "  " + i++ + ") " + String(event.target)

exports = module.exports = {suite}