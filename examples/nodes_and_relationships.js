var Neo4j = require('../src')
  , neo4j = new Neo4j('http://localhost:7474')
  , Node  = neo4j.Node
  , Graph = neo4j.Graph;

var alice = new Node({
  name: 'Alice'
});
var bob = new Node({
  name: 'Bob'
});

alice.save(function(err, alice){
  bob.save(function(err){
    alice.createRelationshipBetween(bob, 'knows', function(){
      bob.createRelationshipTo(alice, 'likes', { since: 'months' }, function() {
        alice.createRelationshipTo(bob, 'knows', { since: 'months' }, function() {
          // we should have now 4 relationships altogether
          // a <-> knows <-> b (2 both directions)
          // a  -  knows  -> b (1 outgoing)
          // a <-  likes <-  b (1 incoming)

          // here are some different ways of quering relationships
          alice.allRelationships(function(err, found){
            console.log('Alice has '+found.length+' relationships (counted from resultset)');
          });
          alice.allRelationships().count(function(err, count){
            console.log('Alice has '+count+' relationships');
          });
          alice.incomingRelationships().count(function(err, count){
            console.log('Alice has '+count+' incoming relationships');
          });
          alice.outgoingRelationships().count(function(err, count){
            console.log('Alice has '+count+' outgoing relationships');
          });
          alice.incomingRelationships('knows').count(function(err, count){
            console.log('Alice has '+count+' relationships of type \'knows\'');
          });
        })
      })
    })
  })
})
