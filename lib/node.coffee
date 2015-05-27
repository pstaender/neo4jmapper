_ = require('underscore')

Graph = null

class Node

  label: null
  labels: []
  id: null

  constructor: (data = {}, label = null, cb = null) ->
    # sorting arguments; all arguments are optional
    if typeof data is 'function'
      cb = data
      data = {}
    if typeof label is 'function'
      db = label
      label = null
    # set label(s)
    @setLabel(label)
    # set data
    @setData(data)
    @save(cb) if typeof cb is 'function'

  create: (data, label, cb)->
    new Node(data, label, cb)

  setGraph: (G) ->
    Graph =
    @
  
  getGraph: ->
    Graph

  save: (cb) ->
    if typeof cb is 'function'
      # build query
      # CREATE (n:Person { name : 'Andres', title : 'Developer' })
      labels = if @labels?.length > 0 then ':'+@labels.join(':') else ''
      data = @getData() 
      attributes = for attr of data
        "#{attr}: {#{attr}}"
      dataString = "{ #{attributes.join(', ')} }"

      query = Graph.create("(n#{labels})")
      console.log query
      cb(null, null)
    @

  getData: ->
    data = {}
    for attr in Object.getOwnPropertyNames(@)
      # we are sorting out attributes, which exists on prototype
      # e.g. [ 'label', 'labels', 'id' ]
      data[attr] = @[attr] if typeof @.__proto__[attr] is 'undefined'
    data

  checkLabels: ->
    if typeof @labels isnt 'undefined' and _.isArray(@labels)
      @label = @labels[0]
    else if typeof @label is 'string' and not _.isArray(@labels)
      @labels = [ @label ]

  setLabel: (labelOrLabels) ->
    if typeof labelOrLabels is 'undefined'
      @checkLabels()
    else if typeof labelOrLabels is 'string'
      @label = labelOrLabels
      @labels = [ labelOrLabels ]
    else if _.isArray(labelOrLabels)
      @labels = labelOrLabels
      @label = labelOrLabels[0]

  setData: (data) ->
    excludes = [ "id", "label", "labels" ]
    if _.isObject(data)
      # check for not allowed fields (since they are used for managing nodes in db)
      for exclude in excludes
        throw Error("data can't contain '#{exclude}' field. Set '#{exclude}' on node object manually") if typeof data[exclude] isnt 'undefined'
      for attr of data
        @[attr] = data[attr]
    


#   constructor: (client) ->    
# Node.findByID = (id, cb) ->


Node.create = Node::create

module.exports = Node