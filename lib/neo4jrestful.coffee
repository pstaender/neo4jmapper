_ = require('underscore')
request = require('request')

class Neo4jRestful

  header: {
    'Accept': 'application/json; charset=UTF-8'
    'Content-Type': 'application/json'
  }
  server: ''
  
  debug: (msg, level = 'log', color = null) ->
    def = 'reset'
    colors = require('colors') 
    levels =
      log: def
      error: 'red'
      verbose: 'green'
      warning: 'orange'
      info: 'yellow'
    if color is null
      color = levels[level] or def
    if _.isObject(msg)
      msg = JSON.stringify(msg, null, '  ')
    msg = colors[color]("[#{level}]\t==> " + msg)
    console['log'](msg)

  constructor: (options = {}) ->
    @header = _.extend(@header, options.header or {})
    @header.user ?= options.user or options.username or ''
    @header.password ?= options.password or ''
    @server = options.server

  _sortRequestArguments: (url, options = null, cb = null) ->
    if typeof options is 'function'
      cb = options
      options = {}
    if typeof url is 'string'
      options ?= {
        uri: url
      }
    throw Error("2nd or 3rd argument must be a callback to send a request") if typeof cb isnt 'function'
    {options,cb}

  _prepareURL: (url = '') ->
    # we don't change the url, if we have an absolute url
    return url if /^http(s)*\:\/\//.test(url)
    server = @server.replace(/\/+$/,'')
    url = url.replace(/^\/+/,'')
    "#{server}/#{url}"

  get: (url, options, cb) ->
    {options,cb} = @_sortRequestArguments(url, options, cb)
    options.method = 'GET'
    @request(url, options, cb)

  post: (url, options, cb) ->
    {options,cb} = @_sortRequestArguments(url, options, cb)
    options.method = 'POST'
    @request(url, options, cb)

  request: (url, options, cb) ->
    {options,cb} = @_sortRequestArguments(url, options, cb)
    if options.url
      options.uri = options.url
      delete(options.url)
    else
      options.uri = url
    options.uri = @_prepareURL(options.uri)
    options.method ?= 'GET'
    if typeof options.data is 'object'
      options.json = true
      options.body = options.data
      delete options.data
    options.method  = options.method.toUpperCase()
    options.headers = _.extend(@header, options.header or options.headers or {})
    request options, (err, res) =>
      @responseCallback(err, res, cb)

  onProcessErrorResponse: (err, res, cb) ->
    lambda = ->
      # some error occured
      full = {}
      if _.isObject(res.body)
        message = full = res.body 
      else
        try
          message = JSON.parse(res.body)
        catch e
          message = full = res.body
      message = message.message if message?.message
      e = new Error(message)
      e.statusCode = res.statusCode
      e.full = full
      cb(e, null, res)

  onProcessSuccessfullResponse: (err, res, cb) ->
    lambda = ->
      #,res?.body
      body = res?.body or null
      cb(err, body, res)
    # data = res.body
    # data = data.data[0][0] if data.columns?.length is 1
    # data

  responseCallback: (err, res, cb) ->
    return cb(err, res) if err
    if res.statusCode >= 400 and typeof @onProcessErrorResponse is 'function'
      @onProcessErrorResponse(err, res, cb)()
    else if typeof @onProcessSuccessfullResponse is 'function'
      # everything seems to be fine
      @onProcessSuccessfullResponse(err, res, cb)()
    else
      # everything seems to be fine
      # data = if typeof @processResponseBody is 'function' then @processResponseBody(res.body) else res.body
      cb(err, null, res)
    @
 
module.exports = Neo4jRestful