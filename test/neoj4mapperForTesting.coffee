_ = require('underscore')

config = {
  url: "http://localhost:7000/"
  user: "neo4j"
  password: "neo4j"
  altServerUrl: "http://localhost:7002/"
}

Neo4jMapper = require("../lib/")

exports.Neo4jMapper = Neo4jMapper
exports.config = config

exports.randomString = (length = 12) ->
  chars = for i in [0..6]
    Math.random().toString(36).replace(/[^a-z]+/g, '')#.toUpperCase()
  chars.join('').substr(0,length)

exports.randomInteger = (digits = 6) ->
  max = Math.pow(10, digits)
  Math.round(Math.random()*max)
 
exports.create = (_config = null) ->
  config = _.extend(config, _config) if _.isObject(_config) and not _.isArray(_config)

  new Neo4jMapper(config)
