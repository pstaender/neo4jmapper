CypherQuery = require('./cypherquery')

client = null

class GraphQuery extends CypherQuery

  add: (data, cb) ->
    super
    if typeof @cb is 'function'
      @execute(@cb)
    else
      @

  execute: (cb) ->
    return @ if typeof cb isnt 'function'
    if client is null
      cb(Error("No restful client attached"), null) 
      return @
    client.post 'db/data/cypher', {
      data:
        query: @toString()
        params: @parameters
    }, cb
    @

  exec: (cb) -> @execute(cb)


class Graph

  query: (data, parameters = {}, cb) ->
    cb = parameters if typeof parameters is 'function'
    query = new GraphQuery(data, parameters, cb)
    query.client = client
    query.exec(cb)
    query

  setClient: (cl) ->
    client = cl
    @

  getClient: ->
    client

  # client: (cl) ->
  #   client = cl if typeof client isnt 'undefined'
  #   client

  start:  (data, cb) -> @query().start(data).exec(cb)
  create: (data, cb) -> @query().start(data).exec(cb)
  match:  (data, cb) -> @query().match(data).exec(cb)

Graph.query = Graph::query
Graph.start = Graph::start
Graph.match = Graph::match
Graph.create = Graph::create

module.exports = Graph