var Neo4j = require('../src')
  , neo4j = new Neo4j('http://localhost:7420')
  , Node  = neo4j.Node
  , Graph = neo4j.Graph
  // underscore is used for extending
  , _ = require('underscore');


/*
 * Example #1
 * Demonstrates how to extend Node Objects with custom Models
 */


var Movie = (function(Node) {

  function Movie(data, id) {
    // this is necessary to give the constructed node a name context
    this.init.apply(this, arguments);
  }
  
  _.extend(Movie.prototype, Node.prototype);

  Movie.prototype.fields = {
    defaults: {
      country: 'USA'
    }
  };
  
  return Movie;

})(Node);

Node.registerModel(Movie);

pulpFiction = new Movie({
  title: 'Pulp Fiction' 
});

pulpFiction.data.director = 'Quentin Tarantino';
pulpFiction.data.year = 1994;
pulpFiction.save(function(err,movie){
  console.log('Created movie: ', movie.toObject());
});

/*
 * EXAMPLE #1a
 * a quick + dirty workaround
 * -> not recommend because the local constructor differs from Node constructor and can't be registered + instantiate through model register
 *    that means you'll **not** get the full flabel / object mapping support
 */

var Actor = function(data) {
  var node = new Node(data);
  node.label = 'Actor';
  return node;
}

harvey = new Actor({name: 'Harvey Keitel', role: 'Winston Wolf'});
harvey.save(function(err, harvey){
  console.log('Created actor: ', harvey.toObject());
});


/*
 * EXAMPLE #2
 * Demonstrates how to connect Nodes
 */

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



