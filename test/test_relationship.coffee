expect        = require('expect.js')

{client,Graph,Node,Relationship} = require('./neoj4mapperForTesting')

describe.skip 'Working with Relationship', ->

  it 'expect create a relationship between two node (incoming, outcoming and both directions)', (done) ->
    # rs = Relationship

    Node.create(name: 'Alice').save (err, a) ->
      #console.log 'final a (test)', err, a
      Node.create(name: 'Bob').save (err, b) ->
        #console.log 'final b (test)', err, b
        a.createRelationTo b, 'knows', (err, relations) ->
          console.log relations
          done()

  