_ = require('underscore')
request = require('request')

class Neo4jRestful

  header: {
    'Accept': 'application/json; charset=UTF-8'
    'Content-Type': 'application/json'
  }
  server: ''
  #credentials: {}

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

  _prepareURL: (url) ->
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
    request options, (err, res) ->
      return cb(err, res) if err
      if res.statusCode >= 400

        try
          # console.log(res.body)
          body = JSON.parse(res.body)
          errors = for error in body.errors
            e = new Error(error.message)
            e.message = error.message
            e.code = error.code
            e.statusCode = res.statusCode
            e
        catch e
          e = new Error("Unknown Error (#{res.statusCode})")
          e.message = res.body
          e.statusCode = res.statusCode
          errors = [ e ]
        
        errors = errors[0] if errors.length is 1
        
        return cb(errors, res)
      else
        return cb(err, res)

module.exports = Neo4jRestful