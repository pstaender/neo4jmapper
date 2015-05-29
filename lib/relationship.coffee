_ = require('underscore')

GraphObject = require('./graphobject')

Graph = null

class Relationship extends GraphObject

  type:  null
  start: null
  end:   null
  id:    null

  relationship: (r) ->
    @dbObject(r)

  #setRelationship: ->
  #getRelationship: ->

  constructor: (start, end, type, data = {}, cb = null) ->
    super
    # sorting arguments; all arguments are optional
    if typeof data is 'function'
      cb = data
      data = {}
    # set data
    @start = start
    @end = end
    @type = type
    @setData(data)

    # _relationship_ = {}
    
    # @relationship = (rel) ->
    #   _relationship_ = rel if rel and _.isObject(rel)
    #   _relationship_

    # @setRelationship = (relationship) ->
    #   _relationship_ = relationship
    #   @

    # @getRelationship = -> _relationship_

    @save(cb) if typeof cb is 'function'

  create: (start, end, type, data, cb) ->
    new Relationship(start, end, type, data, cb)

  createFromResponse: (body) ->

    start = @_extractNumber_(body.start)
    end   = @_extractNumber_(body.end)
    data  = body.data
    id    = @_extractNumber_(body.self)
    type  = body.type
    
    r = Relationship.create(start, end, type, data).setRelationship(body)
    r

  setGraph: (_Graph) ->
    Graph = _Graph
    @
  
  getGraph: ->
    Graph

  save: (cb) ->
    if typeof cb is 'function'
      # create or update?
      if @getID() isnt null
        @update(cb)
      else
        @saveAsNew(cb)
    @

  saveAsNew: (cb) ->
    # build query
    # CREATE (n:Person { name : 'Andres', title : 'Developer' })
    # labels = if @labels().length > 0 then ':'+@labels().join(':') else ''
    # data = @getData()
    # queryString = """
    # CREATE (n#{labels} { properties })
    # RETURN n, labels(n)
    # """
    # query = Graph.query queryString, {
    #   properties: data
    # }, @_processQueryResult(cb)

  update: (cb) ->
    # data = @getData()
    # id = @getID()
    # unless id
    #   cb(new Error('No id on node'), null)
    #   return @
    # queryString = """
    # START n=node({ id })
    # SET n = { properties }\n
    # """
    # labels = @labels()
    # if labels.length > 0
    #   queryString += """
    #   SET n :#{labels.join(':')}\n
    #   """
    # queryString += """
    # RETURN n
    # """
    throw new Error("TODO: implement")
    # query = Graph.query queryString, {
    #   properties: data
    #   id: id
    # }, @_processQueryResult(cb)

  # _processQueryResult: (cb) ->
  #   self = @
  #   lambda = (err, node) ->
  #     return cb(err, node) if err or not _.isObject(node)
  #     if node?.columns?.length is 2
  #       node = node.data[0]
  #       self.labels(node[1])
  #       node = node[0]
  #     self._assignNodeFromDatabase node, ->
  #       cb(err,self)

  # _assignNodeFromDatabase: (node, cb)->
  #   if _.isObject(node)
  #     @node(node)
  #     @id = @getID()
  #     @setData(node.data)
  #   cb(null, null) if typeof cb is 'function'
  #   @

  getData: ->
    data = {}
    prototype = Object.getPrototypeOf(@)
    for attr in Object.getOwnPropertyNames(@)
      # we are sorting out attributes, which exists on prototype
      # e.g. [ 'label', 'labels', 'id' ]
      data[attr] = @[attr] if typeof prototype[attr] is 'undefined'
    data

  load: (cb) ->
    # TODO: check for chached data
    #loadLabels = true
    console.log @getRelationship()
    id = @getID()
    cb(null, @)
    @

  setData: (data) ->
    excludes = [ "type" ]
    if _.isObject(data)
      # check for not allowed fields (since they are used for managing nodes in db)
      for exclude in excludes
        throw Error("data can't contain '#{exclude}' field. Set '#{exclude}' on node object manually") if typeof data[exclude] isnt 'undefined'
      for attr of data
        @[attr] = data[attr]

Relationship.create = Relationship::create

module.exports = Relationship
