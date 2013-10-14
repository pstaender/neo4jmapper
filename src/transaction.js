//http://docs.neo4j.org/chunked/preview/rest-api-transactional.html

var __initTransaction__ = function(neo4jrestful, Graph) {

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
  Statement.prototype.results = null;
  Statement.prototype.errors = null;

  Statement.prototype.toObject = function() {
    return {
      statement: this.statement,
      parameters: JSON.stringify(this.parameters),
      position: this.position,
      isTransmitted: this.isTransmitted,
      position: this.position,
      errors: this.errors,
      results: this.results,
    };
  }

  var Transaction = function Transaction(cypher, parameters, cb) {
    this.neo4jrestful = neo4jrestful.singleton();
    this.begin(cypher, parameters, cb);
  }

  Transaction.prototype.statements = null;
  Transaction.prototype._response_ = null;
  Transaction.prototype.neo4jrestful = null;
  Transaction.prototype.status = 'offline';
  Transaction.prototype.id = null;
  Transaction.prototype.uri = null
  Transaction.prototype.expires = null;
  Transaction.prototype.results = null;
  Transaction.prototype._concurrentTransmission_ = 0;
  Transaction.prototype._responseError_ = null; //will contain response Error
  Transaction.prototype._resortResults_ = true;
  // Transaction.prototype._loadOnResult_ = neo4jrestful.constructor.prototype._loadOnResult_;

  Transaction.prototype.begin = function(cypher, parameters, cb) {
    // reset
    this.statements = [];
    this.results = [];
    this.errors = [];
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
      if (this.status === 'committing') {
        // commit transaction
        url = (this.id) ? '/transaction/'+this.id+'/commit' : '/transaction/commit';
      } else if (!this.id) {
        // begin a transaction
        this.status = 'begin';
        url = '/transaction';
      } else if (this.status === 'open') {
        // add to transaction
        this.status = 'adding';
        url = '/transaction/'+this.id;
      } else if (this.status = 'finalized') {
        cb(Error('Transaction is committed. Create a new transaction instead.'), null, null);
      } else {
        throw Error('Transaction has a unknown status. Possible are: offline|begin|adding|committing|open|finalized');
      }
      var statements = [];
      untransmittedStatements.forEach(function(statement, i){
        statement.isTransmitted = true;
        statements.push({ statement: statement.statement, parameters: statement.parameters });
      });
      this._concurrentTransmission_++;
      this.neo4jrestful.post(url, { data: { statements: statements } }, function(err, response, debug) {
        self._response_ = response;
        self._concurrentTransmission_--;
        self._applyResponse(err, response, debug, untransmittedStatements);
        untransmittedStatements = self.untransmittedStatements();
        if (untransmittedStatements.length > 0) {
          // re call exec() until all statements are transmitted
          // TODO: set a limit to avoid endless loop          
          return self.exec(cb);
        }
        // TODO: sort and populate resultset, but currently no good way to detect result objects
        if (self._concurrentTransmission_ === 0)
          return self.onSucces(self._responseError_, self, debug);
      });
    }
    return this;
  }

  Transaction.prototype._applyResponse = function(err, response, debug, untransmittedStatements) {
    var self = this;
    // if error on request/response
    self.status = 'open'
    if (err) {
      self.status = (err.status) ? err.status : err;
      if (!self.status)
        self.status = self._response_.status;
    }
    untransmittedStatements.forEach(function(statement, i){
      if (response.errors[i]) {
        statement.error = response.errors[i];
        self.errors.push(response.errors[i]);
      }
      if (response.results[i]) {
        if (self._resortResults_) {
          // move row property one level above
          // { rows: [ {}, {} ]} -> { [ {}, {} ]}
          response.results[i].data.forEach(function(data, i){
            if ((response.results[i]) && (data.row)) {
              response.results[i].data[i] = data.row;
            }
          })
        }
        self.results.push(response.results[i]);
      }
    });
    if ((err)||(!response))
      self._responseError_ = (self._responseError_) ? self._responseError_.push(err) : self._responseError_ = [ err ];
    else
      self.populateWithDataFromResponse(response);
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
    if (data) {
      if ((data.transaction) && (data.transaction.expires))
        this.expires = new Date(data.transaction.expires);
      // exists only on POST a new transaction
      if (data.commit) {
        this.uri = data.commit;
        this.id = this.uri.match(/\/transaction\/(\d+)\/commit$/)[1];
      }
    }
  }

  Transaction.prototype.untransmittedStatements = function() {
    var statements = [];
    this.statements.forEach(function(statement){
      if ((statement)&&(!statement.isTransmitted))
        statements.push(statement);
    });
    return statements;
  }

  Transaction.prototype.commit = function(cypher, parameters, cb) {
    var self = this;
    if (typeof cypher === 'string') {
      if (typeof parameters === 'function') {
        cb = parameters;
        parameters = null;
      }
      this.add(cypher, parameters);
    } else if (typeof cypher === 'function') {
      cb = cypher;
    } 
    if (typeof cb !== 'function') {
      cb = this.onAfterCommit;
      this.status = 'committing';
    }
    this.exec(function(err, transaction, debug) {
      self.status = 'finalized';
      cb(err, transaction, debug);
    });
    return this;
  }

  Transaction.prototype.close = Transaction.prototype.commit;

  Transaction.create = function(cypher, parameters, cb) {
    return new Transaction(cypher, parameters, cb);
  }

  Transaction.prototype.onSucces = function(err, transaction, debug) {
    if (typeof err === 'function') {
      // we have s.th. like Transaction.create().add('…', {}).onSucces(function(err, res){ })
      // then onCommit is used as setter
      this.onSucces = err;
      return this.exec();
    }
    return this;
  }

  Transaction.prototype.onAfterCommit = function(err, response, debug) {
    if (typeof err === 'function') {
      // we have s.th. like Transaction.create().add('…', {}).onSucces(function(err, res){ })
      // then onCommit is used as setter
      this.onAfterCommit = err;
      // return this.commit();
    }
    return this;
  }

  Transaction.prototype.rollback = function(cb) {
    if ((this.id)&&(this.status!=='finalized')) {
      this.neo4jrestful.delete('/transaction/'+this.id, cb);
    } else {
      cb(Error('You can only perform a rollback on an open transaction.'), null);
    }
    return this;
  }

  Transaction.begin = function(cypher, parameters, cb) {
    return new Transaction(cypher, parameters, cb);
  }

  Transaction.open = Transaction.begin;

  Transaction.commit = function(cypher, parameters, cb) {
    return new Transaction().commit(cypher, parameters, cb);
  }
  
  // Transaction.prototype.createObjectFromResponseData = neo4jrestful.constructor.prototype.createObjectFromResponseData;
  // Transaction.prototype._processResult = Graph.prototype._processResult;

  return Transaction;

}

if (typeof window !== 'object') {
  module.exports = exports = {
    init: __initTransaction__
  };
} else {
  window.Neo4jMapper.initTransaction = __initTransaction__;
}