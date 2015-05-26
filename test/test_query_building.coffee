expect        = require('expect.js')
Join          = require('join')

Neo4jMapper   = require("../lib/")

{CypherQuery} = Neo4jMapper

describe 'Building CypherQueries', ->

  it.skip 'expect to build a simple cypher query', ->

    query = CypherQuery
      .start('start n = node(1), m = node(*), r = relationship(*)')
      .add(' my Customer Query')
      .onCreate(' ON   CREATE whatever')
      .toString()

  it.skip 'more', ->
    query = CypherQuery.start('_start_')
      .match('_match_')
      .onMatch([ '(on)-[r:RELTYPE ', { key1: 'value1', key2: 'value2' }, ']-(match)' ])
      .optionalMatch({ key3: 'value3' })
      .where('n.name = {value1} OR n.name = {value2}')
      .where({ $OR: [ { 'n.name': 'Bob' }, { 'n.name': 'bob' } ] })
      .where('n.name = {name}', { name: 'Lucy' })
      .addParameters({value1: 'Bob'})
      .addParameters({value2: 'bob'})
      .with('_with_')
      .orderBy('_order by_')
      .skip(0)
      .limit(0)
      .delete('_delete_')
      .return('_return_')
      .create('_create_')
      .onCreate('_on create_')
      .createUnique('_create unique_')
      .merge('_merge_')
      .remove('_remove_')
      .set('_set_')
      .foreach('_foreach_')
      .case('CASE  _case_')
      .comment('a query comment')
      .custom('custom statement')
      .end()

    console.log query.toString()

