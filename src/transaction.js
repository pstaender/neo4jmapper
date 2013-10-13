//http://docs.neo4j.org/chunked/preview/rest-api-transactional.html

var __initTransaction__ = function(neo4jrestful) {

  var Statement = function Statement(transaction, cypher, parameters, cb) {
    this._transaction_  = transaction;
    this.statement = cypher;
    this.parameters = parameters;
  }

  Statement.prototype._transaction_ = null;
  Statement.prototype.statement = '';
  Statement.prototype.parameters = null;
  Statement.prototype.isTransmitted = false;
  Statement.prototype.position = null;
  Statement.prototype.result = null;
  Statement.prototype.error = null;

  Statement.prototype.toObject = function() {
    return {
      statement: this.statement,
      parameters: JSON.stringify(this.parameters),
      position: this.position,
      isTransmitted: this.isTransmitted,
      position: this.position,
      hasError: Boolean(this.error),
      hasResult: Boolean(this.result),       
    };
  }

  var Transaction = function Transaction(cypher, parameters, cb) {
    this.neo4jrestful = neo4jrestful.singleton();
    this.begin(cypher, parameters, cb);
  }

  Transaction.prototype.statements = null;
  Transaction.prototype._response_ = null;
  Transaction.prototype.neo4jrestful = null;
  Transaction.prototype.status = 'uncommitted';
  Transaction.prototype.id = null;
  Transaction.prototype.uri = null
  Transaction.prototype.expires = null;

  Transaction.prototype.begin = function(cypher, parameters, cb) {
    // reset
    this.statements = [];
    this.id = null;
    return this.add(cypher, parameters, cb);
  }

  Transaction.prototype.add = function(cypher, parameters, cb) {
    var self = this;
    if ((typeof cypher === 'object') && (cypher.constructor === Array)) {
      // attach all objects from array
      cypher.forEach(function(data){
        if (data.statement) {
          var statement = new Statement(this, data.statement, data.parameters);
          statement.position = self.statements.length;
          self.statements.push(statement);
        }
      });
      cb = parameters;
    } else if (typeof cypher === 'string') {
      var statement = cypher;
      if (typeof parameters === 'function') {
        cb = parameters;
        parameters = null;
      }
      var parameters = ((parameters) && (typeof parameters === 'object')) ? parameters : {};
      var statement = new Statement(this, statement, parameters);
      statement.position = this.statements.length;
      this.statements.push(statement);
    }
    return this.exec(cb);
  }

  Transaction.prototype.exec = function(cb) {
    var self = this;
    if (typeof cb === 'function') {
      this.onSucces = cb;
    }
    if ((this.status === 'begin')||(this.status === 'adding')) {
      // there are currently running transmission
      // it's already put on queue, so do nothing
      return this;
    } else {
      var url = '';
      var untransmittedStatements = this.untransmittedStatements();
      if (!this.id) {
        // we have to begin a transaction
        this.status = 'begin';
        url = '/transaction';
      } else {
        // add to transaction
        this.status = 'adding';
        url = '/transaction/'+this.id;
      }
      untransmittedStatements.forEach(function(statement, i){
        statement.isTransmitted = true;
      });
      this.neo4jrestful.post(url, function(err, response, debug) {
        // if error on request/response
        self._response_ = response;
        self.status = (err) ? err.status : 'open';
        untransmittedStatements.forEach(function(statement, i){
          if (response.errors[i])
            statement.error = response.errors[i];
          if (response.results[i])
            statement.results = response.results[i];
          //self.statements[statement.position]
          // statement.isTransmitted = true;
        });
        if ((err)||(!response))
          return self.onSucces(err, response, debug);
        // if error(s) in statement(s)
        if (response.errors.length > 0)
          return self.onSucces(err, response.errors, debug);
        // else
        self.populateWithDataFromResponse(response);
        // console.log(self.toObject(), url)

        untransmittedStatements = self.untransmittedStatements();
        if (untransmittedStatements.length > 0) {
          // re call exec() until all statements are transmitted
          // TODO: set a limit to avoid endless loop          
          return self.exec(cb);
        } else {
          return self.onSucces(err, self, debug);
        }
      });
    }
    return this;
  }

  Transaction.prototype.toObject = function() {
    var statements = [];
    this.statements.forEach(function(stat){
      statements.push(stat.toObject());
    });
    return {
      id: this.id,
      status: this.status,
      statements: statements,
      expires: this.expires,
      uri: this.uri,
    };
  }

  Transaction.prototype.populateWithDataFromResponse = function(data) {
    this.expires = new Date(data.transaction.expires);
    this.uri = data.commit;
    this.id = this.uri.match(/\/transaction\/(\d+)\/commit$/)[1];
  }

  Transaction.prototype.untransmittedStatements = function() {
    var statements = [];
    this.statements.forEach(function(statement){
      if ((statement)&&(!statement.isTransmitted))
        statements.push(statement);
    });
    return statements;
  }

  Transaction.create = function(cypher, parameters, cb) {
    return new Transaction(cypher, parameters, cb);
  }

  Transaction.prototype.onSucces = function(err, response, debug) {
    if (typeof err === 'function') {
      // we have s.th. like Transaction.create().add('…', {}).onSucces(function(err, res){ })
      // then onCommit is used as setter
      this.onSucces = err;
      return this.exec();
    }
    return this;
  }

  return Transaction;

}

if (typeof window !== 'object') {
  module.exports = exports = {
    init: __initTransaction__
  };
} else {
  window.Neo4jMapper.initTransaction = __initTransaction__;
}