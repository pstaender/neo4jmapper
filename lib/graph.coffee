CypherQuery = require('./cypherquery')

_client_ = null
_Node_ = null
_Relationship_ = null

class GraphQuery extends CypherQuery

  add: (data, cb) ->
    super
    if typeof @cb is 'function'
      @execute(@cb)
    else
      @

  execute: (cb) ->
    return @ if typeof cb isnt 'function'
    if _client_ is null
      cb(Error("No restful client attached"), null) 
      return @
    _client_.post 'db/data/cypher', {
      data:
        query: @toString()
        params: @parameters
    }, cb
    @

  exec: (cb) -> @execute(cb)


class Graph

  constructor: ->

    

    @Node = (Node) ->
      _Node_ = Node if typeof Node isnt 'undefined'
      _Node_

    @Relationship = (Relationship) ->
      _Relationship_ = Relationship if typeof Relationship isnt 'undefined'
      _Relationship_

  query: (data, parameters = {}, cb) ->
    cb = parameters if typeof parameters is 'function'
    query = new GraphQuery(data, parameters, cb)
    query.client = _client_
    query.exec(cb)
    query

  setClient: (client) ->
    _client_ = client
    @

  getClient: -> _client_

  setNode: (Node) ->
    _Node_ = Node
    @

  getNode: -> _Node_

  setRelationship: (Relationship) ->
    _Relationship_ = Relationship
    @

  getRelationship: -> _Relationship_

  start:  (data, cb) -> @query().start(data).exec(cb)
  create: (data, cb) -> @query().start(data).exec(cb)
  match:  (data, cb) -> @query().match(data).exec(cb)

Graph.query = Graph::query
Graph.start = Graph::start
Graph.match = Graph::match
Graph.create = Graph::create

module.exports = Graph