// # Neo4jMapper
// **(c) 2013 by Philipp Ständer <philipp.staender@gmail.com>**
//
// *Distributed under the GNU General Public License*
//
// Neo4jMapper is an **object mapper for neo4j databases**.

var Neo4jMapper = function Neo4jMapper(urlOrOptions) {

  if (typeof window === 'object') {
    // Browser
    var Neo4jRestful  = this.Neo4jRestful  = Neo4jRestful = initNeo4jRestful(urlOrOptions);
    
    this.client = new Neo4jRestful();

    var Graph         = this.Graph         = window.Graph = initGraph(this.client);
    var Transaction   = this.Transaction   = window.Transaction = initTransaction(this.client, this.Graph);
    var Node          = this.Node          = window.Node = initNode(this.client, this.Graph);
    var Relationship  = this.Relationship  = window.Relationship = initRelationship(this.client, this.Graph, Node);
    var Path          = this.Path          = window.Path = initPath(this.client, this.Graph);

    Neo4jMapper.prototype.helpers = window.Neo4jMapper.helpers;
  } else {
    // NodeJS
    var Neo4jRestful  = this.Neo4jRestful  = require('./neo4jrestful').init(urlOrOptions);
    
    this.client = new Neo4jRestful();
    
    var Graph         = this.Graph         = require('./graph').init(this.client);
    var Transaction   = this.Transaction   = require('./transaction').init(this.client);
    var Node          = this.Node          = require('./node').init(this.client, this.Graph);
    var Relationship  = this.Relationship  = require('./relationship').init(this.client, this.Graph, Node);
    var Path          = this.Path          = require('./path').init(this.client, this.Graph);
    
    Neo4jMapper.prototype.helpers = require('./helpers');
  }

  // this method returns constructor for superordinate availability in objects of current scope
  this.client.constructorOf = function(name) {
    switch(name) {
      case 'Node':
        return Node;
      case 'Path':
        return Path;
      case 'Relationship':
        return Relationship;
      case 'Graph':
        return Graph;
      case 'Transaction':
        return Transaction;
      case 'Statement':
        return Transaction.Statement;
      default:
        return null;
    }
  }

}

Neo4jMapper.prototype.Node = null;
Neo4jMapper.prototype.Relationship = null;
Neo4jMapper.prototype.Graph = null;
Neo4jMapper.prototype.Transaction = null;
Neo4jMapper.prototype.Path = null;
Neo4jMapper.prototype.Neo4jRestful = null;
Neo4jMapper.prototype.client = null;
Neo4jMapper.prototype.helpers = null;

Neo4jMapper.init = function(urlOrOptions) {
  return new Neo4jMapper(urlOrOptions);
}

if (typeof window !== 'object') {
  module.exports = exports = Neo4jMapper;
} else {
  window.Neo4jMapper = Neo4jMapper;
}
