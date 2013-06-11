## Neo4jMapper

Neo4jMapper is a **client and server-side** object mapper for neo4j graphdatabases written in native JavaScript.

## Why?

What if working with neo4j is as easy as working with mongodb in javascript? And what if the same is true for querying nodes?

Neo4jMapper brings basic object-mapping and comfortable query building to the neo4j user - for client- and serverside.

** This is an early version; build for production in near future but not well tested in the wild, yet ** 

## How to use

```coffescript

  ## Initialization
  # Include the module
  # and instance a neo4j-db-connection

  Neo4j = require('neo4jmapper')
  {Graph,Node,Relationship}  = new Neo4j('http://localhost:7474')

  # You can make custom cypher queries

  graph = new Graph()
  graph.query """
    START n = node(*)
    MATCH n-[r]-()
    RETURN n;
  """, (err, result) ->
    console.log err, result

  ## Create nodes

  alice = new Node()
  alice.data = {
    name: 'Alice',
    nested: {
      values: 'are allowed'
    }
  }
  alice.save (err, alice) ->
    bob = new Node({ name: 'Bob' })
    bob.save (err, bob) ->

      # Connect Nodes in various kinds

      alice.createRelationshipTo bob, 'knows', { since: 'years' }, ->
        bob.createRelationshipTo alice, 'likes', { since: 'week' }, ->
          console.log(alice.toObject())
          console.log(bob.toObject())

  ## Advanced queries
  # You can query nodes (relationships may follow) easily like as usual in other Object Mappers

  alice.incomingRelationshipsFrom(bob).where({'r.since': 'years'}).limit 1, ->

  # also with more customized queries in mongodb query style

  Node::find().where(
    { $or : [
      { 'n.name': /alice/i },
      { 'n.name': /bob/i }
    ] }).skip(2).limit(10).orderBy 'n.name', 'DESC', (err, result) ->
  Node::findOne().whereNodeHasProperty('name').andWhereNode { 'city': 'berlin' },  (err, result) ->
```

## Naming conventions

The query method names are heavily inspired by mongodb and mongoose - so if you have worked with,  most of them should sound familiar:

  * find, findOne, findById, findByLabel
  * where, whereNode, whereRelationship, whereStartNode, whereEndNode, whereRelationship, andWhere, andWhereNode, …
  * whereHasProperty, whereNodeHasProperty, whereRelationshipHasProperty, …
  * limit
  * skip
  * delete

We distinct between **remove** and **delete**.
Remove always means to remove the (one) instanced node or relationship we are working with, **delete** means to perfom `DELETE` action of a query:

```coffeescript
  # Delete all nodes with the name `Bob`
  Node::find().andWhereNode({ name: "Bob"}).delete()
  # ~> 'START n = node(*)   WHERE ( HAS (n.name) ) AND ( n.name = \'Bob\' ) DELETE n;'
  Node::findOne().whereNode { name: "Bob"}, (err, bob) ->
    # Remove Bob node (if found)
    if bob
      bob.remove()
```

##  CRUD and beyond

Here are the most needed methods that can be invoked by an instanced node:

  * new Node()
  * remove, removeWithRelationships, removeAllRelationships, removeIncomingRelationship, removeOutgoingRelationships
  * save (hook: onBeforeSafe)
  * update
  * createRelationship, createRelationshipTo, createRelationshipFrom, createRelationshipBetween
  * index

## Advanced Queries

Like in mongodb you can use **AND** + **OR** operators for your where queries, also java-syntax compatible regex are supported:

```coffeescript
  Node::find().whereNode({ $or: [ { name: 'Alice'}, { name: 'Bob' }]})
  # ~> 'START n = node(*) WHERE ( ( n.name = \'Alice\' OR n.name = \'Bob\' ) ) RETURN n;'
  Node::findOne().where([ { 'city': 'Berlin' } , $and: [ { 'name': /^bob.+/i }, $not: [ { 'name': /^Bobby$/ } ] ] ])
  # ~> 'START n = node(*)   WHERE ( HAS (n.city) ) AND ( HAS (n.name) ) AND ( city = \'Berlin\' AND ( name =~ \'^(?i)bob.+\' AND NOT ( name =~ \'^Bobby$\' ) ) ) RETURN n   LIMIT 1;'
```

## Debugging

### Error messages

By default you should get clear and understandable error messages on wrong queries, e.g.:

```coffeescript
  Node::find().where "wontWork LIKE 'this'", (err) ->
    # err will output s.th. like
    # { name: 'QueryError',
    #   message: 'Unclosed parenthesis\n"START n = node(*)   WHERE ( wontWork LIKE \'this\' ) RETURN # n;"\n                                           ^',
    #   exception: 'SyntaxException',
    #   cypher: null,
    #   stacktrace:
    #    [ 'org.neo4j.cypher.internal.parser.v1_8.CypherParserImpl.parse(CypherParserImpl.scala:45)',
    #      'org.neo4j.cypher.CypherParser.parse(CypherParser.scala:42)',
    #      'org.neo4j.cypher.ExecutionEngine$$anonfun$prepare$1.apply(ExecutionEngine.scala:67)',
    #      'org.neo4j.cypher.ExecutionEngine$$anonfun$prepare$1.apply(ExecutionEngine.scala:67)',
    #      'org.neo4j.cypher.internal.LRUCache.getOrElseUpdate(LRUCache.scala:37)',
    #      'org.neo4j.cypher.ExecutionEngine.prepare(ExecutionEngine.scala:67)',
    #      'org.neo4j.cypher.ExecutionEngine.execute(ExecutionEngine.scala:59)',
    #      'org.neo4j.cypher.ExecutionEngine.execute(ExecutionEngine.scala:63)',
    #      'org.neo4j.cypher.javacompat.ExecutionEngine.execute(ExecutionEngine.java:79)',
    #      'org.neo4j.server.rest.web.CypherService.cypher(CypherService.java:67)',
    #      'java.lang.reflect.Method.invoke(Method.java:597)' ],
    #   statusCode: 400,
    #   method: 'POST',
    #   url: 'http://localhost:7474/db/data/cypher',
    #   data: '{"query":"START n = node(*)   WHERE ( wontWork LIKE \'this\' ) RETURN n;","params":{}}' }
```

### Inspect sended + received data

In case you want to inspect sended + received data and/or the process of mapping, you can set a debug flag:

```coffeescript
  # for all instanced node(s) via prototype
  Node::neo4jrestful.debug = true
  # or better for specific objects
  node = new Node()
  node.neo4jrestful.debug = true
  node.save (err, result, debug) ->
    # debug will be s.th. like:
    # { options: { type: 'POST', data: {}, no_processing: false, debug: true },
    #   requested_url: 'http://localhost:7474/db/data/node',
    #   type: 'POST',
    #   data: '{}',
    #   header:
    #    { Accept: 'application/json',
    #      'Content-Type': 'application/json' },
    #   res:
    #    { extensions: {},
    #      paged_traverse: 'http://localhost:7474/db/data/node/607/paged/traverse/{returnType}{?pageSize,leaseTime}',
    #      outgoing_relationships: 'http://localhost:7474/db/data/node/607/relationships/out',
    #      traverse: 'http://localhost:7474/db/data/node/607/traverse/{returnType}',
    #      all_typed_relationships: 'http://localhost:7474/db/data/node/607/relationships/all/{-list|&|types}',
    #      property: 'http://localhost:7474/db/data/node/607/properties/{key}',
    #      all_relationships: 'http://localhost:7474/db/data/node/607/relationships/all',
    #      self: 'http://localhost:7474/db/data/node/607',
    #      properties: 'http://localhost:7474/db/data/node/607/properties',
    #      outgoing_typed_relationships: 'http://localhost:7474/db/data/node/607/relationships/out/{-list|&|types}',
    #      incoming_relationships: 'http://localhost:7474/db/data/node/607/relationships/in',
    #      incoming_typed_relationships: 'http://localhost:7474/db/data/node/607/relationships/in/{-list|&|types}',
    #      create_relationship: 'http://localhost:7474/db/data/node/607/relationships',
    #      data: {} },
    #   status: 'success',
    #   err: null }
```

The debug object is always the third passed argument in the callback.

### Inspect generated queries

You can easiliy inspect the generated queries by invoking the `toCypherQuery()` method:

```coffeescript
  Node::find().andWhereNode({ name: "Bob"}).delete().toCypherQuery()
  # START n = node(*)   WHERE ( HAS (n.name) ) AND ( n.name = 'Bob' ) DELETE n;
```

## TODO

There are some steps to take, especially some methods for daily use are missing, yet. But the basic set of operations are already implemented and test proofed.

  * Relationship: index, findById
  * implement labels for neo4j 2.0
  * make ready for clientside use
  * complete tests

## Use on a console

For quick testing you can also use the nodejs or coffeescript console (this example is on the coffeescript console), but without the ability to make requests because you need to define callbacks for that :

```sh
  
  $ coffeescript
  
  coffee> {Graph,Node} = require('./src/index.js')('http://localhost:7474')
  { Node: [Function: Node],
  …
  coffee> Node::findOne().toCypherQuery()
  'START n = node(*)    RETURN n   LIMIT 1;'
```

## Tests

You can run tests in nodejs:

```shell
  > npm test
```

or in the browser of your choice by opening the `examples/tests.html` file.

## LICENSE

© 2013 by Philipp Staender under the GNU General Public License
See in `LICENSE` file for further details.