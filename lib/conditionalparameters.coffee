QueryBuildingHelpers = require('./querybuildinghelpers')
_ = require('underscore')

class ConditionalParameters
  
  constructor: (conditions, options) ->
    # assign parameters and option(s)
    if typeof conditions == 'object'
      @conditions = if conditions then conditions else {}
    else if typeof conditions == 'string'
      @conditions = null
      @_s = '( ' + conditions + ' )'
      return
    else
      throw Error('First argument must be an object with conditional parameters or a plain string')
    if typeof options == 'object'
      @options = options
      # assign some options if they exists to current object
      if typeof @options.valuesToParameters != 'undefined'
        @valuesToParameters = @options.valuesToParameters
      if typeof @options.identifier != 'undefined'
        @identifier = @options.identifier
      if typeof @options.operator != 'undefined'
        @operator = @options.operator
    return
  
  parameterRuleset: ->
    $IN: (value) ->
      s = ''
      if typeof value == 'object' and value.length > 0
        i = 0
        while i < value.length
          value[i] = if typeof value[i] == 'string' then '\'' + QueryBuildingHelpers.escapeString(value[i]) + '\'' else QueryBuildingHelpers.valueToStringForCypherQuery(value[i])
          i++
        s = value.join(', ')
      'IN [ ' + s + ' ]'
    $in: (value) ->
      @$IN value

  addValue: (value) ->
    if !@parameters
      @parameters = {}
    property = '_value' + @parametersStartCountAt + @parametersCount() + '_'
    @parameters[property] = value
    '{' + property + '}'

  values: ->
    values = []
    for prop of @parameters
      values.push @parameters[prop]
    values

  parametersCount: ->
    if typeof @parameters != 'object' or @parameters == null
      0
    else
      Object.keys(@parameters).length

  hasParameters: ->
    @parametersCount() > 0

  cypherKeyValueToString: (key, originalValue, identifier) ->
    # call cypherKeyValueToString with this object context
    QueryBuildingHelpers.cypherKeyValueToString(key, originalValue, identifier, @)

  convert: (condition = @conditions, operator = @operator) ->
    property = null
    options = _.extend({}, @defaultOptions, @options)
    if options.firstLevel
      options.firstLevel = false
    if options.parametersStartCountAt
      @parametersStartCountAt = options.parametersStartCountAt
    # TODO: if $not : [ {name: 'a'}] ~> NOT (name = a)
    condition = [ condition ] if typeof condition is 'string' or typeof condition is 'object' and not condition.length > 0
    # AND
    if typeof condition == 'object'
      for key of condition
        value = condition[key]
        property = null
        if _.isObject(condition[key])
          properties = []
          firstKey = if _.keys(value) then _.keys(value)[0] else null
          if firstKey and ConditionalParameters.is_operator.test(firstKey)
            properties.push @convert(condition[key][firstKey], firstKey.replace(/\$/g, ' ').trim().toUpperCase(), options)
          else
            for k of condition[key]
              # k = key/property, remove identifier e.g. n.name
              property = k.replace(/^[nmrp]\./, '')
              value = condition[key][k]
              # only check for attributes if not s.th. like `n.name? = …`
              identifierWithProperty = if /\?$/.test(property) then '' else property
              if identifierWithProperty
                if options.identifier
                  identifierWithProperty = options.identifier + '.' + identifierWithProperty
                else
                  identifierWithProperty = k
                identifierWithProperty = QueryBuildingHelpers.escapeProperty(identifierWithProperty)
              hasAttribute = if identifierWithProperty then 'HAS (' + identifierWithProperty + ') AND ' else ''
              if value == k
                properties.push hasAttribute + value
                # do we have s.th. like { name: { $IN: [ … ] } }
              else if typeof value == 'object' and value != null and Object.keys(value).length == 1 and typeof @parameterRuleset[Object.keys(value)[0]] == 'function'
                properties.push hasAttribute + ' ' + (identifierWithProperty or k) + ' ' + @parameterRuleset[Object.keys(value)[0]](value[Object.keys(value)[0]])
              else
                properties.push hasAttribute + @cypherKeyValueToString(k, value, if /^[a-zA-Z\_\-]+\./.test(k) then null else options.identifier)
          # merge sub conditions
          condition[key] = properties.join(' ' + operator + ' ')
    if condition.length == 1 and options.firstLevel == false and /NOT/i.test(operator)
      operator + ' ( ' + condition.join('') + ' )'
    else
      '( ' + condition.join(' ' + operator + ' ') + ' )'

  toString: ->
    @_s = @convert() if @conditions
    @_s


  operator: 'AND'
  identifier: 'n'
  conditions: null
  # options are used to prevent overriding object attributes on recursive calls
  options: null
  defaultOptions:
    firstLevel: true
    identifier: null
  parameters: null
  valuesToParameters: true
  _s: ''
  parametersStartCountAt: 0

ConditionalParameters.is_operator = /^\$(AND|OR|XOR|NOT|AND\$NOT|OR\$NOT)$/i

module.exports = ConditionalParameters

