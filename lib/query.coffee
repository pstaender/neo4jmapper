_ = require('underscore')
QueryBuildingHelpers = require('./querybuildinghelpers')

class Query

  blocks: []
  parameters: {}
  blockSeperator: "\n"
  
  constructor: (data) ->
    @blocks = []
    @parameters = {}
    if typeof 'data' is 'string'
      @start(data)
    else
      @

  start:          (data) -> @add('START', data)
  where:          (data) -> @add('WHERE', data)
  match:          (data) -> @add('MATCH', data)
  onMatch:        (data) -> @add('ON MATCH', data)
  with:           (data) -> @add('WITH', data)
  orderBy:        (data) -> @add('ORDER BY', data)
  skip:           (data) -> @add('SKIP', Query.valueToString(data))
  limit:          (data) -> @add('LIMIT', Query.valueToString(data))
  return:         (data) -> @add('RETURN', data)
  onCreate:       (data) -> @add('ON CREATE', data)
  create:         (data) -> @add('CREATE', data)
  createUnique:   (data) -> @add('CREATE UNIQUE', data)
  merge:          (data) -> @add('MERGE', data)
  remove:         (data) -> @add('REMOVE', data)
  set:            (data) -> @add('SET', data)
  foreach:        (data) -> @add('FOREACH', data)
  case:           (data) -> @add('CASE', data)
  delete:         (data) -> @add('DELETE', data)
  optionalMatch:  (data) -> @add('OPTIONAL MATCH', data)
  custom:         (data) -> @add(data)
  comment:        (data) -> @add("\n// #{data.replace(/^\s*\/\/\s*/,'')}\n", cb)
  end:            (data) -> @add("END", data)

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

  add: (name, data) ->
    if typeof data isnt 'function' and typeof data isnt 'string' and typeof data isnt 'object'
      @blocks.push({name:'', data: name})
      return @
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