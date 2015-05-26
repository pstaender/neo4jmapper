_ = require('underscore')

QueryBuildingHelpers = {}

QueryBuildingHelpers.escapeProperty = (identifier, delimiter = '`') ->
  return identifier
  # # do we have s.th. like ?! appending
  # appending = identifier.match(/^(.*)([\?\!]{1})$/) or ''
  # # console.log(appending)
  # if appending and appending[2]
  #   identifier = appending[1]
  #   appending = appending[2]
  # # no escaping if last char is a delimiter or ?, because we expect that the identifier is already escaped somehow
  # if new RegExp('' + delimiter + '{1}$').test(identifier)
  #   return identifier
  # # remove all delimiters `
  # identifier = identifier.replace(new RegExp(delimiter, 'g'), '')
  # if /^(.+?)\..+$/.test(identifier)
  #   identifier = identifier.replace(/^(.+?)\.(.+)$/, '$1.' + delimiter + '$2' + delimiter)
  # else
  #   identifier = delimiter + identifier + delimiter
  # identifier + appending

QueryBuildingHelpers.valueToStringForCypherQuery

QueryBuildingHelpers.cypherKeyValueToString = (key, originalValue, identifier, conditionalParametersObject) ->
  value = originalValue
  s = ''
  # string that will be returned
  if typeof conditionalParametersObject != 'object'
    conditionalParametersObject = null
  if typeof identifier == 'string'
    if /^[nmr]\./.test(key)
      key = key
    else if /[\?\!]$/.test(key)
      key = identifier + '.' + key
    else
      key = identifier + '.' + key
  key = QueryBuildingHelpers.escapeProperty(key)
  if _.isRegExp(value)
    value = valueToStringForCypherQuery(value)
    value = if conditionalParametersObject and conditionalParametersObject.valuesToParameters then (if conditionalParametersObject.addValue then conditionalParametersObject.addValue(value) else value) else '\'' + value + '\''
    s = key + ' =~ ' + value
  else
    # convert to string
    if _.isNumber(value) or _.isBoolean(value)
      value = if conditionalParametersObject and conditionalParametersObject.valuesToParameters then (if conditionalParametersObject.addValue then conditionalParametersObject.addValue(value) else value) else valueToStringForCypherQuery(value)
    else
      value = if conditionalParametersObject and conditionalParametersObject.valuesToParameters then (if conditionalParametersObject.addValue then conditionalParametersObject.addValue(value) else value) else '\'' + escapeString(value) + '\''
    s = key + ' = ' + value
  s

QueryBuildingHelpers.escapeString



QueryBuildingHelpers.subkeySeperator = '.'

QueryBuildingHelpers.flattenObject = (ob, keepNullValues = true) ->
  toReturn = {}
  for i of ob
    unless ob?.hasOwnProperty(i)
      continue
    if keepNullValues and ob[i] == null
      toReturn[i] = ob[i]
    else if typeof ob[i] == 'object'
      flatObject = QueryBuildingHelpers.flattenObject(ob[i])
      for x of flatObject
        unless flatObject.hasOwnProperty(x)
          continue
        toReturn[i + QueryBuildingHelpers.subkeySeperator + x] = flatObject[x]
    else
      toReturn[i] = ob[i]
  toReturn

QueryBuildingHelpers.escapeString = (s) ->
  return s if typeof s isnt 'string'
  #trim quotes if exists
  s = s.substr(1,s.length-2) if (/^".+"$/.test(s)) or (/^'.+'$/.test(s))
  s.replace(/^(['"]{1})/, '\\$1').replace(/([^\\]){1}(['"]{1})/g,'$1\\$2')

QueryBuildingHelpers.unflattenObject = (target, opts = {}) ->
  delimiter = opts.delimiter or QueryBuildingHelpers.subkeySeperator
  result = {}

  __getkey = (key) ->
    parsedKey = parseInt(key)
    if isNaN(parsedKey) then key else parsedKey

  if Object::toString.call(target) isnt '[object Object]'
    return target
  Object.keys(target).forEach (key) ->
    split = key.split(delimiter)
    firstNibble = undefined
    secondNibble = undefined
    recipient = result
    firstNibble = __getkey(split.shift())
    secondNibble = __getkey(split[0])
    while secondNibble != undefined
      if recipient[firstNibble] == undefined
        recipient[firstNibble] = if typeof secondNibble == 'number' then [] else {}
      recipient = recipient[firstNibble]
      if split.length > 0
        firstNibble = __getkey(split.shift())
        secondNibble = __getkey(split[0])
    # unflatten again for 'messy objects'
    recipient[firstNibble] = unflattenObject(target[key])
    return
  result

#QueryBuildingHelpers.objectToString = (value) ->


QueryBuildingHelpers.valueToString = (value) ->
    switch value
      when null  then return 'NULL'
      when true  then return 'TRUE'
      when false then return 'FALSE'
    switch typeof value
      when 'object' then return JSON.Stringify(value)
      else return String(value).trim()

module.exports = QueryBuildingHelpers