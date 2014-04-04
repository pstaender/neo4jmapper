/**
 * ## Node
 * Represents the node object model and the neo4j-node-query-api
 *
 * You can register own models, including "inheritance"
 *
 * Requirements (for browser and nodejs):
 * * neo4jmapper helpers
 * * underscorejs
 * * sequence (https://github.com/coolaj86/futures)
 */
var __initNode__ = function(neo4jrestful, Graph) {

  if (typeof window === 'object') {
    // browser
    // TODO: find a solution for bson object id
    var helpers               = window.Neo4jMapper.helpers;
    var _                     = window._;
    var ConditionalParameters = window.Neo4jMapper.ConditionalParameters;
    var CypherQuery           = window.Neo4jMapper.CypherQuery;
  } else {
    var helpers               = require('./helpers');
    var _                     = require('underscore');
    var ConditionalParameters = require('./conditionalparameters');
    var CypherQuery           = require('./cypherquery');
  }

  /**
   * ### Constructor of Node
   * Calls this.init(data,id) to set all values to default
   */
  var Node = function Node(data, id, cb) {
    // id can be a callback as well
    if (typeof id === 'function') {
      cb = id;
      id = undefined;
    }
    // will be used for labels and classes
    if (!this._constructor_name_)
      this._constructor_name_ = helpers.constructorNameOfFunction(this) || 'Node';
    this.init(data, id);
    if (cb)
      return this.save(cb);
  }

  /**
   * Initialize all values on node object
   */
  Node.prototype.init = function(data, id) {
    this.setId(id || null);
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
    // copy array
    this.labels = _.uniq(this.labels);

    this._is_instanced_ = true;
    return this;
  }

  /** Instantiate a node from a specific model
    * Model can be a constructor() or a String
    * and must be registered in Node.registered_models()
    *
    * @param {Function|String}
    */
  Node.prototype.convertToModel = function(model) {
    var Class = this.recommendConstructor();
    if (typeof model === 'function') {
      Class = model;
    } else if ((typeof model === 'string') && (Node.registeredModel(model))) {
      Class = Node.registeredModel(model);
    }
    var node = new Class();
    this.copyTo(node);
    return node;
  }

  // if we have a distinct label, we will create a model from of it
  Node.instantiateNodeAsModel = function(node, labels, label) {
    var model = label;
    // if we have given explicit a specific model
    if (typeof labels === 'string') {
      model = labels;
    }
    // alternative: if we have only one label we instantiate from this
    if ((labels) && (labels.length === 1))
      model = labels[0];
    if (model)
      node = node.convertToModel(model);
    node.setLabels(labels);
    node.isPersisted(true);
    return node;
  }

  Node.__models__ = {};                             // contains all globally registered models

  Node.prototype.classification   = 'Node';         // only needed for toObject(), just for better identification of the object for the user
  Node.prototype.data             = {};             // will contain all data for the node
  Node.prototype.id               = null;           // ”public“ id attribute
  Node.prototype._id_             = null;           // ”private“ id attribute (to ensure that this.id deosn't get manipulated accidently)
  // can be used to define schema-like-behavior
  // TODO: implement unique
  Node.prototype.fields = {
    defaults: {},
    indexes: {},
    unique: {}
  };

  Node.prototype.uri              = null;           // uri of the node
  Node.prototype._response_       = null;           // original response object
  Node.prototype._query_history_  = null;           // an array that contains all query actions chronologically, is also a flag for a modified query
  Node.prototype._stream_         = null;           // flag for processing result data
  Node.prototype._hashedData_     = null;           // contains md5 hash of a persisted object
  Node.prototype.Relationship     = null;           // constructor object for Relationship()

  // cypher properties will be **copied** on each new object on cypher.segments in resetQuery()
  Node.cypherStatementSegments = {
    limit: '',              // Number
    skip: '',               // Number
    filter: '',             // `FILTER`   statement
    match: null,            // `MATCH`    statement
    start: null,            // `START`    statement
    set: '',                // `SET`      statement
    With: null,             // `WITH`     statement
    distinct: null,         // `DISTINCT` option
    return_properties: [],  // [a|b|n|r|p], will be joined with `, `
    where: [],              // `WHERE`  statements, will be joined with `AND`
    hasProperty: [],
    from: null,             // Number
    to: null,               // Number
    direction: null,        // (incoming|outgoing|all)
    order_by: '',           // $property
    order_direction: '',    // (ASC|DESC)
    relationship: '',       // String
    outgoing: null,         // Boolean
    incoming: null,         // Boolean
    label: null,            // String
    node_identifier: null,  // [a|b|n]
    parameters: null,       // object that contains all parameters for query
    count: '',              // count(n) (DISTINCT)
    // Boolean flags
    _optionalMatch: null,
    _count: null,
    _distinct: null,
    by_id: null
  };

  Node.prototype.ignoreExceptionPattern   = /^EntityNotFoundException$/; // will be used ONLY on findById

  Node.prototype._is_instanced_           = null;   // flag that this object is instanced
  Node.prototype._is_singleton_           = false;  // flag that this object is a singleton
  Node.prototype._is_loaded_              = null;

  Node.prototype.labels                   = null;   // an array of all labels
  Node.prototype.label                    = null;   // will be set with a label a) if only one label exists b) if one label matches to model

  Node.prototype._constructor_name_       = null;   // will be with the name of the function of the constructor
  Node.prototype._load_hook_reference_    = null;   // a reference to acticate or deactivate the load hook

  Node.prototype.__skip_loading_labels__  = null;   // is used in _onBeforeLoad() to prevent loading labels in an extra request

  /**
   * Should **never** be changed
   * it's used to dictinct nodes and relationships
   * many queries containg `node()` command will use this value
   * e.g. n = node(*)
   */
  Node.prototype.__TYPE__                 = 'node';
  Node.prototype.__TYPE_IDENTIFIER__      = 'n';


  // ### Initializes the model
  // Calls the onBeforeInitialize & onAfterInitialize hook
  // The callback can be used to ensure that all async processes are finished
  Node.prototype.initialize = function(cb) {
    var self = this;
    return this.onBeforeInitialize(function(err, res, debug) {
      if (err)
        cb(err, null, debug);
      else
        self.onAfterInitialize(cb);
    });
  }

  Node.prototype.onBeforeInitialize = function(next) {
    return next(null,null,null);
  }

  Node.prototype.onAfterInitialize = function(cb) {
    // here we return the constructor as 2nd argument in cb
    // because it is expected at `Node.register_model('Label', cb)`
    var self = this;
    // Index fields
    var fieldsToIndex = this.fieldsForAutoindex();
    // we create an object to get the label
    var node = new this.constructor();
    var label = node.label;
    if (label) {
      if (fieldsToIndex.length > 0) {
        return node.ensureIndex({ label: label, fields: fieldsToIndex }, function(err, res, debug) {
          return cb(err, self.constructor, debug);
        });
      } else {
        return cb(null, self.constructor, null);
      }
    } else {
      return cb(Error('No label found'), this.constructor, null);
    }
  }

  // Copys only the node's relevant data(s) to another object
  Node.prototype.copyTo = function(n) {
    n.id = n._id_ = this._id_;
    n.data   = _.extend(this.data);
    n.labels = _.clone(this.labels);
    if (this.label)
      n.label  = this.label;
    n.uri = this.uri;
    n._response_ = _.extend(this._response_);
    return null;
  }

  /**
   * Resets the query **but** should not be used since you should start from Node.… instead
   * Anyhow, e.g.:
   *
   * Example:
   *    n = Node.findOne().where(cb)
   *    n.resetQuery().findOne(otherCb)
   */
  Node.prototype.resetQuery = function() {
    // we have to copy the cypher values on each object
    this.cypher = new CypherQuery();
    this.cypher.segments = {};
    _.extend(this.cypher.segments, this.constructor.cypherStatementSegments);
    this.cypher.segments.where = [];
    this.cypher.segments.hasProperty = [];
    this.cypher.segments.match = [];
    this.cypher.segments.return_properties = [];
    this.cypher.segments.start = {};
    this._query_history_ = [];
    if (this.id)
      this.cypher.segments.from = this.id;
    return this; // return self for chaining
  }

  Node.prototype.hasId = function() {
    return ((this._is_instanced_) && (_.isNumber(this._id_))) ? true : false;
  }

  Node.prototype.setUriById = function(id) {
    if (_.isNumber(id))
      this.uri = Graph.request().absoluteUrl(this.__TYPE__+'/'+id);
    return this;
  }

  Node.prototype.flattenData = function(useReference) {
    // strongly recommend not to mutate attached node's data
    if (typeof useReference !== 'boolean')
      useReference = false;
    if ((typeof this.data === 'object') && (this.data !== null)) {
      var data = (useReference) ? this.data : _.extend(this.data);
      data = helpers.flattenObject(data);
      return data;
    }
    return this.data;
  }

  Node.prototype.dataForCypher = function() {
    var data = this.flattenData();
    for (var attr in data) {
      data['`'+attr+'`'] = data[attr];
      delete data[attr];
    }
    return data;
  }

  Node.prototype.unflattenData = function(useReference) {
    // strongly recommend not to mutate attached node's data
    if (typeof useReference !== 'boolean')
      useReference = false;
    var data = (useReference) ? this.data : _.extend(this.data);
    return helpers.unflattenObject(data);
  }

  Node.prototype.hasValidData = function() {
    return helpers.isObjectLiteral(this.data);
  }

  Node.prototype.applyDefaultValues = function() {
    // flatten data and defaults
    var data     = helpers.flattenObject(this.data);
    var defaults = helpers.flattenObject(this.fields.defaults);
    for (var key in defaults) {
      if (((typeof data[key] === 'undefined')||(data[key] === null))&&(typeof defaults[key] !== 'undefined'))
        // set a default value by defined function
        if (typeof defaults[key] === 'function')
          data[key] = defaults[key](this);
        else
          data[key] = defaults[key];
    }
    this.data = helpers.unflattenObject(data);
    return this;
  }

  Node.prototype.hasFieldsToIndex = function() {
    if (this.hasId())
      return _.keys(this.fields.indexes).length;
    else
      return null;
  }

  Node.prototype.fieldsToIndex = function() {
    return ( (this.fields.indexes) && (_.keys(this.fields.indexes).length > 0) ) ? helpers.flattenObject(this.fields.indexes) : null;
  }

  Node.prototype.fieldsToIndexUnique = function() {
    return ( (this.fields.unique)  && (_.keys(this.fields.unique).length > 0) )  ? helpers.flattenObject(this.fields.unique) : null;
  }

  Node.prototype.fieldsForAutoindex = function() {
    // we merge unique and indexes fields
    var fields = this.fieldsToIndex();
    var keys = [];
    _.each(fields, function(toBeIndexed, field) {
      if (toBeIndexed === true)
        keys.push(field);
    });
    keys = _.uniq(_.union(keys, this.uniqueFields()));
    return keys;
  }

  /**
   * Returns all fields that should be unique
   * They need to be defined in your model, e.g.:
   *
   * Node.register_model({
   *  fields: {
   *    unique: {
   *      email: true
   *    }
   * }});
   */
  Node.prototype.uniqueFields = function() {
    var keys = [];
    _.each(this.fields.unique, function(isUnique, field) {
      if (isUnique === true)
        keys.push(field);
    });
    return keys;
  }

  /**
   * # Autoindex
   * Check the `schema` of the model and builds an autoindex, optional with unique option
   * see for more details: http://docs.neo4j.org/chunked/milestone/query-constraints.html
   * TODO: only via cypher query, to simplify process
   */
  Node.prototype.ensureIndex = function(options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
    options = _.extend({
      label: this.label,                  // index must be connected to a label
      fields: this.fieldsForAutoindex(),  // fields that have to be indexed
      unique: this.uniqueFields() || []   // fields that have be indexed as unique
    }, options);
    var self    = this;
    var keys    = _.uniq(_.union(options.fields, options.unique)); // merge index + unique here
    var todo    = keys.length;
    var done    = 0;
    var errors  = [];
    var results = [];
    if (!options.label)
      throw Error('Label is mandatory, you can set the label as options as well');
    var url = 'schema/index/'+options.label;
    var queryHead = "CREATE CONSTRAINT ON (n:" + options.label + ") ASSERT ";
    // get all indexes fields
    // TODO: find a way to distinct index
    this.getIndex(function(err, indexedFields, debug) {
      // sort out fields that are already indexed
      for (var i=0; i < indexedFields.length; i++) {
        keys = _.without(keys, indexedFields[i]);
      }
      // return without any arguments if there are no fields to index
      if (keys.length === 0) {
        return cb(null, null, debug);
      }
      _.each(keys, function(key){
        var isUnique = (_.indexOf(options.unique, key) >= 0);
        var query = queryHead + "n.`" + key + "`" + ( (isUnique) ? " IS UNIQUE" : "")+";";
        var after = function(err, res) {
          done++;
          if ((err === 'object') && (err !== null)) {
            // we transform the given error(s) to an array to iterate through it
            var errAsArray = (err.length > 0) ? err : [ err ];
            errAsArray.forEach(function(err) {
              if ((err.cause) && (err.cause.cause) && (err.cause.cause.exception === 'AlreadyIndexedException')) {
                // we ignore this "error"
                results.push(res);
              } else {
                errors.push(err);
              }
            });
          } else {
            results.push(res);
          }
          if (done === todo) {
            cb((errors.length > 0) ? errors : null, results, debug);
          }
        };
        if (isUnique) {
          self.query(query, after);
        } else {
          Graph.request().post(url, { data: { property_keys: [ key ] } }, after);
        }
      });
    });
    return this;
  }

  Node.prototype.dropIndex = function(fields, cb) {
    if (typeof fields === 'function') {
      cb = fields;
      fields = this.fieldsForAutoindex();
    }
    if (!this.label)
      return cb(Error("You need to set a label on `node.label` to work with autoindex"), null);
    var todo = fields.length;
    var done = 0;
    var url  = 'schema/index/'+this.label;
    // skip if no fields
    if (todo === 0)
      return cb(null, null);
    if (todo===0)
      return cb(Error("No fields for indexing found", null));
    _.each(fields, function(field) {
      Graph.request().delete(url+'/'+field, function(/* err, res */) {
        done++;
        if (done === todo)
          cb(null, null);
      });
    });
    return this;
  }

  Node.prototype.dropEntireIndex = function(cb) {
    var self = this;
    this.getIndex(function(err, fields){
      if (err)
        return cb(err, fields);
      return self.dropIndex(fields, cb);
    });
    return this;
  }

  Node.prototype.getIndex = function(cb) {
    var label = this.label;
    if (!label)
      return cb(Error("You need to set a label on `node.label` to work with autoindex"), null);
    var url = 'schema/index/'+this.label;
    return Graph.request().get(url, function(err, res, debug){
      if ((typeof res === 'object') && (res !== null)) {
        var keys = [];
        _.each(res, function(data){
          if (data.label === label)
            keys.push(data['property_keys']);
        });
        return cb(null, _.flatten(keys), debug);
      } else {
        return cb(err, res, debug);
      }
    });
  }

  Node.prototype._hashData_ = function() {
    if (this.hasValidData())
      return helpers.md5(JSON.stringify(this.toObject()));
    else
      return null;
  }

  Node.prototype.isPersisted = function(setToTrueOrFalse) {
    if (typeof setToTrueOrFalse !== 'undefined') {
      // use as setter
      if (setToTrueOrFalse) {
        this._hashedData_ = this._hashData_();
      } else {
        this._hashedData_ = null;
      }
    }
    return (this._hashedData_) ? (this._hashData_() === this._hashedData_) : false;
  }

  Node.prototype.save = function(cb) {
    var self = this;
    var labels = (self.labels.length > 0) ? self.labels : null;
    return self._onBeforeSave(self, function(err) {
      // don't execute if an error is passed through
      if ((typeof err !== 'undefined')&&(err !== null))
        cb(err, null);
      else
        self.onSave(function(err, node, debug) {
          // assign labels back
          if (labels)
            self.labels = labels;
          self._onAfterSave(err, self, cb, debug);
        });
    });
  }

  Node.prototype._onBeforeSave = function(node, next) {
    this.onBeforeSave(node, function(err) {
      next(err);
    });
  }

  Node.prototype.onBeforeSave = function(node, next) {
    next(null, null);
  }

  Node.prototype.onSave = function(cb) {
    var self = this;
    if (this._is_singleton_)
      return cb(Error('Singleton instances can not be persisted'), null);
    if (!this.hasValidData())
      return cb(Error(this.__TYPE__+' does not contain valid data. `'+this.__TYPE__+'.data` must be an object.'));
    this.resetQuery();
    this.applyDefaultValues();

    this.id = this._id_;

    if (this.id > 0) {
      // we generate: { n: { data } } -> n.`prop` = '' , … ,
      // update node
      Graph
        .start('n = node({id})')
        .addParameter({ id: Number(this.id) })
        .setWith({ n: this.dataForCypher() })
        .exec(function(err, res, debug) {
          if (err) {
            return cb(err, res, debug);
          } else {
            self.isPersisted(true);
            cb(err, self, debug);
          }
        });
    } else {
      // create node
      var labels = (this.labels.length > 0) ? ':'+this.labels.join(':') : '';
      var data = {};
      data['n'+labels] = this.dataForCypher();
      Graph
        .start()
        .create(data)
        .return('n')
        .limit(1)
        .exec(function(err, res, debug) {
          if ((err)||(!res)) {
            return cb(err, res, debug);
          } else {
            var node = res;
            // copy persisted data on initially instanced node
            node.copyTo(self);
            node = self;
            node._is_singleton_ = false;
            node._is_instanced_ = true;
            self.isPersisted(true);
            return cb(null, node, debug);
          }
        });
    }
  }

  Node.prototype._onAfterSave = function(err, node, next, debug) {
    this.onAfterSave(err, node, function(err, node, debug) {
      // we use labelsAsArray to avoid duplicate labels
      var labels = node.labels = node.labelsAsArray();
      // cancel if we have an error here
      if (err)
        return next(err, node, debug);
      if (labels.length > 0) {
        // we need to post the label in an extra request
        // cypher inappropriate since it can't handle { attributes.with.dots: 'value' } …
        node.addLabels(labels, function(labelError, notUseableData, debugLabel) {
          // add label err if we have one
          if (labelError)
            err = labelError;
          // add debug label if we have one
          if (debug)
            debug = (debugLabel) ? [ debug, debugLabel ] : debug;
          return next(err, node, debug);
        });
      } else {
        return next(err, node, debug);
      }
    }, debug);
  }

  Node.prototype.onAfterSave = function(err, node, next, debug) {
    return next(err, node, debug);
  }

  Node.prototype.update = function(data, cb) {
    if (!this._is_singleton_) {
      return this.constructor.findById(this._id_).update(data, cb);
    }
    if (this.hasId() && (typeof cb !== 'function')) {
      throw Error('To perform an .update() on an instanced node, you have to give a cb as argument');
    }
    if (!helpers.isObjectLiteral(data)) {
      throw Error('To perform an .update() you need to pass a valid data object literal as first argument');
    }

    data = helpers.flattenObject(data);
    this.cypher.segments.set = [];
    for (var attribute in data) {
      this.addSetDefinition(attribute, data[attribute]);
    }

    this.cypher.segments._update_ = true; // update flag is used in graph._processResults
    this.cypher.segments.start[this.__TYPE_IDENTIFIER__] =  this.__TYPE__ + '(' + this.cypher.segments.by_id + ')';
    return this.exec(cb);
  }

  Node.prototype.addSetDefinition = function(attribute, value) {
    if (this.cypher.useParameters) {
      if (!this.cypher.hasParameters())
        this.cypher.parameters = {};
      // if already parameters are added, starting with {_value#i_} instead of {_value0_}
      var parametersStartCountAt = (this.cypher.parameters) ? Object.keys(this.cypher.parameters).length : 0;
      var key = '_value'+parametersStartCountAt+'_';
      var parameter = {};
      parameter[key] = value;
      this.cypher.segments.set.push(
        helpers.cypherKeyValueToString(attribute, '{'+key+'}', this.__TYPE_IDENTIFIER__, { valuesToParameters: true })
      );
      this._addParameterToCypher(value);
    } else {
      this.cypher.segments.set.push(helpers.cypherKeyValueToString(attribute, value, this.__TYPE_IDENTIFIER__));
    }
  }

  Node.prototype.load = function(cb, debug) {
    var self = this;
    return this._onBeforeLoad(self, function(err, node) {
      if (err)
        cb(err, node, debug);
      else
        self._onAfterLoad(node, cb, debug);
    })
  }

  Node.prototype._onBeforeLoad = function(node, next, debug) {
    this.onBeforeLoad(node, function(node) {
      if (node.hasId()) {

        var _createNodeFromLabel = function(node, debug) {
          node.isPersisted(true);
          node.__skip_loading_labels__ = null;
          next(null, node, debug);
        }

        if (node.__skip_loading_labels__) {
          return _createNodeFromLabel(node, debug);
        } else {
          // only load labels if it's set to not loaded
          return node.allLabels(function(err, labels, debug) {
            if (err)
              return next(err, labels);
            node.setLabels(labels);

            return _createNodeFromLabel(node, debug);
          });
        }
      } else {
        return next(null, node);
      }
    });
  }

  Node.prototype.reload = function (cb) {
    this._is_loaded_ = false;
    this.load(cb);
  }

  Node.prototype.onBeforeLoad = function(node, next) {
    return next(node);
  }

  Node.prototype._onAfterLoad = function(node, next) {
    node._is_loaded_ = true;
    this.onAfterLoad(node, function(err, node) {
      next(err, node);
    });
  }

  Node.prototype.onAfterLoad = function(node, next) {
    next(null, node);
  }

  Node.prototype.disableLoading = function() {
    if (typeof this.load === 'function') {
      this._load_hook_reference_ = this.load;
      this.load = null;
    }
    return this;
  }

  Node.prototype.enableLoading = function() {
    if (typeof this._load_hook_reference_ === 'function') {
      this.load = this._load_hook_reference_;
      this._load_hook_reference_ = null;
    }
    return this;
  }

  Node.prototype.populateWithDataFromResponse = function(data) {
    // if we are working on the prototype object
    // we won't mutate it and create a new node instance insetad
    var node;
    if (!this._is_instanced_)
      node = new Node();
    else
      node = this;
    node.resetQuery();
    if (data) {
      if (_.isObject(data) && (!_.isArray(data)))
        node._response_ = data;
      else
        node._response_ = data[0];
      node.data = node._response_.data;
      node.data = node.unflattenData();
      node.uri  = node._response_.self;
      //'http://localhost:7474/db/data/node/3648'
      if ((node._response_.self) && (node._response_.self.match(/[0-9]+$/))) {
        node.id = node._id_ = Number(node._response_.self.match(/[0-9]+$/)[0]);
      }
    }
    node.isPersisted(true);
    if (typeof node.onAfterPopulate === 'function')
      node.onAfterPopulate();
    return node;
  }

  Node.prototype.onAfterPopulate = function() {
    return this;
  }

  /*
   * Query Methods (via chaining)
   */

  Node.prototype.withLabel = function(label, cb) {
    var self = this;
    // return here if we have an instances node
    if ( (self.hasId()) || (typeof label !== 'string') )
      return self; // return self for chaining
    self._query_history_.push({ withLabel: label });
    self.cypher.segments.label = label;
    return self.exec(cb);
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
  }

  Node.prototype.pathBetween = function(start, end, options, cb) {
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
      // this.cypher.segments.start = {};
      this.cypher.segments.start.a = 'node('+start+')';
      this.cypher.segments.start.b = 'node('+end+')';

      var matchString = 'p = '+options.algorithm+'((a)-['+type+( (options.max_depth>0) ? '..'+options.max_depth : '*' )+']-(b))';

      this.cypher.segments.match = [ matchString.replace(/\[\:\*+/, '[*') ];
      this.cypher.segments.return_properties = ['p'];
    }

    return this.exec(cb);
  }

  Node.prototype.count = function(identifier, cb) {
    this.cypher.segments._count = true;
    if (typeof identifier === 'function') {
      cb = identifier;
      identifier = '*';
    }
    else if (typeof identifier !== 'string')
      identifier = '*';

    if (Object.keys(this.cypher.segments.start).length < 1) {
      // this.cypher.segments.start = {};
      this.cypher.segments.start[this.__TYPE_IDENTIFIER__] = this.__TYPE__+'(*)'; // all nodes by default
    }
    this.cypher.segments.count = 'COUNT('+((this.cypher.segments._distinct) ? 'DISTINCT ' : '')+identifier+')';
    if (this.cypher.segments._distinct)
      // set `this.cypher.segments._distinct` to false
      this.distinct(undefined, false);
    // we only need the count column to return in this case
    if (typeof cb === 'function')
      this.exec(function(err, result, debug){
        if ((result)&&(result.data)) {
          if (result.data.length === 1)
            result = result.data[0][0];
        }
        cb(err, result, debug);
      });
    this._query_history_.push({ count: { distinct: this.cypher.segments._distinct, identifier: identifier } });
    return this; // return self for chaining
  }

  /**
   * Query-Building methods
   * It evaluates `this.cypher` flags (initialized from `this.cypherStatementSegments`)
   * and prepares for query building  with `Graph.start()…`
   * @todo split into parts for each statement segment (e.g. query.start, query.return_properties …)
   * @return {object} prepared query statements
   */
  Node.prototype._prepareQuery = function() {
    var query = _.extend(this.cypher.segments);
    var label = (query.label) ? ':'+query.label : '';

    if ((this.cypher.segments.start) && (this.cypher.segments) && (Object.keys(this.cypher.segments.start).length < 1)) {
      if (_.isNumber(query.from)) {
        query.start = {};
        query.start.n = 'node('+query.from+')';
        query.return_properties.push('n');
      }
      if (_.isNumber(query.to)) {
        query.start.m = 'node('+query.to+')';
        query.return_properties.push('m');
      }
    }

    var relationships = '';

    if ((query.return_properties)&&(query.return_properties.constructor === Array)) {
      var returnLabels = null;
      query.return_properties.forEach(function(returnProperty){
        if ((returnLabels === null) && (/^n(\s+.*)*$/.test(returnProperty)))
          returnLabels = true;
      });

      // but we don't return labels if we have an action like DELETE
      if ((returnLabels) && (!query.action))
        query.return_properties.push('labels(n)');

      query.return_properties = _.uniq(query.return_properties).join(', ')
    }

    if (query.relationship) {
      if (query.relationship.constructor === Array) {
        relationships = ':'+helpers.escapeString(query.relationship.join('|'));
      } else {
        relationships = ':'+helpers.escapeString(query.relationship);
      }
    }

    // if COUNT(*) is set, no return properties are set
    // to avoid s.th. like `RETURN COUNT(*), n, r`
    query.actionWith = (query.count) ? query.count : query.return_properties;

    // build in/outgoing directions
    if ((query.incoming)||(query.outgoing)) {
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
      if (query.match.length === 0) {
        // this.cypher.segments can be an ID or a label
        query.match.push('(n'+label+')'+x+'[r'+relationships+']'+y+'('+( (this.cypher.segments.to > 0) ? 'm' : ( (this.cypher.segments.to) ? this.cypher.segments.to.replace(/^\:*(.*)$/,':$1') : '' ) ) +')');
      }
    }

    var __startObjectToString = function(start) {
      var s = [];
      for (var attribute in start) {
        s.push(attribute+' = '+start[attribute]);
      }
      return s.join(', ').trim();
    }
    // guess return objects from start string if it's not set
    // e.g. START n = node(*), a = node(2) WHERE … RETURN (~>) n, a;
    if ((!query.return_properties)||((query.return_properties)&&(query.return_properties.length == 0)&&(this.cypher.segments.start)&&(Object.keys(this.cypher.segments.start).length > 0))) {
      query.start_as_string = ' '+__startObjectToString(query.start)
      if (/ [a-zA-Z]+ \= /.test(query.start_as_string)) {
        var matches = query.start_as_string;
        query.return_properties = [];
        matches = matches.match(/[\s\,]([a-z]+) \= /g);
        for (var i = 0; i < matches.length; i++) {
          query.return_properties.push(matches[i].replace(/^[\s\,]*([a-z]+).*$/i,'$1'));
        }
        query.return_properties = query.return_properties.join(', ');
      }
    }

    if ((!(query.match.length>0))&&(this.label)) {
      // e.g. ~> MATCH (n:Person)
      if (this.__TYPE_IDENTIFIER__ === 'n')
        query.match = [ '(n:'+this.label+')' ];
      else if (this.__TYPE_IDENTIFIER__ === 'r')
        query.match = [ '[r:'+this.label+']' ];
    }

    // Set a fallback to START n = node(*) if it's not null
    if ((this.cypher.segments.start) && (Object.keys(this.cypher.segments.start).length < 1)&&(!(query.match.length > 0))) {
      // query.start = 'n = node(*)';
      // leave out if a `MATCH` is defined (will speed up query in some cases)
      if (query.match.length > 0) {
        query.start = '';
      } else {
        query.start[this.__TYPE_IDENTIFIER__] = this.__TYPE__+'(*)';
      }

    }

    // rule(s) for findById
    if (_.isNumber(query.by_id)) {
      // put in where clause if one or no START statement exists
      if (Object.keys(this.cypher.segments.start).length <= 1) {
        var id = query.by_id;
        if (this.cypher.useParameters) {
          this.cypher.segments.start.n = 'node({_node_id_})';
          this.cypher.addParameter( { _node_id_: id } );
        } else {
          this.cypher.segments.start.n = 'node('+id+')';
        }

      }
    }
    // add all `HAS (property)` statements to where
    if (query.hasProperty.length > 0) {
      // remove duplicate properties, not necessary but looks nicer
      _.uniq(query.hasProperty).forEach(function(property) {
        query.where.unshift('HAS ('+property+')');
      });
      // remove all duplicate-AND-conditions
      query.where = _.unique(query.where);
    }

    query.start_as_string = __startObjectToString(query.start);

    return query;
  }

  Node.prototype.toQuery = function() {
    if (this.hasId() && (!(Object.keys(this.cypher.segments.start).length > 1))) {
      return Node.findById(this._id_).toQuery();
    }
    var query = this._prepareQuery();
    var graph = Graph.start(query.start_as_string);
    if (query.match.length > 0) {
      if (this.cypher._optionalMatch)
        graph.optionalMatch(query.match.join(' AND '));
      else
        graph.match(query.match.join(' AND '));
    }
    if ((query.where)&&(query.where.length > 0))
      graph.where(query.where.join(' AND '));
    if (query.set)
      graph.set(query.set);
    if (query.action)
      graph.custom(query.action+' '+query.actionWith);
    else if (query._distinct)
      graph.returnDistinct(query.actionWith);
    else
      graph.return(query.actionWith);
    if (query.order_by)
      graph.orderBy(query.order_by+' '+query.order_direction);
    if (query.skip)
      graph.skip(Number(query.skip));
    if (query.limit)
      graph.limit(Number(query.limit));
    graph.cypher.parameters = this.cypher.parameters;
    return graph.toQuery();
  }

  Node.prototype.toQueryString = function() {
    return this.toQuery().toString();
  }

  Node.prototype.toCypherQuery = function() {
    return this.toQuery().toCypher();
  }

  Node.prototype._start_node_id = function(fallback) {
    if (typeof fallback === 'undefined')
      fallback = '*'
    if (this.cypher.segments.from > 0)
      return this.cypher.segments.from;
    if (this.cypher.segments.by_id)
      return this.cypher.segments.by_id;
    else
      return (this.hasId()) ? this.id : fallback;
  }

  Node.prototype._end_node_id = function(fallback) {
    if (typeof fallback === 'undefined')
      fallback = '*'
    return (this.cypher.segments.to > 0) ? this.cypher.segments.to : fallback;
  }

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

    if (typeof cb === 'function') {
      this.cypher.parameters = this.toQuery().parameters;
      return this.query(this.toCypherQuery(), cb);
    }
    return this;
  }

  Node.prototype.query = function(cypherQuery, parameters, cb, options) {
    var self = this;

    if (typeof parameters === 'function') {
      cb = parameters;
      parameters = {};
      options = {};
    }

    // sort arguments
    if (!options) {
      options = {};
    }

    options.cypher = _.extend(this.cypher.segments, { parameters: this.cypher.parameters });

    var graph = Graph.start();

    // of loading is deactivated on Node, disable on Graph here as well
    if (!this.load)
      graph.disableLoading();

    // apply option values from Node to request
    if (this.label)
      options.label = this.label;

    options.recommendConstructor = this.recommendConstructor();

    if ((this.cypher.useParameters) && (this.cypher.hasParameters()) && (Object.keys(this.cypher.parameters).length > 0)) {
      graph.setParameters(this.cypher.parameters);
    }

    if (typeof cypherQuery === 'string') {
      // check for stream flag
      // in stream case we use stream() instead of query()
      if (this._stream_) {
        return graph.stream(cypherQuery, parameters, cb, options);
      } else {
        return graph.query(cypherQuery, parameters, cb, options);
      }
    } else if (typeof cypherQuery === 'object') {
      // we expect a raw request object here
      // this is used to make get/post/put restful request
      // with the feature of process node data
      var request = cypherQuery;
      if ( (!request.type) || (!request.data) || (!request.url) ) {
        return cb(Error("The 1st argument as request object must have the properties .url, .data and .type"), null);
      }
      return Graph.request()[request.type](request.url, request.data, function(err, data, debug) {
        // transform to resultset
        data = {
          data: [ [ data ] ]
        };
        graph._processResult(err, data, debug, self, cb);
      });
    } else {
      return cb(Error("First argument must be a string with the cypher query"), null);
    }
  }

  /*
   * Relationship methods
   */

  Node.prototype.withRelations = function(relation, cb) {
    var self = this.singletonForQuery();
    self._query_history_.push({ withRelation: true });
    // we expect a string or an array
    self.cypher.segments.relationship = (typeof relation === 'string') ? relation : relation.join('|');
    self.cypher.segments.incoming = true;
    self.cypher.segments.outgoing = true;
    self.exec(cb);
    return self;
  }

  Node.prototype.incomingRelations = function(relation, cb) {
    var self = this.singletonForQuery();
    self._query_history_.push({ incomingRelationships: true }); // only as a ”flag”
    if (typeof relation !== 'function') {
      self.cypher.segments.relationship = relation;
    } else {
      cb = relation;
    }
    self.cypher.segments.node_identifier = 'n';
    // self.cypher.segments.start = {};
    self.cypher.segments.start.n = 'node('+self._start_node_id('*')+')';
    if (self.cypher.segments.to > 0)
      self.cypher.segments.start.m = 'node('+self._end_node_id('*')+')';
    self.cypher.segments.incoming = true;
    self.cypher.segments.outgoing = false;
    self.cypher.segments.return_properties = ['r'];
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.outgoingRelations = function(relation, cb) {
    var self = this.singletonForQuery();
    self._query_history_.push({ outgoingRelationships: true }); // only as a ”flag”
    if (typeof relation !== 'function') {
      self.cypher.segments.relationship = relation;
    } else {
      cb = relation;
    }
    self.cypher.segments.node_identifier = 'n';
    // self.cypher.segments.start = {};
    self.cypher.segments.start.n = 'node('+self._start_node_id('*')+')';
    if (self.cypher.segments.to > 0)
      self.cypher.segments.start.m = 'node('+self._end_node_id('*')+')';
    self.cypher.segments.incoming = false;
    self.cypher.segments.outgoing = true;
    self.cypher.segments.return_properties = ['r'];
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.incomingRelationsFrom = function(node, relation, cb) {
    var self = this.singletonForQuery();
    self._query_history_.push({ incomingRelationshipsFrom: true }); // only as a ”flag”
    self.cypher.segments.from = self.id || null;
    // node can be a number or a label string: `123` | `Person`
    self.cypher.segments.to = helpers.getIdFromObject(node) || node;
    if (typeof relation !== 'function')
      self.cypher.segments.relationship = relation;
    self.cypher.segments.return_properties = ['r'];
    return self.incomingRelations(relation, cb);
  }

  Node.prototype.outgoingRelationsTo = function(node, relation, cb) {
    var self = this.singletonForQuery();
    self._query_history_.push({ outgoingRelationshipsTo: true }); // only as a ”flag”
    // node can be a number or a label string: `123` | `Person`
    self.cypher.segments.to = helpers.getIdFromObject(node) || node;
    if (typeof relation !== 'function')
      self.cypher.segments.relationship = relation;
    self.cypher.segments.return_properties = ['r'];
    return self.outgoingRelations(relation, cb);
  }

  Node.prototype.allDirections = function(relation, cb) {
    var self = this.singletonForQuery();
    self._query_history_.push({ allDirections: true });
    if (typeof relation !== 'function')
      self.cypher.segments.relationship = relation;
    self.cypher.segments.node_identifier = 'n';
    self.cypher.segments.start.n = 'node('+self._start_node_id('*')+')';
    self.cypher.segments.start.m = 'node('+self._end_node_id('*')+')';
    self.cypher.segments.incoming = true;
    self.cypher.segments.outgoing = true;
    self.cypher.segments.return_properties = ['n', 'm', 'r'];
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.relationsBetween = function(node, relation, cb) {
    var self = this.singletonForQuery();
    self._query_history_.push({ relationshipsBetween: true });
    self.cypher.segments.to = helpers.getIdFromObject(node) || node;
    if (typeof relation !== 'function')
      self.cypher.segments.relationship = relation;
    self.cypher.segments.return_properties = ['r'];
    self.exec(cb);
    return self.allDirections(relation, cb);
  }

  Node.prototype.allRelations = function(relation, cb) {
    var self = this.singletonForQuery();
    var label = (this.cypher.segments.label) ? ':'+this.cypher.segments.label : '';
    if (typeof relation === 'string') {
      relation = ':'+relation;
    } else {
      cb = relation;
      relation = '';
    }
    self._query_history_.push({ allRelationships: true });
    self.cypher.segments.match = [ '(n'+label+')-[r'+relation+']-()' ];
    self.cypher.segments.return_properties = ['r'];
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.limit = function(limit, cb) {
    this._query_history_.push({ LIMIT: limit });
    this.cypher.segments.limit = parseInt(limit);
    if (limit === NaN)
      throw Error('LIMIT must be an integer number');
    if (this.cypher.segments.action === 'DELETE')
      throw Error("You can't use a limit on a DELETE, use WHERE instead to specify your limit");
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.skip = function(skip, cb) {
    this.cypher.segments.skip = parseInt(skip);
    if (skip === NaN)
      throw Error('SKIP must be an integer number');
    this._query_history_.push({ SKIP: this.cypher.segments.skip });
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.distinct = function(cb, value) {
    if (typeof value !== 'boolean')
      value = true;
    this.cypher.segments._distinct = value;
    this._query_history_.push({ dictinct: value });
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.orderBy = function(property, cb, identifier) {
    var direction = '';
    if (typeof property === 'object') {
      var key = Object.keys(property)[0];
      cb = direction;
      direction = property[key];
      property = key;
      if ( (typeof direction === 'string') && ((/^(ASC|DESC)$/).test(direction)) ) {
        this.cypher.segments.order_direction = direction;
      }
    } else if (typeof property === 'string') {
      // custom statement, no process at all
      // we use 1:1 the string
      this.cypher.segments.order_by = property;
    } else if (typeof cb === 'string') {
      identifier = cb;
      cb = null;
    }
    if (typeof identifier === 'undefined')
      identifier = this.__TYPE_IDENTIFIER__;
    if ((typeof identifier === 'string') && (/^[nmr]$/i.test(identifier))) {
      if (identifier === 'n') this.whereNodeHasProperty(property);
      if (identifier === 'm') this.whereEndNodeHasProperty(property);
      if (identifier === 'r') this.whereRelationshipHasProperty(property);
    } else {
      identifier = null;
    }

    if (identifier) {
      // s.th. like ORDER BY n.`name` ASC
      // escape property
      this.cypher.segments.order_by = identifier + ".`"+property+"`";
    } else {
      // s.th. like ORDER BY n.name ASC
      this.cypher.segments.order_by = property;
    }
    this._query_history_.push({ ORDER_BY: this.cypher.segments.order_by });
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.orderNodeBy = function(property, direction, cb) {
    return this.orderBy(property, direction, cb, 'n');
  }

  Node.prototype.orderStartNodeBy = function(property, direction, cb) {
    return this.orderNodeBy(property, direction, cb);
  }

  Node.prototype.orderEndNodeBy = function(property, direction, cb) {
    return this.orderBy(property, direction, cb, 'm');
  }

  Node.prototype.orderRelationshipBy = function(property, direction, cb) {
    return this.orderBy(property, direction, cb, 'r');
  }

  // ### Adds a string to the MATCH statement
  // e.g.: 'p:PERSON-[:KNOWS|:FOLLOWS]->a:Actor-[:ACTS]->m'
  Node.prototype.match = function(string, cb) {
    // we guess that we match a node if we have s.th. like `n(:Person)`
    if (/^n(\:[a-zA-Z]+)*$/.test(string))
      string = '('+string+')';
    this._query_history_.push({ MATCH: string });
    this.cypher.segments.match.push(string);
    this.exec(cb);
    return this; // return self for chaining
  }

  // ### Adds s.th. to the RETURN statement
  // Can be a string or an array
  // e.g. as string:  'award.name AS Award, awardee.name AS WonBy'
  // e.g. as array: [ 'award.name AS Award', 'awardee.name AS WonBy' ]
  Node.prototype.return = function(returnStatement, cb, options) {
    if (typeof options === 'undefined')
      options = { add: false };
    if (!options.add)
      this.cypher.segments.return_properties = [];
    if (returnStatement) {
      this.cypher.segments.return_properties = this.cypher.segments.return_properties.concat(
        (returnStatement.constructor === Array) ? returnStatement : returnStatement.split(', ')
      );
      this._query_history_.push({ RETURN: this.cypher.segments.return_properties });
    }
    this.exec(cb);
    return this; // return self for chaining
  }

  // ### Sets or resets the START statement
  Node.prototype.start = function(start, cb) {
    var self = this;
    if (!self._is_singleton_)
      self = this.singleton(undefined, this);
    if (self.label)
      self.withLabel(self.label);
    //self.resetQuery();
    if (typeof start !== 'string')
      self.cypher.segments.start = null;
    else
      self.cypher.segments.start = start;
    self._query_history_.push({ START: self.cypher.start });
    self.exec(cb);
    return self; // return self for chaining
  }

  Node.prototype.where = function(where, cb, options) {
    if (_.isObject(where)) {
      if (Object.keys(where).length === 0) {
        // return here
        this.exec(cb);
        return this;
      }
      if (!_.isArray(where))
        where = [ where ];
    }

    if (typeof options === 'undefined')
      options = {};
    if (typeof options.identifier !== 'string')
      // good or bad idea that we use by default n as identifier?
      options.identifier = 'n';

    // add identifier to return properties if not exists already
    if (_.indexOf(this.cypher.segments.return_properties, options.identifier) === -1)
      this.cypher.segments.return_properties.push(options.identifier);


    if (this.cypher.segments.start) {
      if (!this.cypher.segments.start.n)
        this.cypher.segments.start.n = 'node(*)';
      if (this.cypher.segments.start.m)
        this.cypher.segments.start.m = 'node(*)';
      if (options.identifier === 'r')
        this.cypher.segments.start.r = 'relationship(*)';
    }

    // use parameters for query or send an ordinary string?
    // http://docs.neo4j.org/chunked/stable/rest-api-cypher.html
    if (typeof options.valuesToParameters === 'undefined')
      options.valuesToParameters = Boolean(this.cypher.useParameters);
    // if already parameters are added, starting with {_value#i_} instead of {_value0_}
    if ((this.cypher.parameters)&&(this.cypher.parameters.length > 0))
      options.parametersStartCountAt = this.cypher.parameters.length;
    var condition = new ConditionalParameters(_.extend(where), options);
    var whereCondition = condition.toString();
    this.cypher.segments.where.push(whereCondition);
    if ((options.valuesToParameters) && (condition.hasParameters()))
      this._addParametersToCypher(condition.values());
    this._query_history_.push({ WHERE: whereCondition });

    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.whereStartNode = function(where, cb) {
    return this.where(where, cb, { identifier: 'n' });
  }

  Node.prototype.whereEndNode = function(where, cb) {
    return this.where(where, cb, { identifier: 'm' });
  }

  Node.prototype.whereNode = function(where, cb) {
    return this.where(where, cb, { identifier: 'n' });
  }

  Node.prototype.whereRelationship = function(where, cb) {
    return this.where(where, cb, { identifier: 'r' });
  }

  Node.prototype.whereRelation = function(where, cb) {
    return this.whereRelationship(where, cb);
  }

  Node.prototype.whereHasProperty = function(property, identifier, cb) {
    return this.andHasProperty(property, identifier, cb);
  }

  Node.prototype.andHasProperty = function(property, identifier, cb) {
    if (_.isFunction(identifier)) {
      cb = identifier;
      identifier = null;
    }
    if (typeof property !== 'string') {
      // we need a property to proceed
      return cb(Error('Property name is mandatory.'),null);
    }
    if (/^[nmr]\./.test(property))
      // remove identifier
      property = property.replace(/^[nmr]\./,'')
    // if NOT default to true/false, no property condition is needed
    if (!/[\!\?]$/.test(property)) {
      if (this.cypher.segments.return_properties.length === 0) {
        this.findAll();
      }
      // no identifier found, guessing from return properties
      if (typeof identifier !== 'string')
        identifier = this.cypher.segments.return_properties[this.cypher.segments.return_properties.length-1];
      this.cypher.segments.hasProperty.push(identifier+'.`'+property+'`');
      this._query_history_.push({ HAS: { identifier: identifier, property: property }});
    }
    this.exec(cb);
    return this; // return self for chaining
  }

  Node.prototype.whereNodeHasProperty = function(property, cb) {
    return this.andHasProperty(property, 'n', cb);
  }

  Node.prototype.whereStartNodeHasProperty = function(property, cb) {
    return this.andHasProperty(property, 'n', cb);
  }

  Node.prototype.whereEndNodeHasProperty = function(property, cb) {
    return this.andHasProperty(property, 'm', cb);
  }

  Node.prototype.whereRelationshipHasProperty = function(property, cb) {
    return this.andHasProperty(property, 'r', cb);
  }

  Node.prototype.delete = function(cb) {
    if (this.hasId()) {
      throw Error('To delete a node, use remove(). delete() is for queries');
    }
    if (this.cypher.segments.limit) {
      throw Error("You can't use a limit on a DELETE, use WHERE instead to specify your limit");
    }
    this._query_history_.push({ DELETE: true });
    this.cypher.segments.action = 'DELETE';
    return this.exec(cb);
  }

  Node.prototype.deleteIncludingRelations = function(cb) {
    var label = (this.label) ? ":"+this.label : "";
    if (Object.keys(this.cypher.segments.start).length < 1) {
      this.cypher.segments.start[this.__TYPE_IDENTIFIER__] = this.__TYPE__+"(*)";
    }
    this.cypher._optionalMatch = true;
    this.cypher.segments.match = [ '('+this.__TYPE_IDENTIFIER__+label+")-[r]-()" ];
    this.cypher.segments.return_properties = [ "n", "r" ];
    return this.delete(cb);
  }

  Node.prototype.remove = function(cb) {
    var self = this;
    this.onBeforeRemove(function(/*err*/) {
      if (self._is_singleton_)
        return cb(Error("To delete results of a query use delete(). remove() is for removing an instanced "+this.__TYPE__),null);
      if (self.hasId()) {
        return Graph.start('n = node({id}) DELETE n', { id: self.id }, cb);
      }
    })
    return this;
  }

  Node.prototype.onBeforeRemove = function(next) { next(null,null); }

  // was mistakenly called `removeWithRelationships`, so it is renamed
  Node.prototype.removeIncludingRelations = function(cb) {
    var self = this;
    return this.removeAllRelations(function(err) {
      if (err)
        return cb(err, null);
      else // remove now node
        return self.remove(cb);
    });
  }

  Node.prototype.removeOutgoingRelations = function(type, cb) {
    return this.removeRelations(type, cb, { direction: '->' });
  }
  Node.prototype.removeIncomingRelations = function(type, cb) {
    return this.removeRelations(type, cb, { direction: '<-' });
  }

  Node.prototype.removeAllRelations = function(cb) {
    return this.removeRelations('', cb);
  }

  Node.prototype.removeRelations = function(type, cb, _options) {
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
      Node.findById(this.id)[direction+'Relations']().delete(cb);
    } else {
      cb(Error("You can remove relationships only from an instanced node /w a valid cb"), null);
    }
    return this;
  }

  Node.prototype.createRelation = function(options, cb) {
    var self = this;
    options = _.extend({
      from_id: this._id_,
      to_id: null,
      type: null,
      // unique: false ,// TODO: implement!
      properties: null,
      distinct: null
    }, options);
    if (typeof options.type !== 'string')
      throw Error("You have to give the type of relationship, e.g. 'knows|follows'");
    if (options.properties)
      options.properties = helpers.flattenObject(options.properties);
    if ((_.isNumber(options.from_id))&&(_.isNumber(options.to_id))&&(typeof cb === 'function')) {
      if (options.distinct) {
        Node.findById(options.from_id).outgoingRelationsTo(options.to_id, options.type, function(err, result) {
          if (err)
            return cb(err, result);
          if ((result) && (result.length === 1)) {
            // if we have only one relationship, we update this one
            Node.Relationship.findById(result[0].id, function(err, relationship){
              if (relationship) {
                if (options.properties)
                  relationship.data = options.properties;
                if (options.type)
                  relationship.type = options.type;
                relationship.save(cb);
              } else {
                cb(err, relationship);
              }
            })
          } else {
            // we create a new one
            Node.Relationship.create(options.type, options.properties, options.from_id, options.to_id, cb);
            return self;
          }
        });
      } else {
        // create relationship
        Node.Relationship.create(options.type, options.properties, options.from_id, options.to_id, cb);
        return self;
      }
    } else {
      cb(Error('Missing from_id('+options.from_id+') or to_id('+options.to_id+') OR no cb attached'), null);
    }
    return this;
  }

  Node.prototype.createRelationBetween = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    var self = this;
    if (typeof properties === 'function') {
      cb = properties;
      properties = {};
    }
    if ((this.hasId())&&(helpers.getIdFromObject(node))) {
      // to avoid deadlocks
      // we have to create the relationships sequentially
      self.createRelationTo(node, type, properties, function(err, resultFirst, debug_a){
        self.createRelationFrom(node, type, properties, function(secondErr, resultSecond, debug_b) {
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
      cb(Error("You need two instanced nodes as start and end point"), null);
    }
    return this;
  }

  Node.prototype.createRelationTo = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    var args;
    var id = helpers.getIdFromObject(node);
    ( ( args = helpers.sortOptionsAndCallbackArguments(properties, cb) ) && ( properties = args.options ) && ( cb = args.callback ) );
    options = _.extend({
      properties: properties,
      to_id: id,
      type: type
    }, options);
    return this.createRelation(options, cb);
  }

  Node.prototype.createRelationFrom = function(node, type, properties, cb, options) {
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
    return this.createRelation(options, cb);
  }

  Node.prototype.createOrUpdateRelation = function(options, cb) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelation(options, cb);
  }

  Node.prototype.createOrUpdateRelationTo = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationTo(node, type, properties, cb, options);
  }

  Node.prototype.createOrUpdateRelationFrom = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationFrom(node, type, properties, cb, options);
  }

  Node.prototype.createOrUpdateRelationBetween = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationBetween(node, type, properties, cb, options);
  }

  Node.prototype.recommendConstructor = function(Fallback) {
    if (typeof Fallback !== 'function')
      Fallback = this.constructor;
    var label = (this.label) ? this.label : ( ((this.labels)&&(this.labels.length===1)) ? this.labels[0] : null );
    return (label) ? Node.registered_model(label) || Fallback : Fallback;
  }

  Node.prototype.setId = function(id) {
    this.id = this._id_ = id;
    return this;
  }

  /*
   * Label methods
   */

  Node.prototype.requestLabels = function(cb) {
    if ((this.hasId())&&(typeof cb === 'function')) {
      Graph.request().get('node/'+this.id+'/labels', cb);
    }
    return this;
  }

  Node.prototype.setLabel = function(label) {
    return this.setLabels([ label ]);
  }

  Node.prototype.setLabels = function(labels) {
    if (typeof labels === 'string') {
      labels = [ labels ];
    }
    if (_.isArray(labels)) {
      this.labels = labels;
    }
    // if we have only one label we set this to default label
    if ((_.isArray(this.labels))&&(this.labels.length === 1)) {
      this.label = this.labels[0];
    }
    return this;
  }

  Node.prototype.labelsAsArray = function() {
    var labels = this.labels;
    if (!_.isArray(labels))
      labels = [];
    if (this.label)
      labels.push(this.label);
    labels = _.uniq(labels);
    return labels;
  }

  Node.prototype.allLabels = function(cb) {
    return this.requestLabels(cb);
  }

  Node.prototype.createLabel = function(label, cb) {
    return this.createLabels([ label ], cb);
  }

  Node.prototype.createLabels = function(labels, cb) {
    if ( (this.hasId()) && (_.isFunction(cb)) )
      return Graph.request().post('node/'+this.id+'/labels', { data: labels }, cb);
  }

  //http://docs.neo4j.org/chunked/milestone/rest-api-node-labels.html
  Node.prototype.addLabels = function(labels, cb) {
    var self = this;
    if ( (this.hasId()) && (_.isFunction(cb)) ) {
      if (!_.isArray(labels))
        labels = [ labels ];
      self.allLabels(function(err, storedLabels, debug) {
        if (err)
          return cb(err, storedLabels, debug);
        if (!_.isArray(storedLabels))
          storedLabels = [];
        var addLabels = [];
        // only add new labels
        labels.forEach(function(label){
          if (_.indexOf(storedLabels, label) === -1)
            addLabels.push(label);
        });
        if (addLabels.length > 0)
          self.createLabels(addLabels, cb);
        else
          cb(null, storedLabels, debug);
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
    var self = this;
    if ( (this.hasId()) && (_.isFunction(cb)) ) {
      if (!_.isArray(labels))
        labels = [ labels ];
      self.labels = labels;
      Graph.request().put('node/'+self.id+'/labels', { data: labels }, cb);
    }
    return this;
  }

  Node.prototype.removeLabels = function(cb) {
    var id = this.id;
    if ( (this.hasId()) && (_.isFunction(cb)) ) {
      this.allLabels(function(err, labels, debug) {
        if ((err)||(!labels))
          return cb(err, labels, debug);
        var todo = labels.length;
        if (todo === 0)
          return cb(null, null, debug);
        labels.forEach(function(label) {
          return Graph.request().delete('node/'+id+'/labels/'+label, function() {
            todo--;
            if (todo === 0)
              cb(null, null, debug);
          });
        });
      })

    } else {
      return this;
    }
  }

  Node.prototype.toObject = function() {
    return {
      id: this.id,
      classification: this.classification,
      data: _.clone(this.data),
      uri: this.uri,
      label: (this.label) ? this.label : null,
      labels: (this.labels.length > 0) ? _.clone(this.labels) : []
    };
  }

  /*
   * Request methods
   */

  Node.prototype.stream = function(cb) {
    this._stream_ = true;
    return this.exec(cb);
  }

  Node.prototype.each = function(cb) {
    return this.stream(cb);
  }

  /*
   * STATIC METHODS for `find` Queries
   */

  Node.prototype.find = function(where, cb) {
    var self = this;
    if (!self._is_singleton_)
      self = this.singleton(undefined, this);
    self._query_history_.push({ find: true });
    if (self.label)
      self.withLabel(self.label);
    if ((typeof where === 'string')||(typeof where === 'object')) {
      return self.where(where,cb);
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
    self.cypher.segments.limit = 1;
    return self.exec(cb);
  }

  Node.prototype.findById = function(id, cb) {
    var id = Number(id);
    var self = this;
    if (isNaN(id)) {
      throw Error('You have to give a numeric id as argument');
    }
    this._query_history_.push({ findById: id });
    this.cypher.segments.by_id = Number(id);
    var identifier = this.cypher.segments.node_identifier || this.__TYPE_IDENTIFIER__;
    this.cypher.segments.return_properties = [ identifier ];
    if (typeof cb === 'function') {
      return this.exec(function(err, found, debug) {
        if ( (err) && (err.exception) && (self.ignoreExceptionPattern) && (self.ignoreExceptionPattern.test(err.exception)) ) {
          return cb(null, null, debug);
        }
        if (found) {
          if (found.length > 1) {
            return cb(Error('More than one result rows on findById… expected only one distinct result'), found, debug);
          }
          found = found[0];
        }
        cb(err, found, debug);
      });
    }
    return this.findByKeyValue({ id: id });
  }

  Node.prototype.findByKeyValue = function(key, value, cb, _limit_) {
    if (typeof _limit_ === 'undefined')
      _limit_ = null;
    // we have s.th. like
    // { key: value }
    if (typeof key === 'object') {
      cb = value;
      var _key = Object.keys(key)[0];
      value = key[_key];
      key = _key;
    }

    if (typeof key !== 'string')
      key = 'id';
    if ( (_.isString(key)) && (typeof value !== 'undefined') ) {
      this._query_history_.push({ findByKeyValue: true });
      var identifier = this.cypher.segments.node_identifier || this.__TYPE_IDENTIFIER__;
      if (this.cypher.segments.return_properties.length === 0)
        this.cypher.segments.return_properties = [ identifier ];
      if (key !== 'id') {
        var query = {};
        query[key] = value;
        this.where(query);
        if (this.label)
          this.withLabel(this.label);
        // if we have an id: value, we will build the query in prepareQuery
      }
      if (typeof cb === 'function') {
        return this.exec(function(err,found){
          if (err)
            return cb(err, found);
          else {
            // try to return the first (if exists)
            if (found === null)
              return cb(null, found);
            else if (found.length === 0)
              found = null;
            else if ((found.length === 1) && ( 1 === _limit_))
              found = found[0];
            else if ((_limit_ > 1) && (found.length > _limit_))
              // TODO: use a cypher limit instead
              found = found.splice(0, _limit_);
            return cb(null, found);
          }
        });
      }

    }
    return this;
  }

  Node.prototype.findOneByKeyValue = function(key, value, cb) {
    return this.findByKeyValue(key, value, cb, 1);
  }

  Node.prototype.findAll = function(cb) {
    this._query_history_.push({ findAll: true });
    this.cypher.segments.limit = null;
    this.cypher.segments.return_properties = ['n'];
    if (this.label)
      this.withLabel(this.label);
    return this.exec(cb);
  }

  Node.prototype.findOrCreate = function(where, cb) {
    var self = this;
    this.constructor.find(where).count(function(err, count, debug) {
      if (err)
        return cb(err, count, debug);
      else {
        if (count === 1)
          return self.findOne(where, cb);
        else if (count > 1)
          return cb(Error("More than one node found… You have query one distinct result"), null);
        // else
        var node = new self.constructor(where);
        node.save(cb);
      }
    });
    return this;
  }

  /*
   * Singleton methods, shorthands for their corresponding (static) prototype methods
   */

  /**
   * Create a singleton
   * Here a singleton (name may convey a singleton object is as single instance)
   * is a node object that is used as object to use
   * all `static` methods of the node api.
   *
   * Example:
   *    `Node.singleton().findOne().where()`
   */
  Node.prototype.singleton = function(id, label) {
    var Class = this.constructor;
    var node = new Class({},id);
    if (typeof label === 'string')
      node.label = label;
    node.resetQuery();
    node._is_singleton_ = true;
    node.resetQuery();
    return node;
  }

  Node.singleton = function(id, label) {
    return this.prototype.singleton(id, label);
  }

  Node.find = function(where, cb) {
    return this.prototype.singleton().find(where, cb);
  }

  Node.findAll = function(cb) {
    return this.prototype.singleton().findAll(cb);
  }

  Node.findById = function(id, cb) {
    return this.prototype.singleton().findById(id, cb);
  }

  Node.findOne = function(where, cb) {
    return this.prototype.singleton().findOne(where, cb);
  }

  Node.find = function(where, cb) {
    return this.prototype.singleton().find(where, cb);
  }

  Node.findOrCreate = function(where, cb) {
    return this.prototype.singleton().findOrCreate(where, cb);
  }

  Node.findByKeyValue = function(key, value, cb) {
    return this.prototype.singleton().findByKeyValue(key, value, cb);
  }

  Node.findOneByKeyValue = function(key, value, cb) {
    return this.prototype.singleton().findOneByKeyValue(key, value, cb);
  }

  Node.start = function(start, cb) {
    return this.prototype.singleton().start(start, cb);
  }

  Node.query = function(cypherQuery, parameters, cb, options) {
    return this.prototype.singleton().query(cypherQuery, parameters, cb, options);
  }

  Node.registerModel = function(Class, label, prototype, cb) {
    var name = null;
    var ParentModel = this;

    if (typeof Class === 'string') {

      if (typeof label === 'function') {
        cb = label;
        prototype = {};
      } else if (typeof label === 'object') {
        cb = prototype;
        prototype = label;
        label = null;
      } else if (typeof prototype === 'function') {
        cb = prototype;
        prototype = {};
      }
      if (typeof prototype !== 'object')
        prototype = {};
      label = name = Class;

      // we define here an anonymous constructor
      Class = function() {
        this.init.apply(this, arguments);
      }

      _.extend(Class, ParentModel); // 'static' methods

      if (prototype) {
        _.extend(Class.prototype, ParentModel.prototype, prototype);
        if (prototype.fields) {
          // extend each field defintion on prototype
          // e.g. indexes, defaults…
          var fieldDefinitions = prototype.fields;
          // fields will be extended seperately
          Class.prototype.fields = {};
          // iterate and extend through defaults, indexes, unique …
          for (var attribute in { indexes: {}, defaults: {},  unique: {} }) {
            if ((ParentModel.prototype.fields)&&(ParentModel.prototype.fields[attribute]))
              Class.prototype.fields[attribute] = _.extend({}, ParentModel.prototype.fields[attribute], fieldDefinitions[attribute] || {});
          }
        }
      }

      Class.prototype._constructor_name_ = Class.prototype.label = label;

      if (!Class.prototype.labels)
        Class.prototype.labels = [];
      else
        // copy (inherited) labels from parent class
        Class.prototype.labels = ParentModel.prototype.labels.slice();

      Class.prototype.labels.unshift(label);

    } else {
      // we expect to have a `class`-object as known from CoffeeScript
      Class.prototype.labels = Class.getParentModels();
      if (typeof label === 'string') {
        name = label;
      } else {
        name = helpers.constructorNameOfFunction(Class);
        cb = label;
      }
      Class.prototype.label = name;
    }
    Node.__models__[name] = Class;
    if (typeof cb === 'function') {
      Class.prototype.initialize(cb);
    }
    return Class;
  }

  Node.getParentModels = function() {
    var models = [];
    models.push(helpers.constructorNameOfFunction(this));
    if (this.__super__) {
      var Class = this;
      var i = 0;
      var modelName = '';
      while((Class.__super__) && (i < 10)) {
        i++;
        modelName = helpers.constructorNameOfFunction(Class.__super__);

        if (!/^(Node|Relationship|Path)/.test(modelName))
          models.push(modelName);
        if ((Class.prototype.labels)&&(Class.prototype.labels.length > 0))
          models.push(Class.prototype.labels);
        Class = Class.__super__;
      }
      // we have a "coffeescript class" object
    }
    return _.uniq(_.flatten(models));
  }

  Node.unregisterModel = function(Class) {
    var name = (typeof Class === 'string') ? Class : helpers.constructorNameOfFunction(Class);
    if (typeof Node.__models__[name] === 'function')
      delete Node.__models__[name];
    return Node.__models__;
  }

  Node.registeredModels = function() {
    return Node.__models__;
  }

  Node.registeredModel = function(model) {
    if (typeof model === 'function') {
      model = helpers.constructorNameOfFunction(model);
    }
    return Node.registeredModels()[model] || null;
  }

  Node.ensureIndex = function(cb) {
    return this.singleton().ensureIndex(cb);
  }

  Node.dropIndex = function(fields, cb) {
    return this.singleton().dropIndex(fields, cb);
  }

  Node.dropEntireIndex = function(cb) {
    return this.singleton().dropEntireIndex(cb);
  }

  Node.getIndex = function(cb) {
    return this.singleton().getIndex(cb);
  }

  Node.disableLoading = function() {
    return this.prototype.disableLoading();
  }

  Node.enableLoading = function() {
    return this.prototype.enableLoading();
  }

  Node.deleteAllIncludingRelations = function(cb) {
    return this.find().deleteIncludingRelations(cb);
  }

  Node.create = function(data, id, cb) {
    if (typeof id === 'function') {
      cb = id;
      id = undefined;
    }
    var node = new this(data, id);
    if (typeof cb === 'function')
      return node.save(cb);
    else
      return node;
  }

  Node.new = function(data, id, cb) {
    return this.create(data, id, cb);
  }

  Node.setDefaultFields = function(fields) {
    return this._setModelFields('defaults', fields);
  }

  Node.setIndexFields = function(fields) {
    return this._setModelFields('indexes', fields);
  }

  Node.setUniqueFields = function(fields) {
    return this._setModelFields('unique', fields);
  }

  Node._setModelFields = function(part, fields) {
    // part: defaults|unique|indexes
    for (var attribute in this.prototype.fields[part])
      // delete previous fields
      delete(this.prototype.fields[part][attribute]);
    if ((typeof fields === 'object') && (fields !== null)) {
      for (var attribute in fields)
        this.prototype.fields[part][attribute] = fields[attribute]
    }
    return this;
  }

  Node.registered_model   = Node.registeredModel;
  Node.registered_models  = Node.registeredModels;
  Node.unregister_model   = Node.unregisterModel;
  Node.register_model     = Node.registerModel;

  Node.prototype._addParametersToCypher = Graph.prototype._addParametersToCypher;
  Node.prototype._addParameterToCypher  = Graph.prototype._addParameterToCypher;

  return neo4jrestful.Node = Node;
}

if (typeof window !== 'object') {
  module.exports = exports = {
    init: __initNode__
  }
} else {
  window.Neo4jMapper.initNode = __initNode__;
}
