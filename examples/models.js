var Neo4j = require('../src')
  , neo4j = new Neo4j('http://localhost:7420')
  , Node  = neo4j.Node
  , Graph = neo4j.Graph
  // underscore is used for extending
  , _ = require('underscore');

var Movie = Node.register_model('Movie');

pulpFiction = new Movie({
  title: 'Pulp Fiction' 
});

pulpFiction.data.director = 'Quentin Tarantino';
pulpFiction.data.year = 1994;
pulpFiction.save(function(err,movie){
  console.log('Created movie: ', movie.toObject());
});
