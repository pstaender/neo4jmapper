expect        = require('expect.js')

ConditionalParameters = require('../lib/conditionalparameters')
CypherQuery           = require('../lib/cypherquery')

describe 'Building conditional parameters', ->

  it 'expect to transform an object with conditional parameters', ->
    cp = new ConditionalParameters(
      { $and : [ { "a.name": 1 }, { "b.name": 2} ] }
    )
    expect(cp.toString()).to.be(
      "( ( a.name = { _value00_ } AND b.name = { _value01_ } ) )"
    )
    expect(JSON.stringify(cp.parameters)).to.be(
      '{"_value00_":1,"_value01_":2}'
    )
    cp = new ConditionalParameters(
      [ { 'n.city': 'berlin' } , $and: [ { 'n.name': 'peter' }, $not: [ { 'n.name': 'pedro' } ] ] ]
    )
    expect(cp.toString()).to.be(
      "( n.city = { _value00_ } AND ( n.name = { _value01_ } AND NOT ( n.name = { _value02_ } ) ) )"
    )
    expect(JSON.stringify(cp.parameters)).to.be(
      '{"_value00_":"berlin","_value01_":"peter","_value02_":"pedro"}'
    )

describe 'Building CypherQueries', ->

  it 'expect to build a simple cypher query', ->

    query = CypherQuery
      .start('start n = node(1), m = node(*), r = relationship(*)')
      .add(' my Customer Query')
      .onCreate(' ON   CREATE whatever')
      .end()
    expect(query.toString().trim().replace(/[\n+\s+]+/g,' ')).to.be.equal "start n = node(1), m = node(*), r = relationship(*) my Customer Query ON CREATE whatever END" 


  it 'more query building', ->
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
    expect(query.toString().trim().replace(/[\n+\s+]+/g,' ')).to.be.equal """
    _start_ MATCH _match_ ON MATCH {"0":"(on)-[r:RELTYPE ","2":"]-(match)","1.key1":"value1","1.key2":"value2"} OPTIONAL MATCH {"key3":"value3"} WHERE n.name = {value1} OR n.name = {value2} WHERE {"$OR.0.n.name":"Bob","$OR.1.n.name":"bob"} WHERE n.name = {name} WITH _with_ ORDER BY _order by_ SKIP 0 LIMIT 0 DELETE _delete_ RETURN _return_ CREATE _create_ ON CREATE _on create_ CREATE UNIQUE _create unique_ MERGE _merge_ REMOVE _remove_ SET _set_ FOREACH _foreach_ CASE _case_ // a query comment custom statement END
    """.trim()

