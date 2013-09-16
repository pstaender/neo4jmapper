var initNeo4jRestful = function() {

  "use strict";

  // will be set with environment depending values below
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
    , request             = null
    , Sequence            = null
    , JSONStream          = null;

  if (typeof window === 'object') {
    // browser
    helpers      = window.Neo4jMapper.helpers;
    node         = window.Neo4jMapper.initNode;
    path         = window.Neo4jMapper.initPath;
    relationship = window.Neo4jMapper.initRelationship;
    _            = window._;
    jQuery       = window.jQuery;
    Sequence     = window.Sequence;
    request      = window.superagent;
  } else {
    // nodejs
    helpers      = require('./helpers');
    _            = require('underscore');
    jQuery       = null;//require('jquery');
    node         = require('./node').init;
    relationship = require('./relationship').init;
    path         = require('./path').init;
    Sequence     = require('./lib/sequence');
    request      = require('superagent');
    JSONStream   = require('JSONStream');
  }

  // Base for QueryError and CypherQueryError
  var CustomError = function CustomError(message) {
    CustomError.prototype.message = '';
    CustomError.prototype.name = '';
    CustomError.prototype.exception = null;
    CustomError.prototype.cypher = null;
    CustomError.prototype.stacktrace = null;
    CustomError.prototype.statusCode = null;
    CustomError.prototype.method = null;
    CustomError.prototype.url = null;
    CustomError.prototype.data = null;
    if (typeof message === 'string')
      this.message = message;
  }

  // will be used to debug request+response
  var RequestDebug = function RequestDebug(obj) {
    RequestDebug.prototype.options        = null;
    RequestDebug.prototype.requested_url  = '';
    RequestDebug.prototype.type           = '';
    RequestDebug.prototype.data           = null;
    RequestDebug.prototype.header         = null;
    RequestDebug.prototype.res            = null;
    RequestDebug.prototype.status         = null;
    RequestDebug.prototype.err            = null;
    RequestDebug.prototype.responseTime   = null;
    // apply given data to current object
    if ((typeof obj === 'object') && (obj))
      for (var key in obj)
        this[key] = obj[key];
  }


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
  var Neo4jRestful = function Neo4jRestful(url, options) {
    var self = this
      , urlPattern = /^(http(s)*)\:\/\/((.+?)\:(.+?)\@)*(.+?)(\:([0-9]+)?)\/(.+)*$/i
      , urlMatches = null;
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
      if (!urlPattern.test(options.url)) {
        var message = "Your URL ("+url+") needs to match the default url pattern 'http(s)://(username:password@)domain(:port)/(endpoint)…'";
        throw Error(message);
      }
      // extract all parts from the given url
      // TODO: use extractet Options
      urlMatches = options.url.match(urlPattern);
      this.urlOptions = _.defaults(this.urlOptions, {
        'protocol': urlMatches[1],
        'user': urlMatches[4],
        'password': urlMatches[5],
        'domain': urlMatches[6],
        'port': urlMatches[8],
        'endpoint': urlMatches[9]
      });
      if (this.urlOptions.endpoint) {
        // strip preceding slash(es)
        this.urlOptions.endpoint = this.urlOptions.endpoint.replace(/^\/+/, '');
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
    // copy header
    self.header = _.extend({}, Neo4jRestful.prototype.header);
    self.checkAvailability(function(err, isAvailable) {
      self.connection_established = isAvailable;
    });
  }

  Neo4jRestful.prototype.options                    = null;
  // template for the header of each request to neo4j
  Neo4jRestful.prototype.header = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  Neo4jRestful.prototype.timeout                    = 5000;
  Neo4jRestful.prototype.debug                      = true; // can be deactivated but will not make any performance difference
  Neo4jRestful.prototype.exact_version              = null;
  Neo4jRestful.prototype.version                    = null;
  Neo4jRestful.prototype.ignore_exception_pattern   = /^(Node|Relationship)NotFoundException$/; // in some case we will ignore exceptions from neo4j, e.g. not found
  Neo4jRestful.prototype.urlOptions = {
    protocol: 'http',
    domain: 'localhost',
    port: 7474,
    user: '',
    password: '',
    endpoint: 'db/data/'
  };

  // is used for measurement of request-to-respond
  Neo4jRestful.prototype._request_on_               = null;
  Neo4jRestful.prototype._response_on_              = null;

  Neo4jRestful.prototype.connection_established     = false;

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
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
    if (typeof cypher === 'string') {
      this.log('**info**', 'cypher:', cypher.trim().replace(/\s+/g,' '));
      this.post('/'+this.urlOptions.endpoint+'cypher',{
        data: {
          query: cypher,
          params: options.params || {}
        }
      }, function(err, result, debug){
        return cb(err, result, debug);
      });
    }
  }

  Neo4jRestful.prototype.checkAvailability = function(cb) {
    var self = this;
    request.get(self.baseUrl+this.urlOptions.endpoint)
      .timeout(this.timeout)
      .end(function(err, res) {
        var body = (res) ? res.body : null;
        if ((typeof res !== 'undefined') && (res.status === 200)&&(body)&&(body.neo4j_version)) {
          self.exact_version = body.neo4j_version;
          self.version = Number(self.exact_version.replace(/^([0-9]+\.*[0-9]*)(.*)$/, '$1'));
          var error = (self.version < 2) ? Error('Neo4jMapper is not build+tested for neo4j version below v2') : null;
          cb(error, body.neo4j_version);
        } else {
          throw Error("Can't detect neo4j… Sure your using correct url / neo4j service is available? ("+self.baseUrl+")");
        }
      });
  }

  Neo4jRestful.prototype.absoluteUrl = function(url) {
    if (typeof url !== 'string')
      url = '';
    if (!url)
      url = this.url;
    if (url) {
      var baseUrl =
        this.urlOptions.protocol + '://'
        + String(((this.urlOptions.user)&&(this.urlOptions.password)) ? this.urlOptions.user + ':' + this.urlOptions.password+'@' : '' )
        + this.urlOptions.domain
        + ':' + this.urlOptions.port
        + '/' + this.urlOptions.endpoint;
      // strip redundant endpoints if they exists
      return baseUrl + url.replace(/^\/+/, '').replace(new RegExp('^'+this.urlOptions.endpoint.split('/').join('\\/')+'*'), '');
    }
  }

  Neo4jRestful.prototype.request = function(url, options, cb) {
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
    this.header = _.extend({}, this.header, options.header);

    if ( (typeof data === 'object') && (data !== null) )
     data = JSON.stringify(options.data);
    
    // this.log('**debug**', 'URI:', type+":"+requestedUrl);
    // this.log('**debug**', 'sendedData:', data);
    // this.log('**debug**', 'sendedHeader:', this.header);

    if (this.debug)
      options.debug = true;

    if (options.debug) {
      debug = new RequestDebug({
        options: options,
        requested_url: requestedUrl,
        type: type,
        data: data,
        header: this.header,
        res: null,
        status: null,
        err: null
      });
    }

    var _options = {
      requestedUrl: requestedUrl,
      type: type,
      data: data,
      options: options,
      debug: debug,
      url: url
    };

    return this.makeRequest(_options, cb);
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
    // in some (rare) case, we get an empty {} as error
    // e.g. 7b5ec0f0424d676adc67a477d0500c6d6a35799d:test_main.coffee:675 on initial tests
    // for now we ignore those errors until we how to deal with them
    if ( (typeof responseError === 'object') && (Object.keys(responseError).length === 0) ) {
      return cb(null, res.body || null, options._debug);
    }
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
      // jquery is an optional feature since superagent
      if (jQuery) {
        // try to extract the first <p> or <pre> from html body, else return error object for better debugging
        if (jQuery(err.responseText).find('body pre:first, body p:first')[0])
          err.responseText = jQuery(err.responseText).find('body pre:first, body p:first').first().text().trim().replace(/(\s|\n)+/g,' ');
        else if (jQuery(err.responseText).text()) {
          err.responseText = jQuery(err.responseText).text().trim();
        }
      } else {
        // remove all tags to get plain message
        // TODO: find a real jQuery replacement
        err.responseText = err.responseText.replace(/(<([^>]+)>)/ig,'').trim();
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
      return cb(err, null, options._debug);
    }
  }

  Neo4jRestful.prototype.stream = function(cypher, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
    this.header['X-Stream'] = 'true';
    var self = this;
    var todo = 0;
    var done = 0;
    return this.query(cypher, options, function(data) {
      if (data) {
        if (typeof self.onProcess === 'function') {
          todo++;
          self.onProcess(data, function(err, data) {
            if ( (data) && (data.length === 1) )
              data = data[0];
            if (done >= todo) {
              // done
              cb(data);
              cb(null);
            } else {
              cb(data);
            }
          })
        } else {
          cb(data);
        }
      } else {
        cb(null);
      }
    });
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

    var req = request(options.method, options.absolute_url).set(this.header);

    if (data) {
      req.send(data)
    }

    this.log('**debug**', 'URI:', options.method+":"+options.url);
    this.log('**debug**', 'sendedData:', data);
    this.log('**debug**', 'sendedHeader:', this.header);

    this._request_on_ = new Date().getTime();
    
    // stream
    if (this.header['X-Stream'] === 'true') {

      var stream = JSONStream.parse(['data', true]);

      stream.on('data', cb);
      stream.on('end', function() {
        // prevent to pass undefined, but maybe an undefined is more clear
        cb(null, null);
      });

      stream.on('root', function(root, count) {
        self._response_on_ = new Date().getTime();
        // remove x-stream from header
        delete self.header['X-Stream'];
        if (!count) {
          cb(null, Error('No matches in stream found ('+ root +')'));
        }
      });

      req.pipe(stream);
    }
    // or send response
    else {
      req.end(function(err, res) {
        self._response_on_ = new Date().getTime();
        if (options._debug)
          options._debug.responseTime = self.responseTime();
        if (err) {
          self.onError(cb, err, 'error', options);
        } else {
          if (res.statusType !== 2) {
            // err
            self.onError(cb, res.body, 'error', options);
          } else {
            self.onSuccess(cb, res.body, 'success', options);
          }
        }
      });
    }
  }

  Neo4jRestful.prototype.get = function(url, options, cb) {
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

  Neo4jRestful.prototype.responseTime = function() {
    if ((this._request_on_ > 0) && (this._response_on_ > 0)) {
      return this._response_on_ - this._request_on_;
    } else {
      return null;
    }
  }

  Neo4jRestful.prototype.responseTimeAsString = function() {
    var time = this.responseTime();
    if (time) {
      return Math.floor(time/10)/100 + '[s]';
    } else {
      return '';
    }
  }

  if (typeof window === 'object')
    window.Neo4jMapper.Neo4jRestful = Neo4jRestful;

  return Neo4jRestful;

};

if (typeof window !== 'object') {
  // nodejs
  module.exports = exports = initNeo4jRestful();
} else {
  window.Neo4jMapper.Neo4jRestful = initNeo4jRestful();
}
