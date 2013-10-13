var __initTransaction__ = function(neo4jrestful) {

  var Transaction = function Transaction(cypher, parameters) {
    this.begin(cypher, parameters);
  }

  Transaction.prototype.cypher = '';
  Transaction.prototype.parameters = null;
  Transaction.prototype.statements = null;

  Transaction.prototype.begin = function(cypher, parameters) {
    this.statements = [];
  }

  Transaction.prototype.add = function(cypher, parameters) {
    if (typeof this.cypher === 'string') {
      this.cypher = cypher;
      if ((parameters) && (typeof parameters === 'object'))
        this.parameters = parameters;
    }
    return this;
  }

  Transaction.create = function(cypher, parameters) {
    return new Transaction(cypher, parameters);
  }

}

if (typeof window !== 'object') {
  module.exports = exports = {
    init: __initTransaction__
  };
} else {
  window.Neo4jMapper.initTransaction = __initTransaction__;
}