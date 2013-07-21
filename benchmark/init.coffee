Benchmark = require('benchmark')

# neo4j
neo4j  = require('neo4j')
graph  = new neo4j.GraphDatabase('http://localhost:7420')

# neo4jmapper
neo4jmapper = require('../src')('http://localhost:7420')
{Graph,Node,client} = neo4jmapper

randomInteger = (floor = 0, ceiling = 1) -> Math.round(Math.random()*(ceiling-floor))+floor

exports = module.exports = {graph,neo4j,neo4jmapper,Graph,Node,client,randomInteger}