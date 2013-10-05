// **The Graph** respresents the database
// You can perform basic actions and queries directly on the entire graphdatabase

var global = (typeof window === 'object') ? window : root;

// Initialize the Graph object with a neo4jrestful client
var initGraph = function(neo4jrestful) {

  "use strict";

  // Requirements (for browser and nodejs):
  // * neo4jmapper helpers
  // * underscorejs
  var _       = null
    , helpers = null;

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

  var Graph = global.Neo4jMapper.Graph = function Graph(url) {
    if (url) {
      this.neo4jrestful = new this.neo4jrestful.constructor(url);
    }
    this.resetQuery();
  }

  Graph.prototype.neo4jrestful                  = neo4jrestful;
  Graph.prototype._query_history_               = null;
  // see graph.resetQuery for initialization
  Graph.prototype.cypher = {
    query: null,           // the cypher query string
    parameters: null,      // array with paremeters
    _useParameters: false  // better performance + rollback possible (upcoming feature)
  };
  Graph.prototype._addParametersToCypher        = Node.prototype._addParametersToCypher;

  // ### Will contain the info response of the neo4j database
  Graph.prototype.info = null;

  Graph.prototype.exec = function(cypherQuery, cb) {
    if (typeof cypherQuery !== 'string') {
      cb = cypherQuery;
      cypherQuery = this.cypherQuery;
    }
    if (typeof cb === 'function') {
      this.query(cypherQuery, cb);
    }
    return this;
  }

  // ### Shortcut for neo4jrestul.query
  Graph.prototype.query = function(cypher, options, cb) {
    this.cypherQuery = cypher;
    return this.neo4jrestful.query(cypher, options, cb);
  }

  // ### Shortcut for neo4jrestul.stream
  Graph.prototype.stream = function(cypherQuery, options, cb) {
    if (typeof cypherQuery === 'string') {
      this.cypherQuery = cypherQuery;
    } else {
      cb = options;
      options = cypherQuery;
      cypherQuery = this.cypherQuery;
    }
    return this.neo4jrestful.stream(cypherQuery, options, cb);
  }

  // ### Deletes *all* nodes and *all* relationships
  Graph.prototype.wipeDatabase = function(cb) {
    var query = "START n=node(*) MATCH n-[r?]-() DELETE n, r;";
    return this.query(query,cb);
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
    return this.query(query,function(err,data){
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
    _.extend(this.cypher, Graph.prototype.cypher);
    this.cypher.parameters = [];
    return this;
  }

  /*
    [START]
    [MATCH]
    [WHERE]
    [WITH [ORDER BY] [SKIP] [LIMIT]]
    RETURN [ORDER BY] [SKIP] [LIMIT]
  */

  // ### Startpoint to begin query chaining
  // e.g. Graph.start().where( …
  Graph.prototype.start = function(start, cb) {
    this.resetQuery();
    if (typeof start !== 'string') {
      cb = start;
      start = null;
    }
    this._query_history_.push({ START: start });
    return this.exec(cb);
  }

  Graph.prototype.match = function(match, cb) {
    this._query_history_.push({ MATCH: match });
    return this.exec(cb);
  }

  Graph.prototype.with = function(withStatement, cb) {
    this._query_history_.push({ WITH: withStatement });
    return this.exec(cb);
  }

  Graph.prototype.skip = function(skip, cb) {
    skip = parseInt(skip);
    if (!skip)
      throw Error('SKIP must be an integer');
    this._query_history_.push({ SKIP: skip });
    return this.exec(cb);
  }

  Graph.prototype.limit = function(limit, cb) {
    limit = parseInt(limit);
    if (!limit)
      throw Error('LIMIT must be an integer');
    this._query_history_.push({ LIMIT: limit });
    return this.exec(cb);
  }

  Graph.prototype.orderBy = function(property, cb) {
    var direction = '';
    if (typeof property === 'object') {
      var key = Object.keys(property)[0];
      cb = direction;
      direction = property[key];
      property = key;
      direction = ( (typeof direction === 'string') && ((/^(ASC|DESC)$/).test(direction)) ) ? direction : 'ASC';
    } else if (typeof property === 'string') {
      direction = property;
    }
    this._query_history_.push({ ORDER_BY: property+' '+direction });
    return this.exec(cb);
  }

  Graph.prototype.where = function(where, cb) {
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

  Graph.prototype.delete = function(deleteStatement, cb) {
    this._query_history_.push({ DELETE: deleteStatement });
    return this.exec(cb);
  }

  Graph.prototype.toCypherQuery = function(options) {
    var s = ''
      , defaultOptions = {
        niceFormat: true
      };
    if (typeof options !== 'object')
      options = defaultOptions;
    else
      _.defaults(options, defaultOptions);
    for (var i=0; i < this._query_history_.length; i++) {
      var queryFragment = this._query_history_[i]
        , attribute = Object.keys(this._query_history_[i])[0]
        , forQuery = this._query_history_[i][attribute];
      // remove underscore from attribute, e.g. ORDER_BY -> ORDER BY
      attribute = attribute.replace(/([A-Z]{1})\_([A-Z]{1})/g, '$1 $2');
      if (options.niceFormat) {
        // extend attribute-string with whitespace
        attribute = attribute + Array(10 - attribute.length).join(' ');
      }
      if (forQuery !== null)
        s += '\n'+attribute+' '+String(forQuery);
    }
    return s+';';
  }

  Graph.prototype.log = function(){ /* > /dev/null */ };

  /*
   * Static methods
   * (are shortcuts to methods on new instanced Graph())
   */
  Graph.query = function(cypher, options, cb) {
    return new Graph().query(cypher, options, cb);
  }

  Graph.stream = function(cypher, options, cb) {
    return new Graph().stream(cypher, options, cb);
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
    return new Graph().start(start, cb);
  }

  return Graph;
}

if (typeof window !== 'object') {
  module.exports = exports = {
    Graph: null,
    init: function(neo4jrestful) {
      return exports.Graph = initGraph(neo4jrestful);
    }
  };
} else {
  window.Neo4jMapper.initGraph = initGraph;
}