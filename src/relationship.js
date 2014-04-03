// # Relationship
/*
 * TODO:
 * * make query mapper from Node available for relationships as well
 * * make relationships queryable with custom queries
 */

var __initRelationship__ = function(neo4jrestful, Graph, Node) {


  if (typeof window === 'object') {
    var helpers = window.Neo4jMapper.helpers;
    var _       = window._;
  } else {
    var helpers  = require('./helpers');
    var _        = require('underscore');
  }

  // Constructor of Relationship
  var Relationship = function Relationship(type, data, start, end, id, cb) {
    this.type = this._type_ = type || null;
    this.from = {
      id: null,
      uri: null
    };
    this.to = {
      id: null,
      uri: null
    };
    this.data = data || {};

    var startID = null;
    var endID = null;

    if (start)
      if (Number(start.id))
        startID = Number(start.id);
      else if (Number(start))
        startID = Number(start);
      else if (start)
        // we assume we have a url here
        this.setPointIdByUri('from', start);

    if (startID)
      this.setPointUriById('from', startID);

    if (end)
      if (Number(end.id))
        endID = Number(end.id);
      else if (Number(end))
        endID = Number(end);
      else if (end)
        // we assume we have a url here
        this.setPointIdByUri('to', end);

    if (endID)
      this.setPointUriById('to', endID);

    this.fields = _.extend({},{
      defaults: _.extend({}, this.fields.defaults),
      indexes: _.extend({}, this.fields.indexes) // TODO: implement
    });

    this._is_instanced_ = true;

    if (typeof id === 'number') {
      this.setUriById(id);
      this.id = this._id_ = id;
    } else {
      cb = id;
    }
    if (typeof cb === 'function') {
      return this.save(cb);
    }
  }

  Relationship.prototype.classification   = 'Relationship'; // only needed for toObject()
  Relationship.prototype.data             = {};
  Relationship.prototype.start            = null;
  Relationship.prototype.type             = null;
  Relationship.prototype._type_           = null;           // like `_id_` to keep a reference to the legacy type
  Relationship.prototype.end              = null;
  Relationship.prototype.from             = null;
  Relationship.prototype.to               = null;
  Relationship.prototype.id               = null;
  Relationship.prototype._id_             = null;
  Relationship.prototype._hashedData_     = null;
  Relationship.prototype.uri              = null;
  Relationship.prototype._response_       = null;
  Relationship.prototype._is_singleton_   = false;
  Relationship.prototype._is_persisted_   = false;
  Relationship.prototype.cypher           = null;
  Relationship.prototype._is_instanced_   = null;
  Relationship.prototype.fields = {
    defaults: {},
    indexes: {}
  };

  // should **never** be changed
  Relationship.prototype.__TYPE__ = 'relationship';
  Relationship.prototype.__TYPE_IDENTIFIER__ = 'r';

  Relationship.prototype.singleton = function(id) {
    var relationship = new Relationship();
    if (typeof id === 'number') {
      this.id = this._id_ = id;
    }
    relationship._is_singleton_ = true;
    // relationship.resetQuery();
    return relationship;
  }

  Relationship.singleton = function(id) {
    return this.prototype.singleton(id);
  }

  Relationship.prototype.setPointUriById = function(startOrEnd, id) {
    if (typeof startOrEnd !== 'string')
      startOrEnd = 'from';
    if ((startOrEnd !== 'from')&&(startOrEnd !== 'to'))
      throw Error("You have to set startOrEnd argument to 'from' or 'to'");
    if (_.isNumber(id)) {
      this[startOrEnd].uri = neo4jrestful.absoluteUrl('/relationship/'+id);
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
    if ( (_.isNumber(Number(id))) && (typeof cb === 'function') ) {
      // to reduce calls we'll make a specific restful request for one node
      return Graph.request().get(this.__TYPE__+'/'+id, function(err, object) {
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

  Relationship.prototype.save = function(cb) {
    var self = this;
    self.onBeforeSave(self, function(err) {
      // don't execute if an error is passed through
      if ((typeof err !== 'undefined')&&(err !== null))
        cb(err, null);
      else
        self.onSave(function(err, relationship, debug) {
          if (err)
            return cb(err, relationship, debug);
          else
            return self.onAfterSave(self, cb, debug);
        });
    });
  }

  Relationship.prototype.onSave = function(cb) {
    var self = this;
    if (this._is_singleton_)
      return cb(Error('Singleton instances can not be persisted'), null);
    if (!this.hasValidData())
      return cb(Error('relationship does not contain valid data. `'+this.__TYPE__+'.data` must be an object.'));
    this.resetQuery();
    this.applyDefaultValues();

    this.id = this._id_;

    if (!this.type)
      throw Error("Type for a relationship is mandatory, e.g. `relationship.type = 'KNOW'`");
    if ((!(this.from))||(isNaN(this.from.id)))
      throw Error('Relationship requires a `relationship.from` startnode');
    if ((!(this.to))||(isNaN(this.to.id)))
      throw Error('Relationship requires a `relationship.to` endnode');

    if (this.hasId()) {

      if ((this._type_) && (this.type !== this._type_)) {
        // type has changed
        // since we can't update a relationship type (only properties)
        // we have to create a new relationship and delete the "old" one
        return Relationship.create(this.type, this.data, this.start, this.end, function(err, relationship, debug) {
          if (err) {
            return cb(err, relationship, debug);
          } else {
            self.remove(function(err, res, debugDelete) {
              if (err) {
                return cb(err, res, debugDelete);
              } else {
                relationship.copyTo(self);
                return cb(null, self, debug);
              }
            })
          }
        })
      }

      // UPDATE properties
      // url = 'relationship/'+this._id_+'/properties';
      Graph
        .start('r = relationship({id})', {
          id: Number(this.id),
        })
        .setWith( { r: this.dataForCypher() } )
        .return('r')
        .exec(cb);
    } else {
      Graph
        .start('n = node({from}), m = node({to})', {
          from: Number(this.from.id),
          to: Number(this.to.id),
        })
        .create([ '(n)-[r: '+helpers.escapeProperty(this.type), this.dataForCypher(), ']->(m)'])
        .return('r')
        .limit(1)
        .exec(function(err, relationship, debug) {
          if ((err) || (!relationship))
            return cb(err, relationship, debug);
          else {
            relationship.copyTo(self);
            return cb(null, self, debug);
          }
        });
    }
  }

  Relationship.prototype.update = function(data, cb) {
    if (helpers.isObjectLiteral(data)) {
      this.data = _.extend(this.data, data);
      data = this.flattenData();
    } else {
      cb = data;
    }
    return this.save(cb);
  }

  Relationship.prototype.populateWithDataFromResponse = function(data, create) {
    create = (typeof create !== 'undefined') ? create : false;
    // if we are working on the prototype object
    // we won't mutate it and create a new relationship instance insetad
    var relationship = (this._is_instanced_ !== null) ? this : new Relationship();
    if (create)
      relationship = new Relationship();
    if (data) {
      if (_.isObject(data) && (!_.isArray(data)))
        relationship._response_ = data;
      else
        relationship._response_ = data[0];
      relationship.data = relationship._response_.data;
      relationship.data = helpers.unflattenObject(this.data);
      relationship.uri  = relationship._response_.self;
      relationship.type = relationship._type_ = relationship._response_.type;
      if ((relationship._response_.self) && (relationship._response_.self.match(/[0-9]+$/))) {
        relationship.id = relationship._id_ = Number(relationship._response_.self.match(/[0-9]+$/)[0]);
      }
      if ((relationship._response_.start) && (relationship._response_.start.match(/[0-9]+$/))) {
        relationship.from.uri = relationship.start = relationship._response_.start;
        relationship.setPointIdByUri('from', relationship._response_.start);
      }
      if ((relationship._response_.end) && (relationship._response_.end.match(/[0-9]+$/))) {
        relationship.to.uri = relationship.end = relationship._response_.end;
        relationship.setPointIdByUri('to', relationship._response_.end);
      }
    }
    relationship._is_persisted_ = true;
    relationship.isPersisted(true);
    return relationship;
  }

  Relationship.prototype.remove = function(cb) {
    if (this._is_singleton_)
      return cb(Error("To delete results of a query use delete(). remove() is for removing a relationship."),null);
    if (this.hasId()) {
      return Graph.request().delete('relationship/'+this.id, cb);
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
    this._onBeforeLoad(self, function(err, relationship){
      if (err)
        cb(err, relationship);
      else
        self._onAfterLoad(relationship, cb);
    })
  }

  Relationship.prototype._onBeforeLoad = function(relationship, next) {
    return this.onBeforeLoad(relationship, function(err, relationship) {
      if (relationship.hasId()) {
        relationship.loadFromAndToNodes(function(err, relationship){
          next(err, relationship);
        });
      } else {
        next(null, relationship);
      }
    });
  }

  Relationship.prototype.onBeforeLoad = function(relationship, next) {
    return next(null, relationship);
  }

  Relationship.prototype._onAfterLoad = function(relationship, next) {
    return this.onAfterLoad(relationship, function(err, relationship) {
      return next(null, relationship);
    })
  }

  Relationship.prototype.onAfterLoad = function(relationship, next) {
    return next(null, relationship);
  }

  Relationship.prototype.toQuery = function() {
    if (this.hasId()) {
      return Graph
        .start('r = relationship('+this.id+')')
        .return('r').toQuery();
    }
    return Graph.start('r = relationship(*)').toQuery();
  }

  Relationship.prototype.toQueryString = Node.prototype.toQueryString;

  Relationship.prototype.toCypherQuery = Node.prototype.toCypherQuery;

  Relationship.prototype.toObject = function() {
    var o = {
      id: this.id,
      classification: this.classification,
      data: _.clone(this.data),
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

  Relationship.prototype._hashData_ = function() {
    if (this.hasValidData())
      return helpers.md5(JSON.stringify(this.toObject()));
    else
      return null;
  }

  Relationship.prototype.onBeforeSave = function(node, next) {
    next(null, null);
  }

  Relationship.prototype.onAfterSave = function(relationship, next, debug) {
    return next(null, relationship, debug);
  }

  Relationship.prototype.resetQuery = function() {
    this.cypher = new helpers.CypherQuery();
    return this;
  }

  Relationship.prototype._load_hook_reference_  = null;

  /*
   * Static singleton methods
   */

  Relationship.findById = function(id, cb) {
    return Relationship.singleton().findById(id, cb);
  }

  Relationship.recommendConstructor = function() {
    return Relationship;
  }


  /* from Node */
  Relationship.prototype.applyDefaultValues = Node.prototype.applyDefaultValues

  // Copys only the node's relevant data(s) to another object
  Relationship.prototype.copyTo = function(r) {
    r.id = r._id_ = this._id_;
    r.data   = _.clone(this.data);
    r.uri = this.uri;
    r._response_ = _.clone(this._response_);
    r.from = _.clone(this.from);
    r.to = _.clone(this.to);
    r.start = this.start;
    r.end = this.end;
    r.type = r._type_ = this._type_;
    return r;
  }

  Relationship.prototype.hasValidData     = Node.prototype.hasValidData;
  Relationship.prototype.flattenData      = Node.prototype.flattenData;
  Relationship.prototype.setUriById       = Node.prototype.setUriById;
  Relationship.prototype.isPersisted      = Node.prototype.isPersisted;
  Relationship.prototype.hasId            = Node.prototype.hasId;
  Relationship.prototype.dataForCypher    = Node.prototype.dataForCypher;

  Relationship.setDefaultFields            = Node.setDefaultFields;
  Relationship.setIndexFields              = Node.setIndexFields;
  Relationship.setUniqueFields             = Node.setUniqueFields;
  Relationship._setModelFields             = Node._setModelFields;

  Relationship.new = function(type, data, start, end, id, cb) {
    return new Relationship(type, data, start, end, id, cb);
  }

  Relationship.create = Relationship.new;

  return neo4jrestful.Relationship = Relationship;
}

if (typeof window !== 'object') {
  module.exports = exports = {
    init: __initRelationship__
  }
} else {
  window.Neo4jMapper.initRelationship = __initRelationship__;
}
