var __initPath__ = function(Graph) {

  var helpers = null
    , _       = null

  if (typeof window === 'object') {
    // browser
    helpers = window.Neo4jMapper.helpers;
    _       = window._;
  } else {
    // nodejs
    helpers = require('./helpers')
    _       = require('underscore');
  }

  // Constructor
  var Path = function Path() {
    this.nodes = [];
    this.relationships = [];
    this.from = {
      id: null,
      uri: null
    };
    this.to = {
      id: null,
      uri: null
    };
    this.is_instanced = true;
  }

  Path.prototype.classification = 'Path'; // only needed for toObject()
  Path.prototype.from = null;
  Path.prototype.to = null;
  Path.prototype.start = null;
  Path.prototype.end = null;
  Path.prototype.length = 0;
  Path.prototype.relationships = null;
  Path.prototype.nodes = null;
  Path.prototype._response_ = null;
  Path.prototype.is_singleton = false;
  Path.prototype.is_persisted = false;
  Path.prototype.is_instanced = null;

  Path.prototype.singleton = function() {
    var path = new Path();
    path.is_singleton = true;
    return path;
  }

  /*
  [
    { start: 'http://localhost:7419/db/data/node/1019',
      nodes:
       [ 'http://localhost:7419/db/data/node/1019',
         'http://localhost:7419/db/data/node/1020',
         'http://localhost:7419/db/data/node/1021' ],
      length: 2,
      relationships:
       [ 'http://localhost:7419/db/data/relationship/315',
         'http://localhost:7419/db/data/relationship/316' ],
      end: 'http://localhost:7419/db/data/node/1021' } ]
  */
  Path.prototype.populateWithDataFromResponse = function(data) {
    // if we are working on the prototype object
    // we won't mutate it and create a new path instance insetad
    var path = (this.is_instanced !== null) ? this : new Path();
    if (data) {
      if (_.isObject(data) && (!_.isArray(data)))
        path._response_ = data;
      else
        path._response_ = data[0];

      if (_.isArray(data.nodes)) {
        for (var i=0; i < data.nodes.length; i++) {
          var url = data.nodes[i];
          if (/[0-9]+$/.test(url))
            data.nodes[i] = {
              uri: url,
              id: Number(url.match(/[0-9]+$/)[0])
            }
        }
      }

      path.nodes = _.extend(data.nodes);

      if (_.isArray(data.relationships)) {
        for (var i=0; i < data.relationships.length; i++) {
          var url = data.relationships[i];
          if (/[0-9]+$/.test(url))
            data.relationships[i] = {
              uri: url,
              id: Number(url.match(/[0-9]+$/)[0])
            }
        }
      }

      path.relationships = _.extend(data.relationships);

      path.from = {
        id: Number(data.start.match(/[0-9]+$/)[0]),
        uri: data.start
      }

      path.to = {
        id: Number(data.end.match(/[0-9]+$/)[0]),
        uri: data.end
      }

      path.start = data.start;
      path.end = data.end;
      path.length = data.length;

    }
    path.is_persisted = true;
    return path;
  }

  Path.prototype.load = function(cb) {
    cb(null, this);
  }

  Path.prototype.toObject = function() {
    return {
      classification: this.classification,
      start: this.start,
      end: this.end,
      from: _.extend(this.from),
      to: _.extend(this.to),
      relationships: _.extend(this.relationships),
      nodes: _.extend(this.nodes)
    };
  }

  Path.prototype.resetQuery = function() { return this; }

  return Path;
}

if (typeof window !== 'object') {
  module.exports = exports = {
    init: __initPath__
  };
} else {
  window.Neo4jMapper.initPath = initPath;
}