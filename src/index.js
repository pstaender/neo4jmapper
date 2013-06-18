module.exports = exports = function(urlOrOptions) {
  
  var Neo4jRestful = require('./neo4jrestful');

  var Graph         = require('./graph');
  var node          = require('./node');
  var relationship  = require('./relationship');
  var path          = require('./path');

  // create a new client
  var neo4jrestful = new Neo4jRestful(urlOrOptions);

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