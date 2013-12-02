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
    s = helpers.escapeString('""')
    expect(s).to.be.equal '\\"\\"'
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

  it 'flattenObject', ->
    expect(helpers.flattenObject({ a: { b: true } })).to.be.eql { 'a.b': true }
    expect(helpers.flattenObject({ a: { b: null } })).to.be.eql { 'a.b': null }
    expect(helpers.flattenObject({ a: true, b: 0, c: false })).to.be.eql { a: true, b:0, c: false }
    expect(helpers.flattenObject({ a: null, b: undefined })).to.be.eql { a: null, b: undefined }

  it 'isObjectLiteral', ->
    expect(helpers.isObjectLiteral({})).to.be true
    expect(helpers.isObjectLiteral({ a: '1' })).to.be true
    expect(helpers.isObjectLiteral(null)).to.be false
    expect(helpers.isObjectLiteral()).to.be false

  it 'valueToStringForCypherQuery', ->
    expect(helpers.valueToStringForCypherQuery(true)).to.be.equal 'true'
    expect(helpers.valueToStringForCypherQuery(false)).to.be.equal 'false'
    expect(helpers.valueToStringForCypherQuery(null)).to.be.equal 'NULL'
    expect(helpers.valueToStringForCypherQuery(/^test$/i)).to.be.equal '^(?i)test$'
    expect(helpers.valueToStringForCypherQuery(0)).to.be.equal '0'
    expect(helpers.valueToStringForCypherQuery(123.45)).to.be.equal '123.45'
    expect(helpers.valueToStringForCypherQuery('string')).to.be.equal 'string'
    expect(helpers.valueToStringForCypherQuery()).to.be.equal 'NULL'
    expect(helpers.valueToStringForCypherQuery("unescaped\" value")).to.be.equal 'unescaped\\" value'
    expect(helpers.valueToStringForCypherQuery("unescaped\' value")).to.be.equal "unescaped\\' value"
    expect(helpers.valueToStringForCypherQuery('"string"')).to.be.equal 'string'
    expect(helpers.valueToStringForCypherQuery("'string'")).to.be.equal 'string'

  it 'escapeProperty', ->
    expect(helpers.escapeProperty('n.name')).to.be.equal 'n.`name`'
    expect(helpers.escapeProperty('node.name')).to.be.equal 'node.`name`'
    expect(helpers.escapeProperty('`city.name`')).to.be.equal '`city.name`'
    expect(helpers.escapeProperty('node.`name`')).to.be.equal 'node.`name`'
    expect(helpers.escapeProperty('node.name?')).to.be.equal 'node.`name`?'

  it 'serializeObjectForCypher', ->
    o = { name1: 'Philipp', name2: 123, "home`s": { europe: true }, 'node.`property`': 'whatever' }
    expect(helpers.serializeObjectForCypher(o)).to.be.equal "{ `name1` : 'Philipp', `name2` : 123, homes.`europe` : true, node.`property` : 'whatever' }"

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
      expect(new helpers.ConditionalParameters(condition).toString()).to.be.equal '( ' + condition + ' )'

    it 'expect to transform an key-value object to cypher query', ->
      condition = [
        { "n.name": "Alice's" },
        "HAS(n.email))"
      ]
      resultShouldBe = "( HAS (n.`name`) AND n.`name` = 'Alice\\'s' AND HAS(n.email)) )"
      expect(new helpers.ConditionalParameters(condition, { valuesToParameters: false, identifier: 'n' }).toString()).to.be.equal resultShouldBe

    it 'expect to transform an key-value-object to with $OR and $AND operators', ->
      resultShouldBe = """
        ( ( HAS (n.`name`) AND n.`name` =~ '(?i)Alice' AND ( HAS (n.`email`) AND n.`email` =~ '^alice@home\\\\.com$' OR ( HAS (n.`email`) AND n.`email` = 'alice@home.de' AND HAS (n.`country`) AND n.`country` = 'de_DE' ) ) ) )
        """
      condition = [
        { $and: [
          { 'n.name': /Alice/i, },
          $or: [
            { 'n.email': /^alice@home\.com$/ },
            $and: [
              { 'n.email': "alice@home.de" },
              { 'n.country': "de_DE" }
            ],
          ]
        ]}
      ]
      expect(new helpers.ConditionalParameters(condition, { valuesToParameters: false }).toString()).to.be.equal resultShouldBe

    it 'expect to transform an key-value-object with identifier', ->
      resultShouldBe = """
      ( ( HAS (n.`name`) AND n.`name` =~ \'(?i)Alice\' AND HAS (n.`since`) AND r.`since` = \'years\' AND ( HAS (n.`email`) AND n.`email` = \'alice@home.com\' OR ( HAS (n.`email`) AND n.`email` = \'alice@home.de\' AND HAS (n.`country`) AND n.`country` = \'de_DE\' ) ) ) )
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
      expect(new helpers.ConditionalParameters(condition, { identifier: 'n', valuesToParameters: false }).toString()).to.be.equal resultShouldBe

    it 'expect to use mathematical operators', ->
      resultShouldBe = """
      ( ( HAS (n.`name`) AND n.`name` =~ \'(?i)Alice\' AND HAS (n.`since`) AND r.`since` = \'years\' AND ( HAS (n.`email`) AND n.`email` = \'alice@home.com\' OR ( HAS (n.`email`) AND n.`email` = \'alice@home.de\' AND HAS (n.`country`) AND n.`country` = \'de_DE\' ) ) ) )
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
      expect(new helpers.ConditionalParameters(condition, { identifier: 'n', valuesToParameters: false }).toString()).to.be.equal resultShouldBe

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
        ( ( HAS (n.`name`) AND n.`name` =~ {_value0_} AND HAS (n.`since`) AND r.`since` = {_value1_} AND ( HAS (n.`email`) AND n.`email` = {_value2_} OR ( HAS (n.`email`) AND n.`email` = {_value3_} AND HAS (n.`country`) AND n.`country` = {_value4_} ) ) ) )
      """
      expect(con.parametersCount()).to.be.equal 5
      expect(con.values()[0]).to.be.equal '(?i)Alice'
      expect(con.values()[1]).to.be.equal 'years'
      expect(con.values()[2]).to.be.equal 'alice@home.com'
      expect(con.values()[3]).to.be.equal 'alice@home.de'
      expect(con.values()[4]).to.be.equal 'de_DE'

    # Implement feature + test for mathematical operators: =, <>, <, >, <=, >=
