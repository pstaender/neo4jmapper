
if (typeof window === 'object') {
  var _ = window._;
  var helpers = window.Neo4jMapper.helpers;
} else {
  var _ = require('underscore');
  var helpers = require('./helpers');
}

var CypherQuery = function CypherQuery(query, parameters) {
  this.statements = [];
  if (typeof query === 'string')
    this.query = query;
  else if (typeof query === 'object')
    this.statements = query;
  if (parameters)
    this.parameters = parameters;
  this.cypher = _.extend(CypherQuery.prototype.cypher);
}

CypherQuery.prototype.statementsToString = function(options) {
  var s = '';
  var chopLength = 15;
  var defaultOptions = {
    niceFormat: true
  };
  if (this.statements) {
    if (typeof options !== 'object')
      options = {};
    else
      _.defaults(options, defaultOptions);
    for (var i=0; i < this.statements.length; i++) {
      var queryFragment = this.statements[i];
      if (typeof queryFragment === 'string') {
        // if we have just a string, we add the string to final query, no manipulation
        s += queryFragment;
        continue;
      }
      var attribute = Object.keys(this.statements[i])[0];
      if ((typeof queryFragment === 'object') && (typeof queryFragment.toQueryString === 'function')) {
        queryFragment = queryFragment.toQueryString();
        s += queryFragment;
        continue;
      }
      var forQuery = this.statements[i][attribute];
      // do we have an object with a .toQueryString() method?

      // remove underscore from attribute, e.g. ORDER_BY -> ORDER BY
      attribute = attribute.replace(/([A-Z]{1})\_([A-Z]{1})/g, '$1 $2');
      if (options.niceFormat) {
        // extend attribute-string with whitespace
        attribute = attribute + Array(chopLength - attribute.length).join(' ');
      }
      if (forQuery !== null) {
        if (typeof forQuery === 'string') {
          // remove dupliacted statement fragment identifier, e.g. START START … -> START …
          forQuery = forQuery.trim().replace(new RegExp('^'+attribute+'\\s+', 'i'), '');
          // remove trailing semicolon
          forQuery = forQuery.replace(/\;$/, '');
        } else {
          forQuery = String(forQuery);
        }
        s += '\n'+attribute+' '+forQuery+' ';
      }
    }
    s = s.trim().replace(/;+$/,'');
  }
  return s + ';';
}

CypherQuery.prototype.query = '';         // the cypher query string
CypherQuery.prototype.parameters = null;
CypherQuery.prototype.statements = null;
CypherQuery.prototype.cypher = {};
CypherQuery.prototype.useParameters = true;

CypherQuery.prototype.hasParameters = function() {
  return ((this.parameters) && (typeof this.parameters === 'object') && (Object.keys(this.parameters).length > 0));
}

CypherQuery.prototype.toCypher = function(options) {
  var s = '';
  if (this.query)
    s = this.query;
  else if (this.statements.length > 0)
    s = this.statementsToString(options);
  return s;
}

CypherQuery.prototype.toString = function(options) {
  var s = this.toCypher(options);
  if ((s)&&(this.hasParameters())) {
    // replace identifiers with values to present a good equivalent
    for (var key in this.parameters) {
      var value = this.parameters[key];
      // TODO: better check that we detect placeholders
      s = s.replace('{'+key+'}', helpers.valueToStringForCypherQuery(value, "'"));
    };
  }
  return s;
}

CypherQuery.prototype.addParameters = function(parameters) {
  if (typeof parameters !== 'object')
    throw Error('parameter(s) as argument must be an object, e.g. { key: "value" }')
  if (this.useParameters === null)
    this.useParameters = true;
  // reset parameters
  if ((!this.hasParameters()) || ((parameters !== null) && (Object.keys(parameters).length === 0)))
    this.parameters = {};
  for (var attr in parameters) {
    // replace undefined values with null because we can't work with undefined values in neo4j
    this.parameters[attr] = (parameters[attr] === undefined) ? null : parameters[attr];
  }
  return this;
}

CypherQuery.prototype.addParameter = CypherQuery.prototype.addParameters;

if (typeof window === 'object') {
  window.Neo4jMapper.CypherQuery = CypherQuery;
} else {
  module.exports = exports = CypherQuery;
}