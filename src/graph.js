// **The Graph** respresents the database
// You can perform basic actions and queries directly on the entire graphdatabase

var global = (typeof window === 'object') ? window : root;

// Initialize the Graph object with a neo4jrestful client
var __initGraph__ = function(neo4jrestful) {

  "use strict";

  // Requirements (for browser and nodejs):
  // * neo4jmapper helpers
  // * underscorejs
  var _       = null;
  var helpers = null;

  if (typeof window === 'object') {
    helpers = window.Neo4jMapper.helpers;
    _       = window._();
  } else {
    helpers = require('./helpers');
    _       = require('underscore');
  }

  // Ensure that we have a Neo4jRestful client we can work with
  if ((typeof neo4jrestful !== 'undefined') && (helpers.constructorNameOfFunction(neo4jrestful) !== 'Neo4jRestful'))
    throw Error('You have to use an Neo4jRestful object as argument')

  // Constructor

  var Graph = function Graph(url) {
    if (url) {
      this.neo4jrestful = new this.neo4jrestful.constructor(url);
    }
    this.resetQuery();
    return this;
  }

  Graph.prototype.neo4jrestful                  = neo4jrestful;
  Graph.prototype._query_history_               = null;
  // see graph.resetQuery for initialization
  Graph.prototype.cypher = {
    query: null,           // the cypher query string
    parameters: null,      // object with paremeters
    _useParameters: true   // better performance + rollback possible (upcoming feature)
  };
  Graph.prototype._loadOnResult_                = 'node|relationship|path';
  Graph.prototype._smartResultSort_             = true; // see in graph.query() -> _increaseDone()
  Graph.prototype._nativeResults_               = false; // it's not implemented, all results are processed so far
  
  // ### Will contain the info response of the neo4j database
  Graph.prototype.info        = null;
  Graph.prototype._response_  = null; // contains the last response object
  Graph.prototype._columns_   = null;

  Graph.prototype.exec = function(query, cb) {    
    if (typeof query !== 'string') {
      cb = query;
      query = this.toCypherQuery();
    }
    if (typeof cb === 'function') { 
      this.query(query, {}, cb);
    }
    return this;
  }

  Graph.prototype.query = function(cypherQuery, options, cb) {
    var self = this;
    if (typeof cypherQuery !== 'string') {
      throw Error('First argument must be a query string');
    }
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    options.params = (typeof this.cypher._useParameters === 'boolean') ? this.cypher.parameters : {};
    options.context = self;

    this.neo4jrestful.query(cypherQuery, options, function(err, res, debug) {
      self._processResult(err, res, debug, options, function(err, res, debug) {
        // Is used by Node on performing an "update" via a cypher query
        // The result length is 1, so we remove the array
        if ((res)&&(res.length===1)&&(options.cypher)) {
          if ((options.cypher.limit === 1) || (options.cypher._update) || (typeof res[0] !== 'object')) {
            res = res[0];
          }
        }
        cb(err, res, debug);
      });
    })
    return this;
  }

  Graph.prototype._processResult = function(err, result, debug, options, cb) {
    var self = options.context;
    self._response_ = self.neo4jrestful._response_;
    self._columns_ = self.neo4jrestful._columns_;
    if (err)
      return cb(err, result, debug);
    var loadNode = /node/i.test(self._loadOnResult_)
      , loadRelationship = /relation/i.test(self._loadOnResult_)
      , loadPath = /path/i.test(self._loadOnResult_)
      , todo = 0
      , done = 0;

    // if we have the native mode, return results instantly at this point
    // TODO: to be implemented
    if (self._nativeResults_)
      // we turned off all loading hooks and no sorting -> so lets return the native result
      return cb(err, result, debug);

    // increase the number of done jobs
    // resort the results if options is activated
    // and finally invoke the cb if we are done
    var __increaseDone = function() {
      if (done+1 >= todo) {
        // all jobs are done

        // if is set to true, sort result:
        // * return only the data (columns are attached to graph._columns_)
        // * remove array if we only have one column
        // e.g. { columns: [ 'count' ], data: [ { 1 } ] } -> 1
        if (self._smartResultSort_) {
          var cleanResult = result.data;
          // remove array, if we have only one column
          if (result.columns.length === 1) {
            for (var row=0; row < cleanResult.length; row++) {
              cleanResult[row] = cleanResult[row][0];
            }
          }
          cb(err, cleanResult, debug);
        } else {
          cb(err, result, debug);
        }
      } else {
        done++;
      }
    }

    if ((!result.data)&&(result.length === 1)) {
      return cb(err, result[0], debug);
    }

    for (var row=0; row < result.data.length; row++) {
      for (var column=0; column < result.data[row].length; column++) {
        var data = result.data[row][column];
        // try to create an instance if we have an object here
        var object = ((typeof data === 'object') && (data !== null)) ? self.neo4jrestful.createObjectFromResponseData(data, options.recommendConstructor) : data;          
        result.data[row][column] = object;

        (function(object, isLastObject) {
          
          if (object) {
            if ((object.classification === 'Node') && (loadNode)) {
              todo++;
              object.load(__increaseDone);
            }
            else if ((object.classification === 'Relationship') && (loadRelationship)) {
              todo++;
              object.load(__increaseDone);
            }
            else if ((object.classification === 'Path') && (loadPath)) {
              todo++;
              object.load(__increaseDone);
            }
          }
          
          // if no loading is activated and at the last row+column, execute cb
          if ((isLastObject) && (todo === 0))
            __increaseDone();

        })(object, (row === result.data.length-1) && (column === result.data[row].length-1));
      }
    }
    if ((todo === 0) && (done === 0) && (result.data.length === 0)) {
      // empty result
      return cb(err, null, debug);
    }
  }

  // ### Shortcut for neo4jrestul.stream
  Graph.prototype.stream = function(cypherQuery, options, cb) {
    var self = this;
    var Node = neo4jrestful.constructorOf('Node');
    var recommendConstructor = (options) ? options.recommendConstructor || Node : Node;
    if (typeof cypherQuery !== 'string') {
      cb = cypherQuery;
      cypherQuery = this.toCypherQuery();
    }
    else if (typeof options === 'function') {
      cb = options;
      options = undefined;
    }
    this.neo4jrestful.stream(cypherQuery, options, function(data) {
      // neo4jrestful alerady created an object, but not with a recommend constructtr
      if ((data) && (typeof data === 'object') && (data._response_)) {
        data = self.neo4jrestful.createObjectFromResponseData(data._response_, recommendConstructor);
      }

      cb(data);
    });
    return this;
  }

  Graph.prototype.parameters = function(parameters) {
    if (typeof parameters !== 'object')
      throw Error('parameter(s) as argument must be an object, e.g. { key: "value" }')
    if (this.cypher._useParameters === null)
      this.cypher._useParameters = true;
    this.cypher.parameters = parameters;
    return this;
  }

  // ### Deletes *all* nodes and *all* relationships
  Graph.prototype.wipeDatabase = function(cb) {
    var query = "START n=node(*) MATCH n-[r?]-() DELETE n, r;";
    return this.query(query, cb);
  }

  // ### Counts all objects of a specific type: (all|node|relationship|[nr]:Movie)
  Graph.prototype.countAllOfType = function(type, cb) {
    var query = '';
    if      (/^n(ode)*$/i.test(type))
      query = "START n=node(*) RETURN count(n);"
    else if (/^r(elationship)*$/i.test(type))
      query = "START r=relationship(*) RETURN count(r);";
    else if (/^[nr]\:.+/.test(type))
      // count labels
      query = "MATCH "+type+" RETURN "+type[0]+";";
    else
      query = "START n=node(*) MATCH n-[r?]-() RETURN count(n), count(r);";
    return Graph.query(query, function(err,data){
      if ((data)&&(data.data)) {
        var count = data.data[0][0];
        if (typeof data.data[0][1] !== 'undefined')
          count += data.data[0][1];
        return cb(err, count);
      }
      cb(err,data);
    });
  }

  // ### Counts all relationships
  Graph.prototype.countRelationships = function(cb) {
    return this.countAllOfType('relationship', cb);
  }

  // alias for countRelationships()
  Graph.prototype.countRelations = function(cb) {
    return this.countRelationships(cb);
  }

  // ### Counts all nodes
  Graph.prototype.countNodes = function(cb) {
    return this.countAllOfType('node', cb);
  }

  // ### Counts all relationships and nodes
  Graph.prototype.countAll = function(cb) {
    return this.countAllOfType('all', cb);
  }

  // ### Queries information of the database and stores it on `this.info` 
  Graph.prototype.about = function(cb) {
    var self = this;
    if (this.info)
      return cb(null,info);
    else
      return this.neo4jrestful.get('/'+this.neo4jrestful.urlOptions.endpoint, function(err, info){
        if (info) {
          self.info = info
        }
        if (typeof cb === 'function')
          cb(err,info);
      });
  }

  // ### Reset the query history
  Graph.prototype.resetQuery = function() {
    this._query_history_ = [];
    this.cypher = {};
    for (var attr in Graph.prototype.cypher) {
      this.cypher[attr] = Graph.prototype.cypher[attr];
    }
    this.cypher.parameters = {};
    return this;
  }

  // ### Startpoint to begin query chaining
  // e.g. Graph.start().where( …
  Graph.prototype.start = function(start, cb) {
    this.resetQuery();
    if (typeof start !== 'string') {
      cb = start;
      start = null;
    }
    if (start)
      this._query_history_.push({ START: start });
    return this.exec(cb);
  }

  Graph.prototype.match = function(match, cb) {
    this._query_history_.push({ MATCH: match });
    return this.exec(cb);
  }

  Graph.prototype.onMatch = function(onMatch, cb) {
    this._query_history_.push({ ON_MATCH: onMatch });
    return this.exec(cb);
  }

  Graph.prototype.with = function(withStatement, cb) {
    this._query_history_.push({ WITH: withStatement });
    return this.exec(cb);
  }

  Graph.prototype.skip = function(skip, cb) {
    skip = parseInt(skip);
    if (skip === NaN)
      throw Error('SKIP must be an integer');
    this._query_history_.push({ SKIP: skip });
    return this.exec(cb);
  }

  Graph.prototype.limit = function(limit, cb) {
    limit = parseInt(limit);
    if (limit === NaN)
      throw Error('LIMIT must be an integer');
    this._query_history_.push({ LIMIT: limit });
    return this.exec(cb);
  }

  Graph.prototype.merge = function(merge, cb) {
    // TODO: values to parameter
    this._query_history_.push({ MERGE: merge });
    return this.exec(cb);
  }

  Graph.prototype.custom = function(statement, cb) {
    this._query_history_.push(statement);
    return this.exec(cb);
  }

  // will be used to send statements
  // Graph.prototype.statement = null;

  Graph.prototype.set = function(set, cb) {
    if ((typeof set === 'object')&&(set.constructor === Array)) {
      set = set.join(', ');
    }
    this._query_history_.push({ SET: set });
    return this.exec(cb);
  }

  Graph.prototype.create = function(create, cb) {
    this._query_history_.push({ CREATE: create });
    return this.exec(cb);
  }

  Graph.prototype.onCreate = function(onCreate, cb) {
    this._query_history_.push({ ON_CREATE: onCreate });
    return this.exec(cb);
  }

  Graph.prototype.createUnique = function(create, cb) {
    this._query_history_.push({ CREATE_UNIQUE: create });
    return this.exec(cb);
  }

  Graph.prototype.createIndexOn = function(createIndexOn, cb) {
    this._query_history_.push({ CREATE_INDEX_ON: createIndexOn });
    return this.exec(cb);
  }

  Graph.prototype.case = function(caseStatement, cb) {
    this._query_history_.push({ CASE: caseStatement.replace(/END\s*$/i,'') + ' END ' });
    return this.exec(cb);
  }

  Graph.prototype.dropIndexOn = function(dropIndexOn, cb) {
    this._query_history_.push({ DROP_INDEX_ON: dropIndexOn });
    return this.exec(cb);
  }

  Graph.prototype.orderBy = function(property, cb) {
    var direction = ''
      , s = '';
    if (typeof property === 'object') {
      var key = Object.keys(property)[0];
      cb = direction;
      direction = property[key];
      property = key;
      direction = ( (typeof direction === 'string') && ((/^(ASC|DESC)$/).test(direction)) ) ? direction : 'ASC';
      s = property+' '+direction;
    } else if (typeof property === 'string') {
      s = property;
    }
    this._query_history_.push({ ORDER_BY: s });
    return this.exec(cb);
  }

  Graph.prototype.where = function(where, cb) {
    if (typeof where === 'string') {
      this._query_history_.push({ WHERE: where });
      return this.exec(cb);
    }
    if (this.cypher._useParameters === null)
      this.cypher._useParameters = true;
    if (!_.isArray(where))
      where = [ where ];
    var options = { valuesToParameters: this.cypher._useParameters };
    var condition = new helpers.ConditionalParameters(where, options)
    , whereCondition = condition.toString().replace(/^\(\s(.+)\)$/, '$1');
    this._query_history_.push({ WHERE: whereCondition });
    if (this.cypher._useParameters)
      this._addParametersToCypher(condition.parameters);
    return this.exec(cb);
  }

  Graph.prototype.return = function(returnStatement, cb) {
    this._query_history_.push({ RETURN: returnStatement });
    return this.exec(cb);
  }

  Graph.prototype.returnDistinct = function(returnStatement, cb) {
    this._query_history_.push({ RETURN_DISTINCT: returnStatement });
    return this.exec(cb);
  }

  Graph.prototype.delete = function(deleteStatement, cb) {
    this._query_history_.push({ DELETE: deleteStatement });
    return this.exec(cb);
  }

  Graph.prototype.remove = function(remove, cb) {
    this._query_history_.push({ REMOVE: remove });
    return this.exec(cb);
  }

  Graph.prototype.foreach = function(foreach, cb) {
    this._query_history_.push({ FOREACH: foreach });
    return this.exec(cb);
  }

  Graph.prototype.comment = function(comment, cb) {
    this.custom(' /* '+comment.replace(/^\s*\/\*\s*/,'').replace(/\s*\*\/\s*$/,'')+' */ ');
    return this.exec(cb);
  }

  Graph.prototype.toCypherQuery = function(options) {
    var s = ''
      , chopLength = 15
      , defaultOptions = {
          niceFormat: true
        };
    if (typeof options !== 'object')
      options = {};
    else
      _.defaults(options, defaultOptions);
    for (var i=0; i < this._query_history_.length; i++) {
      var queryFragment = this._query_history_[i];
      if (typeof queryFragment === 'string') {
        // if we have just a string, we add the string to final query, no manipulation
        s += queryFragment;
        continue;
      }
      var attribute = Object.keys(this._query_history_[i])[0]
        , forQuery = this._query_history_[i][attribute];
      // remove underscore from attribute, e.g. ORDER_BY -> ORDER BY
      attribute = attribute.replace(/([A-Z]{1})\_([A-Z]{1})/g, '$1 $2');
      if (options.niceFormat) {
        // extend attribute-string with whitespace
        attribute = attribute + Array(chopLength - attribute.length).join(' ');
      }
      if (forQuery !== null)
        s += '\n'+attribute+' '+String(forQuery)+' ';
    }
    return s.trim()+';';
  }

  // # Enables loading for specific types
  // Define type(s) simply in a string
  // e.g.:
  // 'node|relationship|path' or '*' to enable load for all types
  // 'node|relationship' to enable for node + relationships
  // '' to disable for all (you can also use `disableLoading()` instead)
  Graph.prototype.enableLoading = function(classifications) {
    if (classifications === '*')
      classifications = 'node|relationship|path';
    this._loadOnResult_ = classifications;
    return this;
  }

  // # Disables loading on results (speeds up queries but less convenient)
  Graph.prototype.disableLoading = function() {
    this._loadOnResult_ = '';
    return this;
  }

  // # Sort Results
  // By default we get results like:
  // { columns: [ 'node' ], data: [ [ { nodeObject#1 } ], … [ { nodeObject#n} ]] }
  // To keep it more handy, we return just the data
  // and (if we have only 1 column) instead of [ {node} ] -> {node}
  // If you want to have access to the columns anyway, you can get them on `graph._columns_`
  Graph.prototype.sortResult = function(trueOrFalse) {
    if (typeof trueOrFalse === 'undefined')
      trueOrFalse = true;
    this._smartResultSort_ = trueOrFalse;
    return this;
  }

  Graph.prototype.enableSorting = function() {
    return this.sortResult(true);
  }

  Graph.prototype.disableSorting = function() {
    return this.sortResult(false);
  }

  Graph.prototype.enableProcessing = function() {
    this.sortResult(true);
    this.enableLoading('*');
    return this;
  }

  Graph.prototype.disableProcessing = function() {
    this.sortResult(false);
    this.disableLoading();
    return this;
  }

  Graph.prototype.log = function(){ /* > /dev/null */ };

  Graph.prototype._addParametersToCypher = function(parameters) {
    if ( (typeof parameters === 'object') && (parameters) && (parameters.constructor === Array) ) {
      if (!this.cypher.parameters)
        this.cypher.parameters = {};
      for (var i=0; i < parameters.length; i++) {
        this._addParameterToCypher(parameters[i]);
      }
    }
    return this.cypher.parameters;
  }

  Graph.prototype._addParameterToCypher = function(parameter) {
    if (typeof parameter === 'object') {
      if (!this.cypher.parameters)
        this.cypher.parameters = {};
      _.extend(this.cypher.parameters, parameter);
    } else {
      // we name the parameter with `_value#_`
      var count = Object.keys(this.cypher.parameters).length;
      this.cypher.parameters['_value'+count+'_'] = parameter;
    }
    return this.cypher.parameters;
  }

  /*
   * Static methods
   * (are shortcuts to methods on new instanced Graph())
   */
  Graph.query = function(cypher, options, cb) {
    return Graph.disable_processing().query(cypher, options, cb);
  }

  Graph.stream = function(cypher, options, cb) {
    return new Graph.disable_processing().stream(cypher, options, cb);
  }

  Graph.wipe_database = function(cb) {
    return new Graph().wipeDatabase(cb);
  }

  Graph.count_all_of_type = function(type, cb) {
    return new Graph().countAllOfType(type, cb);
  }

  Graph.count_relationships = function(cb) {
    return new Graph().countRelationships(cb);
  }

  // alias for count_relationships
  Graph.count_relations = function(cb) {
    return new Graph().countRelationships(cb);
  }
  
  Graph.count_nodes = function(cb) {
    return new Graph().countNodes(cb);
  }
  
  Graph.count_all = function(cb) {
    return new Graph().countAll(cb);
  }

  Graph.about = function(cb) {
    return new Graph().about(cb);
  }

  Graph.start = function(start, cb) {
    return Graph.enable_processing().start(start, cb);
  }

  Graph.enable_loading = function(classifications) {
    Graph.prototype.enableLoading(classifications);
    return new Graph();
  }

  Graph.disable_loading = function() {
    Graph.prototype.disableLoading();
    return new Graph();
  }

  Graph.disable_processing = function() {
    Graph.prototype.disableProcessing();
    return new Graph();
  }

  Graph.enable_processing = function() {
    Graph.prototype.enableProcessing();
    return new Graph();
  }

  Graph.enable_sorting = function() {
    Graph.prototype.enableSorting();
    return new Graph();
  }

  Graph.disable_sorting = function() {
    Graph.prototype.disableSorting(false);
    return new Graph();
  }

  Graph.request = function() {
    // creates a new neo4jrestful client
    return neo4jrestful.singleton();
  }

  Graph.__top__ = true;

  return Graph;
}

if (typeof window !== 'object') {
  module.exports = exports = {
    init: function(neo4jrestful) {
      return __initGraph__(neo4jrestful);
    }
  };
} else {
  window.Neo4jMapper.initGraph = __initGraph__;
}