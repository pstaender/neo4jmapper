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
    , jQuery              = null
    , Sequence            = null;

  if (typeof window === 'object') {
    // browser
    helpers      = neo4jmapper_helpers;
    node         = initNode;
    path         = initPath;
    relationship = initRelationship;
    _            = window._;
    jQuery       = window.jQuery;
    Sequence     = window.Sequence;
  } else {
    // nodejs
    helpers      = require('./helpers');
    _            = require('underscore');
    jQuery       = require('jquery');
    node         = require('./node');
    relationship = require('./relationship');
    path         = require('./path');
    Sequence     = require('./lib/sequence');
  }

  // Base for QueryError and CypherQueryError
  var CustomError = function(message) {
    if (typeof message === 'string')
      this.message = message;
  }

  CustomError.prototype.message = '';
  CustomError.prototype.name = '';
  CustomError.prototype.exception = null;
  CustomError.prototype.cypher = null;
  CustomError.prototype.stacktrace = null;
  CustomError.prototype.statusCode = null;
  CustomError.prototype.method = null;
  CustomError.prototype.url = null;
  CustomError.prototype.data = null;


  var QueryError = function(message, options, name) {
    var error = new CustomError(message);
    error.name = (typeof name === 'string') ? name : "QueryError";
    if (typeof options === 'object') {
      error = _.extend(error, options);
    }
  }

  var CypherQueryError = function(message, options) {
    var error = QueryError(message, options, 'CypherQueryError');
    return _.extend(this, error);
  }

  /*
   * Constructor
   */
  Neo4jRestful = function(url, options) {
    var self = this;
    if (typeof options !== 'object') {
      options = (typeof url === 'object') ? url : {};
    }
    if (typeof url === 'string') {
      options.url = url;
    }
    if (typeof options.url === 'string') {
      // check url
      // ensure one trailing slash
      options.url = options.url.replace(/\/*$/, '/');
      // stop here if we don't have a valid url
      if (!/http(s)*\:\/\/.+(\:[0-9]+)*\//.test(options.url)) {
        var message = "Your URL ("+url+") needs to match the default url pattern 'http(s)://domain(:port)/…'";
        throw Error(message);
      }
    } else {
      throw Error('No url found. Argument must be either an URL as string or an option object including an `.url` property.');
    }

    self.baseUrl = options.url;

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
  }

  Neo4jRestful.prototype.options = null;
  Neo4jRestful.prototype.header = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  Neo4jRestful.prototype.timeout = 5000;
  Neo4jRestful.prototype.baseUrl = null;
  Neo4jRestful.prototype.debug = null;
  Neo4jRestful.prototype._absoluteUrl = null;
  Neo4jRestful.prototype.exact_version = null;
  Neo4jRestful.prototype.version = null;
  Neo4jRestful.prototype.ignore_exception_pattern = /^(Node|Relationship)NotFoundException$/;

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
    jQuery.ajax({
      url: self.baseUrl+'db/data/',
      type: 'GET',
      cache: false,
      timeout: this.timeout,
      success: function(res,status) {
        if ((status === 'success')&&(res)&&(res.neo4j_version)) {
          self.exact_version = res.neo4j_version;
          self.version = Number(self.exact_version.replace(/^([0-9]+\.*[0-9]*)(.*)$/, '$1'));
          var error = (self.version < 2) ? Error('Neo4jMapper is not build+tested for neo4j version below v2') : null;
          cb(error, res.neo4j_version);
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
        // TODO: check for http or https, but would cost a extra call
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
      debug: false,
      // use copy of header, not reference
      header: _.extend({},this.header)
    };
    if (typeof options === 'undefined')
      options = _.extend({},defaultOptions);
    else
      options = _.extend(defaultOptions, options);  
    this.url = url;
    var requestedUrl = this.absoluteUrl();
    var type = options.type;
    var data = options.data;
    var header = options.header;

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
      url: url
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

  Neo4jRestful.prototype.onProcess = function(res, next, debug) {
    if (_.isArray(res)) {
      for (var i=0; i < res.length; i++) {
        res[i] = this.createObjectFromResponseData(res[i]);
      }
    } else if (_.isObject(res)) {
      res = this.createObjectFromResponseData(res);
    }
    next(null, res, debug);
  }

  Neo4jRestful.prototype.onSuccess = function(next, res, status, options) {
    if (options.debug) {
      options._debug.res = res;
      options._debug.status = status;
    }
    if (status === 'success') {
      if (typeof this.onProcess === 'function')
        return this.onProcess(res, next, options._debug);
      else
        return next(null, res, options._debug);
    } else {
      next(res, status, options._debug);
    }
  }

  Neo4jRestful.prototype.onError = function(cb, responseError, res, options) {
    var err = responseError;
    var self = this;
    var statusCode = err.status;
    var error = ( err && err.responseText ) ? Error(err.responseText) : err;
    if (options.debug) {
      options._debug.res = res;
      options._debug.err = err;
      options._debug.error = error;
    }

    try {
      // try to extract the first <p> or <pre> from html body, else return error object for better debugging
      if (jQuery(err.responseText).find('body pre:first, body p:first')[0])
        err.responseText = jQuery(err.responseText).find('body pre:first, body p:first').first().text().trim().replace(/(\s|\n)+/g,' ');
      else if (jQuery(err.responseText).text()) {
        err.responseText = jQuery(err.responseText).text().trim();
      }
    } catch(e) {
      // ignore exception
    }
    // try to create a valuable error object from response
    if ((err)&&(err.responseText)&&(typeof err.responseText === 'string')) {
      try {
        var err = JSON.parse(err.responseText);
        var ErrorHandler = (/^(\/)*db\/data(\/)*$/.test(options.url)) ? CypherQueryError : QueryError;
        err = new ErrorHandler(err.message, {
          stacktrace: err.stacktrace,
          exception: err.exception,
          statusCode: statusCode,
          url: options.url,
          method: options.method,
          data: data
        });
      } catch (e) {
        self.log('**debug** Could not create/parse a valuable error object', e);
      }
    }
    if ( (err.exception) && (self.ignore_exception_pattern) && (self.ignore_exception_pattern.test(err.exception)) ) {
      // we ignore by default notfound exceptions, because they are no "syntactical" errors
      return cb(null, null, options._debug);
    } else {
      // console.log('(!!!')
      return cb(err, null, options._debug);
    }

  }

  Neo4jRestful.prototype.onBeforeSend = function(xhr) {
    //if (this.header['X-Stream'] === 'true')
    return null;
  }

  Neo4jRestful.prototype.makeRequest = function(_options, cb) {
    _options = _.extend({
      cache: false,
      timeout: this.timeout,
      loadNode: true // enables the load hooks
    }, _options);
    var self = this;
    var data = _options.data;
    var options = _options.options;
    options.absolute_url = _options.requestedUrl;
    options.url = _options.url;
    options.method = _options.type;
    options._debug = _options.debug;

    jQuery.ajax({
      url: options.absolute_url,
      type: options.method,
      headers: this.header,
      data: data,
      cache: _options.cache,
      timeout: _options.timeout,
      beforeSend: function(xhr) {
        self.onBeforeSend(xhr);
      },
      success: function(res,status) {
        self.onSuccess(cb, res, status, options);
      },
      error: function(err, res) {
        self.onError(cb, err, res, options);
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
      if (/\/db\/data\/node\/[0-9]+\/*$/.test(uri)) {
        // we have a node or an inheriated class
        var n = new Class();
        n = n.populateWithDataFromResponse(responseData);
        return n;
      } else if (/\/db\/data\/relationship\/[0-9]+\/*$/.test(uri)) {
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
