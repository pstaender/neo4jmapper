Neo4jRestful          = require('./neo4jrestful')
Node                  = require('./node')
Graph                 = require('./graph')
Relationship          = require('./relationship')
CypherQuery           = require('./cypherquery')
QueryBuildingHelpers  = require('./querybuildinghelpers')
ConditionalParameters = require('./conditionalparameters')

_            = require('underscore')

class Neo4jMapper

  client:               null
  Node:                 null
  Graph:                null
  Relationship:         null
  CypherQuery:          null

  constructor: (options = {}) ->
    @client                 = new Neo4jRestful(options)
    @Node                   = new Node(@client)
    @Graph                  = new Graph( @client)
    @Relationship           = new Relationship(@client)
    # @CypherQuery            = new CypherQuery()

Neo4jMapper.Node                  = Node
Neo4jMapper.Graph                 = Graph  
Neo4jMapper.Relationship          = Relationship
Neo4jMapper.CypherQuery           = CypherQuery
Neo4jMapper.QueryBuildingHelpers  = QueryBuildingHelpers
Neo4jMapper.ConditionalParameters = ConditionalParameters

module.exports = Neo4jMapper