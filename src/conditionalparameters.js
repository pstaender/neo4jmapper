/*
 * Builds a string from mongodb-like-query object
 */

if (typeof window === 'object') {
  var _ = window._;
  var helpers = window.Neo4jMapper.helpers;
} else {
  var _ = require('underscore');
  var helpers = require('./helpers');
}

var ConditionalParameters = function ConditionalParameters(conditions, options) {

  ConditionalParameters.parameterRuleset = {
    $IN: function(value) {
      var s = '';
      if ((typeof value === 'object') && (value.length > 0)) {
        for (var i=0; i < value.length; i++) {
          value[i] = (typeof value[i] === 'string') ? "'"+helpers.escapeString(value[i])+"'" : helpers.valueToStringForCypherQuery(value[i]);
        }
        s = value.join(', ');
      }
      return 'IN [ ' + s + ' ]';
    },
    $in: function(value) { return this.$IN(value); }

  };

  ConditionalParameters.prototype.addValue = function(value) {
    if (!this.parameters)
      this.parameters = {};
    var property = '_value'+(this.parametersStartCountAt + this.parametersCount())+'_';
    this.parameters[property] = value;
    return '{'+property+'}';
  }

  ConditionalParameters.prototype.values = function() {
    var values = [];
    for (var prop in this.parameters) {
      values.push(this.parameters[prop]);
    }
    return values;
  }

  ConditionalParameters.prototype.parametersCount = function() {
    if ((typeof this.parameters !== 'object')||(this.parameters === null))
      return 0;
    else
      return Object.keys(this.parameters).length;
  }

  ConditionalParameters.prototype.hasParameters = function() {
    return (this.parametersCount() > 0);
  }

  ConditionalParameters.prototype.cypherKeyValueToString = function(key, originalValue, identifier) {
    // call cypherKeyValueToString with this object context
    return helpers.cypherKeyValueToString(key, originalValue, identifier, this);
  }

  ConditionalParameters.prototype.convert = function(condition, operator) {
    if (typeof condition === 'undefined')
      condition = this.conditions;
    var options = _.extend({}, this.defaultOptions, this.options);
    if (options.firstLevel)
      options.firstLevel = false;
    if (options.parametersStartCountAt)
      this.parametersStartCountAt = options.parametersStartCountAt;
    // TODO: if $not : [ {name: 'a'}] ~> NOT (name = a)
    if (typeof condition === 'string')
      condition = [ condition ];
    if (typeof operator === 'undefined')
      operator = this.operator; // AND
    if (typeof condition === 'object')
      for (var key in condition) {
        var value = condition[key];
        var property = null;
        if (_.isObject(condition[key])) {
          var properties = [];
          var firstKey = (_.keys(value)) ? _.keys(value)[0] : null;
          if ((firstKey)&&(ConditionalParameters.is_operator.test(firstKey))) {
            properties.push(this.convert(condition[key][firstKey], firstKey.replace(/\$/g,' ').trim().toUpperCase(), options));
          } else {
            for (var k in condition[key]) {
              // k = key/property, remove identifier e.g. n.name
              var property = k.replace(/^[nmrp]\./,'');
              value = condition[key][k];

              // only check for attributes if not s.th. like `n.name? = …`
              var identifierWithProperty = (/\?$/.test(property)) ? '' : property;
              if (identifierWithProperty) {
                if (options.identifier)
                  // we have s.th. like options.identifier = n; property = '`'+identifierWithProperty+'`'
                  identifierWithProperty = options.identifier + '.' + identifierWithProperty;
                else
                  // we have no explicit identifier, so we use the complete key/property and expecting it contains identifier
                  identifierWithProperty = k;
                identifierWithProperty = helpers.escapeProperty(identifierWithProperty);
              }
              var hasAttribute = (identifierWithProperty) ? 'HAS ('+identifierWithProperty+') AND ' : '';
              if (value === k) {
                properties.push(hasAttribute+value);
              // do we have s.th. like { name: { $IN: [ … ] } }
              } else if ((typeof value === 'object')&&(value !== null)&&(Object.keys(value).length === 1)&&(typeof ConditionalParameters.parameterRuleset[Object.keys(value)[0]] === 'function')) {
                properties.push(hasAttribute+' '+(identifierWithProperty || k)+' '+ConditionalParameters.parameterRuleset[Object.keys(value)[0]](value[Object.keys(value)[0]]));
              } else {
                properties.push(hasAttribute+this.cypherKeyValueToString(k, value,
                  // only add an identifier if we have NOT s.th. like
                  // n.name = ''  or r.since …
                  (/^[a-zA-Z\_\-]+\./).test(k) ? null : options.identifier
                ));
              }
            }
          }
          // merge sub conditions
          condition[key] = properties.join(' '+operator+' ');
        }
      }

    if ((condition.length === 1)&&(options.firstLevel === false)&&(/NOT/i.test(operator)))
      return operator + ' ( '+condition.join('')+' )';
    else
      return '( '+condition.join(' '+operator+' ')+' )';
  }

  ConditionalParameters.prototype.toString = function() {
    if (this.conditions)
      this._s = this.convert();
    return this._s;
  }

  // assign parameters and option(s)
  if (typeof conditions === 'object') {
    this.conditions = (conditions) ? conditions : {};
  } else if (typeof conditions === 'string') {
    this.conditions = null;
    this._s = '( ' + conditions + ' )';
    return;
  } else {
    throw Error('First argument must be an object with conditional parameters or a plain string');
  }
  if (typeof options === 'object') {
    this.options = options;
    // assign some options if they exists to current object
    if (typeof this.options.valuesToParameters !== 'undefined')
      this.valuesToParameters = this.options.valuesToParameters;
    if (typeof this.options.identifier !== 'undefined')
      this.identifier = this.options.identifier;
    if (typeof this.options.operator !== 'undefined')
      this.operator = this.options.operator;
  }
}

ConditionalParameters.is_operator = /^\$(AND|OR|XOR|NOT|AND\$NOT|OR\$NOT)$/i;

ConditionalParameters.prototype.operator               = 'AND';
ConditionalParameters.prototype.identifier             = 'n';
ConditionalParameters.prototype.conditions             = null;

// options are used to prevent overriding object attributes on recursive calls
ConditionalParameters.prototype.options                = null;
ConditionalParameters.prototype.defaultOptions         = { firstLevel: true, identifier: null };

ConditionalParameters.prototype.parameters             = null;
ConditionalParameters.prototype.valuesToParameters     = true;
ConditionalParameters.prototype._s                     = '';
ConditionalParameters.prototype.parametersStartCountAt = 0;

if (typeof window === 'object') {
  window.Neo4jMapper.ConditionalParameters = ConditionalParameters;
} else {
  module.exports = exports = ConditionalParameters;
}