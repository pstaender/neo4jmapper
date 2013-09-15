
window.Neo4jMapper.init = function(urlOrOptions) {

  "use strict";

  var self = window.Neo4jMapper;
  
  self.Neo4jRestful  = initNeo4jRestful();
  self.neo4jrestful  = self.client = new self.Neo4jRestful(urlOrOptions);
  self.Node          = window.Neo4jMapper.initNode(self.neo4jrestful);
  self.Relationship  = window.Neo4jMapper.initRelationship(self.neo4jrestful);
  self.Graph         = window.Neo4jMapper.initGraph(self.neo4jrestful);
  self.Path          = window.Neo4jMapper.initPath(self.neo4jrestful);
  self.helpers       = window.Neo4jMapper.helpers;
  // to make it more convinient to use Neo4jMapper
  // we move Node, Relationship and Path to global scope if they are not used, yet
  return this;
}

return window.Neo4jMapper;