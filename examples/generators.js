// exec: node --harmony examples/generators.js

var Neo4j = require('../src')
  , neo4j = new Neo4j('http://localhost:7420')
  , Node  = neo4j.Node
  , Graph = neo4j.Graph
  , suspend = require('suspend');

var Band = Node.register_model('Band');
var Song = Node.register_model('Song');

suspend(function*(resume) {
  var band = yield new Band({ name: 'Foo Fighter'}).save(resume);
  var song = yield new Song({ title: 'Everlong' }).save(resume);
  yield band.createRelationshipTo(song, 'plays', resume);
  var relations = yield song.incomingRelationships('plays', resume);
  console.log(relations[0].toObject());
  done();
})();

var done = function() {
  console.log('\ndone');
}
