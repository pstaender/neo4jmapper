
var __initNeo4jRestful__ = function(urlOrOptions) {

  // will be set with environment depending values below
  var helpers                    = null;
  var _                          = null;
  var jQuery                     = null;
  var Sequence                   = null;
  var JSONStream                 = null;
  var request                    = null;
  var __established_connection__ = {};    // a flag of all different db connections (differs by url)

  if (typeof window === 'object') {
    // browser
    helpers      = window.Neo4jMapper.helpers;
    _            = window._;
    jQuery       = window.jQuery;
    Sequence     = window.Sequence;
    request      = window.superagent;
  } else {
    // nodejs
    helpers      = require('./helpers');
    _            = require('underscore');
    jQuery       = null;
    Sequence     = require('./lib/sequence');
    request      = require('request');
    JSONStream   = require('JSONStream');
  }

  var ResponseError = function ResponseError(message, code) {
    var e = new Error(message);
    e.code = code;
    return e;
  }

  ResponseError.prototype.code = 0;

  // Base for QueryError and CypherQueryError
  var CustomError = function CustomError(message) {
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

  // will be used to debug request+response
  var RequestDebug = function RequestDebug(obj) {
    // apply given data to current object
    if ((typeof obj === 'object') && (obj))
      for (var key in obj)
        this[key] = obj[key];
  }

  RequestDebug.prototype.options        = null;
  RequestDebug.prototype.requested_url  = '';
  RequestDebug.prototype.method         = '';
  RequestDebug.prototype.header         = null;
  RequestDebug.prototype.res            = null;
  RequestDebug.prototype.status         = null;
  RequestDebug.prototype.err            = null;
  RequestDebug.prototype.responseTime   = null;

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
    var self = this;
    var urlPattern = /^(http(s)*)\:\/\/((.+?)\:(.+?)\@)*(.+?)(\:([0-9]+)?)\/(.+)*$/i;
    var urlMatches = null;
    if (typeof url === 'undefined') {
      // use global
      url = urlOrOptions;
    }
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
      this.urlOptions = _.defaults({
        'protocol': urlMatches[1],
        'user': urlMatches[4],
        'password': urlMatches[5],
        'domain': urlMatches[6],
        'port': urlMatches[8],
        'endpoint': urlMatches[9]
      }, this.urlOptions);
      if (this.urlOptions.endpoint) {
        // strip preceding slash(es)
        this.urlOptions.endpoint = this.urlOptions.endpoint.replace(/^\/+/, '');
      }
    } else {
      throw Error('No url found. Argument must be either an URL as string or an option object including an `.url` property.');
    }

    // we may have an error handler in options, if so, assign it to this object
    if (typeof options.onConnectionError === 'function') {
      this.onConnectionError = options.onConnectionError;
    }

    // copy header
    self.header = _.extend({}, Neo4jRestful.prototype.header);

    if (!__established_connection__[this.absoluteUrl('/')])
      self.checkAvailability();
  }

  Neo4jRestful.RequestDebug = RequestDebug;
  Neo4jRestful.CustomError  = CustomError;

  Neo4jRestful.prototype.options                    = null;
  // template for the header of each request to neo4j
  Neo4jRestful.prototype.header = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  Neo4jRestful.prototype.timeout                    = 5000;
  Neo4jRestful.prototype.exact_version              = null;
  Neo4jRestful.prototype.version                    = null;
  Neo4jRestful.prototype.ignoreExceptionPattern     = /^(Node|Relationship)NotFoundException$/; // in some case we will ignore exceptions from neo4j, e.g. not found
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
  // contains data of the response
  Neo4jRestful.prototype._response_                 = null;
  Neo4jRestful.prototype._columns_                  = null;
  Neo4jRestful.prototype._detectTypesOnColumns_     = false; // n AS `(Node)`, labels(n) AS `(Node.id)`, r AS `[Relationship]`
  Neo4jRestful.prototype._debug_                    = null;

  Neo4jRestful.prototype.query = function(cypher, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
    if (typeof cypher !== 'string') {
      throw Error('cypher argument has to be a string');
    } else {
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

  // http://docs.neo4j.org/chunked/preview/rest-api-transactional.html
  Neo4jRestful.prototype.statement = function() {
    throw Error('Not implemented, yet');
  }

  Neo4jRestful.prototype.checkAvailability = function(cb) {
    var self = this;
    this._sendHttpRequest({
      method: 'GET',
      url: self.absoluteUrl('/'),
      timeout: self.timeout
    }, function(err, res) {
        var body = (res) ? res.body : null;
        if ((typeof res !== 'undefined') && (res.status === 200)&&(body)&&(body.neo4j_version)) {
          self.exact_version = body.neo4j_version;
          self.version = Number(self.exact_version.replace(/^([0-9]+\.*[0-9]*)(.*)$/, '$1'));
          var error = (self.version < 2) ? Error('Neo4jMapper is not build+tested for neo4j version below v2') : null;
          __established_connection__[self.absoluteUrl('/')] = true;
          if (typeof cb === 'function')
            cb(error, body.neo4j_version);
        } else {
          __established_connection__[self.absoluteUrl('/')] = false;
          self.onConnectionError(Error("Can't detect neo4j… Sure neo4j service is available on "+self.absoluteUrl('/')+"? "+((err) ? '('+err.message+')' : '')), self);
        }
      }
    );
    return this;
  }

  Neo4jRestful.prototype.absoluteUrl = function(url) {
    if (typeof url !== 'string')
      url = '';
    if (!url)
      url = this.url || '/';
    if (url) {
      var baseUrl = this._connectionString();
      // strip redundant endpoints if they exists
      return baseUrl + url.replace(/^\/+/, '').replace(new RegExp('^'+this.urlOptions.endpoint.split('/').join('\\/')+'*'), '');
    }
  }

  Neo4jRestful.prototype._connectionString = function() {
    return this.urlOptions.protocol + '://'
      + String(((this.urlOptions.user)&&(this.urlOptions.password)) ? this.urlOptions.user + ':' + this.urlOptions.password+'@' : '' )
      + this.urlOptions.domain
      + ':' + this.urlOptions.port
      + '/' + this.urlOptions.endpoint;
  }

  Neo4jRestful.prototype.request = function(url, options, cb) {
    var debug = null; // debug object
    if (typeof options === 'undefined')
      options = {};

    // apply default options
    _.defaults(options, {
      method: 'GET',
      data: null,
      debug: false,
      // use copy of header, not reference
      header: _.extend({},this.header)
    });

    if (typeof url !== 'string') {

      throw Error("First argument 'url' hast to be a string");

    }

    this.url = options.url = url;
    this.header = options.header;

    var requestedUrl = this.absoluteUrl();
    var data = options.data;

    if ( (typeof data === 'object') && (data !== null) )
     data = JSON.stringify(options.data);

    // create debug object
    this._debug_ = new RequestDebug({
      options: options,
      requested_url: requestedUrl,
      method: options.method,
      data: data,
      header: this.header,
      res: null,
      status: null,
      err: null
    });

    // options for makeRequest()
    var _options_ = {
      requestedUrl: requestedUrl,
      method: options.method,
      data: data,
      options: options,
      debug: debug,
      url: url
    };

    return this._makeRequest(_options_, cb);
  }

  Neo4jRestful.prototype._makeRequest = function(_options_, cb) {
    var self = this;
    // apply default options on options
    _.defaults(_options_, {
      cache: false,
      timeout: this.timeout,
      loadNode: true // enables the load hooks
    });

    // create final options object from _options_.options
    var options = _options_.options;

    options.absolute_url = _options_.requestedUrl;
    options.url = _options_.url;
    options.method = _options_.method;
    options.data = _options_.data;

    this.log('**debug**', 'URI:', options.method+":"+options.url+" ("+options.absolute_url+")");
    this.log('**debug**', 'sendedData:', options.data);
    this.log('**debug**', 'sendedHeader:', self.header);

    this._request_on_ = new Date().getTime();

    var requestOptions = {
      method: options.method,
      url: options.absolute_url,
      header: self.header
    };

    if (options.data)
      requestOptions.data = options.data;

    // stream
    if (this.header['X-Stream'] === 'true') {

      var stream = JSONStream.parse([/^columns|data$/, true]);

      var isDataColumn = false;
      self._columns_ = [];

      stream.on('data', function(data) {
        // detect column and data array
        // { columns: [ '1', … , 'n' ], data: [ [ … ] ] }
        if (isDataColumn) {
          return cb(data);
        } else if (data) {
          if (data.constructor === Array) {
            isDataColumn = true;
            return cb(data);
          } else {
            self._columns_.push(data);
            return;
          }
        }
      });

      stream.on('end', function() {
        // prevent to pass undefined, but maybe an undefined is more clear
        cb(null, null);
      });

      stream.on('root', function(root, count) {
        self._response_on_ = new Date().getTime();
        // remove x-stream from header
        delete self.header['X-Stream'];
        if (!count) {
          cb(null, Error('No matches in stream found ('+ root +')'), self._de);
        }
      });

      requestOptions.stream = stream;

    }

    // now finally send the request
    this._sendHttpRequest(requestOptions, function(err, res) {
      self._response_ = res;
      self._response_on_ = new Date().getTime();

      self._debug_.responseTime = self.responseTime();

      if (err) {
        self.onError(cb, err, 'error', options);
      } else {
        // we might have a reponse with a failure status code
        if (res.status >= 400) {
          self.onError(cb, res.body, 'error', options);
        } else {
          if (res.body)
            self._columns_ = res.body.columns || null;
          self.onSuccess(cb, res.body, 'success', options);
        }
      }
    });

  }

  // ### Wrapper for superagent and request
  // Private method, can be indirectly 'accessed' via neo4jrestful.get|post|delete|put or neo4jrestfule.request
  Neo4jRestful.prototype._sendHttpRequest = function(options, cb) {
    _.defaults(options, {
      header: {},
      data: null,
      method: 'GET',
      timeout: null,
      stream: false
    });
    var isBrowser = Boolean(typeof window === 'object');
    if (typeof cb !== 'function')
      throw Error('Callback as 2nd argument is mandatory');
    if ((typeof options !== 'object')||(!options.url))
      cb(Error("Set { url: '…' } as argument"));
    if (isBrowser) {
      // ### superagent for browserside usage
      var req = window.superagent(options.method, options.url).set(options.header);
      if (options.data)
        req.send(options.data);
      if (options.stream) {
        return req.pipe(options.stream);
      } else {
        return req.end(function(err, res) {
          // compatibility of superagent to response api
          if (typeof res === 'object') {
            res.statusCode = res.status;
          }
          return cb(err, res);
        });
      }

    } else {
      // ### request module for nodejs
      var req = request;
      options.json = true;
      if (options.data) {
        if (typeof options.data === 'string')
          options.body = options.data;
        else
          options.json = options.data;
      }
      if (options.stream) {
        return req(options).pipe(options.stream);
      } else {
        return req(options, function(err, res) {
          // compatibility of response to superagent api
          if (typeof res === 'object') {
            res.status = res.statusCode;
          }
          return cb(err, res);
        });
      }
    }
  }

  Neo4jRestful.prototype.onProcess = function(res, cb, debug) {
    if (!res) {
      // return here if no response is present
      return cb(null, res, debug);
    } else if (_.isArray(res)) {
      for (var i=0; i < res.length; i++) {
        res[i] = this.createObjectFromResponseData(res[i]);
      }
    } else if ( (res.data) && (_.isArray(res.data)) ) {
      // iterate throught res.data rows + columns
      // an try to detect Node, Relationships + Path objects
      for (var row=0; row < res.data.length; row++) {
        for (var column=0; column < res.data[row].length; column++) {
          res.data[row][column] = this.createObjectFromResponseData(res.data[row][column]);
        }
      }

    } else if (_.isObject(res)) {
      res = this.createObjectFromResponseData(res);
    }
    cb(null, res, debug);
  }

  Neo4jRestful.prototype.onProcessStream = function(res, cb, debug) {
    if (res) {
      for (var column=0; column < res.length; column++) {
        res[column] = this.createObjectFromResponseData(res[column]);
      }
    }
    cb(null, res, debug);
  }

  Neo4jRestful.prototype.onSuccess = function(cb, res, status) {

    this._debug_.res = res;
    this._debug_.status = status;

    if (status === 'success') {
      if (typeof this.onProcess === 'function')
        return this.onProcess(res, cb, this._debug_);
      else
        return cb(null, res, this._debug_);
    } else {
      cb(res, status, this._debug_);
    }
  }

  Neo4jRestful.prototype.onError = function(cb, responseError, res, options) {
    // in some (rare) case, we get an empty {} as error
    if ( (responseError) && (typeof responseError === 'object') && (Object.keys(responseError).length === 0) ) {
      return cb(null, res.body || null, this._debug_);
    }
    var err = responseError;
    var self = this;
    var statusCode = (this._response_) ? this._response_.status : null;
    var error = ( err && err.responseText ) ? Error(err.responseText) : err;
    if (!error) {
      // TODO: code with description
      var errDescription = 'Response Error ('+this._response_.status+')';
      error = new ResponseError(errDescription, this._response_.status);
    }

    this._debug_.res = res;
    this._debug_.err = err;
    this._debug_.error = error;

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
    if ( (err) && (err.exception) && (self.ignoreExceptionPattern) && (self.ignoreExceptionPattern.test(err.exception)) ) {
      // we ignore by default notfound exceptions, because they are no "syntactical" errors
      return cb(null, null, this._debug_);
    } else {
      return cb(err || error, null, this._debug_);
    }
  }

  Neo4jRestful.prototype.stream = function(cypher, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
    this.header['X-Stream'] = 'true';
    var self = this;
    var todo = 0;
    var done = 0;

    if (typeof cypher !== 'string')
      throw Error('cypher argument has to be a string');

    return this.query(cypher, options, function(data) {
      if (data) {
        if (typeof self.onProcessStream === 'function') {
          todo++;
          self.onProcessStream(data, function(err, data) {
            if ( (data) && (data.length === 1) )
              data = data[0];
            if (done >= todo) {
              // done
              cb(data, self);
              return cb(null, self, self._debug_);
            } else {
              return cb(data, self, self._debug_);
            }
          })
        } else {
          return cb(data, self, self._debug_);
        }
      } else {
        return cb(null, self, self._debug_);
      }
    });
  }

  Neo4jRestful.prototype.get = function(url, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.method = 'GET' ) );
    return this.request(url, options, cb);
  }

  Neo4jRestful.prototype.post = function(url, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.method = 'POST' ) );
    return this.request(url, options, cb);
  }
  Neo4jRestful.prototype.put = function(url, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.method = 'PUT' ) );
    return this.request(url, options, cb);
  }

  Neo4jRestful.prototype.delete = function(url, options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.method = 'DELETE' ) );
    return this.request(url, options, cb);
  }

  Neo4jRestful.prototype.log = function(){ /* > /dev/null */ };

  Neo4jRestful.prototype.createObjectFromResponseData = function(responseData, Class) {
    if ((responseData === null) || (responseData === ''))
      return null;
    var uri = (responseData) ? responseData.self : null;
    var Node = Neo4jRestful.Node;
    var Relationship = Neo4jRestful.Relationship;
    var Path = Neo4jRestful.Path;
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
    else {
      if ((_.isNumber(responseData.length))&&(_.isString(responseData.start))) {
        // we have a path
        var p = new Path();
        p = p.populateWithDataFromResponse(responseData);
        return p;
      }
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

  Neo4jRestful.prototype.onConnectionError = function(/* err, self */) {
    // overwrite with your own function to decide what to do if no connection can be established
    /* /dev/null */
  }

  Neo4jRestful.prototype.singleton = function() {
    // creates a new instanced copy of this client
    return new Neo4jRestful(this._connectionString());
  }

  Neo4jRestful.create = function(url, options) {
    return new Neo4jRestful(url, options);
  }

  if (typeof window === 'object')
    window.Neo4jRestful = Neo4jRestful;

  return Neo4jRestful;
};

if (typeof window !== 'object') {
  // nodejs
  module.exports = exports = {
    init: __initNeo4jRestful__
  };
} else {
  window.Neo4jMapper.initNeo4jRestful = __initNeo4jRestful__;
}
