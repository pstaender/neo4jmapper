Neo4jMapper = require('../src')
{Graph,client,Node} = new Neo4jMapper('http://localhost:7420')

howMany = 500000
createdCount = 0
operating = false

createNode = ->
  return if operating
  if createdCount >= howMany
    console.log 'Done'
    return process.exit(0)
  operating = true
  n = new Node
    name: new Date()
    created_on: new Date().getTime()
    for_test: true
  m = new Node
    name: new Date()
    created_on: new Date().getTime()
    for_test: true
  n.save -> m.save -> n.createRelationshipBetween m, 'connected', ->
    operating = false
    createdCount++
    console.log("Created #{createdCount} (#{m.id}<->#{n.id})")

setInterval createNode, 10