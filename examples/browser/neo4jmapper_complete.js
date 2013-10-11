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
  // **Distributed under the GNU General Public License**
  //
  // Neo4jMapper is an **object mapper for neo4j databases**.
  // It's written in JavaScript and ready for server- and clientside use.
  // All operations are performed asynchronously since it's using neo4j's REST api.
  //
  // This file is used for nodejs,
  // the browser equivalent is `./browser/browser_(header|footer).js` (will be available through `window.Neo4jMapper`)
  
  var Neo4jMapper = function Neo4jMapper(urlOrOptions) {
  
    var url = (typeof urlOrOptions === 'string') ? urlOrOptions : urlOrOptions.url;
  
    if (typeof url !== 'string')
      throw Error('You must provide an url as string or as `.url` property on the option object');
  
    // cached?
    if (typeof this.constructor.__sessions__[url] !== 'undefined')
      return this.constructor.__sessions__[url];
  
    if (typeof window === 'object') {
      // Browser
      var Neo4jRestful  = this.Neo4jRestful  = window.Neo4jMapper.initNeo4jRestful(urlOrOptions);
      
      this.client = new Neo4jRestful();
  
      this.Graph        = window.Neo4jMapper.initGraph(this.client);
      var Node          = this.Node          = window.Neo4jMapper.initNode(this.Graph, this.client);
      var Relationship  = this.Relationship  = window.Neo4jMapper.initRelationship(this.Graph, this.client, Node);
      var Path          = this.Path          = window.Neo4jMapper.initPath(this.Graph, this.client);
  
      Neo4jMapper.prototype.helpers = window.Neo4jMapper.helpers;
    } else {
      // NodeJS
      var Neo4jRestful  = this.Neo4jRestful  = require('./neo4jrestful').init(urlOrOptions);
      
      this.client = new Neo4jRestful();
      
      this.Graph         = (typeof window === 'object') ? window.Neo4jMapper.initNode(this.client) : require('./graph').init(this.client);
      var Node          = this.Node          = require('./node').init(this.Graph, this.client);
      var Relationship  = this.Relationship  = require('./relationship').init(this.Graph, this.client, Node);
      var Path          = this.Path          = require('./path').init(this.Graph, this.client);
      
      Neo4jMapper.prototype.helpers = require('./helpers');
    }
  
    // this method returns instanced constructor for internal usage
    this.client.constructorOf = function(name) {
      if (name === 'Node')
        return Node;
      if (name === 'Path')
        return Path;
      if (name === 'Relationship')
        return Relationship;
    }
  
    // cache session if is set to "active"
    if (this.constructor.__sessions__)
      this.constructor.__sessions__[urlOrOptions] = this;
  
  }
  
  Neo4jMapper.prototype.Node = null;
  Neo4jMapper.prototype.Relationship = null;
  Neo4jMapper.prototype.Graph = null;
  Neo4jMapper.prototype.Path = null;
  Neo4jMapper.prototype.Neo4jRestful = null;
  Neo4jMapper.prototype.client = null;
  
  // cached sessions
  Neo4jMapper.__sessions__ = {};
  
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
   * include file: 'src/helpers.js'
   */
  var _ = null;
  
  if (typeof window === 'object') {
    _ = window._;
  } else {
    _ = require('underscore');
  }
  
  var _is_operator = /^\$(AND|OR|XOR|NOT|AND\$NOT|OR\$NOT)$/i;
  
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
    if ((typeof o === 'object') && (o.id))
      return o.id;
    if (!isNaN(parseInt(o)))
      return parseInt(o);
    return null;
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
    return s.replace(/([^\\]){1}(['"])/g,'$1\\$2');
  }
  
  var valueToStringForCypherQuery = function(value) {
    if ((value) && (value.constructor === RegExp)) {
      value = value.toString().replace(/^\/(\^)*(.+?)\/[ig]*$/, (value.ignoreCase) ? '$1(?i)$2' : '$1$2');
      // replace `\` with `\\` to keep compatibility with Java regex
      value = value.replace(/([^\\]{1})\\([^\\]{1})/g, '$1\\\\$2');
    } else
      value = String(value);
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
      value = ((conditionalParametersObject) && (conditionalParametersObject.valuesToParameters)) ? conditionalParametersObject.addValue(value) : "'"+value+"'";
      s = key + " =~ " + value;
    }
    else {
      // convert to string
      if ((_.isNumber(value)) || (_.isBoolean(value)))
        value = ((conditionalParametersObject) && (conditionalParametersObject.valuesToParameters)) ? conditionalParametersObject.addValue(value) : valueToStringForCypherQuery(value);
      // else escape
      else
        value = ((conditionalParametersObject) && (conditionalParametersObject.valuesToParameters)) ? conditionalParametersObject.addValue(value) : "'"+escapeString(value)+"'";
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
      if ( (!_is_operator.test(key)) && (/^[a-zA-Z\_\-\.]+$/.test(key)) ) {
        // remove identifiers if exists
        attributes.push(key.replace(/^[nmr]{1}\./,''));
      }
    });
    return _.uniq(attributes);
  }
  
  /*
   * Builds a string from mongodb-like-query object
   */
  var ConditionalParameters = function ConditionalParameters(conditions, options) {
  
    ConditionalParameters.parameterRuleset = {
      $IN: function(value) {
        if ((typeof value === 'object') && (value.length > 0)) {
          for (var i=0; i < value.length; i++) {
            value[i] = (typeof value[i] === 'string') ? "'"+escapeString(value[i])+"'" : valueToStringForCypherQuery(value[i]);
          }
          return 'IN( '+value.join(', ')+' )';
        }
        return '';
      },
      $in: function(value) { return this.$IN(value); }
  
    };
  
    ConditionalParameters.prototype.addValue = function(value) {
      if (!this.parameters)
        this.parameters = [];
      this.parameters.push(value);
      return '{_value'+(this.parametersStartCountAt + this.parameters.length - 1)+'_}';
    }
  
    ConditionalParameters.prototype.cypherKeyValueToString = function(key, originalValue, identifier) {
      // call cypherKeyValueToString with this object context
      return cypherKeyValueToString(key, originalValue, identifier, this);
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
            if ((firstKey)&&(_is_operator.test(firstKey))) {
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
                    identifierWithProperty = options.identifier + '.`' + identifierWithProperty + '`';
                  else
                    // we have no explicit identifier, so we use the complete key/property and expecting it contains identifier
                    identifierWithProperty = k;
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
  
  var constructorNameOfFunction = function(func) {
    var name = func.constructor.toString().match(/^function\s(.+?)\(/)[1];
    if (name === 'Function') {
      name = func.toString().match(/^function\s(.+)\(/)[1]
    }
    return name;
  }
  
  var isValidData = function(data) {
    return Boolean( (typeof data === 'object') && (data !== null) );
  }
  
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
  
  var helpers = {
    sortStringAndOptionsArguments: sortStringAndOptionsArguments,
    sortOptionsAndCallbackArguments: sortOptionsAndCallbackArguments,
    sortStringAndCallbackArguments: sortStringAndCallbackArguments,
    flattenObject: flattenObject,
    unflattenObject: unflattenObject,
    ConditionalParameters: ConditionalParameters,
    extractAttributesFromCondition: extractAttributesFromCondition,
    getIdFromObject: getIdFromObject,
    escapeString: escapeString,
    constructorNameOfFunction: constructorNameOfFunction,
    cypherKeyValueToString: cypherKeyValueToString,
    valueToStringForCypherQuery: valueToStringForCypherQuery,
    isValidData: isValidData,
    md5: md5
  };
  
  if (typeof window !== 'object') {
    module.exports = exports = helpers;
  } else {
    window.Neo4jMapper.helpers = helpers;
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
    RequestDebug.prototype.data           = null;
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
  
    Neo4jRestful.prototype.options                    = null;
    // template for the header of each request to neo4j
    Neo4jRestful.prototype.header = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    Neo4jRestful.prototype.timeout                    = 5000;
    Neo4jRestful.prototype.debug                      = true; // can be deactivated but will not make any performance difference
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
  
    Neo4jRestful.prototype.query = function(cypher, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
      if (typeof cypher === 'string') {
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
        type: 'GET',
        data: null,
        debug: false,
        // use copy of header, not reference
        header: _.extend({},this.header)
      });
  
      if (typeof url !== 'string') {
        
        throw Error("First argument 'url' must be string");
  
      }
  
      this.url = options.url = url;
      this.header = options.header;
  
      var requestedUrl = this.absoluteUrl();
      var data = options.data;
  
      if ( (typeof data === 'object') && (data !== null) )
       data = JSON.stringify(options.data);
  
      if (this.debug)
        options.debug = true;
  
      // create debug object
      if (options.debug)
        debug = new RequestDebug({
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
      options._debug = _options_.debug;
  
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
  
        var stream = JSONStream.parse(['data', true]);
  
        stream.on('data', cb);
        stream.on('end', function() {
          // prevent to pass undefined, but maybe an undefined is more clear
          cb(null, null);
        });
  
        stream.on('root', function(root, count) {
          self._response_on_ = new Date().getTime();
          // remove x-stream from header
          delete self.header['X-Stream'];
          if (!count) {
            cb(null, Error('No matches in stream found ('+ root +')'));
          }
        });
  
        requestOptions.stream = stream;
  
      }
      
      // now finally send the request
      this._sendHttpRequest(requestOptions, function(err, res) {
      // req.end(function(err, res) {
        self._response_ = res;
        self._response_on_ = new Date().getTime();
        if (options._debug)
          options._debug.responseTime = self.responseTime();
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
  
    Neo4jRestful.prototype.onProcess = function(res, next, debug) {
      if (_.isArray(res)) {
        for (var i=0; i < res.length; i++) {
          res[i] = this.createObjectFromResponseData(res[i]);
        }
      } else if (_.isObject(res)) {
        res = this.createObjectFromResponseData(res);
      }
      next(null, res, debug);
    }
  
    Neo4jRestful.prototype.onSuccess = function(next, res, status, options) {
      if (options.debug) {
        options._debug.res = res;
        options._debug.status = status;
      }
      if (status === 'success') {
        if (typeof this.onProcess === 'function')
          return this.onProcess(res, next, options._debug);
        else
          return next(null, res, options._debug);
      } else {
        next(res, status, options._debug);
      }
    }
  
    Neo4jRestful.prototype.onError = function(cb, responseError, res, options) {
      // in some (rare) case, we get an empty {} as error
      // e.g. 7b5ec0f0424d676adc67a477d0500c6d6a35799d:test_main.coffee:675 on initial tests
      // for now we ignore those errors until we how to deal with them
      if ( (typeof responseError === 'object') && (Object.keys(responseError).length === 0) ) {
        return cb(null, res.body || null, options._debug);
      }
      var err = responseError;
      var self = this;
      var statusCode = err.status;
      var error = ( err && err.responseText ) ? Error(err.responseText) : err;
      if (options.debug) {
        options._debug.res = res;
        options._debug.err = err;
        options._debug.error = error;
      }
  
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
      if ( (err.exception) && (self.ignore_exception_pattern) && (self.ignore_exception_pattern.test(err.exception)) ) {
        // we ignore by default notfound exceptions, because they are no "syntactical" errors
        return cb(null, null, options._debug);
      } else {
        return cb(err, null, options._debug);
      }
    }
  
    Neo4jRestful.prototype.stream = function(cypher, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
      this.header['X-Stream'] = 'true';
      var self = this
        , todo = 0
        , done = 0;
  
      return this.query(cypher, options, function(data) {
        if (data) {
          if (typeof self.onProcess === 'function') {
            todo++;
            self.onProcess(data, function(err, data) {
              if ( (data) && (data.length === 1) )
                data = data[0];
              if (done >= todo) {
                // done
                cb(data);
                cb(null);
              } else {
                cb(data);
              }
            })
          } else {
            cb(data);
          }
        } else {
          cb(null);
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
      var uri = (responseData) ? responseData.self : null;
      var Node = this.constructorOf('Node');
      var Relationship = this.constructorOf('Relationship');
      var Path = this.constructorOf('Path');
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
      else
        if ((_.isNumber(responseData.length))&&(_.isString(responseData.start))) {
          // we have a path
          var p = new Path();
          p = p.populateWithDataFromResponse(responseData);
          return p;
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
      // console.log('::', this._connectionString());
      var client = new Neo4jRestful(this._connectionString());
      // thats the method we need and why we're doing this singleton() function here
      client.constructorOf = this.constructorOf;
      return client;
    }
  
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
  // ## Node Object
  //
  // The Node object is to create, connect and query all kind of Node(s).
  // You can register your own model
  
  // Requirements (for browser and nodejs):
  // * neo4jmapper helpers
  // * underscorejs
  // * sequence (https://github.com/coolaj86/futures)
  
  var __initNode__ = function(Graph, neo4jrestful) {
  
    var helpers = null;
    var _ = null;
    var Sequence = null;
  
    if (typeof window === 'object') {
      // browser
      // TODO: find a solution for bson object id
      helpers      = window.Neo4jMapper.helpers;
      _            = window._;
      Sequence     = window.Sequence;
    } else {
      helpers      = require('./helpers');
      _            = require('underscore');
      Sequence     = require('./lib/sequence');
    }
  
    // ### Constructor
    // calls this.init(data,id) to set all values to default
    var Node = function Node(data, id) {
      // will be used for labels and classes
      if (!this.constructor_name)
        this.constructor_name = helpers.constructorNameOfFunction(this) || 'Node';
      // each node object has it's own restful client
      this.init(data, id);
    }
  
    // ### Initialize all values on node object
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
      // copy array
      this.labels = _.uniq(this.labels);
  
      this.is_instanced = true;
      // we will use a label by default if we have defined an inherited class of node
      if ((this.constructor_name !== 'Node')&&(this.constructor_name !== 'Relationship')&&(this.constructor_name !== 'Path')) {
        this.label = this.cypher.label = this.constructor_name;
      }
      if (!this.label)
        this.label = null;
      return this;
    }
  
    // ### Instantiate a node from a specific model
    // Model can be a constructor() or a String
    // and must be registered in Node.registered_models()
    Node.prototype.convertNodeToModel = function(node, model, fallbackModel) {
      if (typeof node !== 'object') {
        // we assume that we have ”model, fallbackmodel” as arguments
        fallbackmodel = model;
        model = node;
        node = this;
      }
      if ((typeof node === 'object') && (node !== null)) {
        if (typeof fallbackModel !== 'function')
          fallbackModel = this.constructor;
        if (typeof model === 'string') {
          // do nothing
          model = model;
        } else if (typeof model === 'function') {
          model = model.constructor_name || helpers.constructorNameOfFunction(model) || null;
        } else if (node.label) {
          model = node.label;
        } else if (typeof fallbackModel === 'function') {
          model = helpers.constructorNameOfFunction(fallbackModel);
        } else {
          throw Error('No model or label found')
        }
        var Class = Node.registered_model(model) || fallbackModel;
        var singleton = new Class();
        return node.copyTo(singleton);
      }
      return null;
    }
  
    Node.__models__ = {};                             // contains all globally registered models
  
    Node.prototype.classification = 'Node';           // only needed for toObject(), just for better identification of the object for the user
    Node.prototype.data = {};                         // will contain all data for the node
    Node.prototype.id = null;                         // ”public“ id attribute
    Node.prototype._id_ = null;                       // ”private“ id attribute (to ensure that this.id deosn't get manipulated accidently)
    // can be used to define schema-like-behavior
    // TODO: implement unique
    Node.prototype.fields = {
      defaults: {},
      indexes: {},
      unique: {}
    };
  
    Node.prototype.uri = null;                        // uri of the node
    Node.prototype._response_ = null;                 // original response object
    Node.prototype._query_history_ = null;            // an array that contains all query actions chronologically, is also a flag for a modified query 
    Node.prototype._stream_ = null;                   // flag for processing result data
    Node.prototype.is_singleton = false;              // flag that this object is a singleton
    Node.prototype._hashedData_ = null;               // contains md5 hash of a persisted object
  
    // cypher property will be **copied** on each new objects node.cypher in resetQuery()
    Node.prototype.cypher = {
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
      _useParameters: true,
      _count: null,
      _distinct: null,
      _update: null,          // flag when an update is performed
      by_id: null
    };
  
    Node.prototype.is_instanced = null;               // flag that this object is instanced
  
    Node.prototype.labels = null;                     // an array of all labels
    Node.prototype.label = null;                      // will be set with a label a) if only one label exists b) if one label matches to model
    //TODO: check that it's still needed
    Node.prototype.constructor_name = null;           // will be with the name of the function of the constructor
    Node.prototype._parent_constructors_ = null;      // an array of parent constructors (e.g. Director extends Person -> 'Director','Person')
  
    Node.prototype._load_hook_reference_ = null;      // a reference to acticate or deactivate the load hook
  
    Node.prototype.__already_initialized__ = false;   // flag to avoid many initializations of a model
  
    // you should **never** change this value
    // it's used to dictinct nodes and relationships
    // many queries containg `node()` command will use this value
    // e.g. n = node(*)
    Node.prototype.__type__ = 'node';
    Node.prototype.__type_identifier__ = 'n';
  
    // ### Create a singleton
    // Here a singleton is a node object that is used as
    // a placeholder to use all `static` methods on the node object.
    // To avoid conflicts on async usage, each singleton is it's own instance
    // Example Usage: `Node.singleton().findOne().where()`
    Node.prototype.singleton = function(id, label) {
      var Class = this.constructor;
      var node = new Class({},id);
      if (typeof label === 'string')
        node.label = label;
      node.resetQuery();
      node.is_singleton = true;
      node.resetQuery();
      return node;
    }
  
    // ### Initializes the model
    // Calls the onBeforeInitialize & onAfterInitialize hook
    // The callback can be used to ensure that all async processes are finished
    Node.prototype.initialize = function(cb) {
      var self = this;
      // here a callback is optional
      if (typeof cb !== 'function')
        cb = function() { /* /dev/null */ };
      if (!this.__already_initialized__) {
        return this.onBeforeInitialize(function(err) {
          if (err)
            cb(err, null);
          else
            self.onAfterInitialize(cb);
        });
      } else {
        return cb(null, this.constructor);
      }
    }
  
    // ### Hook: onBeforeInitialize
    // Can be monkey-pacthed and be used to execute code
    // on prototype base during registering a model
    // HINT: call the cb() finnaly  
    Node.prototype.onBeforeInitialize = function(next) {
      return next(null,null);
    }
  
    // ### Internal Hook: onAfterInitialize
    // Ensures autoindex on the label
    Node.prototype.onAfterInitialize = function(cb) {
      // here we return the constructor as 2nd argument in cb
      // because it is expected at `Node.register_model('Label', cb)`
      var self = this;
      this.__already_initialized__ = true;
      // Index fields
      var fieldsToIndex = this.fieldsForAutoindex();
      // we create an object to get the label
      var node = new this.constructor();
      var label = node.label;
      if (label) {
        if (fieldsToIndex.length > 0) {
          return node.ensureIndex({ label: label, fields: fieldsToIndex }, function(err) {
            cb(err, self.constructor);
          });
        } else {
          return cb(null, self.constructor);
        }
      } else {
        return cb(Error('No label found'), this.constructor);
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
      return n;
    }
  
    // Resets the query **but** should not be used since you should start from Node.… instead
    // Anyhow, e.g.:
    //
    // n = Node.findOne().where(cb)
    // n.resetQuery().findOne(otherCb)
    Node.prototype.resetQuery = function() {
      // we have to copy the cypher values on each object
      this.cypher = {};
      _.extend(this.cypher, this.constructor.prototype.cypher);
      this.cypher.where = [];
      this.cypher.hasProperty = [];
      this.cypher.match = [];
      this.cypher.return_properties = [];
      this.cypher.start = {};
      this._query_history_ = [];
      if (this.id)
        this.cypher.from = this.id;
      return this; // return self for chaining
    }
  
    Node.prototype.hasId = function() {
      return ((this.is_instanced) && (_.isNumber(this._id_))) ? true : false;
    }
  
    Node.prototype.setUriById = function(id) {
      if (_.isNumber(id))
        this.uri = Graph.request().absoluteUrl(this.__type__+'/'+id);
      return this;
    }
  
    Node.prototype.flattenData = function(useReference) {
      // strongly recommend not to mutate attached node's data
      if (typeof useReference !== 'boolean')
        useReference = false;
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
      var data = (useReference) ? this.data : _.extend(this.data);
      return helpers.unflattenObject(data);
    }
  
    Node.prototype.hasValidData = function() {
      return helpers.isValidData(this.data);
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
  
    // Returns all fields that should be unique
    // They need to be defined in your model, e.g.:
    //
    // Node.register_model({
    //  fields: {
    //    unique: {
    //      email: true
    //    }
    // }});
    Node.prototype.uniqueFields = function() {
      var keys = [];
      _.each(this.fields.unique, function(isUnique, field) {
        if (isUnique === true) 
          keys.push(field);
      });
      return keys;
    }
  
    // # Autoindex
    // Check the `schema` of the model and builds an autoindex, optional with unique option
    // see for more details: http://docs.neo4j.org/chunked/milestone/query-constraints.html
    // TODO: only via cypher query, to simplify process
    Node.prototype.ensureIndex = function(options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
      options = _.extend({
        label: this.label,                  // index must be connected to a label
        fields: this.fieldsForAutoindex(),  // fields that have to be indexed
        unique: this.uniqueFields() || []   // fields that have be indexed as unique
      }, options);
      var self    = this
        , keys    = _.uniq(_.union(options.fields, options.unique)) // merge index + unique here
        , todo    = keys.length
        , done    = 0
        , errors  = []
        , results = [];
      if (!options.label)
        return cb(Error('Label is mandatory, you can set the label as options as well'), null);
      var url = 'schema/index/'+options.label;
      var queryHead = "CREATE CONSTRAINT ON (n:" + options.label + ") ASSERT ";
      // get all indexes fields
      // TODO: find a way to distinct index 
      this.getIndex(function(err, indexedFields) {
        // sort out fields that are already indexed
        for (var i=0; i < indexedFields.length; i++) {
          keys = _.without(keys, indexedFields[i]);
        }
        // return without any arguments if there are no fields to index 
        if (keys.length === 0)
          return cb(null, null);
        _.each(keys, function(key){
          var isUnique = (_.indexOf(options.unique, key) >= 0);
          var query = queryHead + "n.`" + key + "`" + ( (isUnique) ? " IS UNIQUE" : "")+";";
          var after = function(err, res) {
            done++;
            if ((typeof err === 'object') && (err !== null)) {
              if ((err.cause) && (err.cause.cause) && (err.cause.cause.exception === 'AlreadyIndexedException'))
                // we ignore this "error"
                results.push(res);
              else
                errors.push(err);
            } else {
              results.push(res);
            }
            if (done === todo)
              cb((errors.length > 0) ? errors : null, results);
          };
          if (isUnique)
            self.query(query, after);
          else
            Graph.request().post(url, { data: { property_keys: [ key ] } }, after);
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
      return Graph.request().get(url, function(err, res){
        if ((typeof res === 'object') && (res !== null)) {
          var keys = [];
          _.each(res, function(data){
            if (data.label === label)
              keys.push(data['property-keys']);
          });
          return cb(null, _.flatten(keys));
        } else {
          return cb(err, res);
        }
      });
    }
  
    Node.prototype._hashData_ = function() {
      if (this.hasValidData())
        return helpers.md5(JSON.stringify(this.data));
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
      return self.onBeforeSave(self, function(err) {
        // don't execute if an error is passed through
        if ((typeof err !== 'undefined')&&(err !== null))
          cb(err, null);
        else
          self.onSave(function(err, node, debug) {
            // assign labels back
            if (labels)
              self.labels = labels;
            self.onAfterSave(err, self, cb, debug);
          });
      });
    }
  
    Node.prototype.onBeforeSave = function(node, next) { next(null, null); }
  
    Node.prototype.onSave = function(cb) {
      var self = this;
      if (this.is_singleton)
        return cb(Error('Singleton instances can not be persisted'), null);
      if (!this.hasValidData())
        return cb(Error(this.__type__+' does not contain valid data. `'+this.__type__+'.data` must be an object.'));
      this.resetQuery();
      this.applyDefaultValues();
      var method = null;
  
      function __prepareData(err, data, debug, cb) {
        // copy persisted data on initially instanced node
        data.copyTo(self);
        data = self;
        self.is_singleton = false;
        self.is_instanced = true;
        if (!err)
          self.isPersisted(true);
        return cb(null, data, debug);
      }
      
      this.id = this._id_;
  
      if (this.id > 0) {
        method = 'update';
        Graph.request().put(this.__type__+'/'+this._id_+'/properties', { data: this.flattenData() }, function(err, res, debug) {
          if (err) {
            return cb(err, node);
          } else {
            self.isPersisted(true);
            cb(err, self, debug);
          }
        });
      } else {
        method = 'create';
        Graph.request().post(this.__type__, { data: this.flattenData() }, function(err, node, debug) {
          if ((err) || (!node))
            return cb(err, node);
          else
            return __prepareData(err, node, debug, cb);
        });
      }
    }
  
    Node.prototype.onAfterSave = function(err, node, next, debug) {
      // we use labelsAsArray to avoid duplicate labels
      var labels = node.labels = node.labelsAsArray();
      // cancel if we have an error here
      if (err)
        return next(err, node, debug);
      if (labels.length > 0) {
        // we need to post the label in an extra request
        // cypher inappropriate since it can't handle { attributes.with.dots: 'value' } …
        node.createLabels(labels, function(labelError, notUseableData, debugLabel) {
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
    }
  
    Node.prototype.update = function(data, cb) {
      if (!helpers.isValidData(data)) {
        cb(Error('To perform an update you need to pass valid data for updating as first argument'), null);
      }
      else if (this.hasId()) {
        this.findById(this._id_).update(data, cb);
        return this;
      } else {
        data = helpers.flattenObject(data);
        this.cypher.set = [];
        for (var attribute in data) {
          // OK
          this.cypher.set.push(helpers.cypherKeyValueToString(attribute, data[attribute], this.__type_identifier__));
        }
      }
      this.cypher._update = true;
      return this.exec(cb);
    }
  
    Node.prototype.load = function(cb) {
      var self = this;
      return this.onBeforeLoad(self, function(err, node){
        if (err)
          cb(err, node);
        else
          self.onAfterLoad(node, cb);
      })
    }
  
    Node.prototype.onBeforeLoad = function(node, next) {
      if (node.hasId()) {
        var DefaultConstructor = this.recommendConstructor();
        // To check that it's invoked by Noder::find() or Person::find()
        var constructorNameOfStaticMethod = this.label || helpers.constructorNameOfFunction(DefaultConstructor);
        node.allLabels(function(err, labels, debug) {
          if (err)
            return next(err, labels);
          node.labels = labels;
          if (labels.length === 1)
            node.label = labels[0]
          // convert node to it's model if it has a distinct label and differs from static method
          if ( (node.label) && (node.label !== constructorNameOfStaticMethod) )
            node = Node.convert_node_to_model(node, node.label, DefaultConstructor);
          next(null, node, debug);
        });
      } else {
        next(null, node);
      } 
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
      if (!this.is_instanced)
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
      self.cypher.label = label;
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
        // this.cypher.start = {};
        this.cypher.start.a = 'node('+start+')';
        this.cypher.start.b = 'node('+end+')';
        
        var matchString = 'p = '+options.algorithm+'(a-['+type+( (options.max_depth>0) ? '..'+options.max_depth : '*' )+']-b)';
        
        this.cypher.match.push(matchString.replace(/\[\:\*+/, '[*'));
        this.cypher.return_properties = ['p'];
      }
  
      return this.exec(cb);
    }
  
    // Node.prototype.traversal = function(toNodeRelationshipPath, options, cb) { }
  
    Node.prototype.count = function(identifier, cb) {
      this.cypher._count = true;
      if (typeof identifier === 'function') {
        cb = identifier;
        identifier = '*';
      }
      else if (typeof identifier !== 'string')
        identifier = '*';
  
      if (Object.keys(this.cypher.start).length < 1) {
        // this.cypher.start = {};
        this.cypher.start[this.__type_identifier__] = this.__type__+'(*)'; // all nodes by default
      }
      this.cypher.count = 'COUNT('+((this.cypher._distinct) ? 'DISTINCT ' : '')+identifier+')';
      if (this.cypher._distinct)
        // set `this.cypher._distinct` to false
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
      this._query_history_.push({ count: { distinct: this.cypher._distinct, identifier: identifier } });
      return this; // return self for chaining
    }
  
    /*
     * Query-Building methods
     */
  
    Node.prototype._prepareQuery = function() {
      var query = _.extend(this.cypher);
      var label = (query.label) ? ':'+query.label : '';
  
      if ((this.cypher.start) && (Object.keys(this.cypher.start).length < 1)) {
        if (query.from > 0) {
          query.start = {};
          query.start.n = 'node('+query.from+')';
          query.return_properties.push('n');
        }
        if (query.to > 0) {
          query.start.m = 'node('+query.to+')';
          query.return_properties.push('m');
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
        query.match.push('(n'+label+')'+x+'[r'+relationships+']'+y+'('+( (this.cypher.to > 0) ? 'm' : '' )+')');
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
      if ((!query.return_properties)||((query.return_properties)&&(query.return_properties.length == 0)&&(this.cypher.start)&&(Object.keys(this.cypher.start).length > 0))) {
        query.start_as_string = ' '+__startObjectToString(query.start)
        if (/ [a-zA-Z]+ \= /.test(query.start_as_string)) {
          var matches = query.start_as_string;
          query.return_properties = [];
          matches = matches.match(/[\s\,]([a-z]+) \= /g);
          for (var i = 0; i < matches.length; i++) {
            query.return_properties.push(matches[i].replace(/^[\s\,]*([a-z]+).*$/i,'$1'));
          }
          if ((Graph.request().version >= 2)&&(query.return_properties.length === 1)&&(query.return_properties[0] === 'n')) {
            // try adding labels if we have only n[node] as return propert
            query.return_properties.push('labels(n)');
          }
          query.return_properties = query.return_properties.join(', ');
        }
      }
  
      // Set a fallback to START n = node(*) if it's not null
      if ((this.cypher.start) && (Object.keys(this.cypher.start).length < 1)&&(!(query.match.length > 0))) {
        // query.start = 'n = node(*)';
        query.start[this.__type_identifier__] = this.__type__+'(*)';
      }
      if ((!(query.match.length>0))&&(this.label)) {
        // e.g. ~> MATCH n:Person
        query.match.push(this.__type_identifier__+':'+this.label);
      }
  
      // rule(s) for findById
      if (query.by_id > 0) {
        var identifier = query.node_identifier || this.__type_identifier__;
        // put in where clause if `START n = node(*)` or no START statement exists
        if ( (Object.keys(this.cypher.start).length < 1) || (this.cypher.start.n === 'node(*)') ) {
          // we have to use the id method for the special key `id`
          query.where.push("id("+identifier+") = "+query.by_id);
        }
      }
      // add all `HAS (property)` statements to where 
      if (query.hasProperty.length > 0) {
        // remove duplicate properties, not necessary but looks nicer
        var whereHasProperties = _.uniq(query.hasProperty);
        for (var i = whereHasProperties.length-1; i>=0; i--) {
          query.where.unshift('HAS ('+whereHasProperties[i]+')');
        }
      }
  
      query.start_as_string = __startObjectToString(query.start);
  
      return query;
    }
  
    Node.prototype.toCypherQuery = function() {
      var query = this._prepareQuery()
        , graph = Graph.start(query.start_as_string);
  
      if (query.match.length > 0)
        graph.match(query.match.join(' AND '));
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
  
      return graph.toCypherQuery();
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
    }
  
    Node.prototype._end_node_id = function(fallback) {
      if (typeof fallback === 'undefined')
        fallback = '*'
      return (this.cypher.to > 0) ? this.cypher.to : fallback; 
    }
  
    Node.prototype.singletonForQuery = function(cypher) {
      var singleton = this.singleton()
      singleton.cypher = _.extend(singleton.cypher, cypher);
      return (this.hasId()) ? singleton.findById(this.id) : this;
    }
  
    Node.prototype.exec = function(cb, cypher_or_request) {
      var request = null
        , cypherQuery = null;
      // you can alternatively use an url 
      if (typeof cypher_or_request === 'string')
        cypherQuery = cypher_or_request;
      else if (typeof cypher_or_request === 'object')
        request = _.extend({ type: 'get', data: {}, url: null }, cypher_or_request);
      
      if (typeof cb === 'function') {
        var cypher = this.toCypherQuery();
        // reset node, because it might be called from prototype
        // if we have only one return property, we resort this
        if ( (this.cypher.return_properties)&&(this.cypher.return_properties.length === 1) ) {
          if (cypherQuery)
            this.query(cypherQuery, cb);
          else if (request)
            this.query(request, cb);
          else
            // default, use the build cypher query
            this.query(cypher, cb);
        } else {
          this.query(cypher, cb);
        } 
      }
      return this;
    }
  
    Node.prototype.query = function(cypherQuery, options, cb) {
      var self = this;
      
      // sort arguments
      if (typeof options !== 'object') {
        cb = options;
        options = {};
      }
  
      options.cypher = this.cypher;
  
      var graph = Graph.start();
  
      // apply option values from Node to request
      if (this.label)
        options.label = this.label;
  
      options.recommendConstructor = this.recommendConstructor();
  
      if ((this.cypher._useParameters) && (this.cypher.parameters) && (Object.keys(this.cypher.parameters).length > 0)) {
        graph.parameters(this.cypher.parameters);
      }
  
      if (typeof cypherQuery === 'string') {
        // check for stream flag
        // in stream case we use stream() instead of query()
        if (this._stream_) {
          return graph.stream(cypherQuery, options, cb);
        } else {
          return graph.query(cypherQuery, options, cb);
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
      self.cypher.relationship = (typeof relation === 'string') ? relation : relation.join('|');
      self.cypher.incoming = true;
      self.cypher.outgoing = true;
      self.exec(cb);
      return self;
    }
  
    Node.prototype.incomingRelations = function(relation, cb) {
      var self = this.singletonForQuery();
      self._query_history_.push({ incomingRelationships: true }); // only as a ”flag”
      if (typeof relation !== 'function') {
        self.cypher.relationship = relation;
      } else {
        cb = relation;
      }
      self.cypher.node_identifier = 'n';
      // self.cypher.start = {};
      self.cypher.start.n = 'node('+self._start_node_id('*')+')';
      if (self.cypher.to > 0)
        self.cypher.start.m = 'node('+self._end_node_id('*')+')';
      self.cypher.incoming = true;
      self.cypher.outgoing = false;
      self.cypher.return_properties = ['r'];
      self.exec(cb);
      return self; // return self for chaining
    }
  
    Node.prototype.outgoingRelations = function(relation, cb) {
      var self = this.singletonForQuery();
      self._query_history_.push({ outgoingRelationships: true }); // only as a ”flag”
      if (typeof relation !== 'function') {
        self.cypher.relationship = relation;
      } else {
        cb = relation;
      }
      self.cypher.node_identifier = 'n';
      // self.cypher.start = {};
      self.cypher.start.n = 'node('+self._start_node_id('*')+')';
      if (self.cypher.to > 0)
        self.cypher.start.m = 'node('+self._end_node_id('*')+')';
      self.cypher.incoming = false;
      self.cypher.outgoing = true;
      self.cypher.return_properties = ['r'];
      self.exec(cb);
      return self; // return self for chaining
    }
  
    Node.prototype.incomingRelationsFrom = function(node, relation, cb) {
      var self = this.singletonForQuery();
      self._query_history_.push({ incomingRelationshipsFrom: true }); // only as a ”flag”
      self.cypher.from = self.id || null;
      self.cypher.to = helpers.getIdFromObject(node);
      if (typeof relation !== 'function')
        self.cypher.relationship = relation;
      self.cypher.return_properties = ['r'];
      return self.incomingRelations(relation, cb);
    }
  
    Node.prototype.outgoingRelationsTo = function(node, relation, cb) {
      var self = this.singletonForQuery();
      self._query_history_.push({ outgoingRelationshipsTo: true }); // only as a ”flag”
      self.cypher.to = helpers.getIdFromObject(node);
      if (typeof relation !== 'function')
        self.cypher.relationship = relation;
      self.cypher.return_properties = ['r'];
      return self.outgoingRelations(relation, cb);
    }
  
    Node.prototype.allDirections = function(relation, cb) {
      var self = this.singletonForQuery();
      self._query_history_.push({ allDirections: true });
      if (typeof relation !== 'function')
        self.cypher.relationship = relation;
      self.cypher.node_identifier = 'n';
      // self.cypher.start = {};
      self.cypher.start.n = 'node('+self._start_node_id('*')+')';
      self.cypher.start.m = 'node('+self._end_node_id('*')+')';
      self.cypher.incoming = true;
      self.cypher.outgoing = true;
      self.cypher.return_properties = ['n', 'm', 'r'];
      self.exec(cb);
      return self; // return self for chaining
    }
  
    Node.prototype.relationsBetween = function(node, relation, cb) {
      var self = this.singletonForQuery();
      self._query_history_.push({ relationshipsBetween: true });
      self.cypher.to = helpers.getIdFromObject(node);
      if (typeof relation !== 'function')
        self.cypher.relationship = relation;
      self.cypher.return_properties = ['r'];
      self.exec(cb);
      return self.allDirections(relation, cb);
    }
  
    Node.prototype.allRelations = function(relation, cb) {
      var self = this.singletonForQuery();
      var label = (this.cypher.label) ? ':'+this.cypher.label : '';
      if (typeof relation === 'string') {
        relation = ':'+relation;
      } else {
        cb = relation;
        relation = '';
      }
      self._query_history_.push({ allRelationships: true });
      self.cypher.match.push('n'+label+'-[r'+relation+']-()');
      self.cypher.return_properties = ['r'];
      self.exec(cb);
      return self; // return self for chaining
    }
  
    Node.prototype.limit = function(limit, cb) {
      this._query_history_.push({ LIMIT: limit });
      this.cypher.limit = parseInt(limit);
      if (limit === NaN)
        throw Error('LIMIT must be an integer number');
      if (this.cypher.action === 'DELETE')
        throw Error("You can't use a limit on a DELETE, use WHERE instead to specify your limit");
      this.exec(cb);
      return this; // return self for chaining
    }
  
    Node.prototype.skip = function(skip, cb) {
      this.cypher.skip = parseInt(skip);
      if (skip === NaN)
        throw Error('SKIP must be an integer number');
      this._query_history_.push({ SKIP: this.cypher.skip });
      this.exec(cb);
      return this; // return self for chaining
    }
  
    Node.prototype.distinct = function(cb, value) {
      if (typeof value !== 'boolean')
        value = true;
      this.cypher._distinct = value;
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
          this.cypher.order_direction = direction;
        }
      } else if (typeof property === 'string') {
        // custom statement, no process at all
        // we use 1:1 the string
        this.cypher.order_by = property;
      } else if (typeof cb === 'string') {
        identifier = cb;
        cb = null;
      }
      if (typeof identifier === 'undefined')
        identifier = this.__type_identifier__;
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
        this.cypher.order_by = identifier + ".`"+property+"`";
      } else {
        // s.th. like ORDER BY n.name ASC
        this.cypher.order_by = property;
      }
      this._query_history_.push({ ORDER_BY: this.cypher.order_by });
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
      this._query_history_.push({ MATCH: string });
      this.cypher.match.push(string);
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
        this.cypher.return_properties = [];
      if (returnStatement) {
        this.cypher.return_properties = this.cypher.return_properties.concat(
          (returnStatement.constructor === Array) ? returnStatement : returnStatement.split(', ')
        );
        this._query_history_.push({ RETURN: this.cypher.return_properties });
      }
      this.exec(cb);
      return this; // return self for chaining
    }
  
    // ### Sets or resets the START statement
    Node.prototype.start = function(start, cb) {
      var self = this;
      if (!self.is_singleton)
        self = this.singleton(undefined, this);
      if (self.label) self.withLabel(self.label);
      //self.resetQuery();
      if (typeof start !== 'string')
        self.cypher.start = null;
      else
        self.cypher.start = start;
      self._query_history_.push({ START: self.cypher.start });
      self.exec(cb);
      return self; // return self for chaining
    }
  
    Node.prototype.where = function(where, cb, options) {
      this.cypher.where = [];
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
      if (_.indexOf(this.cypher.return_properties, options.identifier) === -1) 
        this.cypher.return_properties.push(options.identifier);
  
  
      if (this.cypher.start) {
        if (!this.cypher.start.n)
          this.cypher.start.n = 'node(*)';
        if (this.cypher.start.m)
          this.cypher.start.m = 'node(*)';
        if (options.identifier === 'r')
          this.cypher.start.r = 'relationship(*)';
      }
  
      // use parameters for query or send an ordinary string?
      // http://docs.neo4j.org/chunked/stable/rest-api-cypher.html
      if (typeof options.valuesToParameters === 'undefined')
        options.valuesToParameters = Boolean(this.cypher._useParameters);
      // if already parameters are added, starting with {_value#i_} instead of {_value0_}
      if ((this.cypher.parameters)&&(this.cypher.parameters.length > 0))
        options.parametersStartCountAt = this.cypher.parameters.length;
      var condition = new helpers.ConditionalParameters(_.extend(where), options)
        , whereCondition = condition.toString();
      this.cypher.where.push(whereCondition);
      if (options.valuesToParameters)
        this._addParametersToCypher(condition.parameters);
  
      this._query_history_.push({ WHERE: whereCondition });
  
      this.exec(cb);
      return this; // return self for chaining
    }
  
    // Node.prototype.useParameters = function(trueOrFalse) {
    //   if (typeof trueOrFalse !== 'undefined')
    //     this.cypher._useParameters = trueOrFalse;
    //   return this;
    // }
  
    // Node.prototype.isUsingParameters = function() {
    //   return this.cypher._useParameters;
    // }
  
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
        if (this.cypher.return_properties.length === 0) {
          this.findAll();
        }
        // no identifier found, guessing from return properties
        if (typeof identifier !== 'string')
          identifier = this.cypher.return_properties[this.cypher.return_properties.length-1];
        this.cypher.hasProperty.push(identifier+'.`'+property+'`');
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
      this._query_history_.push({ DELETE: true });
      this.cypher.action = 'DELETE';
      if (this.cypher.limit)
        throw Error("You can't use a limit on a DELETE, use WHERE instead to specify your limit");
      return this.exec(cb);
    }
  
    Node.prototype.deleteIncludingRelations = function(cb) {
      var label = (this.label) ? ":"+this.label : "";
      if (Object.keys(this.cypher.start).length < 1) {
        // this.cypher.start = {};
        this.cypher.start[this.__type_identifier__] = this.__type__+"(*)";
      }
      this.cypher.match.push([ this.__type_identifier__+label+"-[r?]-()" ]);
      this.cypher.return_properties = [ "n", "r" ];
      return this.delete(cb);
    }
  
    Node.prototype.remove = function(cb) {
      var self = this;
      this.onBeforeRemove(function(/*err*/) {
        if (self.is_singleton)
          return cb(Error("To delete results of a query use delete(). remove() is for removing an instanced "+this.__type__),null);
        if (self.hasId()) {
          return Graph.request().delete(self.__type__+'/'+self.id, cb);
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
        from_id: this.id,
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
  
      var _create_relationship_by_options = function(options) {
        Graph.request().post('node/'+options.from_id+'/relationships', {
          data: {
            to: new Node({},options.to_id).uri,
            type: options.type,
            data: options.properties
          }
        }, function(err, relationship) {
          // to execute the hooks we manually perform the save method
          // TODO: make a static method in relationships, s.th. create_between_nodes(startId, endId, data)
          if (err)
            return cb(err, relationship);
          else {
            relationship.save(cb);
          }
        });
        return self;
      }
  
      if ((_.isNumber(options.from_id))&&(_.isNumber(options.to_id))&&(typeof cb === 'function')) {
        if (options.distinct) {
          Node.findById(options.from_id).outgoingRelationsTo(options.to_id, options.type, function(err, result) {
            if (err)
              return cb(err, result);
            if ((result) && (result.length === 1)) {
              // if we have only one relationship, we update this one
              neo4jrestful.constructorOf('Relationship').findById(result[0].id, function(err, relationship){
                if (relationship) {
                  if (options.properties)
                    relationship.data = options.properties;
                  relationship.save(cb);
                } else {
                  cb(err, relationship);
                }
              })
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
      if ( (this.hasId()) && (_.isFunction(cb)) ) {
        return Graph.request().get('node/'+this.id+'/labels', cb);
      }
    }
  
    Node.prototype.createLabel = function(label, cb) {
      return this.createLabels([ label ], cb);
    }
  
    Node.prototype.createLabels = function(labels, cb) {
      if ( (this.hasId()) && (_.isFunction(cb)) )
        return Graph.request().post('node/'+this.id+'/labels', { data: labels }, cb);
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
        Graph.request().put('node/'+this.id+'/labels', { data: labels }, cb);
      }
      return this;
    }
  
    Node.prototype.removeLabels = function(cb) {
      if ( (this.hasId()) && (_.isFunction(cb)) ) {
        return Graph.request().delete('node/'+this.id+'/labels', cb);
      } else {
        return this;
      }
    }
  
    Node.prototype.toObject = function() {
      return {
        id: this.id,
        classification: this.classification,
        data: _.extend(this.data),
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
      if (!self.is_singleton)
        self = this.singleton(undefined, this);
      self._query_history_.push({ find: true });
      if (self.label) self.withLabel(self.label);
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
      self.cypher.limit = 1;
      return self.exec(cb);
    }
  
    Node.prototype.findById = function(id, cb) {
      var self = this;
      if (!self.is_singleton)
        self = this.singleton(undefined, this);
      self._query_history_.push({ findById: id });
      if ( (_.isNumber(Number(id))) && (typeof cb === 'function') ) {
        // to reduce calls we'll make a specific restful request for one node
        Graph.request().get(this.__type__+'/'+id, function(err, object) {
          if ((object) && (typeof self.load === 'function')) {
            //  && (typeof node.load === 'function')     
            object.load(cb);
          } else {
            cb(err, object);
          }
        });
        return this;
      } else {
        self.cypher.by_id = Number(id);
        return self.findByKeyValue({ id: id }, cb);
      } 
    }
  
    Node.prototype.findByKeyValue = function(key, value, cb, _limit_) {
      var self = this;
      if (typeof _limit_ === 'undefined')
        _limit_ = null;
      if (!self.is_singleton)
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
      if (!self.is_singleton)
        self = this.singleton(undefined, this);
      self._query_history_.push({ findAll: true });
      self.cypher.limit = null;
      self.cypher.return_properties = ['n'];
      if (self.label) self.withLabel(self.label);
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
     * Static methods (misc)
     */
  
    Node.prototype.copy_of = function(that) {
      return _.extend({},that);
    }
  
    /*
     * Singleton methods, shorthands for their corresponding (static) prototype methods
     */
  
    // TODO: maybe better to replace manual argument passing with .apply method?!
  
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
  
    // Exception rule on underscore and CamelCase naming convention
    // on all find… methods to keep analogy to mongodb api 
    Node.find_all               = function(cb) { return this.findAll(cb); }
    Node.find_by_id             = function(id, cb) { return this.findById(id, cb); }
    Node.find_one               = function(where, cb) { return this.findOne(where, cb); }
    Node.find_or_create         = function(where, cb) { return this.findOrCreate(where, cb); }
    Node.find_by_key_value      = function(key, value, cb) { return this.findByKeyValue(key, value, cb); }
    Node.find_one_by_key_value  = function(key, value, cb) { return this.findOneByKeyValue(key, value, cb); }
  
    Node.query = function(cypherQuery, options, cb) {
      return this.prototype.singleton().query(cypherQuery, options, cb);
    }
  
    Node.register_model = function(Class, label, prototype, cb) {
      var name = null
        , ParentModel = this;
  
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
          if (Class.prototype.label === null)
            this.label = this.constructor_name = label;
          else
            this.label = this.constructor_name = Class.prototype.label;
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
      }
      Node.__models__[name] = Class;
      Class.prototype.initialize(cb);
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
  
    Node.unregister_model = function(Class) {
      var name = (typeof Class === 'string') ? Class : helpers.constructorNameOfFunction(Class);
      if (typeof Node.__models__[name] === 'function')
        delete Node.__models__[name];
      return Node.__models__;
    }
  
    Node.registered_models = function() {
      return Node.__models__;
    }
  
    Node.registered_model = function(model) {
      if (typeof model === 'function') {
        model = helpers.constructorNameOfFunction(model);
      }
      return Node.registered_models()[model] || null;
    }
  
    Node.convert_node_to_model = function(node, model, fallbackModel) {
      return this.prototype.convertNodeToModel(node, model, fallbackModel);
    }
  
    Node.ensure_index = function(cb) {
      return this.singleton().ensureIndex(cb);
    }
  
    Node.drop_index = function(fields, cb) {
      return this.singleton().dropIndex(fields, cb);
    }
  
    Node.drop_entire_index = function(cb) {
      return this.singleton().dropEntireIndex(cb);
    }
  
    Node.get_index = function(cb) {
      return this.singleton().getIndex(cb);
    }
  
    Node.disable_loading = function() {
      return this.prototype.disableLoading();
    }
  
    Node.enable_loading = function() {
      return this.prototype.enableLoading();
    }
  
    Node.delete_all_including_relations = function(cb) {
      return this.find().deleteIncludingRelations(cb);
    }
  
    // only once
    if ((typeof Graph.prototype === 'object') && (!Node.prototype._addParametersToCypher)) {
      Node.prototype._addParametersToCypher         = Graph.prototype._addParametersToCypher;
      Node.prototype._addParameterToCypher          = Graph.prototype._addParameterToCypher;
    }
  
    return Node;
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
  var __initPath__ = function() {
  
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
  
    // Constructor
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
      this.is_instanced = true;
    }
  
    Path.prototype.classification = 'Path'; // only needed for toObject()
    Path.prototype.from = null;
    Path.prototype.to = null;
    Path.prototype.start = null;
    Path.prototype.end = null;
    Path.prototype.length = 0;
    Path.prototype.relationships = null;
    Path.prototype.nodes = null;
    Path.prototype._response_ = null;
    Path.prototype.is_singleton = false;
    Path.prototype.is_persisted = false;
    Path.prototype.is_instanced = null;
  
    Path.prototype.singleton = function() {
      var path = new Path();
      path.is_singleton = true;
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
      var path = (this.is_instanced !== null) ? this : new Path();
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
      path.is_persisted = true;
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
  
    return Path;
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
  /*
   * TODO:
   * * make query mapper from Node available for relationships as well
   * * make relationships queryable with custom queries
   */
  
  var __initRelationship__ = function(Graph, neo4jrestful, Node) {
  
    // Requirements (for browser and nodejs):
    // * Node
    // * neo4jmapper helpres
    // * underscorejs
  
    var helpers  = null;
    var _        = null;
  
    if (typeof window === 'object') {
      helpers = window.Neo4jMapper.helpers;
      _       = window._;
    } else {
      helpers  = require('./helpers');
      _        = require('underscore');
    }
  
    // Constructor
    var Relationship = function Relationship(data, start, end, id) {
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
      this.is_instanced = true;
    }
  
    Relationship.prototype.classification = 'Relationship'; // only needed for toObject()
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
    Relationship.prototype._response_ = null;
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
        this[startOrEnd].uri = Graph.prototype.neo4jmapper.absoluteUrl('/relationship/'+id);
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
        return Graph.request().get(this.__type__+'/'+id, function(err, object) {
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
      if (this.hasId()) {
        // copy 'private' _id_ to public
        this.id = this._id_;
        Graph.request().put(this.__type__+'/'+this.id+'/properties', { data: data }, function(err,data){
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
      if (data) {
        if (_.isObject(data) && (!_.isArray(data)))
          relationship._response_ = data;
        else
          relationship._response_ = data[0];
        relationship.data = relationship._response_.data;
        relationship.data = helpers.unflattenObject(this.data);
        relationship.uri  = relationship._response_.self;
        relationship.type = relationship._response_.type;
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
      relationship.is_persisted = true;
      relationship.isPersisted(true);
      return relationship;
    }
  
    Relationship.prototype.remove = function(cb) {
      if (this.is_singleton)
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
          neo4jrestful.constructorOf('Node').findById(self[point].id,function(err,node) {
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
  
    Relationship.prototype.resetQuery = function() { return this; }
  
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
    Relationship.prototype.copy_of            = Node.prototype.copy_of;
    Relationship.prototype.onSave             = Node.prototype.onSave;
    Relationship.prototype.hasValidData       = Node.prototype.hasValidData;
    Relationship.prototype.flattenData        = Node.prototype.flattenData;
    Relationship.prototype.setUriById         = Node.prototype.setUriById;
    Relationship.prototype.isPersisted        = Node.prototype.isPersisted;
    Relationship.prototype.hasId              = Node.prototype.hasId;
    Relationship.prototype._hashData_         = Node.prototype._hashData_;
  
    return Relationship;
  }
  
  if (typeof window !== 'object') {
    module.exports = exports = {
      init: __initRelationship__
    }
  } else {
    window.Neo4jMapper.initRelationship = __initRelationship__
  }
    
  /*
   * include file: 'src/graph.js'
   */
  // **The Graph** respresents the database
  // You can perform basic actions and queries directly on the entire graphdatabase
  
  // Initialize the Graph object with a neo4jrestful client
  var __initGraph__ = function(neo4jrestful) {
  
    // Requirements (for browser and nodejs):
    // * neo4jmapper helpers
    // * underscorejs
    var _       = null;
    var helpers = null;
  
    if (typeof window === 'object') {
      helpers = window.Neo4jMapper.helpers;
      _       = window._();
    } else {
      helpers = require('./helpers');
      _       = require('underscore');
    }
  
    // Ensure that we have a Neo4jRestful client we can work with
    if ((typeof neo4jrestful !== 'undefined') && (helpers.constructorNameOfFunction(neo4jrestful) !== 'Neo4jRestful'))
      throw Error('You have to use an Neo4jRestful object as argument')
  
    // Constructor
  
    var Graph = function Graph(url) {
      if (url) {
        this.neo4jrestful = new this.neo4jrestful.constructor(url);
      }
      this.resetQuery();
      return this;
    }
  
    Graph.prototype.neo4jrestful                  = neo4jrestful;
    Graph.prototype._query_history_               = null;
    // see graph.resetQuery for initialization
    Graph.prototype.cypher = {
      query: null,           // the cypher query string
      parameters: null,      // object with paremeters
      _useParameters: true   // better performance + rollback possible (upcoming feature)
    };
    Graph.prototype._loadOnResult_                = 'node|relationship|path';
    Graph.prototype._smartResultSort_             = true; // see in graph.query() -> _increaseDone()
    Graph.prototype._nativeResults_               = false; // it's not implemented, all results are processed so far
    
    // ### Will contain the info response of the neo4j database
    Graph.prototype.info        = null;
    Graph.prototype._response_  = null; // contains the last response object
    Graph.prototype._columns_   = null;
  
    Graph.prototype.exec = function(query, cb) {    
      if (typeof query !== 'string') {
        cb = query;
        query = this.toCypherQuery();
      }
      if (typeof cb === 'function') { 
        this.query(query, {}, cb);
      }
      return this;
    }
  
    Graph.prototype.query = function(cypherQuery, options, cb) {
      var self = this;
      if (typeof cypherQuery !== 'string') {
        throw Error('First argument must be a query string');
      }
      if (typeof options === 'function') {
        cb = options;
        options = {};
      }
  
      options.params = (typeof this.cypher._useParameters === 'boolean') ? this.cypher.parameters : {};
      options.context = self;
  
      this.neo4jrestful.query(cypherQuery, options, function(err, res, debug) {
        self._processResult(err, res, debug, options, function(err, res, debug) {
          // Is used by Node on performing an "update" via a cypher query
          // The result length is 1, so we remove the array
          if ((res)&&(res.length===1)&&(options.cypher)) {
            if ((options.cypher.limit === 1) || (options.cypher._update) || (typeof res[0] !== 'object')) {
              res = res[0];
            }
          }
          cb(err, res, debug);
        });
      })
      return this;
    }
  
    Graph.prototype._processResult = function(err, result, debug, options, cb) {
      var self = options.context;
      self._response_ = self.neo4jrestful._response_;
      self._columns_ = self.neo4jrestful._columns_;
      if (err)
        return cb(err, result, debug);
      var loadNode = /node/i.test(self._loadOnResult_)
        , loadRelationship = /relation/i.test(self._loadOnResult_)
        , loadPath = /path/i.test(self._loadOnResult_)
        , todo = 0
        , done = 0;
  
      // if we have the native mode, return results instantly at this point
      // TODO: to be implemented
      if (self._nativeResults_)
        // we turned off all loading hooks and no sorting -> so lets return the native result
        return cb(err, result, debug);
  
      // increase the number of done jobs
      // resort the results if options is activated
      // and finally invoke the cb if we are done
      var __increaseDone = function() {
        if (done+1 >= todo) {
          // all jobs are done
  
          // if is set to true, sort result:
          // * return only the data (columns are attached to graph._columns_)
          // * remove array if we only have one column
          // e.g. { columns: [ 'count' ], data: [ { 1 } ] } -> 1
          if (self._smartResultSort_) {
            var cleanResult = result.data;
            // remove array, if we have only one column
            if (result.columns.length === 1) {
              for (var row=0; row < cleanResult.length; row++) {
                cleanResult[row] = cleanResult[row][0];
              }
            }
            cb(err, cleanResult, debug);
          } else {
            cb(err, result, debug);
          }
        } else {
          done++;
        }
      }
  
      if ((!result.data)&&(result.length === 1)) {
        return cb(err, result[0], debug);
      }
  
      for (var row=0; row < result.data.length; row++) {
        for (var column=0; column < result.data[row].length; column++) {
          var data = result.data[row][column];
          // try to create an instance if we have an object here
          var object = ((typeof data === 'object') && (data !== null)) ? self.neo4jrestful.createObjectFromResponseData(data, options.recommendConstructor) : data;          
          result.data[row][column] = object;
  
          (function(object, isLastObject) {
            
            if (object) {
              if ((object.classification === 'Node') && (loadNode)) {
                todo++;
                object.load(__increaseDone);
              }
              else if ((object.classification === 'Relationship') && (loadRelationship)) {
                todo++;
                object.load(__increaseDone);
              }
              else if ((object.classification === 'Path') && (loadPath)) {
                todo++;
                object.load(__increaseDone);
              }
            }
            
            // if no loading is activated and at the last row+column, execute cb
            if ((isLastObject) && (todo === 0))
              __increaseDone();
  
          })(object, (row === result.data.length-1) && (column === result.data[row].length-1));
        }
      }
      if ((todo === 0) && (done === 0) && (result.data.length === 0)) {
        // empty result
        return cb(err, null, debug);
      }
    }
  
    // ### Shortcut for neo4jrestul.stream
    Graph.prototype.stream = function(cypherQuery, options, cb) {
      var self = this;
      var Node = neo4jrestful.constructorOf('Node');
      var recommendConstructor = (options) ? options.recommendConstructor || Node : Node;
      if (typeof cypherQuery !== 'string') {
        cb = cypherQuery;
        cypherQuery = this.toCypherQuery();
      }
      else if (typeof options === 'function') {
        cb = options;
        options = undefined;
      }
      this.neo4jrestful.stream(cypherQuery, options, function(data) {
        // neo4jrestful alerady created an object, but not with a recommend constructtr
        if ((data) && (typeof data === 'object') && (data._response_)) {
          data = self.neo4jrestful.createObjectFromResponseData(data._response_, recommendConstructor);
        }
  
        cb(data);
      });
      return this;
    }
  
    Graph.prototype.parameters = function(parameters) {
      if (typeof parameters !== 'object')
        throw Error('parameter(s) as argument must be an object, e.g. { key: "value" }')
      if (this.cypher._useParameters === null)
        this.cypher._useParameters = true;
      this.cypher.parameters = parameters;
      return this;
    }
  
    // ### Deletes *all* nodes and *all* relationships
    Graph.prototype.wipeDatabase = function(cb) {
      var query = "START n=node(*) MATCH n-[r?]-() DELETE n, r;";
      return this.query(query, cb);
    }
  
    // ### Counts all objects of a specific type: (all|node|relationship|[nr]:Movie)
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
        query = "START n=node(*) MATCH n-[r?]-() RETURN count(n), count(r);";
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
  
    // ### Counts all relationships
    Graph.prototype.countRelationships = function(cb) {
      return this.countAllOfType('relationship', cb);
    }
  
    // alias for countRelationships()
    Graph.prototype.countRelations = function(cb) {
      return this.countRelationships(cb);
    }
  
    // ### Counts all nodes
    Graph.prototype.countNodes = function(cb) {
      return this.countAllOfType('node', cb);
    }
  
    // ### Counts all relationships and nodes
    Graph.prototype.countAll = function(cb) {
      return this.countAllOfType('all', cb);
    }
  
    // ### Queries information of the database and stores it on `this.info` 
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
  
    // ### Reset the query history
    Graph.prototype.resetQuery = function() {
      this._query_history_ = [];
      this.cypher = {};
      for (var attr in Graph.prototype.cypher) {
        this.cypher[attr] = Graph.prototype.cypher[attr];
      }
      this.cypher.parameters = {};
      return this;
    }
  
    // ### Startpoint to begin query chaining
    // e.g. Graph.start().where( …
    Graph.prototype.start = function(start, cb) {
      this.resetQuery();
      if (typeof start !== 'string') {
        cb = start;
        start = null;
      }
      if (start)
        this._query_history_.push({ START: start });
      return this.exec(cb);
    }
  
    Graph.prototype.match = function(match, cb) {
      this._query_history_.push({ MATCH: match });
      return this.exec(cb);
    }
  
    Graph.prototype.onMatch = function(onMatch, cb) {
      this._query_history_.push({ ON_MATCH: onMatch });
      return this.exec(cb);
    }
  
    Graph.prototype.with = function(withStatement, cb) {
      this._query_history_.push({ WITH: withStatement });
      return this.exec(cb);
    }
  
    Graph.prototype.skip = function(skip, cb) {
      skip = parseInt(skip);
      if (skip === NaN)
        throw Error('SKIP must be an integer');
      this._query_history_.push({ SKIP: skip });
      return this.exec(cb);
    }
  
    Graph.prototype.limit = function(limit, cb) {
      limit = parseInt(limit);
      if (limit === NaN)
        throw Error('LIMIT must be an integer');
      this._query_history_.push({ LIMIT: limit });
      return this.exec(cb);
    }
  
    Graph.prototype.merge = function(merge, cb) {
      // TODO: values to parameter
      this._query_history_.push({ MERGE: merge });
      return this.exec(cb);
    }
  
    Graph.prototype.custom = function(statement, cb) {
      this._query_history_.push(statement);
      return this.exec(cb);
    }
  
    // will be used to send statements
    // Graph.prototype.statement = null;
  
    Graph.prototype.set = function(set, cb) {
      if ((typeof set === 'object')&&(set.constructor === Array)) {
        set = set.join(', ');
      }
      this._query_history_.push({ SET: set });
      return this.exec(cb);
    }
  
    Graph.prototype.create = function(create, cb) {
      this._query_history_.push({ CREATE: create });
      return this.exec(cb);
    }
  
    Graph.prototype.onCreate = function(onCreate, cb) {
      this._query_history_.push({ ON_CREATE: onCreate });
      return this.exec(cb);
    }
  
    Graph.prototype.createUnique = function(create, cb) {
      this._query_history_.push({ CREATE_UNIQUE: create });
      return this.exec(cb);
    }
  
    Graph.prototype.createIndexOn = function(createIndexOn, cb) {
      this._query_history_.push({ CREATE_INDEX_ON: createIndexOn });
      return this.exec(cb);
    }
  
    Graph.prototype.case = function(caseStatement, cb) {
      this._query_history_.push({ CASE: caseStatement.replace(/END\s*$/i,'') + ' END ' });
      return this.exec(cb);
    }
  
    Graph.prototype.dropIndexOn = function(dropIndexOn, cb) {
      this._query_history_.push({ DROP_INDEX_ON: dropIndexOn });
      return this.exec(cb);
    }
  
    Graph.prototype.orderBy = function(property, cb) {
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
      return this.exec(cb);
    }
  
    Graph.prototype.where = function(where, cb) {
      if (typeof where === 'string') {
        this._query_history_.push({ WHERE: where });
        return this.exec(cb);
      }
      if (this.cypher._useParameters === null)
        this.cypher._useParameters = true;
      if (!_.isArray(where))
        where = [ where ];
      var options = { valuesToParameters: this.cypher._useParameters };
      var condition = new helpers.ConditionalParameters(where, options)
      , whereCondition = condition.toString().replace(/^\(\s(.+)\)$/, '$1');
      this._query_history_.push({ WHERE: whereCondition });
      if (this.cypher._useParameters)
        this._addParametersToCypher(condition.parameters);
      return this.exec(cb);
    }
  
    Graph.prototype.return = function(returnStatement, cb) {
      this._query_history_.push({ RETURN: returnStatement });
      return this.exec(cb);
    }
  
    Graph.prototype.returnDistinct = function(returnStatement, cb) {
      this._query_history_.push({ RETURN_DISTINCT: returnStatement });
      return this.exec(cb);
    }
  
    Graph.prototype.delete = function(deleteStatement, cb) {
      this._query_history_.push({ DELETE: deleteStatement });
      return this.exec(cb);
    }
  
    Graph.prototype.remove = function(remove, cb) {
      this._query_history_.push({ REMOVE: remove });
      return this.exec(cb);
    }
  
    Graph.prototype.foreach = function(foreach, cb) {
      this._query_history_.push({ FOREACH: foreach });
      return this.exec(cb);
    }
  
    Graph.prototype.comment = function(comment, cb) {
      this.custom(' /* '+comment.replace(/^\s*\/\*\s*/,'').replace(/\s*\*\/\s*$/,'')+' */ ');
      return this.exec(cb);
    }
  
    Graph.prototype.toCypherQuery = function(options) {
      var s = ''
        , chopLength = 15
        , defaultOptions = {
            niceFormat: true
          };
      if (typeof options !== 'object')
        options = {};
      else
        _.defaults(options, defaultOptions);
      for (var i=0; i < this._query_history_.length; i++) {
        var queryFragment = this._query_history_[i];
        if (typeof queryFragment === 'string') {
          // if we have just a string, we add the string to final query, no manipulation
          s += queryFragment;
          continue;
        }
        var attribute = Object.keys(this._query_history_[i])[0]
          , forQuery = this._query_history_[i][attribute];
        // remove underscore from attribute, e.g. ORDER_BY -> ORDER BY
        attribute = attribute.replace(/([A-Z]{1})\_([A-Z]{1})/g, '$1 $2');
        if (options.niceFormat) {
          // extend attribute-string with whitespace
          attribute = attribute + Array(chopLength - attribute.length).join(' ');
        }
        if (forQuery !== null)
          s += '\n'+attribute+' '+String(forQuery)+' ';
      }
      return s.trim()+';';
    }
  
    // # Enables loading for specific types
    // Define type(s) simply in a string
    // e.g.:
    // 'node|relationship|path' or '*' to enable load for all types
    // 'node|relationship' to enable for node + relationships
    // '' to disable for all (you can also use `disableLoading()` instead)
    Graph.prototype.enableLoading = function(classifications) {
      if (classifications === '*')
        classifications = 'node|relationship|path';
      this._loadOnResult_ = classifications;
      return this;
    }
  
    // # Disables loading on results (speeds up queries but less convenient)
    Graph.prototype.disableLoading = function() {
      this._loadOnResult_ = '';
      return this;
    }
  
    // # Sort Results
    // By default we get results like:
    // { columns: [ 'node' ], data: [ [ { nodeObject#1 } ], … [ { nodeObject#n} ]] }
    // To keep it more handy, we return just the data
    // and (if we have only 1 column) instead of [ {node} ] -> {node}
    // If you want to have access to the columns anyway, you can get them on `graph._columns_`
    Graph.prototype.sortResult = function(trueOrFalse) {
      if (typeof trueOrFalse === 'undefined')
        trueOrFalse = true;
      this._smartResultSort_ = trueOrFalse;
      return this;
    }
  
    Graph.prototype.enableSorting = function() {
      return this.sortResult(true);
    }
  
    Graph.prototype.disableSorting = function() {
      return this.sortResult(false);
    }
  
    Graph.prototype.enableProcessing = function() {
      this.sortResult(true);
      this.enableLoading('*');
      return this;
    }
  
    Graph.prototype.disableProcessing = function() {
      this.sortResult(false);
      this.disableLoading();
      return this;
    }
  
    Graph.prototype.log = function(){ /* > /dev/null */ };
  
    Graph.prototype._addParametersToCypher = function(parameters) {
      if ( (typeof parameters === 'object') && (parameters) && (parameters.constructor === Array) ) {
        if (!this.cypher.parameters)
          this.cypher.parameters = {};
        for (var i=0; i < parameters.length; i++) {
          this._addParameterToCypher(parameters[i]);
        }
      }
      return this.cypher.parameters;
    }
  
    Graph.prototype._addParameterToCypher = function(parameter) {
      if (typeof parameter === 'object') {
        if (!this.cypher.parameters)
          this.cypher.parameters = {};
        _.extend(this.cypher.parameters, parameter);
      } else {
        // we name the parameter with `_value#_`
        var count = Object.keys(this.cypher.parameters).length;
        this.cypher.parameters['_value'+count+'_'] = parameter;
      }
      return this.cypher.parameters;
    }
  
    /*
     * Static methods
     * (are shortcuts to methods on new instanced Graph())
     */
    Graph.query = function(cypher, options, cb) {
      return Graph.disable_processing().query(cypher, options, cb);
    }
  
    Graph.stream = function(cypher, options, cb) {
      return new Graph.disable_processing().stream(cypher, options, cb);
    }
  
    Graph.wipe_database = function(cb) {
      return new Graph().wipeDatabase(cb);
    }
  
    Graph.count_all_of_type = function(type, cb) {
      return new Graph().countAllOfType(type, cb);
    }
  
    Graph.count_relationships = function(cb) {
      return new Graph().countRelationships(cb);
    }
  
    // alias for count_relationships
    Graph.count_relations = function(cb) {
      return new Graph().countRelationships(cb);
    }
    
    Graph.count_nodes = function(cb) {
      return new Graph().countNodes(cb);
    }
    
    Graph.count_all = function(cb) {
      return new Graph().countAll(cb);
    }
  
    Graph.about = function(cb) {
      return new Graph().about(cb);
    }
  
    Graph.start = function(start, cb) {
      return Graph.enable_processing().start(start, cb);
    }
  
    Graph.enable_loading = function(classifications) {
      Graph.prototype.enableLoading(classifications);
      return new Graph();
    }
  
    Graph.disable_loading = function() {
      Graph.prototype.disableLoading();
      return new Graph();
    }
  
    Graph.disable_processing = function() {
      Graph.prototype.disableProcessing();
      return new Graph();
    }
  
    Graph.enable_processing = function() {
      Graph.prototype.enableProcessing();
      return new Graph();
    }
  
    Graph.enable_sorting = function() {
      Graph.prototype.enableSorting();
      return new Graph();
    }
  
    Graph.disable_sorting = function() {
      Graph.prototype.disableSorting(false);
      return new Graph();
    }
  
    Graph.request = function() {
      // creates a new neo4jrestful client
      return neo4jrestful.singleton();
    }
  
    Graph.__top__ = true;
  
    return Graph;
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