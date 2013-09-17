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
// the browser equivalent is `./browser/browser_(header|footer).js` (will be available through `window.Neo4jMapper`)

if (typeof root.Neo4jMapper === 'undefined')
  root.Neo4jMapper = {};

module.exports = exports = function(urlOrOptions) {
  
  // Provide all necessary interfaces to use Noe4jMapper
  var Neo4jRestful = require('./neo4jrestful');
  // Create a client from given URL
  var neo4jrestful  = new Neo4jRestful(urlOrOptions);

  var Graph         = require('./graph').init(neo4jrestful);
  var Node          = require('./node').init(neo4jrestful);
  var Relationship  = require('./relationship').init(neo4jrestful);
  var Path          = require('./path').init(neo4jrestful);

  return {
    Node: Node,
    Relationship: Relationship,
    Path: Path,
    Graph: Graph,
    client: neo4jrestful,
    Neo4jRestful: Neo4jRestful,
    helpers: require('./helpers')
  };
}