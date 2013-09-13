// **The Graph** respresents the database
// You can perform basic actions and queries directly on the entire graphdatabase

// Initialize the Graph object with a neo4jrestful client
var initGraph = function(neo4jrestful) {

  "use strict";

  // Requirements (for browser and nodejs):
  // * neo4jmapper helpers
  // * underscorejs
  var _       = null
    , helpers = null;

  if (typeof window === 'object') {
    helpers = neo4jmapper_helpers;
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
  }

  Graph.prototype.neo4jrestful = neo4jrestful;

  // Will contain the info response of the neo4j database
  Graph.prototype.info = null;

  // Shortcut for neo4jrestul.query
  Graph.prototype.query = function(cypher, options, cb) {
    return this.neo4jrestful.query(cypher,options,cb);
  }

  // Shortcut for neo4jrestul.stream
  Graph.prototype.stream = function(cypher, options, cb) {
    return this.neo4jrestful.stream(cypher,options,cb);
  }

  // Deletes *all* nodes and *all* relationships
  Graph.prototype.wipeDatabase = function(cb) {
    var query = "START n=node(*) MATCH n-[r?]-() DELETE n, r;";
    return this.query(query,cb);
  }

  // Counts all objects of a specific type: (all|node|relationship|[nr]:Movie)
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

  // Counts all relationships
  Graph.prototype.countRelationships = function(cb) {
    return this.countAllOfType('relationship', cb);
  }

  // Counts all nodes
  Graph.prototype.countNodes = function(cb) {
    return this.countAllOfType('node', cb);
  }

  // Counts all relationships and nodes
  Graph.prototype.countAll = function(cb) {
    return this.countAllOfType('all', cb);
  }

  // Queries information of the database and stores it on `this.info` 
  Graph.prototype.about = function(cb) {
    var self = this;
    if (this.info)
      return cb(null,info);
    else
      return this.neo4jrestful.get('/db/data/', function(err, info){
        if (info) {
          self.info = info
        }
        if (typeof cb === 'function')
          cb(err,info);
      });
  }

  Graph.prototype.log = function(){ /* > /dev/null */ };

  if (typeof window === 'object')
    window.Neo4jMapper.Graph = Graph;

  return Graph;
}

if (typeof window !== 'object') {
  // nodejs
  module.exports = exports = function(neo4jrestful) {
    return initGraph(neo4jrestful);
  }
}