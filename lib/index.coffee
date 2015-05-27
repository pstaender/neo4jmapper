Neo4jRestful          = require('./neo4jrestful')
Node                  = require('./node')
Graph                 = require('./graph')
Relationship          = require('./relationship')
CypherQuery           = require('./cypherquery')
QueryBuildingHelpers  = require('./querybuildinghelpers')
ConditionalParameters = require('./conditionalparameters')

_            = require('underscore')

class Neo4jMapper

  client:                null
  Node:                  null
  Graph:                 null
  Relationship:          null
  CypherQuery:           null
  ConditionalParameters: null
  QueryBuildingHelpers:  null

  constructor: (options = {}) ->
    # # Instanciate restful session
    @client                 = new Neo4jRestful(options)
    # apply restful session on models

    @Graph                  = new Graph().setClient(@client)
    @Node                   = new Node().setGraph(@Graph)

    # @Relationship           = new Relationship(@client)


    #@Node.Graph = Graph
    #@Relationship.Graph = Graph
    
    # this is just a shorthand to make other methods easy available
    # on the created Neo4jMapper instance
    # You could also access them via Neo4jMapper.CypherQuery for instance
    @CypherQuery            = CypherQuery
    @QueryBuildingHelpers   = QueryBuildingHelpers
    @ConditionalParameters  = ConditionalParameters

Neo4jMapper.Node                  = Node
Neo4jMapper.Graph                 = Graph  
Neo4jMapper.Relationship          = Relationship
Neo4jMapper.CypherQuery           = CypherQuery
Neo4jMapper.QueryBuildingHelpers  = QueryBuildingHelpers
Neo4jMapper.ConditionalParameters = ConditionalParameters

module.exports = Neo4jMapper