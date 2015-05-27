_ = require('underscore')

Graph = null

class Node

  label: null
  labels: -> []
  node: -> {}
  id: null

  constructor: (data = {}, label = null, cb = null) ->
    # sorting arguments; all arguments are optional
    if typeof data is 'function'
      cb = data
      data = {}
    if typeof label is 'function'
      cb = label
      label = null
    # set data
    @setData(data)

    _node_ = {}
    _labels_ = []
    
    @node = (node = null) ->
      _node_ = node if node isnt null
      _node_

    @labels = (labelOrLabels) =>
      if typeof labelOrLabels isnt 'undefined'
        # reset  labels
        @label   = null
        _labels_ = []
      #if typeof labelOrLabels is 'undefined'
      #  @checkLabels()
      if typeof labelOrLabels is 'string'
        @label   = labelOrLabels
        _labels_ = [ labelOrLabels ]
      else if _.isArray(labelOrLabels)
        _labels_ = labelOrLabels
        @label   = labelOrLabels[0] or null

      _labels_

    # set label(s)
    @labels(label)

    @save(cb) if typeof cb is 'function'

  create: (data, label, cb)->
    new Node(data, label, cb)

  setGraph: (_Graph) ->
    Graph = _Graph
    @
  
  getGraph: ->
    Graph

  setLabels: (labels) ->
    @labels(labels)
    @

  getLabels: -> @labels()

  setLabel: (label) ->
    @setLabels(label)

  getLabel: () -> @label or @labels()[0]
  
  addLabels: (labels) ->
    @labels(_.union(@labels(), labels))
    @

  addLabel: (label) -> @addLabels(_.union(@labels(), [ label ]))

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
    labels = if @labels().length > 0 then ':'+@labels().join(':') else ''
    data = @getData()
    queryString = """
    CREATE (n#{labels} { properties })
    RETURN n, labels(n)
    """
    query = Graph.query queryString, {
      properties: data
    }, @_processQueryResult(cb)

  update: (cb) ->
    data = @getData()
    id = @getID()
    unless id
      cb(new Error('No id on node'), null)
      return @
    queryString = """
    START n=node({ id })
    SET n = { properties }\n
    """
    labels = @labels()
    if labels.length > 0
      queryString += """
      SET n :#{labels.join(':')}\n
      """
    queryString += """
    RETURN n
    """
    #console.log queryString, data
    #throw new Error("TODO: implement")
    query = Graph.query queryString, {
      properties: data
      id: id
    }, @_processQueryResult(cb)

  _processQueryResult: (cb) ->
    self = @
    lambda = (err, node) ->
      return cb(err, node) if err or not _.isObject(node)
      if node?.columns?.length is 2
        node = node.data[0]
        self.labels(node[1])
        node = node[0]
      self._assignNodeFromDatabase node, ->
        cb(err,self)

  _assignNodeFromDatabase: (node, cb)->
    if _.isObject(node)
      @node(node)
      @id = @getID()
      @setData(node.data)
    cb(null, null) if typeof cb is 'function'
    @

  getID: (url = @node()?.self) ->
    # self: 'http://localhost:7000/db/data/node/49'
    id = Number(url?.replace(/^.+?\/([0-9]+)$/,'$1'))
    if isNaN(id) then null else id

  getData: ->
    data = {}
    prototype = Object.getPrototypeOf(@)
    for attr in Object.getOwnPropertyNames(@)
      # we are sorting out attributes, which exists on prototype
      # e.g. [ 'label', 'labels', 'id' ]
      data[attr] = @[attr] if typeof prototype[attr] is 'undefined'
    data

  findByID: (id, cb) ->
    throw Error("'id' must be a number") if typeof id isnt 'number'
    queryString = """
    START n=node({id})
    RETURN n, labels(n)
    """
    Graph.query(queryString, { id }, @_processQueryResult(cb))

  findById: (id, cb) -> @findByID(id, cb)

  createRelationTo: (node, type, data, cb, direction = 'outgoing') ->
    @createRelation(node, type, direction, data, cb)

  createRelationFrom: (node, type, data, cb, direction = 'incoming') ->
    @createRelation(node, type, direction, data, cb)

  createRelationBetween: (node, type, data, cb, direction = 'bidirectional') ->
    @createRelation(node, type, direction, data, cb)

  createRelation: (node, type, direction = 'both', data, cb) ->
    if typeof data is 'function'
      cb = data
      data = {}

    self = @
    from = @getID()
    to = if typeof node is 'number' then node else node.getID()

    l_edge = '<-'
    r_edge = '->'

    if direction is 'outgoing'
      l_edge = '-'
    else if direction is 'incoming'
      r_edge = '-'

    throw new Error("Predecessor needs to have an id") if typeof from isnt 'number'
    throw new Error("Successor needs to have/be an id") if typeof to isnt 'number'
    if typeof type is 'string'
      type = type.replace(/[a-zA-Z\_\-0-9\.]/i,'')
    throw new Error("Relationtype is mandatory (string with min. 1 character)") if typeof type isnt 'string' or type.trim().length is 0
    
    data ?= {}

    queryString = """
    START a = node({ from }), b = node({ to })
    CREATE (a)#{l_edge}[r:#{type} { properties }]#{r_edge}(b)
    RETURN r
    """
    Graph
      .query(queryString)
      .setParameters({
        from: from
        to: to
        properties: data
      })
      .exec (err, r) ->

        # console.log err, self.Relationship()#.createFromResponse(r)
        cb(null, null) if typeof cb is 'function'

  reload: (cb) ->
    id = @getID()
    @findByID(id, cb) if typeof id is 'number' 
    @

  setData: (data) ->
    excludes = [ "id", "label", "labels" ]
    if _.isObject(data)
      # check for not allowed fields (since they are used for managing nodes in db)
      for exclude in excludes
        throw Error("data can't contain '#{exclude}' field. Set '#{exclude}' on node object manually") if typeof data[exclude] isnt 'undefined'
      for attr of data
        @[attr] = data[attr]

Node.create = Node::create

module.exports = Node