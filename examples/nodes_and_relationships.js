var Neo4j = require('../src')
  , neo4j = new Neo4j('http://localhost:7474')
  , Node  = neo4j.Node
  , Graph = neo4j.Graph
  // underscore is used for extending
  , _ = require('underscore');


/*
 * Example #1
 * Demonstrates how to extend Node Objects with custom Models
 */


var Movie,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Movie = (function(_super) {

  __extends(Movie, _super);

  function Movie() {
    return Movie.__super__.constructor.apply(this, arguments);
  }

  Movie.prototype.fields = {
    defaults: {
      is_movie: true
    }
  };

  return Movie;

})(Node);

Node.prototype.register_model(Movie);

pulpFiction = new Movie({
  title: 'Pulp Fiction' 
});

pulpFiction.data.director = 'Quentin Tarantino';
pulpFiction.data.year = 1994;
pulpFiction.save(function(err,movie){
  console.log('Created movie: ', movie.toObject());
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
