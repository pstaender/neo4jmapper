CypherQuery = require('./cypherquery')

_      = require('underscore')
Wait   = require('./wait')

_client_ = null
_Node_ = null
_Relationship_ = null

class GraphQuery extends CypherQuery

  responseObjects:
    Relationship:
      pattern: /^http.+?\/relationship\/[0-9]+$/
      attribute: 'self'
      createFromResponse: true
      superClass: 'Relationship'
      load: true
    Node:
      pattern: /^http.+?\/node\/[0-9]+$/
      attribute: 'self'
      createFromResponse: true
      superClass: 'Node'
      load: true

  returnFirst: false
  returnColumns: false
  returnData: true

  constructor: ->
    super
    # ensure we are are not using a reference
    @responseObjects = _.extend({}, @responseObjects, GraphQuery::responseObjects)
    # assign methods
    for className of @responseObjects
      SuperClass = if className is 'Relationship' then _Relationship_ else _Node_
      load = Object.getPrototypeOf(SuperClass).load
      createFromResponse = Object.getPrototypeOf(SuperClass).createFromResponse
      if @responseObjects[className].load
        @responseObjects[className].load = load
      if @responseObjects[className].createFromResponse
        @responseObjects[className].createFromResponse = createFromResponse


  add: (data, cb) ->
    super
    if typeof @cb is 'function'
      @execute(@cb)
    else
      @

  execute: (cb) ->
    self = @
    return self if typeof cb isnt 'function'
    if _client_ is null
      cb(Error("No restful client attached"), null) 
     else
      _client_.post 'db/data/cypher', {
        data:
          query: self.toString()
          params: self.parameters
      }, (err, data, res) ->
        if typeof self.processResponse is 'function'
          self.processResponse(err, data, res, cb)
        else
          cb(err, res)
    @

  exec: (cb) -> @execute(cb)

  first: (cb) ->
    @returnFirst = true
    @execute(cb)

  noColumns: (cb) ->
    @returnColumns = false
    @execute(cb)

  noData: (cb) ->
    @returnRow = false
    @execute(cb)

  dataOnly: (cb) ->
    @returnColumns = false
    @returnData = true
    @execute(cb)

  # debug: false

  createObjectFromData: (data) ->
    returnData = null
    for name of @responseObjects
      { attribute, pattern, createFromResponse, superClass, load } = @responseObjects[name]
      if data[attribute] and pattern.test(data[attribute])
        if superClass is 'Node'
          returnData = createFromResponse(data)
        else if superClass is 'Relationship'
          returnData = createFromResponse(data)
    returnData

  processResponse: (err, body, res, cb) ->
    return cb(err, data, res) if err or not body?.data
    result = body

    wait = new Wait()

    if result.data.length
      for row, i in result.data
        if row?.length
          for column, j in row
            # we check every cell for objects
            if typeof column is 'object' and column isnt null and column.length is undefined 
              object = @createObjectFromData(column)
              wait.add (cb) ->
                object.load (err, node) ->
                  cb(err, node)
              result.data[i][j] = object
            else
              result.data[i][j] = column

    wait.done (err, data) =>
      
      if @returnFirst
        if result.columns?.length is 1
          data = result.data[0][0]
        else
          data = result.data[0]

      if @returnData and not @returnColumns
        result = data
      else if not @returnData and @returnColumns
        result = body?.columns or []
      else if not @returnData and not @returnColumns
        result = {}
      cb(err, result, res)

    @

class Graph

  @setNode = (Node) ->
    _Node_ = Node
    @

  @getNode = -> _Node_
  @Node = -> @getNode()

  @setNode = (Relationship) ->
    _Relationship_ = Relationship
    @

  @getRelationship = -> _Relationship_
  @Relationship = -> @getRelationship()


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