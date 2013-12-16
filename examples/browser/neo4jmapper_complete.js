;(function(){
  
  /*
   * include file: 'src/browser/browser_header.js'
   */
  /*
   * Neo4jMapper
   * (c) 2013 by Philipp Staender <philipp.staender@gmail.com>
   * Distributed under the GNU General Public License
   *
   * This file is the head file for browserside use
   *
   */
  
  "use strict";
  
  if (typeof window !== 'object')
    throw Error('This file is for browser use, not for nodejs');
  if (typeof window._ === 'undefined')
    throw Error('Include of underscore.js library is needed')
  if (typeof window.superagent === 'undefined')
    throw Error('Include of superagent library is needed')
    
  /*
   * include file: 'src/index.js'
   */
  // # Neo4jMapper
  // **(c) 2013 by Philipp Ständer <philipp.staender@gmail.com>**
  //
  // *Distributed under the GNU General Public License*
  //
  // Neo4jMapper is an **object mapper for neo4j databases**.
  
  var Neo4jMapper = function Neo4jMapper(urlOrOptions) {
  
    var _client_ = null;
  
    if (typeof window === 'object') {
      // Browser
      var Neo4jRestful  = this.Neo4jRestful  = window.Neo4jMapper.initNeo4jRestful(urlOrOptions);
  
      this.client = _client_ = new Neo4jRestful();
  
      this.Graph         = window.Neo4jMapper.initGraph(_client_);
      this.Transaction   = window.Neo4jMapper.initTransaction(_client_, this.Graph);
      this.Node          = window.Neo4jMapper.initNode(_client_, this.Graph);
      this.Relationship  = window.Neo4jMapper.initRelationship(_client_, this.Graph, this.Node);
      this.Path          = window.Neo4jMapper.initPath(_client_, this.Graph);
  
      this.helpers = window.Neo4jMapper.helpers;
      this.helpers.ConditionalParameters = window.Neo4jMapper.ConditionalParameters;
      this.helpers.CypherQuery = window.Neo4jMapper.CypherQuery;
    } else {
      // NodeJS
      var Neo4jRestful  = this.Neo4jRestful  = require('./neo4jrestful').init(urlOrOptions);
  
      this.client = _client_ = new Neo4jRestful();
  
      this.Graph         = require('./graph').init(_client_);
      this.Transaction   = require('./transaction').init(_client_);
      this.Node          = require('./node').init(_client_, this.Graph);
      this.Relationship  = require('./relationship').init(_client_, this.Graph, this.Node);
      this.Path          = require('./path').init(_client_, this.Graph);
  
      this.helpers = require('./helpers');
      this.helpers.ConditionalParameters = require('./conditionalparameters');
      this.helpers.CypherQuery = require('./cypherquery');
    }
  
    // create references among the constructors themeselves
    this.Node.Relationship          = this.Relationship;
    this.Relationship.Node          = this.Node;
    this.Neo4jRestful.Node          = this.Node;
    this.Neo4jRestful.Path          = this.Path;
    this.Neo4jRestful.Relationship  = this.Relationship;
  
  }
  
  Neo4jMapper.prototype.Node = null;
  Neo4jMapper.prototype.Relationship = null;
  Neo4jMapper.prototype.Graph = null;
  Neo4jMapper.prototype.Transaction = null;
  Neo4jMapper.prototype.Path = null;
  Neo4jMapper.prototype.Neo4jRestful = null;
  Neo4jMapper.prototype.client = null;
  Neo4jMapper.prototype.helpers = null;
  
  Neo4jMapper.init = function(urlOrOptions) {
    return new Neo4jMapper(urlOrOptions);
  }
  
  if (typeof window !== 'object') {
    module.exports = exports = Neo4jMapper;
  } else {
    window.Neo4jMapper = Neo4jMapper;
  }
    
  /*
   * include file: 'src/lib/sequence.js'
   */
  // from: https://github.com/coolaj86/futures
  ;(function() {
  
    function isSequence(obj) {
      return obj instanceof Sequence;
    }
  
    function Sequence(global_context) {
      var self = this,
        waiting = true,
        data,
        stack = [];
  
      if (!isSequence(this)) {
        return new Sequence(global_context);
      }
  
      global_context = global_context || null;
  
      function next() {
        var args = Array.prototype.slice.call(arguments),
          seq = stack.shift(); // BUG this will eventually leak
  
        data = arguments;
  
        if (!seq) {
          // the chain has ended (for now)
          waiting = true;
          return;
        }
  
        args.unshift(next);
        seq.callback.apply(seq._context, args);
      }
  
      function then(callback, context) {
        if ('function' !== typeof callback) {
          throw new Error("`Sequence().then(callback [context])` requires that `callback` be a function and that `context` be `null`, an object, or a function");
        }
        stack.push({
          callback: callback,
          _context: (null === context ? null : context || global_context),
          index: stack.length
        });
  
        // if the chain has stopped, start it back up
        if (waiting) {
          waiting = false;
          next.apply(null, data);
        }
  
        return self;
      }
  
      self.next = next;
      self.then = then;
    }
  
    function createSequence(context) {
      // TODO use prototype instead of new
      return (new Sequence(context));
    }
    Sequence.create = createSequence;
    Sequence.isSequence = isSequence;
  
    if (typeof window === 'object')
      window.Sequence = Sequence;
    else
      module.exports = Sequence;
      
  })();  
  /*
   * include file: 'src/lib/md5.js'
   */
  // source: https://gist.github.com/aredo/3001685
  var md5 = function (string) {
  
    function RotateLeft(lValue, iShiftBits) {
     return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
    }
  
    function AddUnsigned(lX,lY) {
      var lX4,lY4,lX8,lY8,lResult;
      lX8 = (lX & 0x80000000);
      lY8 = (lY & 0x80000000);
      lX4 = (lX & 0x40000000);
      lY4 = (lY & 0x40000000);
      lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
      if (lX4 & lY4) {
        return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      }
      if (lX4 | lY4) {
        if (lResult & 0x40000000) {
          return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        } else {
          return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        }
      } else {
        return (lResult ^ lX8 ^ lY8);
      }
    }
  
    function F(x,y,z) { return (x & y) | ((~x) & z); }
    function G(x,y,z) { return (x & z) | (y & (~z)); }
    function H(x,y,z) { return (x ^ y ^ z); }
    function I(x,y,z) { return (y ^ (x | (~z))); }
  
    function FF(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    };
  
    function GG(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    };
  
    function HH(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    };
  
    function II(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    };
  
    function ConvertToWordArray(string) {
      var lWordCount;
      var lMessageLength = string.length;
      var lNumberOfWords_temp1=lMessageLength + 8;
      var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
      var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
      var lWordArray=Array(lNumberOfWords-1);
      var lBytePosition = 0;
      var lByteCount = 0;
      while ( lByteCount < lMessageLength ) {
        lWordCount = (lByteCount-(lByteCount % 4))/4;
        lBytePosition = (lByteCount % 4)*8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount-(lByteCount % 4))/4;
      lBytePosition = (lByteCount % 4)*8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
      lWordArray[lNumberOfWords-2] = lMessageLength<<3;
      lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
      return lWordArray;
    };
  
    function WordToHex(lValue) {
      var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
      for (lCount = 0;lCount<=3;lCount++) {
        lByte = (lValue>>>(lCount*8)) & 255;
        WordToHexValue_temp = "0" + lByte.toString(16);
        WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
      }
      return WordToHexValue;
    };
  
    function Utf8Encode(string) {
      string = string.replace(/\r\n/g,"\n");
      var utftext = "";
  
      for (var n = 0; n < string.length; n++) {
  
        var c = string.charCodeAt(n);
  
        if (c < 128) {
          utftext += String.fromCharCode(c);
        }
        else if((c > 127) && (c < 2048)) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }
  
      }
  
      return utftext;
    };
  
    var x=Array();
    var k,AA,BB,CC,DD,a,b,c,d;
    var S11=7, S12=12, S13=17, S14=22;
    var S21=5, S22=9 , S23=14, S24=20;
    var S31=4, S32=11, S33=16, S34=23;
    var S41=6, S42=10, S43=15, S44=21;
  
    string = Utf8Encode(string);
  
    x = ConvertToWordArray(string);
  
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
  
    for (k=0;k<x.length;k+=16) {
      AA=a; BB=b; CC=c; DD=d;
      a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
      d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
      c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
      b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
      a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
      d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
      c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
      b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
      a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
      d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
      c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
      b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
      a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
      d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
      c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
      b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
      a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
      d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
      c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
      b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
      a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
      d=GG(d,a,b,c,x[k+10],S22,0x2441453);
      c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
      b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
      a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
      d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
      c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
      b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
      a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
      d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
      c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
      b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
      a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
      d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
      c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
      b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
      a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
      d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
      c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
      b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
      a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
      d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
      c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
      b=HH(b,c,d,a,x[k+6], S34,0x4881D05);
      a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
      d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
      c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
      b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
      a=II(a,b,c,d,x[k+0], S41,0xF4292244);
      d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
      c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
      b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
      a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
      d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
      c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
      b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
      a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
      d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
      c=II(c,d,a,b,x[k+6], S43,0xA3014314);
      b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
      a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
      d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
      c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
      b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
      a=AddUnsigned(a,AA);
      b=AddUnsigned(b,BB);
      c=AddUnsigned(c,CC);
      d=AddUnsigned(d,DD);
    }
  
    var temp = WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);
  
    return temp.toLowerCase();
  }
  
  if (typeof window === 'object') {
    window.Neo4jMapper.md5 = md5;
  } else {
    module.exports = exports = md5;
  }  
  /*
   * include file: 'src/helpers.js'
   */
  
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
  var flattenObject = function(ob, keepNullValues) {
    var toReturn = {};
    if (typeof keepNullValues !== 'boolean')
      keepNullValues = true;
    for (var i in ob) {
      if (!ob.hasOwnProperty(i))
        continue;
      if ((keepNullValues) && (ob[i] === null)) {
        toReturn[i] = ob[i];
      } else if ((typeof ob[i]) === 'object') {
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
  
  var escapeProperty = function(identifier, delimiter) {
    if (typeof delimiter !== 'string')
      delimiter = '`';
    // do we have s.th. like ?! appending
    var appending = identifier.match(/^(.*)([\?\!]{1})$/) || '';
    // console.log(appending)
    if ((appending)&&(appending[2])) {
      identifier = appending[1];
      appending = appending[2];
    }
    // no escaping if last char is a delimiter or ?, because we expect that the identifier is already escaped somehow
    if (new RegExp(''+delimiter+'{1}$').test(identifier))
      return identifier;
    // remove all delimiters `
    identifier = identifier.replace(new RegExp(delimiter, 'g'), '');
    if (/^(.+?)\..+$/.test(identifier))
      identifier = identifier.replace(/^(.+?)\.(.+)$/, '$1.'+delimiter+'$2'+delimiter);
    else
      identifier = delimiter+identifier+delimiter;
    return identifier + appending;
  }
  
  var valueToStringForCypherQuery = function(value, delimiter) {
    if (typeof delimiter !== 'string')
      delimiter = '';
    if ((value) && (value.constructor === RegExp)) {
      value = value.toString().replace(/^\/(\^)*(.+?)\/[ig]*$/, (value.ignoreCase) ? '$1(?i)$2' : '$1$2');
      // replace `\` with `\\` to keep compatibility with Java regex
      value = value.replace(/([^\\]{1})\\([^\\]{1})/g, '$1\\\\$2');
    } else {
      if ((typeof value === 'undefined') || (value === null))
        value = 'NULL';
      else if (value === NaN)
        // what would be a good representation of NaN?
        value = delimiter+'NaN'+delimiter;
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
        key = identifier+'.'+key;
      else
        key = identifier+'.'+key;
    }
    key = escapeProperty(key)
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
      valueDelimiter: "'",
    });
    for (var attr in o) {
      var value = o[attr];
      result.push(escapeProperty(attr)+' : '+valueToStringForCypherQuery(value, options.valueDelimiter));
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
    escapeProperty: escapeProperty,
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
  /*
   * include file: 'src/conditionalparameters.js'
   */
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
  /*
   * include file: 'src/cypherquery.js'
   */
  
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
  /*
   * include file: 'src/neo4jrestful.js'
   */
  
  var __initNeo4jRestful__ = function(urlOrOptions) {
  
    // will be set with environment depending values below
    var helpers                    = null;
    var _                          = null;
    var jQuery                     = null;
    var Sequence                   = null;
    var JSONStream                 = null;
    var request                    = null;
    var __established_connection__ = {};    // a flag of all different db connections (differs by url)
  
    if (typeof window === 'object') {
      // browser
      helpers      = window.Neo4jMapper.helpers;
      _            = window._;
      jQuery       = window.jQuery;
      Sequence     = window.Sequence;
      request      = window.superagent;
    } else {
      // nodejs
      helpers      = require('./helpers');
      _            = require('underscore');
      jQuery       = null;
      Sequence     = require('./lib/sequence');
      request      = require('request');
      JSONStream   = require('JSONStream');
    }
  
    var ResponseError = function ResponseError(message, code) {
      var e = new Error(message);
      e.code = code;
      return e;
    }
  
    ResponseError.prototype.code = 0;
  
    // Base for QueryError and CypherQueryError
    var CustomError = function CustomError(message) {
      if (typeof message === 'string')
        this.message = message;
    }
  
    CustomError.prototype.message = '';
    CustomError.prototype.name = '';
    CustomError.prototype.exception = null;
    CustomError.prototype.cypher = null;
    CustomError.prototype.stacktrace = null;
    CustomError.prototype.statusCode = null;
    CustomError.prototype.method = null;
    CustomError.prototype.url = null;
    CustomError.prototype.data = null;
  
    // will be used to debug request+response
    var RequestDebug = function RequestDebug(obj) {
      // apply given data to current object
      if ((typeof obj === 'object') && (obj))
        for (var key in obj)
          this[key] = obj[key];
    }
  
    RequestDebug.prototype.options        = null;
    RequestDebug.prototype.requested_url  = '';
    RequestDebug.prototype.method         = '';
    RequestDebug.prototype.header         = null;
    RequestDebug.prototype.res            = null;
    RequestDebug.prototype.status         = null;
    RequestDebug.prototype.err            = null;
    RequestDebug.prototype.responseTime   = null;
  
    var QueryError = function(message, options, name) {
      var error = new CustomError(message);
      error.name = (typeof name === 'string') ? name : "QueryError";
      if (typeof options === 'object') {
        error = _.extend(error, options);
      }
    }
  
    var CypherQueryError = function(message, options) {
      var error = QueryError(message, options, 'CypherQueryError');
      return _.extend(this, error);
    }
  
    /*
     * Constructor
     */
    var Neo4jRestful = function Neo4jRestful(url, options) {
      var self = this;
      var urlPattern = /^(http(s)*)\:\/\/((.+?)\:(.+?)\@)*(.+?)(\:([0-9]+)?)\/(.+)*$/i;
      var urlMatches = null;
      if (typeof url === 'undefined') {
        // use global
        url = urlOrOptions;
      }
      if (typeof options !== 'object') {
        options = (typeof url === 'object') ? url : {};
      }
      if (typeof url === 'string') {
        options.url = url;
      }
      if (typeof options.url === 'string') {
        // check url
        // ensure one trailing slash
        options.url = options.url.replace(/\/*$/, '/');
        // stop here if we don't have a valid url
        if (!urlPattern.test(options.url)) {
          var message = "Your URL ("+url+") needs to match the default url pattern 'http(s)://(username:password@)domain(:port)/(endpoint)…'";
          throw Error(message);
        }
        // extract all parts from the given url
        // TODO: use extractet Options
        urlMatches = options.url.match(urlPattern);
        this.urlOptions = _.defaults({
          'protocol': urlMatches[1],
          'user': urlMatches[4],
          'password': urlMatches[5],
          'domain': urlMatches[6],
          'port': urlMatches[8],
          'endpoint': urlMatches[9]
        }, this.urlOptions);
        if (this.urlOptions.endpoint) {
          // strip preceding slash(es)
          this.urlOptions.endpoint = this.urlOptions.endpoint.replace(/^\/+/, '');
        }
      } else {
        throw Error('No url found. Argument must be either an URL as string or an option object including an `.url` property.');
      }
  
      // we may have an error handler in options, if so, assign it to this object
      if (typeof options.onConnectionError === 'function') {
        this.onConnectionError = options.onConnectionError;
      }
  
      // copy header
      self.header = _.extend({}, Neo4jRestful.prototype.header);
  
      if (!__established_connection__[this.absoluteUrl('/')])
        self.checkAvailability();
    }
  
    Neo4jRestful.RequestDebug = RequestDebug;
    Neo4jRestful.CustomError  = CustomError;
  
    Neo4jRestful.prototype.options                    = null;
    // template for the header of each request to neo4j
    Neo4jRestful.prototype.header = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    Neo4jRestful.prototype.timeout                    = 5000;
    Neo4jRestful.prototype.exact_version              = null;
    Neo4jRestful.prototype.version                    = null;
    Neo4jRestful.prototype.ignore_exception_pattern   = /^(Node|Relationship)NotFoundException$/; // in some case we will ignore exceptions from neo4j, e.g. not found
    Neo4jRestful.prototype.urlOptions = {
      protocol: 'http',
      domain: 'localhost',
      port: 7474,
      user: '',
      password: '',
      endpoint: 'db/data/'
    };
  
    // is used for measurement of request-to-respond
    Neo4jRestful.prototype._request_on_               = null;
    Neo4jRestful.prototype._response_on_              = null;
    // contains data of the response
    Neo4jRestful.prototype._response_                 = null;
    Neo4jRestful.prototype._columns_                  = null;
    Neo4jRestful.prototype._detectTypesOnColumns_     = false; // n AS `(Node)`, labels(n) AS `(Node.id)`, r AS `[Relationship]`
    Neo4jRestful.prototype._debug_                    = null;
  
    Neo4jRestful.prototype.query = function(cypher, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
      if (typeof cypher !== 'string') {
        throw Error('cypher argument has to be a string');
      } else {
        this.log('**info**', 'cypher:', cypher.trim().replace(/\s+/g,' '));
        this.post('/'+this.urlOptions.endpoint+'cypher',{
          data: {
            query: cypher,
            params: options.params || {}
          }
        }, function(err, result, debug){
          return cb(err, result, debug);
        });
      }
    }
  
    // http://docs.neo4j.org/chunked/preview/rest-api-transactional.html
    Neo4jRestful.prototype.statement = function() {
      throw Error('Not implemented, yet');
    }
  
    Neo4jRestful.prototype.checkAvailability = function(cb) {
      var self = this;
      this._sendHttpRequest({
        method: 'GET',
        url: self.absoluteUrl('/'),
        timeout: self.timeout
      }, function(err, res) {
          var body = (res) ? res.body : null;
          if ((typeof res !== 'undefined') && (res.status === 200)&&(body)&&(body.neo4j_version)) {
            self.exact_version = body.neo4j_version;
            self.version = Number(self.exact_version.replace(/^([0-9]+\.*[0-9]*)(.*)$/, '$1'));
            var error = (self.version < 2) ? Error('Neo4jMapper is not build+tested for neo4j version below v2') : null;
            __established_connection__[self.absoluteUrl('/')] = true;
            if (typeof cb === 'function')
              cb(error, body.neo4j_version);
          } else {
            __established_connection__[self.absoluteUrl('/')] = false;
            self.onConnectionError(Error("Can't detect neo4j… Sure neo4j service is available on "+self.absoluteUrl('/')+"? "+((err) ? '('+err.message+')' : '')), self);
          }
        }
      );
      return this;
    }
  
    Neo4jRestful.prototype.absoluteUrl = function(url) {
      if (typeof url !== 'string')
        url = '';
      if (!url)
        url = this.url || '/';
      if (url) {
        var baseUrl = this._connectionString();
        // strip redundant endpoints if they exists
        return baseUrl + url.replace(/^\/+/, '').replace(new RegExp('^'+this.urlOptions.endpoint.split('/').join('\\/')+'*'), '');
      }
    }
  
    Neo4jRestful.prototype._connectionString = function() {
      return this.urlOptions.protocol + '://'
        + String(((this.urlOptions.user)&&(this.urlOptions.password)) ? this.urlOptions.user + ':' + this.urlOptions.password+'@' : '' )
        + this.urlOptions.domain
        + ':' + this.urlOptions.port
        + '/' + this.urlOptions.endpoint;
    }
  
    Neo4jRestful.prototype.request = function(url, options, cb) {
      var debug = null; // debug object
      if (typeof options === 'undefined')
        options = {};
  
      // apply default options
      _.defaults(options, {
        method: 'GET',
        data: null,
        debug: false,
        // use copy of header, not reference
        header: _.extend({},this.header)
      });
  
      if (typeof url !== 'string') {
  
        throw Error("First argument 'url' hast to be a string");
  
      }
  
      this.url = options.url = url;
      this.header = options.header;
  
      var requestedUrl = this.absoluteUrl();
      var data = options.data;
  
      if ( (typeof data === 'object') && (data !== null) )
       data = JSON.stringify(options.data);
  
      // create debug object
      this._debug_ = new RequestDebug({
        options: options,
        requested_url: requestedUrl,
        method: options.method,
        data: data,
        header: this.header,
        res: null,
        status: null,
        err: null
      });
  
      // options for makeRequest()
      var _options_ = {
        requestedUrl: requestedUrl,
        method: options.method,
        data: data,
        options: options,
        debug: debug,
        url: url
      };
  
      return this._makeRequest(_options_, cb);
    }
  
    Neo4jRestful.prototype._makeRequest = function(_options_, cb) {
      var self = this;
      // apply default options on options
      _.defaults(_options_, {
        cache: false,
        timeout: this.timeout,
        loadNode: true // enables the load hooks
      });
  
      // create final options object from _options_.options
      var options = _options_.options;
  
      options.absolute_url = _options_.requestedUrl;
      options.url = _options_.url;
      options.method = _options_.method;
      options.data = _options_.data;
  
      this.log('**debug**', 'URI:', options.method+":"+options.url+" ("+options.absolute_url+")");
      this.log('**debug**', 'sendedData:', options.data);
      this.log('**debug**', 'sendedHeader:', self.header);
  
      this._request_on_ = new Date().getTime();
  
      var requestOptions = {
        method: options.method,
        url: options.absolute_url,
        header: self.header
      };
  
      if (options.data)
        requestOptions.data = options.data;
  
      // stream
      if (this.header['X-Stream'] === 'true') {
  
        var stream = JSONStream.parse([/^columns|data$/, true]);
  
        var isDataColumn = false;
        self._columns_ = [];
  
        stream.on('data', function(data) {
          // detect column and data array
          // { columns: [ '1', … , 'n' ], data: [ [ … ] ] }
          if (isDataColumn) {
            return cb(data);
          } else if (data) {
            if (data.constructor === Array) {
              isDataColumn = true;
              return cb(data);
            } else {
              self._columns_.push(data);
              return;
            }
          }
        });
  
        stream.on('end', function() {
          // prevent to pass undefined, but maybe an undefined is more clear
          cb(null, null);
        });
  
        stream.on('root', function(root, count) {
          self._response_on_ = new Date().getTime();
          // remove x-stream from header
          delete self.header['X-Stream'];
          if (!count) {
            cb(null, Error('No matches in stream found ('+ root +')'), self._de);
          }
        });
  
        requestOptions.stream = stream;
  
      }
  
      // now finally send the request
      this._sendHttpRequest(requestOptions, function(err, res) {
        self._response_ = res;
        self._response_on_ = new Date().getTime();
  
        self._debug_.responseTime = self.responseTime();
  
        if (err) {
          self.onError(cb, err, 'error', options);
        } else {
          // we might have a reponse with a failure status code
          if (res.status >= 400) {
            self.onError(cb, res.body, 'error', options);
          } else {
            if (res.body)
              self._columns_ = res.body.columns || null;
            self.onSuccess(cb, res.body, 'success', options);
          }
        }
      });
  
    }
  
    // ### Wrapper for superagent and request
    // Private method, can be indirectly 'accessed' via neo4jrestful.get|post|delete|put or neo4jrestfule.request
    Neo4jRestful.prototype._sendHttpRequest = function(options, cb) {
      _.defaults(options, {
        header: {},
        data: null,
        method: 'GET',
        timeout: null,
        stream: false
      });
      var isBrowser = Boolean(typeof window === 'object');
      if (typeof cb !== 'function')
        throw Error('Callback as 2nd argument is mandatory');
      if ((typeof options !== 'object')||(!options.url))
        cb(Error("Set { url: '…' } as argument"));
      if (isBrowser) {
        // ### superagent for browserside usage
        var req = window.superagent(options.method, options.url).set(options.header);
        if (options.data)
          req.send(options.data);
        if (options.stream) {
          return req.pipe(options.stream);
        } else {
          return req.end(function(err, res) {
            // compatibility of superagent to response api
            if (typeof res === 'object') {
              res.statusCode = res.status;
            }
            return cb(err, res);
          });
        }
  
      } else {
        // ### request module for nodejs
        var req = request;
        options.json = true;
        if (options.data) {
          if (typeof options.data === 'string')
            options.body = options.data;
          else
            options.json = options.data;
        }
        if (options.stream) {
          return req(options).pipe(options.stream);
        } else {
          return req(options, function(err, res) {
            // compatibility of response to superagent api
            if (typeof res === 'object') {
              res.status = res.statusCode;
            }
            return cb(err, res);
          });
        }
      }
    }
  
    Neo4jRestful.prototype.onProcess = function(res, cb, debug) {
      if (!res) {
        // return here if no response is present
        return cb(null, res, debug);
      } else if (_.isArray(res)) {
        for (var i=0; i < res.length; i++) {
          res[i] = this.createObjectFromResponseData(res[i]);
        }
      } else if ( (res.data) && (_.isArray(res.data)) ) {
        // iterate throught res.data rows + columns
        // an try to detect Node, Relationships + Path objects
        for (var row=0; row < res.data.length; row++) {
          for (var column=0; column < res.data[row].length; column++) {
            res.data[row][column] = this.createObjectFromResponseData(res.data[row][column]);
          }
        }
  
      } else if (_.isObject(res)) {
        res = this.createObjectFromResponseData(res);
      }
      cb(null, res, debug);
    }
  
    Neo4jRestful.prototype.onProcessStream = function(res, cb, debug) {
      if (res) {
        for (var column=0; column < res.length; column++) {
          res[column] = this.createObjectFromResponseData(res[column]);
        }
      }
      cb(null, res, debug);
    }
  
    Neo4jRestful.prototype.onSuccess = function(cb, res, status) {
  
      this._debug_.res = res;
      this._debug_.status = status;
  
      if (status === 'success') {
        if (typeof this.onProcess === 'function')
          return this.onProcess(res, cb, this._debug_);
        else
          return cb(null, res, this._debug_);
      } else {
        cb(res, status, this._debug_);
      }
    }
  
    Neo4jRestful.prototype.onError = function(cb, responseError, res, options) {
      // in some (rare) case, we get an empty {} as error
      if ( (responseError) && (typeof responseError === 'object') && (Object.keys(responseError).length === 0) ) {
        return cb(null, res.body || null, this._debug_);
      }
      var err = responseError;
      var self = this;
      var statusCode = (this._response_) ? this._response_.status : null;
      var error = ( err && err.responseText ) ? Error(err.responseText) : err;
      if (!error) {
        // TODO: code with description
        var errDescription = 'Response Error ('+this._response_.status+')';
        error = new ResponseError(errDescription, this._response_.status);
      }
  
      this._debug_.res = res;
      this._debug_.err = err;
      this._debug_.error = error;
  
      try {
        // jquery is an optional feature since superagent
        if (jQuery) {
          // try to extract the first <p> or <pre> from html body, else return error object for better debugging
          if (jQuery(err.responseText).find('body pre:first, body p:first')[0])
            err.responseText = jQuery(err.responseText).find('body pre:first, body p:first').first().text().trim().replace(/(\s|\n)+/g,' ');
          else if (jQuery(err.responseText).text()) {
            err.responseText = jQuery(err.responseText).text().trim();
          }
        } else {
          // remove all tags to get plain message
          // TODO: find a real jQuery replacement
          err.responseText = err.responseText.replace(/(<([^>]+)>)/ig,'').trim();
        }
      } catch(e) {
        // ignore exception
      }
      // try to create a valuable error object from response
      if ((err)&&(err.responseText)&&(typeof err.responseText === 'string')) {
        try {
          var err = JSON.parse(err.responseText);
          var ErrorHandler = (/^(\/)*db\/data(\/)*$/.test(options.url)) ? CypherQueryError : QueryError;
          err = new ErrorHandler(err.message, {
            stacktrace: err.stacktrace,
            exception: err.exception,
            statusCode: statusCode,
            url: options.url,
            method: options.method,
            data: data
          });
        } catch (e) {
          self.log('**debug** Could not create/parse a valuable error object', e);
        }
      }
      if ( (err) && (err.exception) && (self.ignore_exception_pattern) && (self.ignore_exception_pattern.test(err.exception)) ) {
        // we ignore by default notfound exceptions, because they are no "syntactical" errors
        return cb(null, null, this._debug_);
      } else {
        return cb(err || error, null, this._debug_);
      }
    }
  
    Neo4jRestful.prototype.stream = function(cypher, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
      this.header['X-Stream'] = 'true';
      var self = this;
      var todo = 0;
      var done = 0;
  
      if (typeof cypher !== 'string')
        throw Error('cypher argument has to be a string');
  
      return this.query(cypher, options, function(data) {
        if (data) {
          if (typeof self.onProcessStream === 'function') {
            todo++;
            self.onProcessStream(data, function(err, data) {
              if ( (data) && (data.length === 1) )
                data = data[0];
              if (done >= todo) {
                // done
                cb(data, self);
                return cb(null, self, self._debug_);
              } else {
                return cb(data, self, self._debug_);
              }
            })
          } else {
            return cb(data, self, self._debug_);
          }
        } else {
          return cb(null, self, self._debug_);
        }
      });
    }
  
    Neo4jRestful.prototype.get = function(url, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.method = 'GET' ) );
      return this.request(url, options, cb);
    }
  
    Neo4jRestful.prototype.post = function(url, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.method = 'POST' ) );
      return this.request(url, options, cb);
    }
    Neo4jRestful.prototype.put = function(url, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.method = 'PUT' ) );
      return this.request(url, options, cb);
    }
  
    Neo4jRestful.prototype.delete = function(url, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.method = 'DELETE' ) );
      return this.request(url, options, cb);
    }
  
    Neo4jRestful.prototype.log = function(){ /* > /dev/null */ };
  
    Neo4jRestful.prototype.createObjectFromResponseData = function(responseData, Class) {
      if ((responseData === null) || (responseData === ''))
        return null;
      var uri = (responseData) ? responseData.self : null;
      var Node = Neo4jRestful.Node;
      var Relationship = Neo4jRestful.Relationship;
      var Path = Neo4jRestful.Path;
      if (typeof Class !== 'function')
        Class = Node;
      if (uri) {
        if (/\/db\/data\/node\/[0-9]+\/*$/.test(uri)) {
          // we have a node or an inheriated class
          var n = new Class();
          n = n.populateWithDataFromResponse(responseData);
          return n;
        } else if (/\/db\/data\/relationship\/[0-9]+\/*$/.test(uri)) {
          // we have a relationship
          var r = new Relationship();
          r = r.populateWithDataFromResponse(responseData);
          return r;
        }
      }
      else {
        if ((_.isNumber(responseData.length))&&(_.isString(responseData.start))) {
          // we have a path
          var p = new Path();
          p = p.populateWithDataFromResponse(responseData);
          return p;
        }
      }
      return responseData;
    }
  
    Neo4jRestful.prototype.responseTime = function() {
      if ((this._request_on_ > 0) && (this._response_on_ > 0)) {
        return this._response_on_ - this._request_on_;
      } else {
        return null;
      }
    }
  
    Neo4jRestful.prototype.responseTimeAsString = function() {
      var time = this.responseTime();
      if (time) {
        return Math.floor(time/10)/100 + '[s]';
      } else {
        return '';
      }
    }
  
    Neo4jRestful.prototype.onConnectionError = function(/* err, self */) {
      // overwrite with your own function to decide what to do if no connection can be established
      /* /dev/null */
    }
  
    Neo4jRestful.prototype.singleton = function() {
      // creates a new instanced copy of this client
      return new Neo4jRestful(this._connectionString());
    }
  
    Neo4jRestful.create = function(url, options) {
      return new Neo4jRestful(url, options);
    }
  
    if (typeof window === 'object')
      window.Neo4jRestful = Neo4jRestful;
  
    return Neo4jRestful;
  };
  
  if (typeof window !== 'object') {
    // nodejs
    module.exports = exports = {
      init: __initNeo4jRestful__
    };
  } else {
    window.Neo4jMapper.initNeo4jRestful = __initNeo4jRestful__;
  }
    
  /*
   * include file: 'src/node.js'
   */
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
      if (!helpers.isObjectLiteral(data)) {
        cb(Error('To perform an update you need to pass valid data for updating as first argument'), null);
      }
      else if (this.hasId()) {
        if (typeof cb !== 'function')
          throw Error('To perform an .update() on an instanced node, you have to give a cb as argument');
        this.findById(this._id_).update(data, cb);
        return this;
      } else {
        data = helpers.flattenObject(data);
        this.cypher.segments.set = [];
        for (var attribute in data) {
          this.addSetDefinition(attribute, data[attribute]);
        }
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
      if (this.hasId())
        return cb(Error('To delete a node, use remove(). delete() is for queries'),null);
      if (this.cypher.segments.limit)
        throw Error("You can't use a limit on a DELETE, use WHERE instead to specify your limit");
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
        Node.prototype.findById(this.id)[direction+'Relations']().delete(cb);
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
      var self = this;
      if (!self._is_singleton_)
        self = this.singleton(undefined, this);
      var id = Number(id);
      if (isNaN(id))
        throw Error('You have to use a number as id argument');
      self._query_history_.push({ findById: id });
      if (typeof cb === 'function') {
        var nodeSingleton = this.constructor.create().setId(id);
        if (!this.load)
          nodeSingleton.disableLoading();
        nodeSingleton.exec(function(err, found, debug) {
          if ((err)&&(err.exception === 'EntityNotFoundException')) {
            return cb(null, null, debug);
          } else if (found) {
            found = found[0];
          }
          cb(err, found, debug);
        });
        return this;
      } else {
        self.cypher.segments.by_id = Number(id);
        return self.findByKeyValue({ id: id }, cb);
      }
    }
  
    Node.prototype.findByKeyValue = function(key, value, cb, _limit_) {
      var self = this;
      if (typeof _limit_ === 'undefined')
        _limit_ = null;
      if (!self._is_singleton_)
        self = this.singleton(undefined, this);
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
        self._query_history_.push({ findByKeyValue: true });
        var identifier = self.cypher.segments.node_identifier || self.__TYPE_IDENTIFIER__;
        if (self.cypher.segments.return_properties.length === 0)
          self.cypher.segments.return_properties = [ identifier ];
        if (key !== 'id') {
          var query = {};
          query[key] = value;
          self.where(query);
          if (self.label)
            self.withLabel(self.label);
          // if we have an id: value, we will build the query in prepareQuery
        }
        if (typeof cb === 'function') {
          return self.exec(function(err,found){
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
      return self;
    }
  
    Node.prototype.findOneByKeyValue = function(key, value, cb) {
      return this.findByKeyValue(key, value, cb, 1);
    }
  
    Node.prototype.findAll = function(cb) {
      var self = this;
      if (!self._is_singleton_) {
        self = this.singleton(undefined, this);
      }
      self._query_history_.push({ findAll: true });
      self.cypher.segments.limit = null;
      self.cypher.segments.return_properties = ['n'];
      if (self.label)
        self.withLabel(self.label);
      return self.exec(cb);
    }
  
    Node.prototype.findOrCreate = function(where, cb) {
      var self = this;
      this.find(where).count(function(err, count, debug) {
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
      return this.prototype.find(where, cb);
    }
  
    Node.findAll = function(cb) {
      return this.prototype.findAll(cb);
    }
  
    Node.findById = function(id, cb) {
      return this.prototype.findById(id, cb);
    }
  
    Node.findOne = function(where, cb) {
      return this.prototype.findOne(where, cb);
    }
  
    Node.find = function(where, cb) {
      return this.prototype.find(where, cb);
    }
  
    Node.findOrCreate = function(where, cb) {
      return this.prototype.findOrCreate(where, cb);
    }
  
    Node.findByKeyValue = function(key, value, cb) {
      return this.prototype.findByKeyValue(key, value, cb);
    }
  
    Node.findOneByKeyValue = function(key, value, cb) {
      return this.prototype.findOneByKeyValue(key, value, cb);
    }
  
    Node.start = function(start, cb) {
      return this.prototype.start(start, cb);
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
    
  /*
   * include file: 'src/path.js'
   */
  // # Path
  // Path Object represents a path between two Nodes
  var __initPath__ = function(neo4jrestful) {
  
    var helpers = null
      , _       = null
  
    if (typeof window === 'object') {
      // browser
      helpers = window.Neo4jMapper.helpers;
      _       = window._;
    } else {
      // nodejs
      helpers = require('./helpers')
      _       = require('underscore');
    }
  
    // Constructor of Path
    var Path = function Path() {
      this.nodes = [];
      this.relationships = [];
      this.from = {
        id: null,
        uri: null
      };
      this.to = {
        id: null,
        uri: null
      };
      this._is_instanced_ = true;
    }
  
    Path.prototype.classification   = 'Path';   // only needed for toObject()
    Path.prototype.from             = null;
    Path.prototype.to               = null;
    Path.prototype.start            = null;
    Path.prototype.end              = null;
    Path.prototype.length           = 0;
    Path.prototype.relationships    = null;
    Path.prototype.nodes            = null;
    Path.prototype._response_       = null;
    Path.prototype._is_singleton_   = false;
    Path.prototype._is_persisted_   = false;
    Path.prototype._is_instanced_   = null;
  
    Path.prototype.singleton = function() {
      var path = new Path();
      path._is_singleton_ = true;
      return path;
    }
  
    /*
    [
      { start: 'http://localhost:7419/db/data/node/1019',
        nodes:
         [ 'http://localhost:7419/db/data/node/1019',
           'http://localhost:7419/db/data/node/1020',
           'http://localhost:7419/db/data/node/1021' ],
        length: 2,
        relationships:
         [ 'http://localhost:7419/db/data/relationship/315',
           'http://localhost:7419/db/data/relationship/316' ],
        end: 'http://localhost:7419/db/data/node/1021' } ]
    */
    Path.prototype.populateWithDataFromResponse = function(data) {
      // if we are working on the prototype object
      // we won't mutate it and create a new path instance insetad
      var path = (this._is_instanced_ !== null) ? this : new Path();
      if (data) {
        if (_.isObject(data) && (!_.isArray(data)))
          path._response_ = data;
        else
          path._response_ = data[0];
  
        if (_.isArray(data.nodes)) {
          for (var i=0; i < data.nodes.length; i++) {
            var url = data.nodes[i];
            if (/[0-9]+$/.test(url))
              data.nodes[i] = {
                uri: url,
                id: Number(url.match(/[0-9]+$/)[0])
              }
          }
        }
  
        path.nodes = _.extend(data.nodes);
  
        if (_.isArray(data.relationships)) {
          for (var i=0; i < data.relationships.length; i++) {
            var url = data.relationships[i];
            if (/[0-9]+$/.test(url))
              data.relationships[i] = {
                uri: url,
                id: Number(url.match(/[0-9]+$/)[0])
              }
          }
        }
  
        path.relationships = _.extend(data.relationships);
  
        path.from = {
          id: Number(data.start.match(/[0-9]+$/)[0]),
          uri: data.start
        }
  
        path.to = {
          id: Number(data.end.match(/[0-9]+$/)[0]),
          uri: data.end
        }
  
        path.start = data.start;
        path.end = data.end;
        path.length = data.length;
  
      }
      path._is_persisted_ = true;
      return path;
    }
  
    Path.prototype.load = function(cb) {
      cb(null, this);
    }
  
    Path.prototype.toObject = function() {
      return {
        classification: this.classification,
        start: this.start,
        end: this.end,
        from: _.extend(this.from),
        to: _.extend(this.to),
        relationships: _.extend(this.relationships),
        nodes: _.extend(this.nodes)
      };
    }
  
    Path.prototype.resetQuery = function() { return this; }
  
    Path.new = function() {
      return new Path();
    }
  
    Path.create = Path.new;
  
    return neo4jrestful.Path = Path;
  }
  
  if (typeof window !== 'object') {
    module.exports = exports = {
      init: __initPath__
    };
  } else {
    window.Neo4jMapper.initPath = __initPath__;
  }  
  /*
   * include file: 'src/relationship.js'
   */
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
  
    Relationship.prototype.singleton = function() {
      var relationship = new Relationship();
      relationship._is_singleton_ = true;
      // relationship.resetQuery();
      return relationship;
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
      if (!self._is_singleton_)
        self = this.singleton(undefined, this);
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
          Relationship.Node.findById(self[point].id,function(err,node) {
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
      return this.prototype.findById(id, cb);
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
    
  /*
   * include file: 'src/transaction.js'
   */
  // # Transaction
  // Can be used to send (many) cypher statement(s) as transaction
  // see: [http://docs.neo4j.org/chunked/preview/rest-api-transactional.html](http://docs.neo4j.org/chunked/preview/rest-api-transactional.html)
  
  var __initTransaction__ = function(neo4jrestful) {
  
    var Statement = function Statement(transaction, cypher, parameters) {
      this._transaction_  = transaction;
      this.statement = cypher;
      this.parameters = parameters;
    }
  
    Statement.prototype._transaction_ = null;
    Statement.prototype.statement = '';
    Statement.prototype.parameters = null;
    Statement.prototype.status = null; // 'sending', 'sended'
    Statement.prototype.position = null;
    Statement.prototype.results = null;
    Statement.prototype.errors = null;
  
    Statement.prototype.toObject = function() {
      return {
        statement: this.statement,
        parameters: JSON.stringify(this.parameters),
        status: this.status,
        position: this.position,
        errors: this.errors,
        results: this.results,
      };
    }
  
    var Transaction = function Transaction(cypher, parameters, cb) {
      this.neo4jrestful = neo4jrestful.singleton();
      this.begin(cypher, parameters, cb);
    }
  
    Transaction.Statement = Statement;
  
    Transaction.prototype.statements = null;
    Transaction.prototype._response_ = null;
    Transaction.prototype.neo4jrestful = null;
    Transaction.prototype.status = ''; // new|creating|open|committing|committed
    Transaction.prototype.id = null;
    Transaction.prototype.uri = null
    Transaction.prototype.expires = null;
    Transaction.prototype.results = null;
    Transaction.prototype._concurrentTransmissions_ = 0;
    Transaction.prototype._responseError_ = null; //will contain response Error
    Transaction.prototype._resortResults_ = true;
  
    Transaction.prototype.begin = function(cypher, parameters, cb) {
      // reset
      this.statements = [];
      this.results = [];
      this.errors = [];
      this.id = null;
      this.status = 'new';
      return this.add(cypher, parameters, cb);
    }
  
    Transaction.prototype.add = function(cypher, parameters, cb) {
      var args = Transaction._sortTransactionArguments(cypher, parameters, cb);
      var statements = args.statements;
      // we cancel the operation if we are comitting
      if (this.status === 'committed') {
        var err = Error("You can't add statements after transaction is committed");
        if (typeof args.cb === 'function') {
          cb(err, null);
        } else {
          throw err;
        }
        return this;
      }
      this.addStatementsToQueue(statements);
      if (args.cb) {
        cb = args.cb;
      } else {
        // we execute if we have a callback
        // till then we'll collect the statements
        return this;
      }
      return this.exec(cb);
    }
  
    Transaction.prototype.exec = function(cb) {
      var self = this;
      // stop here if there is no callback attached
      if (typeof cb !== 'function') {
        return this;
      }
      self.onResponse = cb;
  
      var url = '';
      var untransmittedStatements = this.untransmittedStatements();
  
      if (this.status === 'committing') {
        // commit transaction
        url = (this.id) ? '/transaction/'+this.id+'/commit' : '/transaction/commit';
      } else if (!this.id) {
        // begin a transaction
        this.status = 'creating';
        url = '/transaction';
      } else if (this.status === 'open') {
        // add to transaction
        this.status = 'adding';
        url = '/transaction/'+this.id;
      } else if (this.status = 'committed') {
        cb(Error('Transaction is committed. Create a new transaction instead.'), null, null);
      } else {
        throw Error('Transaction has a unknown status. Possible are: creating|open|committing|committed');
      }
      var statements = [];
      untransmittedStatements.forEach(function(statement, i){
        self.statements[i].status = 'sending';
        statements.push({ statement: statement.statement, parameters: statement.parameters });
      });
      this._concurrentTransmissions_++;
      this.neo4jrestful.post(url, { data: { statements: statements } }, function(err, response, debug) {
        self._response_ = response;
        self._concurrentTransmissions_--;
        self._applyResponse(err, response, debug, untransmittedStatements);
  
        untransmittedStatements.forEach(function(statement) {
          self.statements[statement.position].status = statement.status = 'sended';
        });
  
        untransmittedStatements = self.untransmittedStatements();
  
        if (untransmittedStatements.length > 0) {
          // re call exec() until all statements are transmitted
          // TODO: set a limit to avoid endless loop
          return self.exec(cb);
        }
        // TODO: sort and populate resultset, but currently no good way to detect result objects
        else if (self._concurrentTransmissions_ === 0) {//  {
          if (typeof self.onResponse === 'function') {
            var cb = self.onResponse;
            // release onResponse for (optional) next cb
            self.onResponse = null;
            // call final callback
            if (self.status === 'committing')
              self.status = 'committed';
            cb(self._responseError_, self, debug);
            return self;
          }
        }
      });
  
      return this;
    }
  
    Transaction.prototype.addStatementsToQueue = function(statements) {
      var self = this;
      if ((statements) && (statements.constructor === Array) && (statements.length > 0)) {
        // attach all statments
        statements.forEach(function(data){
          if (data.statement) {
            var statement = new Statement(self, data.statement, data.parameters);
            statement.position = self.statements.length;
            self.statements.push(statement);
          }
        });
      }
      return this;
    }
  
    Transaction.prototype._applyResponse = function(err, response, debug, untransmittedStatements) {
      var self = this;
      // if error on request/response
      if (self.status !== 'committing')
        self.status = 'open';
      if (err) {
        self.status = (err.status) ? err.status : err;
        if (!self.status)
          self.status = self._response_.status;
      }
      untransmittedStatements.forEach(function(statement, i){
        if (response.errors[i]) {
          statement.error = response.errors[i];
          self.errors.push(response.errors[i]);
        }
        if (response.results[i]) {
          if (self._resortResults_) {
            // move row property one level above
            // { rows: [ {}, {} ]} -> { [ {}, {} ]}
            response.results[i].data.forEach(function(data, j){
              //if ((response.results[i]) && (data.row)) {
              if (data.row) {
                response.results[i].data[j] = data.row;
              }
            })
          }
          self.results.push(response.results[i]);
        }
      });
      if ((err)||(!response)) {
        self._responseError_ = (self._responseError_) ? self._responseError_.push(err) : self._responseError_ = [ err ];
      } else {
        self.populateWithDataFromResponse(response);
        // keep track of open transactions
        if (self.status === 'open')
          Transaction.__open_transactions__[self.id] = self;
        else
          delete Transaction.__open_transactions__[self.id];
      }
    }
  
    Transaction.prototype.toObject = function() {
      var statements = [];
      this.statements.forEach(function(stat){
        statements.push(stat.toObject());
      });
      return {
        id: this.id,
        status: this.status,
        statements: statements,
        expires: this.expires,
        uri: this.uri,
      };
    }
  
    Transaction.prototype.populateWithDataFromResponse = function(data) {
      if (data) {
        if ((data.transaction) && (data.transaction.expires))
          this.expires = new Date(data.transaction.expires);
        // exists only on POST a new transaction
        if (data.commit) {
          var match = data.commit.match(/^(.+?\/transaction\/(\d+))\/commit$/);
          this.id = Number(match[2]);
          this.uri = match[1];
        }
      }
    }
  
    Transaction.prototype.untransmittedStatements = function() {
      var statements = [];
      this.statements.forEach(function(statement){
        if ((statement)&&(!statement.status))
          statements.push(statement);
      });
      return statements;
    }
  
    Transaction.prototype.commit = function(cypher, parameters, cb) {
      if (typeof cypher === 'function') {
        cb = cypher;
      } else {
        var args = Transaction._sortTransactionArguments(cypher, parameters, cb);
        this.addStatementsToQueue(args.statements);
        cb = args.cb;
      }
      if (typeof cb !== 'function') {
        throw Error('You need to attach a callback an a commit/close operation');
      }
      this.onResponse = cb;
      this.status = 'committing';
      return this.exec(cb);
    }
  
    Transaction.prototype.close = Transaction.prototype.commit;
  
    Transaction.create = function(cypher, parameters, cb) {
      return new Transaction(cypher, parameters, cb);
    }
  
    Transaction.new = function(cypher, parameters) {
      return new Transaction(cypher, parameters);
    }
  
    Transaction.prototype.onResponse = null;
  
    Transaction._sortTransactionArguments = function(cypher, parameters, cb) {
      var statements = null;
      if (typeof cypher === 'string') {
        if (typeof parameters === 'function') {
          cb = parameters;
          parameters = {};
        }
        statements = [ { statement: cypher, parameters: parameters || {} } ];
      } else if ((cypher) && (cypher.constructor === Array)) {
        cb = parameters;
        statements = cypher;
      } else if ((cypher) && (cypher.statement)) {
        statements = [ cypher ];
      }
      return {
        statements: statements,
        cb: cb || null
      }
    }
  
    Transaction.prototype.rollback = function(cb) {
      var self = this;
      if ((this.id)&&(this.status!=='finalized')) {
        this.neo4jrestful.delete('/transaction/'+this.id, function(err, res, debug) {
          // remove from open_transactions
          if (!err)
            delete Transaction.__open_transactions__[self.id];
          cb(err, res, debug);
        });
      } else {
        cb(Error('You can only perform a rollback on an open transaction.'), null);
      }
      return this;
    }
  
    Transaction.prototype.undo   = Transaction.prototype.rollback;
    Transaction.prototype.delete = Transaction.prototype.rollback;
  
    Transaction.begin = function(cypher, parameters, cb) {
      return new Transaction(cypher, parameters, cb);
    }
  
    Transaction.create = Transaction.begin;
    Transaction.open = Transaction.begin;
  
    Transaction.commit = function(cypher, parameters, cb) {
      return new Transaction().commit(cypher, parameters, cb);
    }
  
    Transaction.executeAllOpenTransactions = function(cb, action) {
      // action can be commit|rollback
      if (typeof action === 'undefined')
        action = 'commit';
      var count = Object.keys(Transaction.__open_transactions__).length;
      var errors = [];
      var debugs = [];
  
      var _onDone_ = function(err, res, debug) {
        count--;
        if (err)
          errors.push(err);
        debugs.push(debug);
        if (count === 0)
          cb( ((errors.length > 0) ? errors : null), null, debugs );
      }
  
      for (var id in Transaction.__open_transactions__) {
        Transaction.__open_transactions__[id][action](_onDone_);
      }
  
      return this;
    }
  
    Transaction.commitAll   = function(cb) {
      return this.executeAllOpenTransactions(cb, 'commit');
    }
    Transaction.closeAll    = Transaction.commitAll;
  
    Transaction.rollbackAll = function(cb) {
      Transaction.executeAllOpenTransactions(cb, 'rollback');
    }
  
    Transaction.deleteAll   = Transaction.rollbackAll;
    Transaction.undoAll     = Transaction.rollbackAll;
  
    // all open transactions
    Transaction.__open_transactions__ = {};
  
    return neo4jrestful.Transaction = Transaction;
  
  }
  
  if (typeof window !== 'object') {
    module.exports = exports = {
      init: __initTransaction__
    };
  } else {
    window.Neo4jMapper.initTransaction = __initTransaction__;
  }  
  /*
   * include file: 'src/graph.js'
   */
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
    
  /*
   * include file: 'src/browser/browser_footer.js'
   */
  
})();