Benchmark = require('benchmark')

url = 'http://localhost:7474'

# neo4j
neo4j  = require('neo4j')
graph  = new neo4j.GraphDatabase(url)

# neo4jmapper
neo4jmapper = require('../src')(url)
{Graph,Node,client} = neo4jmapper

randomInteger = (floor = 0, ceiling = 1) -> Math.round(Math.random()*(ceiling-floor))+floor

exports = module.exports = {graph,neo4j,neo4jmapper,Graph,Node,client,randomInteger}