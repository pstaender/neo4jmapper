/**
 * **The Graph** respresents the cypher-query-api of the neo4j database
 * You can perform basic actions and queries directly on the graph
 * ###[Query Structure](http://docs.neo4j.org/refcard/2.0/)
 * Read Query Structure:
 * [START]
 * [MATCH]
 * [WHERE]
 * [WITH [ORDER BY] [SKIP] [LIMIT]]
 * RETURN [ORDER BY] [SKIP] [LIMIT]
 *
 * Write-Only Query Structure:
 * (CREATE [UNIQUE] | MERGE)*
 * [SET|DELETE|FOREACH]*
 * [RETURN [ORDER BY] [SKIP] [LIMIT]]
 *
 * Read-Write Query Structure:
 * [START]
 * [MATCH]
 * [WHERE]
 * [WITH [ORDER BY] [SKIP] [LIMIT]]
 * [CREATE [UNIQUE]|MERGE]*
 * [SET|DELETE|FOREACH]*
 * [RETURN [ORDER BY] [SKIP] [LIMIT]]
 *
 * @todo: maybe check of valid query structure?!
 */


/**
 * Initialize the Graph object with a neo4jrestful client
 *
 * @param {object} neo4jrestful object
 * @return {object} Graph object
 */
var __initGraph__ = function(neo4jrestful) {

  // Requirements (for browser and nodejs):
  //   * neo4jmapper helpers
  //   * underscorejs

  if (typeof window === 'object') {
    var helpers               = window.Neo4jMapper.helpers;
    var _                     = window._;
    var CypherQuery           = window.Neo4jMapper.CypherQuery;
    var ConditionalParameters = window.Neo4jMapper.ConditionalParameters;
  } else {
    var helpers               = require('./helpers');
    var _                     = require('underscore');
    var CypherQuery           = require('./cypherquery');
    var ConditionalParameters = require('./conditionalparameters')
  }

  // Ensure that we have a Neo4jRestful client we can work with
  if ((typeof neo4jrestful !== 'undefined') && (helpers.constructorNameOfFunction(neo4jrestful) !== 'Neo4jRestful'))
    throw Error('You have to use an Neo4jRestful object as argument')

  /**
   * Constructor of Graph
   * @constructor
   * @param {string} url
   */
  var Graph = function Graph(url) {
    if (url) {
      this.neo4jrestful = new neo4jrestful.constructor(url);
    }
    this.resetQuery();
    return this;
  }

  Graph.prototype.neo4jrestful                  = neo4jrestful;
  Graph.prototype._query_history_               = null;
  // see graph.resetQuery() for initialization
  Graph.prototype.cypher                        = null;
  Graph.prototype._queryString_                 = '';           // stores a query string temporarily
  Graph.prototype._loadOnResult_                = 'node|relationship|path';
  Graph.prototype._resortResults_               = true;         // see in graph.query() -> _increaseDone()
  Graph.prototype._nativeResults_               = false;        // it's not implemented, all results are processed so far

  Graph.prototype.info                          = null;         // contains the info response of the neo4j database

  Graph.prototype._response_                    = null;         // contains the last response object
  Graph.prototype._columns_                     = null;         // contains `columns` of { columns: [ … ], data: [ … ] }

  /**
    * The following argument combinations are accepted:
    * * query, parameters, cb
    * * parameters, cb
    * * query, cb
    * * cb
    *
    * Example:
    *
    *     `Graph.new().exec('START n=node({id}) RETURN n;', { id: 123 }, cb);`
    *
    *
    * @param  {string|object|function} [query]
    * @param  {object|function} [parameters]
    * @param  {Function} cb (optional, but needed to trigger query execution finally)
    */
  Graph.prototype.exec = function(query, parameters, cb) {
    if (typeof query === 'function') {
      cb = query;
      query = undefined;
      parameters = undefined;
    } else if (typeof parameters === 'function') {
      cb = parameters;
      if (typeof query === 'object') {
        parameters = query;
        query = undefined;
      }
    }
    if (typeof query === 'object') {
      // query may be parameters
      parameters = query;
      query = undefined;
    }
    if ((typeof parameters === 'object') && (parameters !== null)) {
      this.addParameters(parameters);
    }
    if (typeof cb === 'function') {
      // args: queryString, parameters (are added above), cb, options (no options are used here)
      this.query(query, {}, cb, {});
    }
    return this;
  }

  /**
   * Executes a (cypher)-query-string directly in neo4j
   *
   * Example:
   *
   *    `Graph.query('START n=node(123) RETURN n;', cb);`
   *
   * @param  {string} cypherQuery
   * @param  {object} [parameters]
   * @param  {Function} cb
   * @param  {object} [options] will be passed to `neo4jrestful.query`
   */
  Graph.prototype.query = function(cypherQuery, parameters, cb, options) {
    var self = this;
    if (typeof cypherQuery !== 'string') {
      cypherQuery = this.toCypherQuery();
    }
    if (typeof parameters === 'function') {
      cb = parameters;
      options = {};
      parameters = {};
    }
    if ((typeof options !== 'object')&&(options !== null)) {
      options = {};
    }

    if (!parameters)
      parameters = {};
    if (Object.keys(parameters).length > 0) {
      this.addParameters(parameters);
    }

    options.params = (typeof this.cypher.useParameters === 'boolean') ? this.parameters() : {};
    options.context = self;

    // we expect a cb in most cases and perfom the query immediately
    if (typeof cb === 'function') {
      this.neo4jrestful.query(cypherQuery, options, function(err, res, debug) {
        self._processResult(err, res, debug, options, function(err, res, debug) {
          // Is used by Node on performing an "update" via a cypher query
          // The result length is 1, so we remove the array
          if ((res)&&(res.length===1)&&(options.cypher)) {
            if ((options.cypher.limit === 1) || (options.cypher._update_) || (typeof res[0] !== 'object')) {
              res = res[0];
            }
          }
          cb(err, res, debug);
        });
      });
    } else {
      // otherwise we store the query string and expect it will be executed with `.exec(cb)` or `.stream(cb)`
      this._queryString_ = cypherQuery;
    }

    return this;
  }

  /**
   * Returns the number of column wich contains the labels
   * @private
   * @param  {array} columns
   * @return {number} of column
   */
  Graph.prototype.__indexOfLabelColumn = function(columns) {
    var labelColumns = this.__indexOfLabelColumns(columns);
    var keys = Object.keys(labelColumns);
    return (keys.length === 1) ? keys[0] : -1;
  }

  /**
   * Returns the numbers of column wich contain labels
   * @private
   * @param  {array} columns
   * @return {array} indexes
   */
  Graph.prototype.__indexOfLabelColumns = function(columns) {
    var labelColumns = {};
    if (typeof columns === 'undefined')
      columns = this._columns_;
    for (var i=0; i < columns.length; i++) {
      if (/^labels\([a-zA-Z]+\)$/.test(columns[i]))
        labelColumns[i] = columns[i];
    }
    return labelColumns;
  }

  /**
   * Removes label column from array
   * @private
   * @param  {array} array
   * @param  {number} columnIndexOfLabel
   * @return {array} without label column
   */
  Graph.prototype.__removeLabelColumnFromArray = function(array, columnIndexOfLabel) {
    if (typeof columnIndexOfLabel !== 'number')
      columnIndexOfLabel = this.__indexOfLabelColumn();
    array.splice(columnIndexOfLabel, 1);
    return array;
  }

  /**
   * Removes label column from results
   * @private
   * @param  {array} result
   * @return {array} without label column
   */
  Graph.prototype.__sortOutLabelColumn = function(result) {
    var nodeLabels = [];
    var nodeLabelsColumn = this.__indexOfLabelColumn(result.columns);
    var self = this;
    if (nodeLabelsColumn >= 0) {
      // we have a 'labels(n)' column
      for (var i=0; i < result.data.length; i++) {
        nodeLabels.push(result.data[i][nodeLabelsColumn]);
        result.data[i] = self.__removeLabelColumnFromArray(result.data[i], nodeLabelsColumn);
      }
      this._columns_ = self.__removeLabelColumnFromArray(this._columns_, nodeLabelsColumn);
    }
    return nodeLabels;
  }

  /**
   * Processes results array, i.e.
   * * sort out data result
   * * detect objects and instantiate them
   * * applies labels from result set on node object(s)
   * @param  {object}   err
   * @param  {object}   result
   * @param  {object}   debug
   * @param  {object}   options
   * @param  {Function} cb
   */
  Graph.prototype._processResult = function(err, result, debug, options, cb) {
    var self = options.context;
    self._response_ = self.neo4jrestful._response_;
    self._columns_ = self.neo4jrestful._columns_;
    if (err)
      return cb(err, result, debug);
    var loadNode = /node/i.test(self._loadOnResult_);
    var loadRelationship = /relation/i.test(self._loadOnResult_);
    var loadPath = /path/i.test(self._loadOnResult_);
    var todo = 0;
    var iterationDone = false;

    // if we have the native mode, return results instantly at this point
    // TODO: to be implemented
    if (self._nativeResults_)
      // we turned off all loading hooks and no sorting -> so lets return the native result
      return cb(err, result, debug);

    // increase the number of done jobs
    // resort the results if options is activated
    // and finally invoke the cb if we are done
    var __oneMoreJobDone = function() {
      if ((todo === 0)&&(iterationDone)) {

        if (result.data.length === 0) {
          // empty result
          return cb(err, null, debug);
        }

        // if is set to true, sort result:
        // * return only the data (columns are attached to graph._columns_)
        // * remove array if we only have one column
        // e.g. { columns: [ 'count' ], data: [ { 1 } ] } -> 1
        if (self._resortResults_) {
          var cleanResult = result.data;
          // remove array, if we have only one column
          if (self._columns_.length === 1) {
            for (var row=0; row < cleanResult.length; row++) {
              cleanResult[row] = cleanResult[row][0];
            }
          }
          if ((self.cypher.limit === 1) && (cleanResult.length === 1)) {
            // if we have a limit of 1 we can only get data[0] or null
            cleanResult = (cleanResult.length === 1) ? cleanResult[0] : null;
          }
          cb(err, cleanResult, debug);
        } else {
          cb(err, result, debug);
        }
      } else {
        todo--;
      }
    }



    if ((!result.data)&&(result.length === 1)) {
      return cb(err, result[0], debug);
    }

    // check for node labels column (is attached by query builder)
    // copy to a new array and remove column from result to the results cleaner
    var nodeLabelsColumn = this.__indexOfLabelColumn(result.columns);
    var nodeLabels = (this._resortResults_) ? this.__sortOutLabelColumn(result) : null;

    var recommendConstructor = options.recommendConstructor;

    for (var row=0; row < result.data.length; row++) {
      for (var column=0; column < result.data[row].length; column++) {
        var data = result.data[row][column];
        // try to create an instance if we have an object here
        if ((typeof data === 'object') && (data !== null))
          self.neo4jrestful.createObjectFromResponseData(result.data[row][column], recommendConstructor);
        // result.data[row][column] = object;
        var object = result.data[row][column];

        if (object) {
          if ((object.classification === 'Node') && (loadNode)) {

            if (nodeLabelsColumn >= 0) {
              // if we have labels(n) column
              var labels = nodeLabels.shift()
              object = self.neo4jrestful.Node.instantiateNodeAsModel(object, labels, options.recommendConstructor);
              object.__skip_loading_labels__ = true;
            }
            todo++;
            object.load(__oneMoreJobDone);
          }
          else if ((object.classification === 'Relationship') && (loadRelationship)) {
            todo++;
            object.load(__oneMoreJobDone);
          }
          else if ((object.classification === 'Path') && (loadPath)) {
            todo++;
            object.load(__oneMoreJobDone);
          }

          result.data[row][column] = object;
        }

      }
    }

    iterationDone = true;
    __oneMoreJobDone();

    return this;

  }

  /**
   * Stream a cypher query
   * @param  {string}   [cypherQuery]
   * @param  {object}   [parameters]
   * @param  {Function} cb
   * @param  {object}   [options]
   */
  Graph.prototype.stream = function(cypherQuery, parameters, cb, options) {
    var self = this;
    var Node = Graph.Node;
    // check arguments for callback
    if (typeof cypherQuery === 'function') {
      cb = cypherQuery;
      cypherQuery = undefined;
    } else if (typeof parameters === 'function') {
      cb = parameters;
      parameters = undefined;
    }
    if (typeof cypherQuery !== 'string') {
      cypherQuery = this.toCypherQuery();
    }
    if (parameters) {
      this.addParameters(parameters);
    }
    if (!options) {
      options = {};
    }
    // get and set option values
    var recommendConstructor = (options) ? options.recommendConstructor || Node : Node;
    options.params = (typeof this.cypher.useParameters === 'boolean') ? this.parameters() : {};
    parameters = this.parameters();
    var i = 0; // counter is used to prevent changing _columns_ more than once
    var indexOfLabelColumn = null;
    this.neo4jrestful.stream(cypherQuery, options, function(data, response, debug) {
      // neo4jrestful already created an object, but not with a recommend constructor
      self._columns_ = response._columns_;
      if ((self._resortResults_)&&(i === 0)) {
        indexOfLabelColumn = self.__indexOfLabelColumn(self._columns_);
        if (indexOfLabelColumn >= 0) {
          // remove [ 'n', 'labels(n)' ] labels(n) column
          self._columns_ = self.__removeLabelColumnFromArray(self._columns_, indexOfLabelColumn);
        }
      }
      if ((data) && (typeof data === 'object')) {
        if (data.constructor === Array) {
          var labels = null;
          if ((self._resortResults_) && (indexOfLabelColumn >= 0)) {
            labels = data[indexOfLabelColumn];
            data = self.__removeLabelColumnFromArray(data, indexOfLabelColumn);
            if (data.length === 1)
              data = data[0];
          }
          for (var column = 0; column < data.length; column++) {
            if ((data[column]) && (data[column]._response_)) {
              data[column] = self.neo4jrestful.createObjectFromResponseData(data[column]._response_, recommendConstructor);
              data[column] = self.neo4jrestful.Node.instantiateNodeAsModel(data[column], labels);
            }

          }
        }
      }
      self._response_ = response;
      if ((data) && (data._response_)) {
        data = self.neo4jrestful.createObjectFromResponseData(data._response_, recommendConstructor);
        // data = self.neo4jrestful.Node.instantiateNodeAsModel(data, labels);
      }
      i++;
      return cb(data, self, debug);
    });
    return this;
  }

  /**
   * Shortcut for `graph.stream`
   * @see  Graph.prototype.stream
   */
  Graph.prototype.each = Graph.prototype.stream;

  /**
   * Set cypher parameters (and removes previous ones if exists)
   * @param  {object} parameters
   */
  Graph.prototype.setParameters = function(parameters) {
    if ((typeof parameters !== 'object') || (parameters === null))
      throw Error('parameter(s) as argument must be an object, e.g. { key: "value" }')
    if (this.cypher.useParameters === null)
      this.cypher.useParameters = true;
    this.cypher.parameters = parameters;
    return this;
  }

  /**
   * Get cypher parameters
   * @return  {object} parameters
   */
  Graph.prototype.parameters = function() {
    return this.cypher.parameters || {};
  }

  /**
   * Add cypher Parameters
   * @param  {object} parameters
   */
  Graph.prototype.addParameters = function(parameters) {
    this.cypher.addParameters(parameters);
    return this;
  }

  /**
   * Add cypher Parameter
   * @param  {object} parameter
   */
  Graph.prototype.addParameter = function(parameter) {
    return this.addParameters(parameter);
  }

  /**
   * Deletes *all* nodes and *all* relationships
   * @param  {Function} cb
   */
  Graph.prototype.wipeDatabase = function(cb) {
    var query = "START n=node(*) MATCH n-[r?]-() DELETE n, r;";
    return this.query(query, cb);
  }

  /**
   * Counts all objects of a specific type
   * @param  {String}   (all|node|relationship|[nr]:Movie)
   * @param  {Function} cb
   */
  Graph.prototype.countAllOfType = function(type, cb) {
    var query = '';
    if      (/^n(ode)*$/i.test(type))
      query = "START n=node(*) RETURN count(n);"
    else if (/^r(elationship)*$/i.test(type))
      query = "START r=relationship(*) RETURN count(r);";
    else if (/^[nr]\:.+/.test(type))
      // count labels
      query = "MATCH "+type+" RETURN "+type[0]+";";
    else
      query = "START n=node(*) OPTIONAL MATCH n-[r]-() RETURN count(n), count(r);";
    return Graph.query(query, function(err,data){
      if ((data)&&(data.data)) {
        var count = data.data[0][0];
        if (typeof data.data[0][1] !== 'undefined')
          count += data.data[0][1];
        return cb(err, count);
      }
      cb(err,data);
    });
  }

  /**
   * Counts all relationships
   * @param  {Function} cb
   */
  Graph.prototype.countRelationships = function(cb) {
    return this.countAllOfType('relationship', cb);
  }

  /**
   * Alias for countRelationships()
   * @see Graph.countRelationships()
   * @param  {Function} cb
   */
  Graph.prototype.countRelations = function(cb) {
    return this.countRelationships(cb);
  }

  /**
   * Counts all nodes
   * @param  {Function} cb
   */
  Graph.prototype.countNodes = function(cb) {
    return this.countAllOfType('node', cb);
  }

  /**
   * Counts all relationships and nodes
   * @param  {Function} cb
   */
  Graph.prototype.countAll = function(cb) {
    return this.countAllOfType('all', cb);
  }

  /**
   * Queries information of the database and stores it on `this.info`
   * @param  {Function} cb
   */
  Graph.prototype.about = function(cb) {
    var self = this;
    if (this.info)
      return cb(null,info);
    else
      return this.neo4jrestful.get('/'+this.neo4jrestful.urlOptions.endpoint, function(err, info){
        if (info) {
          self.info = info
        }
        if (typeof cb === 'function')
          cb(err,info);
      });
  }

  /**
   * Resets the query history
   */
  Graph.prototype.resetQuery = function() {
    this._query_history_ = [];
    this._queryString_ = '';
    this.cypher = new CypherQuery();
    return this;
  }

  /**
   *  Startpoint to begin query chaining
   *
   *  Example:
   *    `Graph.start().where( …`
   *
   * @param  {string}   start
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.start = function(start, parameters, cb) {
    this.resetQuery();
    if (typeof start === 'function') {
      cb = start;
      start = null;
    }
    if (start)
      this._query_history_.push({ START: start });
    return this.exec(parameters, cb);
  }

  /**
   * `MATCH …`
   * @param  {object|string|array}   match
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   * @param  {object}   [options]
   */
  Graph.prototype.match = function(match, parameters, cb, options) {
    var self = this;
    if (typeof options !== 'object')
      options = {};
    var matchString = '';
    if (typeof match === 'object') {
      if (match.length) {
        match.forEach(function(item){
          if (typeof item === 'object') {
            matchString += self._addObjectLiteralForStatement(item);
          } else {
            matchString += String(item);
          }
        });
      } else {
        matchString = self._addObjectLiteralForStatement(match);
      }
    } else {
      matchString = match;
    }
    // do we have "ON MATCH", "OPTIONAL MATCH" or "MATCH" ?
    if (!options.switch)
      this._query_history_.push({ MATCH: matchString });
    else if (options.switch === 'ON MATCH')
      this._query_history_.push({ ON_MATCH: matchString });
    else if (options.switch === 'OPTIONAL MATCH')
      this._query_history_.push({ OPTIONAL_MATCH: matchString });
    return this.exec(parameters, cb);
  }

  /**
   * `ON MATCH …`
   * @param  {string|object|array}   onMatch
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.onMatch = function(onMatch, parameters, cb) {
    return this.match(onMatch, parameters, cb, { switch: 'ON MATCH' });
  }

  /**
   * `OPTIONAL MATCH …`
   * @param  {string|object|array}   onMatch
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.optionalMatch = function(optionalMatch, parameters, cb) {
    return this.match(optionalMatch, parameters, cb, { switch: 'OPTIONAL MATCH' });
  }

  /**
   * `WITH …`
   * @param  {string}   withStatement
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.with = function(withStatement, parameters, cb) {
    this._query_history_.push({ WITH: withStatement });
    return this.exec(parameters, cb);
  }

  /**
   * `SKIP …`
   * @param  {number}   skip
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.skip = function(skip, parameters, cb) {
    skip = parseInt(skip);
    if (skip === NaN)
      throw Error('SKIP must be an integer');
    this._query_history_.push({ SKIP: skip });
    return this.exec(parameters, cb);
  }

  /**
   * `LIMIT …`
   * @param  {number}   limit
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.limit = function(limit, parameters, cb) {
    limit = parseInt(limit);
    if (limit === NaN)
      throw Error('LIMIT must be an integer');
    this._query_history_.push({ LIMIT: limit });
    this.cypher.limit = limit; // TODO: implement: if limit 1 only return { r } or null instead if [ { r } ]
    return this.exec(parameters, cb);
  }

  /**
   * `MERGE …`
   * @param  {string}   merge
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.merge = function(merge, parameters, cb) {
    // TODO: values to parameter
    this._query_history_.push({ MERGE: merge });
    return this.exec(parameters, cb);
  }

  /**
   * Pure string as statement segment
   * @param  {string}   statement
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.custom = function(statement, parameters, cb) {
    if ((typeof statement === 'object') && (typeof statement.toQuery === 'function')) {
      this._query_history_.push(statement.toQuery().toString());
    } else {
      this._query_history_.push(statement);
    }
    return this.exec(parameters, cb);
  }

  /**
   * `SET …`
   * @param  {string|object}   set
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.set = function(set, parameters, cb) {
    var setString = '';
    var data = null;
    if ((typeof set === 'object')&&(set !== null)) {
      if (set.constructor !== Array) {
        data = set;
        set = [];
        if (this.cypher.useParameters) {
          set = this._addKeyValuesToParameters(data, ' = ');
        } else {
          for (var key in data) {
            var value = data[key];
            set.push(helpers.escapeProperty(key)+' = '+helpers.valueToStringForCypherQuery(value, "'"));
          }
        }
      }
      setString += set.join(', ');
    } else {
      setString += set;
    }
    this._query_history_.push({ SET: setString });
    return this.exec(parameters, cb);
  }

  /**
   * `SET n = …`, sets explicit to a set of values
   *
   * Example:
   *  `{ n: { name: 'Steve' } }`
   *  ~> SET n = { `name`: 'Steve' }
   *
   * @param  {object}   setWith value set
   * @param  {[type]}   parameters
   * @param  {Function} cb
   */
  Graph.prototype.setWith = function(setWith, parameters, cb) {
    var setString = '';
    setString += Object.keys(setWith)[0]+' = ';
    if (this.cypher.useParameters) {
      setString += this._addObjectLiteralToParameters(setWith[Object.keys(setWith)[0]]);
    } else {
      setString += helpers.serializeObjectForCypher(setWith[Object.keys(setWith)[0]]);
    }
    this._query_history_.push({ SET: setString });
    return this.exec(parameters, cb);
  }

  /**
   * `CREATE …`
   * @param  {string|object}   create
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   * @param  {[type]}   [options]
   */
  Graph.prototype.create = function(create, parameters, cb, options) {
    var self = this;
    var creates = [];
    if (typeof options !== 'object')
      options = {};
    options = _.defaults(options, {
      action: 'CREATE'
    });
    if (typeof create === 'object') {
      creates.push('( ');
      if (create.length) {
        create.forEach(function(item){
          if (typeof item === 'object') {
            creates.push(self._addObjectLiteralForStatement(item));
          } else {
            creates.push(String(item));
          }
        });
      } else {
        // we have a object literal
        var parts = [];

        for (var part in create) {

          for (var attr in create[part]) {
            // on create, only add values beside `null` and `undefined`, otherwise neo4j will throw an exception
            if ((create[part][attr] === undefined)||(create[part][attr] === null)) {
              delete create[part][attr];
            }
          }
          parts.push(part + ' ' + self._addObjectLiteralForStatement(create[part]));
        }
        creates.push(parts.join(', '));
      }
      creates.push(' )');
    } else {
      creates = [ create ];
    }
    var statementSegment = {};
    // { CREATE:  creates.join(' ') } for instance
    statementSegment[options.action] = creates.join(' ');
    this._query_history_.push(statementSegment);
    return this.exec(parameters, cb);
  }

  /**
   * `ON CREATE …`
   * @see Graph.prototype.create
   */
  Graph.prototype.onCreate = function(onCreate, parameters, cb) {
    return this.create(onCreate, parameters, cb, { action: 'ON_CREATE' });
  }

  /**
   * `CREATE UNIQUE …`
   * @see Graph.prototype.create
   */
  Graph.prototype.createUnique = function(createUnique, parameters, cb) {
    return this.create(createUnique, parameters, cb, { action: 'CREATE_UNIQUE' });
  }

  /**
   * `CREATE INDEX ON …`
   * @see Graph.prototype.create
   */
  Graph.prototype.createIndexOn = function(createIndexOn, parameters, cb) {
    return this.create(createIndexOn, parameters, cb, { action: 'CREATE_INDEX_ON' });
  }

  /**
   * `CASE … END`
   * @param  {string}   caseStatement
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.case = function(caseStatement, parameters, cb) {
    this._query_history_.push({ CASE: caseStatement.replace(/END\s*$/i,'') + ' END ' });
    return this.exec(parameters, cb);
  }

  /**
   * `DROP INDEX ON …`
   * @param  {string}   dropIndexOn
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.dropIndexOn = function(dropIndexOn, parameters, cb) {
    this._query_history_.push({ DROP_INDEX_ON: dropIndexOn });
    return this.exec(parameters, cb);
  }

  /**
   * `ORDER BY …`
   * @param  {string|object}   property
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.orderBy = function(property, parameters, cb) {
    var direction = ''
      , s = '';
    if (typeof property === 'object') {
      var key = Object.keys(property)[0];
      cb = direction;
      direction = property[key];
      property = key;
      direction = ( (typeof direction === 'string') && ((/^(ASC|DESC)$/).test(direction)) ) ? direction : 'ASC';
      s = property+' '+direction;
    } else if (typeof property === 'string') {
      s = property;
    }
    this._query_history_.push({ ORDER_BY: s });
    return this.exec(parameters, cb);
  }

  /**
   * `WHERE …`
   *
   * Examples:
   *    Graph.start('n=node(1)').where({ $OR : [ { 'n.name?': 'Steve' }, { 'n.name?': 'Jobs' } ] })
   *    Graph.start('n=node(1)').where("n.name? = {name1} OR n.name? = {name2}", { name1: 'Steve', name2: 'Jobs' })
   *
   * @param  {object|string}   where
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.where = function(where, parameters, cb) {
    if (typeof where === 'string') {
      this._query_history_.push({ WHERE: where });
      return this.exec(parameters, cb);
    }
    if (this.cypher.useParameters === null)
      this.cypher.useParameters = true;
    if (!_.isArray(where))
      where = [ where ];
    var options = { valuesToParameters: this.cypher.useParameters, parametersStartCountAt: Object.keys(this.cypher.parameters || {}).length };
    var condition = new ConditionalParameters(where, options);
    var whereCondition = condition.toString().replace(/^\(\s(.+)\)$/, '$1');

    this._query_history_.push({ WHERE: whereCondition });
    if (this.cypher.useParameters)
      this.addParameters(condition.parameters);
    return this.exec(parameters, cb);
  }

  /**
   * `RETURN …`
   * @param  {String}   returnStatement
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.return = function(returnStatement, parameters, cb, distinct) {
    var parts = [];
    if (returnStatement) {
      if (returnStatement.constructor === Array)
        parts = returnStatement;
      if ((typeof returnStatement === 'Object') && (Object.keys(returnStatement).length > 0))
        Object.keys(returnStatement).forEach(function(key) {
          parts.push(key+' AS ' + returnStatement[key]);
        });
    }
    if (parts.length > 0)
      returnStatement = parts.join(', ');
    if (distinct === true)
      this._query_history_.push({ RETURN_DISTINCT: returnStatement });
    else
      this._query_history_.push({ RETURN: returnStatement });
    return this.exec(parameters, cb);
  }

  /**
   * `RETURN DISTINCT …`
   * @param  {[type]}   returnStatement
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.returnDistinct = function(returnStatement, parameters, cb) {
    return this.return(returnStatement, parameters, cb, true);
  }

  /**
   * `DELETE …`
   * @param  {string}   deleteStatement
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.delete = function(deleteStatement, parameters, cb) {
    this._query_history_.push({ DELETE: deleteStatement });
    return this.exec(parameters, cb);
  }

  /**
   * `REMOVE …`
   * @param  {string}   remove
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.remove = function(remove, parameters, cb) {
    this._query_history_.push({ REMOVE: remove });
    return this.exec(parameters, cb);
  }

  /**
   * `FOR EACH …`
   * @param  {[type]}   foreach
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.foreach = function(foreach, parameters, cb) {
    this._query_history_.push({ FOREACH: foreach });
    return this.exec(parameters, cb);
  }

  /**
   * `UNION …`
   * @param  {[type]}   union
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.union = function(union, parameters, cb) {
    this._query_history_.push({ UNION: union });
    return this.exec(parameters, cb);
  }

  /**
   * `USING …`
   * @param  {[type]}   using
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.using = function(using, parameters, cb) {
    this._query_history_.push({ USING: using });
    return this.exec(parameters, cb);
  }

  /**
   * Cypher-compatible-comment
   * @param  {string}   comment
   * @param  {object}   [parameters]
   * @param  {Function} [cb]
   */
  Graph.prototype.comment = function(comment, parameters, cb) {
    this.custom(' /* '+comment.replace(/^\s*\/\*\s*/,'').replace(/\s*\*\/\s*$/,'')+' */ ');
    return this.exec(parameters, cb);
  }

  /**
   * Returns cypher query object
   * @return {object} Cypher query object
   */
  Graph.prototype.toQuery = function() {
    this.cypher.statements = this._query_history_;
    return this.cypher;
  }

  /**
   * Return query as String
   * @return {string} query
   */
  Graph.prototype.toQueryString = function() {
    return this.toQuery().toString();
  }

  /**
   * @see Graph.prototype.toQueryString
   */
  Graph.prototype.toCypherQuery = function() {
    return this.toQuery().toCypher();
  }


  /**
   * Enables loading for specific types
   * Define type(s) simply in a string
   *
   * Examples:
   *   'node|relationship|path' or '*' to enable load for all types
   *   'node|relationship' to enable for node + relationships
   *   '' to disable for all (you can also use `disableLoading()` instead)
   *
   * @param  {string} classifications
   */
  Graph.prototype.enableLoading = function(classifications) {
    if (classifications === '*')
      classifications = 'node|relationship|path';
    this._loadOnResult_ = classifications;
    return this;
  }

  /**
   * Disables loading on results (speeds up queries but less convenient)
   */
  Graph.prototype.disableLoading = function() {
    this._loadOnResult_ = '';
    return this;
  }

  /**
   * Sort Results
   * By default we get results like:
   * `{ columns: [ 'node' ], data: [ [ { nodeObject#1 } ], … [ { nodeObject#n} ]] }`
   * To keep it more handy, we return just the data
   * and (if we have only 1 column) instead of [ {node} ] -> {node}
   * If you want to have access to the columns anyway, you can get them on `graph._columns_`
   *
   * @param  {boolean} trueOrFalse
   */
  Graph.prototype.sortResult = function(trueOrFalse) {
    if (typeof trueOrFalse === 'undefined')
      trueOrFalse = true;
    this._resortResults_ = trueOrFalse;
    return this;
  }

  /**
   * Enables sorting of result
   */
  Graph.prototype.enableSorting = function() {
    return this.sortResult(true);
  }

  /**
   * Disbales sorting of result
   */
  Graph.prototype.disableSorting = function() {
    return this.sortResult(false);
  }

  /**
   * Enables processing of result
   */
  Graph.prototype.enableProcessing = function() {
    this.sortResult(true);
    this.enableLoading('*');
    return this;
  }

  /**
   * Disbales processing of result
   */
  Graph.prototype.disableProcessing = function() {
    this.sortResult(false);
    this.disableLoading();
    return this;
  }

  /**
   * Will be called for logging, can be overriddin with a custom function
   */
  Graph.prototype.log = function(){ /* > /dev/null */ };

  /**
   * Expect s.th. like [ value, value2 ] or [ { key1: value }, { key2: value } ]
   * @private
   * @param  {object|array} parameters
   * @return {object} parameters
   */
  Graph.prototype._addParametersToCypher = function(parameters) {
    if ( (typeof parameters === 'object') && (parameters) && (parameters.constructor === Array) ) {
      if (!this.cypher.hasParameters())
        this.cypher.parameters = {};
      for (var i=0; i < parameters.length; i++) {
        this._addParameterToCypher(parameters[i]);
      }
    } else {
      throw Error('You need to pass parameters as array');
    }
    return this.cypher.parameters;
  }

  /**
   * Expect s.th. like 'value' or { parameterkey: 'value' }
   * @private
   * @param  {string|object} parameter
   * @return {object} parameters
   */
  Graph.prototype._addParameterToCypher = function(parameter) {
    if (!this.cypher.hasParameters())
      this.cypher.parameters = {};
    if ((typeof parameter === 'object')&&(parameter !== null)) {
      _.extend(this.cypher.parameters, parameter);
    } else {
      // we name the parameter with `_value#_`
      var count = Object.keys(this.cypher.parameters).length;
      // values with `undefined` will be replaced with `null` because neo4j doesn't process `undefined`
      this.cypher.parameters['_value'+count+'_'] = (typeof parameter === 'undefined') ? null : parameter;
      // return the placeholder
      return '{_value'+count+'_}';
    }
    return this.cypher.parameters;
  }

  /**
   * Add key value to parameters
   * @private
   * @param  {object} key/value object literal
   * @param  {string} [assignOperator], can be ' = ' or ' : ' for instance
   * @return {array} values
   */
  Graph.prototype._addKeyValuesToParameters = function(o, assignOperator) {
    o = helpers.flattenObject(o);
    var values = [];
    var identifierDelimiter = '`';
    if (typeof assignOperator !== 'string')
      assignOperator = ' = ';
    for (var attr in o) {
      values.push(helpers.escapeProperty(attr, identifierDelimiter) + assignOperator + this._addParameterToCypher(o[attr]));
    }
    return values;
  }

  /**
   * Add object literal to parameters
   * @private
   * @param {object} objectLiteral
   * @return {string} map, e.g. `{ n.`name`: '…', …, n.`phone`: '…'  }`
   */
  Graph.prototype._addObjectLiteralToParameters = function(objectLiteral) {
    return '{ '+this._addKeyValuesToParameters(objectLiteral, ' : ').join(', ')+' }';
  }

  /**
   * Adds object literal to query.
   * If parameters are used (default), values will be added to parameters and replaced with `{_value%n_}`
   * @private
   * @param  {object} o
   * @return {string} serialized object literal
   */
  Graph.prototype._addObjectLiteralForStatement = function(o) {
    var s = '';
    if (this.cypher.useParameters)
      s = this._addObjectLiteralToParameters(o);
    else
      s = helpers.serializeObjectForCypher(o);
    return s;
  }

  /**
   * # Static methods
   * are aliases to methods on instanced Graph()
   */

  /**
   * @see Graph.prototype.query
   */
  Graph.query = function(cypher, parameters, cb, options) {
    return Graph.disableProcessing().query(cypher, parameters, cb, options);
  }

  /**
   * @see Graph.prototype.stream
   */
  Graph.stream = function(cypher, parameters, cb, options) {
    return new Graph.disableProcessing().stream(cypher, parameters, cb, options);
  }

  /**
   * @see Graph.prototype.wipeDatabase
   */
  Graph.wipeDatabase = function(cb) {
    return new Graph().wipeDatabase(cb);
  }

  /**
   * @see Graph.prototype.countAllOfType
   */
  Graph.countAllOfType = function(type, cb) {
    return new Graph().countAllOfType(type, cb);
  }

  /**
   * @see Graph.prototype.countRelationships
   */
  Graph.countRelationships = function(cb) {
    return new Graph().countRelationships(cb);
  }

  /**
   * @see Graph.prototype.countRelations
   */
  Graph.countRelations = function(cb) {
    return new Graph().countRelationships(cb);
  }

  /**
   * @see Graph.prototype.countNodes
   */
  Graph.countNodes = function(cb) {
    return new Graph().countNodes(cb);
  }

  /**
   * @see Graph.prototype.countAll
   */
  Graph.countAll = function(cb) {
    return new Graph().countAll(cb);
  }

  /**
   * @see Graph.prototype.about
   */
  Graph.about = function(cb) {
    return new Graph().about(cb);
  }

  /**
   * @see Graph.prototype.start
   */
  Graph.start = function(start, parameters, cb) {
    return new Graph().enableProcessing().start(start, parameters, cb);
  }

  /**
   * @see Graph.prototype.custom
   */
  Graph.custom = function(statement, parameters, cb) {
    return Graph.start().custom(statement, parameters, cb);
  }

  /**
   * @see Graph.prototype.match
   */
  Graph.match = function(statement, parameters, cb) {
    return Graph.start().match(statement, parameters, cb);
  }

  /**
   * @see Graph.prototype.where
   */
  Graph.where = function(statement, parameters, cb) {
    return Graph.start().where(statement, parameters, cb);
  }

  /**
   * @see Graph.prototype.return
   */
  Graph.return = function(statement, parameters, cb) {
    return Graph.start().return(statement, parameters, cb);
  }

  /**
   * @see Graph.prototype.create
   */
  Graph.create = function(statement, parameters, cb) {
    return Graph.start().create(statement, parameters, cb);
  }

  /**
   * @see Graph.prototype.enableLoading
   */
  Graph.enableLoading = function(classifications) {
    return Graph.start().enableLoading(classifications);
  }

  /**
   * @see Graph.prototype.disableLoading
   */
  Graph.disableLoading = function() {
    return Graph.start().disableLoading();
  }

  /**
   * @see Graph.prototype.disableProcessing
   */
  Graph.disableProcessing = function() {
    return Graph.start().disableProcessing();
  }

  /**
   * @see Graph.prototype.enableProcessing
   */
  Graph.enableProcessing = function() {
    return Graph.start().enableProcessing();
  }

  /**
   * @see Graph.prototype.enableSorting
   */
  Graph.enableSorting = function() {
    return Graph.start().enableSorting();
  }

  /**
   * @see Graph.prototype.disableSorting
   */
  Graph.disableSorting = function() {
    return Graph.start().disableSorting();
  }

  /**
   * Returns a new neo4jrestful client
   * Can be used for direct requests on neo4j for instance
   * @return {object} neo4jrestful
   */
  Graph.request = function() {
    // creates a new neo4jrestful client
    return neo4jrestful.singleton();
  }

  /**
   * Instanciate a new Graph object, same as `new Graph()
   * @see Graph
   */
  Graph.new = function(url) {
    return new Graph(url);
  }

  return neo4jrestful.Graph = Graph;
}

if (typeof window !== 'object') {
  module.exports = exports = {
    init: __initGraph__
  };
} else {
  window.Neo4jMapper.initGraph = __initGraph__;
}
