var initNeo4jRestful = function() {

  // will be initialized on first construction
  var Node                = null
    , Relationship        = null
    , Path                = null
    , node                = null
    , relationship        = null
    , path                = null
    , _singleton_instance = null
    , helpers             = null
    , _                   = null
    , jQuery              = null;

  if (typeof window === 'object') {
    // browser
    helpers      = neo4jmapper_helpers;
    node         = initNode;
    path         = initPath;
    relationship = initRelationship;
    _            = window._;
    jQuery       = window.jQuery;
  } else {
    // nodejs
    helpers      = require('./helpers');
    _            = require('underscore');
    jQuery       = require('jquery');
    node         = require('./node');
    relationship = require('./relationship');
    path         = require('./path');
  }

  var QueryError = function(message, options, name) {
      this.name = (typeof name === 'string') ? name : "QueryError";
      this.message = message || '';
      if (typeof options === 'object') {
        this.exception = options.exception || null;
        this.cypher = options.cypher || null;
        this.stacktrace = options.stacktrace || null;
        this.statusCode = options.statusCode || null;
        this.method = options.method || null;
        this.url = options.url || null;
        this.data = options.data || null;
      }
  }

  var CypherQueryError = function(message, options) {
    var error = QueryError(message, options, 'CypherQueryError');
    return _.extend(this, error);
  }

  /*
   * Constructor
   */
  Neo4jRestful = function(baseUrl, options) {
    var self = this;
    if (typeof baseUrl !== 'undefined') {
      // check url
      // ensure one trailing slash
      baseUrl = baseUrl.replace(/\/*$/, '/');
      // stop here if we don't have a valid url
      if (!/http(s)*\:\/\/.+(\:[0-9]+)*\//.test(baseUrl)) {
        var message = "Your URL ("+url+") needs to match the default url pattern 'http(s)://domain(:port)/…'";
        throw Error(message);
      }
    }
    if (typeof baseUrl === 'string')
      self.baseUrl = baseUrl;
    if (typeof options === 'object')
      self.options = options;
    if (Node === null)
      Node = node(self);
    if (Relationship === null)
      Relationship = relationship(self);
    if (Path === null)
      Path = path(self);
    if (_singleton_instance === null) {
      // initially set singleton to first constructed connection
      _singleton_instance = this;
    }
    self._queue = _.extend({},Neo4jRestful.prototype._queue);

    self._queue.stack = [];
    self.checkAvailability(function(err, isAvailable, debug) {
      self.connection_established = isAvailable;
    });
    if ((!self.baseUrl)&&(_singleton_instance)) {
      // return singleton (if exists) and if no url is given
      this = _singleton_instance;
    }
  }

  Neo4jRestful.prototype.options = null;
  Neo4jRestful.prototype.header = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  Neo4jRestful.prototype.baseUrl = null;
  Neo4jRestful.prototype.debug = null;
  Neo4jRestful.prototype._absoluteUrl = null;
  Neo4jRestful.prototype.exact_version = null;
  Neo4jRestful.prototype.version = null;

  Neo4jRestful.prototype._queue = {
    stack: null, // contains all queued requests
    interval_id: null, // processes id of interval 
    is_processing: false, // flag to avoid async queue process
    ping_timeout: 10000, // to avoid endless waiting for a non available service set timeout to 10[s] by default
    started_on: null, // used for avoiding endless waiting
    max_queue_length: 63
  };

  Neo4jRestful.prototype.connection_established = false;

  Neo4jRestful.prototype.singleton = function() {
    if (_singleton_instance)
      return _singleton_instance;
    else {
      var instance = new Neo4jRestful(null);
      return instance;
    }
  }
  Neo4jRestful.prototype.set_singleton_instance = function(instance) {
    _singleton_instance = instance;
  }

  Neo4jRestful.prototype.query = function(cypher, options, cb) {
    var args;
    var self = this;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
    if (typeof cypher === 'string') {
      this.log('**info**', 'cypher:', cypher.trim().replace(/\s+/g,' '));
      this.post('/db/data/cypher',{
        data: {
          query: cypher,
          params: {}
        }
      }, function(err, result, debug){
        return cb(err, result, debug);
      });
    }
  }

  Neo4jRestful.prototype.checkAvailability = function(cb) {
    var self = this;
    var timeout = 3000;
    jQuery.ajax({
      url: self.baseUrl+'db/data/',
      type: 'GET',
      cache: false,
      timeout: timeout,
      success: function(res,status) {
        if ((status === 'success')&&(res)&&(res.neo4j_version)) {
          // store version on restfule client
          // TODO: currently it's also stored redundant in graph object -> only one version value should be used 
          self.exact_version = res.neo4j_version;
          self.version = Number(self.exact_version.replace(/^([0-9]+\.*[0-9]*)(.*)$/, '$1'));
          cb(null, res.neo4j_version);
        } else {
          cb(Error("Connection established, but can't detect neo4j database version… Sure it's neo4j url?"), null, null);
        }
      },
      error: function(err) {
        cb(err, false, err.status);
      }
    });
  }

  Neo4jRestful.prototype.absoluteUrl = function() {
    if (this.url) {
      if (/^(\/\/|http(s)*\:\/\/)/.test(this.url)) {
        // TODO: check for http or https, but would cost a extra cb
        this._absoluteUrl = this.url.replace(/^\/\//,'http://').replace(/^\//,'');
      }
      else {
        this._absoluteUrl = this.baseUrl + this.url.replace(/^\/{1}/,'');
      }
      return this._absoluteUrl;
    }
  }

  Neo4jRestful.prototype.request = function(url, options, cb) {
    var self = this;
    var debug = null;
    var defaultOptions = {
      type: 'GET',
      data: null,
      no_processing: false,
      debug: false
    };
    if (typeof options === 'undefined')
      options = _.extend({},defaultOptions);
    else
      options = _.extend(defaultOptions, options);  
    this.url = url;
    var requestedUrl = this.absoluteUrl();
    var type = options.type;
    var data = options.data;
    var label = null;
    if (options.label) {
      label = options.label;
      delete options.label;
    }
    // use copy of header, not reference
    var header = _.extend({},this.header);
    if ( (typeof data === 'object') && (data !== null) )
     data = JSON.stringify(options.data);
    this.log('**debug**', 'URI:', type+":"+requestedUrl);
    this.log('**debug**', 'sendedData:', data);
    this.log('**debug**', 'sendedHeader:', header);

    // we can set a debug flag on neo4jrestful
    // to avoid passing each time for every request a debug flag
    if (this.debug)
      options.debug = true;

    if (options.debug) {
      debug = {
        options: options,
        requested_url: requestedUrl,
        type: type,
        data: data,
        header: header,
        res: null,
        status: null,
        err: null
      };
    }

    var _options = {
      requestedUrl: requestedUrl,
      type: type,
      data: data,
      options: options,
      debug: debug,
      url: url, 
      label: label // will create an instance of the label if exists
    };

    if (!this.connection_established) {
      // add to queue
      if (self._queue.stack.length < self._queue.max_queue_length)
        self._queue.stack.push({options: _options, cb: cb});
      // start interval process
      this._processQueue(_options,cb);
    } else {
      return this.makeRequest(_options, cb);
    }
  }

  Neo4jRestful.prototype._processQueue = function() {
    var intervalTime = 50;
    var self = this;
    if (!self._queue.started_on)
      self._queue.started_on = new Date().getTime()
    // only start one interval process per connection object
    if (!self.query.interval_id) {
      // initially we have to start an interval
      // for checking constantly for an established connection
      // and send the requests
      self.query.interval_id = setInterval(function(){
        if ( (self._queue.started_on+self._queue.ping_timeout) < new Date().getTime() ) {
          // we reached the timeout
          var timeoutReachedMessage = "Timeout of "+(Math.round((self._queue.ping_timeout)/100)/10)+"[s] for neo4j '"+self.baseUrl+"' reached";
          clearInterval(self.query.interval_id);
          self.query.interval_id = null;
          throw Error(timeoutReachedMessage);
        }
        // abort here if we have a process running
        if (self._queue.is_processing)
          return null;
        // process queue only if we have a connection established
        if ((self.connection_established)&&(self._queue.stack.length > 0)) {
          var request = self._queue.stack.pop();        
          self._queue.is_processing = true;
          self.makeRequest(request.options, function(err, result, debug){
            self._queue.is_processing = false;
            request.cb(err, result, debug);
          });
          // stop interval if queue is empty
          if (self._queue.stack.length < 1) {
            clearInterval(self.query.interval_id);
            self.query.interval_id = null;
          }
        } else {
          // check constantly availability
          self._queue.is_processing = true;
          self.checkAvailability(function(err, isAvailable, debug) {
            self.connection_established = isAvailable;
            self._queue.is_processing = false;
          });
        }
        
      }, intervalTime);
    }
  }

  Neo4jRestful.prototype.makeRequest = function(_options, cb) {
    _options = _.extend({
      cache: false,
      timeout: 1000
    }, _options);
    var self = this;
    var data = _options.data;
    var options = _options.options;
    var debug = _options.debug;
    var label = _options.label || null;
    
    // use the constructor function of the label if exists
    if (label) {
      var __global__ = (typeof window !== 'undefined') ? window : root;
      label = (typeof __global__[label] === 'function') ? __global__[label] : null;
    }

    jQuery.ajax({
      url: _options.requestedUrl,
      type: _options.type,
      headers: this.header,
      data: data,
      cache: _options.cache,
      timeout: _options.timeout,
      success: function(res,status,xhr) {
        if (options.debug) {
          debug.res = res;
          debug.status = status;
        }
        if (status === 'success') {
          if (options.no_processing)
            return cb(null, res, debug);
          if (_.isArray(res)) {
            for (var i=0; i < res.length; i++) {
              res[i] = self.createObjectFromResponseData(res[i], label);
            }
          } else if (_.isObject(res)) {
            res = self.createObjectFromResponseData(res, label);
          }
          cb(null, res, debug);
        } else {
          cb(res, status, debug);
        }
      },
      error: function(err, res) {

        var error = ( err && err.responseText ) ? Error(err.responseText) : err;
        if (options.debug) {
          debug.res = res;
          debug.err = err;
          debug.error = error;
        }
        try {
          // try to extract the first <p> or <pre> from html body, else return error object for better debugging
          if (jQuery(err.responseText).find('body pre:first, body p:first')[0])
            error = new Error(jQuery(err.responseText).find('body pre:first, body p:first').text().trim());
          else if (jQuery(err.responseText).text())
            error = jQuery(err.responseText).text().trim()
          else
            error = err
          return cb(error,null, debug);
        } catch(e) {
          // try to create a valuable error object from response
          if ((err)&&(err.responseText)&&(typeof err.responseText === 'string')) {
            try {
              var result = JSON.parse(err.responseText);
              var ErrorHandler = (/^(\/)*db\/data(\/)*$/.test(_options.url)) ? CypherQueryError : QueryError;
              err = new ErrorHandler(result.message, {
                stacktrace: result.stacktrace,
                exception: result.exception,
                statusCode: err.status,
                url: _options.requestedUrl,
                method: _options.type,
                data: data
              });
            } catch (e) {
              self.log('**debug** Could not create/parse a valuable error object', e);
            }
          }
        }
        return cb(err, null, debug);
      }
    })
  }

  Neo4jRestful.prototype.get = function(url, options, cb) {
    // TODO: distinct between jquery and request module
    // shorthand, because it's copied on many methods
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.type = 'GET' ) );
    return this.request(url, options, cb);
  }

  Neo4jRestful.prototype.post = function(url, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.type = 'POST' ) );
    return this.request(url, options, cb);
  }
  Neo4jRestful.prototype.put = function(url, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.type = 'PUT' ) );
    return this.request(url, options, cb);
  }

  Neo4jRestful.prototype.delete = function(url, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.type = 'DELETE' ) );
    return this.request(url, options, cb);
  }

  Neo4jRestful.prototype.log = function(){ /* > /dev/null */ };

  Neo4jRestful.prototype.createObjectFromResponseData = function(responseData, Class) {
    var uri = (responseData) ? responseData.self : null;
    var useLabels = true;
    if (typeof Class !== 'function')
      Class = Node;
    if (uri) {
      if (/\/db\/data\/node\/[1-9]{1}[0-9]*\/*$/.test(uri)) {
        // we have a node or an inheriated class
        var n = new Class();
        n = n.populateWithDataFromResponse(responseData);
        return n;
      } else if (/\/db\/data\/relationship\/[1-9]{1}[0-9]*\/*$/.test(uri)) {
        // we have a relationship
        var r = new Relationship();
        r = r.populateWithDataFromResponse(responseData);
        return r;
      }
    }
    else
      if ((_.isNumber(responseData.length))&&(_.isString(responseData.start))) {
        // we have a path
        var p = new Path();
        p = p.populateWithDataFromResponse(responseData);
        return p;
      }
    return responseData;
  }

  return Neo4jRestful;

};

if (typeof window !== 'object') {
  // nodejs
  initNeo4jRestful();
  module.exports = exports = Neo4jRestful;
}
