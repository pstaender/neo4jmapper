var Neo4jMapper = require('../../src');
var neo4j = null;
var JSONStream  = require('JSONStream');

var sequence = require('futures').sequence.create();

var out = function(s) { console.log(s); }
var o = function(s) { process.stdout.write(s); }

try {
  neo4j = new Neo4jMapper(process.argv[2]);
} catch (e) {
  console.error(e.message);
  out('\nUsage: `node '+require('path').basename(__filename)+' http://localhost:7474/ < imports.json`\n');
  process.exit(1);
}

var Node = neo4j.Node;
var Relationship = neo4j.Relationship;
var Graph = neo4j.Graph;
var helpers = neo4j.helpers;

var id_map = {};
var relationships = [];
var todo = 0;
var count = {
  nodes: 0,
  relationships: 0,
};

var stream = JSONStream.parse([true]);

var importRelationships = function(relationships) {
  o('\n[]');
  relationships.forEach(function(relationship) {
    todo++;
    var from = id_map['node_'+relationship.from];
    var to = id_map['node_'+relationship.to];
    if ((!from)||(!to)) {
      console.error('Skipping '+relationship+', because it has no start or endpoint');
      return;
    }
    var r = Relationship.create(relationship.type, relationship.data, from, to);
    try {
      sequence.then(function(next) {
        r.save(function(err, r) {
          if (err) {
            console.error('Error on creating relationship: '+err.message);
          } else {
            o('.');
            count.relationships++;
            next();
          }
          todo--;
          if (todo === 0) {
            out('\nDone. Importet '+count.nodes+' nodes and '+count.relationships+' relationships');
            process.exit(0);
            // next();
          }
        });
      });
    } catch (e) {
      console.error(e.message);
    }
  })
}

o('()');
stream.on('data', function(data) {
  if (data) {
    if (data.classification === 'Node') {
      todo++;
      var n = Node.create(data.data);
      n.labels = data.labels;
      n.save(function(err, node){
        todo--;
        if (err) {
          console.error('Error on creating node: '+err.message);
        } else {
          o('.');
          count.nodes++;
          id_map['node_'+data.id] = node.id;
        }
        if (todo === 0) {
          importRelationships(relationships);
        }
      })
    } else if (data.classification === 'Relationship') {
      relationships.push(data);
    }
  }
});

process.stdin.pipe(stream);
