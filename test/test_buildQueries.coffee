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

  # patter matching for objects we will need for the tests
  {Graph,Node,helpers,client}  = new Neo4j(configForTest.neo4jURL)

else if window?
  # tests in browser
  configForTest = _.extend({
    doLog: false
    wipeDatabase: false
    neo4jURL: 'http://yourserver:0000/'
    startInstantly: false
  }, configForTest or {})
  Join = window.Join
  neo4jmapper = Neo4jMapper.init(configForTest.neo4jURL)
  {Graph,Node,helpers,client} = neo4jmapper
  Neo4j = Neo4jMapper.init

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
      
      # expect(Node.findOne().deleteIncludingRelationships).withArgs(->).to.throwError()
      # expect(Node.find().deleteIncludingRelationships().limit).withArgs(1, ->).to.throwError()

    it 'expect to build various kind of queries', ->

      # we will deactivate temporarily parameter seperating for testing the query building
      # http://docs.neo4j.org/chunked/stable/rest-api-cypher.html#rest-api-send-queries-with-parameters
      expect(Node::cypher._useParameters).to.be true
      

      class Actor extends Node
      Node.register_model(Actor)
      node = new Node()
      results = []
      testQueries = ->
        
        "Node.findAll()":
          [
             Node.findAll()
            'START n = node(*) RETURN n;'
          ]
        
        "Node.findById(123)":
          [
            Node.findById(123)
            "START n = node(*) WHERE id(n) = 123 RETURN n;"
          ]

        'Node.findOne()':
          [
             Node.findOne()
            'START n = node(*) RETURN n LIMIT 1;'
          ]
        
        "Node.findAll().limit(10)":
          [
             Node.findAll().limit(10)
            'START n = node(*) RETURN n LIMIT 10;'
          ]

        "Node.findAll().match('n:Person')":
          [
             Node.findAll().match('n:Person')
            "MATCH n:Person RETURN n;"
          ]

        "Actor.findAll()":
          [
             Actor.findAll()
            "START n = node(*) MATCH n:Actor RETURN n;"
          ]
        
        "Node.findAll().skip(5)":
          [
             Node.findAll().skip(5)
            'START n = node(*) RETURN n SKIP 5;'
          ]

        "Node.start().match('p:PERSON-[:KNOWS]->a:Actor-[:ACTS]->m:Movie').return('p AS Person')":
          [
             Node.start().match('p:PERSON-[:KNOWS]->a:Actor-[:ACTS]->m:Movie').return('p AS Person')
            'MATCH p:PERSON-[:KNOWS]->a:Actor-[:ACTS]->m:Movie RETURN p AS Person;'
          ]
        

        "Node.findAll().orderBy( { 'name': 'DESC' } )":
          [
             Node.findAll().orderBy( { 'name': 'DESC' })
            'START n = node(*) WHERE HAS (n.`name`) RETURN n ORDER BY n.`name` DESC;'
          ]

        "Node.findAll().orderNodeBy({'name': 'ASC'})":
          [
             Node.findAll().orderNodeBy({'name': 'ASC'})
            'START n = node(*) WHERE HAS (n.`name`) RETURN n ORDER BY n.`name` ASC;'
          ]
        
        'Node.findAll().incomingRelations()':
          [
             Node.findAll().incomingRelations()
            'START n = node(*) MATCH (n)<-[r]-() RETURN r;'
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
            "MATCH (n)-[r:know]-() RETURN n LIMIT 1;"
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
            "START n = node(*) WHERE ( n.`name`? = 'Alice' ) RETURN n LIMIT 1;"
            "START n = node(*) WHERE ( n.`name`? = {_value0_} ) RETURN n LIMIT 1;"
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
            "START n = node(1), m = node(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (n.`since`) AND n.`since` = 'years' ) RETURN r, n;"
            "START n = node(1), m = node(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (n.`since`) AND n.`since` = {_value0_} ) RETURN r, n;"
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
            "START n = node(*) WHERE ( HAS (n.`boolean_a`) AND n.`boolean_a` = true AND HAS (n.`boolean_b`) AND n.`boolean_b` = false AND HAS (n.`string_a`) AND n.`string_a` = 'true' AND HAS (n.`number_a`) AND n.`number_a` = 123.2 AND HAS (n.`number_b`) AND n.`number_b` = 123 AND HAS (n.`string_b`) AND n.`string_b` = '123' AND HAS (n.`regex`) AND n.`regex` =~ '[a-z]' ) RETURN n;"
            "START n = node(*) WHERE ( HAS (n.`boolean_a`) AND n.`boolean_a` = {_value0_} AND HAS (n.`boolean_b`) AND n.`boolean_b` = {_value1_} AND HAS (n.`string_a`) AND n.`string_a` = {_value2_} AND HAS (n.`number_a`) AND n.`number_a` = {_value3_} AND HAS (n.`number_b`) AND n.`number_b` = {_value4_} AND HAS (n.`string_b`) AND n.`string_b` = {_value5_} AND HAS (n.`regex`) AND n.`regex` =~ {_value6_} ) RETURN n;"
            { _value0_: true, _value1_: false, _value2_: 'true', _value3_: 123.2, _value4_: 123, _value5_: '123', _value6_: '[a-z]' }
          ]

        "Node.find({ $and : [ { a: 1 }, { b: 2} ] })":
          [
             Node.find({ $and : [ { a: 1 }, { b: 2} ] })
            "START n = node(*) WHERE ( ( HAS (n.`a`) AND n.`a` = 1 AND HAS (n.`b`) AND n.`b` = 2 ) ) RETURN n;"
            "START n = node(*) WHERE ( ( HAS (n.`a`) AND n.`a` = {_value0_} AND HAS (n.`b`) AND n.`b` = {_value1_} ) ) RETURN n;"
            { _value0_: 1, _value1_: 2 }
          ]
        
        "Node.find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})":
          [
             Node.find().where( { $or : [ { 'n.firstname': /alice/i } , { 'n.surname': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})
            "START n = node(*) WHERE HAS (n.`name`) AND ( ( HAS (n.`firstname`) AND n.firstname =~ '(?i)alice' OR HAS (n.`surname`) AND n.surname =~ '(?i)bob' ) ) RETURN n ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
            "START n = node(*) WHERE HAS (n.`name`) AND ( ( HAS (n.`firstname`) AND n.firstname =~ {_value0_} OR HAS (n.`surname`) AND n.surname =~ {_value1_} ) ) RETURN n ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
            { _value0_: '(?i)alice', _value1_: '(?i)bob' }
          ]

        "Actor.find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})":
          [
             Actor.find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})
            "START n = node(*) MATCH n:Actor WHERE HAS (n.`name`) AND ( ( HAS (n.`name`) AND n.name =~ '(?i)alice' OR HAS (n.`name`) AND n.name =~ '(?i)bob' ) ) RETURN n ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
          ]
        
        "Node.findOne().where({ 'n.city': 'berlin' }).andHasProperty('name').return('n AS Person')":
          [
            Node.findOne().where({ 'n.city': 'berlin' }).andHasProperty('name').return('n AS Person')
            "START n = node(*) WHERE HAS (n.`name`) AND ( HAS (n.`city`) AND n.city = 'berlin' ) RETURN n AS Person LIMIT 1;"
          ]

        "Node.findOne([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ]).returnOnly('n.name AS Name')":
          [
             Node.findOne([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ]).return('n.name AS Name')
            "START n = node(*) WHERE ( HAS (n.`city`) AND n.city = 'berlin' AND ( HAS (n.`name`) AND n.name = 'peter' AND NOT ( HAS (n.`name`) AND n.name = 'pedro' ) ) ) RETURN n.name AS Name LIMIT 1;"
          ]
        
        "Node.findById(123).incomingRelations().delete()":
          [
             Node.findById(123).incomingRelations().delete()
            "START n = node(123) MATCH (n)<-[r]-() DELETE r;"
          ]
        
        "Node.findById(123).allRelations().delete()":
          [
             Node.findById(123).allRelations().delete()
            "MATCH n-[r]-() WHERE id(n) = 123 DELETE r;"
          ]

        "Actor.delete_all_including_relations()":
          [
             Actor.deleteAllIncludingRelations()
            "START n = node(*) MATCH n:Actor-[r?]-() DELETE n, r;"
          ]

        "Node.find().deleteIncludingRelations()":
          [
             Node.find().deleteIncludingRelations()
            "START n = node(*) MATCH n-[r?]-() DELETE n, r;"
          ]

        "Actor.find().deleteIncludingRelations()":
          [
             Actor.find().deleteIncludingRelations()
            "START n = node(*) MATCH n:Actor-[r?]-() DELETE n, r;"
          ]

        # "Node.findById(123).update({ name: 'Alice' })":
        #   [
        #      Node.findById(123).update({ 'name': 'Alice' }),
        #     "START n = node(*) WHERE id(n) = 123 SET n.`name` = 'Alice' RETURN n;",
        #     "START n = node(*) WHERE id(n) = 123 SET n.`name` = {value0} RETURN n;",
        #     { value0: 'Alice' }
        #     # { value0: 'Alice' }
        #   ]

        "Node.findById(123).update({ 'name': 'Alice', 'age': 20 })":
          [
             Node.findById(123).update({ 'name': 'Alice', 'age': 20 })
            "START n = node(*) WHERE id(n) = 123 SET n.`name` = 'Alice', n.`age` = 20 RETURN n;"
          ]

        "Node.findOne().whereRelationship({ length: 20 })":
          [
             Node.findOne().whereRelationship({ length: 20 })
            "START n = node(*), r = relationship(*) WHERE ( HAS (r.`length`) AND r.`length` = 20 ) RETURN n, r LIMIT 1;"
          ]

        "Node.findAll().where( { name: { $in: [ 'a', 'b', 1, 2 ] } } )":
          [
             Node.findAll().where( { name: { $in: [ 'a', 'b', 1, 2 ] } } )
            "START n = node(*) WHERE ( HAS (n.`name`) AND n.`name` IN [ 'a', 'b', 1, 2 ] ) RETURN n;"
          ]

        #
        # Custom Graph Queries
        #

        "Graph.start()…":
          [
            Graph.start('start')
              .match('match')
              .onMatch('on match')
              .where('n.name = {value1} OR n.name = {value2}')
              .parameters({value1: 'Bob'})
              .addParameters({value2: 'bob'})
              .with('with')
              .orderBy('order by')
              .skip(0)
              .limit(0)
              .delete('delete')
              .return('return')
              .create('create')
              .onCreate('on create')
              .createUnique('create unique')
              .merge('merge')
              .remove('remove')
              .set('set')
              .foreach('foreach')
              .case('case')
              .custom('custom statement')
              .comment('comment'),
            """
              START start
              MATCH match
              ON MATCH on match
              WHERE n.name = {value1} OR n.name = {value2}
              WITH with
              ORDER BY order by
              SKIP 0
              LIMIT 0
              DELETE delete
              RETURN return
              CREATE create
              ON CREATE on create
              CREATE UNIQUE create unique
              MERGE merge
              REMOVE remove
              SET set
              FOREACH foreach
              CASE case END
              custom statement
              /* comment */;
            """,
            """
              START start
              MATCH match
              ON MATCH on match
              WHERE n.name = {value1} OR n.name = {value2}
              WITH with
              ORDER BY order by
              SKIP 0
              LIMIT 0
              DELETE delete
              RETURN return
              CREATE create
              ON CREATE on create
              CREATE UNIQUE create unique
              MERGE merge
              REMOVE remove
              SET set
              FOREACH foreach
              CASE case END
              custom statement
              /* comment */;
            """,
            { value1: 'Bob', value2: 'bob' }
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
              WHERE HAS (game.title) AND game.title = 'Wes vs Alvin'
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
              WHERE HAS (game.title) AND game.title = {_value0_}
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
      Node::cypher._useParameters = false
      Graph::cypher._useParameters = false
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
      Node::cypher._useParameters = true
      Graph::cypher._useParameters = true
      map = testQueries()
      for functionCall of map
        todo = map[functionCall]
        if todo?[2] is null
          console.log 'pending '+functionCall+' ~> '+_trim(todo[0].toCypherQuery())
        else if _.isArray(todo)
          if todo[2] and todo[3]
            query = todo[0]
            # check paramers macthing
            # do we have same parameters count?
            if Object.keys(query.cypher.parameters).length isnt Object.keys(todo[3]).length
              throw Error("Expected #{Object.keys(todo[3]).length} parameter(s) on '#{functionCall}': "+JSON.stringify(todo[3])+"\nGot "+JSON.stringify(query.cypher.parameters))
            # expect(query.cypher.parameters.length).to.be.equal Object.keys(todo[3]).length
            i = 0
            for key, value of todo[3]
              # check that value of parameter in query is same as expected (sequence of parameters has relevance)
              if query.cypher.parameters[Object.keys(query.cypher.parameters)[i]] isnt value
                throw Error("Expected #{query.cypher.parameters[Object.keys(query.cypher.parameters)[i]]} to be equal #{functionCall} on ")
              i++
            query = query.toCypherQuery()
            query = _trim(query);
            throw Error("Error building query with parameters #{functionCall}\nExpected: #{_trim(todo[2])}\nGot:      #{query}") if query isnt _trim(todo[2])
        else
          console.log 'skipping '+functionCall+' ~> '+_trim(todo.toCypherQuery())

      # set the parameter flag to the value it had before this test
      Node::cypher._useParameters = true
