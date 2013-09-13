var neo4jmapper_helpers = {};

(function(){

  "use strict";

  var _ = null;

  if (typeof window === 'object') {
    _ = window._;
  } else {
    _ = require('underscore');
  }

  var _is_operator = /^\$(AND|OR|NOT|AND\$NOT|OR\$NOT)$/i;

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

  var cypherKeyValueToString = function(key, value, identifier) {
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
    if (_.isRegExp(value)) {
      var s = value.toString().replace(/^\/(\^)*(.+?)\/[ig]*$/, (value.ignoreCase) ? '$1(?i)$2' : '$1$2');//(?i)
      return key+" =~ '"+s+"'";
    }
    else if (_.isNumber(value))
      return key+" = "+value;
    else if (_.isBoolean(value))
      return key+" = "+String(value);
    else
      return key+" = '"+escapeString(value)+"'";
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

    ConditionalParameters.prototype.operator            = 'AND';
    ConditionalParameters.prototype.identifier          = 'n';
    ConditionalParameters.prototype.conditions          = null;
    ConditionalParameters.prototype.options             = null;
    ConditionalParameters.prototype.parameters          = null;
    ConditionalParameters.prototype.valuesToParameters  = true;
    ConditionalParameters.prototype._s                  = '';

    ConditionalParameters.prototype.addValue = function(value) {
      if (!this.parameters)
        this.parameters = [];
      this.parameters.push(value);
      return '{value'+(this.parameters.length-1)+'}';
    }

    ConditionalParameters.prototype.cypherKeyValueToString = function(key, originalValue, identifier) {
      var value = originalValue;
      var s = ''; // string that will be returned
      var valuesToParameters = this.valuesToParameters;
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
        value = value.toString().replace(/^\/(\^)*(.+?)\/[ig]*$/, (value.ignoreCase) ? '$1(?i)$2' : '$1$2');//(?i)
        value = (valuesToParameters) ? this.addValue(value) : "'"+value+"'";
        s = key + " =~ " + value;
      }
      else {
        // convert to string
        if ((_.isNumber(value)) || (_.isBoolean(value)))
          value = (valuesToParameters) ? this.addValue(value) : String(value);
        // else escape
        else
          value = (valuesToParameters) ? this.addValue(value) : "'"+escapeString(value)+"'";
        s = key + " = " + value;
      }
      
      return s;
    }

    ConditionalParameters.prototype.convert = function(condition, operator) {
      if (typeof condition === 'undefined')
        condition = this.conditions;
      var defaultOptions = {
        firstLevel: true,
        identifier: null
      };
      var options = _.extend({}, defaultOptions, this.options);
      if (options.firstLevel)
        options.firstLevel = false;
      // TODO: if $not : [ {name: 'a'}] ~> NOT (name = a)
      if (typeof condition === 'string')
        condition = [ condition ];
      if (typeof operator === 'undefined')
        operator = this.operator; // AND
      if (typeof condition === 'object')
        for (var key in condition) {
          var value = condition[key];
          if ( (_is_operator.test(key)) && (_.isArray(condition[key])) ) {
            condition[key] = this.convert(condition[key], key.replace(/\$/g,' ').trim().toUpperCase(), options);
          } else {
            if (_.isObject(condition[key])) {
              var properties = [];
              var firstKey = (_.keys(value)) ? _.keys(value)[0] : null;
              if ((firstKey)&&(_is_operator.test(firstKey))) {
                properties.push(this.convert(condition[key][firstKey], firstKey.replace(/\$/g,' ').trim().toUpperCase(), options));
              } else {
                for (var k in condition[key]) {
                  var value = condition[key][k]; 
                  if (value === k) {
                    properties.push(value);
                  } else {
                    properties.push(this.cypherKeyValueToString(
                      k,
                      value, 
                      // only add an identifier if we have NOT s.th. like
                      // n.name = ''  or r.since …
                      (/^[a-zA-Z\_\-]+\./).test(k) ? null : options.identifier
                    ));
                  }
                }
              }
              condition[key] = properties.join(' '+operator+' ');
            }
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

  var constructorNameOfFunction = function(func) {
    var name = func.constructor.toString().match(/^function\s(.+?)\(/)[1];
    if (name === 'Function') {
      name = func.toString().match(/^function\s(.+)\(/)[1]
    }
    return name;
  }

  /* sprintf() for JavaScript 0.7-beta1
   * http://www.diveintojavascript.com/projects/javascript-sprintf
   *
   * Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
   * All rights reserved.
   *
   * Took from the underscore.string library,
   * included to reduce dependencies
   */
  var sprintf = (function() {

    var str_repeat = function(str, qty){
      if (qty < 1) return '';
      var result = '';
      while (qty > 0) {
        if (qty & 1) result += str;
        qty >>= 1, str += str;
      }
      return result;
    }

    function get_type(variable) {
      return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
    }

    var str_format = function() {
      if (!str_format.cache.hasOwnProperty(arguments[0])) {
        str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
      }
      return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
    };

    str_format.format = function(parse_tree, argv) {
      var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
      for (i = 0; i < tree_length; i++) {
        node_type = get_type(parse_tree[i]);
        if (node_type === 'string') {
          output.push(parse_tree[i]);
        }
        else if (node_type === 'array') {
          match = parse_tree[i]; // convenience purposes only
          if (match[2]) { // keyword argument
            arg = argv[cursor];
            for (k = 0; k < match[2].length; k++) {
              if (!arg.hasOwnProperty(match[2][k])) {
                throw new Error(sprintf('[_.sprintf] property "%s" does not exist', match[2][k]));
              }
              arg = arg[match[2][k]];
            }
          } else if (match[1]) { // positional argument (explicit)
            arg = argv[match[1]];
          }
          else { // positional argument (implicit)
            arg = argv[cursor++];
          }

          if (/[^s]/.test(match[8]) && (get_type(arg) != 'number')) {
            throw new Error(sprintf('[_.sprintf] expecting number but found %s', get_type(arg)));
          }
          switch (match[8]) {
            case 'b': arg = arg.toString(2); break;
            case 'c': arg = String.fromCharCode(arg); break;
            case 'd': arg = parseInt(arg, 10); break;
            case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
            case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
            case 'o': arg = arg.toString(8); break;
            case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
            case 'u': arg = Math.abs(arg); break;
            case 'x': arg = arg.toString(16); break;
            case 'X': arg = arg.toString(16).toUpperCase(); break;
          }
          arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
          pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
          pad_length = match[6] - String(arg).length;
          pad = match[6] ? str_repeat(pad_character, pad_length) : '';
          output.push(match[5] ? arg + pad : pad + arg);
        }
      }
      return output.join('');
    };

    str_format.cache = {};

    str_format.parse = function(fmt) {
      var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
      while (_fmt) {
        if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
          parse_tree.push(match[0]);
        }
        else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
          parse_tree.push('%');
        }
        else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
          if (match[2]) {
            arg_names |= 1;
            var field_list = [], replacement_field = match[2], field_match = [];
            if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
              field_list.push(field_match[1]);
              while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                  field_list.push(field_match[1]);
                }
                else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
                  field_list.push(field_match[1]);
                }
                else {
                  throw new Error('[_.sprintf] huh?');
                }
              }
            }
            else {
              throw new Error('[_.sprintf] huh?');
            }
            match[2] = field_list;
          }
          else {
            arg_names |= 2;
          }
          if (arg_names === 3) {
            throw new Error('[_.sprintf] mixing positional and named placeholders is not (yet) supported');
          }
          parse_tree.push(match);
        }
        else {
          throw new Error('[_.sprintf] huh?');
        }
        _fmt = _fmt.substring(match[0].length);
      }
      return parse_tree;
    };

    return str_format;
  })();

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

  return neo4jmapper_helpers = {
    sortStringAndOptionsArguments: sortStringAndOptionsArguments,
    sortOptionsAndCallbackArguments: sortOptionsAndCallbackArguments,
    sortStringAndCallbackArguments: sortStringAndCallbackArguments,
    flattenObject: flattenObject,
    unflattenObject: unflattenObject,
    ConditionalParameters: ConditionalParameters,
    extractAttributesFromCondition: extractAttributesFromCondition,
    getIdFromObject: getIdFromObject,
    escapeString: escapeString,
    sprintf: sprintf,
    constructorNameOfFunction: constructorNameOfFunction,
    cypherKeyValueToString: cypherKeyValueToString,
    isValidData: isValidData,
    md5: md5
  };

})();

if (typeof window !== 'object') {
  module.exports = exports = neo4jmapper_helpers;
} else {
  window.Neo4jMapper.helpers = neo4jmapper_helpers;
}
