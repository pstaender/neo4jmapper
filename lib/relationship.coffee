_           = require('underscore')
Wait        = require('./wait')
GraphObject = require('./graphobject')
Debug       = require('./debug')

module.exports = (_Graph_) ->

  class Relationship extends GraphObject

    type:  null
    start: null
    end:   null
    id:    null
    from:  null
    to:    null

    _excludedDataFields_: [ "type", "start", "end", "id", "from", "to" ]

    relationship: (r) ->
      @dbObject(r)

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

      @save(cb) if typeof cb is 'function'

    create: (start, end, type, data, cb) ->
      new Relationship(start, end, type, data, cb)

    createByResponseData: (body) ->

      start = GraphObject._extractNumber_(body.start)
      end   = GraphObject._extractNumber_(body.end)
      data  = body.data
      id    = GraphObject._extractNumber_(body.self)
      type  = body.type
      
      r = Relationship.create(start, end, type, data).dbObject(body)
      r.id = r.getID()
      # throw Error('!')
      r

    setGraph: (Graph) ->
      _Graph_ = Graph
      @
    
    getGraph: ->
      _Graph_

    save: (cb) ->
      if typeof cb is 'function'
        # create or update?
        if @getID() isnt null
          @update(cb)
        else
          @saveAsNew(cb)
      @

    saveAsNew: (cb) ->
      throw new Error("TODO: implement")

    update: (cb) ->
      throw new Error("TODO: implement")


    getData: ->
      data = {}
      prototype = Object.getPrototypeOf(@)
      for attr in Object.getOwnPropertyNames(@)
        # we are sorting out attributes, which exists on prototype
        # e.g. [ 'label', 'labels', 'id' ]
        data[attr] = @[attr] if typeof prototype[attr] is 'undefined'
      data

    load: (cb) ->
      self = @
      # TODO: check for chached data
      # console.log @dbObject()
      id = @getID()
      start = GraphObject._extractNumber_(@dbObject().start) or null
      end   = GraphObject._extractNumber_(@dbObject().end) or null

      wait = new Wait()

      [start, end].forEach (id) ->
        queryString = """
          START n=node({id})
          RETURN n
          """
        query = _Graph_
          .query(queryString, { id })
        wait.add (cb) ->
          query.first(cb)

      wait.done (err, result) ->
        return cb(err, result) if err or result?.length  is 0
        for node in result
          if node.id is self.start
            self.from = node
          if node.id is self.end
            self.to = node
        cb(err, self)
      
      @

  Relationship.create = Relationship::create

  Relationship
