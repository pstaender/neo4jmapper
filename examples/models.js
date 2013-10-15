var Neo4j = require('../src')
  , neo4j = new Neo4j('http://localhost:7420')
  , Node  = neo4j.Node
  , Graph = neo4j.Graph;

/*
 * best way to register a model
 * optional patch with your own methods and field definitions
 */
var Movie = Node.registerModel('Movie', {
  summary: function() {
    return 'Directed by '+this.data.director+' in '+this.data.year;
  },
  fields: {
    defaults: {
      created_on: function() {
        return new Date().getTime();
      }
    },
    indexes: {
      title: true
    }
  }
});

var Blockbuster = Movie.registerModel('Blockbuster',{
  fields: {
    defaults: {
      level: 'Blockbuster'
    }
  }
});

backToTheFuture = new Blockbuster({
  title: 'Back to the Future',
}).save(function(err, b2tf) {
  console.log(b2tf.toObject());
});

/*
 * the other way is to register your model first
 * and then extends your model via prototyping
 */
var Director = Node.registerModel('Director');

// override an existing method, toObject() for example
Director.prototype.toObject = function() {
  var o = Node.prototype.toObject.apply(this, arguments);
  o.data.summary = this.data.firstname + ' ' + this.data.surname + ' (* '+this.data.year+')';
  return o;
}

quentin = new Director({
  firstname: 'Quentin',
  surname: 'Tarantino',
  year: 1963
})

quentin.save(function(err, quentin) {
  pulpFiction = new Movie({
    title: 'Pulp Fiction' 
  });
  pulpFiction.data.year = 1994;
  pulpFiction.save(function(err,pulbFiction) {
    quentin.createRelationshipTo(pulbFiction, 'directed', function(err, relationship) {
      quentin.outgoingRelationships('directed', function(err, movie) {
        console.log(movie[0].toObject());
      });
    });
  });
});
