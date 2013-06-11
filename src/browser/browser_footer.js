
return window.Neo4jMapper = Neo4jMapper = {
  init: function(url, options) {
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

    this.Neo4jRestful  = initNeo4jRestful();
    this.neo4jrestful  = this.client = new this.Neo4jRestful(url);
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
