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

    node = {}
    labels = []
    
    @node = (newNode = null) ->
      node = newNode if newNode isnt null
      node

    @labels = (labelOrLabels) =>
      if typeof labelOrLabels isnt 'undefined'
        # reset labels
        @label = null
        labels = []
      #if typeof labelOrLabels is 'undefined'
      #  @checkLabels()
      if typeof labelOrLabels is 'string'
        @label = labelOrLabels
        labels = [ labelOrLabels ]
      else if _.isArray(labelOrLabels)
        labels = labelOrLabels
        @label = labelOrLabels[0] or null

      labels

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

  save: (cb) ->
    self = @
    if typeof cb is 'function'
      # build query
      # CREATE (n:Person { name : 'Andres', title : 'Developer' })
      labels = if @labels().length > 0 then ':'+@labels().join(':') else ''
      data = @getData()
      queryString = """
      CREATE (n#{labels} { properties })
      RETURN n
      """
      query = Graph.query queryString, {
        properties: data
      }, @_processQueryResult(cb)
    @

  _processQueryResult: (cb) ->
    self = @
    loadLabels = true # TODO
    tempcb = (err, node) ->
      return cb(err, node) if err or not _.isObject(node)
      unless loadLabels
        self._assignNodeFromDatabase node, ->
          cb(err,self)
      else
        Graph.getClient().get node.labels, (temp_err, labels) ->
          unless temp_err
            try
              labels = JSON.parse(labels)
              self.labels(labels)
            catch e
              labels = labels
              self.label = labels if typeof labels is 'string'
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
    RETURN n
    """
    Graph.query(queryString, { id }, @_processQueryResult(cb))

  findById: (id, cb) -> @findByID(id, cb)


  # checkLabels: ->
  #   if _.isArray(@labels())
  #     @label = @labels()[0]
  #   else if typeof @label is 'string' and not _.isArray(@labels)
  #     @labels = [ @label ]

  # setLabel: (labelOrLabels) ->
  #   if typeof labelOrLabels is 'undefined'
  #     @checkLabels()
  #   else if typeof labelOrLabels is 'string'
  #     @label = labelOrLabels
  #     @labels = [ labelOrLabels ]
  #   else if _.isArray(labelOrLabels)
  #     @labels = labelOrLabels
  #     @label = labelOrLabels[0]

  # reload: ->
  #   # load all data (labels)
  #   id = @node().

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