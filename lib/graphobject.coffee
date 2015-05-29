_ = require('underscore')

class GraphObject

  id: null

  dbObject: ->

  constructor: ->
    
    # private scope
    _dbObject_ = {}
    @dbObject = (obj) ->
      _dbObject_ = obj if _.isObject(obj) and not _.isArray(obj)
      _dbObject_

  _extractNumber_ = (s) ->
    number = Number(s?.replace(/^.+?\/([0-9]+)$/,'$1'))
    if isNaN(number) then null else number

  getID: (url = @dbObject()?.self) ->
    # self: 'http://localhost:7000/db/data/node/49'
    id = Number(url?.replace(/^.+?\/([0-9]+)$/,'$1'))
    if isNaN(id) then null else id

module.exports = GraphObject