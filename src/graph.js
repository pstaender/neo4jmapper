var initGraph = function(neo4jrestful) {

  var _       = null
    , helpers = null;

  if (typeof window === 'object') {
    helpers = neo4jmapper_helpers;
    _       = window._();
  } else {
    helpers = require('./helpers');
    _       = require('underscore');
  }

  /*
   * Constructor
   */
  Graph = function() {
    // this.about();
  }

  Graph.prototype.info = null;

  /*
   * Shorthands for neo4jrestul.*
   */
  Graph.prototype.query = function(cypher, options, cb) {
    return neo4jrestful.query(cypher,options,cb);
  }

  Graph.prototype.stream = function(cypher, options, cb) {
    return neo4jrestful.stream(cypher,options,cb);
  }

  /*
   * Delete *all* nodes and *all* relationships
   */ 
  Graph.prototype.wipeDatabase = function(cb) {
    var query = "START n=node(*) MATCH n-[r?]-() DELETE n, r;";
    return this.query(query,cb);
  }

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

  Graph.prototype.countRelationships = function(cb) {
    return this.countAllOfType('relationship', cb);
  }

  Graph.prototype.countNodes = function(cb) {
    return this.countAllOfType('node', cb);
  }

  Graph.prototype.countAll = function(cb) {
    return this.countAllOfType('all', cb);
  }

  Graph.prototype.about = function(cb) {
    var self = this;
    if (this.info)
      return cb(null,info);
    else
      return neo4jrestful.get('/db/data/', function(err, info){
        if (info) {
          self.info = info
        }
        if (typeof cb === 'function')
          cb(err,info);
      });
  }

  Graph.prototype.log = function(){ /* > /dev/null */ };

  return Graph;
}

if (typeof window !== 'object') {
  // nodejs
  module.exports = exports = function(neo4jrestful) {
    return initGraph(neo4jrestful);
  }
}