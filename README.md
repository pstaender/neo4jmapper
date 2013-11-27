# Neo4jMapper
## Object Modeler for Neo4j Graphdatabases

Written in JavaScript for browser- and serverside usage.

[Give Neo4jMapper a try in the coffeesript-live-console](http://pstaender.github.io/neo4jmapper/examples/browser/console/console.html)

### Why another neo4j client?

Neo4jMapper helps to get trivial neo4j-database-tasks quickly done.

Features:

  * **Querying graph, nodes and relationships** via object-chaining
  * **Object Modeling** for labeling, indexing and other schema-like behaviour
  * **processes and transforms data** (flatten/unflatten, escaping, loading/populating …)
  * **Transactions handling** of cypher-queries

### Warning

**Neo4jMapper is designed for the upcoming version 2 of Neo4j, which is currently in a pre-release-state**. Until the final release of Neo4j v2 is available, some features/api might change.

### Sourcecode inline Documentation

[Generated sourcecode documentation, quite incomplete but may give a good introduction to the neo4jmapper models.](docs/)

## How to use

### Installation

#### NodeJS

```sh
  $ npm install neo4jmapper
```
#### Browser

Include `examples/browser/neo4jmapper_complete.js` in your html-file and ensure that you have included [underscorejs](https://github.com/jashkenas/underscore/blob/master/underscore.js) and [superagent](https://github.com/visionmedia/superagent/blob/master/superagent.js) as well.

### Connect to Database

```js
  var Neo4jMapper = require('neo4jmapper');
  var neo4j = new Neo4jMapper('http://localhost:7474');
```

or in the browser:

```js
  var neo4j = new window.Neo4jMapper('http://localhost:7474');
```

To use multiple database connections:

```js
  var neo4j1 = new Neo4j('http://somewhere:7474');
  var neo4j2 = new Neo4j('http://elsewhere:7070');
```

Most of the time you might work with the following interfaces:

```js
  var Node = neo4j.Node
    , Relationship = neo4j.Relationship
    , Graph = neo4j.Graph
    , Transaction = neo4j.Transaction;
```

## CRUD Nodes

### Create

```js
  Node.create( { name: 'Dave Grohl', year: 1969 }, function(err, dave) {
    if (err)
      console.error(err.message);
    else
      console.log('Node is persisted:', dave.toObject());
  });
```

Create relations between nodes:

```js
  Node.create( {
    name: 'Foo Fighters',
    // arrays + nested objects are possible (but they don't make much sense in a graphdb)
    genres: [ 'Alternative Rock', 'Post-Grunge' ],
    foundation: {
      year: 1994,
      in: 'Seattle'
    }
  }).save( function(err, fooFighters) {
    dave.createRelationTo( fooFighters, 'PLAYS', function(err, relationship) {
      console.log('Created Relationship:', relationship.toObject());
      new Node( { name: 'Taylor Hawkins' } ).save(function(err, taylor) {
        dave.createRelationBetween(taylor, 'ROCK', cb);
      });
    });
  });
```

Create relations with attributes:

```js
  dave.createRelationTo( fooFighters, 'PLAYS', { instrument: 'guitar' }, cb );
  taylor.createRelationTo( fooFighters, 'PLAYS', { instrument: 'drums' }, cb );
```

### Update

```js
  console.log(dave.data.name);
  // ~> 'Dave Grohl'
  dave.data.firstName = 'Dave';
  dave.data.surname = 'Grohl';
  dave.save(cb);
```

or

```js
  Node.findById(dave.id).update( {
    firstName: 'Dave',
    surname: 'Grohl'
  }, cb );
```

### Find or Create

Creates a new node with this attribute if not exists, updates if one (distinct) exists:

```js
  Node.findOrCreate( {
    name: 'Dave Grohl'
  }, cb );
```

### Remove

We use `remove()` if we are on an instanced Node:

```js
  dave.remove(cb);
  // if you want to remove relationships as well
  dave.removeIncludingRelations(cb);
```

`delete()` if we perform a delete action on a query:

```js
  Node.findById(dave.id).delete(cb);
  // if you want to delete relationships as well
  Node.findById(dave.id).deleteIncludingRelations(cb);
```

### Find Nodes

Some examples:

```js
  Node.findOne( { name: 'Dave Grohl' }, function(err, dave) {
    if (err)
      console.error(err.message);
    else
      console.log('Found Node:', dave.toObject());
  });
```

```js
  Node
    .find( { year: 1969 } )
    .limit( 10, function(err, found) {
      if (found) {
        console.log(found.length + ' nodes found');
      }
    });
```

You can use `$and`, `$or`, `$not`, `$xor` and `$in` operators in where conditions:

```js
  Node
    .find() // you can put your where condition inside find() as well
    .where( { $and: [ { year: $in : [ 1968, 1969, 1970 ] }, { name: 'Dave Grohl'} ] } )
    .limit(1, cb);
```

Query relationships:

```js
  Node
    .findOne( { name: 'Dave Grohl' } )
    .incomingRelations( 'ROCKS|PLAYS', function(err, foundRelations) {
      console.log('Incoming relationships of Dave with "ROCKS" OR "PLAYS":', foundRelations);
    });
```

or query on instanced nodes:

```js
  dave.incomingRelations(function(err, foundRelations) {
    console.log('All incoming relationships of Dave:', foundRelations);
  });
```

## Query Graph

There are three different ways to query the Graph:

  * Graph.start()
  * Graph.query() / Graph.stream()
  * Graph.request().…

### Recommend: Get everything as expected with Graph.start()

```js
  Graph
    .start()
    .match('(n)-[r]-()', cb);
```

Leave the `Graph.start()` statement empty if you don't need it.

Beside you can also start with: `Graph.[start|create|match|where|with|return]`

You can chain your query elements and use conditional parameters in where clauses:

```js
  Graph
    .start()
    .match('(game:Game)-[c:contains]-(position:Position)')
    .where({ 'game.title': 'Wes vs Alvin' }) // values will be escaped
    .with('game, collect(position) AS positions')
    .match('game-[c:contains]-(position:Position)')
    .with('positions, c, position')
    .orderBy('c.move ASC')
    .match('position-[m:move]-next')
    .where('next IN (positions)')
    .return('(c.move+1)/2 as move, position.to_move as player, m.move, next.score as score')
    .limit(20, cb);
  /*
    ~>
      MATCH     (game:Game)-[c:contains]-(position:Position)
      WHERE     HAS (game.title) AND game.title = 'Wes vs Alvin'
      WITH      game, collect(position) AS positions
      MATCH     game-[c:contains]-(position:Position)
      WITH      positions, c, position
      ORDER BY  c.move ASC
      MATCH     position-[m:move]-next
      WHERE     next IN (positions)
      RETURN    (c.move+1)/2 as move, position.to_move as player, m.move, next.score as score
      LIMIT     20;
  */
```

```js
  Graph
    .start('n = node(*)')
    .case("n.eyes WHEN {color1} THEN 1 WHEN {color2} THEN 2 ELSE 3")
    .parameters({ color1: 'blue', color2: 'brown' })
    .return('n AS Person')
    .toQueryString();
  /* ~>
    START   n = node(*)
    CASE    n.eyes WHEN 'blue' THEN 1 WHEN 'brown' THEN 2 ELSE 3 END
    RETURN  n AS Person;
  */
```

Here are most of all available methods to query the graph. `…` represents the strings containing the statements:

```js
  Graph
    .start(…)
    .match(…)
    .onMatch(…)
    .where('n.name = {value1}')
    .parameters( { value1: 'Bob' } )
    .where( { 'n.name': 'Bob' } ) // would save the `where(…)` and `parameters(…)` operations above
    .with(…)
    .orderBy(…)
    .skip(10)
    .limit(20)
    .delete(…)
    .return(…)
    .create(…)
    .onCreate(…)
    .createIndexOn(…)
    .createUnique(…)
    .dropIndexOn
    .merge(…)
    .remove(…)
    .set(…)
    .foreach(…)
    .case(…)
    .custom(…)
    .comment(…)
    .exec(cb) // or .stream(cb)
```

You can also use `Graph.enableProcessing().…` instead of `Graph.start()…` if you like explicitily wordings.

Results will contain the relevant data column and found objects will be loaded as expected (columns definitions may redundant here, but are available on `graph._columns_` anyhow).

For specific statement segments can handle object literals (besides oridnary strings) to enforce value processing (i.e. using query parameters / escaping).

Some examples:

#### Create a Node

```js
  Graph.create({ 'n:Person': { name : 'Dave', surname : 'Grohl' } });
  // ~> CREATE (n:Person { name : 'Dave', surname : 'Grohl' })
```

#### Update a Node

```js
  Graph.start('n = node(123)')
    .set({ "n.name" : 'Dave', "n.surname" : 'Grohl', "n.year": null }),
    // ~> START n = node(123) SET n.`name` = 'Dave', n.`surname` = 'Grohl', n.`year` = NULL;
```

#### Match condition

```js
  Graph.start()
    .match([ '(on)-[r:RELTYPE ', { since : 1982 }, ']-(match)' ]);
    // ~> MATCH (on)-[r:RELTYPE { `since` : 1982 }]-(match)
```

### Query with minimal processing of the results

```js
  Graph
    .query(cypherQueryString, cb);
```

Sort + loading are explicitly disabled to decrease response time (both are activated by default using `Graph.start()`).

You can also choose what to switch on and off:

```js
  Graph
    .disableLoading()
    .disableSorting()
    .query( … , cb)
```

To work with parameters:

```js
  Graph
    .query(cypherQueryString).
    .addParameters({ name: 'Alice' }) // optional
    .exec(cb);
```

Streaming (gets interesting on large results):

```js
  Graph
    .stream(cypherQueryString, cb);
```

To work with parameters on streaming:

```js
  Graph
    .query(cypherQueryString)
    .addParameters({ name: 'Alice' }) // optional
    .stream(cb);
```

The only "processing" will be to detect object type (Node, Relationship, Path).

### Native (restful api) requests

Use `Graph.request()` to send native requests and get native response:

```js
  Graph
    .request()
    .get('node/3', cb);
```

```js
  Graph
    .request()
    .query( "START n = node(*) MATCH n-[r]-() RETURN n;", cb);
```

This will request the restful api straightforward and there won't be any processing at all.
The following methods are available: post, get, delete, put and query.

### Modeling

We can define models based on the `Node` model (similar to models you might know from backbonejs for instance).

Every extended model enjoys label support.

```js
  Node.registerModel( 'Person', {
    fields: {
      indexes: {
        email: true
      },
      defaults: {
        created_on: function() {
          return new Date().getTime();
        }
      }
    },
    fullname: function() {
      var s = this.data.firstName + " " + this.data.surname;
      return s.trim();
    }
  }, function(err, Person) {

    var alice = new Person({firstName: 'Alice', surname: 'Springs'});

    alice.fullname();
    ~> Alice Springs

    alice.save(function(err, alice) {
      alice.toObject();
      ~> { id: 81238,
      classification: 'Node',
      data:
       { created_on: 1374758483622,
         surname: 'Springs',
         firstName: 'Alice' },
      uri: 'http://localhost:7420/db/data/node/81238',
      label: 'Person',
      labels: [ 'Person' ] }
    });

    // You can also use multiple inheritance
    // here: Director extends Person
    // Director will have the labels [ 'Director', 'Person' ]

    // You can skip the cb and work instantly with the registered model
    // if you don't use index/uid fields on your schema
    var Director = Person.registerModel('Director', {
      fields: {
        defaults: {
          job: 'Director'
        }
      }
    });

    new Director( {
      name: 'Roman Polanski'
    } ).save(function(err, polanski) {
      polanski.toObject();
      ~> { id: 81239,
      classification: 'Node',
      data:
       { created_on: 1374758483625,
         name: 'Roman Polanski',
         job: 'Director'
       },
      uri: 'http://localhost:7420/db/data/node/81239',
      label: 'Director',
      labels: [ 'Director', 'Person' ] }
    });
  });

```

Coffeescript and it's class pattern is maybe the most convenient way to define models:

```coffeescript
  class Person extends Node
    fields:
      indexes:
        email: true
      defaults:
        created_on: ->
          new Date().getTime()
    fullname: ->
      s = @data.firstName + " " + @data.surname
      s.trim()

  Node.registerModel Person, (err) ->

    alice = new Person firstName: 'Alice', surname: 'Springs'
    alice.fullname()
    ~> 'Alice Springs'
    alice.save ->
      alice.label
      ~> 'Person'

    class Director extends Person
    Node.registerModel(Director)
```

To use default values on Relationships, use the setter (available on `Node` as well):

```
  Relationship.setDefaultFields({
    created_on: function() {
      return new Date().getTime();
    }
  });
```

### Iterate on large results (streaming)

Note: Streaming works on NodeJS only

You can iterate results asynchronously with the `each` method, it processes the stream of the response:

```js
  Node.findAll().each(function(node) {
    if (node)
      console.log(node.toObject());
    else
      console.log("Done");
  });
```

Keep in mind that there is **no extra loading executed on stream results** to pass through the result as soon as possible. If you want to load a object from a streaming result (if you need labels for instance), you have to trigger it explicitly:

```js
  Person.findAll().each(function(person) {
    if (person) {
      person.load(function(err, load){
        // person is now loaded (with labels for instance…)
        console.log(person.toObject());
      });
    }
  });
```

## Transactions

Neo4jMapper supports transactions:

```js
  Transaction.commit(
    'CREATE (n {props}) RETURN n AS NODE, id(n), as ID',
    // parameters are optional but recommend to use
    { props: { name: 'Foo Fighters' } },
    function(err, transaction) {
      console.log(transaction.results[0]);
    }
  );
```

You can create open transaction and add statements to aslong they aren't committed. The api is self explaining (instead of `Transaction.create` you can use `Transaction.open` to follow the neo4j terminology):

```js
  Transaction.create(
    'CREATE (n {props}) RETURN n AS NODE, id(n), as ID',
    { props: { name: 'Dave Grohl' } }
  ).add(
    'CREATE (n {props}) RETURN n AS NODE, id(n), as ID',
    { props: { name: 'Taylor Hawkins' } }
  , function(err, openTransaction) {
    console.log({
      statusOfTransaction: openTransaction.status,
      transactionId: openTransaction.id,
      results: openTransaction.results,
      errors: openTransaction.errors
    });
  });
```

Commit transactions:

```js
  Transaction.create(…, function(err, openTransaction) {
    openTransaction.commit(function(err, committedTransaction) {
      console.log('Transaction with ID '+committedTransaction.id+' is now committed: ', committedTransaction.status);
    });
  });
```

Rollback open transactions:

```js
  Transaction.create(…, function(err, openTransaction) {
    openTransaction.rollback(function(err, deletedTransaction) {
      console.log('Transaction is rolled back');
    });
  });
```

Commit or rollback all open transactions with:

```js
  Transaction.commitAll(cb);
  Transaction.rollbackAll(cb);
```

In future releases transactions may available for `Node.` and `Graph.` objects as well. Also there is no loading of results implemented, yet.

## Naming conventions

The query method names are heavily inspired by mongodb and mongoose - so most of them should sound familiar in case you have worked with them:

  * find, findOne, findById, findByUniqueKeyValue
  * where, whereNode, whereRelationship, whereStartNode, whereEndNode, whereRelationship, andWhereNode, …
  * andHasProperty, whereNodeHasProperty, whereRelationshipHasProperty, …
  * withRelatioships, incomingRelations, outgoingRelations, relationsBetween, incomingRelationsFrom(), outgoingRelationsTo() …
  * match
  * limit
  * skip
  * delete, deleteIncludingRelations
  * allLabels, createLabel, createLabels, replaceLabels, removeLabels
  …

Neo4jMapper is using the following identifiers in cypher queries:

  * `n` for a single [n]ode or a start node
  * `m` for an end node ([m]atch) (e.g. Node.findById(32).incomingRelationshipsFrom(12).toQueryString() ~> `START n = node(32), m = node(12) MATCH (n)

## Debugging

### Error messages

By default you should get clear and understandable error messages on wrong queries, e.g.:

```js
  Node.find().where("wrongQuery LIKE 'this'", function(err) {
    err ~>
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
  });
```

### Inspect sended + received data

In case you want to inspect sended + received data and/or the process of mapping, you can set a debug flag:

```js
  // for all instanced node(s) via prototype
  Node.prototype.neo4jrestful.debug = true;
  // or better for specific objects
  var node = new Node();
  node.neo4jrestful.debug = true;
  node.save(function(err, result, debug) {
    debug ~>
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
        err: null,
        responseTime: 150
      }
  });
```

or simply inspect `_reponse_`:

```js
  var node = new Node();
  node.save(function(err, result) {
    console.log(node._response_, node._columns_);
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

You can easiliy inspect the generated queries by invoking the `toQuery()` or `toQueryString()` method:

```js
  Node.find().andWhereNode({ name: "Bob"}).delete().toQueryString();
  ~> 'START n = node(*)   WHERE ( HAS (n.name) ) AND ( n.name = \'Bob\' ) DELETE n;'
```

## callback-less with generators

In v8-harmony you can use generators in your js to avoid callbacks, for instance via the suspend library:

```js
  var Neo4j = require('../src')
    , neo4j = new Neo4j('http://localhost:7474')
    , Node  = neo4j.Node
    , Graph = neo4j.Graph
    , suspend = require('suspend');

  suspend(function*(resume) {
    var Band = yield Node.registerModel('Band', resume);
    var Song = yield Node.registerModel('Song', resume);
    var band = yield new Band({ name: 'Foo Fighter'}).save(resume);
    var song = yield new Song({ title: 'Everlong' }).save(resume);
    yield band.createRelationshipTo(song, 'plays', resume);
    var relations = yield song.incomingRelationships('plays', resume);
    console.log(relations[0].toObject());
  })();
```

## Schema like behaviour

Neo4jMapper is not a schema-based-mapper, but it includes some features which are similar to this.

### Default values, unique fields and autoindex

To let buil Neo4j the index in the background for you, you just have to define the fields in the `indexes` property as you see below. If you want to ensure that the field is unique, add the fields to the `unique` property (keep in mind that unique fields are always ”indexes“ as well). The default properties has no effect on the database, it just will populate the object with default values if they aren't set.

```js
  Node.registerModel( 'Person', {
    fields = {
      defaults: {
        is_new: true,
        uid: -> new Date().getTime()
      },
      indexes: {
        email: true,
        uid: 'my_person_index'
      },
      unique: {
        uid: true
      }
    }
  }, function(err, Person) {
    // work with the registered and indexed model 'Person'
    var polanski = new Person();
  });
```

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

  Node.registerModel Person, (err) ->
    polanski = new Person()
```

You can also use default values for Relationships:

```js
  Node.Relationship.fields.defaults = {
    created_on = function() {
      return new Date().getTime();
    }
  }
```

### Drop indexes

Neo4jMapper won't drop indexed or unique defined fields for you, because it doesn't have any migration features. But you can drop the index on a Model by yourself via:

```js
  Node.registerModel('Person', function(err, Person) {
    Person.dropEntireIndex(function(err, Per) {
      console.log("Dropped entire index for label 'Person'");
    });
  });
```

## Hooks

### Node hooks

* onBeforeSave(node, next)
* onAfterSave(node, next)
* onBeforeRemove(node, next)
* onBeforeInitialize(next) (will be called before a model will initialized)
* onAfterPopulate() (will be calles after data is applied on the node)

### Relationships hooks

* onBeforeLoad(relationship, next)
* onAfterLoad(relationship, next)
* onBeforeSave(relationship, next)
* onAfterSave(relationship, next)

### Performance Tweaks

To reduce database requests you can switch load hooks on and off

  * `Node.prototype.disableLoading()` / `Node.prototype.enableLoading()`
  * `Node.disableLoading()` / `Node.enableLoading()` in global context
  * `Graph.request()` or `Graph.disableProcessing().query()` to request natively

### Benchmarks

Some basic benchmark tests are written. To get reasonable benchmark results we compare neo4jmapper with the node-neo4j library (a robust basic neo4j driver). You can execute them with `coffee benchmark/benchmark.coffee` (beware that a lot of nodes will be written and kept in your database).