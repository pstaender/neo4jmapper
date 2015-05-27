expect        = require('expect.js')

{client,Graph,Node,Relationship} = require('./neoj4mapperForTesting')

describe 'Working with Node', ->

  it 'expect create an unpersisted node object', ->
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

  it 'expect to create an unpersisted node object with label(s)', ->

    dave = Node.create { name: 'Dave' }, 'Person'

    expect(dave.getID()).to.be null
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

  it 'expect to create and persist a node', (done) ->
    Node.create { name: 'Dave' }, 'Person', (err, dave) ->
      expect(err).to.be null
      id = dave.getID()
      expect(id).to.be.above -100
      expect(dave.id).to.be id
      Node.create { name: 'philipp' }, (err, philipp) ->
        expect(err).to.be null
        expect(philipp.label).to.be null
        expect(philipp.labels()).to.have.length 0
        expect(dave.id).to.be.above -100
        Node.create { name: 'Dave' }, [ 'Person', 'Drummer' ], (err, dave) ->
          expect(err).to.be null
          expect(dave.id).to.be.above -100
          expect(dave.label).to.be 'Person'
          expect(dave.labels()).to.have.length 2
          done()

  it 'expect to find a node by id', (done) ->
    Node.create { name: 'Dave' }, 'Person', (err, dave) ->
      expect(err).to.be null
      id = dave.id
      expect(id).to.be.above -100
      Node.findByID id, (err, dave) ->
        expect(err).to.be null
        expect(dave.id).to.be id
        done()
    

  