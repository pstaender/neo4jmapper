
return window.Neo4jMapper = Neo4jMapper = {
  init: function(urlOrOptions) {
    this.Neo4jRestful  = initNeo4jRestful();
    this.neo4jrestful  = this.client = new this.Neo4jRestful(urlOrOptions);
    this.Node          = initNode(this.neo4jrestful);
    this.Relationship  = initRelationship(this.neo4jrestful);
    this.Graph         = initGraph(this.neo4jrestful);
    this.Path          = initPath(this.neo4jrestful);
    this.helpers       = neo4jmapper_helpers;
    return this;
  },
  Neo4jRestful: null,
  neo4jrestful: null, // TODO: this is redundant /w client, check where it's needed
  Node: null,
  Relationship: null,
  Graph: null,
  Path: null,
  helpers: null,
  client: null,
}
