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
  {Graph,Node,Relationship,helpers,client}  = new Neo4j(configForTest.neo4jURL)

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
  {Graph,Node,Relationship,helpers,client} = neo4jmapper
  Neo4j = Neo4jMapper.init

client.constructor::log = Graph::log = configForTest.doLog if configForTest.doLog

version = client.version
graphdb = null # will be initialized in before()

SkipInNode = (a) -> unless window? then null else a 
SkipInBrowser = (a) -> if window? then null else a

# if process?.env?.TRAVIS
#   # cancel tests because travis doesn't support neo4j v2, yet
#   return describe 'Neo4jMapper', ->
#     it "expect to have a neo4j database above version 2.0"

describe 'Neo4jMapper', ->

  before (done) ->
    graphdb = new Graph(configForTest.neo4jURL)
    client.checkAvailability (err, exact_version) ->
      expect(err).to.be null
      expect(exact_version).to.be.a 'string'
      expect(client.version >= 2).to.be true
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

    it 'expect to measure time of request and response', (done) ->
      graph = new Graph()
      graph.countAll (err, count) ->
        expect(err).to.be null
        expect(graph.neo4jrestful.responseTime()).to.be.above 1
        expect(graph.neo4jrestful.responseTimeAsString()).to.match /^\d+(\.\d+)*\[s\]$/
        done()

    it 'expect to query via Graph, with and without loading', (done) ->
      Person = Node.register_model 'Person'
      name = String(Date())
      new Person(name: name).save (err, alice) ->
        expect(err).to.be null
        expect(alice.label).to.be.equal 'Person'
        new Person(name: 'otherPerson').save (err, bob) ->
          alice.createRelationshipTo bob, 'KNOWS', (err, relationship) ->
            expect(err).to.be null
            Graph
              .start('n = node(*)')
              .match('n:Person-[r?]-()')
              .where({'n.name': name})
              .return('n AS Node, r AS Relationship')
              .limit(1)
              .enableLoading('node|relationship')
              .exec (err, result) ->
                expect(err).to.be null
                expect(result.data).to.have.length 1
                expect(result.data[0]).to.have.length 2
                person = result.data[0][0]
                relationship = result.data[0][1]
                expect(person.label).to.be.equal 'Person'
                expect(relationship.from.label).to.be.equal 'Person'
                Graph
                  .start('n = node(*)')
                  .match('n:Person-[r?]-()')
                  .where({'n.name': name})
                  .return('n AS Node, r AS Relationship')
                  .limit(1)
                  .disableLoading()
                  .exec (err, result) ->
                    expect(err).to.be null
                    expect(result.data).to.have.length 1
                    expect(result.data[0]).to.have.length 2
                    person = result.data[0][0]
                    relationship = result.data[0][1]
                    expect(person.label).to.be null
                    expect(relationship.from.label).to.be undefined
                    done()

    it 'expect to query via Graph with parameters'


  describe 'stream', ->

    it 'expect to make a stream request on nodes and models', (SkipInBrowser) (done) ->
      class Person extends Node
      Node.register_model(Person)
      new Person({name: 'A'}).save ->
        new Person({name: 'B'}).save ->
          Person.findAll().count (err, count) ->
            expect(err).to.be null
            expect(count).to.be.above 0
            iterationsCount = 0;
            count = 10 if count > 10
            Person.findAll().limit(count-1).each (data) ->
              if data
                expect(data._response_.self).to.be.a 'string'
                expect(data.labels.constructor).to.be.equal Array
                expect(data.label).to.be.equal 'Person'
                iterationsCount++
              else
                expect(iterationsCount).to.be.equal count-1
                iteration = 0
                # testing finding unspecific node(s)
                Node.findOne().each (node) ->
                  iteration++
                  if node
                    expect(node.label).to.be null
                  else
                    expect(iteration).to.be.equal 2
                    done()

    it 'expect to make a stream request on the graph', (SkipInBrowser) (done) ->
      Node.findAll().count (err, count) ->
        expect(count).to.be.above 1
        iterationsCount = 0;
        count = 10 if count > 10
        graph = new Graph() # alternate: client.stream
        graph.stream "START n=node(*) RETURN n LIMIT #{count};", (node) ->
          unless node
            expect(count).to.be.equal count
            done()
          else
            expect(node.id).to.be.a 'number'
            count++

  describe 'node', ->

    it 'expect to allow inheritance', (done) ->
      Node.register_model 'Person', { 
        fields: {
          defaults: {
            email: 'unknown'
            income: 50000
            job: 'Laborer'
          }
          indexes: {
            job: true
          }
        }
      }, (err, Person) ->
        expect(err).to.be null
        person = new Person()
        expect(person).to.be.an 'object'
        expect(person.label).to.be 'Person'
        expect(person.constructor_name).to.be 'Person'
        expect(person.fields.defaults.income).to.be.equal 50000
        expect(person.fields.defaults.job).to.be.equal 'Laborer'
        expect(person.fields.defaults.email).to.be.equal 'unknown'
        Person.register_model 'Director', { 
          fields: {
            defaults: {
              income: 80000
              job: 'Director'
            }
          }
        }, (err, Director) ->
          expect(err).to.be null
          director = new Director()
          expect(director.label).to.be.equal 'Director' 
          expect(director.constructor_name).to.be.equal 'Director'
          expect(director.fields.defaults.income).to.be.equal 80000
          expect(director.fields.defaults.job).to.be.equal 'Director'
          expect(director.fields.defaults.email).to.be.equal 'unknown'
          expect(director.fields.indexes.job).to.be true
          expect(director.labels).to.have.length 2
          expect(director.labels[0]).to.be 'Director'
          expect(director.labels[1]).to.be 'Person'
          expect(director).to.be.an 'object'
          expect(director.id).to.be null
          Person.register_model 'Actor', { 
            fields: {
              defaults: {
                job: 'Actor'
              }
            }
          }, (err, Actor) ->
            expect(err).to.be null
            actor = new Actor()
            expect(actor.labels).to.have.length 2
            expect(actor.labels[0]).to.be 'Actor'
            expect(actor.labels[1]).to.be 'Person'
            expect(actor.fields.defaults.income).to.be.equal 50000
            expect(actor.fields.defaults.job).to.be.equal 'Actor'
            expect(actor.fields.defaults.email).to.be.equal 'unknown'
            done()

    it 'inheritance on coffescript class-objects', (done) ->
      class Person extends Node
      class Extra extends Person
      class Actor extends Extra
      class Director extends Actor
      Person = Node.register_model(Person)
      Actor = Node.register_model(Actor)
      Director = Node.register_model(Director)
      director = new Director
      expect(director.labels).to.have.length 4
      expect(director.labels[0]).to.be.equal 'Director'
      expect(director.labels[1]).to.be.equal 'Actor'
      expect(director.labels[2]).to.be.equal 'Extra'
      expect(director.labels[3]).to.be.equal 'Person'
      expect(director.label).to.be.equal 'Director'
      expect(_.keys(director.fields.indexes)).to.have.length 0
      expect(_.keys(director.fields.unique)).to.have.length 0
      expect(_.keys(director.fields.defaults)).to.have.length 0
      done()

    it 'inheritance on models', (done) ->
      Person   = Node.register_model('Person')
      Extra    = Person.register_model('Extra')
      Actor    = Extra.register_model('Actor')
      Director = Actor.register_model('Director')
      director = new Director
      expect(director.labels).to.have.length 4
      expect(director.labels[0]).to.be.equal 'Director'
      expect(director.labels[1]).to.be.equal 'Actor'
      expect(director.labels[2]).to.be.equal 'Extra'
      expect(director.labels[3]).to.be.equal 'Person'
      expect(director.label).to.be.equal 'Director'
      uid = new Date
      director.data =
        name: 'Roman Polanski'
        uid: uid
      director.save (err, polanski) ->
        expect(polanski.labels).to.have.length 4
        expect(director.labels).to.have.length 4
        expect(director.label).to.be.equal 'Director'
        expect(polanski.label).to.be.equal 'Director'
        done()

    it 'expect to create a node', (done) ->
      node = new Node title: new Date().toString()
      node.save (err, storedNode) ->
        id = node.id
        expect(err).to.be null
        expect(storedNode.data.title).to.be node.data.title
        expect(storedNode.id).to.be.above 0
        Node.findById id, (err, found) ->
          expect(found).to.be.an 'object'
          expect(found.id).to.be.equal id
          expect(found.data.title).to.be.equal node.data.title
          node.remove ->
            done()

    it 'expect to use parameters for queries by default and expect to add parameters to cypher query', ->
      node = new Node title: new Date().toString()
      expect(node.cypher._useParameters).to.be true # this is an option flag which is expected to be true!
      expect(node.cypher.parameters).to.be null
      node._addParametersToCypher [ 'a', 'b' ]
      node._addParametersToCypher [ 'c', 'd' ]
      shouldBe = [ 'a', 'b', 'c', 'd' ]
      for value, i in node.cypher.parameters
        expect(value).to.be.equal shouldBe[i]

    it 'expect to find one specific node by id', (done) ->
      node = new Node title: new Date().toString()
      node.save ->
        Node.findById node.id, (err, found) ->
          expect(err).to.be null
          expect(found.data.title).to.be.equal node.data.title
          expect(found.id).to.be.equal node.id
          node.remove ->
            done()

    it 'expect to find one specific node by key/value', (done) ->
      node = new Node title: new Date().toString()
      node.save ->
        Node.findOneByKeyValue 'title', node.data.title, (err, found) ->
          expect(err).to.be null
          expect(found.data.title).to.be.equal node.data.title
          expect(found.id).to.be.equal node.id
          node.remove ->
            done()

    it 'expect to get null as result if one specific node is not found', (done) ->
      Node.findOne { SomeKey: new Date().getTime() }, (err, found) ->
        expect(err).to.be null
        expect(found).to.be null
        done()

    it 'expect to find many nodes with different labels', (done) ->
      Node.unregister_model('Person')
      Node.unregister_model('Developer')
      groupid = new Date().getTime()
      new Node(name: 'Alice', group_id: groupid).addLabel('Person').save (err, alice) ->
        expect(err).to.be null
        expect(alice.label).to.be 'Person'
        expect(alice.labels[0]).to.be 'Person'
        new Node(name: 'Bob', group_id: groupid).addLabel('Developer').save (err, bob) ->
          expect(err).to.be null
          expect(bob.label).to.be 'Developer'
          expect(bob.labels[0]).to.be 'Developer'
          Node.find { group_id: groupid }, (err, nodes) ->
            expect(err).to.be null
            expect(nodes).to.have.length 2
            expect(nodes[0].constructor_name).to.be.equal 'Node'
            expect(nodes[1].constructor_name).to.be.equal 'Node'
            class Developer extends Node
              fields:
                indexes:
                  email: true
            Developer.drop_entire_index (err) ->
              expect(err).to.be null
              Node.register_model Developer, ->
                Developer.find { group_id: groupid }, (err, nodes) ->
                  expect(err).to.be null
                  expect(nodes).to.have.length 1
                  expect(nodes[0].data.name).to.be.equal 'Bob'
                  Developer.get_index (err, found) ->
                    expect(found).to.have.length 1
                    expect(found[0]).to.be.equal 'email'
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
      Graph.query """
      START nodes=node(*)
      RETURN nodes LIMIT 10;
      """, (err, results) ->
        expect(err).to.be null
        expect(results.columns.length).to.be.a 'number'
        expect(results.data.length).to.be.a 'number'
        done()

    it 'expect to get suitable errors on wrong customized cypher queries', (done) ->
      Graph.query """
      START nodes=node(*)
      RETURN nodes LIMITS 10;
      """, (err, results) ->
        expect(err.message).to.be.a 'string'
        expect(err.stacktrace.length).to.be.a 'number'
        done()

    it 'expect to get suitable error on wrong mapper cypher queries', (done) ->
      Node.findOne().where "thisWillProduceAnError BECAUSE 'it\'s not a valid cypher query at all'", (err) ->
        expect(err).to.be.an 'object'
        # the following values may vary between versions
        # we'll keep the anyway as long we have no major difficulties
        expect(/^[A-Z]+[a-z]+/.test(err.message)).to.be true
        expect(/SyntaxException/i.test(err.exception)).to.be true
        done()

    it 'expect to get all nodes', (done) ->
      n = new Node()
      n = n.findAll().limit(100).where("HAS (n.collection) AND n.collection = 'users'")
      n.exec (err,data) ->
        n = new Node()
        n = n.findAll().limit(10).where("n.collection = 'users'")
        n.exec (err,found) ->
          n = n.findAll().limit(10).where [ $and: [ { 'HAS (n.collection)' }, { 'n.collection': /^users$/i } ] ]
          n.exec ->
            done()

    it 'expect to get null if node is not found', (done) ->
      Node.findById Number('9'+Math.floor(Math.random()*1000000000)), (err, found) ->
        expect(err).to.be null
        expect(found).to.be null
        Node.findOneByKeyValue { key: new Date().getTime() }, (err, found) ->
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

    it 'expect to update a node', (done) ->
      new Node( { title: 'Hello World!' }).save (err, node) ->
        expect(node.data.title).to.be.equal 'Hello World!'
        id = node.id
        Node.findById id, (err, found) ->
          found.data.title = 'How are you?'
          found.save (err, savedNode) ->
            expect(savedNode.data.title).to.be.equal 'How are you?'
            expect(err).to.be null
            Node.findById id, (err, foundAgain) ->
              expect(foundAgain.data.title).to.be found.data.title
              foundAgain.removeIncludingRelationships (err) ->
                expect(err).to.be null
                node.remove ->
                  done()

    it 'expect to update data of a node by id', (done) ->
      new Node({ name: 'Dave Grohl', origin: { country: 'USA', state: '' } }).save (err, dave) ->
        expect(err).to.be null
        expect(dave.data.name).to.be.equal 'Dave Grohl'
        expect(dave.data.origin.state).to.be.equal ''
        expect(dave.data.origin.country).to.be.equal 'USA'
        id = dave.id
        expect(id).to.be.above 0
        Node.findById(id).update { origin: { state: 'Ohio'} }, (err, daveSaved) ->
          expect(err).to.be null
          expect(daveSaved.data.name).to.be.equal 'Dave Grohl'
          expect(daveSaved.data.origin.state).to.be.equal 'Ohio'
          expect(daveSaved.data.origin.country).to.be.equal 'USA'
          expect(daveSaved.id).to.be id
          daveSaved.update { 'origin.country': 'United States of America' }, (err, daveSaved) ->
            expect(err).to.be null
            expect(daveSaved.data.name).to.be.equal 'Dave Grohl'
            expect(daveSaved.data.origin.state).to.be.equal 'Ohio'
            expect(daveSaved.data.origin.country).to.be.equal 'United States of America'
            expect(daveSaved.id).to.be id
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
      Node.register_model(Person)
      expect(Node.registered_models()['Person'].constructor).to.be Person.constructor
      Node.unregister_model(Person)
      expect(Node.registered_models()['Person']).to.be undefined
      Node.register_model(Person)
      Node.unregister_model('Person')
      expect(Node.registered_models()['Person']).to.be undefined
      Movie = Node.register_model('Movie')
      movie = new Movie()
      expect(movie.label).to.be.equal 'Movie'
      expect(movie.constructor_name).to.be.equal 'Movie'

    it 'expect to find corresponding node to each model', (done) ->
      class Movie extends Node
      Node.register_model(Movie)
      Movie.findAll().count (err, countBefore) ->
        expect(err).to.be null
        expect(countBefore).to.be.a 'number'
        lebowski = new Movie title: 'The Big Lebowski'
        lebowski.save (err, lebowski) ->
          expect(_.keys(lebowski.data)).to.have.length 1
          expect(err).to.be null
          Movie.findAll().count (err, countNow) ->
            expect(countBefore+1).to.be countNow
            lebowski.remove ->
              done()

    it 'expect to convert to specific models', (done) ->
      class Director extends Node
      new Director( name: 'Robert Zemeckis' ).save (err, robert) ->
        expect(err).to.be null
        expect(robert.constructor_name).to.be 'Director'
        expect(robert.label).to.be 'Director'
        Node.findById robert.id, (err, found) ->
          expect(found.label).to.be.equal 'Director'
          Node.register_model(Director)
          found = Node.convert_node_to_model(found, Director)
          expect(found.constructor_name).to.be.equal 'Director'
          done()

    it 'create, get and drop index', (done) ->
      # random label name to ensure that new indexes are created on each test 
      labelName = "Person#{new Date().getTime()}"
      Node.register_model labelName, { fields: { indexes: { name: true } } }, (err, Person) ->
        expect(err).to.be null
        Person.get_index (err, res) ->
          expect(err).to.be null
          expect(res).to.have.length 1
          Person.drop_entire_index (err) ->
            expect(err).to.be null
            Person.get_index (err, res) ->
              expect(err).to.be null
              expect(res).to.have.length 0
              Person.ensure_index (err, res) ->
                expect(err).to.be null
                Person.get_index (err, res) ->
                  expect(err).to.be null
                  expect(res).to.have.length 1
                  done()

    it 'expect to autoindex models', (done) ->
      # random label name to ensure that new indexes are created on each test 
      labelName = "Movie#{new Date().getTime()}"
      Node.register_model labelName, {
        fields:
          indexes:
            uid: true
            nested:
              id: true
        }, (err, Movie) ->
          deathAndMaiden = new Movie title: 'Death and the Maiden'
          uid = new Date().getTime()
          deathAndMaiden.data.uid = uid
          deathAndMaiden.save (err) ->
            expect(err).to.be null
            Movie.findAll().where { uid: uid }, (err, found) ->
              expect(err).to.be null
              expect(found).to.have.length 1
              expect(found[0].data.uid).to.be.equal uid
              deathAndMaiden.remove ->
                done()

    it 'expect to have unique values', (done) ->
      # random label name to ensure that new indexes are created on each test
      labelName = "Label#{new Date().getTime()}"
      Node.register_model labelName, {
        fields:
          unique:
            uid: true
          defaults:
            uid: -> new Date().getTime()
      }, (err, Model) ->
        expect(err).to.be null
        new Model().save (err, record) ->
          expect(err).to.be null
          uid = record.data.uid
          expect(record.data.uid).to.be.a 'number'
          new Model({ uid: uid }).save (err) ->
            expect(err.message).to.be.a 'string'
            Model.find { uid: uid }, (err, found) ->
              expect(found.length).to.be 1
              done()

    it 'expect to set default values on models', (done) ->
      # we unregister model because it was registered before
      labelName = "Movie#{new Date().getTime()}"
      Node.register_model labelName, {
        fields:
          defaults:
            uid: -> new Date().getTime()
            is_movie: true
            director: 'Roman Polanski'
      }, (err, Movie) ->
        bitterMoon = new Movie title: 'Bitter Moon'
        bitterMoon.save (err) ->
          expect(err).to.be null
          uid = bitterMoon.data.uid
          expect(uid).to.be.a 'number'
          Movie.findAll().where { uid: uid }, (err, found) ->
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
      Node.register_model(Person)
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
                    Person.findById jeff.id, (err, found) ->
                      expect(err).to.be null
                      found.load (err, jeff) ->
                        expect(jeff.label).to.be.equal 'Person'
                        expect(jeff.labels).to.have.length 1
                        expect(jeff.labels[0]).to.be.equal 'Person'
                        done()

    it 'expect to set labels manually as array and persist them', (done) ->
      n = new Node( date: new Date )
      n.labels = [ 'Person', 'Actor' ]
      n.save (err, node) ->
        expect(err).to.be null
        expect(node.labels).to.have.length 2
        n.allLabels (err, labels) ->
          expect(labels).to.have.length 2
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
      Node.register_model(Person)
      new Person({ name: 'Alice' }).save (err, alice) ->
        Person.findById alice.id, (err, alice) ->
          expect(alice.constructor_name).to.be.equal 'Person'
          expect(alice.label).to.be.equal 'Person'
          # expect(alice.labels.constructor).to.be Array
          #console.log alice.constructor_name
          done()

    it 'expect to enable and disable loading hook', (done) ->
      class Person extends Node
      Person::disableLoading()
      new Person({ name: 'Alice' }).save (err, a) ->
        Person::findById a.id, (err, alice) ->
          expect(err).to.be null
          expect(alice.label).to.be null
          Person::enableLoading()
          Person::findById alice.id, (err, alice) ->
            expect(err).to.be null
            expect(alice.label).to.be.equal 'Person'
            done()

    it 'expect to find labeled nodes', (done) ->
      class Person extends Node
      person = new Person({name: 'Dave'})
      Node.findAll().match('n:Person').count (err, countBefore) ->
        person.save ->
          Node.findAll().match('n:Person').count (err, count) ->
            expect(err).to.be null
            expect(count).to.be.equal countBefore+1
            done()

    it 'expect to find or create a node', (done) ->
      uid = new Date().getTime()
      class User extends Node
        fields:
          indexes:
            uid: true
            name: true
      # we have to ensureIndex 
      User.ensure_index (err) ->
        User.findOrCreate { uid: uid, name: 'Node' }, (err, found) ->
          expect(err).to.be null
          expect(found.data.uid).to.be.equal uid
          expect(found.data.name).to.be.equal 'Node'
          expect(found.id).to.be.above 0
          id = found.id
          User.findOrCreate { uid: uid }, (err, found) ->
            expect(err).to.be null
            expect(found.id).to.be.equal id
            uid = new Date().getTime()
            User.findOrCreate { uid: uid, name: 'Node' }, (err, found) ->
              expect(err).to.be null
              expect(found.data.uid).to.be.equal uid
              User.findOrCreate { name: 'Node' }, (err, res) ->
                expect(err.message).to.be.equal 'More than one node found… You have query one distinct result'
                done()

    it 'expect to check if node is persisted', (done) ->
      n = new Node()
      expect(n.isPersisted()).to.be false
      n.save (err, node) ->
        expect(err).to.be null
        expect(node.isPersisted()).to.be true
        node.data.name = 'changed value'
        expect(node.isPersisted()).to.be false
        node.save (err, node) ->
          expect(err).to.be null
          # -->
          expect(node.isPersisted()).to.be true
          Node.findById node.id, (err, node) ->
            expect(err).to.be null
            expect(node.isPersisted()).to.be true
            done()

  describe 'index', ->

    it 'expect to set default values and index values', (done) ->
      Node::fields.defaults =
        uid: -> new Date().getTime()
        nested:
          hasValue: true
      node = new Node()
      node.data.name = 'Steve'
      node.save (err) ->
        expect(err).to.be null
        expect(node.data.uid).to.be.above 0
        expect(node.data.nested.hasValue).to.be true
        done()

  describe 'relationships (incoming, outgoing and between nodes)', ->

    it 'expect to create a relationship between nodes in any direction', (done) ->
      alice = new Node name: 'Alice'
      bob = new Node name: 'Bob'
      charles = new Node name: 'Charles'
      alice.save -> bob.save -> charles.save ->
        graphdb.countRelationships (err, countedRelationshipsBefore) ->
          try
            alice.createRelationshipBetween(bob, ->)
          catch e
            expect(e).to.be.an Error
          try
            alice.createRelationshipBetween(bob, { since: 'years' }, ->)
          catch e
            expect(e).to.be.an Error
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
                      # console.log bob.neo4jrestful.header
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
                              charles.createOrUpdateRelationshipTo bob, 'follows', { since: 'days' }, (err, relationship) ->
                                expect(err).to.be null
                                bob.incomingRelationships().count (err, count) ->
                                  expect(count).to.be 3
                                  graphdb.countRelationships (err, count) ->
                                    expect(count).to.be.equal countedRelationshipsFinally + 1
                                    alice.removeIncludingRelationships -> bob.removeIncludingRelationships -> charles.removeIncludingRelationships ->
                                      done()

    it 'expect to create and get incoming, outgoing and bidirectional relationships between two nodes', (done) ->
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

    it 'expect to set default values for properties on relationships', (done) ->
      Relationship::fields = {
        defaults: {
          created_on: -> new Date().getTime()
        }
      }
      new Node({ name: 'Alice'}).save (err, alice) -> new Node({name: 'Bob'}).save (err, bob) ->
        alice.createRelationshipBetween bob, 'like', { since: 'years', nested: { values: true } }, ->
          alice.allRelationships 'like', (err, relationships) ->
            expect(err).to.be null
            expect(relationships).to.have.length 2
            for relationship, i in relationships
              expect(relationships[i].id).to.be.above 0
              expect(relationships[i].data.since).to.be.equal 'years'
              expect(relationships[i].data.nested.values).to.be.equal true
              expect(relationships[i].data.created_on).to.be.above 0
            alice.incomingRelationships (err, relationship) ->
              r = new Relationship()
              expect(relationship).to.have.length 1
              Relationship::fields.defaults = {}
              done()

    it 'expect to get start and end nodes from relationships', (done) ->
      new Node({ name: 'Alice'}).save (err, alice) -> new Node({name: 'Bob'}).save (err, bob) -> new Node({name: 'Charles'}).save (err, charles) ->
        expect(alice.data.name).to.be 'Alice'
        expect(bob.data.name).to.be 'Bob'
        alice.createOrUpdateRelationshipBetween bob, 'know', (err) ->
          expect(err).to.be null
          charles.createRelationshipTo alice, 'know', (err) ->
            expect(err).to.be null
            alice.incomingRelationships 'know', (err, result) ->
              expect(result).to.have.length 2
              expect(result[0].to.id).to.be.above 0
              expect(result[1].to.id).to.be.above 0
              done()

  describe 'queries acceptance', ->

    it 'expect to query nodes with regex', (done) ->
      uid = new Date().getTime()
      Person = Node.register_model('Person')
      new Person( { uid: uid, name: 'Alice' } ).save (err, alice) ->
        expect(err).to.be null
        Person.find { uid: uid, name: /^alice$/i }, (err, found, debug) ->
          expect(err).to.be null
          expect(found).to.have.length 1
          p = found[0]
          expect(p.data.uid).to.be.equal uid
          expect(p.data.name).to.be.equal alice.data.name
          done()

    it 'expect to query correctly with $and|$or|$not and HAS() with and without paramaters', (done) ->
      # In this test case we test all query building features at once
      # so it's kind of an acceptance test
      # and this tast maybe the one who brakes the most on changes ;)
      uid = -> new Date().getTime()
      # we label to speed query up and to define testspecific graph
      labelName = "Label#{uid()}"
      Node.register_model labelName, { fields: { indexes: { email: true } } }, (err, Model) ->
        new Model( email: 'jackblack@tenacio.us', job: 'Actor' ).save (err, jb) ->
          expect(err).to.be null
          new Model( name: 'Jack Black', job: 'Actor' ).save (err, jb) ->
            expect(err).to.be null
            where = {
              $and: [
                {
                  job: 'Actor'
                }
                {
                  $or: [
                    {
                      email: /^jackblack@tenacio\.us$/
                    }
                    {
                      name: 'Jack Black'
                    }
                  ]
                }
              ]
            }
            Node::cypher._useParameters = false
            # excpetion here, check query string
            expect(Model.find(where).toCypherQuery()).to.be.equal """
              START n = node(*) MATCH n:#{labelName}  WHERE ( ( HAS (n.`job`) AND n.`job` = 'Actor' AND ( HAS (n.`email`) AND n.`email` =~ '^jackblack@tenacio\\\\.us$' OR HAS (n.`name`) AND n.`name` = 'Jack Black' ) ) ) RETURN n;
            """
            Model.find where, (err, found) ->
              expect(err).to.be null
              expect(found).to.have.length 2
              # test also with parameters
              Node::cypher._useParameters = true
              Model.find where, (err, found) ->
                expect(err).to.be null
                expect(found).to.have.length 2
                done()


  describe 'path algorithms', ->

    it 'expect to find shortest path between two nodes', (done) ->
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
                  a.removeIncludingRelationships (err) ->
                    expect(err).to.be null
                    b.removeIncludingRelationships (err) ->
                      expect(err).to.be null
                      done()

  describe 'relationship', ->

    it 'expect to get a relationship by id, update and remove it', (done) ->
      new Node().save (err, a) ->
        new Node().save (err, b) ->
          a.createRelationshipTo b, 'related', { since: 'year' }, (err, result) ->
            expect(result.id).to.be.above 0
            Relationship.findById result.id, (err, found) ->
              expect(err).to.be null
              expect(found.id).to.be.equal result.id
              expect(found.data.since).to.be.equal 'year'
              found.data = from: 'Berlin'
              found.save (err) ->
                expect(err).to.be null
                Relationship.findById result.id, (err, found) ->
                  expect(err).to.be null
                  expect(found.data.since).to.be undefined
                  expect(found.data.from).to.be.equal 'Berlin'
                  found.remove (err) ->
                    expect(err).to.be null
                    Relationship.findById result.id, (err, found) ->
                      expect(err).to.be null
                      expect(found).to.be null
                      done()

    it 'expect to trigger load hook and loading both nodes on getById', (done) ->
      new Node( name: 'Alice' ).save (err, a) ->
        new Node( name: 'Bob' ).save (err, b) ->
          a.createRelationshipTo b, 'related', { since: 'year' }, (err, result) -> 
            expect(err).to.be null
            Relationship.findById result.id, (err, relationship) ->
              expect(err).to.be null
              expect(relationship.from.data.name).to.be.equal 'Alice'
              expect(relationship.to.data.name).to.be.equal 'Bob'
              done()

    it 'expect to update a relationship with preventing id accidently changing and with value extending', (done) ->
      new Node( name: 'Alice' ).save (err, a) ->
        new Node( name: 'Bob' ).save (err, b) ->
          a.createRelationshipTo b, 'related', { since: 'years', city: 'Berlin' }, (err, relationship) ->
            expect(err).to.be null
            Relationship.findById relationship.id, (err, relationship) ->
              expect(relationship.data.since).to.be.equal 'years'
              expect(relationship.data.city).to.be.equal 'Berlin'
              relationship.update since: 'months', (err, updatedRelationship) ->
                expect(relationship.data.since).to.be.equal 'months'
                expect(relationship.data.city).to.be.equal 'Berlin'
                expect(updatedRelationship.data.since).to.be.equal 'months'
                expect(updatedRelationship.data.city).to.be.equal 'Berlin'
                id = relationship.id
                relationship.id = -2
                relationship.data.city = 'Cologne'
                relationship.save (err, updatedRelationship) ->
                  expect(err).to.be null
                  expect(relationship.id).to.equal id
                  expect(updatedRelationship.data.since).to.be.equal 'months'
                  expect(updatedRelationship.data.city).to.be.equal 'Cologne'
                  expect(relationship.data.since).to.be.equal 'months'
                  expect(relationship.data.city).to.be.equal 'Cologne'
                  relationship.update { since: 'weeks' }, (err, updatedRelationship) ->
                    expect(err).to.be null
                    expect(relationship.id).to.equal id
                    expect(updatedRelationship.data.since).to.be.equal 'weeks'
                    expect(updatedRelationship.data.city).to.be.equal 'Cologne'
                    done()

    it 'expect to have schema like behaviour on relationships', (done) ->
      Relationship::fields.defaults =
        created_on: -> String(new Date)
        checked: true
      new Node( name: 'Alice' ).save (err, a) ->
        new Node( name: 'Bob' ).save (err, b) ->
          a.createRelationshipTo b, 'knows', (err, r) ->
            expect(err).to.be null
            expect(r.data.created_on).to.be.a 'string'
            expect(r.data.checked).to.be.equal true
            done()

