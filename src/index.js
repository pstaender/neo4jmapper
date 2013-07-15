// # Neo4jMapper
// **(c) 2013 by Philipp Ständer <philipp.staender@gmail.com>**
//
// **Distributed under the GNU General Public License**
//
// Neo4jMapper is an **object mapper for neo4j databases**.
// It's written in JavaScript and ready for server- and clientside use.
// All operations are performed asynchronously since it's using neo4j's REST api.
//
// This file is used for nodejs,
// the browser equivalent is `./browser/browser_(header|footer).js`


module.exports = exports = function(urlOrOptions) {
  
  // Provide all necessary interfaces to use Noe4jMapper
  var Neo4jRestful = require('./neo4jrestful');

  var Graph         = require('./graph');
  var node          = require('./node');
  var relationship  = require('./relationship');
  var path          = require('./path');

  // Create a client from given URL
  var neo4jrestful  = new Neo4jRestful(urlOrOptions);

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