QueryBuildingHelpers = {}

QueryBuildingHelpers.escapeProperty
QueryBuildingHelpers.valueToStringForCypherQuery
QueryBuildingHelpers.cypherKeyValueToString
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