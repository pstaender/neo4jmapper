Neo4jMapper = require('../src')
{Graph,Node} = new Neo4jMapper('http://localhost:7420')

count = 0
startedOn = new Date().getTime()
displayProgress = true

summary = (count, countAll) ->
  console.error """
    Recommend usage: coffee #{__filename} > dump.txt && vim dump.txt
  """
  console.error "#{count} (#{countAll} counted) nodes found, time: #{Math.floor( ( new Date().getTime() - startedOn ) / 100 ) / 10} [s]"

console.error "Querying all nodes… please standby…"

graph = new Graph()
graph.countNodes (err, countAll) ->
  perc = 100/countAll

  Node.findAll().each (node) ->
    if node is null
      summary(count, countAll)
    else
      count++
      if displayProgress
        console.error (Math.floor(count*perc))+"%"
      console.log node.toObject()
      

