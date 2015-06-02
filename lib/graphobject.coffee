_ = require('underscore')
Debug  = require('./debug')

class GraphObject

  id: null
  _excludedDataFields_: []

  dbObject: ->

  constructor: ->

    self = @

    # private scope
    _dbObject_ = {}
    @dbObject = (obj) ->
      if _.isObject(obj) and not _.isArray(obj)
        # setter
        _dbObject_ = obj
        self
      else
        # getter
        _dbObject_

  getDefaultLabel: ->
    @constructor.defaultLabel or null

  getID: (url = @dbObject()?.self) ->
    # self: 'http://localhost:7000/db/data/node/49'
    id = GraphObject._extractNumber_(url)
    if isNaN(id) then null else id

  setData: (data) ->
    excludes = @_excludedDataFields_
    if _.isObject(data) and not _.isArray(data)
      # check for not allowed fields (since they are used for managing nodes in db)
      for exclude in excludes
        throw Error("data can't contain '#{exclude}' field. Set '#{exclude}' on node object manually") if typeof data[exclude] isnt 'undefined'
      for attr of data
        @[attr] = data[attr]
    @

  extendModel: (Model, nameOfModel = null) ->
    if typeof nameOfModel isnt 'string'
      # try to get name of constructor
      nameOfModel = Model.toString().match(/function (.{1,})\(/)?[1] or null
    if typeof nameOfModel isnt 'string'
      throw Error("Provide a name for the Model (e.g. 'Person') by using \n\t* a non-anonymous function, like `function Person()` - or - \n\t* setting the name as string in the 2nd argument")
    `
    var __extend = function(child, parent) {
      for (var key in parent) {
        if (hasProp.call(parent, key)) child[key] = parent[key];
      }

      function ctor() {
        this.constructor = child;
      }

      ctor.prototype = parent.prototype;
      child.prototype = new ctor();
      child.__super__ = parent.prototype;
      return child;
    }
    var hasProp = {}.hasOwnProperty;

    Model = function() {
      return Model.__super__.constructor.apply(this, arguments);
    }
    `
    
    Parent = if this.prototype then this.prototype.constructor else @constructor# or 
    Model = __extend(Model, Parent)
    Model.defaultLabel = nameOfModel
    Model.extendModel = GraphObject::extendModel

    return Model

GraphObject._extractNumber_ = (s) ->
  number = Number(s?.replace(/^.+?\/([0-9]+)$/,'$1'))
  if isNaN(number) then null else number

GraphObject.extendModel = GraphObject::extendModel

module.exports = GraphObject