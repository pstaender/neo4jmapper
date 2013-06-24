if root?
  # external modules
  require('source-map-support').install()
  expect        = require('expect.js')
  Join          = require('join')
  _             = require('underscore')

  # load config
  configForTest = require('./config')

  # neo4j mapper modules
  Neo4j         = require('../src/index.js')

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

    it 'expect to build various kind of queries', ->
      class Actor extends Node
      Node::register_model(Actor)
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
        
        "Node::findAll().orderBy('n.name', 'ASC')":
          [
             Node::findAll().orderBy('n.name', 'ASC'),
            'START n = node(*) RETURN n ORDER BY n.name ASC;'
          ]
        
        'Node::findAll().incomingRelationships()':
          [
             Node::findAll().incomingRelationships(),
            'START a = node(*) MATCH (a)<-[r]-() RETURN r;'
          ]

        'Actor::findAll().incomingRelationships()':
          [
             Actor::findAll().incomingRelationships(),
            'START a = node(*) MATCH (a:Actor)<-[r]-() RETURN r;'
          ]
        
        'Node::findAll().outgoingRelationships()':
          [
             Node::findAll().outgoingRelationships(),
            'START a = node(*) MATCH (a)-[r]->() RETURN r;'
          ]

        "Node::findAll().incomingRelationships()":
          [
             Node::findAll().incomingRelationships(),
            'START a = node(*) MATCH (a)<-[r]-() RETURN r;'
          ]
        
        "Node::findOne().outgoingRelationships(['know','like'])":
          [
             Node::findOne().outgoingRelationships(['know','like']),
            'START a = node(*) MATCH (a)-[r:know|like]->() RETURN r LIMIT 1;'
          ]

        "Node::findOne().outgoingRelationshipsTo(2, ['know','like'])":
          [
             Node::findOne().outgoingRelationshipsTo(2, ['know','like']),
            'START a = node(*), b = node(2) MATCH (a)-[r:know|like]->(b) RETURN r LIMIT 1;'
          ]
        
        "Node::findAll().outgoingRelationships('know').distinct().count()":
          [
             Node::findAll().outgoingRelationships('know').distinct().count(),
            'START a = node(*) MATCH (a)-[r:know]->() RETURN COUNT(DISTINCT *);'
          ]
        
        "Node::singleton(1).incomingRelationshipsFrom(2, 'like').where({ 'r.since': 'years' })":
          [
             Node::singleton(1).incomingRelationshipsFrom(2, 'like').where({ 'r.since': 'years' }),
            'START a = node(1), b = node(2) MATCH (a)<-[r:like]-(b) WHERE ( HAS (r.since) ) AND ( r.since = \'years\' ) RETURN r;'
          ]

        "Node::singleton(1).incomingRelationshipsFrom(2, 'like').whereRelationship({ 'since': 'years' })":
          [
             Node::singleton(1).incomingRelationshipsFrom(2, 'like').whereRelationship({ 'since': 'years' }),
            "START a = node(1), b = node(2) MATCH (a)<-[r:like]-(b) WHERE ( HAS (r.since) ) AND ( r.since = 'years' ) RETURN r;"
          ]

        "Node::find().whereNode({ 'boolean_a': true, 'boolean_b': false, 'string_a': 'true', 'number_a': 123.2, 'number_b': 123, 'string_b': '123', 'regex': /[a-z]/ })":
          [
             Node::find().whereNode({ 'boolean_a': true, 'boolean_b': false, 'string_a': 'true', 'number_a': 123.2, 'number_b': 123, 'string_b': '123', 'regex': /[a-z]/ }),
            "START n = node(*) WHERE ( HAS (n.boolean_a) ) AND ( HAS (n.boolean_b) ) AND ( HAS (n.string_a) ) AND ( HAS (n.number_a) ) AND ( HAS (n.number_b) ) AND ( HAS (n.string_b) ) AND ( HAS (n.regex) ) AND ( n.boolean_a = true AND n.boolean_b = false AND n.string_a = 'true' AND n.number_a = 123.2 AND n.number_b = 123 AND n.string_b = '123' AND n.regex =~ '[a-z]' ) RETURN n;"
          ]
        
        "Node::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy 'n.name', 'DESC', ->":
          [
             Node::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy('n.name', 'DESC'),
            "START n = node(*) WHERE ( HAS (n.name) ) AND ( ( n.name =~ '(?i)alice' OR n.name =~ '(?i)bob' ) ) RETURN n ORDER BY n.name DESC SKIP 2 LIMIT 10;"
          ]

        "Actor::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy('n.name', 'DESC')":
          [
             Actor::find().where( { $or : [ { 'n.name': /alice/i } , { 'n.name': /bob/i } ] }).skip(2).limit(10).orderBy('n.name', 'DESC'),
            "START n = node(*) MATCH n:Actor WHERE ( HAS (n.name) ) AND ( ( n.name =~ '(?i)alice' OR n.name =~ '(?i)bob' ) ) RETURN n ORDER BY n.name DESC SKIP 2 LIMIT 10;"
          ]
        
        "Node::findOne().whereHasProperty('name').andWhere({ 'n.city': 'berlin' }":
          [
            Node::findOne().whereHasProperty('name').andWhere({ 'n.city': 'berlin' }),
            "START n = node(*) WHERE ( HAS (n.name) ) AND ( HAS (n.city) ) AND ( n.city = 'berlin' ) RETURN n LIMIT 1;"
          ]

        "Node::findOne().whereHasProperty('name').andWhere('name').andWhere([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ])":
          [
             Node::findOne().whereHasProperty('name').andWhere([ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ]),
            "START n = node(*) WHERE ( HAS (n.name) ) AND ( HAS (n.city) ) AND ( HAS (n.name) ) AND ( n.city = 'berlin' AND ( n.name = 'peter' AND NOT ( n.name = 'pedro' ) ) ) RETURN n LIMIT 1;"
          ]
        
        "Node::findOne().whereNode([ { 'city': 'berlin' } , $and: [ { 'name': 'peter' }, $not: [ { 'name': 'pedro' } ] ] ])":
          [
            Node::findOne().where([ { 'city': 'berlin' } , $and: [ { 'name': 'peter' }, $not: [ { 'name': 'pedro' } ] ] ]),
            "START n = node(*) WHERE ( HAS (n.city) ) AND ( HAS (n.name) ) AND ( n.city = 'berlin' AND ( n.name = 'peter' AND NOT ( n.name = 'pedro' ) ) ) RETURN n LIMIT 1;"
          ]
        
        "Node::findById(123).incomingRelationships().delete().toCypherQuery()":
          [
             Node::findById(123).incomingRelationships().delete(),
            'START a = node(123) MATCH (a)<-[r]-() DELETE r;'
          ]
        
        "Node::findById(123).allRelationships().delete()":
          [
             Node::findById(123).allRelationships().delete(),
            'MATCH n-[r]-() WHERE id(n) = 123 DELETE r;'
          ]

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