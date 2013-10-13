// # Neo4jMapper
// **(c) 2013 by Philipp Ständer <philipp.staender@gmail.com>**
//
// **Distributed under the GNU General Public License**
//
// Neo4jMapper is an **object mapper for neo4j databases**.
// It's written in JavaScript and ready for server- and clientside use.
// All operations are performed asynchronously since it's using neo4j's REST api.

var Neo4jMapper = function Neo4jMapper(urlOrOptions) {

  if (typeof window === 'object') {
    // Browser
    var Neo4jRestful  = this.Neo4jRestful  = window.Neo4jMapper.initNeo4jRestful(urlOrOptions);
    
    this.client = new Neo4jRestful();

    var Transaction   = this.Transaction   = window.Neo4jMapper.initTransaction(this.client);
    var Graph         = this.Graph         = window.Neo4jMapper.initGraph(this.client);
    var Node          = this.Node          = window.Neo4jMapper.initNode(this.Graph, this.client);
    var Relationship  = this.Relationship  = window.Neo4jMapper.initRelationship(this.Graph, this.client, Node);
    var Path          = this.Path          = window.Neo4jMapper.initPath(this.Graph, this.client);

    Neo4jMapper.prototype.helpers = window.Neo4jMapper.helpers;
  } else {
    // NodeJS
    var Neo4jRestful  = this.Neo4jRestful  = require('./neo4jrestful').init(urlOrOptions);
    
    this.client = new Neo4jRestful();
    
    var Transaction   = this.Transaction   = require('./transaction').init(this.client);
    var Graph         = this.Graph         = require('./graph').init(this.client);
    var Node          = this.Node          = require('./node').init(this.Graph, this.client);
    var Relationship  = this.Relationship  = require('./relationship').init(this.Graph, this.client, Node);
    var Path          = this.Path          = require('./path').init(this.Graph, this.client);
    
    Neo4jMapper.prototype.helpers = require('./helpers');
  }

  // this method returns instanced constructor for internal usage
  this.client.constructorOf = function(name) {
    if (name === 'Node')
      return Node;
    if (name === 'Path')
      return Path;
    if (name === 'Relationship')
      return Relationship;
  }

}

Neo4jMapper.prototype.Node = null;
Neo4jMapper.prototype.Relationship = null;
Neo4jMapper.prototype.Graph = null;
Neo4jMapper.prototype.Transaction = null;
Neo4jMapper.prototype.Path = null;
Neo4jMapper.prototype.Neo4jRestful = null;
Neo4jMapper.prototype.client = null;

Neo4jMapper.init = function(urlOrOptions) {
  return new Neo4jMapper(urlOrOptions);
}

if (typeof window !== 'object') {
  module.exports = exports = Neo4jMapper;
} else {
  window.Neo4jMapper = Neo4jMapper;
}
