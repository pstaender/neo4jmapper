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
  if (typeof window.superagent === 'undefined')
    throw Error('Include of superagent library is needed')
  
  window.Neo4jMapper = Neo4jMapper = {
    init: null,
    Neo4jRestful: null,
    neo4jrestful: null, // TODO: this is redundant /w client, check where it's needed
    Node: null,
    Relationship: null,
    Graph: null,
    Path: null,
    helpers: null,
    client: null
  };
    
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
  
    var isValidData = function(data) {
      return Boolean( (typeof data === 'object') && (data !== null) );
    }
  
    return neo4jmapper_helpers = {
      sortStringAndOptionsArguments: sortStringAndOptionsArguments,
      sortOptionsAndCallbackArguments: sortOptionsAndCallbackArguments,
      sortStringAndCallbackArguments: sortStringAndCallbackArguments,
      flattenObject: flattenObject,
      unflattenObject: unflattenObject,
      conditionalParameterToString: conditionalParameterToString,
      extractAttributesFromCondition: extractAttributesFromCondition,
      getIdFromObject: getIdFromObject,
      escapeString: escapeString,
      sprintf: sprintf,
      constructorNameOfFunction: constructorNameOfFunction,
      cypherKeyValueToString: cypherKeyValueToString,
      isValidData: isValidData
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
      , jQuery              = null
      , request             = null
      , Sequence            = null
      , JSONStream          = null;
  
    if (typeof window === 'object') {
      // browser
      helpers      = neo4jmapper_helpers;
      node         = initNode;
      path         = initPath;
      relationship = initRelationship;
      _            = window._;
      jQuery       = window.jQuery;
      Sequence     = window.Sequence;
      request      = window.superagent;
    } else {
      // nodejs
      helpers      = require('./helpers');
      _            = require('underscore');
      jQuery       = require('jquery');
      node         = require('./node');
      relationship = require('./relationship');
      path         = require('./path');
      Sequence     = require('./lib/sequence');
      request      = require('superagent');
      JSONStream   = require('JSONStream');
    }
  
    // Base for QueryError and CypherQueryError
    var CustomError = function(message) {
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
    Neo4jRestful = function Neo4jRestful(url, options) {
      var self = this;
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
        if (!/http(s)*\:\/\/.+(\:[0-9]+)*\//.test(options.url)) {
          var message = "Your URL ("+url+") needs to match the default url pattern 'http(s)://domain(:port)/…'";
          throw Error(message);
        }
      } else {
        throw Error('No url found. Argument must be either an URL as string or an option object including an `.url` property.');
      }
  
      self.baseUrl = options.url;
  
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
      // copy header
      self.header = _.extend({}, Neo4jRestful.prototype.header);
      self.checkAvailability(function(err, isAvailable, debug) {
        self.connection_established = isAvailable;
      });
    }
  
    Neo4jRestful.prototype.options = null;
    Neo4jRestful.prototype.header = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    Neo4jRestful.prototype.timeout = 5000;
    Neo4jRestful.prototype.baseUrl = null;
    Neo4jRestful.prototype.debug = null;
    Neo4jRestful.prototype._absoluteUrl = null;
    Neo4jRestful.prototype.exact_version = null;
    Neo4jRestful.prototype.version = null;
    Neo4jRestful.prototype.ignore_exception_pattern = /^(Node|Relationship)NotFoundException$/;
  
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
            params: options.params || {}
          }
        }, function(err, result, debug){
          return cb(err, result, debug);
        });
      }
    }
  
    Neo4jRestful.prototype.checkAvailability = function(cb) {
      var self = this;
      request.get(self.baseUrl+'db/data/')
        .timeout(this.timeout)
        .end(function(err, res) {
          var body = (res) ? res.body : null;
          if ((typeof res !== 'undefined') && (res.status === 200)&&(body)&&(body.neo4j_version)) {
            self.exact_version = body.neo4j_version;
            self.version = Number(self.exact_version.replace(/^([0-9]+\.*[0-9]*)(.*)$/, '$1'));
            var error = (self.version < 2) ? Error('Neo4jMapper is not build+tested for neo4j version below v2') : null;
            cb(error, body.neo4j_version);
          } else {
            throw Error("Can't detect neo4j… Sure your using correct url / neo4j service is available? ("+self.baseUrl+")");
          }
        });
    }
  
    Neo4jRestful.prototype.absoluteUrl = function() {
      if (this.url) {
        if (/^(\/\/|http(s)*\:\/\/)/.test(this.url)) {
          // TODO: check for http or https, but would cost a extra call
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
        debug: false,
        // use copy of header, not reference
        header: _.extend({},this.header)
      };
      if (typeof options === 'undefined')
        options = _.extend({},defaultOptions);
      else
        options = _.extend(defaultOptions, options);  
      this.url = url;
      var requestedUrl = this.absoluteUrl();
      var type = options.type;
      var data = options.data;
      this.header = _.extend({}, this.header, options.header);
  
      if ( (typeof data === 'object') && (data !== null) )
       data = JSON.stringify(options.data);
      
      // this.log('**debug**', 'URI:', type+":"+requestedUrl);
      // this.log('**debug**', 'sendedData:', data);
      // this.log('**debug**', 'sendedHeader:', this.header);
  
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
          header: this.header,
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
        url: url
      };
  
      return this.makeRequest(_options, cb);
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
      var self = this;
      var todo = 0;
      var done = 0;
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
  
    Neo4jRestful.prototype.makeRequest = function(_options, cb) {
      _options = _.extend({
        cache: false,
        timeout: this.timeout,
        loadNode: true // enables the load hooks
      }, _options);
      var self = this;
      var data = _options.data;
      var options = _options.options;
      options.absolute_url = _options.requestedUrl;
      options.url = _options.url;
      options.method = _options.type;
      options._debug = _options.debug;
  
      var req = request(options.method, options.absolute_url).set(this.header);
  
      if (data) {
        req.send(data)
      }
  
      this.log('**debug**', 'URI:', options.method+":"+options.url);
      this.log('**debug**', 'sendedData:', data);
      this.log('**debug**', 'sendedHeader:', this.header);
      
      // stream
      if (this.header['X-Stream'] === 'true') {
  
        var stream = JSONStream.parse(['data', true]);
  
        stream.on('data', cb);
        stream.on('end', function() {
          // prevent to pass undefined, but maybe an undefined is more clear
          cb(null, null);
        });
  
        stream.on('root', function(root, count) {
          // remove x-stream from header
          delete self.header['X-Stream'];
          if (!count) {
            cb(null, Error('No matches in stream found ('+ root +')'));
          }
        });
  
        req.pipe(stream);
      }
      // or send response
      else {
        req.end(function(err, res) {
          if (err) {
            self.onError(cb, err, 'error', options);
          } else {
            if (res.statusType !== 2) {
              // err
              self.onError(cb, res.body, 'error', options);
            } else {
              self.onSuccess(cb, res.body, 'success', options);
            }
          }
        });
      }
    }
  
    Neo4jRestful.prototype.get = function(url, options, cb) {
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
  // ## Node Object
  //
  // The Node object is to create, connect and query all kind of Node(s).
  // You can register your own model
  
  
  // Requirements (for browser and nodejs):
  // * neo4jmapper helpers
  // * underscorejs
  // * sequence (https://github.com/coolaj86/futures)
  var helpers = null
    , _ = null
    , Sequence = null;
  
  if (typeof window === 'object') {
    // browser
    // TODO: find a solution for bson object id
    helpers  = neo4jmapper_helpers;
    _        = window._;
    Sequence = window.Sequence;
  } else {
    helpers  = require('./helpers');
    _        = require('underscore');
    Sequence = require('./lib/sequence');
  }
  
  var cypher_defaults = {
    limit: '',              // Number
    skip: '',               // Number
    filter: '',             // `FILTER`   statement
    match: '',              // `MATCH`    statement
    start: '',              // `START`    statement
    set: '',                // `SET`      statement
    With: null,             // `WITH`     statement
    distinct: null,         // `DISTINCT` option
    return_properties: [],  // [a|b|n|r|p], will be joined with `, `
    where: [],              // `WHERE`  statements, will be joined with `AND`
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
    // Boolean flags
    _count: null,
    _distinct: null,
    by_id: null
  };
  
  // ### Constructor
  // calls this.init(data,id) to set all values to default
  Node = function Node(data, id) {
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
    this.labels = [];
    this.is_instanced = true;
    // we will use a label by default if we have defined an inherited class of node
    if ((this.constructor_name !== 'Node')&&(this.constructor_name !== 'Relationship')&&(this.constructor_name !== 'Path')) {
      this.label = this.cypher.label = this.constructor_name;
    }
    // each node gets it's own client
    this.neo4jrestful = _.extend({}, Node.prototype.neo4jrestful);
    this.neo4jrestful.header = _.extend({}, Node.prototype.neo4jrestful.header);
  }
  
  // ### Instantiate a node from a specific model
  // Model can be a constructor() or a String
  // and must be registered in Node.registered_models()
  Node.prototype.convert_node_to_model = function(node, model, fallbackModel) {
    if (node.hasId()) {
      if (typeof fallbackModel !== 'function')
        fallbackModel = this.constructor;
      if (typeof model === 'function') {
        model = model.constructor_name || helpers.constructorNameOfFunction(model) || null;
      } else if (node.label) {
        model = node.label;
      } else if (typeof fallbackModel === 'function') {
        model = helpers.constructorNameOfFunction(fallbackModel);
      } else {
        throw Error('No model or label found')
      }
      var Class = Node.registered_model(model) || fallbackModel;
      var singleton = new Class()
      // node.constructor_name = singleton.constructor_name;
      return node.copyTo(singleton);
    }
    return null;
  }
  
  Node.__models__ = {};                             // contains globally all registeresd models
  
  Node.prototype.neo4jrestful = null;               // will be initialized
  Node.prototype.data = {};                         // will contain all data for the node
  Node.prototype.id = null;                         // ”public“ id attribute
  Node.prototype._id_ = null;                       // ”public“ id attribute (to ensure that this.id deosn't get manipulated accidently)
  // can be used to define schema-like-behavior
  // TODO: implement unique
  Node.prototype.fields = {
    defaults: {},
    indexes: {},
    unique: {}
  };
  
  Node.prototype.uri = null;                        // uri of the node
  Node.prototype._response = null;                  // original response object
  Node.prototype._modified_query_ = false;          // flag to remember that a query chaining method was invoked 
  Node.prototype._stream_ = null;                   // flag for processing result data
  Node.prototype.is_singleton = false;              // flag that this object is a singleton
  Node.prototype.is_persisted = false;              // flag that this object is stored at least once in the db
  Node.prototype.cypher = {};                       // will be overwritten with the default values of `cypher_defaults`
  Node.prototype.is_instanced = null;               // flag that this object is instanced
  
  Node.prototype.labels = null;                     // an array of all labels
  Node.prototype.label = null;                      // will be set with a label a) if only one label exists b) if one label matches to model
  //TODO: check that it's still needed
  Node.prototype.constructor_name = null;           // will be with the name of the function of the constructor
  
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
      return this.onBeforeInitialize(function(err){
        self.onAfterInitialize(cb);
      });
    } else {
      return cb(null, this);
    }
  }
  
  // ### Hook: onBeforeInitialize
  // Can be monkey-pacthed and be used to execute code
  // on prototype base during registering a model
  // HINT: call the cb() finnaly  
  Node.prototype.onBeforeInitialize = function(next) {
    next(null,null);
  }
  
  // ### Internal Hook: onAfterInitialize
  // Ensures indexes on all defined fields
  // TODO: implement ensure unique fields
  Node.prototype.onAfterInitialize = function(cb) {
    var self = this;
    this.__already_initialized__ = true;
    // Index fields
    var fieldsToIndex = this.fieldsForAutoindex();
    var fieldsWithUniqueValues = this.fieldsWithUniqueValues();
    // we create an object to get the label
    var node = new this.constructor();
    var label = node.label;
    if (label) {
      if (fieldsToIndex.length > 0) {
        node.ensureIndex({ label: label, fields: fieldsToIndex }, function(err){
          cb(null, self);
        });
      }
      // inactive
      // http://docs.neo4j.org/chunked/snapshot/query-constraints.html
      /*
      if (fieldsWithUniqueValues === 'deactivated, because it´s not implemented in neo4j, yet') {
        _.each(fieldsWithUniqueValues, function(isUnique, field) {
          if (isUnique)
            //CREATE CONSTRAINT ON (book:Book) ASSERT book.isbn IS UNIQUE
            self.neo4jrestful.query('CREATE CONSTRAINT ON (n:'+label+') ASSERT n.`'+field+'` IS UNIQUE;', function(err, result, debug) {
              // maybe better ways how to report if an error occurs
              cb(err, result, debug);
            });
        });
      }*/
    } else {
      cb(Error('No label found'), this);
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
    n._response = _.extend(this._response);
    return n;
  }
  
  Node.prototype.resetQuery = function() {
    this.cypher = {}
    _.extend(this.cypher, cypher_defaults);
    this.cypher.where = [];
    this.cypher.match = [];
    this.cypher.return_properties = [];
    this._modified_query_ = false;
    if (this.id)
      this.cypher.from = this.id;
    return this; // return self for chaining
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
    this._modified_query_ = false;
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
    this._modified_query_ = false;
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
  
  Node.prototype.fieldsForAutoindex = function() {
    var fields = this.fieldsToIndex();
    var keys = [];
    _.each(fields, function(toBeIndexed, field) {
      if (toBeIndexed === true) 
        keys.push(field);
    });
    return keys;
  }
  
  Node.prototype.fieldsWithUniqueValues = function() {
    return ( (this.fields.unique) && (_.keys(this.fields.unique).length > 0) ) ? this.fields.unique : null;
  }
  
  Node.prototype.indexFields = function(cb) {
    var fieldsToIndex = this.fieldsToIndex();
    if (fieldsToIndex) {
      // var join = Join.create();
      var doneCount = 0;
      var todoCount = 0;
      // var max = Object.keys(fieldsToIndex).length;
      for (var key in fieldsToIndex) {
        var namespace = this.fields.indexes[key];
        var value = this.data[key];
        if ((_.isString(namespace))&&(typeof value !== 'undefined')&&(value !== null)) {
          todoCount++;
          this.addIndex(namespace, key, value, function(err, data, debug){
            doneCount = doneCount+1;
            // done
            if (doneCount >= todoCount)
              cb(null, doneCount);
          });
        }
      }
      if (todoCount === 0)
        cb(null, doneCount);
    }
    return null;
  }
  
  /*
   * http://docs.neo4j.org/chunked/milestone/rest-api-schema-indexes.html#rest-api-list-indexes-for-a-label
   */
  Node.prototype.ensureIndex = function(options, cb) {
    var args;
    ( ( args = helpers.sortOptionsAndCallbackArguments(options, cb) ) && ( options = args.options ) && ( cb = args.callback ) );
    options = _.extend({
      label: this.label,
      fields: this.fieldsForAutoindex(),
      action: null
    }, options);
    var self    = this;
    var keys    = options.fields;
    var todo    = keys.length;
    var done    = 0;
    var errors  = [];
    var results = [];
    if (!options.label)
      return cb(Error('Label is mandatory, you can set the label as options as well'), null);
    var url = '/db/data/schema/index/'+options.label;
    if (keys.length === 0)
      return cb(Error("No keys for indexing found in schema"), null);
    _.each(keys, function(key){
      self.neo4jrestful.post(url, { data: { property_keys: [ key ] } }, function(err, res) {
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
      });
    });
  }
  
  Node.prototype.dropIndex = function(fields, cb) {
    var self = this;
    if (typeof fields === 'function') {
      cb = fields;
      fields = this.fieldsForAutoindex();
    }
    if (!this.label)
      return cb(Error("You need to set a label on `node.label` to work with autoindex"), null);
    var todo = fields.length;
    var done = 0;
    var url  = '/db/data/schema/index/'+this.label;
    // skip if no fields
    if (todo === 0)
      return cb(null, null);
    var errors  = [];
    var results = [];
    if (todo===0)
      return cb(Error("No fields for indexing found", null));
    _.each(fields, function(field) {
      self.neo4jrestful.delete(url+'/'+field, function(err, res){
        done++;
        // if (err)
        //   errors.push(err);
        // else
        //   results.push(res);
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
  }
  
  Node.prototype.getIndex = function(cb) {
    var label = this.label;
    if (!label)
      return cb(Error("You need to set a label on `node.label` to work with autoindex"), null);
    var url = '/db/data/schema/index/'+this.label;
    return this.neo4jrestful.get(url, function(err, res){
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
  
  Node.prototype.save = function(cb) {
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
  
  Node.prototype.onBeforeSave = function(node, next) { next(null, null); }
  
  Node.prototype.onSave = function(cb) {
    var self = this;
    if (this.is_singleton)
      return cb(Error('Singleton instances can not be persisted'), null);
    if (!this.hasValidData())
      return cb(Error('Node does not contain valid data. `node.data` must be an object.'));
    this._modified_query_ = false;
    this.applyDefaultValues();
    var method = null;
  
    function _prepareData(err, data, debug) {
      // copy persisted data on initially instanced node
      data.copyTo(self);
      data = self;
      self.is_singleton = false;
      self.is_instanced = true;
      self.is_persisted = true;
      // if we have defined fields to index
      // we need to call the cb after indexing
      if (self.hasFieldsToIndex()) {
        return self.indexFields(function(){
          if (debug)
            debug.indexedFields = true;
          cb(null, data, debug);
        });
      }
      else
        return cb(null, data, debug);
    }
    
    this.id = this._id_;
  
    if (this.id > 0) {
      method = 'update';
      this.neo4jrestful.put('/db/data/node/'+this._id_+'/properties', { data: this.flattenData() }, function(err, node, debug) {
        if ((err) || (!node))
          return cb(err, node);
        self.populateWithDataFromResponse(node._response);
        cb(err, node, debug);
      });
    } else {
      method = 'create';   
      this.neo4jrestful.post('/db/data/node', { data: this.flattenData() }, function(err, node, debug) {
        if ((err) || (!node))
          return cb(err, node);
        _prepareData(err, node, debug);
      });
    }
  }
  
  Node.prototype.onAfterSave = function(node, next, debug) {
    var labels = node.labelsAsArray();
    if ((typeof err !== 'undefined')&&(err !== null)) {
      return next(err, node, debug);
    } else {
      if (labels.length > 0) {
        // we need to post the label in an extra reqiuest
        // cypher inappropriate since it can't handle { attributes.with.dots: 'value' } …
        node.createLabels(labels, function(labelError, notUseableData, debugLabel) {
          // add label err if we have one
          if (labelError)
            err = (err) ? [ err, labelError ] : labelError;
          // add debug label if we have one
          if (debug)
            debug = (debugLabel) ? [ debug, debugLabel ] : debug;
          return next(labelError, node, debug);
        });
      } else {
        return next(null, node, debug);
      }
    }
  }
  
  Node.prototype.update = function(data, cb) {
    var self = this;
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
        this.cypher.set.push(helpers.cypherKeyValueToString(attribute, data[attribute], this.__type_identifier__));
      }
    }
    this.exec(cb);
    return this;
  }
  
  Node.prototype.load = function(cb) {
    var self = this;
    this.onBeforeLoad(self, function(err, node){
      if (err)
        cb(err, node);
      else
        self.onAfterLoad(node, cb);
    })
  }
  
  Node.prototype.onBeforeLoad = function(node, next) {
    var self = this;
    if (node.hasId()) {
      var DefaultConstructor = this.recommendConstructor();
      // To check that it's invoked by Noder::find() or Person::find()
      var constructorNameOfStaticMethod = this.label || helpers.constructorNameOfFunction(DefaultConstructor);
      node.allLabels(function(err, labels, debug) {
        if (err)
          return next(err, labels);
        node.labels = _.clone(labels);
        if (labels.length === 1)
          node.label = labels[0]
        // convert node to it's model if it has a distinct label and differs from static method
        if ( (node.label) && (node.label !== constructorNameOfStaticMethod) )
          node = Node.prototype.convert_node_to_model(node, node.label, DefaultConstructor);
        next(null, node);
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
    node._modified_query_ = false;
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
        node.id = node._id_ = Number(node._response.self.match(/[0-9]+$/)[0]);
      }
    }
    node.is_persisted = true;
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
    self._modified_query_ = true;
    self.cypher.label = label;
    self.exec(cb);
    return self; // return self for chaining
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
      
      var matchString = 'p = '+options.algorithm+'(a-['+type+( (options.max_depth>0) ? '..'+options.max_depth : '*' )+']-b)';
      
      this.cypher.match.push(matchString.replace(/\[\:\*+/, '[*'));
      this.cypher.return_properties = ['p'];
    }
  
    this.exec(cb);
    return this; // return self for chaining
  }
  
  Node.prototype.count = function(identifier, cb) {
    this._modified_query_ = true;
    this.cypher._count = true;
    if (typeof identifier === 'function') {
      cb = identifier;
      identifier = '*';
    }
    else if (typeof identifier !== 'string')
      identifier = '*';
  
    if (!this.cypher.start) {
      this.cypher.start = this.__type_identifier__+' = '+this.__type__+'(*)'; // all nodes by default
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
    return this; // return self for chaining
  }
  
  /*
   * Query-Building methods
   */
  
  Node.prototype._prepareQuery = function() {
    var query = _.extend(this.cypher);
    var label = (query.label) ? ':'+query.label : '';
  
    if (!query.start) {
      if (query.from > 0) {
        query.start = 'n = node('+query.from+')';
        query.return_properties.push('n');
      }
      if (query.to > 0) {
        query.start += ', m = node('+query.to+')';
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
        if ((this.neo4jrestful.version >= 2)&&(query.return_properties.length === 1)&&(query.return_properties[0] === 'n')) {
          // try adding labels if we have only n[node] as return propert
          query.return_properties.push('labels(n)');
        }
        query.return_properties = query.return_properties.join(', ');
      }
    }
  
    // Set a fallback to START n = node(*) 
    if ((!query.start)&&(!(query.match.length > 0))) {
      // query.start = 'n = node(*)';
      query.start = this.__type_identifier__+' = '+this.__type__+'(*)';
    }
    if ((!(query.match.length>0))&&(this.label)) {
      // e.g. ~> MATCH n:Person
      query.match.push(this.__type_identifier__+':'+this.label);
    }
  
    // rule(s) for findById
    if (query.by_id > 0) {
      var identifier = query.node_identifier || this.__type_identifier__;
      // put in where clause if `START n = node(*)` or no START statement exists
      if ( (!query.start) || (/^\s*n\s*\=\s*node\(\*\)\s*$/.test(query.start)) ) {
        // we have to use the id method for the special key `id`
        query.where.push("id("+identifier+") = "+query.by_id);
      }
    }
    return query;
  }
  
  Node.prototype.toCypherQuery = function() {
    var query = this._prepareQuery();
    var template = "";
    if (query.start)
      template += "START %(start)s ";
    if (query.match.length > 0)
      template += "MATCH %(match)s ";
      template += "%(With)s ";
      template += "%(where)s ";
    if (query.set)
      template += "SET %(set)s ";
      template += "%(action)s %(return_properties)s ";
    if (query.order_by)
      template += "ORDER BY %(order_by)s ";
    if (query.skip)
      template += "SKIP %(skip)s ";
    if (query.limit)
      template += "LIMIT %(limit)s";
      template += ";";
  
    var cypher = helpers.sprintf(template, {
      start:              query.start,
      from:               '',
      match:              (query.match.length > 0) ? query.match.join(' AND ') : '',
      With:               (query.With) ? query.With : '',
      action:             (query.action) ? query.action : 'RETURN'+((query._distinct) ? ' DISTINCT ' : ''),
      return_properties:  query.return_properties,
      where:              ((query.where)&&(query.where.length > 0)) ? 'WHERE '+query.where.join(' AND ') : '',
      set:                (query.set) ? query.set.join(', ') : '', 
      to:                 '',
      order_by:           (query.order_by) ? query.order_by+' '+query.order_direction : '',
      limit:              query.limit,
      skip:               query.skip  
    })
    cypher = cypher.trim().replace(/\s+;$/,';');
    return cypher;
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
  };
  
  Node.prototype._end_node_id = function(fallback) {
    if (typeof fallback === 'undefined')
      fallback = '*'
    return (this.cypher.to > 0) ? this.cypher.to : fallback; 
  };
  
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
      var cypher = this.toCypherQuery();
      // reset node, because it might be called from prototype
      // if we have only one return property, we resort this
      if ( (this.cypher.return_properties)&&(this.cypher.return_properties.length === 1) ) {
        if (cypherQuery)
          return this.query(cypherQuery, cb);
        else if (request)
          return this.query(request, cb);
        else
          // default, use the build cypher query
          return this.query(cypher, cb);
      } else {
        return this.query(cypher, cb);
      } 
    }
    return null;
  }
  
  Node.prototype.query = function(cypherQuery, options, cb) {
    var self = this;
    
    var DefaultConstructor = this.recommendConstructor();
  
    var _deliverResultset = function(self, cb, err, sortedData, debug) {
      if ( (self.cypher.by_id) && (self.cypher.return_properties.length === 1) && (self.cypher.return_properties[0] === 'n') && (sortedData[0]) )
        sortedData = sortedData[0];
      else if ( (self.cypher.limit === 1) && (sortedData.length === 1) )
        sortedData = sortedData[0];
      else if ( (self.cypher.limit === 1) && (sortedData.length === 0) )
        sortedData = null;
      // s.th. like [ 3 ] as result for instance
      if ( (_.isArray(sortedData)) && (sortedData.length === 1) && (typeof sortedData[0] !== 'object') )
        sortedData = sortedData[0];
      return cb(err, sortedData, debug);
    } 
  
    var _processData = function(err, result, debug, cb) {
      if ((err)||(!result)) {
        return cb(err, result, debug);
      } else {
        var sortedData = [];
        var errors = [];
        // we are using the 
        var sequence = Sequence.create();
        // we iterate through the results
        var data = (result.data) ? result.data : [ result ];
        // because we are making a seperate request we instanciate another client
        // var neo4jrestful = new Node.prototype.neo4jrestful.constructor(self.neo4jrestful.baseUrl);
        for (var x=0; x < data.length; x++) {
          if (typeof data[x][0] === 'undefined') {
            break;
          }
          var basicNode = self.neo4jrestful.createObjectFromResponseData(data[x][0], DefaultConstructor);
          (function(x,basicNode){
            sequence.then(function(next) {
              // TODO: reduce load / calls, currently it's way too slow…
              if (typeof basicNode.load === 'function') {
                basicNode.load(function(err, node) {
                  if ((err) || (!node))
                    errors.push(err);
                  sortedData[x] = node;
                  next();
                });
              } else {
                // no load() function found
                sortedData[x] = basicNode;
                next();
              }
            });
          })(x, basicNode);
        }
        sequence.then(function(next){
          //finally
          if ( (data.data) && (data.data[0]) && (typeof data.data[0][0] !== 'object') )
            sortedData = data.data[0][0];
          return _deliverResultset(self, cb, (errors.length === 0) ? null : errors, sortedData, debug);
        });
      }
    }
  
    // sort arguments
    if (typeof options !== 'object') {
      cb = options;
      options = {};
    }
    if (this.label)
      options.label = this.label;
  
    if (typeof cypherQuery === 'string') {
      // check for stream flag
      // in stream case we use stream() instead of query()
      var query = null;
      if (this._stream_) {
        return this.neo4jrestful.stream(cypherQuery, options, function(data, debug) {
          var object = null;
          if ( (data) && (data.__type__) ) {
            cb(
              Node.singleton().neo4jrestful.createObjectFromResponseData(data._response, DefaultConstructor)
            );
          } else {
            return cb(data);
          }
        });
      }
      else {
        return this.neo4jrestful.query(cypherQuery, options, function(err, data, debug) {
          _processData(err, data, debug, cb);
        });
      }
    } else if (typeof cypherQuery === 'object') {
      // we expect a raw request object here
      // this is used to make get/post/put restful request
      // with the faeture of process node data
      var request = cypherQuery;
      if ( (!request.type) || (!request.data) || (!request.url) ) {
        return cb(Error("The 1st argument as request object must have the properties .url, .data and .type"), null);
      }
      return this.neo4jrestful[request.type](request.url, request.data, function(err, data, debug) {
        // transform to resultset
        data = {
          data: [ [ data ] ]
        };
        _processData(err, data, debug, cb);
      });
    } else {
      return cb(Error("First argument must be a string with the cypher query"), null);
    }
  }
  
  /*
   * Relationship methods
   */
  
  Node.prototype.incomingRelationships = function(relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query_ = true;
    if (typeof relation !== 'function') {
      self.cypher.relationship = relation;
    } else {
      cb = relation;
    }
    self.cypher.node_identifier = 'n';
    self.cypher.start = 'n = node('+self._start_node_id('*')+')';
    self.cypher.start += (self.cypher.to > 0) ? ', m = node('+self._end_node_id('*')+')' : ''
    self.cypher.incoming = true;
    self.cypher.outgoing = false;
    self.cypher.return_properties = ['r'];
    self.exec(cb);
    return self; // return self for chaining
  }
  
  Node.prototype.outgoingRelationships = function(relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query_ = true;
    if (typeof relation !== 'function') {
      self.cypher.relationship = relation;
    } else {
      cb = relation;
    }
    self.cypher.node_identifier = 'n';
    self.cypher.start = 'n = node('+self._start_node_id('*')+')';
    self.cypher.start += (self.cypher.to > 0) ? ', m = node('+self._end_node_id('*')+')' : ''
    self.cypher.incoming = false;
    self.cypher.outgoing = true;
    self.cypher.return_properties = ['r'];
    self.exec(cb);
    return self; // return self for chaining
  }
  
  Node.prototype.incomingRelationshipsFrom = function(node, relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query_ = true;
    self.cypher.from = self.id || null;
    self.cypher.to = helpers.getIdFromObject(node);
    if (typeof relation !== 'function')
      self.cypher.relationship = relation;
    self.cypher.return_properties = ['r'];
    return self.incomingRelationships(relation, cb);
  }
  
  Node.prototype.outgoingRelationshipsTo = function(node, relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query_ = true;
    self.cypher.to = helpers.getIdFromObject(node);
    if (typeof relation !== 'function')
      self.cypher.relationship = relation;
    self.cypher.return_properties = ['r'];
    return self.outgoingRelationships(relation, cb);
  }
  
  Node.prototype.allDirections = function(relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query_ = true;
    if (typeof relation !== 'function')
      self.cypher.relationship = relation;
    self.cypher.node_identifier = 'n';
    self.cypher.start = 'n = node('+self._start_node_id('*')+'), m = node('+self._end_node_id('*')+')';
    self.cypher.incoming = true;
    self.cypher.outgoing = true;
    self.cypher.return_properties = ['n', 'm', 'r'];
    self.exec(cb);
    return self; // return self for chaining
  }
  
  Node.prototype.relationshipsBetween = function(node, relation, cb) {
    var self = this.singletonForQuery();
    self._modified_query_ = true;
    self.cypher.to = helpers.getIdFromObject(node);
    if (typeof relation !== 'function')
      self.cypher.relationship = relation;
    self.cypher.return_properties = ['r'];
    self.exec(cb);
    return self.allDirections(relation, cb);
  }
  
  Node.prototype.allRelationships = function(relation, cb) {
    var self = this.singletonForQuery();
    var label = (this.cypher.label) ? ':'+this.cypher.label : '';
    if (typeof relation === 'string') {
      relation = ':'+relation;
    } else {
      cb = relation;
      relation = '';
    }
    self._modified_query_ = true;
    self.cypher.match.push('n'+label+'-[r'+relation+']-()');
    self.cypher.return_properties = ['r'];
    self.exec(cb);
    return self; // return self for chaining
  }
  
  Node.prototype.limit = function(limit, cb) {
    this._modified_query_ = true;
    this.cypher.limit = Number(limit);
    if (this.cypher.action === 'DELETE')
      throw Error("You can't use a limit on a DELETE, use WHERE instead to specify your limit");
    this.exec(cb);
    return this; // return self for chaining
  }
  
  Node.prototype.skip = function(skip, cb) {
    this._modified_query_ = true;
    this.cypher.skip = Number(skip);
    this.exec(cb);
    return this; // return self for chaining
  }
  
  Node.prototype.distinct = function(cb) {
    this._modified_query_ = true;
    this.cypher._distinct = true;
    this.exec(cb);
    return this; // return self for chaining
  }
  
  Node.prototype.orderBy = function(property, cb, identifier) {
    this._modified_query_ = true;
    var direction = '';
    if (typeof property === 'object') {
      var key = Object.keys(property)[0];
      cb = direction;
      direction = property[key];
      property = key;
      if ( (typeof direction === 'string') && ((/^(ASC|DESC)$/i).test(direction)) ) {
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
  
  Node.prototype.match = function(string, cb) {
    this.cypher.match.push(string);
    this.exec(cb);
    return this; // return self for chaining
  }
  
  Node.prototype.where = function(where, cb) {
    this._modified_query_ = true;
    this.cypher.where = [];
    return this.andWhere(where, cb);
  }
  
  Node.prototype.andWhere = function(where, cb, _options) {
    this._modified_query_ = true;
    if (_.isObject(where)) {
      if (Object.keys(where).length === 0) {
        // return here
        this.exec(cb);
        return this;
      }
      if (!_.isArray(where))
        where = [ where ];
    }
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
    return this; // return self for chaining
  }
  
  Node.prototype.whereStartNode = function(where, cb) {
    this.cypher.where = [];
    return this.andWhere(where, cb, { identifier: 'n' });
  }
  
  Node.prototype.whereEndNode = function(where, cb) {
    this.cypher.where = [];
    return this.andWhere(where, cb, { identifier: 'm' });
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
    return this.andWhere(where, cb, {identifier: 'n' });
  }
  
  Node.prototype.andWhereEndNode = function(where, cb) {
    return this.andWhere(where, cb, { identifier: 'm' });
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
    this._modified_query_ = true;
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
      this.andWhere('HAS ('+identifier+'.`'+property+'`)');
    }
    this.exec(cb);
    return this; // return self for chaining
  }
  
  Node.prototype.whereNodeHasProperty = function(property, cb) {
    return this.whereHasProperty(property, 'n', cb);
  }
  
  Node.prototype.whereStartNodeHasProperty = function(property, cb) {
    return this.whereHasProperty(property, 'n', cb);
  }
  
  Node.prototype.whereEndNodeHasProperty = function(property, cb) {
    return this.whereHasProperty(property, 'm', cb);
  }
  
  Node.prototype.whereRelationshipHasProperty = function(property, cb) {
    return this.whereHasProperty(property, 'r', cb);
  }
  
  Node.prototype.delete = function(cb) {
    if (this.hasId())
      return cb(Error('To delete a node, use remove(). delete() is for queries'),null);
    this._modified_query_ = true;
    this.cypher.action = 'DELETE';
    if (this.cypher.limit)
      throw Error("You can't use a limit on a DELETE, use WHERE instead to specify your limit");
    this.exec(cb);
    return this; // return self for chaining
  }
  
  Node.prototype.deleteIncludingRelationships = function(cb) {
    var label = (this.label) ? ":"+this.label : "";
    if (!this.cypher.start)
      this.cypher.start = this.__type_identifier__ + " = " + this.__type__+"(*)";
    this.cypher.match.push([ this.__type_identifier__+label+"-[r?]-()" ]);
    this.cypher.return_properties = [ "n", "r" ];
    return this.delete(cb);
  }
  
  Node.prototype.remove = function(cb) {
    var self = this;
    this.onBeforeRemove(function(err) {
      if (self.is_singleton)
        return cb(Error("To delete results of a query use delete(). remove() is for removing an instanced "+this.__type__),null);
      if (self.hasId()) {
        return self.neo4jrestful.delete('/db/data/'+self.__type__+'/'+self.id, cb);
      }
    })
    return this;
  }
  
  Node.prototype.onBeforeRemove = function(next) { next(null,null); }
  
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
    var self = this;
    options = _.extend({
      from_id: this.id,
      to_id: null,
      type: null,
      // unique: false ,// TODO: implement!
      properties: null,
      distinct: null
    }, options);
    if (options.properties)
      options.properties = helpers.flattenObject(options.properties);
  
    var _create_relationship_by_options = function(options) {
      return self.neo4jrestful.post('/db/data/node/'+options.from_id+'/relationships', {
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
    }
  
    if ((_.isNumber(options.from_id))&&(_.isNumber(options.to_id))&&(typeof cb === 'function')) {
      if (options.distinct) {
        Node.findById(options.from_id).outgoingRelationshipsTo(options.to_id, options.type, function(err, result) {
          if (err)
            return cb(err, result);
          if (result.length === 1) {
            // if we have only one relationship, we update this one
            Relationship.findById(result[0].id, function(err, relationship){
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
  }
  
  Node.prototype.createRelationshipBetween = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    var self = this;
    if (typeof properties === 'function') {
      cb = properties;
      properties = {};
    }
    if ((this.hasId())&&(helpers.getIdFromObject(node))) {
      // to avoid deadlocks
      // we have to create the relationships sequentially
      self.createRelationshipTo(node, type, properties, function(err, resultFirst, debug_a){
        self.createRelationshipFrom(node, type, properties, function(secondErr, resultSecond, debug_b) {
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
    
  }
  
  Node.prototype.createRelationshipTo = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    var args;
    var id = helpers.getIdFromObject(node);
    ( ( args = helpers.sortOptionsAndCallbackArguments(properties, cb) ) && ( properties = args.options ) && ( cb = args.callback ) );
    options = _.extend({
      properties: properties,
      to_id: id,
      type: type
    }, options);
    return this.createRelationship(options, cb);
  }
  
  Node.prototype.createRelationshipFrom = function(node, type, properties, cb, options) {
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
    return this.createRelationship(options, cb);
  }
  
  Node.prototype.createOrUpdateRelationship = function(options, cb) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationship(options, cb);
  }
  
  Node.prototype.createOrUpdateRelationshipTo = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationshipTo(node, type, properties, cb, options);
  }
  
  Node.prototype.createOrUpdateRelationshipFrom = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationshipFrom(node, type, properties, cb, options);
  }
  
  Node.prototype.createOrUpdateRelationshipBetween = function(node, type, properties, cb, options) {
    if (typeof options !== 'object') options = {};
    options.distinct = true;
    return this.createRelationshipBetween(node, type, properties, cb, options);
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
      this.neo4jrestful.get('/db/data/node/'+this.id+'/labels', cb);
    }
    return this;
  }
  
  Node.prototype.setLabels = function(labels) {
    if (_.isArray(labels)) {
      this.labels = _.clone(labels);
    }
    // if we have only one label we set this to default label
    if ((_.isArray(this.labels))&&(this.labels.length === 1)) {
      this.label = this.labels[0];
    }
    return this.labels;
  }
  
  Node.prototype.labelsAsArray = function() {
    var labels = this.labels;
    if (!_.isArray(labels))
      labels = [];
    if (this.label)
      labels.push(this.label);
    return _.uniq(labels);
  }
  
  Node.prototype.allLabels = function(cb) {
    if ( (this.hasId()) && (_.isFunction(cb)) ) {
      return this.neo4jrestful.get('/db/data/node/'+this.id+'/labels', cb);
    }
  }
  
  Node.prototype.createLabel = function(label, cb) {
    return this.createLabels([ label ], cb);
  }
  
  Node.prototype.createLabels = function(labels, cb) {
    if ( (this.hasId()) && (_.isFunction(cb)) )
      return this.neo4jrestful.post('/db/data/node/'+this.id+'/labels', { data: labels }, cb);
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
      return this.neo4jrestful.put('/db/data/node/'+this.id+'/labels', { data: labels }, cb);
    }
  }
  
  Node.prototype.removeLabels = function(cb) {
    if ( (this.hasId()) && (_.isFunction(cb)) ) {
      return this.neo4jrestful.delete('/db/data/node/'+this.id+'/labels', cb);
    }
  }
  
  // Node.prototype.replaceLabel = function
  
  // TODO: autoindex? http://docs.neo4j.org/chunked/milestone/rest-api-configurable-auto-indexes.html
  Node.prototype.addIndex = function(namespace, key, value, cb) {
    if (this.is_singleton)
      return cb(Error('Singleton instance is not allowed to get persist.'), null);
    this._modified_query_ = false;
    if ( (!namespace) || (!key) || (!value) || (!_.isFunction(cb)) )
      throw Error('namespace, key and value arguments are mandatory for indexing.');
    if (!this.hasId())
      return cb(Error('You need to persist the node before you can index it.'),null);
    if (typeof cb === 'function')
      return this.neo4jrestful.post('/db/data/index/'+this.__type__+'/'+namespace, { data: { key: key, value: value, uri: this.uri } }, cb);
    else
      return null;
    return keys;
  }
  
  Node.prototype.toObject = function() {
    var o = {
      id: this.id,
      data: _.extend(this.data),
      uri: this.uri
    };
    if (this.label)
      o.label = this.label;
    return o;
  }
  
  /*
   * Request methods
   */
  
  Node.prototype.stream = function(cb) {
    this._stream_ = true;
    this.exec(cb);
    return this;
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
    self._modified_query_ = true;
    if (self.label) self.withLabel(self.label);
    if ((typeof where === 'string')||(typeof where === 'object')) {
      self.where(where);
      if (!self.cypher.start) {
        self.cypher.start = self.__type_identifier__+' = '+self.__type__+'('+self._start_node_id('*')+')';
      }
      self.exec(cb);
      return self;
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
    self.exec(cb);
    return self;
  }
  
  Node.prototype.findById = function(id, cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton(undefined, this);
    if ( (_.isNumber(Number(id))) && (typeof cb === 'function') ) {
      // to reduce calls we'll make a specific restful request for one node
      return self.neo4jrestful.get('/db/data/'+this.__type__+'/'+id, function(err, node) {
        if ((node) && (typeof self.load === 'function')) {
          //  && (typeof node.load === 'function')     
          node.load(cb);
        } else {
          cb(err, node);
        }
      });
    } else {
      self.cypher.by_id = Number(id);
      return self.findByUniqueKeyValue('id', id, cb);
    } 
  }
  
  Node.prototype.findByUniqueKeyValue = function(key, value, cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton(undefined, this);
    // we have s.th. like
    // { key: value }
    if (typeof key === 'object') {
      cb = value;
      var _key = Object.keys(key)[0];
      value = key[_key];
      key = _key;
    }
  
    if (typeof key !== 'string')
      key = 'id';
    if ( (_.isString(key)) && (typeof value !== 'undefined') ) {
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
         self.exec(function(err,found){
          if (err)
            return cb(err, found);
          else {
            // try to return the first
            found = (found.length === 0) ? null : ((found)&&(found[0])) ? found[0] : found;
            return cb(null, found);
          }
         });
      }
     
    }
    return self;
  }
  
  // Node.prototype.findUnique = function(key, value, cb) { }
  // Node.prototype.findUniqueWithLabel = function(label, key, value) {}
  
  Node.prototype.findAll = function(cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton(undefined, this);
    self._modified_query_ = true;
    self.cypher.limit = null;
    self.cypher.return_properties = ['n'];
    if (self.label) self.withLabel(self.label);
    self.exec(cb);
    return self;
  }
  
  Node.prototype.findByIndex = function(namespace, key, value, cb) {
    var self = this;
    if (!self.is_singleton)
      self = this.singleton(undefined, this);
    var values = {};
    if ((namespace)&&(key)&&(value)&&(typeof cb === 'function')) {
      // values = { key: value };
      // TODO: implement
      return self.neo4jrestful.get('/db/data/index/'+this.__type__+'/'+namespace+'/'+key+'/'+value+'/', function(err, result, debug) {
        if (err) {
          cb(err, result, debug);
        } else {
          result = (result[0]) ? result[0] : null;
          cb(null, result, debug);
        }
      });
    } else {
      return cb(Error('Namespace, key, value and mandatory to find indexed nodes.'), null);
    }
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
  Node.findByIndex = function(namespace, key, value, cb) {
    return this.prototype.findByIndex(namespace, key, value, cb);
  }
  
  Node.findByUniqueKeyValue = function(key, value, cb) {
    return this.prototype.findByUniqueKeyValue(key, value, cb);
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
  
  Node.query = function(cypherQuery, options, cb) {
    return this.prototype.singleton().query(cypherQuery, options, cb);
  }
  
  Node.register_model = function(Class, label, prototype, cb) {
    var name = null;
    if (typeof Class === 'string') {
      if (typeof label === 'function') {
        cb = label;
        prototype = {};
      } else if (typeof prototype === 'function') {
        cb = prototype;
        prototype = {};
      }
      label = name = Class;
      // we define here an anonymous constructor
      Class = function() {
        this.init.apply(this, arguments);
        this.label = this.constructor_name = label;
      }
      _.extend(Class, Node); // 'static' methods
      _.extend(Class.prototype, prototype, Node.prototype); // object methods
    } else {
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
    return this.prototype.convert_node_to_model(node, model, fallbackModel);
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
  
  var initNode = function(neo4jrestful) {
  
    // Ensure that we have a Neo4jRestful client we can work with
    if ((typeof neo4jrestful !== 'undefined') && (helpers.constructorNameOfFunction(neo4jrestful) !== 'Neo4jRestful'))
      throw Error('You have to use an Neo4jRestful object as argument');
  
    // we can only check for object type,
    // better would be to check for constructor neo4jrestful
    if (typeof neo4jrestful === 'object') {
      if (typeof window === 'object') {
        window.Neo4jMapper.Node.prototype.neo4jrestful = neo4jrestful;
        return window.Neo4jMapper.Node;
      }
      else {
        Node.prototype.neo4jrestful = neo4jrestful;
        return Node;
      }
    }    
  
    return Node;
  
  }
  
  if (typeof window !== 'object') {
    module.exports = exports = initNode;
  } else {
    window.Neo4jMapper.Node = Node;
  }  
  /*
   * include file: 'src/path.js'
   */
  var helpers = null
    , _       = null
  
  if (typeof window === 'object') {
    // browser
    helpers = neo4jmapper_helpers;
    _       = window._;
  } else {
    // nodejs
    helpers = require('./helpers')
    _       = require('underscore');
  }
  
  // Constructor
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
    this.neo4jrestful = _.extend(Path.prototype.neo4jrestful);
  }
  
  Path.prototype.neo4jrestful = null; // will be initialized
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
    path.neo4jrestful = _.extend(Path.prototype.neo4jrestful);
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
  
  var initPath = function(neo4jrestful) {
  
    // Ensure that we have a Neo4jRestful client we can work with
    if ((typeof neo4jrestful !== 'undefined') && (helpers.constructorNameOfFunction(neo4jrestful) !== 'Neo4jRestful'))
      throw Error('You have to use an Neo4jRestful object as argument');
  
    if (typeof neo4jrestful === 'object') {
      if (typeof window === 'object') {
        // browser
        window.Neo4jMapper.Path.prototype.neo4jrestful = neo4jrestful;
        return window.Neo4jMapper.Path;
      } else {
        // nodejs
        Path.prototype.neo4jrestful = neo4jrestful;
        return Path;
      }
    }
  
    return Path;
  
  }
  
  if (typeof window !== 'object') {
    module.exports = exports = initPath;
  } else {
    window.Neo4jMapper.Path = Path;
  }  
  /*
   * include file: 'src/relationship.js'
   */
  /*
   * TODO:
   * * make query mapper from Node available for relationships as well
   * * make relationships queryable with custom queries
   */
  
  // Requirements (for browser and nodejs):
  // * Node
  // * neo4jmapper helpres
  // * underscorejs
  var Node          = null // will be initialized
    , helpers       = null
    , _             = null;
  
  if (typeof window === 'object') {
    helpers = neo4jmapper_helpers;
    _       = window._;
  } else {
    helpers  = require('./helpers');
    _        = require('underscore');
  }
  
  // Constructor
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
    this.fields = _.extend({},{
      defaults: _.extend({}, this.fields.defaults)
    });
    // each relationship object has it's own restful client
    this.neo4jrestful = _.extend(Relationship.prototype.neo4jrestful);
    this.is_instanced = true;
  }
  
  Relationship.prototype.neo4jrestful = null; // will be initialized
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
  Relationship.prototype.fields = {
    defaults: {}
  };
  
  Relationship.prototype.__type__ = 'relationship';
  Relationship.prototype.__type_identifier__ = 'r';
  
  Relationship.prototype.singleton = function() {
    var relationship = new Relationship();
    relationship.neo4jrestful = _.extend(Relationship.prototype.neo4jrestful);
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
  
  Relationship.prototype.applyDefaultValues = null; // will be initialized
  
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
    this.applyDefaultValues();
    if (this._id_) {
      // copy 'private' _id_ to public
      this.id = this._id_;
      return this.update(cb);
    } else {
      var url = '/db/relationship/relationship';
      this.neo4jrestful.post(url, { data: helpers.flattenObject(this.data) }, function(err,data){
        if (err)
          cb(err,data);
        else {
          self.populateWithDataFromResponse(data);
          return cb(null, data);
        }
      });
    }
  }
  
  // Relationship.prototype.update = Node.prototype.update;
  
  // TODO: save  functionality as Node.update() asap!!!
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
      this.neo4jrestful.put('/db/data/relationship/'+this.id+'/properties', { data: helpers.flattenObject(this.data) }, function(err,data){
        if (err)
          return cb(err, data);
        else
          return cb(null, self);
      });
    } else {
      return cb(Error('You have to save() the relationship before you can perform an update'), null);
    }
  }
  
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
      relationship.data = helpers.unflattenObject(this.data);
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
  
  /*
   * Static singleton methods
   */
  
  Relationship.findById = function(id, cb) {
    return this.prototype.findById(id, cb);
  }
  
  var initRelationship = function(neo4jrestful) {
  
    // Ensure that we have a Neo4jRestful client we can work with
    if ((typeof neo4jrestful !== 'undefined') && (helpers.constructorNameOfFunction(neo4jrestful) !== 'Neo4jRestful'))
      throw Error('You have to use an Neo4jRestful object as argument');
  
    if (typeof neo4jrestful === 'object') {
      if (typeof window === 'object') {
        // browser      
        Node = initNode(neo4jrestful);
        window.Neo4jMapper.Relationship.prototype.neo4jrestful = neo4jrestful;
        window.Neo4jMapper.Relationship.prototype.applyDefaultValues = window.Neo4jMapper.Node.prototype.applyDefaultValues;
        return window.Neo4jMapper.Relationship;
      } else {
        // nodejs
        Node = require('./node')(neo4jrestful);
        Relationship.prototype.neo4jrestful = neo4jrestful;
        Relationship.prototype.applyDefaultValues = Node.prototype.applyDefaultValues;
        return Relationship;
      }
      
    }
  
    /* from Node */
  
    Relationship.recommendConstructor = function() {
      return Relationship;
    }
  
    Relationship.prototype.copy_of = Node.prototype.copy_of;
  
    return Relationship;
  
  }
  
  if (typeof window !== 'object') {
    module.exports = exports = initRelationship;
  } else {
    window.Neo4jMapper.Relationship = Relationship;
  }  
  /*
   * include file: 'src/graph.js'
   */
  // **The Graph** respresents the database
  // You can perform basic actions and queries directly on the entire graphdatabase
  
  // Initialize the Graph object with a neo4jrestful client
  var initGraph = function(neo4jrestful) {
  
    // Requirements (for browser and nodejs):
    // * neo4jmapper helpers
    // * underscorejs
    var _       = null
      , helpers = null;
  
    if (typeof window === 'object') {
      helpers = neo4jmapper_helpers;
      _       = window._();
    } else {
      helpers = require('./helpers');
      _       = require('underscore');
    }
  
    // Ensure that we have a Neo4jRestful client we can work with
    if ((typeof neo4jrestful !== 'undefined') && (helpers.constructorNameOfFunction(neo4jrestful) !== 'Neo4jRestful'))
      throw Error('You have to use an Neo4jRestful object as argument')
  
    // Constructor
    Graph = function() {
    }
  
    // Will contain the info response of the neo4j database
    Graph.prototype.info = null;
  
    // Shortcut for neo4jrestul.query
    Graph.prototype.query = function(cypher, options, cb) {
      return neo4jrestful.query(cypher,options,cb);
    }
  
    // Shortcut for neo4jrestul.stream
    Graph.prototype.stream = function(cypher, options, cb) {
      return neo4jrestful.stream(cypher,options,cb);
    }
  
    // Deletes *all* nodes and *all* relationships
    Graph.prototype.wipeDatabase = function(cb) {
      var query = "START n=node(*) MATCH n-[r?]-() DELETE n, r;";
      return this.query(query,cb);
    }
  
    // Counts all objects of a specific type: (all|node|relationship|[nr]:Movie)
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
  
    // Counts all relationships
    Graph.prototype.countRelationships = function(cb) {
      return this.countAllOfType('relationship', cb);
    }
  
    // Counts all nodes
    Graph.prototype.countNodes = function(cb) {
      return this.countAllOfType('node', cb);
    }
  
    // Counts all relationships and nodes
    Graph.prototype.countAll = function(cb) {
      return this.countAllOfType('all', cb);
    }
  
    // Queries information of the database and stores it on `this.info` 
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
  
  window.Neo4jMapper.init = function(urlOrOptions) {
    this.Neo4jRestful  = initNeo4jRestful();
    this.neo4jrestful  = this.client = new this.Neo4jRestful(urlOrOptions);
    this.Node          = initNode(this.neo4jrestful);
    this.Relationship  = initRelationship(this.neo4jrestful);
    this.Graph         = initGraph(this.neo4jrestful);
    this.Path          = initPath(this.neo4jrestful);
    this.helpers       = neo4jmapper_helpers;
    // to make it more convinient to use Neo4jMapper
    // we move Node, Relationship and Path to global scope if they are not used, yet
    return this;
  }
  
  return window.Neo4jMapper;
})();