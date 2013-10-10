// # Neo4jMapper
// **(c) 2013 by Philipp Ständer <philipp.staender@gmail.com>**
//
// **Distributed under the GNU General Public License**
//
// Neo4jMapper is an **object mapper for neo4j databases**.
// It's written in JavaScript and ready for server- and clientside use.
// All operations are performed asynchronously since it's using neo4j's REST api.
//
// This file is used for nodejs,
// the browser equivalent is `./browser/browser_(header|footer).js` (will be available through `window.Neo4jMapper`)

// cache sessions
var __sessions__ = {};

var Neo4jMapper = function Neo4jMapper(urlOrOptions) {

  var url = (typeof urlOrOptions === 'string') ? urlOrOptions : urlOrOptions.url;

  if (typeof url !== 'string')
    throw Error('You must provide an url as string or as .url property on an option object');

  // cached?
  if (typeof __sessions__[url] !== 'undefined')
    return __sessions__[url];
  
  // Provide all necessary interfaces to use Noe4jMapper
  var Neo4jRestful  = require('./neo4jrestful').init(urlOrOptions);

  // Create a client from given URL
  // this.__connection__  = new this.Neo4jRestful;

  this.client = new Neo4jRestful();

  this.Graph        = require('./graph').init(this.client);
  var Node          = this.Node          = require('./node').init(this.Graph, this.client);
  var Relationship  = this.Relationship  = require('./relationship').init(this.Graph, this.client, Node);
  var Path          = this.Path          = require('./path').init(this.Graph, this.client);

  this.client.constructorOf = function(name) {
    if (name === 'Node')
      return Node;
    if (name === 'Path')
      return Path;
    if (name === 'Relationship')
      return Relationship;
  }

  __sessions__[urlOrOptions] = this;


  // return {
  //   Node: Node,
  //   Relationship: Relationship,
  //   Path: Path,
  //   Graph: Graph,
  //   client: neo4jrestful,
  //   Neo4jRestful: Neo4jRestful,
  //   helpers: require('./helpers')
  // };
}

// Neo4jMapper.prototype.__connection__ = null;
Neo4jMapper.prototype.Node = null;
Neo4jMapper.prototype.Relationship = null;
Neo4jMapper.prototype.Graph = null;
Neo4jMapper.prototype.Path = null;
Neo4jMapper.prototype.helpers = require('./helpers');

Neo4jMapper.init = function(urlOrOptions) {
  return new Neo4jMapper(urlOrOptions);
}

module.exports = exports = Neo4jMapper;