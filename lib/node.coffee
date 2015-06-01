_           = require('underscore')
GraphObject = require('./graphobject')
Debug       = require('./debug')

module.exports = (_Graph_) ->

  class Node extends GraphObject
    
    label: null
    labels: -> []
    id: null

    _debug_: false
    _query_: null

    _excludedDataFields_: [ "id", "label", "labels" ]

    constructor: (data = {}, label = null, cb = null) ->
      super
      # sorting arguments; all arguments are optional
      if typeof data is 'function'
        cb = data
        data = {}
      if typeof label is 'function'
        cb = label
        label = null
      
      # set data
      @setData(data)

      # private scope
      _labels_ = []

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

    create: (data, label, cb) ->
      new Node(data, label, cb)

    createByResponseData: (body) ->
      n = Node.create(body.data)
      n.dbObject(body)
      n.id = n.getID()
      # todo: labels
      n

    setGraph: (Graph) ->
      _Graph_ = Graph
      @
    
    getGraph: -> _Graph_

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
      RETURN n
      """
      query = _Graph_
        .query(queryString, {
          properties: data
        })
        .setIdentifier('n')
      query = query.first Node::onProcessQueryResult(cb, query)
      @_query_ = query
      @

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
      #throw new Error("TODO: implement")
      query = _Graph_
        .query(queryString, {
          properties: data
          id: id
        })
        .setIdentifier('n')
      query = query
        .first Node::onProcessQueryResult(cb, query)
      @_query_ = query
      @

    onProcessQueryResult: (cb, query) ->
      self = @
      throw new Error("2nd argument must be the query/graph object") unless query
      return lambda = (err, rows, res) ->
        # merge labels
        if rows?.length
          for row, i in rows
            if row.length is 2
              # we guess, that we have [ n, labels ] as columns
              labels = rows[i][1]
              node = rows[i][0]
              if typeof node.labels is 'function'
                node.labels(labels)
                rows[i] = node
          if rows.length is 1 and query.returnFirst
            rows = rows[0]
        # TODO: here!!!

        cb(err, rows, res)

    getData: ->
      data = {}
      prototype = Object.getPrototypeOf(@)
      for attr in Object.getOwnPropertyNames(@)
        # we are sorting out attributes, which exists on prototype
        # e.g. [ 'label', 'labels', 'id' ]
        data[attr] = @[attr] if typeof prototype[attr] is 'undefined'
      data

    findByID: (id, cb) ->
      return @findByIDs(id) if _.isArray(id)
      throw Error("'id' must be a number") if typeof id isnt 'number'
      queryString = """
      START n=node({id})
      RETURN n
      """
      query = _Graph_
        .query(queryString, { id })
      query = query.first(Node::onProcessQueryResult(cb,query))
      @_query_ = query
      @

    findByIDs: (ids, cb) ->
      return @ if typeof cb isnt 'function'
      # TODO: check for numbers in array
      if not _.isArray(ids)
        cb(Error("ids must be an array"), null)
      else
        query = _Graph_
          .query()
          .match('n')
          .where('id(n) IN { ids }')
          .return('n')
          .setParameters({ ids })
          #.setIdentifier('n')
          .exec(cb)
        @_query_ = query
      @

    find: (where, parameters, cb, label = '') ->
      if typeof parameters is 'function'
        #label = cb or ''
        cb = parameters
        parameters = {}
      label = if label then ":#{label}" else ''
      @_query_ = _Graph_
        .query()
        .match("(n#{label})")
        .setIdentifier('n')
        .addParameters(parameters)
      if _.isObject(where) or _.isString(where)
        @_query_.where(where)
      else if typeof where is 'function'
        cb = where
      
      @_query_
        .return('n')
        .exec(cb)
      #console.log @_query_.toString()
      #@_query_

    findByLabel: (label, where, parameters, cb) ->
      if _.isArray(label)
        # [ "Person", "Musician" ] -> "Person:Musician"
        label = label.join(':')
      if typeof where is 'function'
        cb = where
        where = null
        parameters = {}
        #console.log cb, where, parameters
      @find(where, parameters, cb, label)

    createRelationTo: (node, type, data, cb, direction = 'outgoing') ->
      @createRelation(node, type, direction, data, cb)

    createRelationFrom: (node, type, data, cb, direction = 'incoming') ->
      @createRelation(node, type, direction, data, cb)

    createRelationBetween: (node, type, data, cb, direction = 'bidirectional') ->
      @createRelation(node, type, direction, data, cb)

    createRelation: (node, type, direction = 'bidirectional', data, cb) ->
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
        type = type.replace(/[^a-zA-Z\_\-0-9\.]/,'')
      throw new Error("Relationtype is mandatory (string with min. 1 character)") if typeof type isnt 'string' or type.trim().length is 0
      
      data ?= {}

      queryString = """
      START a = node({ from }), b = node({ to })
      CREATE (a)#{l_edge}[r:#{type} { properties }]#{r_edge}(b)
      RETURN r
      """
      query = _Graph_
        .query(queryString)
        .setParameters({
          from: from
          to: to
          properties: data
        })
      query.first(cb) if typeof cb is 'function'
      @_query_ = query
      @

    load: (cb) ->
      # TODO: check for chached data
      self = @
      id = @getID()
      if id
        # caution: if you return a node here, you'll produce a loop because:
        # Graph processing will call `load` again, `load` will call Graph processing…
        # Anyhow - to prevent this, set: `query.responseObjects.Node.load = false`
        query = _Graph_
          .query("""
          START n=node({id})
          RETURN labels(n)
          """).setParameters({ id })
        query.first (err, labels) ->
          self.labels(labels)
          cb(null, self)
        @_query_ = query
      else
        cb(null, @)
      @

    # reload: (cb) ->
    #   id = @getID()
    #   @findByID(id, cb) if typeof id is 'number' 
    #   @

    # TODO: implement

    findOrCreate: (cb) ->
    remove: (cb) ->
    removeIncludingRelations: (cb) ->
    incomingRelations: ->
    outgoingRelation: ->
    relations: ->
    # Node.registerModel
    # fields:
    #   indexes:
    #     email: true
    #   defaults:
    #     created_on: ->
    #       new Date().getTime()
    # STREAMING
    # findAll().each


  Node.create         = Node::create#(data, label, cb) -> new Node(data, label, cb)
  Node.findByID       = Node::findByID
  Node.findById       = Node::findByID
  Node.findByIDs      = Node::findByIDs
  Node.find           = Node::find
  Node.findByLabel    = Node::findByLabel
  Node.findByLabels   = Node::findByLabels

  Node
