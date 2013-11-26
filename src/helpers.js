
if (typeof window === 'object') {
  var _ = window._;
} else {
  var _ = require('underscore');
}

var isConditionalOperator = /^\$(AND|OR|XOR|NOT|AND\$NOT|OR\$NOT)$/i;

var sortStringAndOptionsArguments = function(string, options) {
  if (typeof string === 'object') {
    return { string: null, options: string };
  }
  return {
    string: string || null,
    options: options || {}
  }
}

var sortOptionsAndCallbackArguments = function(options, callback) {
  if (typeof options === 'function') {
    return { options: {}, callback: options };
  }
  return {
    options: options || {},
    callback: callback
  }
}

var sortStringAndCallbackArguments = function(string, callback) {
  if (typeof string === 'function') {
    callback = string;
    string = null;
  }
  return {
    callback: callback,
    string: string
  }
}

var getIdFromObject = function(o) {
  if ((typeof o === 'object') && (!isNaN(o._id_)))
    return o._id_;
  if (!isNaN(parseInt(o)))
    return parseInt(o);
  // else
  return o.id || null;
}

// source: https://gist.github.com/penguinboy/762197
var flattenObject = function(ob) {
  var toReturn = {};

  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue;

    if ((typeof ob[i]) === 'object') {
      var flatObject = flattenObject(ob[i]);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;

        toReturn[i + '.' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
};

// source: https://github.com/hughsk/flat/blob/master/index.js
var unflattenObject = function (target, opts) {
  var opts = opts || {}
    , delimiter = opts.delimiter || '.'
    , result = {}

  if (Object.prototype.toString.call(target) !== '[object Object]') {
      return target
  }

  function getkey(key) {
      var parsedKey = parseInt(key)
      return (isNaN(parsedKey) ? key : parsedKey)
  };

  Object.keys(target).forEach(function(key) {
      var split = key.split(delimiter)
        , firstNibble
        , secondNibble
        , recipient = result

      firstNibble = getkey(split.shift())
      secondNibble = getkey(split[0])

      while (secondNibble !== undefined) {
          if (recipient[firstNibble] === undefined) {
              recipient[firstNibble] = ((typeof secondNibble === 'number') ? [] : {})
          }

          recipient = recipient[firstNibble]
          if (split.length > 0) {
              firstNibble = getkey(split.shift())
              secondNibble = getkey(split[0])
          }
      }

      // unflatten again for 'messy objects'
      recipient[firstNibble] = unflattenObject(target[key])
  });

  return result
};

var escapeString = function(s) {
  if (typeof s !== 'string')
    return s;
  // trim quotes if exists
  if ( (/^".+"$/.test(s)) || (/^'.+'$/.test(s)) )
    s = s.substr(1,s.length-2);
  return s.replace(/^(['"]{1})/, '\\$1').replace(/([^\\]){1}(['"]{1})/g,'$1\\$2');
}

var escapeIdentifier = function(identifier, delimiter) {
  if (typeof delimiter !== 'string')
    delimiter = '`';
  // remove all delimiters `
  identifier = identifier.replace(new RegExp(delimiter, 'g'), '');
  if (/^[a-z]{1}\..+$/.test(identifier))
    identifier = identifier.replace(/^([a-z]{1})\.(.+)$/, '$1.'+delimiter+'$2'+delimiter);
  else
    identifier = delimiter+identifier+delimiter;
  return identifier;
}

var valueToStringForCypherQuery = function(value, delimiter) {
  if (typeof delimiter !== 'string')
    delimiter = '';
  if ((value) && (value.constructor === RegExp)) {
    value = value.toString().replace(/^\/(\^)*(.+?)\/[ig]*$/, (value.ignoreCase) ? '$1(?i)$2' : '$1$2');
    // replace `\` with `\\` to keep compatibility with Java regex
    value = value.replace(/([^\\]{1})\\([^\\]{1})/g, '$1\\\\$2');
  } else {
    if ((typeof value === 'undefined') || (value === null) || (value === NaN))
      value = 'null';
    else if ((typeof value === 'boolean') || (typeof value === 'number'))
      value = String(value);
    else
      value = delimiter + escapeString(value) + delimiter;
  }

  return value;
}

var cypherKeyValueToString = function(key, originalValue, identifier, conditionalParametersObject) {
  var value = originalValue;
  var s = ''; // string that will be returned
  if (typeof conditionalParametersObject !== 'object')
    conditionalParametersObject = null;
  if (typeof identifier === 'string') {
    if (/^[nmr]\./.test(key))
      // we have already an identifier
      key = key;
    else if (/[\?\!]$/.test(key))
      // we have a default statement, escape without ! or ?
      key = identifier+'.`'+key.replace(/[\?\!]$/,'')+'`'+key.substring(key.length-1)
    else
      key = identifier+'.`'+key+'`';
  }
  // this.valuesToParameters
  if (_.isRegExp(value)) {
    value = valueToStringForCypherQuery(value);
    value = ((conditionalParametersObject) && (conditionalParametersObject.valuesToParameters)) ? ((conditionalParametersObject.addValue) ? conditionalParametersObject.addValue(value) : value) : "'"+value+"'";
    s = key + " =~ " + value;
  }
  else {
    // convert to string
    if ((_.isNumber(value)) || (_.isBoolean(value)))
      value = ((conditionalParametersObject) && (conditionalParametersObject.valuesToParameters)) ? ((conditionalParametersObject.addValue) ? conditionalParametersObject.addValue(value) : value) : valueToStringForCypherQuery(value);
    // else escape
    else
      value = ((conditionalParametersObject) && (conditionalParametersObject.valuesToParameters)) ? ((conditionalParametersObject.addValue) ? conditionalParametersObject.addValue(value) : value) : "'"+escapeString(value)+"'";
    s = key + " = " + value;
  }

  return s;
}

var extractAttributesFromCondition = function(condition, attributes) {
  if (typeof attributes === 'undefined')
    attributes = [];
  _.each(condition, function(value, key) {

    if (_.isObject(value)) {
      extractAttributesFromCondition(condition[key], attributes);
    }
    if ( (!isConditionalOperator.test(key)) && (/^[a-zA-Z\_\-\.]+$/.test(key)) ) {
      // remove identifiers if exists
      attributes.push(key.replace(/^[nmr]{1}\./,''));
    }
  });
  return _.uniq(attributes);
}

var constructorNameOfFunction = function(func) {
  var name = func.constructor.toString().match(/^function\s(.+?)\(/)[1];
  if (name === 'Function') {
    name = func.toString().match(/^function\s(.+)\(/)[1]
  }
  return name;
}

var isObjectLiteral = function(data) {
  return Boolean((typeof data === 'object') && (data !== null) && (typeof Object.keys(data).length === 'number'));
}

var serializeObjectForCypher = function(o, options) {
  o = this.flattenObject(o);
  var result = [];
  if (typeof options !== 'object')
    options = {};
  options = _.defaults(options, {
    identifierDelimiter: '`',
    valueDelimiter: '"',
  });
  for (var attr in o) {
    attr = attr.replace(/\`/g,'');
    result.push( options.identifierDelimiter+attr+options.identifierDelimiter+' : '+this.valueToStringForCypherQuery(o[attr], options.valueDelimiter));
  }
  return '{ '+result.join(', ')+' }';
}

var helpers = {
  sortStringAndOptionsArguments: sortStringAndOptionsArguments,
  sortOptionsAndCallbackArguments: sortOptionsAndCallbackArguments,
  sortStringAndCallbackArguments: sortStringAndCallbackArguments,
  flattenObject: flattenObject,
  unflattenObject: unflattenObject,
  extractAttributesFromCondition: extractAttributesFromCondition,
  getIdFromObject: getIdFromObject,
  escapeString: escapeString,
  escapeIdentifier: escapeIdentifier,
  constructorNameOfFunction: constructorNameOfFunction,
  cypherKeyValueToString: cypherKeyValueToString,
  valueToStringForCypherQuery: valueToStringForCypherQuery,
  md5: (typeof window === 'object') ? window.Neo4jMapper.md5 : require('./lib/md5'),
  isConditionalOperator: isConditionalOperator,
  isObjectLiteral: isObjectLiteral,
  serializeObjectForCypher: serializeObjectForCypher,
};

if (typeof window !== 'object') {
  module.exports = exports = helpers;
} else {
  window.Neo4jMapper.helpers = helpers;
}