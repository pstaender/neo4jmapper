// # Transaction
// Can be used to send (many) cypher statement(s) as transaction
// see: [http://docs.neo4j.org/chunked/preview/rest-api-transactional.html](http://docs.neo4j.org/chunked/preview/rest-api-transactional.html)

var __initTransaction__ = function(neo4jrestful) {

  var Statement = function Statement(transaction, cypher, parameters) {
    this._transaction_  = transaction;
    this.statement = cypher;
    this.parameters = parameters;
  }

  Statement.prototype._transaction_ = null;
  Statement.prototype.statement = '';
  Statement.prototype.parameters = null;
  Statement.prototype.status = null; // 'sending', 'sended'
  Statement.prototype.position = null;
  Statement.prototype.results = null;
  Statement.prototype.errors = null;

  Statement.prototype.toObject = function() {
    return {
      statement: this.statement,
      parameters: JSON.stringify(this.parameters),
      status: this.status,
      position: this.position,
      errors: this.errors,
      results: this.results,
    };
  }

  var Transaction = function Transaction(cypher, parameters, cb) {
    this.neo4jrestful = neo4jrestful.singleton();
    this.begin(cypher, parameters, cb);
  }

  Transaction.Statement = Statement;

  Transaction.prototype.statements = null;
  Transaction.prototype._response_ = null;
  Transaction.prototype.neo4jrestful = null;
  Transaction.prototype.status = ''; // new|creating|open|committing|committed
  Transaction.prototype.id = null;
  Transaction.prototype.uri = null
  Transaction.prototype.expires = null;
  Transaction.prototype.results = null;
  Transaction.prototype._concurrentTransmissions_ = 0;
  Transaction.prototype._responseError_ = null; //will contain response Error
  Transaction.prototype._resortResults_ = true;

  Transaction.prototype.begin = function(cypher, parameters, cb) {
    // reset
    this.statements = [];
    this.results = [];
    this.errors = [];
    this.id = null;
    this.status = 'new';
    return this.add(cypher, parameters, cb);
  }

  Transaction.prototype.add = function(cypher, parameters, cb) {
    var args = Transaction._sortTransactionArguments(cypher, parameters, cb);
    var statements = args.statements;
    // we cancel the operation if we are comitting
    if (this.status === 'committed') {
      var err = Error("You can't add statements after transaction is committed");
      if (typeof args.cb === 'function') {
        cb(err, null);
      } else {
        throw err;
      }
      return this;
    }
    this.addStatementsToQueue(statements);
    if (args.cb) {
      cb = args.cb;
    } else {
      // we execute if we have a callback
      // till then we'll collect the statements
      return this;
    }
    return this.exec(cb);
  }

  Transaction.prototype.exec = function(cb) {
    var self = this;
    // stop here if there is no callback attached
    if (typeof cb !== 'function') {
      return this;
    }
    self.onResponse = cb;

    var url = '';
    var untransmittedStatements = this.untransmittedStatements();

    if (this.status === 'committing') {
      // commit transaction
      url = (this.id) ? '/transaction/'+this.id+'/commit' : '/transaction/commit';
    } else if (!this.id) {
      // begin a transaction
      this.status = 'creating';
      url = '/transaction';
    } else if (this.status === 'open') {
      // add to transaction
      this.status = 'adding';
      url = '/transaction/'+this.id;
    } else if (this.status = 'committed') {
      cb(Error('Transaction is committed. Create a new transaction instead.'), null, null);
    } else {
      throw Error('Transaction has a unknown status. Possible are: creating|open|committing|committed');
    }
    var statements = [];
    untransmittedStatements.forEach(function(statement, i){
      self.statements[i].status = 'sending';
      statements.push({ statement: statement.statement, parameters: statement.parameters });
    });
    this._concurrentTransmissions_++;
    this.neo4jrestful.post(url, { data: { statements: statements } }, function(err, response, debug) {
      self._response_ = response;
      self._concurrentTransmissions_--;
      self._applyResponse(err, response, debug, untransmittedStatements);

      untransmittedStatements.forEach(function(statement) {
        self.statements[statement.position].status = statement.status = 'sended';
      });

      untransmittedStatements = self.untransmittedStatements();

      if (untransmittedStatements.length > 0) {
        // re call exec() until all statements are transmitted
        // TODO: set a limit to avoid endless loop
        return self.exec(cb);
      }
      // TODO: sort and populate resultset, but currently no good way to detect result objects
      else if (self._concurrentTransmissions_ === 0) {//  {
        if (typeof self.onResponse === 'function') {
          var cb = self.onResponse;
          // release onResponse for (optional) next cb
          self.onResponse = null;
          // call final callback
          if (self.status === 'committing')
            self.status = 'committed';
          cb(self._responseError_, self, debug);
          return self;
        }
      }
    });

    return this;
  }

  Transaction.prototype.addStatementsToQueue = function(statements) {
    var self = this;
    if ((statements) && (statements.constructor === Array) && (statements.length > 0)) {
      // attach all statments
      statements.forEach(function(data){
        if (data.statement) {
          var statement = new Statement(self, data.statement, data.parameters);
          statement.position = self.statements.length;
          self.statements.push(statement);
        }
      });
    }
    return this;
  }

  Transaction.prototype._applyResponse = function(err, response, debug, untransmittedStatements) {
    var self = this;
    // if error on request/response
    if (self.status !== 'committing')
      self.status = 'open';
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
          response.results[i].data.forEach(function(data, j){
            //if ((response.results[i]) && (data.row)) {
            if (data.row) {
              response.results[i].data[j] = data.row;
            }
          })
        }
        self.results.push(response.results[i]);
      }
    });
    if ((err)||(!response)) {
      self._responseError_ = (self._responseError_) ? self._responseError_.push(err) : self._responseError_ = [ err ];
    } else {
      self.populateWithDataFromResponse(response);
      // keep track of open transactions
      if (self.status === 'open')
        Transaction.__open_transactions__[self.id] = self;
      else
        delete Transaction.__open_transactions__[self.id];
    }
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
        var match = data.commit.match(/^(.+?\/transaction\/(\d+))\/commit$/);
        this.id = Number(match[2]);
        this.uri = match[1];
      }
    }
  }

  Transaction.prototype.untransmittedStatements = function() {
    var statements = [];
    this.statements.forEach(function(statement){
      if ((statement)&&(!statement.status))
        statements.push(statement);
    });
    return statements;
  }

  Transaction.prototype.commit = function(cypher, parameters, cb) {
    if (typeof cypher === 'function') {
      cb = cypher;
    } else {
      var args = Transaction._sortTransactionArguments(cypher, parameters, cb);
      this.addStatementsToQueue(args.statements);
      cb = args.cb;
    }
    if (typeof cb !== 'function') {
      throw Error('You need to attach a callback an a commit/close operation');
    }
    this.onResponse = cb;
    this.status = 'committing';
    return this.exec(cb);
  }

  Transaction.prototype.close = Transaction.prototype.commit;

  Transaction.create = function(cypher, parameters, cb) {
    return new Transaction(cypher, parameters, cb);
  }

  Transaction.new = function(cypher, parameters) {
    return new Transaction(cypher, parameters);
  }

  Transaction.prototype.onResponse = null;

  Transaction._sortTransactionArguments = function(cypher, parameters, cb) {
    var statements = null;
    // we might have a Graph or CypherQuery Object
    if ((typeof cypher === 'object') && ((typeof cypher.toQuery === 'function') || (typeof cypher.statementsToString === 'function'))) {
      if (cypher.toQuery) {
        statements = [ { statement: cypher.toQuery().statementsToString(), parameters: cypher.parameters() }];
      } else {
        statements = [ { statement: cypher.statementsToString(), parameters: cypher.parameters() }];
      }
      cb = parameters;
    } else if (typeof cypher === 'string') {
      if (typeof parameters === 'function') {
        cb = parameters;
        parameters = {};
      }
      statements = [ { statement: cypher, parameters: parameters || {} } ];
    } else if ((cypher) && (cypher.constructor === Array)) {
      cb = parameters;
      statements = cypher;
    } else if ((cypher) && (cypher.statement)) {
      statements = [ cypher ];
    }
    return {
      statements: statements,
      cb: cb || null
    }
  }

  Transaction.prototype.rollback = function(cb) {
    var self = this;
    if ((this.id)&&(this.status!=='finalized')) {
      this.neo4jrestful.delete('/transaction/'+this.id, function(err, res, debug) {
        // remove from open_transactions
        if (!err)
          delete Transaction.__open_transactions__[self.id];
        cb(err, res, debug);
      });
    } else {
      cb(Error('You can only perform a rollback on an open transaction.'), null);
    }
    return this;
  }

  Transaction.prototype.undo   = Transaction.prototype.rollback;
  Transaction.prototype.delete = Transaction.prototype.rollback;

  Transaction.begin = function(cypher, parameters, cb) {
    return new Transaction(cypher, parameters, cb);
  }

  Transaction.create = Transaction.begin;
  Transaction.open = Transaction.begin;

  Transaction.commit = function(cypher, parameters, cb) {
    return new Transaction().commit(cypher, parameters, cb);
  }

  Transaction.executeAllOpenTransactions = function(cb, action) {
    // action can be commit|rollback
    if (typeof action === 'undefined')
      action = 'commit';
    var count = Object.keys(Transaction.__open_transactions__).length;
    var errors = [];
    var debugs = [];

    var _onDone_ = function(err, res, debug) {
      count--;
      if (err)
        errors.push(err);
      debugs.push(debug);
      if (count === 0)
        cb( ((errors.length > 0) ? errors : null), null, debugs );
    }

    for (var id in Transaction.__open_transactions__) {
      Transaction.__open_transactions__[id][action](_onDone_);
    }

    return this;
  }

  Transaction.commitAll   = function(cb) {
    return this.executeAllOpenTransactions(cb, 'commit');
  }
  Transaction.closeAll    = Transaction.commitAll;

  Transaction.rollbackAll = function(cb) {
    Transaction.executeAllOpenTransactions(cb, 'rollback');
  }

  Transaction.deleteAll   = Transaction.rollbackAll;
  Transaction.undoAll     = Transaction.rollbackAll;

  // all open transactions
  Transaction.__open_transactions__ = {};

  return neo4jrestful.Transaction = Transaction;

}

if (typeof window !== 'object') {
  module.exports = exports = {
    init: __initTransaction__
  };
} else {
  window.Neo4jMapper.initTransaction = __initTransaction__;
}
