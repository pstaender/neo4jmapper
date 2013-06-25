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

# get version of neo4j
client.checkAvailability (err) ->
  throw err if err
  version = client.version

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
        expect(client.version >= 2).to.be true
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
      # javascript
      `var Movie = (function(Node) {

      function Movie() {
        // this is necessary to give the constructed node a name context
        this.init.apply(this, arguments);
      }
      
      _.extend(Movie.prototype, Node.prototype);
      
      Movie.prototype.label = Movie.prototype.constructor_name = 'Movie';

      Movie.prototype.fields = {
        defaults: {
          genre: 'Blockbuster'
        }
      };
      
      return Movie;
    })(Node)`
      movie = new Movie()
      expect(movie.label).to.be.equal 'Movie' 
      expect(movie.constructor_name).to.be.equal 'Movie' 
      expect(movie).to.be.an 'object'
      expect(movie.id).to.be null
      done()

    it 'expect to create a node', (done) ->
      node = new Node title: new Date().toString()
      node.save (err, storedNode) ->
        id = node.id
        expect(err).to.be null
        expect(storedNode.data.title).to.be node.data.title
        expect(storedNode.id).to.be.above 0
        Node::findById id, (err, found) ->
          expect(found).to.be.an 'object'
          expect(found.id).to.be.equal id
          expect(found.data.title).to.be.equal node.data.title
          node.remove ->
            done()

    it 'expect to find one specific node by id', (done) ->
      node = new Node title: new Date().toString()
      node.save ->
        Node::findById node.id, (err, found) ->
          expect(err).to.be null
          expect(found.data.title).to.be.equal node.data.title
          expect(found.id).to.be.equal node.id
          node.remove ->
            done()

    it 'expect to find one specific node by key/value', (done) ->
      node = new Node title: new Date().toString()
      node.save ->
        Node::findByUniqueKeyValue 'title', node.data.title, (err, found) ->
          expect(err).to.be null
          expect(found.data.title).to.be.equal node.data.title
          expect(found.id).to.be.equal node.id
          node.remove ->
            done()

    it 'expect to get null as result if one specific node is not found', (done) ->
      Node::findOne { SomeKey: new Date().getTime() }, (err, found) ->
        expect(err).to.be null
        expect(found).to.be null
        done()

    it 'expect to find many nodes with different labels', (done) ->
      groupid = new Date().getTime()
      new Node(name: 'Alice', group_id: groupid).addLabel('Person').save (err, alice) ->
        expect(err).to.be null
        expect(alice.label).to.be 'Person'
        expect(alice.labels[0]).to.be 'Person'
        new Node(name: 'Bob', group_id: groupid).addLabel('Developer').save (err, bob) ->
          expect(err).to.be null
          expect(bob.label).to.be 'Developer'
          expect(bob.labels[0]).to.be 'Developer'
          Node::find { group_id: groupid }, (err, nodes) ->
            expect(err).to.be null
            expect(nodes).to.have.length 2
            expect(nodes[0].constructor_name).to.be.equal 'Node'
            expect(nodes[1].constructor_name).to.be.equal 'Node'
            class Developer extends Node
            Node::register_model(Developer)
            Developer::find { group_id: groupid }, (err, nodes) ->
              expect(err).to.be null
              expect(nodes).to.have.length 1
              expect(nodes[0].data.name).to.be.equal 'Bob'
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

    it 'expect to get null if node is not found', (done) ->
      Node::findById 1234567890, (err, found) ->
        expect(err).to.be null
        expect(found).to.be null
        Node::findByUniqueKeyValue { key: new Date().getTime() }, (err, found) ->
          expect(err).to.be null
          expect(found).to.be null
          done()

    it 'expect to process data between javascript and neo4j as good as possible', (done) ->
      n = new Node()
      n.data = {
        title: 'Hello World'
        whatever:
          nested: 'pinguin'
        numberArray: [ 1, 2, 3]
        stringArray: [ 'a', 'b', 'c' ]
        complexObject: [ { a: true } ]
        other:
          nested: [ 'A' ]
      }
      n.save (err, node) ->
        id = node.id
        expect(node.data.title).to.be.equal n.data.title
        expect(node.data.numberArray.constructor).to.be.equal Array
        expect(node.data.complexObject[0].a).to.be true
        expect(node.data.other.nested).to.have.length 1
        done()

    it 'expect to update a node and expecting ', (done) ->
      new Node( { title: 'Hello World!' }).save (err, node) ->
        expect(node.data.title).to.be.equal 'Hello World!'
        id = node.id
        Node::findById id, (err, found) ->
          found.data.title = 'How are you?'
          found.update (err, savedNode) ->
            expect(savedNode.data.title).to.be.equal 'How are you?'
            expect(err).to.be null
            Node::findById id, (err, foundAgain) ->
              expect(foundAgain.data.title).to.be found.data.title
              foundAgain.removeWithRelationships (err) ->
                expect(err).to.be null
                node.remove ->
                  done()

    it 'expect to execute onBeforeSave hook if defined', (done) ->
      n = new Node()
      n.called_on_before_save = false
      n.onBeforeSave = (self, next) ->
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

  describe 'classes and models', ->

    # TODO: check that one node can have many labels

    it 'expect to register and unregister models for nodes', ->
      class Person extends Node
      Node::register_model(Person)
      expect(Node::registered_models()['Person'].constructor).to.be Person.constructor
      Node::unregister_model(Person)
      expect(Node::registered_models()['Person']).to.be undefined
      Node::register_model(Person)
      Node::unregister_model('Person')
      expect(Node::registered_models()['Person']).to.be undefined

    it 'expect to find corresponding node to each model', (done) ->
      class Movie extends Node
      Node::register_model(Movie)
      Movie::findAll().count (err, countBefore) ->
        expect(err).to.be null
        expect(countBefore).to.be.a 'number'
        lebowski = new Movie title: 'The Big Lebowski'
        lebowski.save (err, lebowski) ->
          expect(_.keys(lebowski.data)).to.have.length 1
          expect(err).to.be null
          Movie::findAll().count (err, countNow) ->
            expect(countBefore+1).to.be countNow
            lebowski.remove ->
              done()

    it 'expect to convert to specific models', (done) ->
      class Director extends Node
      new Director( name: 'Robert Zemeckis' ).save (err, robert) ->
        expect(err).to.be null
        expect(robert.constructor_name).to.be 'Director'
        expect(robert.label).to.be 'Director'
        Node::findById robert.id, (err, found) ->
          # expect(found.constructor_name).to.be.equal 'Director'
          expect(found.label).to.be.equal 'Director'

          Node::register_model(Director)
          found = Node::convert_node_to_model(found, Director)
          expect(found.constructor_name).to.be.equal 'Director'

          done()

    it 'expect to autoindex models', (done) ->
      ###
        TODO: autoindex check for indexed field tests
      ###
      # client.constructor::log = Graph::log = require('./log')
      class Movie extends Node
        fields:
          indexes:
            uid: true
      Node::register_model(Movie)
      deathAndMaiden = new Movie title: 'Death and the Maiden'
      uid = new Date().getTime()
      deathAndMaiden.data.uid = uid
      deathAndMaiden.save (err) ->
        expect(err).to.be null
        Movie::findAll().where { uid: uid }, (err, found) ->
          expect(err).to.be null
          expect(found).to.have.length 1
          expect(found[0].data.uid).to.be.equal uid
          deathAndMaiden.remove ->
            done()

    it 'expect to have unique values'#, (done) ->
      # client.query """
      # INDEX CONSTRAINT ON (n:Movie) ASSERT n.uid IS UNIQUE;
      # """, (err, result) ->
      #   console.log err, result
      #   done()

    it 'expect to det default values on models', (done) ->
      # client.constructor::log = Graph::log = require('./log')
      class Movie extends Node
        fields:
          indexes:
            uid: true
          defaults:
            uid: -> new Date().getTime()
            is_movie: true
            director: 'Roman Polanski'
      Node::register_model(Movie)
      bitterMoon = new Movie title: 'Bitter Moon'
      bitterMoon.save (err) ->
        expect(err).to.be null
        uid = bitterMoon.data.uid
        expect(uid).to.be.a 'number'
        Movie::findAll().where { uid: uid }, (err, found) ->
          expect(err).to.be null
          expect(found).to.have.length 1
          expect(found[0].data.uid).to.be.equal uid
          expect(found[0].data.title).to.be.equal 'Bitter Moon'
          expect(found[0].data.is_movie).to.be true
          expect(found[0].data.director).to.be.equal 'Roman Polanski'
          expect(_.keys(found[0].data)).to.have.length 4
          bitterMoon.remove ->
            done()

  describe 'label nodes', ->

    it 'expect to save labeled node and request label(s)', (done) ->
      node = new Node({name: 'Dave'})
      node.label = 'Person'
      # node.neo4jrestful.debug = true
      node.save (err, person, debug) ->
        expect(err).to.be null
        expect(person.label).to.be.equal 'Person'
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
                article.remove ->
                  done()

    it 'expect to add, remove and update labels of a node', (done) ->
      class Person extends Node
        fields:
          defaults: {}
          indexes: {}
      p = new Person( name: 'Jeff Bridges' )
      Node::register_model(Person)
      new Person( name: 'Jeff Bridges' ).save (err, jeff) ->
        jeff.allLabels (err, labels) ->
          expect(err).to.be null
          expect(labels).to.have.length 1
          expect(_.keys(jeff.data)).to.have.length 1
          expect(labels[0]).to.be.equal 'Person'
          jeff.addLabel 'Actor', (err) ->
            expect(err).to.be null
            jeff.addLabels [ 'Actor', 'Singer', 'Photographer' ], (err) ->
              jeff.allLabels (err, labels) ->
                expect(err).to.be null
                expect(labels).to.have.length 4
                jeff.replaceLabels [ 'Person' ], (err) ->
                  expect(err).to.be null
                  jeff.allLabels (err, labels) ->
                    expect(err).to.be null
                    expect(labels).to.have.length 1
                    expect(labels[0]).to.be.equal 'Person'
                    Person::findOne().where { name: 'Jeff Bridges' }, (err, found) ->
                      expect(err).to.be null
                      found.load (err, jeff) ->
                        expect(jeff.label).to.be.equal 'Person'
                        expect(jeff.labels).to.have.length 1
                        expect(jeff.labels[0]).to.be.equal 'Person'
                        done()

    it 'expect to find labeled node, with and without class', (done) ->
      class Person extends Node
      person = new Person({name: 'Dave'})
      person.save (err, savedPerson, debug) ->
        expect(person.label).to.be.equal 'Person'
        expect(savedPerson.label).to.be.equal 'Person'
        done()

    it 'expect to find node including labels', (done) ->
      class Person extends Node
      Node::register_model(Person)
      new Person({ name: 'Alice' }).save (err, alice) ->
        Person::findById alice.id, (err, alice) ->
          expect(alice.constructor_name).to.be.equal 'Person'
          expect(alice.label).to.be.equal 'Person'
          # expect(alice.labels.constructor).to.be Array
          #console.log alice.constructor_name
          done()

    it 'expect to find labeled nodes', (done) ->
      class Person extends Node
      person = new Person({name: 'Dave'})
      Node::findAll().match('n:Person').count (err, countBefore) ->
        person.save ->
          Node::findAll().match('n:Person').count (err, count) ->
            expect(err).to.be null
            expect(count).to.be.equal countBefore+1
            done()

  describe 'index', ->

    it 'expect to index and get an indexed node', (done) ->
      node = new Node()
      uid = new Date().getTime()
      node.data.name = 'Peter'
      node.data.city = 'Berlin'
      node.addIndex 'test', 'city', 'cologne', (err) ->
        expect(err.message).to.be.equal 'You need to persist the node before you can index it.'
        node.save (err, savedNode) ->
          expect(err).to.be null
          savedNode.addIndex 'test', 'uid', uid, (err, result) ->
            expect(err).to.be null
            node.findByIndex 'test', 'uid', uid, (err, result) ->
              expect(err).to.be null
              expect(result.id).to.be savedNode.id
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
          Node::findByIndex 'collection', 'uid', uid, (err, found) ->
            expect(err).to.be null
            expect(found.data.uid).to.be.equal uid
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
              bob.createRelationshipTo alice, 'liked', (err, relationship) ->
                expect(err).to.be null
                expect(relationship).to.be.an 'object'
                expect(relationship.type).to.be.equal 'liked'
                expect(relationship).to.be.an 'object'
                graphdb.countRelationships (err, countedRelationshipsFinally) ->
                  expect(countedRelationshipsBefore+3).to.be.equal countedRelationshipsFinally
                  bob.createRelationshipFrom alice, 'follows', (err, relationship) ->
                    expect(err).to.be null
                    expect(relationship).to.be.an 'object'
                    graphdb.countRelationships (err, countedRelationshipsFinally) ->
                      expect(countedRelationshipsBefore+4).to.be.equal countedRelationshipsFinally
                      bob.createOrUpdateRelationshipFrom alice, 'follows', { since: 'years' }, (err, relationship) ->
                        expect(err).to.be null
                        expect(relationship).to.be.an 'object'
                        expect(relationship.type).to.be.equal 'follows'
                        expect(relationship.data.since).to.be.equal 'years'
                        expect(relationship.id).to.be.a 'number'
                        id = relationship.id
                        graphdb.countRelationships (err, count) ->
                          expect(count).to.be.equal countedRelationshipsFinally
                          bob.createOrUpdateRelationshipFrom alice, 'follows', { since: 'months' }, (err, relationship) ->
                            expect(err).to.be null
                            expect(relationship).to.be.an 'object'
                            expect(relationship.type).to.be.a 'string'
                            expect(relationship.data.since).to.be.equal 'months'
                            expect(relationship.id).to.be.equal id
                            graphdb.countRelationships (err, count) ->
                              expect(count).to.be.equal countedRelationshipsFinally
                              alice.removeWithRelationships -> bob.removeWithRelationships ->
                                done()

    it 'expect to create and get incoming, outgoing and bidirectional relationships between two nodes', (done) ->
      node = new Node()
      node.data.name = "Alice"
      node.save (err, a) ->
        expect(a.hasId()).to.be true
        # console.log  a.outgoingRelationships().count().toCypherQuery()
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
                    a.incomingRelationships 'LIKES', (err, result) ->
                      expect(outgoingRelationships).to.have.length 1
                      expect(err).to.be null
                      a.neo4jrestful.debug = true
                      a.createRelationshipBetween b, 'LIKES', (err, result, debug) ->
                        expect(err).to.be null
                        a.allRelationships 'LIKES', (err, result) ->
                          expect(err).to.be null
                          expect(result).to.have.length 3
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
                  a.removeWithRelationships (err) ->
                    expect(err).to.be null
                    b.removeWithRelationships (err) ->
                      expect(err).to.be null
                      done()

  describe 'relationship', ->

    it 'expect to get a relationship by id, update and remove it', (done) ->
      new Node().save (err, a) ->
        new Node().save (err, b) ->
          a.createRelationshipTo b, 'related', { since: 'year' }, (err, result) ->
            expect(result.id).to.be.above 0
            Relationship::findById result.id, (err, found) ->
              expect(err).to.be null
              expect(found.id).to.be.equal result.id
              expect(found.data.since).to.be.equal 'year'
              found.data = from: 'Berlin'
              found.save (err) ->
                expect(err).to.be null
                Relationship::findById result.id, (err, found) ->
                  expect(err).to.be null
                  expect(found.data.since).to.be undefined
                  expect(found.data.from).to.be.equal 'Berlin'
                  found.remove (err) ->
                    expect(err).to.be null
                    Relationship::findById result.id, (err, found) ->
                      expect(err).to.be null
                      expect(found).to.be null
                      Node::findById 123, (err, found) ->
                        expect(err).to.be null
                        expect(found).to.be null
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
    
    describe 'constructorNameOfFunction', ->

      it 'expect to get the correct constructor name', ->
        node = new Node
        class Person extends Node
        `var Movie = (function(Node) {

        function Movie() {
          // this is necessary to give the constructed node a name context
          this.init.apply(this, arguments);
        }
        
        _.extend(Movie.prototype, Node.prototype);
        
        Movie.prototype.label = Movie.prototype.constructor_name = 'Movie';

        Movie.prototype.fields = {
          defaults: {
            genre: 'Blockbuster'
          }
        };
        
        return Movie;
      })(Node)`
        expect(helpers.constructorNameOfFunction(Movie)).to.be.equal 'Movie'
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


