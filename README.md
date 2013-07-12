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

```js
  var Neo4j = require('neo4jmapper');
  var neo4j = new Neo4j('http://localhost:7474');
  var Graph = neo4j.Graph, Node = neo4j.Node, Relationship = neo4j.Relationship;
```

### Cypher queries

Use the full power of the cypher query language:

```js
  var graph = new Graph();
  graph.query("START n = node(*) MATCH n-[r]-() RETURN n;", function(err, result) {
    console.log(err, result);
  });
```

### Create and save nodes

```js
  var alice = new Node();
  alice.data = {
    name: 'Alice',
    nested: {
      values: 'are allowed, but not recommend'
    }
    arrays: [ 'are', 'allowed', 'but', 'also', 'non-recommend']
  };
  alice.save(function(err, alice) {
    alice.toObject();
  });
```

or shorter with

```js
  new Node({ name: 'Bob' }).save(function(err, bob) {
    bob.toObject();
  });
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

### Connect Nodes

```js
  alice.createRelationshipTo(bob, 'knows', { since: 'years' }, function(err) {
    bob.createRelationshipTo(alice, 'likes', { since: 'week' }, function(err) {
      console.log(alice.toObject());
      console.log(bob.toObject());
    });
  });
```

You can also **create distinct relationships** with `createOrUpdateRelationshipBetween`, `createOrUpdateRelationshipTo`.

### Query Relationship in various kinds

To get relationships for instance:

```js
  alice.incomingRelationships('like|follow', function(err, r) {
    /* all incoming relationships with 'like' or 'follow' */
  });
  alice.allRelationships(function(err, r){
    /* all relationships of node alice */
  });
  alice.relationshipsBetween(bob, function(err, r){
    /* all relationships between node alice and node bob */
  });
```

### Advanced queries

You can query nodes (relationships may follow) easily like as usual in other Object Mappers

```js
  alice.incomingRelationshipsFrom(bob)
    .where({'r.since': 'years'})
    .limit(1, function(err, relationships) {
      /* … */
    });
```

Also with customized queries in mongodb query style

```js
  Node.find().where(
    { $or : [
      { 'n.name': /alice/i },
      { 'n.name': /bob/i }
    ] }
  ).skip(2)
   .limit(10)
   .orderBy({ 'n.name': 'DESC' }, function(err, result) { /* … */ });
```

```js
  Node.findOne()
    .whereNodeHasProperty('name')
    .andWhereNode({ 'city': 'berlin' }, function(err, result) { /* … */ });
```

### Iterate on large results

You can iterate instantly on results asynchronously with the `each` method, it processes the stream of the response:

```js
  Node.findAll().each(function(node) {
    if (node)
      console.log(node.toObject());
    else
      console.log("Done");
  });
```

You can also process ”raw” queries with streaming:

```js
  client.stream("START n=node(*) RETURN n;", function(node) {
    // process each node async
    if (node)
      console.log(node.toObject());
    else
      console.log('Done');
  });
```

**Currently the streaming feature is not available on browsers** because there are several dependencies on other modules which have to be included as well.

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

Neo4jMapper is using the following identifiers in cypher queries:

  * `n` for a single [n]ode or a start node
  * `m` for an end node ([m]atch) (e.g. Node.findById(32).incomingRelationshipsFrom(12).toCypherQuery() ~> `START n = node(32), m = node(12) MATCH (n)<-[r]-(m) RETURN r;`)
  * `r` for [r]elationship(s)
  * `p` for a [p]ath (not implemented, yet)

We distinct between **remove** and **delete**.

**remove** always means to remove a current instanced node/relationship, **delete** means to perfom `DELETE` action on a query:

```js
  // Delete all nodes with the name `Bob`
  Node.find()
    .andWhereNode({ name: "Bob"})
    .delete();
  ~> 'START n = node(*)   WHERE ( HAS (n.name) ) AND ( n.name = \'Bob\' ) DELETE n;'
  Node.findOne()
    .whereNode({ name: "Bob"}, function(err, bob) {
    // Remove Bob node (if found)
    if (bob)
      bob.remove();
  });
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

```js
  Node.find().whereNode({ $or: [ { name: 'Alice'}, { name: 'Bob' }]});
  ~> will execute 'START n = node(*) WHERE ( ( n.name = \'Alice\' OR n.name = \'Bob\' ) ) RETURN n;'
  Node.findOne().where([ { 'city': 'Berlin' } , $and: [ { 'name': /^bob.+/i }, $not: [ { 'name': /^Bobby$/ } ] ] ]);
  ~> will execute 'START n = node(*)   WHERE ( HAS (n.city) ) AND ( HAS (n.name) ) AND ( city = \'Berlin\' AND ( name =~ \'^(?i)bob.+\' AND NOT ( name =~ \'^Bobby$\' ) ) ) RETURN n   LIMIT 1;'
```

## Debugging

### Error messages

By default you should get clear and understandable error messages on wrong queries, e.g.:

```js
  Node.find().where("wrongQuery LIKE 'this'", function(err) {
    /* err ~>
      { name: 'QueryError',
        message: 'Unclosed parenthesis\n"START n = node(*)   WHERE ( wrongQuery LIKE \'this\' ) RETURN # n;"\n                                           ^',
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
    */
  });
```

### Inspect sended + received data

In case you want to inspect sended + received data and/or the process of mapping, you can set a debug flag:

```js
  // for all instanced node(s) via prototype
  Node.neo4jrestful.debug = true;
  // or better for specific objects
  node = new Node();
  node.neo4jrestful.debug = true;
  node.save(function(err, result, debug) {
    /* debug ~>
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
    */
  });
```

The debug object is always the third passed argument in the callback.

You can also log all network connections to the database by defining a logger:

```js
  client.constructor.prototype.log = Graph.prototype.log = function() {
    console.log(Array.prototype.slice.call(arguments).join(' '));
  }
```

### Inspect generated queries

You can easiliy inspect the generated queries by invoking the `toCypherQuery()` method:

```js
  Node.find().andWhereNode({ name: "Bob"}).delete().toCypherQuery();
  ~> 'START n = node(*)   WHERE ( HAS (n.name) ) AND ( n.name = \'Bob\' ) DELETE n;'
```

## TODO

There are some steps to take, especially some methods for daily use are missing, yet. But the basic set of operations are already implemented and tested.

  * implement: relationship (index)
  * fix Relationship::update()
  * stream: browser compatible, debug options
  * nice(r) Documentation
  * remove queue feature

## Terminal usage

For quick testing you can also use the nodejs or coffeescript console (this example is on the coffeescript console), but without the ability to make requests because you need to define callbacks for that:

```sh
  
  $ coffeescript
  
  coffee> {Graph,Node} = require('./src/index.js')('http://localhost:7474')
  { Node: [Function: Node],
  …
  coffee> Node.findOne().toCypherQuery()
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

```js

  var Person = (function(Node) {

    function Person(data, id) {
      this.init.apply(this, arguments);
    }

    _.extend(Person.prototype, Node.prototype);
      
    return Movie;
  
  })(Node);

  Person.prototype.fields = {
    defaults: {
      is_new: true,
      uid: -> new Date().getTime()
    },
    indexes: {
      email: true,
      uid: 'my_person_index'
    }
  };
```

## Hooks

### Nodes

All hooks can also be defined for specific ”classes“, e.g.:

```js
  Person.prototype.onBeforeSave = fucntion(next) { next(null, null); }
```

#### onBeforeSave

```js
  Node.prototype.onBeforeSave = function(next) {
    // do s.th. before the node will be persisted
    // is called before initially save and update
    next();
  }
```

#### onBeforeRemove

```js
  Node.prototype.onBeforeRemove = function(next) {
    // do s.th. before the node will be removed
    next();
  }
```

#### onBeforeInitialize

Called once the model is being registered. For instance, to ensure autoindex on defined fields is done in this part:

```js
  Node.prototype.onBeforeInitialize = function(next) {
    // do s.th. before the Model gets initialized
    next();
  }
```

#### onAfterLoad

On all `Node.find*()` queries the results run through a load process (loading the label(s) which has to be an extra request for instance). You can define your own afterLoad process this way:

```js
  Node.prototype.onAfterLoad = function(node, done) {
    // do s.th. here, finnaly call done()
    if (node.id)
      this.neo4jrestful.query("START …", function(err, result) {
        // …
        done(err, null);
      });
  }
```

**To reduce database requests you can switch load hooks on and off by Node.prototype.disableLoading() / Node.prototype.enableLoading()**

## LICENSE

© 2013 by Philipp Staender under the GNU General Public License
See in `LICENSE` file for further details.