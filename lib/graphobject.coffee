_ = require('underscore')
Debug  = require('./debug')

class GraphObject

  id: null
  _excludedDataFields_: []

  dbObject: ->

  constructor: ->
    
    # private scope
    _dbObject_ = {}
    @dbObject = (obj) ->
      if _.isObject(obj) and not _.isArray(obj)
        # setter
        _dbObject_ = obj
        @ 
      else
        # getter
        _dbObject_

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

GraphObject._extractNumber_ = (s) ->
  number = Number(s?.replace(/^.+?\/([0-9]+)$/,'$1'))
  if isNaN(number) then null else number

module.exports = GraphObject