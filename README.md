# Neo4jMapper

[![Build Status](https://api.travis-ci.org/pstaender/neo4jmapper.png)](https://travis-ci.org/pstaender/neo4jmapper)

Neo4jMapper is an **object mapper for neo4j databases**. It's written in JavaScript and ready for server- and clientside use.

## Why another neo4j client?

What if working with neo4j feels natively and familiar as working with mongodb in javascript?

And what if the same applies to building query for Nodes and Relationships?

Neo4jMapper brings basic object-mapping and comfortable query building for the daily neo4j usage.

**Neo4jMapper is currently Beta - api may change a bit for better usage - and works exclusively with Neo4j v2+** - there will be no support for earlier versions  because the label feature is essential for the mapping.

## How to use

To reduce code, the following examples are written in CoffeeScript. But neo4jmapper is also designed for pure JavaScript usage.

### Installation

```sh
  $ npm install neo4jmapper
```

### Include files and establish db connection

```coffeescript
  Neo4j = require('neo4jmapper')
  {Graph,Node,Relationship}  = new Neo4j('http://localhost:7474')
```

### Cypher queries

Use the full power of the cypher query language:

```coffeescript
  graph = new Graph()
  graph.query """
    START n = node(*)
    MATCH n-[r]-()
    RETURN n;
  """, (err, result) ->
    console.log err, result
```

### Create and save nodes

```coffeescript
  alice = new Node()
  alice.data = {
    name: 'Alice',
    nested: {
      values: 'are allowed, but not recommend'
    }
    arrays: [ 'are', 'allowed', 'but', 'also', 'non-recommend']
  }
  alice.save (err, alice) ->
    alice.toObject()
```

or by shorthand

```coffeescript
  new Node({ name: 'Bob' }).save (err, bob) ->
    bob.toObject()
```

### Classes and Models

Since JavaScript has no classes, you must extend the `Node` object with your own constructor or extend with the `label` and `constructor_name` attributes, so that neo4jmapper can detect a name for your model. Alternatively you can create a Node object and set the `label` attribute with your model name each time you need it.

Every defined model will enjoy the label feature of neo4j by default. 

```coffeescript
  # coffeescript and it`s class pattern
  # is the most convenient way to define models

  class Person extends Node
    fullname: ->
      s = @firstName + " " + @surname
      s.trim()

  # optional but strongly recommend
  # so that neo4jmapper can instantiate found labeled nodes with the respective model/constructor
  Node::register_model(Person)

  alice = new Person firstName: 'Alice', surname: 'Springs'
  alice.fullname()
  ~> 'Alice Springs'
  alice.save ->
    alice.label
    ~> 'Person'
    
```

To extend the Node object in JavaScript you have to use an extend method (here I choosed the underscore `_.extend` method), but similar methods should work as well. The example demonstrates how to define a model (same as above) in JavaScript:

```js
  var Movie = (function(Node) {

  function Movie(data, id) {
    // this is necessary to give the constructed node a name context
    this.init.apply(this, arguments);
  }

    _.extend(Movie.prototype, Node.prototype);

    Movie.prototype.fields = {
      defaults: {
        genre: 'Blockbuster'
      }
    };
    
    return Movie;
  })(Node);

  Node.prototype.register_model(Movie);

  pulpFiction = new Movie({
    title: 'Pulp Fiction' 
  });

  pulpFiction.data.director = 'Quentin Tarantino';
  pulpFiction.data.year = 1994;
  pulpFiction.save(function(err,movie){
    console.log('Label: ', movie.label);
    console.log('Created movie: ', movie.toObject());
  });
```

### Connect Nodes in various kinds

```coffeescript
  alice.createRelationshipTo bob, 'knows', { since: 'years' }, ->
    bob.createRelationshipTo alice, 'likes', { since: 'week' }, ->
      console.log(alice.toObject())
      console.log(bob.toObject())
```

### Advanced queries

You can query nodes (relationships may follow) easily like as usual in other Object Mappers

```coffeescript
  alice.incomingRelationshipsFrom(bob).where({'r.since': 'years'}).limit 1, ->
```

Also with more customized queries in mongodb query style

```coffeescript
  Node::find().where(
    { $or : [
      { 'n.name': /alice/i },
      { 'n.name': /bob/i }
    ] }
  ).skip(2).limit(10).orderBy 'n.name', 'DESC', (err, result) ->
```

```coffeescript
  Node::findOne().whereNodeHasProperty('name').andWhereNode { 'city': 'berlin' },  (err, result) ->
```

## Naming conventions

The query method names are heavily inspired by mongodb and mongoose - so most of them should sound familiar in case you have worked with them:

  * find, findOne, findById, findByUniqueKeyValue
  * where, whereNode, whereRelationship, whereStartNode, whereEndNode, whereRelationship, andWhere, andWhereNode, …
  * whereHasProperty, whereNodeHasProperty, whereRelationshipHasProperty, …
  * match
  * limit
  * skip
  * delete
  * allLabels, createLabel, createLabels, replaceLabels, removeLabels

We distinct between **remove** and **delete**.

**remove** always means to remove a current instanced node/relationship, **delete** means to perfom `DELETE` action on a query:

```coffeescript
  # Delete all nodes with the name `Bob`
  Node::find().andWhereNode({ name: "Bob"}).delete()
  ~> 'START n = node(*)   WHERE ( HAS (n.name) ) AND ( n.name = \'Bob\' ) DELETE n;'
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
  ~> 'START n = node(*) WHERE ( ( n.name = \'Alice\' OR n.name = \'Bob\' ) ) RETURN n;'
  Node::findOne().where([ { 'city': 'Berlin' } , $and: [ { 'name': /^bob.+/i }, $not: [ { 'name': /^Bobby$/ } ] ] ])
  ~> 'START n = node(*)   WHERE ( HAS (n.city) ) AND ( HAS (n.name) ) AND ( city = \'Berlin\' AND ( name =~ \'^(?i)bob.+\' AND NOT ( name =~ \'^Bobby$\' ) ) ) RETURN n   LIMIT 1;'
```

## Debugging

### Error messages

By default you should get clear and understandable error messages on wrong queries, e.g.:

```coffeescript
  Node::find().where "wontWork LIKE 'this'", (err) ->
    # err ~>
      { name: 'QueryError',
        message: 'Unclosed parenthesis\n"START n = node(*)   WHERE ( wontWork LIKE \'this\' ) RETURN # n;"\n                                           ^',
       exception: 'SyntaxException',
       cypher: null,
       stacktrace:
        [ 'org.neo4j.cypher.internal.parser.v1_8.CypherParserImpl.parse(CypherParserImpl.scala:45)',
          'org.neo4j.cypher.CypherParser.parse(CypherParser.scala:42)',
          'org.neo4j.cypher.ExecutionEngine$$anonfun$prepare$1.apply(ExecutionEngine.scala:67)',
          'org.neo4j.cypher.ExecutionEngine$$anonfun$prepare$1.apply(ExecutionEngine.scala:67)',
          'org.neo4j.cypher.internal.LRUCache.getOrElseUpdate(LRUCache.scala:37)',
          'org.neo4j.cypher.ExecutionEngine.prepare(ExecutionEngine.scala:67)',
          'org.neo4j.cypher.ExecutionEngine.execute(ExecutionEngine.scala:59)',
          'org.neo4j.cypher.ExecutionEngine.execute(ExecutionEngine.scala:63)',
          'org.neo4j.cypher.javacompat.ExecutionEngine.execute(ExecutionEngine.java:79)',
          'org.neo4j.server.rest.web.CypherService.cypher(CypherService.java:67)',
          'java.lang.reflect.Method.invoke(Method.java:597)' ],
       statusCode: 400,
       method: 'POST',
       url: 'http://localhost:7474/db/data/cypher',
       data: '{"query":"START n = node(*)   WHERE ( wontWork LIKE \'this\' ) RETURN n;","params":{}}'
     }
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
    # debug ~>
      { options: { type: 'POST', data: {}, no_processing: false, debug: true },
        requested_url: 'http://localhost:7474/db/data/node',
        type: 'POST',
        data: '{}',
        header:
         { Accept: 'application/json',
           'Content-Type': 'application/json' },
        res:
         { extensions: {},
           paged_traverse: 'http://localhost:7474/db/data/node/607/paged/traverse/{returnType}{?pageSize,leaseTime}',
           outgoing_relationships: 'http://localhost:7474/db/data/node/607/relationships/out',
           traverse: 'http://localhost:7474/db/data/node/607/traverse/{returnType}',
           all_typed_relationships: 'http://localhost:7474/db/data/node/607/relationships/all/{-list|&|types}',
           property: 'http://localhost:7474/db/data/node/607/properties/{key}',
           all_relationships: 'http://localhost:7474/db/data/node/607/relationships/all',
           self: 'http://localhost:7474/db/data/node/607',
           properties: 'http://localhost:7474/db/data/node/607/properties',
           outgoing_typed_relationships: 'http://localhost:7474/db/data/node/607/relationships/out/{-list|&|types}',
           incoming_relationships: 'http://localhost:7474/db/data/node/607/relationships/in',
           incoming_typed_relationships: 'http://localhost:7474/db/data/node/607/relationships/in/{-list|&|types}',
           create_relationship: 'http://localhost:7474/db/data/node/607/relationships',
           data: {} },
        status: 'success',
        err: null
      }
```

The debug object is always the third passed argument in the callback.

You can also log all network connections to the database by defining a logger:

```coffeescript
  client.constructor::log = Graph::log = -> console.log(Array::slice.call(arguments).join(' '))
```

or in JavaScript:

```js
  client.constructor.prototype.log = Graph.prototype.log = function() {
    console.log(Array.prototype.slice.call(arguments).join(' '));
  }
```

### Inspect generated queries

You can easiliy inspect the generated queries by invoking the `toCypherQuery()` method:

```coffeescript
  Node::find().andWhereNode({ name: "Bob"}).delete().toCypherQuery()
  ~> 'START n = node(*)   WHERE ( HAS (n.name) ) AND ( n.name = \'Bob\' ) DELETE n;'
```

## TODO

There are some steps to take, especially some methods for daily use are missing, yet. But the basic set of operations are already implemented and tested.

  * implement: relationship (index)
  * measure code coverage
  * nice(r) Documentation

## Terminal usage

For quick testing you can also use the nodejs or coffeescript console (this example is on the coffeescript console), but without the ability to make requests because you need to define callbacks for that:

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

```sh
  $ npm test
```

or in the browser of your choice by opening the `examples/tests.html` file. You have to overwrite the `configForTest` values with your own config data.

# Reference

## Schema like behaviour

Neo4jMapper is not a schema based mapper, but it includes some features which are similar to this.

### Classes and inheritance

You can extend the Node object with an other object. There is no difference whether you use the `_.extend()` method of underscorejs, the class pattern of coffeescript or similar method to extend your "class" (I prefer the CoffeeScript way to keep the code more clean…).

This feature only works with Neo4j v2+ because it makes use of the label feature.

```coffeescript

  class Person extends Node

    onBeforeSave: (next) ->
      console.log('Do something before saving')
      next()

  alice = new Person({name: 'Alice'})
  alice.save ->
```

### Default values and fields to index

```coffeescript

  class Person extends Node

    fields: {
      defaults: {
        is_new: true
        # default values will be generated with invoking this method (e.g. generating a timestamp)
        uid: -> new Date().getTime()
      },
      indexes: {
        email: true # will be autoindex
        uid: 'my_person_index' # will be indexed on the legacy way with 'my_person_index' namespace 
      }
    }
```

## Hooks

### onBeforeSave

```coffeescript
  Node::onBeforeSave = (next) ->
    # do s.th. before the node will be persisted
    # is called before initially save and update
    next()
```

### onBeforeRemove

```coffeescript
  Node::onBeforeRemove = (next) ->
    # do s.th. before the node will be removed
    next()
```

### onBeforeInitialize

Called once the model is being registered. For instance, to ensure autoindex on defined fields is done in this part:

```coffeescript
  Node::onBeforeInitialize = (next) ->
    # do s.th. before the Model gets initialized
    next()
```

## LICENSE

© 2013 by Philipp Staender under the GNU General Public License
See in `LICENSE` file for further details.