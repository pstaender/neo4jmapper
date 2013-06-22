var initNode = function(neo4jrestful) {

  var _neo4jrestful = null
    , helpers = null
    , _ = null;

  if (typeof window === 'object') {
    // browser
    // TODO: find a solution for bson object id
    helpers = neo4jmapper_helpers;
    _       = window._;
  } else {
    // nodejs
    helpers  = require('./helpers');
    _        = require('underscore')
  }

  // we can only check for object type,
  // better would be to check for constructor neo4jrestful
  if (_.isObject(neo4jrestful))
    _neo4jrestful = neo4jrestful;

  var cypher_defaults = {
    limit: '',
    skip: '',
    sort: '',
    filter: '',
    match: '',
    return_properties: [],
    where: [],
    // and_where: [],
    from: null,
    to: null,
    direction: null,
    order_by: '',
    order_direction: 'ASC',
    relation: '',
    outgoing: null,
    incoming: null,
    With: null,
    distinct: null,
    label: null,
    node_identifier: null, // can be a|b|n
    by_id: null,
    // flasgs
    _count: null,
    _distinct: null,
    _find_by_id: null
  };

  /*
   * Constructor
   */
  Node = function Node(data, id) {
    // will be used for labels and classes
    if (!this.constructor_name)
      this.constructor_name = helpers.constructorNameOfFunction(this) || 'Node';
    this.init(data, id);
  }

  Node.prototype.init = function(data, id) {
    this.id = id || null;
    this.data = _.extend({}, data);
    this.resetQuery();
    if (id) {
      this.setUriById(id);
    }
    // nested objects must be extended nestedly
    this.fields = _.extend({}, {
      defaults: _.extend({}, this.fields.defaults),
      indexes: _.extend({}, this.fields.indexes),
      unique: _.extend({}, this.fields.unique)
    });
    this.labels = [];
    this.is_instanced = true;
    // we will use a label by default if we have defined an inherited class of node
    if ((this.constructor_name !== 'Node')&&(this.constructor_name !== 'Relationship')&&(this.constructor_name !== 'Path')) {
      this.label = this.cypher.label = this.constructor_name;
    }
  }

  /*
   * Instantiate a node from a specific model
   * Model can be a constructor() or a 'string'
   * and must be registered in Node::registered_models()
   */
  Node.prototype.convert_node_to_model = function(node, model, fallbackModel) {
    if (node.hasId()) {
      if (typeof fallbackModel !== 'function')
        fallbackModel = this.constructor;
      if (typeof model === 'function') {
        model = model.constructor_name || helpers.constructorNameOfFunction(model) || null;
      } else if (node.label) {
        model = node.label;
      } else if (typeof fallbackModel === 'function') {
        model = helpers.constructorNameOfFunction(fallbackModel);
      } else {
        throw Error('No model or label found')
      }
      var Class = node.registered_model(model) || fallbackModel;
      var singleton = new Class()
      // node.constructor_name = singleton.constructor_name;
      return node.copyTo(singleton);
    }
    return null;
  }

  Node.prototype.neo4jrestful = _neo4jrestful;
  Node.prototype.data = {};
  Node.prototype.id = null;
  Node.prototype.fields = {
    defaults: {},
    indexes: {},
    unique: {}
  };
  
  Node.prototype.uri = null;
  Node.prototype._response = null;
  Node.prototype._modified_query = false;
  Node.prototype.is_singleton = false;
  Node.prototype.is_persisted = false;
  Node.prototype.cypher = {};
  Node.prototype.is_instanced = null;
  
  Node.prototype.labels = null;
  Node.prototype.label = null;
  Node.prototype.constructor_name = null;

  Node.prototype.__models__ = {};
  Node.prototype.__already_initialized__ = false; // flag to avoid many initializations

  // you should **never** change this value
  // it's used to dictinct nodes and relationships
  // many queries containg `node()` command will use this value
  // e.g. n = node(*)
  Node.prototype.__type__ = 'node';
  Node.prototype.__type_identifier__ = 'n';


  Node.prototype.singleton = function(id) {
    var Class = this.constructor;
    var node = new Class({},id);
    node.neo4jrestful = _neo4jrestful;
    node.resetQuery();
    node.is_singleton = true;
    node.resetQuery();
    return node;
  }

  Node.prototype.initialize = function(cb) {
    var self = this;
    if (typeof cb !== 'function')
      cb = function() { /* /dev/null */ };
    if (!this.__already_initialized__) {
      return this.onBeforeInitialize(function(err){
        self.onAfterInitialize(cb);
      });
    }
  }

  Node.prototype.onBeforeInitialize = function(next) { next(null,null); }

  Node.prototype.onAfterInitialize = function(cb) {
    var self = this;
    this.__already_initialized__ = true;
    // Index fields
    var fieldsToIndex = this.fieldsToIndex();
    var fieldsWithUniqueValues = this.fieldsWithUniqueValues();
    // we create an object to get the label
    var node = new this.constructor();
    var label = node.label;
    if (label) {
      if (fieldsToIndex) {
        var jobsToBeDone = Object.keys(fieldsToIndex).length;
        var errors  = [];
        var results = [];
        var debugs  = []
        _.each(fieldsToIndex, function(toBeIndexed, field) {
          if (toBeIndexed === true) {
            self.neo4jrestful.query('CREATE INDEX ON :'+label+'('+field+');', function(err, result, debug) {
              if (err)
                errors.push(err);
              if (result)
                results.push(result);
              if (debug)
                debugs.push(debugs);
              jobsToBeDone--;
              if (jobsToBeDone === 0) {
                cb((errors.length > 0) ? errors : null, results, (debugs.length > 0) ? debugs : null);
              }
            });
          }
        });
      }
      // inactive
      // http://docs.neo4j.org/chunked/snapshot/query-constraints.html
      if (fieldsWithUniqueValues === 'deactivated, because it´s not implemented in neo4j, yet') {
        _.each(fieldsWithUniqueValues, function(isUnique, field) {
          if (isUnique)
            //CREATE CONSTRAINT ON (book:Book) ASSERT book.isbn IS UNIQUE
            self.neo4jrestful.query('CREATE CONSTRAINT ON (n:'+label+') ASSERT n.'+field+' IS UNIQUE;', function(err, result, debug) {
              // maybe better ways how to report if an error occurs
              cb(err, result, debug);
            });
        });
      }
    }
  }

  /*
   * Copys only the relevant data(s) of a node to another object
   */
  Node.prototype.copyTo = function(n) {
    n.id = this.id;
    n.data   = _.extend(this.data);
    n.labels = _.clone(this.labels);
    if (this.label)
      n.label  = this.label;
    n.uri = this.uri;
    n._response = _.extend(this._response);
    return n;
  }

  // TODO: implement createByLabel(label)

  Node.prototype.register_model = function(Class, cb) {
    var name = helpers.constructorNameOfFunction(Class);
    Node.prototype.__models__[name] = Class;
    Class.prototype.initialize(cb);
    return Node.prototype.__models__;
  }

  Node.prototype.unregister_model = function(Class) {
    var name = (typeof Class === 'string') ? Class : helpers.constructorNameOfFunction(Class);
    if (typeof Node.prototype.__models__[name] === 'function')
      delete Node.prototype.__models__[name];
    return Node.prototype.__models__;
  }

  Node.prototype.registered_models = function() {
    return Node.prototype.__models__;
  }

  Node.prototype.registered_model = function(model) {
    if (typeof model === 'function') {
      model = helpers.constructorNameOfFunction(model);
    }
    return this.registered_models()[model] || null;
  }

  Node.prototype.resetQuery = function() {
    this.cypher = {}
    _.extend(this.cypher, cypher_defaults);
    this.cypher.where = [];
    this.cypher.match = [];
    this.cypher.return_properties = [];
    this._modified_query = false;
    if (this.id)
      this.cypher.from = this.id;
    return this; // return self for chaining
  }

  Node.prototype.hasId = function() {
    return ((this.is_instanced) && (this.id > 0)) ? true : false;
  }

  Node.prototype.setUriById = function(id) {
    if (_.isNumber(id))
      return this.uri = this.neo4jrestful.baseUrl+'db/data/node/'+id;
  }

  Node.prototype.flattenData = function(useReference) {
    // strongly recommend not to mutate attached node's data
    if (typeof useReference !== 'boolean')
      useReference = false;
    this._modified_query = false;
    if ((typeof this.data === 'object') && (this.data !== null)) {
      var data = (useReference) ? this.data : _.extend(this.data);
      data = helpers.flattenObject(data);
      // remove null values since nodejs cant store them
      for(var key in data) {
        if ((typeof data[key] === 'undefined') || (data[key]===null))
          delete data[key];
      }
      return data;
    }
    return this.data;
  }

  Node.prototype.unflattenData = function(useReference) {
    // strongly recommend not to mutate attached node's data
    if (typeof useReference !== 'boolean')
      useReference = false;
    this._modified_query = false;
    var data = (useReference) ? this.data : _.extend(this.data);
    return helpers.unflattenObject(data);
  }

  Node.prototype.applyDefaultValues = function() {
    for (var key in this.fields.defaults) {
      if (((typeof this.data[key] === 'undefined')||(this.data[key] === null))&&(typeof this.fields.defaults[key] !== 'undefined'))
        // set a default value by defined function
        if (typeof this.fields.defaults[key] === 'function')
          this.data[key] = this.fields.defaults[key](this);
        else
          this.data[key] = this.fields.defaults[key];
    }
    return this;
  }

  Node.prototype.hasFieldsToIndex = function() {
    if (this.hasId())
      return _.keys(this.fields.indexes).length;
    else
      return null;
  }

  Node.prototype.fieldsToIndex = function() {
    return ( (this.fields.indexes) && (_.keys(this.fields.indexes).length > 0) ) ? this.fields.indexes : null;
  }

  Node.prototype.fieldsWithUniqueValues = function() {
    return ( (this.fields.unique) && (_.keys(this.fields.unique).length > 0) ) ? this.fields.unique : null;
  }

  Node.prototype.indexFields = function(cb) {
    if (this.hasFieldsToIndex()) {
      // var join = Join.create();
      var doneCount = 0;
      var fieldsToIndex = this.fieldsToIndex();
      var todoCount = 0;
      // var max = Object.keys(fieldsToIndex).length;
      for (var key in fieldsToIndex) {
        var namespace = this.fields.indexes[key];
        var value = this.data[key];
        if ((_.isString(namespace))&&(typeof value !== 'undefined')&&(value !== null)) {
          todoCount++;
          this.addIndex(namespace, key, value, function(err, data, debug){
            doneCount = doneCount+1;
            // done
            if (doneCount >= todoCount)
              cb(null, doneCount);
          });
        }
      }
      if (todoCount === 0)
        cb(null, doneCount);
    }
    return null;
  }

  Node.prototype.index_schema = function(namespace, fields, cb) {
    // POST http://localhost:7474/db/data/schema/index/person
    var self = this;
    if (_.isString(namespace) && _.isArray(fields)) {
      self.neo4jrestful.post('/db/data/schema/index/'+namespace, { data: fields }, cb);
    }
    return null;
  }

  Node.prototype.save = function(cb) {
    var self = this;
    self.onBeforeSave(self, function(err) {
      // don't execute if an error is passed through
      if ((typeof err !== 'undefined')&&(err !== null))
        cb(err, null);
      else
        self.onSave(function(err, node, debug) {
          self.onAfterSave(self, cb, debug);
        });
    });
  }

  Node.prototype.onBeforeSave = function(node, next) { next(null, null); }

  Node.prototype.onSave = function(cb) {
    var self = this;
    if (this.is_singleton)
      return cb(Error('Singleton instances can not be persisted'), null);
    this._modified_query = false;
    this.applyDefaultValues();
    var method = null;

    function _prepareData(err, data, debug) {
      // copy persisted data on initially instanced node
      data.copyTo(self);
      data = self;
      self.is_singleton = false;
      self.is_instanced = true;
      self.is_persisted = true;
      // if we have defined fields to index
      // we need to call the cb after indexing
      if (self.hasFieldsToIndex()) {
        return self.indexFields(function(){
          if (debug)
            debug.indexedFields = true;
          cb(null, data, debug);
        });
      }
      else
        return cb(null, data, debug);
    }

    if (this.hasId()) {
      method = 'update';
      this.neo4jrestful.put('/db/data/node/'+this.id+'/properties', { data: this.flattenData() }, function(err, node, debug) {
        self.populateWithDataFromResponse(node._response);
        cb(err, node, debug);
      });
    } else {
      method = 'create';   
      this.neo4jrestful.post('/db/data/node', { data: this.flattenData() }, function(err, node, debug) {
        if (node)
          node.copyTo(self);
        _prepareData(err, node, debug);
      });
    }
  }

  Node.prototype.onAfterSave = function(node, next, debug) {
    var labels = node.labelsAsArray();
    if ((typeof err !== 'undefined')&&(err !== null)) {
      return next(err, node, debug);
    } else {
      if (labels.length > 0) {
        // we need to post the label in an extra reqiuest
        // cypher inappropriate since it can't handle { attributes.with.dots: 'value' } …
        node.createLabels(labels, function(labelError, notUseableData, debugLabel) {
          // add label err if we have one
          if (labelError)
            err = (err) ? [ err, labelError ] : labelError;
          // add debug label if we have one
          if (debug)
            debug = (debugLabel) ? [ debug, debugLabel ] : debug;
          return next(labelError, node, debug);
        });
      } else {
        return next(null, node, debug);
      }
    }
  }

  Node.prototype.update = function(cb) {
    var self = this;
    if (this.hasId())
      this.save(cb);
    else
      return cb(Error('You have to save() the node one time before you can perform an update'), null);
  }

  Node.prototype.load = function(cb) {
    var self = this;
    this.onBeforeLoad(self, function(err, node){
      if (err)
        cb(err, node);
      else
        self.onAfterLoad(node, cb);
    })
  }

  Node.prototype.onBeforeLoad = function(node, next) {
    if (node.hasId()) {
      node.allLabels(function(err, labels, debug) {
        if (err)
          return next(err, labels);
        node.labels = _.clone(labels);
        if (labels.length === 1)
          node.label = labels[0]
        next(null, node);
      });
    } else {
      next(null, node);
    }
    
  }

  Node.prototype.onAfterLoad = function(node, next) {
    next(null, node);
  }

  Node.prototype.populateWithDataFromResponse = function(data) {
    // if we are working on the prototype object
    // we won't mutate it and create a new node instance insetad
    var node;
    if (!this.is_instanced)
      node = new Node();
    else
      node = this;
    node._modified_query = false;
    if (data) {
      if (_.isObject(data) && (!_.isArray(data)))
        node._response = data;
      else
        node._response = data[0];
      node.data = node._response.data;
      node.data = node.unflattenData();
      node.uri  = node._response.self;
      //'http://localhost:7474/db/data/node/3648'
      if ((node._response.self) && (node._response.self.match(/[0-9]+$/))) {
        node.id = Number(node._response.self.match(/[0-9]+$/)[0]);
      }
    }
    node.is_persisted = true;
    return node;
  }

  /*
   * Query Methods (via chaining)
   */

  Node.prototype.withLabel = function(label, cb) {
    var self = this;
    // return here if we have an instances node
    if ( (self.hasId()) || (typeof label !== 'string') )
      return self; // return self for chaining
    self._modified_query = true;
    self.cypher.label = label;
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.shortestPathTo = function(end, type, cb) {
    if (typeof type === 'function') {
      cb = type;
      type = '';
    }
    return this.pathBetween(this, end, { 'type': type, 'algorithm' : 'shortestPath' }, function(err, result, debug){
      if ((!err)&&(result))
        // shortestPath result has always only one result
        return cb(err, result[0], debug);
      else
        return cb(err, result, debug);
    });
    return null;
  }

  Node.prototype.pathBetween = function(start, end, options, cb) {
    var self = this;
    var defaultOptions = {
      'max_depth': 0,
      'relationships': {
        'type': '',
        'direction': 'out'  // not in use, yet
      },
      'algorithm' : 'shortestPath'
    };
    if (typeof options === 'object') {
      options = _.extend(defaultOptions, options);
    } else {
      cb = options;
      options = _.extend(defaultOptions);
    }
    // allow shorthands for easier usage
    if (options.max)
      options.max_depth = options.max;
    if (options.type)
      options.relationships.type = options.type;
    if (options.direction)
      options.relationships.direction = options.direction;
    start = helpers.getIdFromObject(start);
    end = helpers.getIdFromObject(end);
    if ((start)&&(end)) {
      // START martin=node(3), michael=node(7)
      // MATCH p = allShortestPaths(martin-[*]-michael)
      // RETURN p
      var type = (options.relationships.type) ? ':'+options.relationships.type : options.relationships.type;
      this.cypher.start = 'a = node('+start+'), b = node('+end+')';
      
      var matchString = 'p = '+options.algorithm+'(a-['+type+( (options.max_depth>0) ? '..'+options.max_depth : '*' )+']-b)';
      
      this.cypher.match.push(matchString.replace(/\[\:\*+/, '[*'));
      this.cypher.return_properties = ['p'];
    }

    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.count = function(identifier, cb) {
    this._modified_query = true;
    this.cypher._count = true;
    if (typeof identifier === 'function') {
      cb = identifier;
      identifier = '*';
    }
    else if (typeof identifier !== 'string')
      identifier = '*';

    if (!this.cypher.start) {
      this.cypher.start = this.__type_identifier__+' = '+this.__type__+'(*)'; // all nodes by default
    }
    this.cypher.return_properties = 'COUNT('+((this.cypher._distinct) ? 'DISTINCT ' : '')+identifier+')';
    if (this.cypher._distinct)
      this.cypher._distinct = false;
    // we only need the count column to return in this case
    if (typeof cb === 'function')
      this.exec(function(err, result, debug){
        if ((result)&&(result.data)) {
          if (result.data.length === 1)
            result = result.data[0][0];
        }
        cb(err, result, debug);
      });
    return this; // return self for chaining
  }

  /*
   * Query-Building methods
   */

  Node.prototype._prepareQuery = function() {
    var query = _.extend(this.cypher);
    var label = (query.label) ? ':'+query.label : '';

    if (!query.start) {
      if (query.from > 0) {
        query.start = 'a = node('+query.from+')';
        query.return_properties.push('a');
      }
      if (query.to > 0) {
        query.start += ', b = node('+query.to+')';
        query.return_properties.push('b');
      }
    }

    var relationships = '';

    if ((query.return_properties)&&(query.return_properties.constructor === Array))
      query.return_properties = _.uniq(query.return_properties).join(', ')

    if (query.relationship) {
      if (query.relationship.constructor === Array) {
        relationships = ':'+helpers.escapeString(query.relationship.join('|'));
      } else {
        relationships = ':'+helpers.escapeString(query.relationship);
      }
    }

    // build in/outgoing directions
    if ((query.incoming)||(query.outgoing)) {
      // query.outgoing = (query.outgoing) ? query.outgoing : '-';
      // query.incoming = (query.incoming) ? query.incoming : '-';
      var x = '';
      var y = '';
      if ((query.incoming)&&(query.outgoing))
        x = y = '-';
      else {
        if (query.incoming) {
          x = '<-';
          y = '-';
        }
        if (query.outgoing) {
          x = '-';
          y = '->';
        }
      }
      query.match.push('(a'+label+')'+x+'[r'+relationships+']'+y+'('+( (this.cypher.to > 0) ? 'b' : '' )+')');
    }
    // guess return objects from start string if it's not set
    // e.g. START n = node(*), a = node(2) WHERE … RETURN (~>) n, a;
    if ((!query.return_properties)||((query.return_properties)&&(query.return_properties.length == 0)&&(query.start))) {
      var _start = ' '+query.start
      if (/ [a-zA-Z]+ \= /.test(_start)) {
        var matches = _start;
        query.return_properties = [];
        matches = matches.match(/[\s\,]([a-z]+) \= /g);
        for (var i = 0; i < matches.length; i++) {
          query.return_properties.push(matches[i].replace(/^[\s\,]*([a-z]+).*$/i,'$1'));
        }
        if ((this.neo4jrestful.version >= 2)&&(query.return_properties.length === 1)&&(query.return_properties[0] === 'n')) {
          // try adding labels if we have only n[node] as return propert
          query.return_properties.push('labels(n)');
        }
        query.return_properties = query.return_properties.join(', ');
      }
    }

    // Set a fallback to START n = node(*) 
    if ((!query.start)&&(!(query.match.length > 0))) {
      // query.start = 'n = node(*)';
      query.start = this.__type_identifier__+' = '+this.__type__+'(*)';
    }
    if ((!(query.match.length>0))&&(this.label)) {
      // e.g. ~> MATCH n:Person
      query.match.push(this.__type_identifier__+':'+this.label);
    }

    // rule(s) for findById
    if (query.by_id > 0) {
      var identifier = query.node_identifier || this.__type_identifier__;
      // put in where clause if `START n = node(*)` or no START statement exists
      if ( (!query.start) || (/^\s*n\s*\=\s*node\(\*\)\s*$/.test(query.start)) ) {
        // we have to use the id method for the special key `id`
        query.where.push("id("+identifier+") = "+query.by_id);
      }
    }
    return query;
  }

  Node.prototype.toCypherQuery = function() {
    var query = this._prepareQuery();
    var template = "";
    if (query.start)
      template += "START %(start)s ";
    if (query.match.length > 0)
      template += "MATCH %(match)s ";
      template += "%(With)s ";
      template += "%(where)s ";
      template += "%(action)s %(return_properties)s ";
    if (query.order_by)
      template += "ORDER BY %(order_by)s ";
    if (query.skip)
      template += "SKIP %(skip)s ";
    if (query.limit)
      template += "LIMIT %(limit)s";
      template += ";";

    var cypher = helpers.sprintf(template, {
      start:              query.start,
      from:               '',
      match:              (query.match.length > 0) ? query.match.join(' AND ') : '',
      With:               (query.With) ? query.With : '',
      action:             (query.action) ? query.action : 'RETURN'+((query._distinct) ? ' DISTINCT ' : ''),
      return_properties:  query.return_properties,
      where:              ((query.where)&&(query.where.length > 0)) ? 'WHERE '+query.where.join(' AND ') : '',
      to:                 '',
      order_by:           (query.order_by) ? query.order_by+' '+query.order_direction : '',
      limit:              query.limit,
      skip:               query.skip  
    })
    cypher = cypher.trim().replace(/\s+;$/,';');
    return cypher;
  }

  Node.prototype._start_node_id = function(fallback) {
    if (typeof fallback === 'undefined')
      fallback = '*'
    if (this.cypher.from > 0)
      return this.cypher.from;
    if (this.cypher.by_id)
      return this.cypher.by_id;
    else
      return (this.hasId()) ? this.id : fallback; 
  };

  Node.prototype._end_node_id = function(fallback) {
    if (typeof fallback === 'undefined')
      fallback = '*'
    return (this.cypher.to > 0) ? this.cypher.to : fallback; 
  };

  Node.prototype.singletonForQuery = function(cypher) {
    var singleton = this.singleton()
    singleton.cypher = _.extend(singleton.cypher, cypher);
    return (this.hasId()) ? singleton.findById(this.id) : this;
  }

  Node.prototype.exec = function(cb, cypher_or_request) {
    var request = null;
    var cypherQuery = null;
    // you can alternatively use an url 
    if (typeof cypher_or_request === 'string')
      cypherQuery = cypher_or_request;
    else if (typeof cypher_or_request === 'object')
      request = _.extend({ type: 'get', data: {}, url: null }, cypher_or_request);
    var self = this;
    // var Class = null;
    var DefaultConstructor = this.recommendConstructor();
    // To check that it's invoked by Noder::find() or Person::find()
    var constructorNameOfStaticMethod = helpers.constructorNameOfFunction(DefaultConstructor);
    
    var _deliverResultset = function(self, cb, err, sortedData, debug) {
      if ( (self.cypher._find_by_id) && (self.cypher.return_properties.length === 1) && (self.cypher.return_properties[0] === 'n') && (sortedData[0]) )
        sortedData = sortedData[0];
      else if ( (self.cypher.limit === 1) && (sortedData.length === 1) )
        sortedData = sortedData[0];
      return cb(err, sortedData, debug);
    } 

    var _processData = function(err, data, debug, cb) {
      if ((err)||(data === null))
        return cb(err, data, debug);
      else {
        var sortedData = [];
        var jobsToDo = data.data.length;
        for (var x=0; x < data.data.length; x++) {
          if (!data.data[x][0]) {
            jobsToDo--;
            break;
          }
          var basicNode = self.neo4jrestful.createObjectFromResponseData(data.data[x][0], DefaultConstructor);
          (function(x){
            if (typeof basicNode.load === 'function') {
              basicNode.load(function(err, node) {
                // convert node to it's model if it has a distinct label and differs from static method
                if ( (node.label) && (node.label !== constructorNameOfStaticMethod) )
                  Node.prototype.convert_node_to_model(node, node.label, DefaultConstructor);
                jobsToDo--;
                sortedData[x] = node;
                if (jobsToDo === 0)
                  return _deliverResultset(self, cb, err, sortedData, debug);
              });
            } else {
              // no load() function found
              sortedData[x] = basicNode;
              jobsToDo--;
            }
          })(x);
        }
        if (jobsToDo === 0)
          return _deliverResultset(self, cb, err, sortedData, debug);
      }
    }

    if (typeof cb === 'function') {
      var cypher = this.toCypherQuery();
      // reset node, because it might be called from prototype
      // if we have only one return property, we resort this
      if ( (this.cypher.return_properties)&&(this.cypher.return_properties.length === 1) ) {
        var options = {};
        if (this.label)
          options.label = this.label;
        if (cypherQuery)
          return this.neo4jrestful.query(cypherQuery, options, function(err, data, debug) {
            _processData(err, data, debug, cb);
          });
        else if (request)
          return this.neo4jrestful[request.type](request.url, request.data, function(err, data, debug) {
            // transform to resultset
            data = {
              data: [ [ data ] ]
            };
            _processData(err, data, debug, cb);
          });
        else
          // default, use the build cypher query
          return this.neo4jrestful.query(cypher, options, function(err, data, debug) {
            _processData(err, data, debug, cb);
          });
      } else {
        return this.neo4jrestful.query(cypher, cb);
      } 
    }
    return null;
  }

  /*
   * Relationship methods
   */

  Node.prototype.incomingRelationships = function(relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query = true;
    if (typeof relation !== 'function') {
      self.cypher.relationship = relation;
    } else {
      cb = relation;
    }
    self.cypher.node_identifier = 'a';
    self.cypher.start = 'a = node('+self._start_node_id('*')+')';
    self.cypher.start += (self.cypher.to > 0) ? ', b = node('+self._end_node_id('*')+')' : ''
    self.cypher.incoming = true;
    self.cypher.outgoing = false;
    self.cypher.return_properties = ['r'];
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.outgoingRelationships = function(relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query = true;
    if (typeof relation !== 'function') {
      self.cypher.relationship = relation;
      cb = relation;
    } else {
      cb = relation;
    }
    self.cypher.node_identifier = 'a';
    self.cypher.start = 'a = node('+self._start_node_id('*')+')';
    self.cypher.start += (self.cypher.to > 0) ? ', b = node('+self._end_node_id('*')+')' : ''
    self.cypher.incoming = false;
    self.cypher.outgoing = true;
    self.cypher.return_properties = ['r'];
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.incomingRelationshipsFrom = function(node, relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query = true;
    self.cypher.from = self.id || null;
    self.cypher.to = helpers.getIdFromObject(node);
    if (typeof relation !== 'function')
      self.cypher.relationship = relation;
    self.cypher.return_properties = ['r'];
    return self.incomingRelationships(relation, cb);
  }

  Node.prototype.outgoingRelationshipsTo = function(node, relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query = true;
    self.cypher.to = helpers.getIdFromObject(node);
    if (typeof relation !== 'function')
      self.cypher.relationship = relation;
    self.cypher.return_properties = ['r'];
    self.exec(cb);
    return self.outgoingRelationships(relation, cb);
  }

  Node.prototype.allDirections = function(relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query = true;
    if (typeof relation !== 'function')
      self.cypher.relationship = relation;
    self.cypher.node_identifier = 'a';
    self.cypher.start = 'a = node('+self._start_node_id('*')+'), b = node('+self._end_node_id('*')+')';
    self.cypher.incoming = true;
    self.cypher.outgoing = true;
    self.cypher.return_properties = ['a', 'b', 'r'];
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.relationshipsBetween = function(node, relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query = true;
    self.cypher.to = helpers.getIdFromObject(node);
    if (typeof relation !== 'function')
      self.cypher.relationship = relation;
    self.cypher.return_properties = ['r'];
    self.exec(cb);
    return self.allDirections(relation, cb);
  }

  Node.prototype.allRelationships = function(relation, cb) {
    var self = this.singletonForQuery();
    var label = (this.cypher.label) ? ':'+this.cypher.label : '';
    if (typeof relation === 'string') {
      relation = ':'+relation;
    } else {
      cb = relation;
      relation = '';
    }
    self._modified_query = true;
    self.cypher.match.push('n'+label+'-[r'+relation+']-()');
    self.cypher.return_properties = ['r'];
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.limit = function(limit, cb) {
    this._modified_query = true;
    this.cypher.limit = Number(limit);
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.skip = function(skip, cb) {
    this._modified_query = true;
    this.cypher.skip = Number(skip);
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.distinct = function(cb) {
    this._modified_query = true;
    this.cypher._distinct = true;
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.orderBy = function(property, direction, cb) {
    this._modified_query = true;
    if (typeof direction === 'string')
      this.cypher.order_direction = direction;
    this.cypher.order_by = property;
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.match = function(string, cb) {
    this.cypher.match.push(string);
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.where = function(where, cb) {
    this._modified_query = true;
    this.cypher.where = [];
    return this.andWhere(where, cb);
  }

  Node.prototype.andWhere = function(where, cb, _options) {
    this._modified_query = true;
    if ((_.isObject(where))&&(!_.isArray(where)))
      where = [ where ];
    var attributes = helpers.extractAttributesFromCondition(_.extend(where));
    for (var i = 0; i < attributes.length; i++) {
      this.whereHasProperty(attributes[i]);
    }
    if (typeof _options === 'undefined')
      _options = {};
    if (typeof _options.identifier !== 'string')
      // good or bad idea that we use by default n as identifier?
      _options.identifier = 'n';
    this.cypher.where.push(helpers.conditionalParameterToString(_.extend(where),undefined,_options));
    this.exec(cb);
    return this; // return self for chaining
  }

  // Node.prototype.orWhere = function(where, cb) {
  //   this.cypher.where = [ { '$or': [ this.cypher.where, where ] } ];
  //   this.exec(cb);
  //   return this;
  // }

  // Node.prototype.whereNot = function(where, cb){
  //   if (typeof where !== 'object')
  //     return this;
  //   this.cypher.where = [];
  //   return this.where({ '$not': where }, cb);
  // }
  
  Node.prototype.whereStartNode = function(where, cb) {
    this.cypher.where = [];
    return this.andWhere(where, cb, { identifier: 'a' });
  }

  Node.prototype.whereEndNode = function(where, cb) {
    this.cypher.where = [];
    return this.andWhere(where, cb, { identifier: 'b' });
  }

  Node.prototype.whereNode = function(where, cb) {
    this.cypher.where = [];
    return this.andWhere(where, cb, { identifier: 'n' });
  }

  Node.prototype.whereRelationship = function(where, cb) {
    this.cypher.where = [];
    return this.andWhere(where, cb, { identifier: 'r' });
  }

  Node.prototype.andWhereStartNode = function(where, cb) {
    return this.andWhere(where, cb, {identifier: 'a' });
  }

  Node.prototype.andWhereEndNode = function(where, cb) {
    return this.andWhere(where, cb, { identifier: 'b' });
  }

  Node.prototype.andWhereNode = function(where, cb) {
    return this.andWhere(where, cb, { identifier: 'n' });
  }

  Node.prototype.andWereRelationship = function(where, cb) {
    return this.andWhere(where, cb, { identifier: 'r' });
  }

  Node.prototype.whereHasProperty = function(property, identifier, cb) {
    if (_.isFunction(identifier)) {
      cb = identifier;
      identifier = null;
    }
    this._modified_query = true;
    if (typeof property !== 'string') {
      // we need a property to proceed
      return cb(Error('Property name is mandatory.'),null);
    }
    if (this.cypher.return_properties.length === 0) {
      this.findAll();
    }
    // no identifier found, guessing from return properties
    if (typeof identifier !== 'string')
      identifier = this.cypher.return_properties[this.cypher.return_properties.length-1];
    this.andWhere('HAS ('+identifier+'.'+property+')');
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.whereNodeHasProperty = function(property, cb) {
    return this.whereHasProperty(property, 'n', cb);
  }

  Node.prototype.whereStartNodeHasProperty = function(property, cb) {
    return this.whereHasProperty(property, 'a', cb);
  }

  Node.prototype.whereEndNodeHasProperty = function(property, cb) {
    return this.whereHasProperty(property, 'b', cb);
  }

  Node.prototype.whereRelationshipHasProperty = function(property, cb) {
    return this.whereHasProperty(property, 'r', cb);
  }

  Node.prototype.delete = function(cb) {
    if (this.hasId())
      return cb(Error('To delete a node, use remove(). delete() is for queries.'),null);
    this._modified_query = true;
    this.cypher.action = 'DELETE';
    this.cypher.limit = '';
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.remove = function(cb) {
    var self = this;
    this.onBeforeRemove(function(err) {
      if (self.is_singleton)
        return cb(Error("To delete results of a query use delete(). remove() is for removing an instanced node."),null);
      if (self.hasId()) {
        return self.neo4jrestful.delete('/db/data/node/'+self.id, cb);
      }
    })
    return this;
  }

  Node.prototype.onBeforeRemove = function(next) { next(null,null); }

  Node.prototype.removeWithRelationships = function(cb) {
    var self = this;
    return this.removeAllRelationships(function(err) {
      if (err)
        return cb(err, null);
      // remove now node
      return self.remove(cb);
    });
  }

  // Node.prototype.removeRelationshipsFrom = function() { }
  // Node.prototype.removeRelationshipsTo = function() { }
  // Node.prototype.removeRelationshipsBetween = function() {}
  Node.prototype.removeOutgoinRelationships = function(type, cb) {
    return this.removeRelationships(type, cb, { direction: '->' });
  }
  Node.prototype.removeIncomingRelationships = function(type, cb) {
    return this.removeRelationships(type, cb, { direction: '<-' });
  }

  Node.prototype.removeAllRelationships = function(cb) {
    return this.removeRelationships('', cb);
  }
  Node.prototype.removeRelationships = function(type, cb, _options) {
    if (typeof type === 'function') {
      _options = cb;
      cb = type;
      type = null;
    }
    var defaultOptions = {
      direction: 'all', // incoming / outgoing
      type: type,
      endNodeId: null
    };
    if (typeof _options === 'undefined') {
      _options = _.extend({},defaultOptions);
    } else {
      _options = _.extend({},defaultOptions,_options);
    }
    if ((this.hasId())&&(typeof cb === 'function')) {
      var direction = _options.direction;
      if ( (!(direction === 'incoming')) || (!(direction === 'outgoing')) )
        direction = 'all';
      return Node.prototype.findById(this.id)[direction+'Relationships']().delete(cb);
    } else {
      return cb(Error("You can remove relationships only from an instanced node /w a valid cb"), null);
    }
  }

  Node.prototype.createRelationship = function(options, cb) {
    var self = this;
    options = _.extend({
      from_id: this.id,
      to_id: null,
      type: null,
      // unique: false ,// TODO: implement!
      properties: null,
      distinct: null
    }, options);

    if (options.properties)
      options.properties = helpers.flattenObject(options.properties);

    var _create_relationship_by_options = function(options) {
      return self.neo4jrestful.post('/db/data/node/'+options.from_id+'/relationships', {
        data: {
          to: new Node({},options.to_id).uri,
          type: options.type,
          data: options.properties
        }
      }, cb);
    }

    if ((_.isNumber(options.from_id))&&(_.isNumber(options.to_id))&&(typeof cb === 'function')) {
      if (options.distinct) {
        this.neo4jrestful.get('/db/data/node/'+options.from_id+'/relationships/out/'+options.type, function(err, result) {
          if (err)
            return cb(err, result);
          if (result.length === 1) {
            // if we have only one relationship, we update this one
            // var properties = (options.properties) ? options.properties : {};
            return self.neo4jrestful.put('/db/data/relationship/'+result[0].id+'/properties', { data: options.properties }, function(err) {
              if (err)
                cb(err, null);
              else {
                // TODO: Relationship::findById
                self.neo4jrestful.get('/db/data/relationship/'+result[0].id, cb);
              }
            });
          } else {
            // we create a new one
            return _create_relationship_by_options(options);
          }
        });
      } else {
        // create relationship
        return _create_relationship_by_options(options);
      }
    } else {
      cb(Error('Missing from_id('+options.from_id+') or to_id('+options.to_id+') OR no cb attached'), null);
    }
  }

  Node.prototype.createRelationshipBetween = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    var self = this;
    if (typeof properties === 'function') {
      cb = properties;
      properties = {};
    }
    if ((this.hasId())&&(helpers.getIdFromObject(node))) {
      // to avoid deadlocks
      // we have to create the relationships sequentially
      self.createRelationshipTo(node, type, properties, function(err, resultFirst, debug_a){
        self.createRelationshipFrom(node, type, properties, function(secondErr, resultSecond, debug_b) {
          if ((err)||(secondErr)) {
            if ((err)&&(secondErr))
              cb([err, secondErr], null, [ debug_a, debug_b ]);
            else
              cb(err || secondErr, null, [ debug_a, debug_b ]);
          } else {
            cb(null, [ resultFirst, resultSecond ], debug_a || debug_b);
          }
        }, options);
      }, options);
    } else {
      cb(Error("You need two instanced nodes as start and end point."), null);
    }
    
  }

  Node.prototype.createRelationshipTo = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    var args;
    var id = helpers.getIdFromObject(node);
    ( ( args = helpers.sortOptionsAndCallbackArguments(properties, cb) ) && ( properties = args.options ) && ( cb = args.callback ) );
    options = _.extend({
      properties: properties,
      to_id: id,
      type: type
    }, options);
    return this.createRelationship(options, cb);
  }

  Node.prototype.createRelationshipFrom = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    var args;
    var id = helpers.getIdFromObject(node);
    ( ( args = helpers.sortOptionsAndCallbackArguments(properties, cb) ) && ( properties = args.options ) && ( cb = args.callback ) );
    options = _.extend({
      properties: properties,
      from_id: id,
      to_id: this.id,
      type: type
    }, options);
    return this.createRelationship(options, cb);
  }

  Node.prototype.createOrUpdateRelationship = function(options, cb) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationship(options, cb);
  }

  Node.prototype.createOrUpdateRelationshipTo = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationshipTo(node, type, properties, cb, options);
  }

  Node.prototype.createOrUpdateRelationshipFrom = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationshipFrom(node, type, properties, cb, options);
  }

  Node.prototype.createOrUpdateRelationshipBetween = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationshipBetween(node, type, properties, cb, options);
  }

  Node.prototype.recommendConstructor = function(Fallback) {
    if (typeof Fallback !== 'function')
      Fallback = this.constructor;
    var label = (this.label) ? this.label : ( ((this.labels)&&(this.labels.length===1)) ? this.labels[0] : null );
    return (label) ? this.registered_model(label) || Fallback : Fallback;
  }

  /*
   * Label methods
   */

  Node.prototype.requestLabels = function(cb) {
    if ((this.hasId())&&(typeof cb === 'function')) {
      this.neo4jrestful.get('/db/data/node/'+this.id+'/labels', cb);
    }
    return this;
  }

  Node.prototype.setLabels = function(labels) {
    if (_.isArray(labels)) {
      this.labels = _.clone(labels);
    }
    // if we have only one label we set this to default label
    if ((_.isArray(this.labels))&&(this.labels.length === 1)) {
      this.label = this.labels[0];
    }
    return this.labels;
  }

  Node.prototype.labelsAsArray = function() {
    var labels = this.labels;
    if (!_.isArray(labels))
      labels = [];
    if (this.label)
      labels.push(this.label);
    return _.uniq(labels);
  }

  Node.prototype.allLabels = function(cb) {
    if ( (this.hasId()) && (_.isFunction(cb)) )
      return this.neo4jrestful.get('/db/data/node/'+this.id+'/labels', cb);
  }

  Node.prototype.createLabel = function(label, cb) {
    return this.createLabels([ label ], cb);
  }

  Node.prototype.createLabels = function(labels, cb) {
    if ( (this.hasId()) && (_.isFunction(cb)) )
      return this.neo4jrestful.post('/db/data/node/'+this.id+'/labels', { data: labels }, cb);
  }

  Node.prototype.addLabels = function(labels, cb) {
    var self = this;
    if ( (this.hasId()) && (_.isFunction(cb)) ) {
      if (!_.isArray(labels))
        labels = [ labels ];
      self.allLabels(function(err, storedLabels) {
        if (!_.isArray(storedLabels))
          storedLabels = [];
        storedLabels.push(labels);
        storedLabels = _.uniq(_.flatten(storedLabels));
        self.replaceLabels(storedLabels, cb);
      });
    } else {
      // otherwise it can be used as a setter
      this.labels = labels;
      if (labels.length===1)
        this.label = labels[0];
    }
    return this;
  }

  Node.prototype.addLabel = function(label, cb) {
    return this.addLabels([ label ], cb);
  }

  Node.prototype.replaceLabels = function(labels, cb) {
    if ( (this.hasId()) && (_.isFunction(cb)) ) {
      if (!_.isArray(labels))
        labels = [ labels ];
      return this.neo4jrestful.put('/db/data/node/'+this.id+'/labels', { data: labels }, cb);
    }
  }

  Node.prototype.removeLabels = function(cb) {
    if ( (this.hasId()) && (_.isFunction(cb)) ) {
      return this.neo4jrestful.delete('/db/data/node/'+this.id+'/labels', cb);
    }
  }

  // Node.prototype.replaceLabel = function

  // TODO: autoindex? http://docs.neo4j.org/chunked/milestone/rest-api-configurable-auto-indexes.html
  Node.prototype.addIndex = function(namespace, key, value, cb) {
    if (this.is_singleton)
      return cb(Error('Singleton instance is not allowed to get persist.'), null);
    this._modified_query = false;
    if ( (!namespace) || (!key) || (!value) || (!_.isFunction(cb)) )
      throw Error('namespace, key and value arguments are mandatory for indexing.');
    if (!this.hasId())
      return cb(Error('You need to persist the node before you can index it.'),null);
    if (typeof cb === 'function')
      return this.neo4jrestful.post('/db/data/index/node/'+namespace, { data: { key: key, value: value, uri: this.uri } }, cb);
    else
      return null;
    return keys;
  }

  Node.prototype.toObject = function() {
    var o = {
      id: this.id,
      data: _.extend(this.data),
      uri: this.uri
    };
    if (this.label)
      o.label = this.label;
    return o;
  }

  /*
   * Request methods
   */

  Node.prototype.stream = function(cb) {
    this.neo4jrestful.header['X-Stream'] = 'true';
    this.exec(cb);
    return this; // return self for chaining
  }

  /*
   * STATIC METHODS for `find` Queries
   */ 

  Node.prototype.find = function(where, cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton(undefined, this);
    self._modified_query = true;
    if (self.label) self.withLabel(self.label);
    if ((typeof where === 'string')||(typeof where === 'object')) {
      self.where(where);
      if (!self.cypher.start) {
        self.cypher.start = self.__type_identifier__+' = '+self.__type__+'('+self._start_node_id('*')+')';
      }
      self.exec(cb);
      return self;
    } else {
      return self.findAll(cb);
    }
  }

  Node.prototype.findOne = function(where, cb) {
    var self = this;
    if (typeof where === 'function') {
      cb = where;
      where = undefined;
    }

    self = this.find(where);
    self.cypher.limit = 1;
    self.exec(cb);
    return self;
  }

  Node.prototype.findById = function(id, cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton(undefined, this);
    self.cypher.by_id = Number(id);
    return self.findByUniqueKeyValue('id', id, cb);
  }

  Node.prototype.findByUniqueKeyValue = function(key, value, cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton(undefined, this);
    // we have s.th. like
    // { key: value }
    if (typeof key === 'object') {
      cb = value;
      var _key = Object.keys(key)[0];
      value = key[_key];
      key = _key;
    }

    if (typeof key !== 'string')
      key = 'id';
    if ( (_.isString(key)) && (typeof value !== 'undefined') ) {
      var identifier = self.cypher.node_identifier || self.__type_identifier__;
      if (self.cypher.return_properties.length === 0)
        self.cypher.return_properties = [ identifier ];
      if (key !== 'id') {
        var query = {};
        query[key] = value;
        self.where(query);
        if (self.label) self.withLabel(self.label);
        // if we have an id: value, we will build the query in prepareQuery
      }
      if (typeof cb === 'function') {
         self.exec(function(err,found){
          if (err)
            return cb(err, found);
          else {
            // try to return the first
            found = (found.length === 0) ? null : ((found)&&(found[0])) ? found[0] : found;
            return cb(null, found);
          }
         });
      }
     
    }
    return self;
  }

  // Node.prototype.findUnique = function(key, value, cb) { }
  // Node.prototype.findUniqueWithLabel = function(label, key, value) {}

  Node.prototype.findAll = function(cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton(undefined, this);
    self._modified_query = true;
    self.cypher.limit = null;
    self.cypher.return_properties = ['n'];
    if (self.label) self.withLabel(self.label);
    self.exec(cb);
    return self;
  }

  Node.prototype.findByIndex = function(namespace, key, value, cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton(undefined, this);
    var values = {};
    if ((namespace)&&(key)&&(value)&&(typeof cb === 'function')) {
      // values = { key: value };
      // TODO: implement
      return self.neo4jrestful.get('/db/data/index/node/'+namespace+'/'+key+'/'+value+'/', function(err, result, debug) {
        if (err) {
          cb(err, result, debug);
        } else {
          result = (result[0]) ? result[0] : null;
          cb(null, result, debug);
        }
      });
    } else {
      return cb(Error('Namespace, key, value and mandatory to find indexed nodes.'), null);
    }
  }

  /*
   * Static methods (misc)
   */

  Node.prototype.copy_of = function(that) {
    return _.extend({},that);
  }


  return Node;

}

if (typeof window !== 'object') {
  module.exports = exports = initNode;
}