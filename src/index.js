// # Neo4jMapper
// **(c) 2013 by Philipp Ständer <philipp.staender@gmail.com>**
//
// *Distributed under the GNU General Public License*
//
// Neo4jMapper is an **object mapper for neo4j databases**.

var Neo4jMapper = function Neo4jMapper(urlOrOptions) {

  var _client_ = null;

  if (typeof window === 'object') {
    // Browser
    var Neo4jRestful  = this.Neo4jRestful  = window.Neo4jMapper.initNeo4jRestful(urlOrOptions);

    this.client = _client_ = new Neo4jRestful();

    this.Graph         = window.Neo4jMapper.initGraph(_client_);
    this.Transaction   = window.Neo4jMapper.initTransaction(_client_, this.Graph);
    this.Node          = window.Neo4jMapper.initNode(_client_, this.Graph);
    this.Relationship  = window.Neo4jMapper.initRelationship(_client_, this.Graph, this.Node);
    this.Path          = window.Neo4jMapper.initPath(_client_, this.Graph);

    this.helpers = window.Neo4jMapper.helpers;
    this.helpers.ConditionalParameters = window.Neo4jMapper.ConditionalParameters;
    this.helpers.CypherQuery = window.Neo4jMapper.CypherQuery;
  } else {
    // NodeJS
    var Neo4jRestful  = this.Neo4jRestful  = require('./neo4jrestful').init(urlOrOptions);

    this.client = _client_ = new Neo4jRestful();

    this.Graph         = require('./graph').init(_client_);
    this.Transaction   = require('./transaction').init(_client_);
    this.Node          = require('./node').init(_client_, this.Graph);
    this.Relationship  = require('./relationship').init(_client_, this.Graph, this.Node);
    this.Path          = require('./path').init(_client_, this.Graph);

    this.helpers = require('./helpers');
    this.helpers.ConditionalParameters = require('./conditionalparameters');
    this.helpers.CypherQuery = require('./cypherquery');
  }

  // create references among the constructors themeselves
  this.Node.Relationship          = this.Relationship;
  this.Relationship.Node          = this.Node;
  this.Neo4jRestful.Node          = this.Node;
  this.Neo4jRestful.Path          = this.Path;
  this.Neo4jRestful.Relationship  = this.Relationship;

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
