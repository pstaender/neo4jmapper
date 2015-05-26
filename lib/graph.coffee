CypherQuery = require('./cypherquery')


class GraphQuery extends CypherQuery

  client: null

  add: (data, cb) ->
    super
    if typeof @cb is 'function'
      @execute(@cb)
    else
      @

  execute: (cb) ->
    return @ if typeof cb isnt 'function'
    if @client is null
      cb(Error("No restful client attached"), null) 
      return @
    @client.post 'db/data/cypher', {
      data:
        query: @toString()
        params: @parameters
    }, cb
    @

  exec: (cb) -> @execute(cb)


class Graph

  client: null

  query: (data, cb) ->
    query = new GraphQuery(data)
    query.client = @client
    query.exec(cb)
    query

  start: (data, cb) -> @query().start(data).exec(cb)
  match: (data, cb) -> @query().match(data).exec(cb)

  constructor: (@client) ->

Graph.query = Graph::query
Graph.start = Graph::start
Graph.match = Graph::match

module.exports = Graph