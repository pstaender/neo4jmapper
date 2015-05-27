expect        = require('expect.js')

{client,Graph,Node,Relationship} = require('./neoj4mapperForTesting')

describe 'Working with Node', ->

  it 'create an unpersisted node object', ->
    dave = Node.create {
      name: 'Dave'
      age: 40
    }
    
    expect(dave.name).to.be 'Dave'
    expect(dave.age).to.be 40
    expect(dave.id).to.be null
    
    fn = -> Node.create {
      name: 'Dave'
      id: 40
    }

    # id is not allowed to set here
    expect(fn).to.throwError()

  it 'create an unpersisted node object with label(s)', ->

    dave = Node.create { name: 'Dave' }, 'Person'

    expect(dave.label).to.be 'Person'
    expect(dave.name).to.be 'Dave'
    expect(dave.labels).to.have.length 1
    expect(dave.id).to.be null
    expect(dave.labels()[0]).to.be 'Person'

    labels = [ 'Person', 'Drummer' ]
    dave = Node.create { name: 'Dave' }, labels
    expect(dave.name).to.be 'Dave'
    expect(dave.label).to.be 'Person'
    expect(dave.id).to.be null
    expect(dave.labels()).to.be labels

  it 'create and persist a node', (done) ->
    Node.create { name: 'Dave' }, 'Person', (err, dave) ->
      expect(err).to.be null
      expect(dave.id).to.be.above -10
      Node.create { name: 'philipp' }, (err, philipp) ->
        expect(err).to.be null
        expect(dave.id).to.be.above -10
        done()
    
    

  