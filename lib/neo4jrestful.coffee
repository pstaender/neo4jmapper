_       = require('underscore')
request = require('request')
Debug   = require('./debug')

class Neo4jRestful

  header: {
    'Accept': 'application/json; charset=UTF-8'
    'Content-Type': 'application/json'
  }
  server: ''
  _request_: null
  
  constructor: (options = {}) ->
    @header = _.extend(@header, options.header or {})
    user = options.user or options.username or ''
    password = options.password or ''
    @setAuth(user, password) if user or password
    @url = require('url').parse(options.url)
    @_request_ = {}

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
    server = "#{@url.protocol}//#{@url.host}"
    url = url.replace(/^\/+/,'')
    "#{server}/#{url}"

  setAuth: (username = '', password = '') ->
    auth = "Basic " + new Buffer("#{username}:#{password}").toString('base64')
    @header.Authorization = auth
    @

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
    debug = new Debug()
      .log("sending #{options.method} to #{options.uri}", "url")
      .log("body: #{JSON.stringify(options.body, null, ' ')}", "data")
      .log("headers: #{JSON.stringify(options.headers, null, ' ')}", "data")
    @_request_.body = options.body
    @_request_.headers = options.headers
    request options, (err, res) =>
      @responseCallback(err, res, cb)

  onProcessErrorResponse: (err, res, cb) ->
    self = @
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
      e.query = self._request_.body?.query or null
      e.params = self._request_.body?.params or null
      cb(e, null, res)

  onProcessSuccessfullResponse: (err, res, cb) ->
    lambda = ->
      body = res?.body or null
      cb(err, body, res)

  responseCallback: (err, res, cb) ->
    return cb(err, res) if err
    if res.statusCode >= 400 and typeof @onProcessErrorResponse is 'function'
      @onProcessErrorResponse(err, res, cb)()
    else if typeof @onProcessSuccessfullResponse is 'function'
      # everything seems to be fine
      @onProcessSuccessfullResponse(err, res, cb)()
    else
      # everything seems to be fine
      cb(err, null, res)
    @
 
module.exports = Neo4jRestful
