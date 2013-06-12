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
  
  if (typeof window !== 'object')
    throw Error('This file is for browser use, not for nodejs');
  if (typeof window._ === 'undefined')
    throw Error('Include of underscore.js library is needed')
  if (typeof window.jQuery === 'undefined')
    throw Error('Include of jQuery library is needed')
  
  
    
  /*
   * include file: 'src/helpers.js'
   */
  var neo4jmapper_helpers = {};
  
  (function(){
  
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
        
        if ((typeof ob[i]) == 'object') {
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
  
    // source: https://gist.github.com/fantactuka/4989737
    var unflattenObject = function(object) {
        return _(object).inject(function(result, value, keys) {
            var current = result,
                partitions = keys.split('.'),
                limit = partitions.length - 1;
     
            _(partitions).each(function(key, index) {
                current = current[key] = (index == limit ? value : (current[key] || {}));
            });
     
            return result;
        }, {});
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
      if (typeof identifier === 'string')
        key = identifier+'.'+key;
      if (_.isRegExp(value)) {
        var s = value.toString().replace(/^\/(\^)*(.+?)\/[ig]*$/, (value.ignoreCase) ? '$1(?i)$2' : '$1$2');//(?i)
        return key+" =~ '"+s+"'";
      } else {
        return key+" = '"+escapeString(value)+"'";
      }
    }
  
    /*
     * Builds a string from mongodb-like-query object
     */
    var conditionalParameterToString = function(condition, operator, options) {
      var defaultOptions = {
        firstLevel: true,
        identifier: null
      };
      if (typeof options === 'undefined')
        options = defaultOptions;
      else
        options = _.extend({}, defaultOptions, options);
      if (options.firstLevel)
        options.firstLevel = false;
      // TODO: if $not : [ {name: 'a'}] ~> NOT (name = a)
      if (typeof condition === 'string')
        condition = [ condition ];
      if (typeof operator === 'undefined')
        operator = 'AND';
      _.each(condition,function(value, key){
        if ( (_is_operator.test(key)) && (_.isArray(condition[key])) ) {
          condition[key] = conditionalParameterToString(condition[key], key.replace(/\$/g,' ').trim().toUpperCase(), options);
        } else {
          if (_.isObject(condition[key])) {
            var properties = [];
            var firstKey = (_.keys(value)) ? _.keys(value)[0] : null;
            if ((firstKey)&&(_is_operator.test(firstKey))) {
              properties.push(conditionalParameterToString(condition[key][firstKey], firstKey.replace(/\$/g,' ').trim().toUpperCase(), options));
            } else {
              _.each(condition[key], function(value, key) {
                if (value === key) {
                  properties.push(value);
                } else {
                  properties.push(cypherKeyValueToString(
                    key,
                    value, 
                    // only add an identifier if we have NOT s.th. like
                    // n.name = ''  or r.since …
                    (/^[a-zA-Z\_\-]+\./).test(key) ? null : options.identifier
                  ));
                }
              });
            }
            condition[key] = properties.join(' '+operator+' ');
          }
        }
      });
      if ((condition.length === 1)&&(options.firstLevel === false)&&(/NOT/i.test(operator)))
        return operator + ' ( '+condition.join('')+' )';
      else
        return '( '+condition.join(' '+operator+' ')+' )';
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
          attributes.push(key.replace(/^[abnr]{1}\./,''));
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
  
  
  
    // Defining underscore.string
  
    var _s = {
  
      VERSION: '2.3.1',
  
      isBlank: function(str){
        if (str == null) str = '';
        return (/^\s*$/).test(str);
      },
  
      stripTags: function(str){
        if (str == null) return '';
        return String(str).replace(/<\/?[^>]+>/g, '');
      },
  
      capitalize : function(str){
        str = str == null ? '' : String(str);
        return str.charAt(0).toUpperCase() + str.slice(1);
      },
  
      chop: function(str, step){
        if (str == null) return [];
        str = String(str);
        step = ~~step;
        return step > 0 ? str.match(new RegExp('.{1,' + step + '}', 'g')) : [str];
      },
  
      clean: function(str){
        return _s.strip(str).replace(/\s+/g, ' ');
      },
  
      count: function(str, substr){
        if (str == null || substr == null) return 0;
  
        str = String(str);
        substr = String(substr);
  
        var count = 0,
          pos = 0,
          length = substr.length;
  
        while (true) {
          pos = str.indexOf(substr, pos);
          if (pos === -1) break;
          count++;
          pos += length;
        }
  
        return count;
      },
  
      chars: function(str) {
        if (str == null) return [];
        return String(str).split('');
      },
  
      swapCase: function(str) {
        if (str == null) return '';
        return String(str).replace(/\S/g, function(c){
          return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
        });
      },
  
      escapeHTML: function(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, function(m){ return '&' + reversedEscapeChars[m] + ';'; });
      },
  
      unescapeHTML: function(str) {
        if (str == null) return '';
        return String(str).replace(/\&([^;]+);/g, function(entity, entityCode){
          var match;
  
          if (entityCode in escapeChars) {
            return escapeChars[entityCode];
          } else if (match = entityCode.match(/^#x([\da-fA-F]+)$/)) {
            return String.fromCharCode(parseInt(match[1], 16));
          } else if (match = entityCode.match(/^#(\d+)$/)) {
            return String.fromCharCode(~~match[1]);
          } else {
            return entity;
          }
        });
      },
  
      escapeRegExp: function(str){
        if (str == null) return '';
        return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
      },
  
      splice: function(str, i, howmany, substr){
        var arr = _s.chars(str);
        arr.splice(~~i, ~~howmany, substr);
        return arr.join('');
      },
  
      insert: function(str, i, substr){
        return _s.splice(str, i, 0, substr);
      },
  
      include: function(str, needle){
        if (needle === '') return true;
        if (str == null) return false;
        return String(str).indexOf(needle) !== -1;
      },
  
      join: function() {
        var args = slice.call(arguments),
          separator = args.shift();
  
        if (separator == null) separator = '';
  
        return args.join(separator);
      },
  
      lines: function(str) {
        if (str == null) return [];
        return String(str).split("\n");
      },
  
      reverse: function(str){
        return _s.chars(str).reverse().join('');
      },
  
      startsWith: function(str, starts){
        if (starts === '') return true;
        if (str == null || starts == null) return false;
        str = String(str); starts = String(starts);
        return str.length >= starts.length && str.slice(0, starts.length) === starts;
      },
  
      endsWith: function(str, ends){
        if (ends === '') return true;
        if (str == null || ends == null) return false;
        str = String(str); ends = String(ends);
        return str.length >= ends.length && str.slice(str.length - ends.length) === ends;
      },
  
      succ: function(str){
        if (str == null) return '';
        str = String(str);
        return str.slice(0, -1) + String.fromCharCode(str.charCodeAt(str.length-1) + 1);
      },
  
      titleize: function(str){
        if (str == null) return '';
        return String(str).replace(/(?:^|\s)\S/g, function(c){ return c.toUpperCase(); });
      },
  
      camelize: function(str){
        return _s.trim(str).replace(/[-_\s]+(.)?/g, function(match, c){ return c.toUpperCase(); });
      },
  
      underscored: function(str){
        return _s.trim(str).replace(/([a-z\d])([A-Z]+)/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase();
      },
  
      dasherize: function(str){
        return _s.trim(str).replace(/([A-Z])/g, '-$1').replace(/[-_\s]+/g, '-').toLowerCase();
      },
  
      classify: function(str){
        return _s.titleize(String(str).replace(/[\W_]/g, ' ')).replace(/\s/g, '');
      },
  
      humanize: function(str){
        return _s.capitalize(_s.underscored(str).replace(/_id$/,'').replace(/_/g, ' '));
      },
  
      trim: function(str, characters){
        if (str == null) return '';
        if (!characters && nativeTrim) return nativeTrim.call(str);
        characters = defaultToWhiteSpace(characters);
        return String(str).replace(new RegExp('\^' + characters + '+|' + characters + '+$', 'g'), '');
      },
  
      ltrim: function(str, characters){
        if (str == null) return '';
        if (!characters && nativeTrimLeft) return nativeTrimLeft.call(str);
        characters = defaultToWhiteSpace(characters);
        return String(str).replace(new RegExp('^' + characters + '+'), '');
      },
  
      rtrim: function(str, characters){
        if (str == null) return '';
        if (!characters && nativeTrimRight) return nativeTrimRight.call(str);
        characters = defaultToWhiteSpace(characters);
        return String(str).replace(new RegExp(characters + '+$'), '');
      },
  
      truncate: function(str, length, truncateStr){
        if (str == null) return '';
        str = String(str); truncateStr = truncateStr || '...';
        length = ~~length;
        return str.length > length ? str.slice(0, length) + truncateStr : str;
      },
  
      /**
       * _s.prune: a more elegant version of truncate
       * prune extra chars, never leaving a half-chopped word.
       * @author github.com/rwz
       */
      prune: function(str, length, pruneStr){
        if (str == null) return '';
  
        str = String(str); length = ~~length;
        pruneStr = pruneStr != null ? String(pruneStr) : '...';
  
        if (str.length <= length) return str;
  
        var tmpl = function(c){ return c.toUpperCase() !== c.toLowerCase() ? 'A' : ' '; },
          template = str.slice(0, length+1).replace(/.(?=\W*\w*$)/g, tmpl); // 'Hello, world' -> 'HellAA AAAAA'
  
        if (template.slice(template.length-2).match(/\w\w/))
          template = template.replace(/\s*\S+$/, '');
        else
          template = _s.rtrim(template.slice(0, template.length-1));
  
        return (template+pruneStr).length > str.length ? str : str.slice(0, template.length)+pruneStr;
      },
  
      words: function(str, delimiter) {
        if (_s.isBlank(str)) return [];
        return _s.trim(str, delimiter).split(delimiter || /\s+/);
      },
  
      pad: function(str, length, padStr, type) {
        str = str == null ? '' : String(str);
        length = ~~length;
  
        var padlen  = 0;
  
        if (!padStr)
          padStr = ' ';
        else if (padStr.length > 1)
          padStr = padStr.charAt(0);
  
        switch(type) {
          case 'right':
            padlen = length - str.length;
            return str + strRepeat(padStr, padlen);
          case 'both':
            padlen = length - str.length;
            return strRepeat(padStr, Math.ceil(padlen/2)) + str
                    + strRepeat(padStr, Math.floor(padlen/2));
          default: // 'left'
            padlen = length - str.length;
            return strRepeat(padStr, padlen) + str;
          }
      },
  
      lpad: function(str, length, padStr) {
        return _s.pad(str, length, padStr);
      },
  
      rpad: function(str, length, padStr) {
        return _s.pad(str, length, padStr, 'right');
      },
  
      lrpad: function(str, length, padStr) {
        return _s.pad(str, length, padStr, 'both');
      },
  
      sprintf: sprintf,
  
      vsprintf: function(fmt, argv){
        argv.unshift(fmt);
        return sprintf.apply(null, argv);
      },
  
      toNumber: function(str, decimals) {
        if (!str) return 0;
        str = _s.trim(str);
        if (!str.match(/^-?\d+(?:\.\d+)?$/)) return NaN;
        return parseNumber(parseNumber(str).toFixed(~~decimals));
      },
  
      numberFormat : function(number, dec, dsep, tsep) {
        if (isNaN(number) || number == null) return '';
  
        number = number.toFixed(~~dec);
        tsep = typeof tsep == 'string' ? tsep : ',';
  
        var parts = number.split('.'), fnums = parts[0],
          decimals = parts[1] ? (dsep || '.') + parts[1] : '';
  
        return fnums.replace(/(\d)(?=(?:\d{3})+$)/g, '$1' + tsep) + decimals;
      },
  
      strRight: function(str, sep){
        if (str == null) return '';
        str = String(str); sep = sep != null ? String(sep) : sep;
        var pos = !sep ? -1 : str.indexOf(sep);
        return ~pos ? str.slice(pos+sep.length, str.length) : str;
      },
  
      strRightBack: function(str, sep){
        if (str == null) return '';
        str = String(str); sep = sep != null ? String(sep) : sep;
        var pos = !sep ? -1 : str.lastIndexOf(sep);
        return ~pos ? str.slice(pos+sep.length, str.length) : str;
      },
  
      strLeft: function(str, sep){
        if (str == null) return '';
        str = String(str); sep = sep != null ? String(sep) : sep;
        var pos = !sep ? -1 : str.indexOf(sep);
        return ~pos ? str.slice(0, pos) : str;
      },
  
      strLeftBack: function(str, sep){
        if (str == null) return '';
        str += ''; sep = sep != null ? ''+sep : sep;
        var pos = str.lastIndexOf(sep);
        return ~pos ? str.slice(0, pos) : str;
      },
  
      toSentence: function(array, separator, lastSeparator, serial) {
        separator = separator || ', '
        lastSeparator = lastSeparator || ' and '
        var a = array.slice(), lastMember = a.pop();
  
        if (array.length > 2 && serial) lastSeparator = _s.rtrim(separator) + lastSeparator;
  
        return a.length ? a.join(separator) + lastSeparator + lastMember : lastMember;
      },
  
      toSentenceSerial: function() {
        var args = slice.call(arguments);
        args[3] = true;
        return _s.toSentence.apply(_s, args);
      },
  
      slugify: function(str) {
        if (str == null) return '';
  
        var from  = "ąàáäâãåæćęèéëêìíïîłńòóöôõøùúüûñçżź",
            to    = "aaaaaaaaceeeeeiiiilnoooooouuuunczz",
            regex = new RegExp(defaultToWhiteSpace(from), 'g');
  
        str = String(str).toLowerCase().replace(regex, function(c){
          var index = from.indexOf(c);
          return to.charAt(index) || '-';
        });
  
        return _s.dasherize(str.replace(/[^\w\s-]/g, ''));
      },
  
      surround: function(str, wrapper) {
        return [wrapper, str, wrapper].join('');
      },
  
      quote: function(str) {
        return _s.surround(str, '"');
      },
  
      exports: function() {
        var result = {};
  
        for (var prop in this) {
          if (!this.hasOwnProperty(prop) || prop.match(/^(?:include|contains|reverse)$/)) continue;
          result[prop] = this[prop];
        }
  
        return result;
      },
  
      repeat: function(str, qty, separator){
        if (str == null) return '';
  
        qty = ~~qty;
  
        // using faster implementation if separator is not needed;
        if (separator == null) return strRepeat(String(str), qty);
  
        // this one is about 300x slower in Google Chrome
        for (var repeat = []; qty > 0; repeat[--qty] = str) {}
        return repeat.join(separator);
      },
  
      levenshtein: function(str1, str2) {
        if (str1 == null && str2 == null) return 0;
        if (str1 == null) return String(str2).length;
        if (str2 == null) return String(str1).length;
  
        str1 = String(str1); str2 = String(str2);
  
        var current = [], prev, value;
  
        for (var i = 0; i <= str2.length; i++)
          for (var j = 0; j <= str1.length; j++) {
            if (i && j)
              if (str1.charAt(j - 1) === str2.charAt(i - 1))
                value = prev;
              else
                value = Math.min(current[j], current[j - 1], prev) + 1;
            else
              value = i + j;
  
            prev = current[j];
            current[j] = value;
          }
  
        return current.pop();
      }
    };
  
    return neo4jmapper_helpers = {
      sortStringAndOptionsArguments: sortStringAndOptionsArguments,
      sortOptionsAndCallbackArguments: sortOptionsAndCallbackArguments,
      flattenObject: flattenObject,
      unflattenObject: unflattenObject,
      conditionalParameterToString: conditionalParameterToString,
      extractAttributesFromCondition: extractAttributesFromCondition,
      getIdFromObject: getIdFromObject,
      escapeString: escapeString,
      sprintf: sprintf,
      constructorNameOfFunction: constructorNameOfFunction
    };
  
  })();
  
  if (typeof window !== 'object') {
    module.exports = exports = neo4jmapper_helpers;
  }
    
  /*
   * include file: 'src/neo4jrestful.js'
   */
  var initNeo4jRestful = function() {
  
    // will be initialized on first construction
    var Node                = null
      , Relationship        = null
      , Path                = null
      , node                = null
      , relationship        = null
      , path                = null
      , _singleton_instance = null
      , helpers             = null
      , _                   = null
      , jQuery              = null;
  
    if (typeof window === 'object') {
      // browser
      helpers      = neo4jmapper_helpers;
      node         = initNode;
      path         = initPath;
      relationship = initRelationship;
      _            = window._;
      jQuery       = window.jQuery;
    } else {
      // nodejs
      helpers      = require('./helpers');
      _            = require('underscore');
      jQuery       = require('jquery');
      node         = require('./node');
      relationship = require('./relationship');
      path         = require('./path');
    }
  
    var QueryError = function(message, options, name) {
        this.name = (typeof name === 'string') ? name : "QueryError";
        this.message = message || '';
        if (typeof options === 'object') {
          this.exception = options.exception || null;
          this.cypher = options.cypher || null;
          this.stacktrace = options.stacktrace || null;
          this.statusCode = options.statusCode || null;
          this.method = options.method || null;
          this.url = options.url || null;
          this.data = options.data || null;
        }
    }
  
    var CypherQueryError = function(message, options) {
      var error = QueryError(message, options, 'CypherQueryError');
      return _.extend(this, error);
    }
  
    /*
     * Constructor
     */
    Neo4jRestful = function(baseUrl, options) {
      var self = this;
      if (typeof baseUrl !== 'undefined') {
        // check url
        // ensure one trailing slash
        baseUrl = baseUrl.replace(/\/*$/, '/');
        // stop here if we don't have a valid url
        if (!/http(s)*\:\/\/.+(\:[0-9]+)*\//.test(baseUrl)) {
          var message = "Your URL ("+url+") needs to match the default url pattern 'http(s)://domain(:port)/…'";
          throw Error(message);
        }
      }
      if (typeof baseUrl === 'string')
        self.baseUrl = baseUrl;
      if (typeof options === 'object')
        self.options = options;
      if (Node === null)
        Node = node(self);
      if (Relationship === null)
        Relationship = relationship(self);
      if (Path === null)
        Path = path(self);
      if (_singleton_instance === null) {
        // initially set singleton to first constructed connection
        _singleton_instance = this;
      }
      self._queue = _.extend({},Neo4jRestful.prototype._queue);
  
      self._queue.stack = [];
      self.checkAvailability(function(err, isAvailable, debug) {
        self.connection_established = isAvailable;
      });
      if ((!self.baseUrl)&&(_singleton_instance)) {
        // return singleton (if exists) and if no url is given
        this = _singleton_instance;
      }
    }
  
    Neo4jRestful.prototype.options = null;
    Neo4jRestful.prototype.header = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    Neo4jRestful.prototype.baseUrl = null;
    Neo4jRestful.prototype.debug = null;
    Neo4jRestful.prototype._absoluteUrl = null;
    Neo4jRestful.prototype.exact_version = null;
    Neo4jRestful.prototype.version = null;
  
    Neo4jRestful.prototype._queue = {
      stack: null, // contains all queued requests
      interval_id: null, // processes id of interval 
      is_processing: false, // flag to avoid async queue process
      ping_timeout: 10000, // to avoid endless waiting for a non available service set timeout to 10[s] by default
      started_on: null, // used for avoiding endless waiting
      max_queue_length: 63
    };
  
    Neo4jRestful.prototype.connection_established = false;
  
    Neo4jRestful.prototype.singleton = function() {
      if (_singleton_instance)
        return _singleton_instance;
      else {
        var instance = new Neo4jRestful(null);
        return instance;
      }
    }
    Neo4jRestful.prototype.set_singleton_instance = function(instance) {
      _singleton_instance = instance;
    }
  
    Neo4jRestful.prototype.query = function(cypher, options, cb) {
      var args;
      var self = this;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
      if (typeof cypher === 'string') {
        this.log('**info**', 'cypher:', cypher.trim().replace(/\s+/g,' '));
        this.post('/db/data/cypher',{
          data: {
            query: cypher,
            params: {}
          }
        }, function(err, result, debug){
          return cb(err, result, debug);
        });
      }
    }
  
    Neo4jRestful.prototype.checkAvailability = function(cb) {
      var self = this;
      var timeout = 3000;
      jQuery.ajax({
        url: self.baseUrl+'db/data/',
        type: 'GET',
        cache: false,
        timeout: timeout,
        success: function(res,status) {
          if ((status === 'success')&&(res)&&(res.neo4j_version)) {
            // store version on restfule client
            // TODO: currently it's also stored redundant in graph object -> only one version value should be used 
            self.exact_version = res.neo4j_version;
            self.version = Number(self.exact_version.replace(/^([0-9]+\.*[0-9]*)(.*)$/, '$1'));
            cb(null, res.neo4j_version);
          } else {
            cb(Error("Connection established, but can't detect neo4j database version… Sure it's neo4j url?"), null, null);
          }
        },
        error: function(err) {
          cb(err, false, err.status);
        }
      });
    }
  
    Neo4jRestful.prototype.absoluteUrl = function() {
      if (this.url) {
        if (/^(\/\/|http(s)*\:\/\/)/.test(this.url)) {
          // TODO: check for http or https, but would cost a extra cb
          this._absoluteUrl = this.url.replace(/^\/\//,'http://').replace(/^\//,'');
        }
        else {
          this._absoluteUrl = this.baseUrl + this.url.replace(/^\/{1}/,'');
        }
        return this._absoluteUrl;
      }
    }
  
    Neo4jRestful.prototype.request = function(url, options, cb) {
      var self = this;
      var debug = null;
      var defaultOptions = {
        type: 'GET',
        data: null,
        no_processing: false,
        debug: false
      };
      if (typeof options === 'undefined')
        options = _.extend({},defaultOptions);
      else
        options = _.extend(defaultOptions, options);  
      this.url = url;
      var requestedUrl = this.absoluteUrl();
      var type = options.type;
      var data = options.data;
      var label = null;
      if (options.label) {
        label = options.label;
        delete options.label;
      }
      // use copy of header, not reference
      var header = _.extend({},this.header);
      if ( (typeof data === 'object') && (data !== null) )
       data = JSON.stringify(options.data);
      this.log('**debug**', 'URI:', type+":"+requestedUrl);
      this.log('**debug**', 'sendedData:', data);
      this.log('**debug**', 'sendedHeader:', header);
  
      // we can set a debug flag on neo4jrestful
      // to avoid passing each time for every request a debug flag
      if (this.debug)
        options.debug = true;
  
      if (options.debug) {
        debug = {
          options: options,
          requested_url: requestedUrl,
          type: type,
          data: data,
          header: header,
          res: null,
          status: null,
          err: null
        };
      }
  
      var _options = {
        requestedUrl: requestedUrl,
        type: type,
        data: data,
        options: options,
        debug: debug,
        url: url, 
        label: label // will create an instance of the label if exists
      };
  
      if (!this.connection_established) {
        // add to queue
        if (self._queue.stack.length < self._queue.max_queue_length)
          self._queue.stack.push({options: _options, cb: cb});
        // start interval process
        this._processQueue(_options,cb);
      } else {
        return this.makeRequest(_options, cb);
      }
    }
  
    Neo4jRestful.prototype._processQueue = function() {
      var intervalTime = 50;
      var self = this;
      if (!self._queue.started_on)
        self._queue.started_on = new Date().getTime()
      // only start one interval process per connection object
      if (!self.query.interval_id) {
        // initially we have to start an interval
        // for checking constantly for an established connection
        // and send the requests
        self.query.interval_id = setInterval(function(){
          if ( (self._queue.started_on+self._queue.ping_timeout) < new Date().getTime() ) {
            // we reached the timeout
            var timeoutReachedMessage = "Timeout of "+(Math.round((self._queue.ping_timeout)/100)/10)+"[s] for neo4j '"+self.baseUrl+"' reached";
            clearInterval(self.query.interval_id);
            self.query.interval_id = null;
            throw Error(timeoutReachedMessage);
          }
          // abort here if we have a process running
          if (self._queue.is_processing)
            return null;
          // process queue only if we have a connection established
          if ((self.connection_established)&&(self._queue.stack.length > 0)) {
            var request = self._queue.stack.pop();        
            self._queue.is_processing = true;
            self.makeRequest(request.options, function(err, result, debug){
              self._queue.is_processing = false;
              request.cb(err, result, debug);
            });
            // stop interval if queue is empty
            if (self._queue.stack.length < 1) {
              clearInterval(self.query.interval_id);
              self.query.interval_id = null;
            }
          } else {
            // check constantly availability
            self._queue.is_processing = true;
            self.checkAvailability(function(err, isAvailable, debug) {
              self.connection_established = isAvailable;
              self._queue.is_processing = false;
            });
          }
          
        }, intervalTime);
      }
    }
  
    Neo4jRestful.prototype.makeRequest = function(_options, cb) {
      _options = _.extend({
        cache: false,
        timeout: 1000
      }, _options);
      var self = this;
      var data = _options.data;
      var options = _options.options;
      var debug = _options.debug;
      var label = _options.label || null;
      
      // use the constructor function of the label if exists
      if (label) {
        var __global__ = (typeof window !== 'undefined') ? window : root;
        label = (typeof __global__[label] === 'function') ? __global__[label] : null;
      }
  
      jQuery.ajax({
        url: _options.requestedUrl,
        type: _options.type,
        headers: this.header,
        data: data,
        cache: _options.cache,
        timeout: _options.timeout,
        success: function(res,status,xhr) {
          if (options.debug) {
            debug.res = res;
            debug.status = status;
          }
          if (status === 'success') {
            if (options.no_processing)
              return cb(null, res, debug);
            if (_.isArray(res)) {
              for (var i=0; i < res.length; i++) {
                res[i] = self.createObjectFromResponseData(res[i], label);
              }
            } else if (_.isObject(res)) {
              res = self.createObjectFromResponseData(res, label);
            }
            cb(null, res, debug);
          } else {
            cb(res, status, debug);
          }
        },
        error: function(err, res) {
  
          var error = ( err && err.responseText ) ? Error(err.responseText) : err;
          if (options.debug) {
            debug.res = res;
            debug.err = err;
            debug.error = error;
          }
          try {
            // try to extract the first <p> or <pre> from html body, else return error object for better debugging
            if (jQuery(err.responseText).find('body pre:first, body p:first')[0])
              error = new Error(jQuery(err.responseText).find('body pre:first, body p:first').text().trim());
            else if (jQuery(err.responseText).text())
              error = jQuery(err.responseText).text().trim()
            else
              error = err
            return cb(error,null, debug);
          } catch(e) {
            // try to create a valuable error object from response
            if ((err)&&(err.responseText)&&(typeof err.responseText === 'string')) {
              try {
                var result = JSON.parse(err.responseText);
                var ErrorHandler = (/^(\/)*db\/data(\/)*$/.test(_options.url)) ? CypherQueryError : QueryError;
                err = new ErrorHandler(result.message, {
                  stacktrace: result.stacktrace,
                  exception: result.exception,
                  statusCode: err.status,
                  url: _options.requestedUrl,
                  method: _options.type,
                  data: data
                });
              } catch (e) {
                self.log('**debug** Could not create/parse a valuable error object', e);
              }
            }
          }
          return cb(err, null, debug);
        }
      })
    }
  
    Neo4jRestful.prototype.get = function(url, options, cb) {
      // TODO: distinct between jquery and request module
      // shorthand, because it's copied on many methods
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.type = 'GET' ) );
      return this.request(url, options, cb);
    }
  
    Neo4jRestful.prototype.post = function(url, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.type = 'POST' ) );
      return this.request(url, options, cb);
    }
    Neo4jRestful.prototype.put = function(url, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.type = 'PUT' ) );
      return this.request(url, options, cb);
    }
  
    Neo4jRestful.prototype.delete = function(url, options, cb) {
      var args;
      ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) && ( options.type = 'DELETE' ) );
      return this.request(url, options, cb);
    }
  
    Neo4jRestful.prototype.log = function(){ /* > /dev/null */ };
  
    Neo4jRestful.prototype.createObjectFromResponseData = function(responseData, Class) {
      var uri = (responseData) ? responseData.self : null;
      var useLabels = true;
      if (typeof Class !== 'function')
        Class = Node;
      if (uri) {
        if (/\/db\/data\/node\/[1-9]{1}[0-9]*\/*$/.test(uri)) {
          // we have a node or an inheriated class
          var n = new Class();
          n = n.populateWithDataFromResponse(responseData);
          return n;
        } else if (/\/db\/data\/relationship\/[1-9]{1}[0-9]*\/*$/.test(uri)) {
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
  
    return Neo4jRestful;
  
  };
  
  if (typeof window !== 'object') {
    // nodejs
    initNeo4jRestful();
    module.exports = exports = Neo4jRestful;
  }
    
  /*
   * include file: 'src/node.js'
   */
  var initNode = function(neo4jrestful) {
  
    var _neo4jrestful = null
      , helpers = null
      , _ = null;
  
    if (typeof window === 'object') {
      // browser
      // TODO: find a solution for bson object id
      helpers = neo4jmapper_helpers;
      _       = window._;
    } else {
      // nodejs
      helpers  = require('./helpers');
      _        = require('underscore')
    }
  
    // we can only check for object type,
    // better would be to check for constructor neo4jrestful
    if (_.isObject(neo4jrestful))
      _neo4jrestful = neo4jrestful;
  
    var cypher_defaults = {
      limit: '',
      skip: '',
      sort: '',
      filter: '',
      return_properties: [],
      where: [],
      // and_where: [],
      from: null,
      to: null,
      direction: null,
      order_by: '',
      order_direction: 'ASC',
      relation: '',
      outgoing: null,
      incoming: null,
      With: null,
      distinct: null,
      label: null,
      // flasgs
      _count: null,
      _distinct: null,
      _find_by_id: null
    };
  
    /*
     * Constructor
     */
    Node = function Node(data, id) {
      this.id = id || null;
      this.data = _.extend(this.data, data);
      this.resetQuery();
      if (id) {
        this.setUriById(id);
      }
      this.fields = _.extend({}, Node.prototype.fields);
      this.is_instanced = true;
      // will be used for labels and classes
      this.constructor_name = helpers.constructorNameOfFunction(this) || 'Node';
      // we will use a label by default if we have defined an inherited class of node
      if ((this.constructor_name !== 'Node')&&(this.constructor_name !== 'Relationship')&&(this.constructor_name !== 'Path')) {
        this.label = this.cypher.label = this.constructor_name;
      }
    }
  
    Node.prototype.neo4jrestful = _neo4jrestful;
    Node.prototype.data = {};
    Node.prototype.id = null;
    Node.prototype.fields = {
      defaults: {},
      indexes: {}
    };
    
    Node.prototype.uri = null;
    Node.prototype._response = null;
    Node.prototype._modified_query = false;
    Node.prototype.is_singleton = false;
    Node.prototype.is_persisted = false;
    Node.prototype.cypher = {};
    Node.prototype.is_instanced = null;
    
    Node.prototype.labels = null;
    Node.prototype.label = null;
    Node.prototype.constructor_name = null;
  
    Node.prototype.__models__ = {};
  
  
    Node.prototype.singleton = function(id) {
      var node = new Node({},id);
      node.neo4jrestful = _neo4jrestful;
      node.resetQuery();
      node.is_singleton = true;
      node.resetQuery();
      return node;
    }
  
    Node.prototype.register_model = function(Class) {
      var name = helpers.constructorNameOfFunction(Class);
      Node.prototype.__models__[name] = Class;
      return Node.prototype.__models__;
    }
  
    Node.prototype.unregister_model = function(Class) {
      var name = (typeof Class === 'string') ? Class : helpers.constructorNameOfFunction(Class);
      if (typeof Node.prototype.__models__[name] === 'function')
        delete Node.prototype.__models__[name];
      return Node.prototype.__models__;
    }
  
    Node.prototype.copyTo = function(n) {
      n.id = this.id;
      n.data = _.extend(this.data);
      n.uri = this.uri;
      n._response = _.extend(this._response);
      return n;
    }
  
    Node.prototype.load = function(cb, options) {
      var self = this;
      var __global__ = (typeof window !== 'undefined') ? window : root;
      if (typeof option === 'undefined')
        options = {}
  
      options = _.extend({ data: false, labels: true, apply: true, reinstance: true}, options);
  
      var self = this;
      var jobsToDo = 0;
      var jobsDone = 0;
  
      var _when = function(err) {
  
        // instance with label, if we have one label in the array
        if ((self.labels)&&(self.labels.length === 1)&&(options.reinstance)) {
          var label = (typeof options.reinstance === 'string') ? options.reinstance : self.labels[0];
          var Class = null;
          if (typeof Node.prototype.__models__[label] === 'function')
            Class = Node.prototype.__models__[label];
          else if (typeof __global__[label] === 'function')
            Class = __global__[label];
          else
            Class = Node;
          if (Class) {
            var node = new Class();
            node.populateWithDataFromResponse(self._response);
            // apply everything on node object
            if (options.apply)
              self = _.extend(self, node);
          }
          // console.log('::',self);
        }
        cb(err || null,self);
      } 
      
      if (this.hasId()) {
        if ((options.labels)&&(this.neo4jrestful.version >= 2)) {
          jobsToDo++;
          this.requestLabels(function(err, labels) {
            if ((labels)&&(options.apply))
              self.labels = labels;
            jobsDone++;
            if (jobsDone >= jobsToDo)
              _when(err);
          });
        }
        if (options.data) {
          jobsToDo++;
          Node.prototype.findById(this.id,function(err, foundNode) {
            if ((foundNode)&&(options.apply))
              self.data = foundNode.data;
            jobsDone++;
            if (jobsDone >= jobsToDo)
              _when(err);
          });
        }
        if (jobsToDo === 0)
          _when(null,null);
      } else {
        cb(Error('Only instanced Nodes can be (re)loaded'));
      }
    }
  
    Node.prototype.resetQuery = function() {
      this.cypher = {}
      _.extend(this.cypher, cypher_defaults);
      this.cypher.where = [];
      this.cypher.return_properties = [];
      this._modified_query = false;
      if (this.id)
        this.cypher.from = this.id;
      return this;
    }
  
    Node.prototype.hasId = function() {
      return ((this.is_instanced) && (this.id > 0)) ? true : false;
    }
  
    Node.prototype.setUriById = function(id) {
      if (_.isNumber(id))
        return this.uri = this.neo4jrestful.baseUrl+'db/data/node/'+id;
    }
  
    Node.prototype.flattenData = function(useReference) {
      // strongly recommend not to mutate attached node's data
      if (typeof useReference !== 'boolean')
        useReference = false;
      this._modified_query = false;
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
      this._modified_query = false;
      var data = (useReference) ? this.data : _.extend(this.data);
      return helpers.unflattenObject(data);
    }
  
    Node.prototype.applyDefaultValues = function() {
      for (var key in this.fields.defaults) {
        if (((typeof this.data[key] === 'undefined')||(this.data[key] === null))&&(typeof this.fields.defaults[key] === 'function'))
          // set a default value by defined function
          this.data[key] = this.fields.defaults[key](this);
      }
      return this;
    }
  
    Node.prototype.hasFieldsToIndex = function() {
      if (this.hasId())
        return _.keys(this.fields.indexes).length;
      else
        return null;
    }
  
    Node.prototype.indexFields = function(cb) {
  
      if (this.hasFieldsToIndex()) {
        // var join = Join.create();
        var doneCount = 0;
        var todoCount = Object.keys(this.fields.indexes).length;
        for (var key in this.fields.indexes) {
          var namespace = this.fields.indexes[key];
          var value = this.data[key];
          if ((_.isString(namespace))&&(typeof value !== 'undefined')&&(value !== null)) {
            this.index(namespace, key, value, function(err, data, debug){
              doneCount = doneCount+1;
              // done
              if (doneCount >= todoCount)
                cb(null, doneCount);
            });
          }
        }
      }
      return null;
    }
  
    Node.prototype.index_schema = function(namespace, fields, cb) {
      // POST http://localhost:7474/db/data/schema/index/person
      var self = this;
      if (_.isString(namespace) && _.isArray(fields)) {
        self.neo4jrestful.post('/db/data/schema/index/'+namespace, { data: fields }, cb);
      }
      return null;
    }
  
    Node.prototype.save = function(cb) {
      var self = this;
      if (typeof this.onBeforeSave === 'function') {
        this.onBeforeSave(function(err) {
          // don't execute if an error is passed through
          if ((typeof err !== 'undefined')&&(err !== null))
            cb(err, null);
          else
            self.executeSave(cb);
        });
      } else {
        this.executeSave(cb);
      }
    }
  
    Node.prototype.executeSave = function(cb) {
      var self = this;
      if (this.is_singleton)
        return cb(Error('Singleton instances can not be persisted'), null);
      this._modified_query = false;
      this.applyDefaultValues();
      var method = null;
  
      function _prepareData(err, data, debug) {
        if (method==='create') {
          // copy persisted data on initially instanced node
          data.copyTo(self);
        }
        self.is_singleton = false;
        self.is_instanced = true;
        self.is_persisted = true;
        // if we have defined fields to index
        // we need to call the cb after indexing
        if (self.hasFieldsToIndex())
          return self.indexFields(function(){
            if (debug)
              debug.indexedFields = true;
            cb(null, data, debug);
          });
        else
          return cb(null, data, debug);
      }
  
      function _onAfterSave(err, data, debug) {
        var labels = self.labelsAsArray();
        if ((typeof err !== 'undefined')&&(err !== null)) {
          return cb(err, data, debug);
        } else {
          if (labels.length > 0) {
            // we need to post the label in an extra reqiuest
            // cypher inappropriate since it can't handle { attributes.with.dots: 'value' } …
            self.neo4jrestful.post('/db/data/node/'+data.id+'/labels', { data: labels }, function(labelError, notUseableData, debugLabel) {
              // add label err if we have one
              if (labelError)
                err = (err) ? [ err, labelError ] : labelError;
              // add debug label if we have one
              if (debug)
                debug = (debugLabel) ? [ debug, debugLabel ] : debug;
              _prepareData(err, data, debug);
            });
          } else {
            return _prepareData(err, data, debug);
          }
        }
      }
  
      if (this.hasId()) {
        method = 'update';
        this.neo4jrestful.put('/db/data/node/'+this.id+'/properties', { data: this.flattenData() }, _onAfterSave);
      } else {
        method = 'create';      
        this.neo4jrestful.post('/db/data/node', { data: this.flattenData() }, _onAfterSave);
      }
    }
  
    Node.prototype.update = function(cb) {
      var self = this;
      if (this.hasId())
        this.save(cb);
      else
        return cb(Error('You have to save() the node one time before you can perform an update'), null);
    }
  
    /*
     * STATIC METHODS
     */ 
  
    Node.prototype.populateWithDataFromResponse = function(data) {
      // if we are working on the prototype object
      // we won't mutate it and create a new node instance insetad
      var node;
      if (!this.is_instanced)
        node = new Node();
      else
        node = this;
      node._modified_query = false;
      if (data) {
        if (_.isObject(data) && (!_.isArray(data)))
          node._response = data;
        else
          node._response = data[0];
        node.data = node._response.data;
        node.data = node.unflattenData();
        node.uri  = node._response.self;
        //'http://localhost:7474/db/data/node/3648'
        if ((node._response.self) && (node._response.self.match(/[0-9]+$/))) {
          node.id = Number(node._response.self.match(/[0-9]+$/)[0]);
        }
      }
      node.is_persisted = true;
      return node;
    }
  
    Node.prototype.find = function(where, cb) {
      var self = this;
      if (!self.is_singleton)
        self = Node.prototype.singleton();
      self._modified_query = true;
      if (typeof where === 'string') {
        self.where(where);
        if (!self.cypher.start) {
          self.cypher.start = 'n = node('+self._start_node_id('*')+')';
        }
        self.exec(cb);
        return self;
      } else {
        return self.findAll(cb);
      }
    }
  
    Node.prototype.findOne = function(cb) {
      var self = this;
      self = this.find(cb);
      self.cypher.limit = 1;
      self.exec(cb);
      return self;
    }
  
    Node.prototype.findById = function(id, cb) {;
      var self = this;
      if (!self.is_singleton)
        self = Node.prototype.singleton();
      self._modified_query = true;
      self.cypher._find_by_id = true;
      self.cypher.from = id;
      self.cypher.start = 'n = node('+id+')';
      self.cypher.return_properties = ['n'];
      self.exec(cb);
      return self;
    }
  
    Node.prototype.findAll = function(cb) {
      var self = this;
      if (!self.is_singleton)
        self = Node.prototype.singleton();
      self._modified_query = true;
      self.cypher.start = 'n = node(*)';
      self.cypher.limit = null;
      self.cypher.return_properties = ['n'];
      self.exec(cb);
      return self;
    }
  
    Node.prototype.findByIndex = function(namespace, key, value, cb) {
      var self = this;
      if (!self.is_singleton)
        self = Node.prototype.singleton();
      var values = {};
      if ((namespace)&&(key)&&(value)&&(typeof cb === 'function')) {
        // values = { key: value };
        // TODO: implement
        return self.neo4jrestful.get('/db/data/index/node/'+namespace+'/'+key+'/'+value+'/', cb);
      } else {
        return cb(Error('Namespace, key, value and mandatory to find indexed nodes.'), null);
      }
    }
  
    Node.prototype.withLabel = function(label, cb) {
      var self = this;
      // return here if we have an instances node
      if (self.hasId())
        return Boolean((self.label) && (self.label.length >0));
      if (typeof label !== 'string')
        return this;
      self._modified_query = true;
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
      return null;
    }
  
    Node.prototype.pathBetween = function(start, end, options, cb) {
      var self = this;
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
        this.cypher.start = 'a = node('+start+'), b = node('+end+')';
        this.cypher.match = 'MATCH p = '+options.algorithm+'(a-['+type+( (options.max_depth>0) ? '..'+options.max_depth : '*' )+']-b)';
        this.cypher.match = this.cypher.match.replace(/\[\:\*+/, '[*');
        this.cypher.return_properties = ['p'];
      }
  
      this.exec(cb);
      return this;
    }
  
    /*
     * eof STATIC METHODS
     */
  
  
    Node.prototype.count = function(identifier, cb) {
      this._modified_query = true;
      this.cypher._count = true;
      if (typeof identifier === 'function') {
        cb = identifier;
        identifier = '*';
      }
      else if (typeof identifier !== 'string')
        identifier = '*';
  
      if (!this.cypher.start) {
        this.cypher.start = 'n = node(*)'; // all nodes by default
      }
      this.cypher.return_properties = 'COUNT('+((this.cypher._distinct) ? 'DISTINCT ' : '')+identifier+')';
      if (this.cypher._distinct)
        this.cypher._distinct = false;
      // we only need the count column to return in this case
      if (typeof cb === 'function')
        this.exec(function(err, result, debug){
          if ((result)&&(result.data)) {
            if (result.data.length === 1)
              result = result.data[0][0];
          }
          cb(err, result, debug);
        });
      return this;
    }
  
    Node.prototype._prepareQuery = function() {
      var query = _.extend(this.cypher);
  
      var match = (query.match) ? query.match : '';
  
      if (!query.start) {
        if (query.from > 0) {
          query.start = 'a = node('+query.from+')';
          query.return_properties.push('a');
        }
        if (query.to > 0) {
          query.start += ', b = node('+query.to+')';
          query.return_properties.push('b');
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
  
      // build in/outgoing directions
      if ((query.incoming)||(query.outgoing)) {
        // query.outgoing = (query.outgoing) ? query.outgoing : '-';
        // query.incoming = (query.incoming) ? query.incoming : '-';
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
        query.match = 'MATCH (a)'+x+'[r'+relationships+']'+y+'('+( (this.cypher.to > 0) ? 'b' : '' )+')';
      }
      // guess return objects from start string if it's not set
      // e.g. START n = node(*), a = node(2) WHERE … RETURN (~>) n, a;
      if ((!query.return_properties)||((query.return_properties)&&(query.return_properties.length == 0)&&(query.start))) {
        var _start = ' '+query.start
        if (/ [a-zA-Z]+ \= /.test(_start)) {
          var matches = _start;
          query.return_properties = [];
          matches = matches.match(/[\s\,]([a-z]+) \= /g);
          for (var i = 0; i < matches.length; i++) {
            query.return_properties.push(matches[i].replace(/^[\s\,]*([a-z]+).*$/i,'$1'));
          }
          query.return_properties = query.return_properties.join(', ');
        }
      }
      return query;
    }
  
    Node.prototype.toCypherQuery = function() {
      var query = this._prepareQuery();
      var template = "";
      template += "START %(start)s ";
      template += "%(match)s ";
      template += "%(With)s ";
      template += "%(where)s ";
      template += "%(action)s %(return_properties)s %(order_by)s %(skip)s %(limit)s;";
  
      var cypher = helpers.sprintf(template, {
        start:              query.start,
        from:               '',
        match:              (query.match) ? query.match : '',
        With:               (query.With) ? query.With : '',
        action:             (query.action) ? query.action : 'RETURN'+((query._distinct) ? ' DISTINCT ' : ''),
        return_properties:  query.return_properties,
        where:              ((query.where)&&(query.where.length > 0)) ? 'WHERE '+query.where.join(' AND ') : '',
        to:                 '',
        order_by:           (query.order_by) ? 'ORDER BY '+query.order_by+' '+query.order_direction : '',
        limit:              (query.limit) ? 'LIMIT '+query.limit : '',
        skip:               (query.skip) ? 'SKIP '+query.skip : ''  
      })
      cypher = cypher.trim().replace(/\s+;$/,';');
      return cypher;
    }
  
    Node.prototype._start_node_id = function(fallback) {
      if (typeof fallback === 'undefined')
        fallback = '*'
      if (this.cypher.from > 0)
        return this.cypher.from;
      return (this.hasId()) ? this.id : fallback; 
    };
  
    Node.prototype._end_node_id = function(fallback) {
      if (typeof fallback === 'undefined')
        fallback = '*'
      return (this.cypher.to > 0) ? this.cypher.to : fallback; 
    };
  
    /*
     * Return Node::findById() if we have node with an id, else current object
     * Used to construct a query object for instanced nodes
     */
    Node.prototype.singletonForQuery = function() {
      return (this.hasId()) ? Node.prototype.findById(this.id) : this;
    }
  
    // Node.prototype.getRelationships = function(options,cb) {
    //   this._modified_query = false;
    //   if (_.isString(options)) {
    //     options = { type: options };
    //   }
    //   // use default options as template
    //   options = _.extend({
    //     direction: 'all',
    //     from_id: this.id,
    //     to_id: null,
    //     type: ''
    //   }, options);
    //   if (_.isArray(options.type))
    //     options.type = options.type.join('&');
    //   if ((options.from_id)&&(typeof cb === 'function'))
    //     this.neo4jrestful.get('/db/data/node/'+from_id+'/relationships/'+direction+'/'+type, cb);
    // }
  
    Node.prototype.incomingRelationships = function(relation, cb) {
      var self = this.singletonForQuery();
      self._modified_query = true;
      if (typeof relation !== 'function') {
        self.cypher.relationship = relation;
        
      } else {
        cb = relation;
      }
      self.cypher.start = 'a = node('+self._start_node_id('*')+')';
      self.cypher.start += (self.cypher.to > 0) ? ', b = node('+self._end_node_id('*')+')' : ''
      self.cypher.incoming = true;
      self.cypher.outgoing = false;
      self.cypher.return_properties = ['r'];
      self.exec(cb);
      return self;
    }
  
    Node.prototype.outgoingRelationships = function(relation, cb) {
      var self = this.singletonForQuery();
      self._modified_query = true;
      if (typeof relation !== 'function') {
        self.cypher.relationship = relation;
        cb = relation;
      } else {
        cb = relation;
      }
      self.cypher.start = 'a = node('+self._start_node_id('*')+')';
      self.cypher.start += (self.cypher.to > 0) ? ', b = node('+self._end_node_id('*')+')' : ''
      self.cypher.incoming = false;
      self.cypher.outgoing = true;
      self.cypher.return_properties = ['r'];
      self.exec(cb);
      return self;
    }
  
    Node.prototype.incomingRelationshipsFrom = function(node, relation, cb) {
      var self = this.singletonForQuery();
      self._modified_query = true;
      self.cypher.from = self.id || null;
      self.cypher.to = helpers.getIdFromObject(node);
      if (typeof relation !== 'function')
        self.cypher.relationship = relation;
      self.cypher.return_properties = ['r'];
      return self.incomingRelationships(relation, cb);
    }
  
    Node.prototype.outgoingRelationshipsTo = function(node, relation, cb) {
      var self = this.singletonForQuery();
      self._modified_query = true;
      self.cypher.to = helpers.getIdFromObject(node);
      if (typeof relation !== 'function')
        self.cypher.relationship = relation;
      self.cypher.return_properties = ['r'];
      self.exec(cb);
      return self.outgoingRelationships(relation, cb);
    }
  
    Node.prototype.allDirections = function(relation, cb) {
      var self = this.singletonForQuery();
      self._modified_query = true;
      if (typeof relation !== 'function')
        self.cypher.relationship = relation;
      self.cypher.start = 'a = node('+self._start_node_id('*')+'), b = node('+self._end_node_id('*')+')';
      self.cypher.incoming = true;
      self.cypher.outgoing = true;
      self.cypher.return_properties = ['a', 'b', 'r'];
      self.exec(cb);
      return self;
    }
  
    Node.prototype.relationshipsBetween = function(node, relation, cb) {
      var self = this.singletonForQuery();
      self._modified_query = true;
      self.cypher.to = helpers.getIdFromObject(node);
      if (typeof relation !== 'function')
        self.cypher.relationship = relation;
      self.cypher.return_properties = ['r'];
      self.exec(cb);
      return self.allDirections(relation, cb);
    }
  
    Node.prototype.allRelationships = function(cb) {
      var self = this.singletonForQuery();
      self._modified_query = true;
      self.cypher.match = 'MATCH n-[r]-()';
      self.cypher.return_properties = ['r'];
      self.exec(cb);
      return self;
    }
  
    Node.prototype.limit = function(limit, cb) {
      this._modified_query = true;
      this.cypher.limit = Number(limit);
      this.exec(cb);
      return this;
    }
  
    Node.prototype.skip = function(skip, cb) {
      this._modified_query = true;
      this.cypher.skip = Number(skip);
      this.exec(cb);
      return this;
    }
  
    Node.prototype.distinct = function(cb) {
      this._modified_query = true;
      this.cypher._distinct = true;
      this.exec(cb);
      return this;
    }
  
    Node.prototype.orderBy = function(property, direction, cb) {
      this._modified_query = true;
      if (typeof direction === 'string')
        this.cypher.order_direction = direction;
      this.cypher.order_by = property;
      this.exec(cb);
      return this;
    }
  
    Node.prototype.where = function(where, cb) {
      this._modified_query = true;
      this.cypher.where = [];
      return this.andWhere(where, cb);
    }
  
    Node.prototype.andWhere = function(where, cb, _options) {
      this._modified_query = true;
      if ((_.isObject(where))&&(!_.isArray(where)))
        where = [ where ];
      var attributes = helpers.extractAttributesFromCondition(_.extend(where));
      for (var i = 0; i < attributes.length; i++) {
        this.whereHasProperty(attributes[i]);
      }
      if (typeof _options === 'undefined')
        _options = {};
      if (typeof _options.identifier !== 'string')
        // good or bad idea that we use by default n as identifier?
        _options.identifier = 'n';
      this.cypher.where.push(helpers.conditionalParameterToString(_.extend(where),undefined,_options));
      this.exec(cb);
      return this;
    }
  
    // Node.prototype.orWhere = function(where, cb) {
    //   this.cypher.where = [ { '$or': [ this.cypher.where, where ] } ];
    //   this.exec(cb);
    //   return this;
    // }
  
    // Node.prototype.whereNot = function(where, cb){
    //   if (typeof where !== 'object')
    //     return this;
    //   this.cypher.where = [];
    //   return this.where({ '$not': where }, cb);
    // }
    
    Node.prototype.whereStartNode = function(where, cb) {
      this.cypher.where = [];
      return this.andWhere(where, cb, { identifier: 'a' });
    }
  
    Node.prototype.whereEndNode = function(where, cb) {
      this.cypher.where = [];
      return this.andWhere(where, cb, { identifier: 'b' });
    }
  
    Node.prototype.whereNode = function(where, cb) {
      this.cypher.where = [];
      return this.andWhere(where, cb, { identifier: 'n' });
    }
  
    Node.prototype.whereRelationship = function(where, cb) {
      this.cypher.where = [];
      return this.andWhere(where, cb, { identifier: 'r' });
    }
  
    Node.prototype.andWhereStartNode = function(where, cb) {
      return this.andWhere(where, cb, {identifier: 'a' });
    }
  
    Node.prototype.andWhereEndNode = function(where, cb) {
      return this.andWhere(where, cb, { identifier: 'b' });
    }
  
    Node.prototype.andWhereNode = function(where, cb) {
      return this.andWhere(where, cb, { identifier: 'n' });
    }
  
    Node.prototype.andWereRelationship = function(where, cb) {
      return this.andWhere(where, cb, { identifier: 'r' });
    }
  
    Node.prototype.whereHasProperty = function(property, identifier, cb) {
      if (_.isFunction(identifier)) {
        cb = identifier;
        identifier = null;
      }
      this._modified_query = true;
      if (typeof property !== 'string') {
        // we need a property to proceed
        return cb(Error('Property name is mandatory.'),null);
      }
      if (this.cypher.return_properties.length === 0) {
        this.findAll();
      }
      // no identifier found, guessing from return properties
      if (typeof identifier !== 'string')
        identifier = this.cypher.return_properties[this.cypher.return_properties.length-1];
      this.andWhere('HAS ('+identifier+'.'+property+')');
      this.exec(cb);
      return this;
    }
  
    Node.prototype.whereNodeHasProperty = function(property, cb) {
      return this.whereHasProperty(property, 'n', cb);
    }
  
    Node.prototype.whereStartNodeHasProperty = function(property, cb) {
      return this.whereHasProperty(property, 'a', cb);
    }
  
    Node.prototype.whereEndNodeHasProperty = function(property, cb) {
      return this.whereHasProperty(property, 'b', cb);
    }
  
    Node.prototype.whereRelationshipHasProperty = function(property, cb) {
      return this.whereHasProperty(property, 'r', cb);
    }
  
    Node.prototype.delete = function(cb) {
      if (this.hasId())
        return cb(Error('To delete a node, use remove(). delete() is for queries.'),null);
      this._modified_query = true;
      this.cypher.action = 'DELETE';
      this.cypher.limit = '';
      this.exec(cb);
      return this;
    }
  
    Node.prototype.remove = function(cb) {
      var self = this;
      if (typeof this.onBeforeRemove === 'function') {
        // execute hook
        this.onBeforeRemove(function(err,data){
          // don't execute if an error is passed through
          if ((typeof err !== 'undefined')&&(err !== null))
            cb(err, null);
          else
            self.execRemove(cb);
        });
      } else {
        self.execRemove(cb);
        return this;
      }
    }
  
    Node.prototype.execRemove = function(cb) {
      if (this.is_singleton)
        return cb(Error("To delete results of a query use delete(). remove() is for removing an instanced node."),null);
      if (this.hasId()) {
        return this.neo4jrestful.delete('/db/data/node/'+this.id, cb);
      }
      return this;
    }
  
    Node.prototype.removeWithRelationships = function(cb) {
      var self = this;
      return this.removeAllRelationships(function(err) {
        if (err)
          return cb(err, null);
        // remove now node
        return self.remove(cb);
      });
    }
  
    // Node.prototype.removeRelationshipsFrom = function() { }
    // Node.prototype.removeRelationshipsTo = function() { }
    // Node.prototype.removeRelationshipsBetween = function() {}
    Node.prototype.removeOutgoinRelationships = function(type, cb) {
      return this.removeRelationships(type, cb, { direction: '->' });
    }
    Node.prototype.removeIncomingRelationships = function(type, cb) {
      return this.removeRelationships(type, cb, { direction: '<-' });
    }
  
    Node.prototype.removeAllRelationships = function(cb) {
      return this.removeRelationships('', cb);
    }
    Node.prototype.removeRelationships = function(type, cb, _options) {
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
        return Node.prototype.findById(this.id)[direction+'Relationships']().delete(cb);
      } else {
        return cb(Error("You can remove relationships only from an instanced node /w a valid cb"), null);
      }
    }
  
    Node.prototype.createRelationship = function(options, cb) {
      options = _.extend({
        from_id: this.id,
        to_id: null,
        type: null,
        // unique: false ,// TODO: implement!
        properties: null
      }, options);
      if ((_.isNumber(options.from_id))&&(_.isNumber(options.to_id))&&(typeof cb === 'function')) {
        return this.neo4jrestful.post('/db/data/node/'+options.from_id+'/relationships', {
          data: {
            to: new Node({},options.to_id).uri,
            type: options.type,
            data: options.properties
          }
        }, cb);
      } else {
        cb(new Error('Missing from_id('+options.from_id+') or to_id('+options.to_id+'), please check.'), null);
      }
    }
  
    Node.prototype.createRelationshipBetween = function(node, type, properties, cb) {
      var self = this;
      if (typeof properties === 'function') {
        cb = properties;
        properties = {};
      }
      if ((this.hasId())&&(helpers.getIdFromObject(node))) {
        // to avoid deadlocks
        // we have to create the relationships sequentially
        self.createRelationshipTo(node, type, properties, function(err, resultFirst){
          self.createRelationshipFrom(node, type, properties, function(secondErr, resultSecond) {
            if ((err)||(secondErr)) {
              if ((err)&&(secondErr))
                cb([err, secondErr], null);
              else
                cb(err || secondErr, null);
            } else {
              cb(null, [ resultFirst, resultSecond ]);
            }
          });
        });
      } else {
        cb(Error("You need two instanced nodes as start and end point."), null);
      }
      
    }
  
    Node.prototype.createRelationshipTo = function(node, type, properties, cb) {
      var args;
      var id = helpers.getIdFromObject(node);
      ( ( args = helpers.sortOptionsAndCallbackArguments(properties, cb) ) && ( properties = args.options ) && ( cb = args.callback ) );
      var options = {
        properties: properties,
        to_id: id,
        type: type
      };
      return this.createRelationship(options, cb);
    }
    /**
     * @param {Object} node
     * @param {String} type
     * @param {Object} [properties]
     * @param {Function} cb
     */
    Node.prototype.createRelationshipFrom = function(node, type, properties, cb) {
      var args;
      var id = helpers.getIdFromObject(node);
      ( ( args = helpers.sortOptionsAndCallbackArguments(properties, cb) ) && ( properties = args.options ) && ( cb = args.callback ) );
      var options = {
        properties: properties,
        from_id: id,
        to_id: this.id,
        type: type
      };
      return this.createRelationship(options, cb);
    }
  
    Node.prototype.requestLabels = function(cb) {
      if ((this.hasId())&&(typeof cb === 'function')) {
        this.neo4jrestful.get('/db/data/node/'+this.id+'/labels', cb);
      }
      return this;
    }
  
    Node.prototype.labelsAsArray = function() {
      var labels = this.labels;
      if (!_.isArray(labels))
        labels = [];
      if (this.label)
        labels.push(this.label);
      return _.uniq(labels);
    }
  
    // TODO: autoindex? http://docs.neo4j.org/chunked/milestone/rest-api-configurable-auto-indexes.html
    Node.prototype.index = function(namespace, key, value, cb) {
      if (this.is_singleton)
        return cb(Error('Singleton instance is not allowed to get persist.'), null);
      this._modified_query = false;
      if ( (!namespace) || (!key) || (!value) || (!_.isFunction(cb)) )
        throw Error('namespace, key and value arguments are mandatory for indexing.');
      if (!this.hasId())
        return cb(Error('You need to persist the node before you can index it.'),null);
      if (typeof cb === 'function')
        return this.neo4jrestful.post('/db/data/index/node/'+namespace, { data: { key: key, value: value, uri: this.uri } }, cb);
      else
        return null;
      return keys;
    }
  
    Node.prototype.toObject = function() {
      return {
        id: this.id,
        data: _.extend(this.data),
        uri: this.uri
      };
    }
  
    /*
     * Request methods
     */
  
    Node.prototype.stream = function(cb) {
      this.neo4jrestful.header['X-Stream'] = 'true';
      this.exec(cb);
      return this;
    }
  
    Node.prototype.exec = function(cb) {
      var self = this;
      if (typeof cb === 'function') {
        var cypher = this.toCypherQuery();
        // reset node, because it might be called from prototype
        // if we have only one return property, we resort this
        if ( (this.cypher.return_properties)&&(this.cypher.return_properties.length === 1) ) {
          var options = {};
          if (this.label)
            options.label = this.label;
          return this.neo4jrestful.query(cypher, options, function(err, data, debug) {
            if (err)
              return cb(err, data, debug);
            else {
              var sortedData = [];
              for (var x=0; x < data.data.length; x++) {
                //sortedData.push(data.data[x][0]);
                sortedData.push(
                  self.neo4jrestful.createObjectFromResponseData(data.data[x][0])
                );
              }
              if ( (self.cypher._find_by_id) && (self.cypher.return_properties.length === 1) && (self.cypher.return_properties[0] === 'n') && (sortedData[0]) )
                sortedData = sortedData[0];
              else if ( (self.cypher.limit === 1) && (sortedData.length === 1) )
                sortedData = sortedData[0];
              return cb(err, sortedData, debug);
            }
          });
        } else {
          return this.neo4jrestful.query(cypher, cb);
        }
        
      }
      return null;
    }
    return Node;
  }
  
  if (typeof window !== 'object') {
    module.exports = exports = initNode;
  }  
  /*
   * include file: 'src/path.js'
   */
  var initPath = function(neo4jrestful) {
  
    var _neo4jrestful = null
      , helpers       = null
      , _             = null
  
    if (typeof window === 'object') {
      // browser
      helpers = neo4jmapper_helpers;
      _       = window._;
    } else {
      // nodejs
      helpers = require('./helpers')
      _       = require('underscore');
    }
  
    if (_.isObject(neo4jrestful))
      _neo4jrestful = neo4jrestful;
  
    /*
     * Constructor
     */
    Path = function Path(data) {
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
  
    Path.prototype.neo4jrestful = _neo4jrestful;
    Path.prototype.from = null;
    Path.prototype.to = null;
    Path.prototype.start = null;
    Path.prototype.end = null;
    Path.prototype.length = 0;
    Path.prototype.relationships = null;
    Path.prototype.nodes = null;
    Path.prototype._response = null;
    Path.prototype.is_singleton = false;
    Path.prototype.is_persisted = false;
    Path.prototype.is_instanced = null;
  
    Path.prototype.singleton = function() {
      var path = new Path();
      path.neo4jrestful = _neo4jrestful;
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
          path._response = data;
        else
          path._response = data[0];
  
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
  
    Path.prototype.toObject = function() {
      return {
        start: this.start,
        end: this.end,
        from: _.extend(this.from),
        to: _.extend(this.to),
        relationships: _.extend(this.relationships),
        nodes: _.extend(this.nodes)
      };
    }
  
    return Path;
  
  }
  
  if (typeof window !== 'object') {
    module.exports = exports = initPath;
  }  
  /*
   * include file: 'src/relationship.js'
   */
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
  /*
   * include file: 'src/graph.js'
   */
  var initGraph = function(neo4jrestful) {
  
    var _       = null
      , helpers = null;
  
    if (typeof window === 'object') {
      helpers = neo4jmapper_helpers;
      _       = window._();
    } else {
      helpers = require('./helpers');
      _       = require('underscore');
    }
  
    /*
     * Constructor
     */
    Graph = function() {
      this.about();
    }
  
    Graph.prototype.info = null;
  
    /*
     * Shorthand for neo4jrestul.query
     */
    Graph.prototype.query = function(cypher, options, cb) {
      return neo4jrestful.query(cypher,options,cb);
    }
  
    /*
     * Delete *all* nodes and *all* relationships
     */ 
    Graph.prototype.wipeDatabase = function(cb) {
      var query = "START n=node(*) MATCH n-[r?]-() DELETE n, r;";
      return this.query(query,cb);
    }
  
    Graph.prototype.countAllOfType = function(type, cb) {
      var query = '';
      if (type === 'node')
        query = "START n=node(*) RETURN count(n);"
      else if (type === 'relationship')
        query = "START r=relationship(*) RETURN count(r);";
      else
        query = "START n=node(*) MATCH n-[r?]-() RETURN count(n), count(r);";
      return this.query(query,function(err,data){
        if ((data)&&(data.data)) {
          var count = data.data[0][0];
          if (typeof data.data[0][1] !== 'undefined')
            count += data.data[0][1];
          return cb(err, count);
        }
        cb(err,data);
      });
    }
  
    Graph.prototype.countRelationships = function(cb) {
      return this.countAllOfType('relationship', cb);
    }
  
    Graph.prototype.countNodes = function(cb) {
      return this.countAllOfType('node', cb);
    }
  
    Graph.prototype.countAll = function(cb) {
      return this.countAllOfType('all', cb);
    }
  
    Graph.prototype.about = function(cb) {
      var self = this;
      if (this.info)
        return cb(null,info);
      else
        return neo4jrestful.get('/db/data/', function(err, info){
          if (info) {
            self.info = info
          }
          if (typeof cb === 'function')
            cb(err,info);
        });
    }
  
    Graph.prototype.log = function(){ /* > /dev/null */ };
  
    return Graph;
  }
  
  if (typeof window !== 'object') {
    // nodejs
    module.exports = exports = function(neo4jrestful) {
      return initGraph(neo4jrestful);
    }
  }  
  /*
   * include file: 'src/browser/browser_footer.js'
   */
  
  return window.Neo4jMapper = Neo4jMapper = {
    init: function(url, options) {
      if (typeof url === 'object') {
        options = url;
      } else {
        options = {};
        if (typeof url === 'string')
          options.url = url;
      }
  
      url = options.url;
  
      if (typeof url !== 'string')
        throw Error('You need to pass an url as argument to connect to neo4j');
  
      this.Neo4jRestful  = initNeo4jRestful();
      this.neo4jrestful  = this.client = new this.Neo4jRestful(url);
      this.Node          = initNode(this.neo4jrestful);
      this.Relationship  = initRelationship(this.neo4jrestful);
      this.Graph         = initGraph(this.neo4jrestful);
      this.Path          = initPath(this.neo4jrestful);
      this.helpers       = neo4jmapper_helpers;
      return this;
    },
    Neo4jRestful: null,
    neo4jrestful: null, // TODO: this is redundant /w client, check where it's needed
    Node: null,
    Relationship: null,
    Graph: null,
    Path: null,
    helpers: null,
    client: null,
  }
  
})();