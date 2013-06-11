module.exports = exports = function(url, options) {
  
  var Neo4jRestful = require('./neo4jrestful');

  if (typeof url === 'object') {
    options = url;
  } else {
    options = {};
    if (typeof url === 'string')
      options.url = url;
  }

  url = options.url;

  if (typeof url !== 'string')
    throw Error('You need to pass an url as argument to connect to neo4j');


  var Graph         = require('./graph');
  var node          = require('./node');
  var relationship  = require('./relationship');
  var path          = require('./path');

  // create a new client
  var neo4jrestful = new Neo4jRestful(url);

  var Node          = node(neo4jrestful);
  var Relationship  = relationship(neo4jrestful);
  var Path          = path(neo4jrestful);

  return {
    Node: Node,
    Relationship: Relationship,
    Path: Path,
    Graph: Graph(neo4jrestful),
    client: neo4jrestful,
    helpers: require('./helpers')
  };
}