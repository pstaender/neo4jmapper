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
        Node.findOne().deleteIncludingRelationships ->
      catch e
        err = e
      expect(err).not.to.be null
      err = null
      try
        Node.find().deleteIncludingRelationships().limit 1, ->
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
        
        "Node::findAll()":
          [
             Node::findAll(),
            'START n = node(*) RETURN n;'
          ]
        
        "Node::findById(123)":
          [
            Node::findById(123),
            "START n = node(*) WHERE id(n) = 123 RETURN n;"
          ]

        'Node::findOne()':
          [
             Node::findOne(),
            'START n = node(*) RETURN n LIMIT 1;'
          ]
        
        "Node::findAll().limit(10)":
          [
             Node::findAll().limit(10),
            'START n = node(*) RETURN n LIMIT 10;'
          ]

        "Node::findAll().match('n:Person')":
          [
             Node::findAll().match('n:Person'),
            "MATCH n:Person RETURN n;"
          ]

        "Actor::findAll()":
          [
             Actor::findAll(),
            "START n = node(*) MATCH n:Actor RETURN n;"
          ]
        
        "Node::findAll().skip(5)":
          [
             Node::findAll().skip(5),
            'START n = node(*) RETURN n SKIP 5;'
          ]
        

        "Node::findAll().orderBy( { 'name': 'DESC' } )":
          [
             Node::findAll().orderBy( { 'name': 'DESC' }),
            'START n = node(*) WHERE HAS (n.`name`) RETURN n ORDER BY n.`name` DESC;'
          ]

        "Node::findAll().orderNodeBy({'name': 'ASC'})":
          [
             Node::findAll().orderNodeBy({'name': 'ASC'}),
            'START n = node(*) WHERE HAS (n.`name`) RETURN n ORDER BY n.`name` ASC;'
          ]
        
        'Node::findAll().incomingRelationships()':
          [
             Node::findAll().incomingRelationships(),
            'START n = node(*) MATCH (n)<-[r]-() RETURN r;'
          ]

        'Actor::findAll().incomingRelationships()':
          [
             Actor::findAll().incomingRelationships(),
            'START n = node(*) MATCH (n:Actor)<-[r]-() RETURN r;'
          ]
        
        'Node::findAll().outgoingRelationships()':
          [
             Node::findAll().outgoingRelationships(),
            'START n = node(*) MATCH (n)-[r]->() RETURN r;'
          ]

        "Node::findAll().incomingRelationships()":
          [
             Node::findAll().incomingRelationships(),
            'START n = node(*) MATCH (n)<-[r]-() RETURN r;'
          ]
        
        "Node::findOne().outgoingRelationships(['know','like'])":
          [
             Node::findOne().outgoingRelationships(['know','like']),
            'START n = node(*) MATCH (n)-[r:know|like]->() RETURN r LIMIT 1;'
          ]

        "Node::findOne().outgoingRelationshipsTo(2, ['know','like'])":
          [
             Node::findOne().outgoingRelationshipsTo(2, ['know','like']),
            'START n = node(*), m = node(2) MATCH (n)-[r:know|like]->(m) RETURN r LIMIT 1;'
          ]


        "Node::findOne().where({ 'name?': 'Alice'})":
          [
             Node::findOne().where({ 'name?': 'Alice' })
            "START n = node(*) WHERE ( n.`name`? = 'Alice' ) RETURN n LIMIT 1;"
            "START n = node(*) WHERE ( n.`name`? = {value0} ) RETURN n LIMIT 1;"
            { value0: 'Alice'}
          ]

        "Node::findOne().where({name: 'Alice'}).outgoingRelationships()":
          [
             Node::findOne().where({name: 'Alice'}).outgoingRelationships(),
            "START n = node(*) MATCH (n)-[r]->() WHERE ( HAS (n.`name`) AND n.`name` = 'Alice' ) RETURN r LIMIT 1;"
            "START n = node(*) MATCH (n)-[r]->() WHERE ( HAS (n.`name`) AND n.`name` = {value0} ) RETURN r LIMIT 1;"
            { value0: 'Alice'}
          ]
        
        "Node::findAll().outgoingRelationships('know').distinct().count()":
          [
             Node::findAll().outgoingRelationships('know').distinct().count(),
            'START n = node(*) MATCH (n)-[r:know]->() RETURN COUNT(DISTINCT *);'
          ]
        
        "Node::singleton(1).incomingRelationshipsFrom(2, 'like').where({ 'since': 'years' })":
          [
             Node::singleton(1).incomingRelationshipsFrom(2, 'like').where({ 'since': 'years' })
            "START n = node(1), m = node(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (n.`since`) AND n.`since` = 'years' ) RETURN r, n;"
            "START n = node(1), m = node(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (n.`since`) AND n.`since` = {value0} ) RETURN r, n;"
            { value0: 'years' }
          ]

        "Node::singleton(1).incomingRelationshipsFrom(2, 'like').whereRelationship({ 'since': 'years' })":
          [
             Node::singleton(1).incomingRelationshipsFrom(2, 'like').whereRelationship({ 'since': 'years' }),
            "START n = node(1), m = node(*), r = relationship(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (r.`since`) AND r.`since` = 'years' ) RETURN r;"
            "START n = node(1), m = node(*), r = relationship(*) MATCH (n)<-[r:like]-(m) WHERE ( HAS (r.`since`) AND r.`since` = {value0} ) RETURN r;"
            { value0: 'years'}
          ]

        "Node::find().whereNode({ 'boolean_a': true, 'boolean_b': false, 'string_a': 'true', 'number_a': 123.2, 'number_b': 123, 'string_b': '123', 'regex': /[a-z]/ })":
          [
             Node::find().whereNode({ 'boolean_a': true, 'boolean_b': false, 'string_a': 'true', 'number_a': 123.2, 'number_b': 123, 'string_b': '123', 'regex': /[a-z]/ }),
            "START n = node(*) WHERE ( HAS (n.`boolean_a`) AND n.`boolean_a` = true AND HAS (n.`boolean_b`) AND n.`boolean_b` = false AND HAS (n.`string_a`) AND n.`string_a` = 'true' AND HAS (n.`number_a`) AND n.`number_a` = 123.2 AND HAS (n.`number_b`) AND n.`number_b` = 123 AND HAS (n.`string_b`) AND n.`string_b` = '123' AND HAS (n.`regex`) AND n.`regex` =~ '[a-z]' ) RETURN n;"
            "START n = node(*) WHERE ( HAS (n.`boolean_a`) AND n.`boolean_a` = {value0} AND HAS (n.`boolean_b`) AND n.`boolean_b` = {value1} AND HAS (n.`string_a`) AND n.`string_a` = {value2} AND HAS (n.`number_a`) AND n.`number_a` = {value3} AND HAS (n.`number_b`) AND n.`number_b` = {value4} AND HAS (n.`string_b`) AND n.`string_b` = {value5} AND HAS (n.`regex`) AND n.`regex` =~ {value6} ) RETURN n;"
            { value0: true, value1: false, value2: 'true', value3: 123.2, value4: 123, value5: '123', value6: '[a-z]' }
          ]

        "Node::find({ a: 1 }).andWhere({ b: 2})":
          [
             Node::find({ a: 1 }).andWhere({ b: 2})
            "START n = node(*) WHERE ( HAS (n.`a`) AND n.`a` = 1 ) AND ( HAS (n.`b`) AND n.`b` = 2 ) RETURN n;"
            "START n = node(*) WHERE ( HAS (n.`a`) AND n.`a` = {value0} ) AND ( HAS (n.`b`) AND n.`b` = {value1} ) RETURN n;"
            { value0: 1, value1: 2 }
          ]
        
        "Node::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})":
          [
             Node::find().where( { $or : [ { 'n.firstname': /alice/i } , { 'n.surname': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})
            "START n = node(*) WHERE HAS (n.`name`) AND ( ( HAS (n.`firstname`) AND n.firstname =~ '(?i)alice' OR HAS (n.`surname`) AND n.surname =~ '(?i)bob' ) ) RETURN n ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
            "START n = node(*) WHERE HAS (n.`name`) AND ( ( HAS (n.`firstname`) AND n.firstname =~ {value0} OR HAS (n.`surname`) AND n.surname =~ {value1} ) ) RETURN n ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
            { value0: '(?i)alice', value1: '(?i)bob' }
          ]

        "Actor::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})":
          [
             Actor::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})
            "START n = node(*) MATCH n:Actor WHERE HAS (n.`name`) AND ( ( HAS (n.`name`) AND n.name =~ '(?i)alice' OR HAS (n.`name`) AND n.name =~ '(?i)bob' ) ) RETURN n ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
          ]
        
        "Node::findOne().whereHasProperty('name').andWhere({ 'n.city': 'berlin' }":
          [
            Node::findOne().whereHasProperty('name').andWhere({ 'n.city': 'berlin' })
            "START n = node(*) WHERE HAS (n.`name`) AND ( HAS (n.`city`) AND n.city = 'berlin' ) RETURN n LIMIT 1;"
          ]

        "Node::findOne([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ])":
          [
             Node::findOne([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ]),
            "START n = node(*) WHERE ( HAS (n.`city`) AND n.city = 'berlin' AND ( HAS (n.`name`) AND n.name = 'peter' AND NOT ( HAS (n.`name`) AND n.name = 'pedro' ) ) ) RETURN n LIMIT 1;"
          ]
        
        "Node::findById(123).incomingRelationships().delete().toCypherQuery()":
          [
             Node::findById(123).incomingRelationships().delete(),
            "START n = node(123) MATCH (n)<-[r]-() DELETE r;"
          ]
        
        "Node::findById(123).allRelationships().delete()":
          [
             Node::findById(123).allRelationships().delete()
            "MATCH n-[r]-() WHERE id(n) = 123 DELETE r;"
          ]

        "Node.find().deleteIncludingRelationships()":
          [
             Node.find().deleteIncludingRelationships()
            "START n = node(*) MATCH n-[r?]-() DELETE n, r;"
          ]

        "Actor.find().deleteIncludingRelationships()":
          [
             Actor.find().deleteIncludingRelationships()
            "START n = node(*) MATCH n:Actor-[r?]-() DELETE n, r;"
          ]

        # "Node.findById(123).update({ name: 'Alice' })":
        #   [
        #      Node.findById(123).update({ 'name': 'Alice' })
        #     "START n = node(*) WHERE id(n) = 123 SET n.`name` = 'Alice' RETURN n;"
        #     "START n = node(*) WHERE id(n) = 123 SET n.`name` = {value0} RETURN n;"
        #     { value0: 'Alice' }
        #   ]

        "Node.findById(123).update({ 'name': 'Alice', 'age': 20 })":
          [
             Node.findById(123).update({ 'name': 'Alice', 'age': 20 }),
            "START n = node(*) WHERE id(n) = 123 SET n.`name` = 'Alice', n.`age` = 20 RETURN n;"
          ]

        "Node.findOne().whereRelationship({ length: 20 })":
          [
             Node.findOne().whereRelationship({ length: 20 })
            "START n = node(*), r = relationship(*) WHERE ( HAS (r.`length`) AND r.`length` = 20 ) RETURN n, r LIMIT 1;"
          ]

      # Build queries without parameters
      Node::cypher._useParameters = false
      map = testQueries()

      # check all other queries
      for functionCall of map
        todo = map[functionCall]
        if todo?[2] is null
          console.log 'pending '+functionCall+' ~> '+_trim(todo[0].toCypherQuery())
        else if _.isArray(todo)
          query = todo[0].toCypherQuery()
          query = _trim(query);
          throw Error("Error by building query #{functionCall}\nExpected: #{_trim(todo[1])}\nGot:      #{query}") if query isnt _trim(todo[1])
        else
          console.log 'skipping '+functionCall+' ~> '+_trim(todo.toCypherQuery())

      # Build queries with parameters
      Node::cypher._useParameters = true
      map = testQueries()
      for functionCall of map
        todo = map[functionCall]
        if todo?[2] is null
          console.log 'pending '+functionCall+' ~> '+_trim(todo[0].toCypherQuery())
        else if _.isArray(todo)
          if todo[2] #and todo[3]
            query = todo[0]
            # check paramers macthing
            # do we have same parameters count?
            expect(query.cypher.parameters.length).to.be.equal Object.keys(todo[3]).length
            i = 0
            for key, value of todo[3]
              # check that value of parameter in query is same as expected (sequence of parameters has relevance)
              expect(query.cypher.parameters[i]).to.be.equal value
              i++
            query = query.toCypherQuery()
            query = _trim(query);
            throw Error("Error building query with parameters #{functionCall}\nExpected: #{_trim(todo[2])}\nGot:      #{query}") if query isnt _trim(todo[2])
        else
          console.log 'skipping '+functionCall+' ~> '+_trim(todo.toCypherQuery())

      # set the parameter flag to the value it had before this test
      Node::cypher._useParameters = true
