expect                = require('expect.js')
_                     = require('underscore')
neoj4mapperForTesting = require('./neoj4mapperForTesting')
Wait                  = require('../lib/wait')

{randomString,randomInteger} = neoj4mapperForTesting
{client,Graph,Node,Relationship} = neoj4mapperForTesting.create()

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

  it 'expect to find more than one node', (done) ->
    wait = new Wait()
    label = randomString(12).toUpperCase()
    uids = [ randomInteger(8), randomInteger(8), randomInteger(8) ]
    uids.forEach (uid) ->
      wait.add (cb) ->
        Node.create { uid }, label, cb

    wait.done (err, data) ->
      expect(err).to.be null
      expect(data).to.have.length 3
      createdUIDs = [ data[0].uid, data[1].uid, data[2].uid ]
      expect(createdUIDs.sort().join(',')).to.be uids.sort().join(',')

      Graph.query(
        """
          MATCH (n:#{label})
          RETURN n
        """
        ).exec (err, nodes) ->
          done()

  it 'expect to find more than one node by ids', (done) ->
    Node.create { name: 'Dave' }, 'FooFighter', (err, dave) ->
      expect(err).to.be null
      expect(dave.id).to.be.above = -100
      Node.create { name: 'Taylor' }, 'FooFighter', (err, taylor) ->
        expect(err).to.be null
        expect(taylor.id).to.be.above = -100
        Node.create { name: 'Chris' }, 'FooFighter', (err, chris) ->
          expect(err).to.be null
          expect(chris.id).to.be.above = -100
          Node.create { name: 'Nate' }, 'FooFighter', (err, nate) ->
            expect(err).to.be null
            expect(nate.id).to.be.above = -100
            ids = [ dave.id, taylor.id, chris.id, nate.id ]
            Node.findByIDs ids, (err, nodes) ->
              expect(err).to.be null
              # console.log err, nodes
              expect(nodes).to.have.length 4
              foundIDs = [ nodes[0].id, nodes[1].id, nodes[2].id, nodes[3].id ]
              expect(foundIDs.sort().join(',')).to.be.equal ids.sort().join(',')
              done()

  it 'expect to find a node by properties and label', (done) ->
    data =
      uid: randomInteger(12)
    label = randomString(12).toUpperCase()
    Node.create(data).setLabel(label).save (err, node) ->
      expect(node.id).to.be.above -100
      n = Node.find("n.uid = { uid }", data).limit 1, (err, found) ->
        expect(err).to.be null
        expect(found).to.have.length 1
        expect(found[0].uid).to.be data.uid
        #Node.findByLabel(label, )
        Node.find(data).limit 1, (err, found) ->
          expect(err).to.be null
          expect(found).to.have.length 1
          expect(found[0].uid).to.be data.uid
          Node.findByLabel label, (err, found) ->
            expect(err).to.be null
            expect(found).to.have.length 1
            expect(found[0].uid).to.be data.uid
            done()


  it 'expect to reload a node', (done) ->
    # TODO: load is no real (re)load
    Node.create { name: 'Dave' }, 'Person', (err, dave) ->
      id = dave.getID()
      expect(id).to.be.a 'number'
      dave.load (err, reloadedDave) ->
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
    expect(dave.labels().sort().join(',')).to.be "Drummer,Singer"
    expect(dave.label).to.be "Drummer"
    dave.addLabel("Person")
    expect(dave.labels()).to.have.length 3
    expect(dave.labels().sort().join(',')).to.be "Drummer,Person,Singer"
    expect(dave.label).to.be "Drummer"
    dave.addLabels(["Musician","Guitarist"])
    expect(dave.labels()).to.have.length 5
    expect(dave.labels().sort().join(',')).to.be "Drummer,Guitarist,Musician,Person,Singer"
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
              expect(node.labels().sort().join(',')).to.be.equal "Drummer,Musician,Person,Singer"
              expect(node.label).to.be.equal "Person"
              expect(JSON.stringify(node.getData())).to.be JSON.stringify(updatedDave.getData())
              done()

  it.skip 'expect to query Nodes with conditional parameters', (done) ->
    Node.find( $AND: [ { name: 'Dave Grohl' }, { age: 40 } ]).limit 20, (err, result) ->
      done()

  