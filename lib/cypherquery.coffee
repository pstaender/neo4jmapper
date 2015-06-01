Query = require('./query')

class CypherQuery extends Query

CypherQuery.create = (data, cb) ->
  new CypherQuery(data, cb)

module.exports = CypherQuery