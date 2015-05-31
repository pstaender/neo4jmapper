CypherQuery = require('./cypherquery')
_      = require('underscore')
Wait   = require('./wait')
Debug  = require('./debug')

module.exports = (_client_) ->

  _Node_ = null
  _Relationship_ = null

  _responseObjects_ =
    Relationship:
      pattern: /^http.+?\/relationship\/[0-9]+$/
      attribute: 'self'
      createByResponseData: ->
      superClass: 'Relationship'
      load: ->
    Node:
      pattern: /^http.+?\/node\/[0-9]+$/
      attribute: 'self'
      createByResponseData: ->
      superClass: 'Node'
      load: ->

  class GraphQuery extends CypherQuery
    
    returnFirst: false
    returnColumns: false
    returnData: true
    _client_: null 

    add: (data, parameters, cb) ->
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
        url = 'db/data/cypher'
        data = {
          data:
            query: self.toString()
            params: self.parameters
        }
        # console.log { query: , params: self.parameters }
        new Debug()
          .log("Sending CypherQuery: \n#{self.toString().trim()}\n", "url")
          .log("with data: #{JSON.stringify(self.parameters, null, ' ')}", "data")
        
        _client_.post url, data, (err, data, res) ->
          if typeof self.processResponse is 'function'
            self.processResponse(err, data, res, cb)
          else
            cb(err, res)
      @

    exec: (cb) -> @execute(cb)

    first: (data, parameters, cb) ->
      @returnFirst = true
      if typeof data is 'function'
        cb = data
        parameters = null
        data = null
      else if typeof parameters is 'function'
        cb = parameters
        parameters = null
      if _.isObject(parameters) and not _.isArray(parameters)
        @setParameters(parameters)
      @add(data) if typeof data is 'string'
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

    createObjectFromData: (data) ->
      returnData = null
      for name of _responseObjects_
        { attribute, pattern, createByResponseData, superClass, load } = _responseObjects_[name]
        if data[attribute] and pattern.test(data[attribute])
          if superClass is 'Node' or 'Relationship'
            obj = createByResponseData(data)
            returnData = obj if obj
      returnData

    processResponse: (err, body, res, cb) ->
      return cb(err, body, res) if err or not body?.data
      result = body

      wait = new Wait()

      self = @
      
      result.data?.forEach (row, i) ->
        row?.forEach (column, j) ->
          # we check every cell for objects
          if _.isObject(column) and not _.isArray(column) 
            object = self.createObjectFromData(column)
            do (i,j) ->
              wait.add (cb) ->
                object.load (err, loadedObject) ->
                  # we assign the first column, if we only have 1 return column
                  if result.columns.length is 1
                    result.data[i] = loadedObject
                  else
                    result.data[i][j] = loadedObject
                  cb(err, null)
          else
            if result.columns.length is 1
              result.data[i] = column
            else
              result.data[i][j] = column

      wait.done (err, noData) ->
        
        data = result.data

        preparedData = null

        data = data[0] if self.returnFirst

        if self.returnData and not self.returnColumns
          preparedData = data
        else if not self.returnData and self.returnColumns
          preparedData = body?.columns or []
        else if not self.returnData and not self.returnColumns
          preparedData = {}
        
        cb(err, preparedData, res)

      @

  class Graph

    # @setNode = (Node) ->
    #   _Node_ = Node
    #   @

    # @getNode = -> _Node_
    # @Node = -> @getNode()

    # @setRelationship = (Relationship) ->
    #   _Relationship_ = Relationship
    #   @

    # @getRelationship = -> _Relationship_
    # @Relationship = -> @getRelationship()

    assignResponseMethods: ->
      # assign methods (manually)
      _responseObjects_.Node.load = _Node_::load
      _responseObjects_.Node.createByResponseData = _Node_::createByResponseData
      _responseObjects_.Relationship.load = _Relationship_::load
      _responseObjects_.Relationship.createByResponseData = _Relationship_::createByResponseData

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

    start:  (data, cb) -> @query().start(data).exec(cb)
    create: (data, cb) -> @query().start(data).exec(cb)
    match:  (data, cb) -> @query().match(data).exec(cb)

  Graph.query = Graph::query
  Graph.start = Graph::start
  Graph.match = Graph::match
  Graph.create = Graph::create
  Graph.GraphQuery = GraphQuery
  Graph.setRelationship = (Relationship) -> _Relationship_ = Relationship
  Graph.getRelationship = -> _Relationship_
  Graph.setNode = (Node) -> _Node_ = Node
  Graph.getNode = -> _Node_
  Graph.setClient = Graph::setClient
  Graph.getClient = Graph::getClient
  Graph.assignResponseMethods = Graph::assignResponseMethods

  Graph

