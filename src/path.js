var helpers = null
  , _       = null

if (typeof window === 'object') {
  // browser
  helpers = neo4jmapper_helpers;
  _       = window._;
} else {
  // nodejs
  helpers = require('./helpers')
  _       = require('underscore');
}

// Constructor
Path = function Path(data) {
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
  this.neo4jrestful = _.extend(Path.prototype.neo4jrestful);
}

Path.prototype.classification = 'Path'; // only needed for toObject()
Path.prototype.neo4jrestful = null; // will be initialized
Path.prototype.from = null;
Path.prototype.to = null;
Path.prototype.start = null;
Path.prototype.end = null;
Path.prototype.length = 0;
Path.prototype.relationships = null;
Path.prototype.nodes = null;
Path.prototype._response = null;
Path.prototype.is_singleton = false;
Path.prototype.is_persisted = false;
Path.prototype.is_instanced = null;

Path.prototype.singleton = function() {
  var path = new Path();
  path.neo4jrestful = _.extend(Path.prototype.neo4jrestful);
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
      path._response = data;
    else
      path._response = data[0];

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

var initPath = function(neo4jrestful) {

  // Ensure that we have a Neo4jRestful client we can work with
  if ((typeof neo4jrestful !== 'undefined') && (helpers.constructorNameOfFunction(neo4jrestful) !== 'Neo4jRestful'))
    throw Error('You have to use an Neo4jRestful object as argument');

  if (typeof neo4jrestful === 'object') {
    if (typeof window === 'object') {
      // browser
      window.Neo4jMapper.Path.prototype.neo4jrestful = neo4jrestful;
      return window.Neo4jMapper.Path;
    } else {
      // nodejs
      Path.prototype.neo4jrestful = neo4jrestful;
      return Path;
    }
  }

  return Path;

}

if (typeof window !== 'object') {
  module.exports = exports = initPath;
} else {
  window.Neo4jMapper.Path = Path;
}