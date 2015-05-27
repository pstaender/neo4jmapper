config = {
  server: "http://localhost:7000"
  user: "neo4j"
  password: "neo4j"
}

Neo4jMapper = require("../lib/")

neo4jmapper = new Neo4jMapper(config)

module.exports = neo4jmapper