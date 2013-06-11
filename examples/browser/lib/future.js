/*jshint laxcomma:true node:true es5:true onevar:true */
(function () {
  "use strict";

  var MAX_INT = Math.pow(2,52);

  function isFuture(obj) {
    return obj instanceof Future;
  }

  function FutureTimeoutException(time) {
    this.name = "FutureTimeout";
    this.message = "timeout " + time + "ms";
  }

  //
  function privatize(obj, pubs) {
    var result = {};
    pubs.forEach(function (pub) {
      result[pub] = function () {
        obj[pub].apply(obj, arguments);
        return result;
      };
    });
    return result;
  }

  function Future(global_context, options) {
    if (!isFuture(this)) {
      return new Future(global_context, options);
    }

    var self = this
      ;
      
    self._everytimers = {};
    self._onetimers = {};
    self._index = 0;
    self._deliveries = 0;
    self._time = 0;
    //self._asap = false;
    self._asap =  true;

    //self._data;
    //self._timeout_id;

    self._passenger = null;
    self.fulfilled = false;

    self._global_context = global_context;

    // TODO change `null` to `this`
    self._global_context = ('undefined' === typeof self._global_context ? null : self._global_context);

    self._options = options || {};
    self._options.error = self._options.error || function (err) {
      throw err;
    };

    self.errback = function () {
      if (arguments.length < 2) {
        self.deliver.call(self, arguments[0] || new Error("`errback` called without Error"));
      } else {
        self.deliver.apply(self, arguments);
      }
    };

    self.callback = function () {
      var args = Array.prototype.slice.call(arguments);

      args.unshift(undefined);
      self.deliver.apply(self, args);
    };

    self.fulfill = function () {
      if (arguments.length) {
        self.deliver.apply(self, arguments);
      } else {
        self.deliver();
      }
      self.fulfilled = true;
    };

    self.when = function (callback, local_context) {
      // this self._index will be the id of the everytimer
      self._onetimers[self._index] = true;
      self.whenever(callback, local_context);

      return self;
    };

    self.whenever = function (callback, local_context) {
      var id = self._index,
        everytimer;

      if ('function' !== typeof callback) {
        self._options.error(new Error("Future().whenever(callback, [context]): callback must be a function."));
        return;
      }

      if (self._findCallback(callback, local_context)) {
        // TODO log
        self._options.error(new Error("Future().everytimers is a strict set. Cannot add already subscribed `callback, [context]`."));
        return;
      }

      everytimer = self._everytimers[id] = {
        id: id,
        callback: callback,
        context: (null === local_context) ? null : (local_context || self._global_context)
      };

      if (self._asap && self._deliveries > 0) {
        // doesn't raise deliver count on purpose
        everytimer.callback.apply(everytimer.context, self._data);
        if (self._onetimers[id]) {
          delete self._onetimers[id];
          delete self._everytimers[id];
        }
      }

      self._index += 1;
      if (self._index >= MAX_INT) {
        self._cleanup(); // Works even for long-running processes
      }

      return self;
    };

    self.deliver = function () {
      if (self.fulfilled) {
        self._options.error(new Error("`Future().fulfill(err, data, ...)` renders future deliveries useless"));
        return;
      }

      var args = Array.prototype.slice.call(arguments);
      self._data = args;

      self._deliveries += 1; // Eventually reaches `Infinity`...

      Object.keys(self._everytimers).forEach(function (id) {
        var everytimer = self._everytimers[id],
          callback = everytimer.callback,
          context = everytimer.context;

        if (self._onetimers[id]) {
          delete self._everytimers[id];
          delete self._onetimers[id];
        }

        // TODO
        callback.apply(context, args);
        /*
        callback.apply(('undefined' !== context ? context : newme), args);
        context = newme;
        context = ('undefined' !== global_context ? global_context : context)
        context = ('undefined' !== local_context ? local_context : context)
        */
      });

      if (args[0] && "FutureTimeout" !== args[0].name) {
        self._resetTimeout();
      }


      return self;
    };
  }

  Future.prototype.setContext = function (context) {
    var self = this
      ;

    self._global_context = context;
  };

  Future.prototype.setTimeout = function (new_time) {
    var self = this
      ;

    self._time = new_time;
    self._resetTimeout();
  };

  Future.prototype._resetTimeout = function () {
    var self = this
      ;

    if (self._timeout_id) {
      clearTimeout(self._timeout_id);
      self._timeout_id = undefined;
    }

    if (self._time > 0) {
      self._timeout_id = setTimeout(function () {
        self.deliver(new FutureTimeoutException(self._time));
        self._timeout_id = undefined;
      }, self._time);
    }
  };

  Future.prototype.callbackCount = function() {
    var self = this
      ;

    return Object.keys(self._everytimers).length;
  };

  Future.prototype.deliveryCount = function() {
    var self = this
      ;

    return self._deliveries;
  };

  Future.prototype.setAsap = function(new_asap) {
    var self = this
      ;

    if (undefined === new_asap) {
      new_asap = true;
    }

    if (true !== new_asap && false !== new_asap) {
      self._options.error(new Error("Future.setAsap(asap) accepts literal true or false, not " + new_asap));
      return;
    }

    self._asap = new_asap;
  };

  Future.prototype._findCallback = function (callback, context) {
    var self = this
      , result
      ;

    Object.keys(self._everytimers).forEach(function (id) {
      var everytimer = self._everytimers[id]
        ;

      if (callback === everytimer.callback) {
        if (context === everytimer.context || everytimer.context === self._global_context) {
          result = everytimer;
        }
      }
    });

    return result;
  };

  Future.prototype.hasCallback = function () {
    var self = this
      ;

    return !!self._findCallback.apply(self, arguments);
  };

  Future.prototype.removeCallback = function(callback, context) {
    var self = this
      , everytimer = self._findCallback(callback, context)
      ;
      
    if (everytimer) {
      delete self._everytimers[everytimer.id];
      self._onetimers[everytimer.id] = undefined;
      delete self._onetimers[everytimer.id];
    }

    return self;
  };

  Future.prototype.passable = function () {
    var self = this
      ;

    self._passenger = privatize(self, [
      "when",
      "whenever"
    ]);

    return self._passenger;
  };

  // this will probably never get called and, hence, is not yet well tested
  Future.prototype._cleanup = function () {
    var self = this
      , new_everytimers = {}
      , new_onetimers = {}
      ;

    self._index = 0;
    Object.keys(self._everytimers).forEach(function (id) {
      var newtimer = new_everytimers[self._index] = self._everytimers[id];

      if (self._onetimers[id]) {
        new_onetimers[self._index] = true;
      }

      newtimer.id = self._index;
      self._index += 1;
    });

    self._onetimers = new_onetimers;
    self._everytimers = new_everytimers;
  };

  function create(context, options) {
    // TODO use prototype hack instead of new?
    return new Future(context, options);
  }

  Future.prototype.isFuture = isFuture;

  Future.isFuture = isFuture;
  Future.create = create;

  window.Future = Future;
}());

/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true*/
(function () {
  "use strict";

  var Future = window.Future;

  function isJoin(obj) {
    return obj instanceof Join;
  }

  function Join(global_context) {
    var self = this
      , data = []
      , ready = []
      , subs = []
      , promise_only = false
      , begun = false
      , updated = 0
      , join_future = Future.create(global_context)
      ;

    global_context = global_context || null;

    if (!isJoin(this)) {
      return new Join(global_context);
    }

    function relay() {
      var i;
      if (!begun || updated !== data.length) {
        return;
      }
      updated = 0;
      join_future.deliver.apply(join_future, data);
      data = new Array(data.length);
      ready = new Array(ready.length);
      //for (i = 0; i < data.length; i += 1) {
      //  data[i] = undefined;
      //}
    }

    function init() {
      var type = (promise_only ? "when" : "whenever");

      begun = true;
      data = new Array(subs.length);
      ready = new Array(ready.length);

      subs.forEach(function (sub, id) {
        sub[type](function () {
          var args = Array.prototype.slice.call(arguments);
          data[id] = args;
          if (!ready[id]) {
            ready[id] = true;
            updated += 1;
          }
          relay();
        });
      });
    }

    self.deliverer = function () {
      var future = Future.create();
      self.add(future);
      return future.deliver;
    };
    self.newCallback = self.deliverer;

    // fn, ctx
    self.when = function () {
      if (!begun) {
        init();
      }
      join_future.when.apply(join_future, arguments);
    };

    // fn, ctx
    self.whenever = function () {
      if (!begun) {
        init();
      }
      join_future.whenever.apply(join_future, arguments);
    };

    self.add = function () {
      if (begun) {
        throw new Error("`Join().add(Array<future> | subs1, [subs2, ...])` requires that all additions be completed before the first `when()` or `whenever()`");
      }
      var args = Array.prototype.slice.call(arguments);
      if (0 === args.length) {
        return self.newCallback();
      }
      args = Array.isArray(args[0]) ? args[0] : args;
      args.forEach(function (sub) {
        if (!sub.whenever) {
          promise_only = true;
        }
        if (!sub.when) {
          throw new Error("`Join().add(future)` requires either a promise or future");
        }
        subs.push(sub);
      });
    };
  }

  function createJoin(context) {
    // TODO use prototype instead of new
    return (new Join(context));
  }

  Join.create = createJoin;
  Join.isJoin = isJoin;

  window.Join = Join;
}());