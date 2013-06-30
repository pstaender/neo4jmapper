
window.Neo4jMapper.init = function(urlOrOptions) {
  this.Neo4jRestful  = initNeo4jRestful();
  this.neo4jrestful  = this.client = new this.Neo4jRestful(urlOrOptions);
  this.Node          = initNode(this.neo4jrestful);
  this.Relationship  = initRelationship(this.neo4jrestful);
  this.Graph         = initGraph(this.neo4jrestful);
  this.Path          = initPath(this.neo4jrestful);
  this.helpers       = neo4jmapper_helpers;
  // to make it more convinient to use Neo4jMapper
  // we move Node, Relationship and Path to global scope if they are not used, yet
  if (typeof window.Node === 'undefined')
    window.Node = this.Node;
  if (typeof window.Relationship === 'undefined')
    window.Relationship = this.Relationship;
  if (typeof window.Node === 'undefined')
    window.Path = this.Path;
  return this;
}

return window.Neo4jMapper;