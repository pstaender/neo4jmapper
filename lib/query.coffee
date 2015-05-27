_ = require('underscore')
QueryBuildingHelpers = require('./querybuildinghelpers')

class Query

  blocks: []
  parameters: {}
  blockSeperator: "\n"

  cb: null
  
  constructor: (data, parameters = {}, cb) ->
    @blocks = []
    # if new Query({ name: 'Dave' }, function(err, data) { })
    if typeof parameters is 'function'
      cb = parameters
      @setParameters({})
    else if _.isObject(parameters)
      @setParameters(parameters)
    @add(data) if typeof data is 'string'
    @cb = cb   if typeof cb is 'function' 

  start:          (data, cb) -> @add('START', data, cb)
  match:          (data, cb) -> @add('MATCH', data, cb)
  where:          (data, cb) -> @add('WHERE', data, cb)
  onMatch:        (data, cb) -> @add('ON MATCH', data, cb)
  with:           (data, cb) -> @add('WITH', data, cb)
  orderBy:        (data, cb) -> @add('ORDER BY', data, cb)
  skip:           (data, cb) -> @add('SKIP', Query.valueToString(data), cb)
  limit:          (data, cb) -> @add('LIMIT', Query.valueToString(data), cb)
  return:         (data, cb) -> @add('RETURN', data, cb)
  onCreate:       (data, cb) -> @add('ON CREATE', data, cb)
  create:         (data, cb) -> @add('CREATE', data, cb)
  createUnique:   (data, cb) -> @add('CREATE UNIQUE', data, cb)
  merge:          (data, cb) -> @add('MERGE', data, cb)
  remove:         (data, cb) -> @add('REMOVE', data, cb)
  set:            (data, cb) -> @add('SET', data, cb)
  foreach:        (data, cb) -> @add('FOREACH', data, cb)
  case:           (data, cb) -> @add('CASE', data, cb)
  delete:         (data, cb) -> @add('DELETE', data, cb)
  optionalMatch:  (data, cb) -> @add('OPTIONAL MATCH', data, cb)
  custom:         (data, cb) -> @add(data, cb)
  comment:        (data, cb) -> @add("\n// #{data.replace(/^\s*\/\/\s*/,'')}\n", cb)
  end:            (data, cb) -> @add("END", data, cb)

  toString: ->
    parts = for block in @blocks
      "#{block.name} #{@_dataToString(block.data)}"
    parts.join(@blockSeperator)

  _dataToString: (data) ->
    if typeof data is 'object' and data isnt null
      # TODO: XOR|AND…
      data = Query.flattenObject(data)
      JSON.stringify(data)
    else
      data

  addParameters: (params) ->
    @parameters = _.extend(@parameters, params)
    @

    @parameters = params if params isnt null and typeof params is 'object'
  
  setParameters: (params) -> @parameters = params

  add: (name, data, cb) ->
    if typeof data isnt 'function' and typeof data isnt 'string' and typeof data isnt 'object'
      @blocks.push({name:'', data: name})
      return @
    if typeof data is 'function'
      cb = data
      data = ''
    if typeof cb is 'function'
      @cb = cb
    throw new Error("'name' must be string, `START` for instance") unless typeof name is 'string'
    name = name.trim().toUpperCase()
    if typeof data is 'string'
      data = data.trim().replace(new RegExp("^\\s*#{name.replace(/\s+/,'\\s+')}\\s+", "i"), '')
    @blocks.push({name, data})
    @

Query.flattenObject     = QueryBuildingHelpers.flattenObject
Query.unflattenObject   = QueryBuildingHelpers.unflattenObject
Query.escapeString      = QueryBuildingHelpers.escapeString
Query.valueToString     = QueryBuildingHelpers.valueToString

module.exports = Query