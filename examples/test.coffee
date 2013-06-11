{Graph,Node,client}  = new require('../src')('http://localhost:7474/')
# for specific objects
Node::neo4jrestful.debug = true
node = new Node()
# node.neo4jrestful.debug = true
node.save (err, result, debug) ->
  console.log debug