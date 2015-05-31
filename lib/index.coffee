Neo4jRestful          = require('./neo4jrestful')
CypherQuery           = require('./cypherquery')
QueryBuildingHelpers  = require('./querybuildinghelpers')
ConditionalParameters = require('./conditionalparameters')
Debug                 = require('./debug')

Neo4jMapper = (options = {}) ->

  # check options
  
  # is Debug activatet?
  if options.debug
    Debug::defaultOutput = if typeof options.debug is 'function' then options.debug else console.error
    new Debug().log("Neo4jMapper() with url: #{options.url}", 'verbose')
  else
    Debug::defaultOutput = null


  # Instanciate restful session
  client        = new Neo4jRestful(options)
  
  # Apply restful session on classes / models
  Graph         = require('./graph')(client)
  Node          = require('./node')(Graph)
  Relationship  = require('./relationship')(Graph)

  # Let Graph work with Node and Relationship objects
  # TODO: Path object
  Graph.setNode(Node)
  Graph.setRelationship(Relationship)
  Graph.assignResponseMethods()

  return {
    Graph,
    Node,
    Relationship,
    client
  }

# "shortcut" to scope-independent classes / objects 
Neo4jMapper.CypherQuery = CypherQuery
Neo4jMapper.QueryBuildingHelpers = QueryBuildingHelpers
Neo4jMapper.ConditionalParameters = ConditionalParameters
Neo4jMapper.Debug = Debug

module.exports = Neo4jMapper