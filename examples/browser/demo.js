$(document).ready(function(){
  var log = function(s) {
    var $textarea = $('textarea:first');
    $textarea.val($textarea.val()+s+'\n');

  }
  if (!/^#http.+/.test(window.location.hash))
    log('No hash with url found…');
  else {

    var url = window.location.hash.substring(1);

    log('URL: '+url);

    var neo4j = Neo4jMapper.init(url);
    var Node = neo4j.Node;

    var node = new Node({name: 'Bob'});

    node.save(function(err){
      log('Created node');
      log(err || '…');
      log(JSON.stringify(node.toObject()));
    })

    Node.prototype.findOne(function(err, found){
      log('First node found');
      log(err || '…');
      log((found) ? JSON.stringify(found.toObject()) : '');
    });

  }
});
