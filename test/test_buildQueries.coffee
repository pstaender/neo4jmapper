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
      class Actor extends Node
      Node.register_model(Actor)
      node = new Node()
      results = []
      map =
        
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
            'START n = node(*) WHERE ( HAS (n.`name`) ) RETURN n ORDER BY n.`name` DESC;'
          ]

        "Node::findAll().orderNodeBy({'name': 'ASC'})":
          [
             Node::findAll().orderNodeBy({'name': 'ASC'}),
            'START n = node(*) WHERE ( HAS (n.`name`) ) RETURN n ORDER BY n.`name` ASC;'
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
             Node::findOne().where({ 'name?': 'Alice' }),
            "START n = node(*) WHERE ( n.`name`? = 'Alice' ) RETURN n LIMIT 1;"
          ]

        "Node::findOne().where({name: 'Alice'}).outgoingRelationships()":
          [
             Node::findOne().where({name: 'Alice'}).outgoingRelationships(),
            "START n = node(*) MATCH (n)-[r]->()  WHERE ( HAS (n.`name`) ) AND ( n.`name` = 'Alice' ) RETURN r LIMIT 1;" 
          ]
        
        "Node::findAll().outgoingRelationships('know').distinct().count()":
          [
             Node::findAll().outgoingRelationships('know').distinct().count(),
            'START n = node(*) MATCH (n)-[r:know]->() RETURN COUNT(DISTINCT *);'
          ]
        
        "Node::singleton(1).incomingRelationshipsFrom(2, 'like').where({ 'r.since': 'years' })":
          [
             Node::singleton(1).incomingRelationshipsFrom(2, 'like').where({ 'r.since': 'years' }),
            "START n = node(1), m = node(2) MATCH (n)<-[r:like]-(m) WHERE ( HAS (r.`since`) ) AND ( r.since = 'years' ) RETURN r;"
          ]

        "Node::singleton(1).incomingRelationshipsFrom(2, 'like').whereRelationship({ 'since': 'years' })":
          [
             Node::singleton(1).incomingRelationshipsFrom(2, 'like').whereRelationship({ 'since': 'years' }),
            "START n = node(1), m = node(2) MATCH (n)<-[r:like]-(m) WHERE ( HAS (r.`since`) ) AND ( r.`since` = 'years' ) RETURN r;"
          ]

        "Node::find().whereNode({ 'boolean_a': true, 'boolean_b': false, 'string_a': 'true', 'number_a': 123.2, 'number_b': 123, 'string_b': '123', 'regex': /[a-z]/ })":
          [
             Node::find().whereNode({ 'boolean_a': true, 'boolean_b': false, 'string_a': 'true', 'number_a': 123.2, 'number_b': 123, 'string_b': '123', 'regex': /[a-z]/ }),
            "START n = node(*) WHERE ( HAS (n.`boolean_a`) ) AND ( HAS (n.`boolean_b`) ) AND ( HAS (n.`string_a`) ) AND ( HAS (n.`number_a`) ) AND ( HAS (n.`number_b`) ) AND ( HAS (n.`string_b`) ) AND ( HAS (n.`regex`) ) AND ( n.`boolean_a` = true AND n.`boolean_b` = false AND n.`string_a` = 'true' AND n.`number_a` = 123.2 AND n.`number_b` = 123 AND n.`string_b` = '123' AND n.`regex` =~ '[a-z]' ) RETURN n;"
          ]
        
        "Node::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})":
          [
             Node::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'}),
            "START n = node(*) WHERE ( HAS (n.`name`) ) AND ( ( n.name =~ '(?i)alice' OR n.name =~ '(?i)bob' ) ) AND ( HAS (n.`name`) ) RETURN n ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
          ]

        "Actor::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'})":
          [
             Actor::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy({ name: 'DESC'}),
            "START n = node(*) MATCH n:Actor WHERE ( HAS (n.`name`) ) AND ( ( n.name =~ '(?i)alice' OR n.name =~ '(?i)bob' ) ) AND ( HAS (n.`name`) ) RETURN n ORDER BY n.`name` DESC SKIP 2 LIMIT 10;"
          ]
        
        "Node::findOne().whereHasProperty('name').andWhere({ 'n.city': 'berlin' }":
          [
            Node::findOne().whereHasProperty('name').andWhere({ 'n.city': 'berlin' }),
            "START n = node(*) WHERE ( HAS (n.`name`) ) AND ( HAS (n.`city`) ) AND ( n.city = 'berlin' ) RETURN n LIMIT 1;"
          ]

        "Node::findOne().whereHasProperty('name').andWhere('name').andWhere([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ])":
          [
             Node::findOne().whereHasProperty('name').andWhere([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ]),
            "START n = node(*) WHERE ( HAS (n.`name`) ) AND ( HAS (n.`city`) ) AND ( HAS (n.`name`) ) AND ( n.city = 'berlin' AND ( n.name = 'peter' AND NOT ( n.name = 'pedro' ) ) ) RETURN n LIMIT 1;"
          ]
        
        "Node::findOne().whereNode([ { 'city': 'berlin' } , $and: [ { 'name': 'peter' }, $not: [ { 'name': 'pedro' } ] ] ])":
          [
            Node::findOne().where([ { 'city': 'berlin' } , $and: [ { 'name': 'peter' }, $not: [ { 'name': 'pedro' } ] ] ]),
            "START n = node(*) WHERE ( HAS (n.`city`) ) AND ( HAS (n.`name`) ) AND ( n.`city` = 'berlin' AND ( n.`name` = 'peter' AND NOT ( n.`name` = 'pedro' ) ) ) RETURN n LIMIT 1;"
          ]
        
        "Node::findById(123).incomingRelationships().delete().toCypherQuery()":
          [
             Node::findById(123).incomingRelationships().delete(),
            "START n = node(123) MATCH (n)<-[r]-() DELETE r;"
          ]
        
        "Node::findById(123).allRelationships().delete()":
          [
             Node::findById(123).allRelationships().delete(),
            "MATCH n-[r]-() WHERE id(n) = 123 DELETE r;"
          ]

        "Node.find().deleteIncludingRelationships()":
          [
             Node.find().deleteIncludingRelationships(),
            "START n = node(*) MATCH n-[r?]-() DELETE n, r;"
          ]

        "Actor.findById(123).deleteIncludingRelationships()":
          [
             Actor.find().deleteIncludingRelationships(),
            "START n = node(*) MATCH n:Actor-[r?]-() DELETE n, r;"
          ]

        "Node.findById(123).update({ name: 'Alice' })":
          [
             Node.findById(123).update({ 'name': 'Alice' }),
            "START n = node(*) WHERE id(n) = 123 SET n.`name` = 'Alice' RETURN n;"
          ]

        "Node.findById(123).update({ 'name': 'Alice', 'age': 20 })":
          [
             Node.findById(123).update({ 'name': 'Alice', 'age': 20 }),
            "START n = node(*) WHERE id(n) = 123 SET n.`name` = 'Alice', n.`age` = 20 RETURN n;"
          ]

      # check all other queries
      for functionCall of map
        todo = map[functionCall]
        if todo?[2] is null
          console.log 'pending '+functionCall+' ~> '+_trim(todo[0].toCypherQuery())
        else if _.isArray(todo)
          query = todo[0].toCypherQuery()
          query = _trim(query);
          throw Error("Error by building query #{functionCall} -> #{query}") if query isnt _trim(todo[1])
          #expect(query).to.be.equal _trim(todo[1])
        else
          console.log 'skipping '+functionCall+' ~> '+_trim(todo.toCypherQuery())