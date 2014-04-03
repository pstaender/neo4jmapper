# nodejs
if root?
  # external modules
  require('source-map-support').install()
  expect        = require('expect.js')
  Join          = require('join')
  _             = require('underscore')

  # load config
  configForTest = require('./config')

  # neo4j mapper modules
  Neo4j         = require("../#{configForTest.srcFolder}/index.js")

  {Graph,Node,Relationship,Path,Transaction,Neo4jRestful,helpers,client}  = new Neo4j {
    url: configForTest.neo4jURL
    onConnectionError: (err) ->
      throw err
  }
# browser
else
  _ = window._
  configForTest = _.extend({
    doLog: false
    wipeDatabase: false
    neo4jURL: 'http://yourserver:0000/'
  }, configForTest or {})
  Join = window.Join
  neo4jmapper = new window.Neo4jMapper(configForTest.neo4jURL)
  {Graph,Node,Relationship,Path,Transaction,Neo4jRestful,helpers,client} = neo4jmapper
  Neo4j = Neo4jMapper

client.constructor::log = Graph::log = configForTest.doLog if configForTest.doLog

_trim = (s) -> s.trim().replace(/\s+/g, ' ')

describe 'Neo4jMapper (cypher queries)', ->

    it 'expect to throw an error on some specific chaining cases', ->
      err = null
      try
        Node.findOne().deleteIncludingRelations ->
      catch e
        err = e
      expect(err).not.to.be null
      err = null
      try
        Node.find().deleteIncludingRelations().limit 1, ->
      catch e
        err = e
      expect(err).not.to.be null

    it 'expect to build various kind of queries', ->

      # we will deactivate temporarily parameter seperating for testing the query building
      # http://docs.neo4j.org/chunked/stable/rest-api-cypher.html#rest-api-send-queries-with-parameters
      expect(helpers.CypherQuery::useParameters).to.be true


      class Actor extends Node
      Node.register_model(Actor)
      node = new Node()
      results = []
      testQueries = ->

        "Node.findAll()":
          [
             Node.findAll()
            'START n = node(*) RETURN n, labels(n);'
          ]

        "Node.findById(123)":
          [
            Node.findById(123)
            "START n = node(123) RETURN n, labels(n);"
          ]

        'Node.findOne()':
          [
             Node.findOne()
            'START n = node(*) RETURN n, labels(n) LIMIT 1;'
          ]

        "Node.findAll().limit(10)":
          [
             Node.findAll().limit(10)
            'START n = node(*) RETURN n, labels(n) LIMIT 10;'
          ]

        "Node.findAll().match('n:Person')":
          [
             Node.findAll().match('n:Person')
            "MATCH (n:Person) RETURN n, labels(n);"
          ]

        "Actor.findById(123)":
          [
             Actor.findById(123)
            "START n = node(123) MATCH (n:Actor) RETURN n, labels(n);"
          ]

        "Actor.findAll()":
          [
             Actor.findAll()
            "MATCH (n:Actor) RETURN n, labels(n);"
          ]

        "Node.findAll().skip(5)":
          [
             Node.findAll().skip(5)
            'START n = node(*) RETURN n, labels(n) SKIP 5;'
          ]

        "Node.start().match('(p:PERSON)-[:KNOWS]->(a:Actor)-[:ACTS]->(m:Movie)').return('p AS Person')":
          [
             Node.start().match('(p:PERSON)-[:KNOWS]->(a:Actor)-[:ACTS]->(m:Movie)').return('p AS Person')
            'MATCH (p:PERSON)-[:KNOWS]->(a:Actor)-[:ACTS]->(m:Movie) RETURN p AS Person;'
          ]


        "Node.findAll().orderBy( { 'name': 'DESC' } )":
          [
             Node.findAll().orderBy( { 'name': 'DESC' })
            'START n = node(*) WHERE HAS (n.`name`) RETURN n, labels(n) ORDER BY n.`name` DESC;'
          ]

        "Node.findAll().orderNodeBy({'name': 'ASC'})":
          [
             Node.findAll().orderNodeBy({'name': 'ASC'})
            'START n = node(*) WHERE HAS (n.`name`) RETURN n, labels(n) ORDER BY n.`name` ASC;'
          ]

        'Node.findAll().incomingRelations()':
          [
             Node.findAll().incomingRelations()
            'START n = node(*) MATCH (n)<-[r]-() RETURN r;'
          ]

        'Node.findById(123).incomingRelations("Person")':
          [
             Node.findById(123).incomingRelationsFrom("Person")
            'START n = node(123) MATCH (n)<-[r]-(:Person) RETURN r;'
          ]

        'Actor.findAll().incomingRelations()':
          [
             Actor.findAll().incomingRelations()
            'START n = node(*) MATCH (n:Actor)<-[r]-() RETURN r;'
          ]

        'Node.findAll().outgoingRelations()':
          [
             Node.findAll().outgoingRelations()
            'START n = node(*) MATCH (n)-[r]->() RETURN r;'
          ]

        "Node.findAll().incomingRelations()":
          [
             Node.findAll().incomingRelations()
            'START n = node(*) MATCH (n)<-[r]-() RETURN r;'
          ]

        "Node.findOne().withRelations('know')":
          [
             Node.findOne().withRelations('know')
            "MATCH (n)-[r:know]-() RETURN n, labels(n) LIMIT 1;"
          ]

        "Node.findOne().outgoingRelations(['know','like'])":
          [
             Node.findOne().outgoingRelations(['know','like'])
            'START n = node(*) MATCH (n)-[r:know|like]->() RETURN r LIMIT 1;'
          ]

        "Node.findOne().outgoingRelationsTo(2, ['know','like'])":
          [
             Node.findOne().outgoingRelationsTo(2, ['know','like'])
            'START n = node(*), m = node(2) MATCH (n)-[r:know|like]->(m) RETURN r LIMIT 1;'
          ]

        "Node.findOne().outgoingRelationsTo(2, 'know|like*')":
          [
             Node.findOne().outgoingRelationsTo(2, 'know|like*')
            'START n = node(*), m = node(2) MATCH (n)-[r:know|like*]->(m) RETURN r LIMIT 1;'
          ]


        "Node.findOne().where({ 'name?': 'Alice'})":
          [
             Node.findOne().where({ 'name?': 'Alice' })
            "START n = node(*) WHERE ( n.`name`? = 'Alice' ) RETURN n, labels(n) LIMIT 1;"
            "START n = node(*) WHERE ( n.`name`? = {_value0_} ) RETURN n, labels(n) LIMIT 1;"
            { _value0_: 'Alice'}
          ]

        "Node.findOne().where({name: 'Alice'}).outgoingRelations()":
          [
             Node.findOne().where({name: 'Alice'}).outgoingRelations()
            "START n = node(*) MATCH (n)-[r]->() WHERE ( HAS (n.`name`) AND n.`name` = 'Alice' ) RETURN r LIMIT 1;"
            "START n = node(*) MATCH (n)-[r]->() WHERE ( HAS (n.`name`) AND n.`name` = {_value0_} ) RETURN r LIMIT 1;"
            { _value0_: 'Alice'}
          ]

        "Node.findAll().outgoingRelations('know').distinct().count()":
          [
             Node.findAll().outgoingRelations('know').distinct().count()
            'START n = node(*) MATCH (n)-[r:know]->() RETURN COUNT(DISTINCT *);'
          ]

        "Node.singleton(1).incomingRelationsFrom(2, 'like').where({ 'since': 'years' })":
          [
             Node.singleton(1).incomingRelationsFrom(2, 'like').where({ 'since': 'years' })
            "START n = node(1), m = node(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (n.`since`) AND n.`since` = 'years' ) RETURN r, n, labels(n);"
            "START n = node(1), m = node(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (n.`since`) AND n.`since` = {_value0_} ) RETURN r, n, labels(n);"
            { _value0_: 'years' }
          ]

        "Node.singleton(1).incomingRelationsFrom(2, 'like').whereRelationship({ 'since': 'years' })":
          [
             Node.singleton(1).incomingRelationsFrom(2, 'like').whereRelationship({ 'since': 'years' }),
            "START n = node(1), m = node(*), r = relationship(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (r.`since`) AND r.`since` = 'years' ) RETURN r;"
            "START n = node(1), m = node(*), r = relationship(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (r.`since`) AND r.`since` = {_value0_} ) RETURN r;"
            { _value0_: 'years'}
          ]

        "Node.find().whereNode({ 'boolean_a': true, 'boolean_b': false, 'string_a': 'true', 'number_a': 123.2, 'number_b': 123, 'string_b': '123', 'regex': /[a-z]/ })":
          [
             Node.find().whereNode({ 'boolean_a': true, 'boolean_b': false, 'string_a': 'true', 'number_a': 123.2, 'number_b': 123, 'string_b': '123', 'regex': /[a-z]/ })
            "START n = node(*) WHERE ( HAS (n.`boolean_a`) AND n.`boolean_a` = true AND HAS (n.`boolean_b`) AND n.`boolean_b` = false AND HAS (n.`string_a`) AND n.`string_a` = 'true' AND HAS (n.`number_a`) AND n.`number_a` = 123.2 AND HAS (n.`number_b`) AND n.`number_b` = 123 AND HAS (n.`string_b`) AND n.`string_b` = '123' AND HAS (n.`regex`) AND n.`regex` =~ '[a-z]' ) RETURN n, labels(n);"
            "START n = node(*) WHERE ( HAS (n.`boolean_a`) AND n.`boolean_a` = {_value0_} AND HAS (n.`boolean_b`) AND n.`boolean_b` = {_value1_} AND HAS (n.`string_a`) AND n.`string_a` = {_value2_} AND HAS (n.`number_a`) AND n.`number_a` = {_value3_} AND HAS (n.`number_b`) AND n.`number_b` = {_value4_} AND HAS (n.`string_b`) AND n.`string_b` = {_value5_} AND HAS (n.`regex`) AND n.`regex` =~ {_value6_} ) RETURN n, labels(n);"
            { _value0_: true, _value1_: false, _value2_: 'true', _value3_: 123.2, _value4_: 123, _value5_: '123', _value6_: '[a-z]' }
          ]

        "Node.find({ $and : [ { a: 1 }, { b: 2} ] })":
          [
             Node.find({ $and : [ { a: 1 }, { b: 2} ] })
            "START n = node(*) WHERE ( ( HAS (n.`a`) AND n.`a` = 1 AND HAS (n.`b`) AND n.`b` = 2 ) ) RETURN n, labels(n);"
            "START n = node(*) WHERE ( ( HAS (n.`a`) AND n.`a` = {_value0_} AND HAS (n.`b`) AND n.`b` = {_value1_} ) ) RETURN n, labels(n);"
            { _value0_: 1, _value1_: 2 }
          ]

        "Node.find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})":
          [
             Node.find().where( { $or : [ { 'n.firstname': /alice/i } , { 'n.surname': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})
            "START n = node(*) WHERE HAS (n.`name`) AND ( ( HAS (n.`firstname`) AND n.`firstname` =~ '(?i)alice' OR HAS (n.`surname`) AND n.`surname` =~ '(?i)bob' ) ) RETURN n, labels(n) ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
            "START n = node(*) WHERE HAS (n.`name`) AND ( ( HAS (n.`firstname`) AND n.`firstname` =~ {_value0_} OR HAS (n.`surname`) AND n.`surname` =~ {_value1_} ) ) RETURN n, labels(n) ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
            { _value0_: '(?i)alice', _value1_: '(?i)bob' }
          ]

        "Actor.find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})":
          [
             Actor.find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})
            "START n = node(*) MATCH (n:Actor) WHERE HAS (n.`name`) AND ( ( HAS (n.`name`) AND n.`name` =~ '(?i)alice' OR HAS (n.`name`) AND n.`name` =~ '(?i)bob' ) ) RETURN n, labels(n) ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
          ]

        "Node.findOne().where({ 'n.city': 'berlin' }).andHasProperty('name').return('n AS Person')":
          [
            Node.findOne().where({ 'n.city': 'berlin' }).andHasProperty('name').return('n AS Person')
            "START n = node(*) WHERE HAS (n.`name`) AND ( HAS (n.`city`) AND n.`city` = 'berlin' ) RETURN n AS Person, labels(n) LIMIT 1;"
          ]

        "Node.findOne([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ]).return('n.name AS Name')":
          [
             Node.findOne([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ]).return('n.name AS Name')
            "START n = node(*) WHERE ( HAS (n.`city`) AND n.`city` = 'berlin' AND ( HAS (n.`name`) AND n.`name` = 'peter' AND NOT ( HAS (n.`name`) AND n.`name` = 'pedro' ) ) ) RETURN n.name AS Name LIMIT 1;"
          ]

        " Node.find({ foo: 'bar' }).where('(n)-[:KNOW]-()')":
          [
             Node.find({ foo: 'bar' }).where('(n)-[:KNOW]-()'),
            "START n = node(*) WHERE ( HAS (n.`foo`) AND n.`foo` = 'bar' ) AND ( (n)-[:KNOW]-() ) RETURN n, labels(n);"
          ]

        "Node.findById(123).incomingRelations().delete()":
          [
             Node.findById(123).incomingRelations().delete()
            "START n = node(123) MATCH (n)<-[r]-() DELETE r;"
          ]

        "Node.findById(123).allRelations().delete()":
          [
             Node.findById(123).allRelations().delete()
            "START n = node(123) MATCH (n)-[r]-() DELETE r;"
          ]

        "Actor.deleteAllIncludingRelations()":
          [
             Actor.deleteAllIncludingRelations()
            "START n = node(*) OPTIONAL MATCH (n:Actor)-[r]-() DELETE n, r;"
          ]

        "Node.find().deleteIncludingRelations()":
          [
             Node.find().deleteIncludingRelations()
            "START n = node(*) OPTIONAL MATCH (n)-[r]-() DELETE n, r;"
          ]

        "Actor.find().deleteIncludingRelations()":
          [
             Actor.find().deleteIncludingRelations()
            "START n = node(*) OPTIONAL MATCH (n:Actor)-[r]-() DELETE n, r;"
          ]

        "Node.findById(123).update({ name: 'Alice', email: 'alice@home.com' })":
          [
             Node.findById(123).update({ name: 'Alice', email: 'alice@home.com' })
            "START n = node(123) SET n.`name` = 'Alice', n.`email` = 'alice@home.com' RETURN n, labels(n);"
            "START n = node({_node_id_}) SET n.`name` = {_value0_}, n.`email` = {_value1_} RETURN n, labels(n);"
            { _value0_: 'Alice', _value1_: 'alice@home.com', _node_id_: 123 }
          ]

        "Node.findById(123).update({ 'name': 'Alice', 'age': 20 })":
          [
             Node.findById(123).update({ 'name': 'Alice', 'age': 20 })
            "START n = node(123) SET n.`name` = 'Alice', n.`age` = 20 RETURN n, labels(n);"
          ]

        "Node.findOne().whereRelationship({ length: 20 })":
          [
             Node.findOne().whereRelationship({ length: 20 })
            "START n = node(*), r = relationship(*) WHERE ( HAS (r.`length`) AND r.`length` = 20 ) RETURN n, r, labels(n) LIMIT 1;"
          ]

        "Node.findAll().where( { $and : [ { name: { $in: [ 'a', 'b', 1, 2 ] } }, mail: { $in: 1 } ] } )":
          [
             Node.findAll().where( { $and : [ { name: { $in: [ 'a', 'b', 1, 2 ] } }, mail: { $in: 1 } ] } )
            "START n = node(*) WHERE ( ( HAS (n.`name`) AND n.`name` IN [ 'a', 'b', 1, 2 ] AND HAS (n.`mail`) AND n.`mail` IN [ ] ) ) RETURN n, labels(n);"
          ]

        #
        # Custom Graph Queries
        #

        "Graph.create()":
          [
            Graph.create({ 'n:Person' : {
              name: 'Andres',
              title: 'Developer'
            }}),
            """
              CREATE ( n:Person { `name` : 'Andres', `title` : 'Developer' } );
            """,
            """
              CREATE ( n:Person { `name` : {_value0_}, `title` : {_value1_} } );
            """,
            { value0: 'Andres', value1: 'Developer' }
          ]

        "Graph.set()":
          [
            Graph.start('n = node(123)')
              .set({"n.name": 'Philipp', "n.year": 1982, "n.surname": null })
              .setWith({ n : { "name": 'Philipp', "year": 1982, "surname": null } }),
            """
              START n = node(123)
              SET n.`name` = 'Philipp', n.`year` = 1982, n.`surname` = NULL
              SET n = { `name` : 'Philipp', `year` : 1982, `surname` : NULL };
            """,
            """
              START n = node(123)
              SET n.`name` = {_value0_}, n.`year` = {_value1_}, n.`surname` = {_value2_}
              SET n = { `name` : {_value3_}, `year` : {_value4_}, `surname` : {_value5_} };
            """,
            { _value0_: 'Philipp', _value1_: 1982, _value2_: null, _value3_: 'Philipp', _value4_: 1982, _value5_: null }
          ]

        "Graph.start()…":
          [
            Graph.start('_start_')
              .match('_match_')
              .onMatch([ '(on)-[r:RELTYPE ', { key1: 'value1', key2: 'value2' }, ']-(match)' ])
              .optionalMatch({ key3: 'value3' })
              .where('n.name = {value1} OR n.name = {value2}')
              .where({ $OR: [ { 'n.name': 'Bob' }, { 'n.name': 'bob' } ] })
              .where('n.name = {name}', { name: 'Lucy' })
              .addParameters({value1: 'Bob'})
              .addParameters({value2: 'bob'})
              .with('_with_')
              .orderBy('_order by_')
              .skip(0)
              .limit(0)
              .delete('_delete_')
              .return('_return_')
              .create('_create_')
              .onCreate('_on create_')
              .createUnique('_create unique_')
              .merge('_merge_')
              .remove('_remove_')
              .set('_set_')
              .foreach('_foreach_')
              .case('CASE  _case_   END')
              .custom('custom statement')
              .comment('comment'),
            """
              START _start_
              MATCH _match_
              ON MATCH (on)-[r:RELTYPE { `key1` : 'value1', `key2` : 'value2' }]-(match)
              OPTIONAL MATCH { `key3` : 'value3' }
              WHERE n.name = {value1} OR n.name = {value2}
              WHERE ( HAS (n.`name`) AND n.`name` = 'Bob' OR HAS (n.`name`) AND n.`name` = 'bob' )
              WHERE n.name = {name}
              WITH _with_
              ORDER BY _order by_
              SKIP 0
              LIMIT 0
              DELETE _delete_
              RETURN _return_
              CREATE _create_
              ON CREATE _on create_
              CREATE UNIQUE _create unique_
              MERGE _merge_
              REMOVE _remove_
              SET _set_
              FOREACH _foreach_
              CASE _case_ END
              custom statement
              /* comment */;
            """,
            """
              START _start_
              MATCH _match_
              ON MATCH (on)-[r:RELTYPE { `key1` : {_value0_}, `key2` : {_value1_} }]-(match)
              OPTIONAL MATCH { `key3` : {_value2_} }
              WHERE n.name = {value1} OR n.name = {value2}
              WHERE ( HAS (n.`name`) AND n.`name` = {_value3_} OR HAS (n.`name`) AND n.`name` = {_value4_} )
              WHERE n.name = {name}
              WITH _with_
              ORDER BY _order by_
              SKIP 0
              LIMIT 0
              DELETE _delete_
              RETURN _return_
              CREATE _create_
              ON CREATE _on create_
              CREATE UNIQUE _create unique_
              MERGE _merge_
              REMOVE _remove_
              SET _set_
              FOREACH _foreach_
              CASE _case_ END
              custom statement
              /* comment */;
            """,
            { _value0_:"value1", _value1_: "value2", _value2_: "value3", _value3_: "Bob", _value4_: "bob", name: 'Lucy', value1: "Bob", value2: "bob" }
          ]

        # http://gist.neo4j.org/?6506717
        "Graph.start().match(…":
          [
            Graph
            .start()
            .match(  '(game:Game)-[c:contains]->(position:Position)')
            .comment('Select games with title "Wes vs Alvin"')
            .where({ 'game.title': "Wes vs Alvin" })
            .with(   'game, collect(position) AS positions')
            .match(  'game-[c:contains]->(position:Position)')
            .with(   'positions, c, position')
            .orderBy({ 'c.move': 'ASC' })
            .match(   'position-[m:move]->next')
            .where(   'next IN (positions)')
            .return(  '(c.move+1)/2 as move, position.to_move as player, m.move, next.score as score')
            .limit(20),
            """
              MATCH (game:Game)-[c:contains]->(position:Position)
              /* Select games with title "Wes vs Alvin" */
              WHERE HAS (game.`title`) AND game.`title` = 'Wes vs Alvin'
              WITH game, collect(position) AS positions MATCH game-[c:contains]->(position:Position)
              WITH positions, c, position
              ORDER BY c.move ASC
              MATCH position-[m:move]->next
              WHERE next IN (positions)
              RETURN (c.move+1)/2 as move, position.to_move as player, m.move, next.score as score
              LIMIT 20;
            """,
            """
              MATCH (game:Game)-[c:contains]->(position:Position)
              /* Select games with title "Wes vs Alvin" */
              WHERE HAS (game.`title`) AND game.`title` = {_value0_}
              WITH game, collect(position) AS positions MATCH game-[c:contains]->(position:Position)
              WITH positions, c, position
              ORDER BY c.move ASC
              MATCH position-[m:move]->next
              WHERE next IN (positions)
              RETURN (c.move+1)/2 as move, position.to_move as player, m.move, next.score as score
              LIMIT 20;
            """,
            { _value0_: 'Wes vs Alvin'}
          ]

      # Build queries without parameters
      helpers.CypherQuery::useParameters = false
      map = testQueries()

      # check all other queries
      for functionCall of map
        todo = map[functionCall]
        if todo?[2] is null
          console.log 'pending '+functionCall+' ~> '+_trim(todo[0].toCypherQuery())
        else if _.isArray(todo)
          query = todo[0]
          query = query.toCypherQuery()
          query = _trim(query);
          throw Error("Error by building query #{functionCall}\nExpected: #{_trim(todo[1])}\nGot:      #{query}") if query isnt _trim(todo[1])
        else
          console.log 'skipping '+functionCall+' ~> '+_trim(todo.toCypherQuery())

      # Build queries with parameters
      helpers.CypherQuery::useParameters = true
      map = testQueries()
      for functionCall of map
        todo = map[functionCall]
        if todo?[2] is null
          console.log 'pending '+functionCall+' ~> '+_trim(todo[0].toCypherQuery())
        else if _.isArray(todo)
          if todo[2] and todo[3]
            query = todo[0]
            # check paramers matching
            # do we have same parameters count?
            unless query.toQuery().parameters
              throw Error("Expected parameter values for '" + todo[2] + "' instead of `"+query.toQuery().parameters+"`")
            if Object.keys(query.toQuery().parameters).length isnt Object.keys(todo[3]).length
              throw Error("Expected #{Object.keys(todo[3]).length} parameter(s) on '#{functionCall}': "+JSON.stringify(todo[3])+"\nGot "+JSON.stringify(query.toQuery().parameters))
            # expect(query.cypher.parameters.length).to.be.equal Object.keys(todo[3]).length
            i = 0
            for key, value of todo[3]
              # check that value of parameter in query is same as expected (sequence of parameters has relevance)
              if query.cypher.parameters[Object.keys(query.cypher.parameters)[i]] isnt value
                throw Error([ "Expected", "`"+query.cypher.parameters[Object.keys(query.cypher.parameters)[i]]+"`", "to be equal", "`#{value}`", " for `#{todo[2]}" ].join(' '))
              i++
            queryString = query.toQuery().toCypher()
            trimQueryString = _trim(queryString);
            if trimQueryString isnt _trim(todo[2])
              throw Error("Error building query with parameters #{functionCall}\nExpected: #{_trim(todo[2])}\nGot:      #{trimQueryString}")
        else
          console.log 'skipping '+functionCall+' ~> '+_trim(todo.toCypherQuery())

      # set the parameter flag to the value it had before this test
      helpers.CypherQuery::cypher.useParameters = true
