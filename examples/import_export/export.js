var Neo4jMapper = require('../../src');
var neo4j = null;

var out = function(s) { console.log(s); }
var e = function(s) { process.stderr.write(s); }

try {
  neo4j = new Neo4jMapper(process.argv[2]);
} catch (e) {
  console.error(e.message);
  out('\nUsage: `node '+require('path').basename(__filename)+' http://localhost:7474/ > exports.json`\n');
  process.exit(1);
}

var Node = neo4j.Node;
var Relationship = neo4j.Relationship;
var Graph = neo4j.Graph;
var helpers = neo4j.helpers;

var startTime = new Date().getTime();

Node.prototype.toJSON = function(labels) {
  if (labels)
    this.setLabels(labels);
  return JSON.stringify({
    id: this.id,
    classification: 'Node',
    data: this.data,
    labels: this.labels,
  });
}

Relationship.prototype.toJSON = function() {
  return JSON.stringify({
    id: this.id,
    classification: 'Relationship',
    type: this.type,
    properties: this.data,
    from: this.from.id,
    to: this.to.id,
  });
}

var done = {
  up: function() {
    this.count++;
    if (this.count === 2) {
      out('  null\n]');
      console.error('\nDone. Exportet '+done.nodes+' nodes and '+done.relationships+' relationships in '+Math.round((new Date().getTime()-startTime)/1000)+'[s]');
      process.exit(0);
    }
  },
  nodes: 0,
  relationships: 0,
  count: 0,
};

out('[');
Graph.stream('START n=node(*) RETURN n, labels(n)', function(res) {

  if (res) {
    var node = res[0];
    var labels = res[1];
    out('  '+node.toJSON(labels)+', ');
    e('.'); // show progress
    done.nodes++;
  } else {
    done.up();
  }
});

Graph.stream('START r=relationship(*) RETURN r', function(res) {
  if (res) {
    out('  '+res.toJSON()+', ');
    e('.'); // show progress
    done.relationships++;
  } else {
    done.up();
  }
});
