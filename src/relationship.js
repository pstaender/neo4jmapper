/*
 * TODO: make query mapper from Node available for relationships as well
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
  Relationship.prototype.uri = null;
  Relationship.prototype._response = null;
  // Relationship.prototype._modified_query = false;
  Relationship.prototype.is_singleton = false;
  Relationship.prototype.is_persisted = false;
  Relationship.prototype.cypher = {};
  Relationship.prototype.is_instanced = null;

  Relationship.prototype.singleton = function() {
    var relationship = new Relationship();
    relationship.neo4jrestful = _neo4jrestful;
    relationship.resetQuery();
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

  Relationship.prototype.save = function(cb) {
    var self = this;
    if (this.is_singleton)
      return cb(Error('Singleton instances can not be persisted'), null);
    this._modified_query = false;
    var url = '/db/relationship/relationship';
    var method = 'post';
    if (this.hasId()) {
      url = '/db/data/relationship/'+this.id+'/properties';
      method = 'put';
    } else {
      this.neo4jrestful['method']('/db/relationship/relationship', { data: this.flattenData() }, function(err,data){
        if (err)
          cb(err,data);
        else {
          self.populateWithDataFromResponse(data);
          return cb(null, data);
        }
      });
    }
  }

  // Relationship.prototype.update = function(cb) {
  //   var self = this;
  //   if (this.is_singleton)
  //     return cb(Error('Singleton instances can not be persisted'), null);
  //   this._modified_query = false;
  //   if (this.hasId()) {
  //     this.neo4jrestful.put('/db/data/relationship/'+this.id+'/properties', { data: this.flattenData() }, function(err,data){
  //       if (err)
  //         return cb(err, data);
  //       else
  //         return cb(null, self);
  //     });
  //   } else {
  //     return cb(Error('You have to save() the relationship before you can perform an update'), null);
  //   }
  // }

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
        relationship.id = Number(relationship._response.self.match(/[0-9]+$/)[0]);
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

  // TODO: autoindex? http://docs.neo4j.org/chunked/milestone/rest-api-configurable-auto-indexes.html
  // Relationship.prototype.index = function(namespace, key, value, cb) { }

  Relationship.prototype.toObject = function() {
    return {
      id: this.id,
      data: _.extend(this.data),
      start: this.start,
      end: this.end,
      from: _.extend(this.from),
      to: _.extend(this.to),
      uri: this.uri
    };
  }

  return Relationship;

}

if (typeof window !== 'object') {
  module.exports = exports = initRelationship;
}