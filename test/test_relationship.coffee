expect        = require('expect.js')

{client,Graph,Node,Relationship} = require('./neoj4mapperForTesting').create()

describe 'Working with Relationship', ->

  it 'expect create a relationship between two nodes (incoming, outcoming and both directions)', (done) ->
    Node.create(name: 'Alice', 'Person').save (err, a) ->
      Node.create(name: 'Bob', 'Person').save (err, b) ->
        a.createRelationTo b, 'knows', (err, r) ->
          expect(err).to.be null
          expect(r.start).to.be.above -100
          expect(r.end).to.be.above -100
          expect(r.type).to.be 'knows'
          expect(r.id).to.be.above -100
          expect(r.from.id).to.be a.id
          expect(r.to.id).to.be b.id
          # to see that also nodes are loaded
          expect(r.from.label).to.be 'Person'
          expect(r.to.label).to.be 'Person'
          done()




  