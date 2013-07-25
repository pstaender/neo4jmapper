/*
 * TODO:
 * * make query mapper from Node available for relationships as well
 * * make relationships queryable with custom queries
 */

// Requirements (for browser and nodejs):
// * Node
// * neo4jmapper helpres
// * underscorejs
var Node          = null // will be initialized
  , helpers       = null
  , _             = null;

if (typeof window === 'object') {
  helpers = neo4jmapper_helpers;
  _       = window._;
} else {
  helpers  = require('./helpers');
  _        = require('underscore');
}

// Constructor
Relationship = function Relationship(data, start, end, id) {
  this.id = id || null;
  this.data = data || {};
  this.from = {
    id: null,
    uri: null
  };
  this.to = {
    id: null,
    uri: null
  };
  if (_.isString(start))
    this.setPointUriById('from', start);
  else if (_.isNumber(start))
    this.setPointIdByUri('from', start);
  if (_.isString(end))
    this.setPointUriById('to', end);
  else if (_.isNumber(end))
    this.setPointIdByUri('to', end);
  // this.resetQuery();
  if (id) {
    this.setUriById(id);
  }
  this.fields = _.extend({},{
    defaults: _.extend({}, this.fields.defaults),
    indexes: _.extend({}, this.fields.indexes) // TODO: implement
  });
  // each relationship object has it's own restful client
  this.neo4jrestful = _.extend({}, Node.prototype.neo4jrestful);
  this.neo4jrestful.header = _.extend({}, Node.prototype.neo4jrestful.header);
  this.is_instanced = true;
}

Relationship.prototype.classification = 'Relationship'; // only needed for toObject()
Relationship.prototype.neo4jrestful = null; // will be initialized
Relationship.prototype.data = {};
Relationship.prototype.start = null;
Relationship.prototype.type = null;
Relationship.prototype.end = null;
Relationship.prototype.from = null;
Relationship.prototype.to = null;
Relationship.prototype.id = null;
Relationship.prototype._id_ = null;
Relationship.prototype._hashedData_ = null;
Relationship.prototype.uri = null;
Relationship.prototype._response = null;
// Relationship.prototype._modified_query = false;
Relationship.prototype.is_singleton = false;
Relationship.prototype.is_persisted = false;
Relationship.prototype.cypher = {};
Relationship.prototype.is_instanced = null;
Relationship.prototype.fields = {
  defaults: {},
  indexes: {}
};

Relationship.prototype.__type__ = 'relationship';
Relationship.prototype.__type_identifier__ = 'r';

Relationship.prototype.singleton = function() {
  var relationship = new Relationship();
  relationship.is_singleton = true;
  // relationship.resetQuery();
  return relationship;
}

Relationship.prototype.setPointUriById = function(startOrEnd, id) {
  if (typeof startOrEnd !== 'string')
    startOrEnd = 'from';
  if ((startOrEnd !== 'from')||(startOrEnd !== 'to'))
    throw Error("You have to set startOrEnd argument to 'from' or 'to'");
  if (_.isNumber(id)) {
    this[startOrEnd].uri = this.neo4jrestful.baseUrl+'db/data/relationship/'+id;
    this[startOrEnd].id = id;
  }
  return this;
}

Relationship.prototype.setPointIdByUri = function(startOrEnd, uri) {
  if (typeof startOrEnd !== 'string')
    startOrEnd = 'from';
  if ((startOrEnd !== 'from')&&(startOrEnd !== 'to'))
    throw Error("You have to set startOrEnd argument to 'from' or 'to'");
  if (uri.match(/[0-9]+$/)) {
    this[startOrEnd].uri = uri;
    this[startOrEnd].id = Number(uri.match(/[0-9]+$/)[0]);
  }
}

Relationship.prototype.applyDefaultValues = null; // will be initialized

Relationship.prototype.findById = function(id, cb) {
  var self = this;
  if (!self.is_singleton)
    self = this.singleton(undefined, this);
  if ( (_.isNumber(Number(id))) && (typeof cb === 'function') ) {
    // to reduce calls we'll make a specific restful request for one node
    return self.neo4jrestful.get('/db/data/'+this.__type__+'/'+id, function(err, object) {
      if ((object) && (typeof self.load === 'function')) {
        //  && (typeof node.load === 'function')     
        object.load(cb);
      } else {
        cb(err, object);
      }
    });
  }
  return this;
}

// // // TODO: save  functionality as Node.update() asap!!!
Relationship.prototype.update = function(data, cb) {
  var self = this;
  if (helpers.isValidData(data)) {
    this.data = _.extend(this.data, data);
    data = this.flattenData();
  } else {
    cb = data;
  }
  if (!this.hasId())
    return cb(Error('Singleton instances can not be persisted'), null);
  this._modified_query = false;
  if (this.hasId()) {
    // copy 'private' _id_ to public
    this.id = this._id_;
    this.neo4jrestful.put('/db/data/'+this.__type__+'/'+this.id+'/properties', { data: data }, function(err,data){
      if (err)
        return cb(err, data);
      else
        return cb(null, self);
    });
  } else {
    return cb(Error('You have to save() the relationship before you can perform an update'), null);
  }
}

Relationship.prototype.save = function(cb) {
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

Relationship.prototype.populateWithDataFromResponse = function(data, create) {
  create = (typeof create !== 'undefined') ? create : false;
  // if we are working on the prototype object
  // we won't mutate it and create a new relationship instance insetad
  var relationship = (this.is_instanced !== null) ? this : new Relationship();
  if (create)
    relationship = new Relationship();
  relationship._modified_query = false;
  if (data) {
    if (_.isObject(data) && (!_.isArray(data)))
      relationship._response = data;
    else
      relationship._response = data[0];
    relationship.data = relationship._response.data;
    relationship.data = helpers.unflattenObject(this.data);
    relationship.uri  = relationship._response.self;
    relationship.type = relationship._response.type;
    if ((relationship._response.self) && (relationship._response.self.match(/[0-9]+$/))) {
      relationship.id = relationship._id_ = Number(relationship._response.self.match(/[0-9]+$/)[0]);
    }
    if ((relationship._response.start) && (relationship._response.start.match(/[0-9]+$/))) {
      relationship.from.uri = relationship.start = relationship._response.start;
      relationship.setPointIdByUri('from', relationship._response.start);
    }
    if ((relationship._response.end) && (relationship._response.end.match(/[0-9]+$/))) {
      relationship.to.uri = relationship.end = relationship._response.end;
      relationship.setPointIdByUri('to', relationship._response.end);
    }
  }
  relationship.is_persisted = true;
  relationship.isPersisted(true);
  return relationship;
}

Relationship.prototype.remove = function(cb) {
  if (this.is_singleton)
    return cb(Error("To delete results of a query use delete(). remove() is for removing a relationship."),null);
  if (this.hasId()) {
    return this.neo4jrestful.delete('/db/data/relationship/'+this.id, cb);
  }
  return this;
}

Relationship.prototype.loadFromAndToNodes = function(cb) {
  var self = this;
  var attributes = ['from', 'to'];
  var done = 0;
  var errors = [];
  for (var i = 0; i < 2; i++) {
    (function(point){
      Node.findById(self[point].id,function(err,node) {
        self[point] = node;
        if (err)
          errors.push(err);
        done++;
        if (done === 2) {
          cb((errors.length === 0) ? null : errors, self);
        }
          
      });
    })(attributes[i]);
  }
}

Relationship.prototype.load = function(cb) {
  var self = this;
  this.onBeforeLoad(self, function(err, relationship){
    if (err)
      cb(err, relationship);
    else
      self.onAfterLoad(relationship, cb);
  })
}

Relationship.prototype.onBeforeLoad = function(relationship, next) {
  if (relationship.hasId()) {
    relationship.loadFromAndToNodes(function(err, relationship){
      next(err, relationship);
    });
  } else {
    next(null, relationship);
  } 
}

Relationship.prototype.onAfterLoad = function(relationship, next) {
  return next(null, relationship);
}

Relationship.prototype.toObject = function() {
  var o = {
    id: this.id,
    classification: this.classification,
    data: _.extend(this.data),
    start: this.start,
    end: this.end,
    from: _.extend(this.from),
    to: _.extend(this.to),
    uri: this.uri,
    type: this.type
  };
  if ( (o.from) && (typeof o.from.toObject === 'function') )
    o.from = o.from.toObject();
  if ( (o.to)   && (typeof o.to.toObject === 'function') )
    o.to   = o.to.toObject();
  return o;
}

Relationship.prototype.onBeforeSave = function(node, next) {
  next(null, null);
}

Relationship.prototype.onAfterSave = function(node, next, debug) {
  return next(null, node, debug);
}

/*
 * Static singleton methods
 */

Relationship.findById = function(id, cb) {
  return this.prototype.findById(id, cb);
}

Relationship.recommendConstructor = function() {
  return Relationship;
}

var initRelationship = function(neo4jrestful) {

  // Ensure that we have a Neo4jRestful client we can work with
  if ((typeof neo4jrestful !== 'undefined') && (helpers.constructorNameOfFunction(neo4jrestful) !== 'Neo4jRestful'))
    throw Error('You have to use an Neo4jRestful object as argument');

  if (typeof neo4jrestful === 'object') {
    if (typeof window === 'object') {
      // browser      
      Node = initNode(neo4jrestful);
      window.Neo4jMapper.Relationship.prototype.neo4jrestful = neo4jrestful;
      window.Neo4jMapper.Relationship.prototype.applyDefaultValues = window.Neo4jMapper.Node.prototype.applyDefaultValues;
      // return window.Neo4jMapper.Relationship;
    } else {
      // nodejs
      Node = require('./node')(neo4jrestful);
      Relationship.prototype.neo4jrestful = neo4jrestful;
      Relationship.prototype.applyDefaultValues = Node.prototype.applyDefaultValues;
    }
    
  }

  /* from Node */

  Relationship.prototype.copy_of          = Node.prototype.copy_of;
  Relationship.prototype.onSave           = Node.prototype.onSave;
  Relationship.prototype.hasValidData     = Node.prototype.hasValidData;
  Relationship.prototype.flattenData      = Node.prototype.flattenData;
  Relationship.prototype.setUriById       = Node.prototype.setUriById;
  Relationship.prototype.isPersisted      = Node.prototype.isPersisted;
  Relationship.prototype.hasId            = Node.prototype.hasId;
  Relationship.prototype._hashData_       = Node.prototype._hashData_;

  return Relationship;

}

if (typeof window !== 'object') {
  module.exports = exports = initRelationship;
} else {
  window.Neo4jMapper.Relationship = Relationship;
}