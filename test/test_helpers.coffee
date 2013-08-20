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

describe 'Neo4jMapper (helpers)', ->

  it 'expect to generate md5 hashes', ->
    expect(helpers.md5('Hellö World!')).to.be.equal '909bba9bc963cd9f20d8d9e29d16c7f2'

  it 'escapeString', ->
    s = helpers.escapeString("'a test's'")
    expect(s).to.be.equal "a test\\'s"
    s = helpers.escapeString('"a test\'s"')
    expect(s).to.be.equal "a test\\'s"
    s = helpers.escapeString('a test\'s')
    expect(s).to.be.equal "a test\\'s"
    expect(helpers.escapeString({})).to.be.an 'object'

  it 'sortStringAndCallbackArguments', ->
    {string, callback} = helpers.sortStringAndCallbackArguments 'string', ->
    expect(string).to.be.equal 'string'
    expect(callback).to.be.a 'function'
    {string, callback} = helpers.sortStringAndCallbackArguments ->
    expect(string).to.be null
    expect(callback).to.be.a 'function'
    

  it 'sortStringAndOptionsArguments', ->
    {string, options} = helpers.sortStringAndOptionsArguments 'string', { option: true }
    expect(string).to.be.equal 'string'
    expect(options.option).to.be.equal true
    {string, options} = helpers.sortStringAndOptionsArguments { option: true }
    expect(string).to.be null
    expect(options.option).to.be.equal true
    {string, options} = helpers.sortStringAndOptionsArguments 'string'
    expect(string).to.be.equal 'string'
    expect(Object.keys(options)).to.have.length 0

  it 'sortOptionsAndCallbackArguments', ->
    {options, callback} = helpers.sortOptionsAndCallbackArguments { option: true }, ->
    expect(callback).to.be.a 'function'
    expect(options.option).to.be.equal true
    {options, callback} = helpers.sortOptionsAndCallbackArguments ->
    expect(callback).to.be.a 'function'
    expect(Object.keys(options)).to.have.length 0
  
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
      ( ( n.name =~ '(?i)Alice' AND r.since = 'years' AND ( n.email = 'alice@home.com' OR ( n.`email` = 'alice@home.de' AND n.`country` = 'de_DE' ) ) ) )
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

    it 'expect to transform an key-value-object with parameters', ->
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
      con = new helpers.ConditionalParameters(condition, { identifier: 'n' })
      expect(con.toString()).to.be.equal """
        ( ( n.name =~ {0} AND r.since = {1} AND ( n.email = {2} OR ( n.`email` = {3} AND n.`country` = {4} ) ) ) )
      """
      expect(con.parameters).to.have.length 5
      expect(con.parameters[0]).to.be.equal '(?i)Alice'
      expect(con.parameters[1]).to.be.equal 'years'
      expect(con.parameters[2]).to.be.equal 'alice@home.com'
      expect(con.parameters[3]).to.be.equal 'alice@home.de'
      expect(con.parameters[4]).to.be.equal 'de_DE'
