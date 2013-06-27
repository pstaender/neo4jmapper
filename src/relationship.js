/*
 * TODO:
 * + make query mapper from Node available for relationships as well
 * + make relationships queryable with custom queries
 */

var initRelationship = function(neo4jrestful) {

  var _neo4jrestful = null
    , Node          = null
    , helpers       = null
    , _             = null;

  if (typeof window === 'object') {
    // browser
    helpers = neo4jmapper_helpers;
    _       = window._;
    Node    = initNode(neo4jrestful);
  } else {
    // nodejs
    helpers  = require('./helpers');
    _        = require('underscore');
    Node     = require('./node')(neo4jrestful);
  }

  if (_.isObject(neo4jrestful)) {
    _neo4jrestful = neo4jrestful;
  }

  /*
   * Constructor
   */
  
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
    this.is_instanced = true;
  }

  Relationship.prototype.neo4jrestful = _neo4jrestful;
  Relationship.prototype.data = {};
  Relationship.prototype.start = null;
  Relationship.prototype.type = null;
  Relationship.prototype.end = null;
  Relationship.prototype.from = null;
  Relationship.prototype.to = null;
  Relationship.prototype.id = null;
  Relationship.prototype._id_ = null;
  Relationship.prototype.uri = null;
  Relationship.prototype._response = null;
  // Relationship.prototype._modified_query = false;
  Relationship.prototype.is_singleton = false;
  Relationship.prototype.is_persisted = false;
  Relationship.prototype.cypher = {};
  Relationship.prototype.is_instanced = null;

  Relationship.prototype.__type__ = 'relationship';
  Relationship.prototype.__type_identifier__ = 'r';

  Relationship.prototype.singleton = function() {
    var relationship = new Relationship();
    relationship.neo4jrestful = _neo4jrestful;
    relationship.is_singleton = true;
    // relationship.resetQuery();
    return relationship;
  }


  Relationship.prototype.hasId = function() {
    return ((this.is_instanced) && (this.id > 0)) ? true : false;
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

  Relationship.prototype.setUriById = function(id) {
    if (_.isNumber(id))
      return this.uri = this.neo4jrestful.baseUrl+'db/data/relationship/'+id;
  }

  Relationship.prototype.flattenData = Node.prototype.flattenData;

  Relationship.prototype.unflattenData = Node.prototype.flattenData;

  Relationship.prototype.findById = function(id, cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton();
    return this.neo4jrestful.get('/db/data/relationship/'+Number(id), function(err, relationship) {
      if ((err)||(!relationship))
        return cb(err, relationship);
      else {
        relationship.load(cb);
      }
    });
  }

  Relationship.prototype.save = function(cb) {
    var self = this;
    if (this.is_singleton)
      return cb(Error('Singleton instances can not be persisted'), null);
    this._modified_query = false;
    if (this._id_) {
      // copy 'private' _id_ to public
      this.id = this._id_;
      return this.update(cb);
    } else {
      var url = '/db/relationship/relationship';
      this.neo4jrestful.post(url, { data: this.flattenData() }, function(err,data){
        if (err)
          cb(err,data);
        else {
          self.populateWithDataFromResponse(data);
          return cb(null, data);
        }
      });
    }
  }

  Relationship.prototype.update = function(data, cb) {
    var self = this;
    if (helpers.isValidData(data)) {
      this.data = _.extend(this.data, data);
    } else {
      cb = data;
    }
    if (!this.hasId())
      return cb(Error('Singleton instances can not be persisted'), null);
    this._modified_query = false;
    if (this.hasId()) {
      // copy 'private' _id_ to public
      this.id = this._id_;
      this.neo4jrestful.put('/db/data/relationship/'+this.id+'/properties', { data: this.flattenData() }, function(err,data){
        if (err)
          return cb(err, data);
        else
          return cb(null, self);
      });
    } else {
      return cb(Error('You have to save() the relationship before you can perform an update'), null);
    }
  }

   // extensions: {},
   //  start: 'http://localhost:7419/db/data/node/169',
   //  property: 'http://localhost:7419/db/data/relationship/10/properties/{key}',
   //  self: 'http://localhost:7419/db/data/relationship/10',
   //  properties: 'http://localhost:7419/db/data/relationship/10/properties',
   //  type: 'KNOWS',
   //  end: 'http://localhost:7419/db/data/node/170',
   //  data: { since: 'years' } }

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
      relationship.data = relationship.unflattenData();
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
    var attributes = [ 'from', 'to' ];
    var done = 0;
    for (var i = 0; i < 2; i++) {
      (function(point){
        Node.prototype.findById(self[point].id,function(err,node) {
          self[point] = node;
          done++;
          if (done === 2) {
            cb(null, self);
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
    return {
      id: this.id,
      data: _.extend(this.data),
      start: this.start,
      end: this.end,
      from: _.extend(this.from),
      to: _.extend(this.to),
      uri: this.uri,
      type: this.type
    };
  }

  /*
   * Static singleton methods
   */

  Relationship.findById = function(id, cb) {
    return this.prototype.findById(id, cb);
  }

  return Relationship;

}

if (typeof window !== 'object') {
  module.exports = exports = initRelationship;
}