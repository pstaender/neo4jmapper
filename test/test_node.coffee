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
      id = dave.getID()
      expect(id).to.be.above -100
      expect(dave.id).to.be id
      Node.findByID id, (err, dave) ->
        expect(err).to.be null
        expect(dave.id).to.be id
        done()

  it 'expect to reload a node', (done) ->
    Node.create { name: 'Dave' }, 'Person', (err, dave) ->
      id = dave.getID()
      expect(id).to.be.a 'number'
      dave.reload (err, reloadedDave) ->
        expect(reloadedDave.getID()).to.be id
        expect(reloadedDave.name).to.be 'Dave'
        done()

  it 'expect to add one ore more labels', ->
    dave = Node.create({ name: 'Dave' })
    expect(dave.labels()).to.have.length 0
    dave.setLabel("Person")
    expect(dave.labels()).to.have.length 1
    expect(dave.labels()[0]).to.be "Person"
    expect(dave.label).to.be "Person"
    dave.setLabels(["Drummer","Singer"])
    expect(dave.labels()).to.have.length 2
    expect(dave.labels().join(',')).to.be "Drummer,Singer"
    expect(dave.label).to.be "Drummer"
    dave.addLabel("Person")
    expect(dave.labels()).to.have.length 3
    expect(dave.labels().join(',')).to.be "Drummer,Singer,Person"
    expect(dave.label).to.be "Drummer"
    dave.addLabels(["Musician","Guitarist"])
    expect(dave.labels()).to.have.length 5
    expect(dave.labels().join(',')).to.be "Drummer,Singer,Person,Musician,Guitarist"
    expect(dave.label).to.be "Drummer"

  it 'expect to update a node', (done) ->
    Node.create { name: 'Dave', from: 'Seattle' }, 'Person', (err, dave) ->
      Node.findByID dave.id, (err, foundDave) ->
        expect(foundDave.id).to.be dave.id
        expect(foundDave.from).to.be.equal 'Seattle'
        foundDave.from = 'Los Angeles'
        foundDave.age = 40
        foundDave
          .setLabels(["Musician","Drummer"])
          .addLabel("Singer")
          .save (err, updatedDave) ->
            expect(err).to.be null
            expect(updatedDave.getID()).to.be foundDave.id
            expect(updatedDave.id).to.be foundDave.getID()
            Node.findByID dave.id, (err, node) ->
              expect(node.age).to.be 40
              expect(node.name).to.be 'Dave'
              expect(node.from).to.be 'Los Angeles'
              expect(node.labels()).to.have.length 4
              expect(node.labels().join(',')).to.be.equal "Person,Drummer,Musician,Singer"
              expect(node.label).to.be.equal "Person"
              expect(JSON.stringify(node.getData())).to.be JSON.stringify(updatedDave.getData())
              done()

  it 'expect to set labels on a node in a specific order', (done) ->
    Node.create({ name: 'Dave' }).setLabel("Person").save (err, dave) ->
      expect(err).to.be null
      expect(dave.labels().join(',')).to.be 'Person'
      expect(dave.label).to.be.equal 'Person'
      dave.setLabels(["Musician","Person"]).save (err, dave) ->
        expect(err).to.be null
        expect(dave.labels().join(',')).to.be 'Musician,Person'
        expect(dave.label).to.be.equal 'Musician'
        done()

  