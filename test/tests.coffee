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
    doLog: false#console.log
    wipeDatabase: false
    neo4jURL: 'http://yourserver:0000/'
    startInstantly: false
  }, configForTest or {})
  Join = window.Join
  neo4jmapper = Neo4jMapper.init(configForTest.neo4jURL)
  {Graph,Node,helpers,client} = neo4jmapper
  Neo4j = Neo4jMapper.init

client.constructor::log = Graph::log = configForTest.doLog if configForTest.doLog

version = client.version
graphdb = null # will be initialized in before()

if (configForTest.startInstantly)
  # Start instantly
  doStart = (cb) -> cb()
else
  # Test will be started if client is ready
  doStart = (cb) ->
    client.checkAvailability ->
      version = client.version
      cb()

doStart ->

  describe 'Neo4jMapper', ->

    before (done) ->
      graphdb = new Graph(configForTest.neo4jURL)
      done()

    describe 'graph', ->

      it 'expect to create a graph object, with all variants of arguments', (done) ->
        join = Join.create()

        neo4j = new Neo4j { url: configForTest.neo4jURL }
        neo4j.client.checkAvailability join.add()

        # prefered way
        neo4j = new Neo4j(configForTest.neo4jURL)
        neo4j.client.checkAvailability join.add()      

        join.when ->
          for arg in Array::slice.apply(arguments)
            expect(arg[0]).to.be null
            expect(arg[1]).to.be.a 'string'
          done()

      it "expect #{if configForTest.wipeDatabase then "" else "not "}to remove all nodes and relationships from the database", (done) ->
        return done() unless configForTest.wipeDatabase      
        graph = new Graph()
        graph.wipeDatabase (err, res) ->
          expect(err).to.be null
          done()

      it 'expect to get information about the server', (done) ->
        graph = new Graph()
        graph.about (err, data) ->
          expect(err).to.be null
          expect(graph.info).to.be.an 'object' 
          done()

      it 'expect to get a neo4j version value', (done) ->
        graph = new Graph()
        graph.about ->
          expect(client.version).to.be.a 'number'
          expect(client.version).to.be.above 1.6
          expect(client.exact_version).to.be.a 'string'
          done()

      it 'expect to count all nodes in database', (done) ->
        graph = new Graph()
        graph.countNodes (err, count) ->
          expect(err).to.be null
          expect(count).to.be.a 'number'
          done()

      it 'expect to count all relationships in database', (done) ->
        graph = new Graph()
        graph.countRelationships (err, count) ->
          expect(err).to.be null
          expect(count).to.be.a 'number'
          done()

      it 'expect to count all nodes + relationships in database', (done) ->
        graph = new Graph()
        count = 0
        graph.countNodes (err, countNodes) ->
          count += countNodes
          graph.countRelationships (err, countRelationships) ->
            count += countRelationships
            graph.countAll (err, count) ->
              expect(err).to.be null
              expect(count).to.be.equal count
              done()

    describe 'node', ->

      it 'expect to allow inheritance', (done) ->
        class Person extends Node
          data:
            label: 'a Person'
        person = new Person()
        expect(person).to.be.an 'object'
        expect(person.id).to.be null
        expect(person.cypher.label).to.be 'Person'
        expect(person.constructor_name).to.be 'Person'
        done()

      it 'expect to create a node', (done) ->
        node = new Node title: 'test'
        node.save (err, storedNode) ->
          id = node.id
          expect(err).to.be null
          expect(storedNode.data.title).to.be node.data.title
          expect(storedNode.id).to.be.above 0
          Node::findById id, (err, found) ->
            expect(err).to.be null
            expect(found).to.be.an 'object'
            expect(found.id).to.be.equal id
            done()

      it 'expect to remove a node', (done) ->
        node = new Node title: 'test'
        node.save -> 
          graphdb.countNodes (err, countNodesBefore) ->
            node.remove (err) ->
              graphdb.countNodes (err, countNodesAfter) ->
                id = node.id
                expect(err).to.be null
                expect(countNodesBefore-1).to.be countNodesAfter
                done()

      it 'expect to query customized via cypher', (done) ->
        graph = new Graph()
        graph.query """
        START nodes=node(*)
        RETURN nodes LIMIT 10;
        """, (err, results) ->
          expect(err).to.be null
          expect(results.columns.length).to.be.a 'number'
          expect(results.data.length).to.be.a 'number'
          done()

      it 'expect to get suitable errors on wrong customized cypher queries', (done) ->
        graph = new Graph()
        graph.query """
        START nodes=node(*)
        RETURN nodes LIMITS 10;
        """, (err, results) ->
          expect(err.message).to.be.a 'string'
          expect(err.stacktrace.length).to.be.a 'number'
          done()

      it 'expect to get suitable error on wrong mapper cypher queries', (done) ->
        Node::findOne().where "thisWillProduceAnError BECAUSE 'it\'s not a valid cypher query at all'", (err) ->
          expect(err).to.be.an 'object'
          # the following values may vary between versions
          # we'll keep the anyway as long we have no major difficulties
          expect(/unclosed\s+parenth/i.test(err.message)).to.be true
          expect(/SyntaxException/i.test(err.exception)).to.be true
          done()

      it 'expect to get all nodes', (done) ->
        n = new Node()
        n = n.findAll().limit(100).where("HAS (n.collection) AND n.collection = 'users'")
        n.stream (err,data) ->
          n = new Node()
          n = n.findAll().limit(10).whereHasProperty('collection').andWhere("n.collection = 'users'")
          n.stream (err,found) ->
            n = n.findAll().limit(10).where [ $and: [ { 'HAS (n.collection)' }, { 'n.collection': /^users$/i } ] ]
            n.exec ->
              done()

      # it 'expect to remove a node including it\'s relationships', (done) ->
      #   a = new Node(name: 'Alice')
      #   b = new Node(name: 'Bob')
      #   a.save -> b.save ->
      #     id = a.id
      #     a.createRelationshipBetween b, 'knows', ->
      #       a.removeWithRelationships (err) ->
      #         expect(err).to.be null
      #         Node::findById id, (err, found) ->
      #           # expect(err).to.be null
      #           expect(found).to.be null
      #           done()

      it 'expect to update a node', (done) ->
        n = new Node()
        n.data = {
          title: 'Hello World'
          whatever:
            nested: 'pinguin'
        }
        n.save (err, node) ->
          expect(err).to.be null
          id = node.id
          expect(node.data.title).to.be.equal n.data.title
          Node::findById id, (err, found) ->
            found.data.title = 'How are you?'
            found.update (err, savedNode) ->
              expect(err).to.be null
              Node::findById id, (err, foundAgain) ->
                expect(foundAgain.data.title).to.be found.data.title
                foundAgain.removeWithRelationships (err) ->
                  expect(err).to.be null
                  done()

      it 'expect to execute onBeforeSave hook if defined', (done) ->
        n = new Node()
        n.called_on_before_save = false
        n.onBeforeSave = (next) ->
          n.called_on_before_save = true
          next()
        n.save (err) ->
          expect(err).to.be null
          expect(n.called_on_before_save).to.be true
          n.remove ->
            done()

      it 'expect to execute onBeforeRemove hook if defined', (done) ->
        n = new Node()
        n.called_on_before_remove = false
        n.onBeforeRemove = (next) ->
          n.called_on_before_remove = true
          next()
        n.save (err) ->
          expect(n.called_on_before_remove).to.be false
          n.remove (err) ->
            expect(err).to.be null
            expect(n.called_on_before_remove).to.be true
            done()

    describe 'label nodes', ->

      if client.version < 2
        console.log client.exact_version
        it 'expect to save labeled node and request label(s)'
      else
        it 'expect to save labeled node and request label(s)', (done) ->
          node = new Node({name: 'Dave'})
          node.label = 'Person'
          # node.neo4jrestful.debug = true
          node.save (err, person, debug) ->
            expect(err).to.be null
            node.requestLabels (err, labels) ->
              expect(err).to.be null
              expect(labels).to.have.length 1
              expect(labels[0]).to.be.equal 'Person'
              node.remove (err) ->
                expect(err).to.be null
                class Article extends Node
                article = new Article title: 'Title of the article'
                article.save ->
                  article.requestLabels (err, labels) ->
                    expect(labels).to.have.length 1
                    expect(labels[0]).to.be.equal 'Article'
                    done()

      
      if version < 2
        it 'expect to find labeled node, with and without class'
      else
        it 'expect to find labeled node, with and without class', (done) ->
          class Person extends Node
          person = new Person({name: 'Dave'})
          person.save (err, savedPerson, debug) ->
            savedPerson.load (err, data) ->
              expect(err).to.be null
              expect(savedPerson.constructor_name).to.be.equal 'Node'
              Node::register_model(Person)
              savedPerson.load (err, data) ->
                expect(err).to.be null
                expect(savedPerson.constructor_name).to.be.equal 'Person'
                Node::unregister_model('Person')
                savedPerson.load (err, data) ->
                  expect(savedPerson.constructor_name).to.be.equal 'Node'
                  __global__ = if window? then window else root
                  __global__.Person = Person
                  savedPerson.load (err, data) ->
                    expect(savedPerson.constructor_name).to.be.equal 'Person'
                    savedPerson.remove ->
                      done()

    describe 'index', ->

      it 'expect to index and get an indexed node', (done) ->
        node = new Node()
        uid = new Date().getTime()
        node.data.name = 'Peter'
        node.data.city = 'Berlin'
        node.index 'test', 'city', 'cologne', (err) ->
          expect(err.message).to.be.equal 'You need to persist the node before you can index it.'
          node.save (err, savedNode) ->
            expect(err).to.be null
            savedNode.index 'test', 'uid', uid, (err, result) ->
              expect(err).to.be null
              node.findByIndex 'test', 'uid', uid, (err, result) ->
                expect(err).to.be null
                expect(result[0].id).to.be savedNode.id
                done()

      it 'expect to set default values and index values', (done) ->
        Node::fields.defaults.uid = -> new Date().getTime()
        node = new Node()
        node.data.name = 'Steve'
        node.save (err) ->
          expect(err).to.be null
          expect(node.data.uid).to.be.above 0
          Node::fields.indexes.uid = 'collection'
          node = new Node()
          node.data.name = 'Bill'
          node.save (err) ->  
            uid = node.data.uid
            expect(err).to.be null
            Node::findByIndex 'collection','uid',uid, (err, found) ->
              expect(err).to.be null
              done()

    describe 'relationships (incoming, outgoing and between nodes)', ->

      it 'expect to create a relationship between nodes in any direction', (done) ->
        alice = new Node name: 'Alice'
        bob = new Node name: 'Bob'
        alice.save -> bob.save ->
          graphdb.countRelationships (err, countedRelationshipsBefore) ->
            alice.createRelationshipBetween bob, 'knows', { since: 'years' }, (err, result) ->
              expect(err).to.be null
              expect(result).to.have.length 2
              graphdb.countRelationships (err, countedRelationshipsIntermediate) ->
                expect(countedRelationshipsBefore+2).to.be.equal countedRelationshipsIntermediate
                bob.createRelationshipTo alice, 'liked', (err) ->
                  expect(err).to.be null
                  graphdb.countRelationships (err, countedRelationshipsFinally) ->
                    expect(countedRelationshipsBefore+3).to.be.equal countedRelationshipsFinally
                    bob.createRelationshipFrom alice, 'follows', (err) ->
                      expect(err).to.be null
                      graphdb.countRelationships (err, countedRelationshipsFinally) ->
                        expect(countedRelationshipsBefore+4).to.be.equal countedRelationshipsFinally
                        alice.removeWithRelationships -> bob.removeWithRelationships ->
                          done()

      it 'expect to create a relationship from a node to another', (done) ->
        node = new Node()
        node.data.name = "Alice"
        node.save (err, a) ->
          expect(a.hasId()).to.be true
          a.outgoingRelationships().count (err, count) ->
            expect(count).to.be 0
            node = new Node()
            node.data.name = "Bob"
            node.save (err, b) ->
              expect(b.hasId()).to.be true
              a.createRelationshipTo b, 'KNOWS', { since: 'years' }, (err, result) ->
                expect(err).to.be null
                a.outgoingRelationships().count (err, countNew) ->
                  expect(countNew).to.be 1
                  a.neo4jrestful.debug = true;
                  a.outgoingRelationships (err, outgoingRelationships, debug) ->
                    expect(err).to.be null
                    expect(outgoingRelationships).to.have.length 1
                    # check all important properties of a relationship
                    # TODO: maybe seperate test?!
                    expect(outgoingRelationships[0].type).to.be.equal 'KNOWS'
                    expect(outgoingRelationships[0].data.since).to.be.equal 'years'
                    expect(outgoingRelationships[0].from).to.be.an 'object'
                    expect(outgoingRelationships[0].from.id).to.be.a 'number'
                    expect(outgoingRelationships[0].from.uri).to.be.a 'string'
                    expect(outgoingRelationships[0].to).to.be.an 'object'
                    expect(outgoingRelationships[0].to.id).to.be.a 'number'
                    expect(outgoingRelationships[0].to.uri).to.be.a 'string'
                    expect(outgoingRelationships[0].toObject()).to.be.an 'object'

                    a.createRelationshipFrom b, 'LIKES', (err, result) ->
                      expect(err).to.be null
                      done()

    describe 'path algorithms', ->

      it 'expect to find shortest path from one node to an other node', (done) ->
        a = new Node({name: 'Alice'})
        a.save (err) ->
          b = new Node({name: 'Bob'})
          b.save ->
            c = new Node({name: 'Charles'})
            c.save ->
              a.createRelationshipTo b, 'KNOWS', ->
                b.createRelationshipTo c, 'KNOWS', ->
                  a.neo4jrestful.debug = true;
                  a.shortestPathTo c, 'KNOWS', (err, path, debug) ->
                    # check properties of path
                    # TODO: maybe seperate test?!
                    expect(err).to.be null
                    # expect(path.constructor).to.be.equal Array
                    # expect(path).to.have.length 1 
                    # path = path[0]
                    expect(path.length).to.be 2
                    expect(path.nodes).to.have.length 3
                    expect(path.nodes[0].uri).to.be.a 'string'
                    expect(path.nodes[0].id).to.be.a 'number'
                    expect(path.relationships).to.have.length 2
                    expect(path.relationships[0].uri).to.be.a 'string'
                    expect(path.relationships[0].id).to.be.a 'number'
                    expect(path.start).to.be.a 'string'
                    expect(path.end).to.be.a 'string'
                    expect(path.toObject()).to.be.an 'object'
                    done()

    describe 'helpers', ->

      describe 'escapeString', ->
      describe 'cypherKeyValueToString', ->
      describe 'unflattenObject', ->
      describe 'flattenObject', ->
      describe 'sortStringAndOptionsArguments', ->
      describe 'sortOptionsAndCallbackArguments', ->
      describe 'sortStringAndCallbackArguments', ->
      describe 'getIdFromObject', ->
      
      it 'constructorNameOfFunction', ->
        node = new Node
        class Person extends Node
        expect(helpers.constructorNameOfFunction(Person)).to.be.equal 'Person'
        expect(helpers.constructorNameOfFunction(node)).to.be.equal 'Node'



      describe 'extractAttributesFromCondition', ->

        it 'expect to extract all attributes from a condition', ->
          condition = [
            { $and: [
              { 'n.name': /Alice/i, },
              $or: [
                { 'n.email': "alice@home.com" },
                $and: [
                  { 'n.email': "alice@home.de" },
                  { 'n.country': "de_DE" }
                ],
              ]
            ]}
          ]
          attrs = helpers.extractAttributesFromCondition(condition)
          expect(attrs[0]).to.be 'name'
          expect(attrs[1]).to.be 'email'
          expect(attrs[2]).to.be 'country'
          condition = [ { 'city': 'Berlin' } , $and: [ { 'name': /^bob.+/i }, $not: [ { 'name': /^Bobby$/ } ] ] ]
          attrs = helpers.extractAttributesFromCondition(condition)
          expect(attrs[0]).to.be 'city'
          expect(attrs[1]).to.be 'name'


      describe 'conditionalParameterToString', ->

        it 'expect to leave a string as it is', ->
          condition = "n.name = 'Alice' AND HAS(n.email)"
          expect(helpers.conditionalParameterToString(condition)).to.be.equal '( '+condition+' )'

        it 'expect to transform an key-value object to cypher query', ->
          condition = [
            { "n.name": "Alice's" },
            "HAS(n.email))"
          ]
          resultShouldBe = "( n.name = 'Alice\\'s' AND HAS(n.email)) )"
          expect(helpers.conditionalParameterToString(condition)).to.be.equal resultShouldBe
        
        it 'expect to transform an key-value-object to with $OR and $AND operators', ->
          resultShouldBe = """
            ( ( n.name =~ '(?i)Alice' AND ( n.email = 'alice@home.com' OR ( n.email = 'alice@home.de' AND n.country = 'de_DE' ) ) ) )
            """
          condition = [
            { $and: [
              { 'n.name': /Alice/i, },
              $or: [
                { 'n.email': "alice@home.com" },
                $and: [
                  { 'n.email': "alice@home.de" },
                  { 'n.country': "de_DE" }
                ],
              ]
            ]}
          ]
          expect(helpers.conditionalParameterToString(condition)).to.be.equal resultShouldBe

        it 'expect to transform an key-value-object with identifier', ->
          resultShouldBe = """
          ( ( n.name =~ '(?i)Alice' AND r.since = 'years' AND ( n.email = 'alice@home.com' OR ( n.email = 'alice@home.de' AND n.country = 'de_DE' ) ) ) )
          """;
          condition = [
            { $and: [
              { 'n.name': /Alice/i, },
              { 'r.since' : 'years' },
              $or: [
                { 'n.email': "alice@home.com" },
                $and: [
                  { 'email': "alice@home.de" },
                  { 'country': "de_DE" }
                ],
              ]
            ]}
          ]
          expect(helpers.conditionalParameterToString(condition, undefined, { identifier: 'n' })).to.be.equal resultShouldBe


