/*!
 * Pusher JavaScript Library v2.0.2
 * http://pusherapp.com/
 *
 * Copyright 2013, Pusher
 * Released under the MIT licence.
 */

;(function() {
  function Pusher(app_key, options) {
    var self = this;

    this.options = options || {};
    this.key = app_key;
    this.channels = new Pusher.Channels();
    this.global_emitter = new Pusher.EventsDispatcher();
    this.sessionID = Math.floor(Math.random() * 1000000000);

    checkAppKey(this.key);

    var getStrategy = function(options) {
      return Pusher.StrategyBuilder.build(
        Pusher.getDefaultStrategy(),
        Pusher.Util.extend({}, self.options, options)
      );
    };
    var getTimeline = function() {
      return new Pusher.Timeline(self.key, self.sessionID, {
        features: Pusher.Util.getClientFeatures(),
        params: self.options.timelineParams || {},
        limit: 25,
        level: Pusher.Timeline.INFO,
        version: Pusher.VERSION
      });
    };
    var getTimelineSender = function(timeline, options) {
      if (self.options.disableStats) {
        return null;
      }
      return new Pusher.TimelineSender(timeline, {
        encrypted: self.isEncrypted() || !!options.encrypted,
        host: Pusher.stats_host,
        path: "/timeline"
      });
    };

    this.connection = new Pusher.ConnectionManager(
      this.key,
      Pusher.Util.extend(
        { getStrategy: getStrategy,
          getTimeline: getTimeline,
          getTimelineSender: getTimelineSender,
          activityTimeout: Pusher.activity_timeout,
          pongTimeout: Pusher.pong_timeout,
          unavailableTimeout: Pusher.unavailable_timeout
        },
        this.options,
        { encrypted: this.isEncrypted() }
      )
    );

    this.connection.bind('connected', function() {
      self.subscribeAll();
    });
    this.connection.bind('message', function(params) {
      var internal = (params.event.indexOf('pusher_internal:') === 0);
      if (params.channel) {
        var channel = self.channel(params.channel);
        if (channel) {
          channel.emit(params.event, params.data);
        }
      }
      // Emit globaly [deprecated]
      if (!internal) self.global_emitter.emit(params.event, params.data);
    });
    this.connection.bind('disconnected', function() {
      self.channels.disconnect();
    });
    this.connection.bind('error', function(err) {
      Pusher.warn('Error', err);
    });

    Pusher.instances.push(this);

    if (Pusher.isReady) self.connect();
  }
  var prototype = Pusher.prototype;

  Pusher.instances = [];
  Pusher.isReady = false;

  // To receive log output provide a Pusher.log function, for example
  // Pusher.log = function(m){console.log(m)}
  Pusher.debug = function() {
    if (!Pusher.log) {
      return;
    }
    Pusher.log(Pusher.Util.stringify.apply(this, arguments));
  };

  Pusher.warn = function() {
    if (window.console && window.console.warn) {
      window.console.warn(Pusher.Util.stringify.apply(this, arguments));
    } else {
      if (!Pusher.log) {
        return;
      }
      Pusher.log(Pusher.Util.stringify.apply(this, arguments));
    }
  };

  Pusher.ready = function() {
    Pusher.isReady = true;
    for (var i = 0, l = Pusher.instances.length; i < l; i++) {
      Pusher.instances[i].connect();
    }
  };

  prototype.channel = function(name) {
    return this.channels.find(name);
  };

  prototype.connect = function() {
    this.connection.connect();
  };

  prototype.disconnect = function() {
    this.connection.disconnect();
  };

  prototype.bind = function(event_name, callback) {
    this.global_emitter.bind(event_name, callback);
    return this;
  };

  prototype.bind_all = function(callback) {
    this.global_emitter.bind_all(callback);
    return this;
  };

  prototype.subscribeAll = function() {
    var channelName;
    for (channelName in this.channels.channels) {
      if (this.channels.channels.hasOwnProperty(channelName)) {
        this.subscribe(channelName);
      }
    }
  };

  prototype.subscribe = function(channel_name) {
    var self = this;
    var channel = this.channels.add(channel_name, this);

    if (this.connection.state === 'connected') {
      channel.authorize(
        this.connection.socket_id,
        this.options,
        function(err, data) {
          if (err) {
            channel.emit('pusher:subscription_error', data);
          } else {
            self.send_event('pusher:subscribe', {
              channel: channel_name,
              auth: data.auth,
              channel_data: data.channel_data
            });
          }
        }
      );
    }
    return channel;
  };

  prototype.unsubscribe = function(channel_name) {
    this.channels.remove(channel_name);
    if (this.connection.state === 'connected') {
      this.send_event('pusher:unsubscribe', {
        channel: channel_name
      });
    }
  };

  prototype.send_event = function(event_name, data, channel) {
    return this.connection.send_event(event_name, data, channel);
  };

  prototype.isEncrypted = function() {
    if (Pusher.Util.getDocumentLocation().protocol === "https:") {
      return true;
    } else {
      return !!this.options.encrypted;
    }
  };

  function checkAppKey(key) {
    if (key === null || key === undefined) {
      Pusher.warn(
        'Warning', 'You must pass your app key when you instantiate Pusher.'
      );
    }
  }

  this.Pusher = Pusher;
}).call(this);

;(function() {
  Pusher.Util = {
    now: function() {
      if (Date.now) {
        return Date.now();
      } else {
        return new Date().valueOf();
      }
    },

    /** Merges multiple objects into the target argument.
     *
     * For properties that are plain Objects, performs a deep-merge. For the
     * rest it just copies the value of the property.
     *
     * To extend prototypes use it as following:
     *   Pusher.Util.extend(Target.prototype, Base.prototype)
     *
     * You can also use it to merge objects without altering them:
     *   Pusher.Util.extend({}, object1, object2)
     *
     * @param  {Object} target
     * @return {Object} the target argument
     */
    extend: function(target) {
      for (var i = 1; i < arguments.length; i++) {
        var extensions = arguments[i];
        for (var property in extensions) {
          if (extensions[property] && extensions[property].constructor &&
              extensions[property].constructor === Object) {
            target[property] = Pusher.Util.extend(
              target[property] || {}, extensions[property]
            );
          } else {
            target[property] = extensions[property];
          }
        }
      }
      return target;
    },

    stringify: function() {
      var m = ["Pusher"];
      for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] === "string") {
          m.push(arguments[i]);
        } else {
          if (window.JSON === undefined) {
            m.push(arguments[i].toString());
          } else {
            m.push(JSON.stringify(arguments[i]));
          }
        }
      }
      return m.join(" : ");
    },

    arrayIndexOf: function(array, item) { // MSIE doesn't have array.indexOf
      var nativeIndexOf = Array.prototype.indexOf;
      if (array === null) {
        return -1;
      }
      if (nativeIndexOf && array.indexOf === nativeIndexOf) {
        return array.indexOf(item);
      }
      for (var i = 0, l = array.length; i < l; i++) {
        if (array[i] === item) {
          return i;
        }
      }
      return -1;
    },

    keys: function(object) {
      var result = [];
      for (var key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          result.push(key);
        }
      }
      return result;
    },

    /** Applies a function f to all elements of an array.
     *
     * Function f gets 3 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the array
     *
     * @param {Array} array
     * @param {Function} f
     */
    apply: function(array, f) {
      for (var i = 0; i < array.length; i++) {
        f(array[i], i, array);
      }
    },

    /** Applies a function f to all properties of an object.
     *
     * Function f gets 3 arguments passed:
     * - element from the object
     * - key of the element
     * - reference to the object
     *
     * @param {Object} object
     * @param {Function} f
     */
    objectApply: function(object, f) {
      for (var key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          f(object[key], key, object);
        }
      }
    },

    /** Maps all elements of the array and returns the result.
     *
     * Function f gets 4 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the source array
     * - reference to the destination array
     *
     * @param {Array} array
     * @param {Function} f
     */
    map: function(array, f) {
      var result = [];
      for (var i = 0; i < array.length; i++) {
        result.push(f(array[i], i, array, result));
      }
      return result;
    },

    /** Maps all elements of the object and returns the result.
     *
     * Function f gets 4 arguments passed:
     * - element from the object
     * - key of the element
     * - reference to the source object
     * - reference to the destination object
     *
     * @param {Object} object
     * @param {Function} f
     */
    mapObject: function(object, f) {
      var result = {};
      for (var key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          result[key] = f(object[key]);
        }
      }
      return result;
    },

    /** Filters elements of the array using a test function.
     *
     * Function test gets 4 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the source array
     * - reference to the destination array
     *
     * @param {Array} array
     * @param {Function} f
     */
    filter: function(array, test) {
      test = test || function(value) { return !!value; };

      var result = [];
      for (var i = 0; i < array.length; i++) {
        if (test(array[i], i, array, result)) {
          result.push(array[i]);
        }
      }
      return result;
    },

    /** Filters properties of the object using a test function.
     *
     * Function test gets 4 arguments passed:
     * - element from the object
     * - key of the element
     * - reference to the source object
     * - reference to the destination object
     *
     * @param {Object} object
     * @param {Function} f
     */
    filterObject: function(object, test) {
      test = test || function(value) { return !!value; };

      var result = {};
      for (var key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          if (test(object[key], key, object, result)) {
            result[key] = object[key];
          }
        }
      }
      return result;
    },

    /** Flattens an object into a two-dimensional array.
     *
     * @param  {Object} object
     * @return {Array} resulting array of [key, value] pairs
     */
    flatten: function(object) {
      var result = [];
      for (var key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          result.push([key, object[key]]);
        }
      }
      return result;
    },

    /** Checks whether any element of the array passes the test.
     *
     * Function test gets 3 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the source array
     *
     * @param {Array} array
     * @param {Function} f
     */
    any: function(array, test) {
      for (var i = 0; i < array.length; i++) {
        if (test(array[i], i, array)) {
          return true;
        }
      }
      return false;
    },

    /** Checks whether all elements of the array pass the test.
     *
     * Function test gets 3 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the source array
     *
     * @param {Array} array
     * @param {Function} f
     */
    all: function(array, test) {
      for (var i = 0; i < array.length; i++) {
        if (!test(array[i], i, array)) {
          return false;
        }
      }
      return true;
    },

    /** Builds a function that will proxy a method call to its first argument.
     *
     * Allows partial application of arguments, so additional arguments are
     * prepended to the argument list.
     *
     * @param  {String} name method name
     * @return {Function} proxy function
     */
    method: function(name) {
      var boundArguments = Array.prototype.slice.call(arguments, 1);
      return function(object) {
        return object[name].apply(object, boundArguments.concat(arguments));
      };
    },

    getDocument: function() {
      return document;
    },

    getDocumentLocation: function() {
      return Pusher.Util.getDocument().location;
    },

    getLocalStorage: function() {
      return window.localStorage;
    },

    getClientFeatures: function() {
      return Pusher.Util.keys(
        Pusher.Util.filterObject(
          { "ws": Pusher.WSTransport, "flash": Pusher.FlashTransport },
          function (t) { return t.isSupported(); }
        )
      );
    }
  };
}).call(this);

;(function() {
  Pusher.VERSION = '2.0.2';
  Pusher.PROTOCOL = 6;

  // WS connection parameters
  Pusher.host = 'ws.pusherapp.com';
  Pusher.ws_port = 80;
  Pusher.wss_port = 443;
  // SockJS fallback parameters
  Pusher.sockjs_host = 'sockjs.pusher.com';
  Pusher.sockjs_http_port = 80;
  Pusher.sockjs_https_port = 443;
  Pusher.sockjs_path = "/pusher";
  // Stats
  Pusher.stats_host = 'stats.pusher.com';
  // Other settings
  Pusher.channel_auth_endpoint = '/pusher/auth';
  Pusher.cdn_http = 'http://js.pusher.com/';
  Pusher.cdn_https = 'https://d3dy5gmtp8yhk7.cloudfront.net/';
  Pusher.dependency_suffix = '';
  Pusher.channel_auth_transport = 'ajax';
  Pusher.activity_timeout = 120000;
  Pusher.pong_timeout = 30000;
  Pusher.unavailable_timeout = 10000;

  Pusher.getDefaultStrategy = function() {
    return [
      [":def", "ws_options", {
        hostUnencrypted: Pusher.host + ":" + Pusher.ws_port,
        hostEncrypted: Pusher.host + ":" + Pusher.wss_port
      }],
      [":def", "sockjs_options", {
        hostUnencrypted: Pusher.sockjs_host + ":" + Pusher.sockjs_http_port,
        hostEncrypted: Pusher.sockjs_host + ":" + Pusher.sockjs_https_port
      }],
      [":def", "timeouts", {
        loop: true,
        timeout: 15000,
        timeoutLimit: 60000
      }],

      [":def", "ws_manager", [":transport_manager", { lives: 2 }]],
      [":def_transport", "ws", "ws", 3, ":ws_options", ":ws_manager"],
      [":def_transport", "flash", "flash", 2, ":ws_options", ":ws_manager"],
      [":def_transport", "sockjs", "sockjs", 1, ":sockjs_options"],
      [":def", "ws_loop", [":sequential", ":timeouts", ":ws"]],
      [":def", "flash_loop", [":sequential", ":timeouts", ":flash"]],
      [":def", "sockjs_loop", [":sequential", ":timeouts", ":sockjs"]],

      [":def", "strategy",
        [":cached", 1800000,
          [":first_connected",
            [":if", [":is_supported", ":ws"], [
                ":best_connected_ever", ":ws_loop", [":delayed", 2000, [":sockjs_loop"]]
              ], [":if", [":is_supported", ":flash"], [
                ":best_connected_ever", ":flash_loop", [":delayed", 2000, [":sockjs_loop"]]
              ], [
                ":sockjs_loop"
              ]
            ]]
          ]
        ]
      ]
    ];
  };
}).call(this);

;(function() {
  function buildExceptionClass(name) {
    var klass = function(message) {
      Error.call(this, message);
      this.name = name;
    };
    Pusher.Util.extend(klass.prototype, Error.prototype);

    return klass;
  }

  /** Error classes used throughout pusher-js library. */
  Pusher.Errors = {
    UnsupportedTransport: buildExceptionClass("UnsupportedTransport"),
    UnsupportedStrategy: buildExceptionClass("UnsupportedStrategy"),
    TransportPriorityTooLow: buildExceptionClass("TransportPriorityTooLow"),
    TransportClosed: buildExceptionClass("TransportClosed")
  };
}).call(this);

;(function() {
  /** Manages callback bindings and event emitting.
   *
   * @param Function failThrough called when no listeners are bound to an event
   */
  function EventsDispatcher(failThrough) {
    this.callbacks = new CallbackRegistry();
    this.global_callbacks = [];
    this.failThrough = failThrough;
  }
  var prototype = EventsDispatcher.prototype;

  prototype.bind = function(eventName, callback) {
    this.callbacks.add(eventName, callback);
    return this;
  };

  prototype.bind_all = function(callback) {
    this.global_callbacks.push(callback);
    return this;
  };

  prototype.unbind = function(eventName, callback) {
    this.callbacks.remove(eventName, callback);
    return this;
  };

  prototype.emit = function(eventName, data) {
    var i;

    for (i = 0; i < this.global_callbacks.length; i++) {
      this.global_callbacks[i](eventName, data);
    }

    var callbacks = this.callbacks.get(eventName);
    if (callbacks && callbacks.length > 0) {
      for (i = 0; i < callbacks.length; i++) {
        callbacks[i](data);
      }
    } else if (this.failThrough) {
      this.failThrough(eventName, data);
    }

    return this;
  };

  /** Callback registry helper. */

  function CallbackRegistry() {
    this._callbacks = {};
  }

  CallbackRegistry.prototype.get = function(eventName) {
    return this._callbacks[this._prefix(eventName)];
  };

  CallbackRegistry.prototype.add = function(eventName, callback) {
    var prefixedEventName = this._prefix(eventName);
    this._callbacks[prefixedEventName] = this._callbacks[prefixedEventName] || [];
    this._callbacks[prefixedEventName].push(callback);
  };

  CallbackRegistry.prototype.remove = function(eventName, callback) {
    if(this.get(eventName)) {
      var index = Pusher.Util.arrayIndexOf(this.get(eventName), callback);
      var callbacksCopy = this._callbacks[this._prefix(eventName)].slice(0);
      callbacksCopy.splice(index, 1);
      this._callbacks[this._prefix(eventName)] = callbacksCopy;
    }
  };

  CallbackRegistry.prototype._prefix = function(eventName) {
    return "_" + eventName;
  };

  Pusher.EventsDispatcher = EventsDispatcher;
}).call(this);

;(function() {
  /** Handles loading dependency files.
   *
   * Options:
   * - cdn_http - url to HTTP CND
   * - cdn_https - url to HTTPS CDN
   * - version - version of pusher-js
   * - suffix - suffix appended to all names of dependency files
   *
   * @param {Object} options
   */
  function DependencyLoader(options) {
    this.options = options;
    this.loading = {};
    this.loaded = {};
  }
  var prototype = DependencyLoader.prototype;

  /** Loads the dependency from CDN.
   *
   * @param  {String} name
   * @param  {Function} callback
   */
  prototype.load = function(name, callback) {
    var self = this;

    if (this.loaded[name]) {
      callback();
      return;
    }

    if (!this.loading[name]) {
      this.loading[name] = [];
    }
    this.loading[name].push(callback);
    if (this.loading[name].length > 1) {
      return;
    }

    require(this.getPath(name), function() {
      for (var i = 0; i < self.loading[name].length; i++) {
        self.loading[name][i]();
      }
      delete self.loading[name];
      self.loaded[name] = true;
    });
  };

  /** Returns a root URL for pusher-js CDN.
   *
   * @returns {String}
   */
  prototype.getRoot = function(options) {
    var cdn;
    var protocol = Pusher.Util.getDocumentLocation().protocol;
    if ((options && options.encrypted) || protocol === "https:") {
      cdn = this.options.cdn_https;
    } else {
      cdn = this.options.cdn_http;
    }
    // make sure there are no double slashes
    return cdn.replace(/\/*$/, "") + "/" + this.options.version;
  };

  /** Returns a full path to a dependency file.
   *
   * @param {String} name
   * @returns {String}
   */
  prototype.getPath = function(name, options) {
    return this.getRoot(options) + '/' + name + this.options.suffix + '.js';
  };

  function handleScriptLoaded(elem, callback) {
    if (Pusher.Util.getDocument().addEventListener) {
      elem.addEventListener('load', callback, false);
    } else {
      elem.attachEvent('onreadystatechange', function () {
        if (elem.readyState === 'loaded' || elem.readyState === 'complete') {
          callback();
        }
      });
    }
  }

  function require(src, callback) {
    var document = Pusher.Util.getDocument();
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');

    script.setAttribute('src', src);
    script.setAttribute("type","text/javascript");
    script.setAttribute('async', true);

    handleScriptLoaded(script, function() {
      // workaround for an Opera issue
      setTimeout(callback, 0);
    });

    head.appendChild(script);
  }

  Pusher.DependencyLoader = DependencyLoader;
}).call(this);

;(function() {
  Pusher.Dependencies = new Pusher.DependencyLoader({
    cdn_http: Pusher.cdn_http,
    cdn_https: Pusher.cdn_https,
    version: Pusher.VERSION,
    suffix: Pusher.dependency_suffix
  });

  // Support Firefox versions which prefix WebSocket
  if (!window.WebSocket && window.MozWebSocket) {
    window.WebSocket = window.MozWebSocket;
  }

  function initialize() {
    Pusher.ready();
  }

  // Allows calling a function when the document body is available
   function onDocumentBody(callback) {
    if (document.body) {
      callback();
    } else {
      setTimeout(function() {
        onDocumentBody(callback);
      }, 0);
    }
  }

  function initializeOnDocumentBody() {
    onDocumentBody(initialize);
  }

  if (!window.JSON) {
    Pusher.Dependencies.load("json2", initializeOnDocumentBody);
  } else {
    initializeOnDocumentBody();
  }
})();

;(function() {
  /** Cross-browser compatible timer abstraction.
   *
   * @param {Number} delay
   * @param {Function} callback
   */
  function Timer(delay, callback) {
    var self = this;

    this.timeout = setTimeout(function() {
      if (self.timeout !== null) {
        callback();
        self.timeout = null;
      }
    }, delay);
  }
  var prototype = Timer.prototype;

  /** Returns whether the timer is still running.
   *
   * @return {Boolean}
   */
  prototype.isRunning = function() {
    return this.timeout !== null;
  };

  /** Aborts a timer when it's running. */
  prototype.ensureAborted = function() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  };

  Pusher.Timer = Timer;
}).call(this);

(function() {

  var Base64 = {
    encode: function (s) {
      return btoa(utob(s));
    }
  };

  var fromCharCode = String.fromCharCode;

  var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var b64tab = {};

  for (var i = 0, l = b64chars.length; i < l; i++) {
    b64tab[b64chars.charAt(i)] = i;
  }

  var cb_utob = function(c) {
    var cc = c.charCodeAt(0);
    return cc < 0x80 ? c
        : cc < 0x800 ? fromCharCode(0xc0 | (cc >>> 6)) +
                       fromCharCode(0x80 | (cc & 0x3f))
        : fromCharCode(0xe0 | ((cc >>> 12) & 0x0f)) +
          fromCharCode(0x80 | ((cc >>>  6) & 0x3f)) +
          fromCharCode(0x80 | ( cc         & 0x3f));
  };

  var utob = function(u) {
    return u.replace(/[^\x00-\x7F]/g, cb_utob);
  };

  var cb_encode = function(ccc) {
    var padlen = [0, 2, 1][ccc.length % 3];
    var ord = ccc.charCodeAt(0) << 16
      | ((ccc.length > 1 ? ccc.charCodeAt(1) : 0) << 8)
      | ((ccc.length > 2 ? ccc.charCodeAt(2) : 0));
    var chars = [
      b64chars.charAt( ord >>> 18),
      b64chars.charAt((ord >>> 12) & 63),
      padlen >= 2 ? '=' : b64chars.charAt((ord >>> 6) & 63),
      padlen >= 1 ? '=' : b64chars.charAt(ord & 63)
    ];
    return chars.join('');
  };

  var btoa = window.btoa || function(b) {
    return b.replace(/[\s\S]{1,3}/g, cb_encode);
  };

  Pusher.Base64 = Base64;

}).call(this);

(function() {

  function JSONPRequest(options) {
    this.options = options;
  }

  JSONPRequest.send = function(options, callback) {
    var request = new Pusher.JSONPRequest({
      url: options.url,
      receiver: options.receiverName,
      tagPrefix: options.tagPrefix
    });
    var id = options.receiver.register(function(error, result) {
      request.cleanup();
      callback(error, result);
    });

    return request.send(id, options.data, function(error) {
      var callback = options.receiver.unregister(id);
      if (callback) {
        callback(error);
      }
    });
  };

  var prototype = JSONPRequest.prototype;

  prototype.send = function(id, data, callback) {
    if (this.script) {
      return false;
    }

    var tagPrefix = this.options.tagPrefix || "_pusher_jsonp_";

    var params = Pusher.Util.extend(
      {}, data, { receiver: this.options.receiver }
    );
    var query = Pusher.Util.map(
      Pusher.Util.flatten(
        encodeData(
          Pusher.Util.filterObject(params, function(value) {
            return value !== undefined;
          })
        )
      ),
      Pusher.Util.method("join", "=")
    ).join("&");

    this.script = document.createElement("script");
    this.script.id = tagPrefix + id;
    this.script.src = this.options.url + "/" + id + "?" + query;
    this.script.type = "text/javascript";
    this.script.charset = "UTF-8";
    this.script.onerror = this.script.onload = callback;

    // Opera<11.6 hack for missing onerror callback
    if (this.script.async === undefined && document.attachEvent) {
      if (/opera/i.test(navigator.userAgent)) {
        var receiverName = this.options.receiver || "Pusher.JSONP.receive";
        this.errorScript = document.createElement("script");
        this.errorScript.text = receiverName + "(" + id + ", true);";
        this.script.async = this.errorScript.async = false;
      }
    }

    var self = this;
    this.script.onreadystatechange = function() {
      if (self.script && /loaded|complete/.test(self.script.readyState)) {
        callback(true);
      }
    };

    var head = document.getElementsByTagName('head')[0];
    head.insertBefore(this.script, head.firstChild);
    if (this.errorScript) {
      head.insertBefore(this.errorScript, this.script.nextSibling);
    }

    return true;
  };

  prototype.cleanup = function() {
    if (this.script && this.script.parentNode) {
      this.script.parentNode.removeChild(this.script);
      this.script = null;
    }
    if (this.errorScript && this.errorScript.parentNode) {
      this.errorScript.parentNode.removeChild(this.errorScript);
      this.errorScript = null;
    }
  };

  function encodeData(data) {
    return Pusher.Util.mapObject(data, function(value) {
      if (typeof value === "object") {
        value = JSON.stringify(value);
      }
      return encodeURIComponent(Pusher.Base64.encode(value.toString()));
    });
  }

  Pusher.JSONPRequest = JSONPRequest;

}).call(this);

(function() {

  function JSONPReceiver() {
    this.lastId = 0;
    this.callbacks = {};
  }

  var prototype = JSONPReceiver.prototype;

  prototype.register = function(callback) {
    this.lastId++;
    var id = this.lastId;
    this.callbacks[id] = callback;
    return id;
  };

  prototype.unregister = function(id) {
    if (this.callbacks[id]) {
      var callback = this.callbacks[id];
      delete this.callbacks[id];
      return callback;
    } else {
      return null;
    }
  };

  prototype.receive = function(id, error, data) {
    var callback = this.unregister(id);
    if (callback) {
      callback(error, data);
    }
  };

  Pusher.JSONPReceiver = JSONPReceiver;
  Pusher.JSONP = new JSONPReceiver();

}).call(this);

(function() {
  function Timeline(key, session, options) {
    this.key = key;
    this.session = session;
    this.events = [];
    this.options = options || {};
    this.sent = 0;
    this.uniqueID = 0;
  }
  var prototype = Timeline.prototype;

  // Log levels
  Timeline.ERROR = 3;
  Timeline.INFO = 6;
  Timeline.DEBUG = 7;

  prototype.log = function(level, event) {
    if (this.options.level === undefined || level <= this.options.level) {
      this.events.push(
        Pusher.Util.extend({}, event, {
          timestamp: Pusher.Util.now(),
          level: level
        })
      );
      if (this.options.limit && this.events.length > this.options.limit) {
        this.events.shift();
      }
    }
  };

  prototype.error = function(event) {
    this.log(Timeline.ERROR, event);
  };

  prototype.info = function(event) {
    this.log(Timeline.INFO, event);
  };

  prototype.debug = function(event) {
    this.log(Timeline.DEBUG, event);
  };

  prototype.isEmpty = function() {
    return this.events.length === 0;
  };

  prototype.send = function(sendJSONP, callback) {
    var self = this;

    var data = {};
    if (this.sent === 0) {
      data = Pusher.Util.extend({
        key: this.key,
        features: this.options.features,
        version: this.options.version
      }, this.options.params || {});
    }
    data.session = this.session;
    data.timeline = this.events;
    data = Pusher.Util.filterObject(data, function(v) {
      return v !== undefined;
    });

    this.events = [];
    sendJSONP(data, function(error, result) {
      if (!error) {
        self.sent++;
      }
      callback(error, result);
    });

    return true;
  };

  prototype.generateUniqueID = function() {
    this.uniqueID++;
    return this.uniqueID;
  };

  Pusher.Timeline = Timeline;
}).call(this);

(function() {
  function TimelineSender(timeline, options) {
    this.timeline = timeline;
    this.options = options || {};
  }
  var prototype = TimelineSender.prototype;

  prototype.send = function(callback) {
    if (this.timeline.isEmpty()) {
      return;
    }

    var options = this.options;
    var scheme = "http" + (this.isEncrypted() ? "s" : "") + "://";

    var sendJSONP = function(data, callback) {
      return Pusher.JSONPRequest.send({
        data: data,
        url: scheme + options.host + options.path,
        receiver: Pusher.JSONP
      }, callback);
    };
    this.timeline.send(sendJSONP, callback);
  };

  prototype.isEncrypted = function() {
    return !!this.options.encrypted;
  };

  Pusher.TimelineSender = TimelineSender;
}).call(this);

;(function() {
  /** Launches all substrategies and emits prioritized connected transports.
   *
   * @param {Array} strategies
   */
  function BestConnectedEverStrategy(strategies) {
    this.strategies = strategies;
  }
  var prototype = BestConnectedEverStrategy.prototype;

  prototype.isSupported = function() {
    return Pusher.Util.any(this.strategies, Pusher.Util.method("isSupported"));
  };

  prototype.connect = function(minPriority, callback) {
    return connect(this.strategies, minPriority, function(i, runners) {
      return function(error, connection) {
        runners[i].error = error;
        if (error) {
          if (allRunnersFailed(runners)) {
            callback(true);
          }
          return;
        }
        Pusher.Util.apply(runners, function(runner) {
          runner.forceMinPriority(connection.priority);
        });
        callback(null, connection);
      };
    });
  };

  /** Connects to all strategies in parallel.
   *
   * Callback builder should be a function that takes two arguments: index
   * and a list of runners. It should return another function that will be
   * passed to the substrategy with given index. Runners can be aborted using
   * abortRunner(s) functions from this class.
   *
   * @param  {Array} strategies
   * @param  {Function} callbackBuilder
   * @return {Object} strategy runner
   */
  function connect(strategies, minPriority, callbackBuilder) {
    var runners = Pusher.Util.map(strategies, function(strategy, i, _, rs) {
      return strategy.connect(minPriority, callbackBuilder(i, rs));
    });
    return {
      abort: function() {
        Pusher.Util.apply(runners, abortRunner);
      },
      forceMinPriority: function(p) {
        Pusher.Util.apply(runners, function(runner) {
          runner.forceMinPriority(p);
        });
      }
    };
  }

  function allRunnersFailed(runners) {
    return Pusher.Util.all(runners, function(runner) {
      return Boolean(runner.error);
    });
  }

  function abortRunner(runner) {
    if (!runner.error && !runner.aborted) {
      runner.abort();
      runner.aborted = true;
    }
  }

  Pusher.BestConnectedEverStrategy = BestConnectedEverStrategy;
}).call(this);

;(function() {
  /** Caches last successful transport and uses it for following attempts.
   *
   * @param {Strategy} strategy
   * @param {Object} transports
   * @param {Object} options
   */
  function CachedStrategy(strategy, transports, options) {
    this.strategy = strategy;
    this.transports = transports;
    this.ttl = options.ttl || 1800*1000;
    this.timeline = options.timeline;
  }
  var prototype = CachedStrategy.prototype;

  prototype.isSupported = function() {
    return this.strategy.isSupported();
  };

  prototype.connect = function(minPriority, callback) {
    var info = fetchTransportInfo();

    var strategies = [this.strategy];
    if (info && info.timestamp + this.ttl >= Pusher.Util.now()) {
      var transport = this.transports[info.transport];
      if (transport) {
        this.timeline.info({ cached: true, transport: info.transport });
        strategies.push(new Pusher.SequentialStrategy([transport], {
          timeout: info.latency * 2,
          failFast: true
        }));
      }
    }

    var startTimestamp = Pusher.Util.now();
    var runner = strategies.pop().connect(
      minPriority,
      function cb(error, connection) {
        if (error) {
          flushTransportInfo();
          if (strategies.length > 0) {
            startTimestamp = Pusher.Util.now();
            runner = strategies.pop().connect(minPriority, cb);
          } else {
            callback(error);
          }
        } else {
          var latency = Pusher.Util.now() - startTimestamp;
          storeTransportInfo(connection.name, latency);
          callback(null, connection);
        }
      }
    );

    return {
      abort: function() {
        runner.abort();
      },
      forceMinPriority: function(p) {
        minPriority = p;
        if (runner) {
          runner.forceMinPriority(p);
        }
      }
    };
  };

  function fetchTransportInfo() {
    var storage = Pusher.Util.getLocalStorage();
    if (storage) {
      var info = storage.pusherTransport;
      if (info) {
        return JSON.parse(storage.pusherTransport);
      }
    }
    return null;
  }

  function storeTransportInfo(transport, latency) {
    var storage = Pusher.Util.getLocalStorage();
    if (storage) {
      storage.pusherTransport = JSON.stringify({
        timestamp: Pusher.Util.now(),
        transport: transport,
        latency: latency
      });
    }
  }

  function flushTransportInfo() {
    var storage = Pusher.Util.getLocalStorage();
    if (storage) {
      delete storage.pusherTransport;
    }
  }

  Pusher.CachedStrategy = CachedStrategy;
}).call(this);

;(function() {
  /** Runs substrategy after specified delay.
   *
   * Options:
   * - delay - time in miliseconds to delay the substrategy attempt
   *
   * @param {Strategy} strategy
   * @param {Object} options
   */
  function DelayedStrategy(strategy, options) {
    this.strategy = strategy;
    this.options = { delay: options.delay };
  }
  var prototype = DelayedStrategy.prototype;

  prototype.isSupported = function() {
    return this.strategy.isSupported();
  };

  prototype.connect = function(minPriority, callback) {
    var strategy = this.strategy;
    var runner;
    var timer = new Pusher.Timer(this.options.delay, function() {
      runner = strategy.connect(minPriority, callback);
    });

    return {
      abort: function() {
        timer.ensureAborted();
        if (runner) {
          runner.abort();
        }
      },
      forceMinPriority: function(p) {
        minPriority = p;
        if (runner) {
          runner.forceMinPriority(p);
        }
      }
    };
  };

  Pusher.DelayedStrategy = DelayedStrategy;
}).call(this);

;(function() {
  /** Launches the substrategy and terminates on the first open connection.
   *
   * @param {Strategy} strategy
   */
  function FirstConnectedStrategy(strategy) {
    this.strategy = strategy;
  }
  var prototype = FirstConnectedStrategy.prototype;

  prototype.isSupported = function() {
    return this.strategy.isSupported();
  };

  prototype.connect = function(minPriority, callback) {
    var runner = this.strategy.connect(
      minPriority,
      function(error, connection) {
        if (connection) {
          runner.abort();
        }
        callback(error, connection);
      }
    );
    return runner;
  };

  Pusher.FirstConnectedStrategy = FirstConnectedStrategy;
}).call(this);

;(function() {
  /** Proxies method calls to one of substrategies basing on the test function.
   *
   * @param {Function} test
   * @param {Strategy} trueBranch strategy used when test returns true
   * @param {Strategy} falseBranch strategy used when test returns false
   */
  function IfStrategy(test, trueBranch, falseBranch) {
    this.test = test;
    this.trueBranch = trueBranch;
    this.falseBranch = falseBranch;
  }
  var prototype = IfStrategy.prototype;

  prototype.isSupported = function() {
    var branch = this.test() ? this.trueBranch : this.falseBranch;
    return branch.isSupported();
  };

  prototype.connect = function(minPriority, callback) {
    var branch = this.test() ? this.trueBranch : this.falseBranch;
    return branch.connect(minPriority, callback);
  };

  Pusher.IfStrategy = IfStrategy;
}).call(this);

;(function() {
  /** Loops through strategies with optional timeouts.
   *
   * Options:
   * - loop - whether it should loop through the substrategy list
   * - timeout - initial timeout for a single substrategy
   * - timeoutLimit - maximum timeout
   *
   * @param {Strategy[]} strategies
   * @param {Object} options
   */
  function SequentialStrategy(strategies, options) {
    this.strategies = strategies;
    this.loop = Boolean(options.loop);
    this.failFast = Boolean(options.failFast);
    this.timeout = options.timeout;
    this.timeoutLimit = options.timeoutLimit;
  }
  var prototype = SequentialStrategy.prototype;

  prototype.isSupported = function() {
    return Pusher.Util.any(this.strategies, Pusher.Util.method("isSupported"));
  };

  prototype.connect = function(minPriority, callback) {
    var self = this;

    var strategies = this.strategies;
    var current = 0;
    var timeout = this.timeout;
    var runner = null;

    var tryNextStrategy = function(error, connection) {
      if (connection) {
        callback(null, connection);
      } else {
        current = current + 1;
        if (self.loop) {
          current = current % strategies.length;
        }

        if (current < strategies.length) {
          if (timeout) {
            timeout = timeout * 2;
            if (self.timeoutLimit) {
              timeout = Math.min(timeout, self.timeoutLimit);
            }
          }
          runner = self.tryStrategy(
            strategies[current],
            minPriority,
            { timeout: timeout, failFast: self.failFast },
            tryNextStrategy
          );
        } else {
          callback(true);
        }
      }
    };

    runner = this.tryStrategy(
      strategies[current],
      minPriority,
      { timeout: timeout, failFast: this.failFast },
      tryNextStrategy
    );

    return {
      abort: function() {
        runner.abort();
      },
      forceMinPriority: function(p) {
        minPriority = p;
        if (runner) {
          runner.forceMinPriority(p);
        }
      }
    };
  };

  /** @private */
  prototype.tryStrategy = function(strategy, minPriority, options, callback) {
    var timer = null;
    var runner = null;

    runner = strategy.connect(minPriority, function(error, connection) {
      if (error && timer && timer.isRunning() && !options.failFast) {
        // advance to the next strategy after the timeout
        return;
      }
      if (timer) {
        timer.ensureAborted();
      }
      callback(error, connection);
    });

    if (options.timeout > 0) {
      timer = new Pusher.Timer(options.timeout, function() {
        runner.abort();
        callback(true);
      });
    }

    return {
      abort: function() {
        if (timer) {
          timer.ensureAborted();
        }
        runner.abort();
      },
      forceMinPriority: function(p) {
        runner.forceMinPriority(p);
      }
    };
  };

  Pusher.SequentialStrategy = SequentialStrategy;
}).call(this);

;(function() {
  /** Provides a strategy interface for transports.
   *
   * @param {String} name
   * @param {Number} priority
   * @param {Class} transport
   * @param {Object} options
   */
  function TransportStrategy(name, priority, transport, options) {
    this.name = name;
    this.priority = priority;
    this.transport = transport;
    this.options = options || {};
  }
  var prototype = TransportStrategy.prototype;

  /** Returns whether the transport is supported in the browser.
   *
   * @returns {Boolean}
   */
  prototype.isSupported = function() {
    return this.transport.isSupported({
      disableFlash: !!this.options.disableFlash
    });
  };

  /** Launches a connection attempt and returns a strategy runner.
   *
   * @param  {Function} callback
   * @return {Object} strategy runner
   */
  prototype.connect = function(minPriority, callback) {
    if (!this.transport.isSupported()) {
      return failAttempt(new Pusher.Errors.UnsupportedStrategy(), callback);
    } else if (this.priority < minPriority) {
      return failAttempt(new Pusher.Errors.TransportPriorityTooLow(), callback);
    }

    var self = this;
    var connection = this.transport.createConnection(
      this.name, this.priority, this.options.key, this.options
    );

    var onInitialized = function() {
      connection.unbind("initialized", onInitialized);
      connection.connect();
    };
    var onOpen = function() {
      unbindListeners();
      callback(null, connection);
    };
    var onError = function(error) {
      unbindListeners();
      callback(error);
    };
    var onClosed = function() {
      unbindListeners();
      callback(new Pusher.Errors.TransportClosed(this.transport));
    };

    var unbindListeners = function() {
      connection.unbind("initialized", onInitialized);
      connection.unbind("open", onOpen);
      connection.unbind("error", onError);
      connection.unbind("closed", onClosed);
    };

    connection.bind("initialized", onInitialized);
    connection.bind("open", onOpen);
    connection.bind("error", onError);
    connection.bind("closed", onClosed);

    // connect will be called automatically after initialization
    connection.initialize();

    return {
      abort: function() {
        if (connection.state === "open") {
          return;
        }
        unbindListeners();
        connection.close();
      },
      forceMinPriority: function(p) {
        if (connection.state === "open") {
          return;
        }
        if (self.priority < p) {
          // TODO close connection in a nicer way
          connection.close();
        }
      }
    };
  };

  function failAttempt(error, callback) {
    new Pusher.Timer(0, function() {
      callback(error);
    });
    return {
      abort: function() {},
      forceMinPriority: function() {}
    };
  }

  Pusher.TransportStrategy = TransportStrategy;
}).call(this);

;(function() {
  /** Handles common logic for all transports.
   *
   * Transport is a low-level connection object that wraps a connection method
   * and exposes a simple evented interface for the connection state and
   * messaging. It does not implement Pusher-specific WebSocket protocol.
   *
   * Additionally, it fetches resources needed for transport to work and exposes
   * an interface for querying transport support and its features.
   *
   * This is an abstract class, please do not instantiate it.
   *
   * States:
   * - new - initial state after constructing the object
   * - initializing - during initialization phase, usually fetching resources
   * - intialized - ready to establish a connection
   * - connection - when connection is being established
   * - open - when connection ready to be used
   * - closed - after connection was closed be either side
   *
   * Emits:
   * - error - after the connection raised an error
   *
   * Options:
   * - encrypted - whether connection should use ssl
   * - hostEncrypted - host to connect to when connection is encrypted
   * - hostUnencrypted - host to connect to when connection is not encrypted
   *
   * @param {String} key application key
   * @param {Object} options
   */
  function AbstractTransport(name, priority, key, options) {
    Pusher.EventsDispatcher.call(this);

    this.name = name;
    this.priority = priority;
    this.key = key;
    this.state = "new";
    this.timeline = options.timeline;
    this.id = this.timeline.generateUniqueID();

    this.options = {
      encrypted: Boolean(options.encrypted),
      hostUnencrypted: options.hostUnencrypted,
      hostEncrypted: options.hostEncrypted
    };
  }
  var prototype = AbstractTransport.prototype;
  Pusher.Util.extend(prototype, Pusher.EventsDispatcher.prototype);

  /** Checks whether the transport is supported in the browser.
   *
   * @returns {Boolean}
   */
  AbstractTransport.isSupported = function() {
    return false;
  };

  /** Checks whether the transport handles ping/pong on itself.
   *
   * @return {Boolean}
   */
  prototype.supportsPing = function() {
    return false;
  };

  /** Initializes the transport.
   *
   * Fetches resources if needed and then transitions to initialized.
   */
  prototype.initialize = function() {
    this.timeline.info(this.buildTimelineMessage({
      transport: this.name + (this.options.encrypted ? "s" : "")
    }));
    this.timeline.debug(this.buildTimelineMessage({ method: "initialize" }));

    this.changeState("initialized");
  };

  /** Tries to establish a connection.
   *
   * @returns {Boolean} false if transport is in invalid state
   */
  prototype.connect = function() {
    var url = this.getURL(this.key, this.options);
    this.timeline.debug(this.buildTimelineMessage({
      method: "connect",
      url: url
    }));

    if (this.socket || this.state !== "initialized") {
      return false;
    }

    this.socket = this.createSocket(url);
    this.bindListeners();

    Pusher.debug("Connecting", { transport: this.name, url: url });
    this.changeState("connecting");
    return true;
  };

  /** Closes the connection.
   *
   * @return {Boolean} true if there was a connection to close
   */
  prototype.close = function() {
    this.timeline.debug(this.buildTimelineMessage({ method: "close" }));

    if (this.socket) {
      this.socket.close();
      return true;
    } else {
      return false;
    }
  };

  /** Sends data over the open connection.
   *
   * @param {String} data
   * @return {Boolean} true only when in the "open" state
   */
  prototype.send = function(data) {
    this.timeline.debug(this.buildTimelineMessage({
      method: "send",
      data: data
    }));

    if (this.state === "open") {
      // Workaround for MobileSafari bug (see https://gist.github.com/2052006)
      var self = this;
      setTimeout(function() {
        self.socket.send(data);
      }, 0);
      return true;
    } else {
      return false;
    }
  };

  prototype.requestPing = function() {
    this.emit("ping_request");
  };

  /** @protected */
  prototype.onOpen = function() {
    this.changeState("open");
    this.socket.onopen = undefined;
  };

  /** @protected */
  prototype.onError = function(error) {
    this.emit("error", { type: 'WebSocketError', error: error });
    this.timeline.error(this.buildTimelineMessage({
      error: getErrorDetails(error)
    }));
  };

  /** @protected */
  prototype.onClose = function(closeEvent) {
    this.changeState("closed", closeEvent);
    this.socket = undefined;
  };

  /** @protected */
  prototype.onMessage = function(message) {
    this.timeline.debug(this.buildTimelineMessage({ message: message.data }));
    this.emit("message", message);
  };

  /** @protected */
  prototype.bindListeners = function() {
    var self = this;

    this.socket.onopen = function() { self.onOpen(); };
    this.socket.onerror = function(error) { self.onError(error); };
    this.socket.onclose = function(closeEvent) { self.onClose(closeEvent); };
    this.socket.onmessage = function(message) { self.onMessage(message); };
  };

  /** @protected */
  prototype.createSocket = function(url) {
    return null;
  };

  /** @protected */
  prototype.getScheme = function() {
    return this.options.encrypted ? "wss" : "ws";
  };

  /** @protected */
  prototype.getBaseURL = function() {
    var host;
    if (this.options.encrypted) {
      host = this.options.hostEncrypted;
    } else {
      host = this.options.hostUnencrypted;
    }
    return this.getScheme() + "://" + host;
  };

  /** @protected */
  prototype.getPath = function() {
    return "/app/" + this.key;
  };

  /** @protected */
  prototype.getQueryString = function() {
    return "?protocol=" + Pusher.PROTOCOL +
      "&client=js&version=" + Pusher.VERSION;
  };

  /** @protected */
  prototype.getURL = function() {
    return this.getBaseURL() + this.getPath() + this.getQueryString();
  };

  /** @protected */
  prototype.changeState = function(state, params) {
    this.state = state;
    this.timeline.info(this.buildTimelineMessage({
      state: state,
      params: params
    }));
    this.emit(state, params);
  };

  /** @protected */
  prototype.buildTimelineMessage = function(message) {
    return Pusher.Util.extend({ cid: this.id }, message);
  };

  function getErrorDetails(error) {
    if (typeof error === "string") {
      return error;
    }
    if (typeof error === "object") {
      return Pusher.Util.mapObject(error, function(value) {
        var valueType = typeof value;
        if (valueType === "object" || valueType == "function") {
          return valueType;
        }
        return value;
      });
    }
    return typeof error;
  }

  Pusher.AbstractTransport = AbstractTransport;
}).call(this);

;(function() {
  /** Transport using Flash to emulate WebSockets.
   *
   * @see AbstractTransport
   */
  function FlashTransport(name, priority, key, options) {
    Pusher.AbstractTransport.call(this, name, priority, key, options);
  }
  var prototype = FlashTransport.prototype;
  Pusher.Util.extend(prototype, Pusher.AbstractTransport.prototype);

  /** Creates a new instance of FlashTransport.
   *
   * @param  {String} key
   * @param  {Object} options
   * @return {FlashTransport}
   */
  FlashTransport.createConnection = function(name, priority, key, options) {
    return new FlashTransport(name, priority, key, options);
  };

  /** Checks whether Flash is supported in the browser.
   *
   * It is possible to disable flash by passing an envrionment object with the
   * disableFlash property set to true.
   *
   * @see AbstractTransport.isSupported
   * @param {Object} environment
   * @returns {Boolean}
   */
  FlashTransport.isSupported = function(environment) {
    if (environment && environment.disableFlash) {
      return false;
    }
    try {
      return !!(new ActiveXObject('ShockwaveFlash.ShockwaveFlash'));
    } catch (e) {
      return Boolean(
        navigator &&
        navigator.mimeTypes &&
        navigator.mimeTypes["application/x-shockwave-flash"] !== undefined
      );
    }
  };

  /** Fetches flashfallback dependency if needed.
   *
   * Sets WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR to true (if not set before)
   * and WEB_SOCKET_SWF_LOCATION to Pusher's cdn before loading Flash resources.
   *
   * @see AbstractTransport.prototype.initialize
   */
  prototype.initialize = function() {
    var self = this;

    this.timeline.info(this.buildTimelineMessage({
      transport: this.name + (this.options.encrypted ? "s" : "")
    }));
    this.timeline.debug(this.buildTimelineMessage({ method: "initialize" }));
    this.changeState("initializing");

    if (window.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR === undefined) {
      window.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;
    }
    window.WEB_SOCKET_SWF_LOCATION = Pusher.Dependencies.getRoot() +
      "/WebSocketMain.swf";
    Pusher.Dependencies.load("flashfallback", function() {
      self.changeState("initialized");
    });
  };

  /** @protected */
  prototype.createSocket = function(url) {
    return new FlashWebSocket(url);
  };

  /** @protected */
  prototype.getQueryString = function() {
    return Pusher.AbstractTransport.prototype.getQueryString.call(this) +
      "&flash=true";
  };

  Pusher.FlashTransport = FlashTransport;
}).call(this);

;(function() {
  /** Fallback transport using SockJS.
   *
   * @see AbstractTransport
   */
  function SockJSTransport(name, priority, key, options) {
    Pusher.AbstractTransport.call(this, name, priority, key, options);
  }
  var prototype = SockJSTransport.prototype;
  Pusher.Util.extend(prototype, Pusher.AbstractTransport.prototype);

  /** Creates a new instance of SockJSTransport.
   *
   * @param  {String} key
   * @param  {Object} options
   * @return {SockJSTransport}
   */
  SockJSTransport.createConnection = function(name, priority, key, options) {
    return new SockJSTransport(name, priority, key, options);
  };

  /** Assumes that SockJS is always supported.
   *
   * @returns {Boolean} always true
   */
  SockJSTransport.isSupported = function() {
    return true;
  };

  /** Fetches sockjs dependency if needed.
   *
   * @see AbstractTransport.prototype.initialize
   */
  prototype.initialize = function() {
    var self = this;

    this.timeline.info(this.buildTimelineMessage({
      transport: this.name + (this.options.encrypted ? "s" : "")
    }));
    this.timeline.debug(this.buildTimelineMessage({ method: "initialize" }));

    this.changeState("initializing");
    Pusher.Dependencies.load("sockjs", function() {
      self.changeState("initialized");
    });
  };

  /** Always returns true, since SockJS handles ping on its own.
   *
   * @returns {Boolean} always true
   */
  prototype.supportsPing = function() {
    return true;
  };

  /** @protected */
  prototype.createSocket = function(url) {
    // exclude iframe transports until we link to correct SockJS version
    // inside the iframe
    return new SockJS(url, null, {
      js_path: Pusher.Dependencies.getPath("sockjs", {
        encrypted: this.options.encrypted
      })
    });
  };

  /** @protected */
  prototype.getScheme = function() {
    return this.options.encrypted ? "https" : "http";
  };

  /** @protected */
  prototype.getPath = function() {
    return "/pusher";
  };

  /** @protected */
  prototype.getQueryString = function() {
    return "";
  };

  /** Handles opening a SockJS connection to Pusher.
   *
   * Since SockJS does not handle custom paths, we send it immediately after
   * establishing the connection.
   *
   * @protected
   */
  prototype.onOpen = function() {
    this.socket.send(JSON.stringify({
      path: Pusher.AbstractTransport.prototype.getPath.call(this) +
        Pusher.AbstractTransport.prototype.getQueryString.call(this)
    }));
    this.changeState("open");
    this.socket.onopen = undefined;
  };

  Pusher.SockJSTransport = SockJSTransport;
}).call(this);

;(function() {
  /** WebSocket transport.
   *
   * @see AbstractTransport
   */
  function WSTransport(name, priority, key, options) {
    Pusher.AbstractTransport.call(this, name, priority, key, options);
  }
  var prototype = WSTransport.prototype;
  Pusher.Util.extend(prototype, Pusher.AbstractTransport.prototype);

  /** Creates a new instance of WSTransport.
   *
   * @param  {String} key
   * @param  {Object} options
   * @return {WSTransport}
   */
  WSTransport.createConnection = function(name, priority, key, options) {
    return new WSTransport(name, priority, key, options);
  };

  /** Checks whether the browser supports WebSockets in any form.
   *
   * @returns {Boolean} true if browser supports WebSockets
   */
  WSTransport.isSupported = function() {
    return window.WebSocket !== undefined || window.MozWebSocket !== undefined;
  };

  /** @protected */
  prototype.createSocket = function(url) {
    var constructor = window.WebSocket || window.MozWebSocket;
    return new constructor(url);
  };

  /** @protected */
  prototype.getQueryString = function() {
    return Pusher.AbstractTransport.prototype.getQueryString.call(this) +
      "&flash=false";
  };

  Pusher.WSTransport = WSTransport;
}).call(this);

;(function() {
  function AssistantToTheTransportManager(manager, transport, options) {
    this.manager = manager;
    this.transport = transport;
    this.minPingDelay = options.minPingDelay || 10000;
    this.maxPingDelay = options.maxPingDelay || Pusher.activity_timeout;
    this.pingDelay = null;
  }
  var prototype = AssistantToTheTransportManager.prototype;

  prototype.createConnection = function(name, priority, key, options) {
    var connection = this.transport.createConnection(
      name, priority, key, options
    );

    var self = this;
    var openTimestamp = null;
    var pingTimer = null;

    var onOpen = function() {
      connection.unbind("open", onOpen);

      openTimestamp = Pusher.Util.now();
      if (self.pingDelay) {
        pingTimer = setInterval(function() {
          if (pingTimer) {
            connection.requestPing();
          }
        }, self.pingDelay);
      }

      connection.bind("closed", onClosed);
    };
    var onClosed = function(closeEvent) {
      connection.unbind("closed", onClosed);
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }

      if (closeEvent.wasClean) {
        return;
      }

      if (openTimestamp) {
        var lifespan = Pusher.Util.now() - openTimestamp;
        if (lifespan < 2 * self.maxPingDelay) {
          self.manager.reportDeath();
          self.pingDelay = Math.max(lifespan / 2, self.minPingDelay);
        }
      }
    };

    connection.bind("open", onOpen);
    return connection;
  };

  prototype.isSupported = function(environment) {
    return this.manager.isAlive() && this.transport.isSupported(environment);
  };

  Pusher.AssistantToTheTransportManager = AssistantToTheTransportManager;
}).call(this);

;(function() {
  function TransportManager(options) {
    this.options = options || {};
    this.livesLeft = this.options.lives || Infinity;
  }
  var prototype = TransportManager.prototype;

  prototype.getAssistant = function(transport) {
    return new Pusher.AssistantToTheTransportManager(this, transport, {
      minPingDelay: this.options.minPingDelay,
      maxPingDelay: this.options.maxPingDelay
    });
  };

  prototype.isAlive = function() {
    return this.livesLeft > 0;
  };

  prototype.reportDeath = function() {
    this.livesLeft -= 1;
  };

  Pusher.TransportManager = TransportManager;
}).call(this);

;(function() {
  var StrategyBuilder = {
    /** Transforms a JSON scheme to a strategy tree.
     *
     * @param {Array} scheme JSON strategy scheme
     * @param {Object} options a hash of symbols to be included in the scheme
     * @returns {Strategy} strategy tree that's represented by the scheme
     */
    build: function(scheme, options) {
      var context = Pusher.Util.extend({}, globalContext, options);
      return evaluate(scheme, context)[1].strategy;
    }
  };

  var transports = {
    ws: Pusher.WSTransport,
    flash: Pusher.FlashTransport,
    sockjs: Pusher.SockJSTransport
  };

  // DSL bindings

  function returnWithOriginalContext(f) {
    return function(context) {
      return [f.apply(this, arguments), context];
    };
  }

  var globalContext = {
    def: function(context, name, value) {
      if (context[name] !== undefined) {
        throw "Redefining symbol " + name;
      }
      context[name] = value;
      return [undefined, context];
    },

    def_transport: function(context, name, type, priority, options, manager) {
      var transportClass = transports[type];
      if (!transportClass) {
        throw new Pusher.Errors.UnsupportedTransport(type);
      }
      var transportOptions = Pusher.Util.extend({}, {
        key: context.key,
        encrypted: context.encrypted,
        timeline: context.timeline,
        disableFlash: context.disableFlash
      }, options);
      if (manager) {
        transportClass = manager.getAssistant(transportClass);
      }
      var transport = new Pusher.TransportStrategy(
        name, priority, transportClass, transportOptions
      );
      var newContext = context.def(context, name, transport)[1];
      newContext.transports = context.transports || {};
      newContext.transports[name] = transport;
      return [undefined, newContext];
    },

    transport_manager: returnWithOriginalContext(function(_, options) {
      return new Pusher.TransportManager(options);
    }),

    sequential: returnWithOriginalContext(function(_, options) {
      var strategies = Array.prototype.slice.call(arguments, 2);
      return new Pusher.SequentialStrategy(strategies, options);
    }),

    cached: returnWithOriginalContext(function(context, ttl, strategy){
      return new Pusher.CachedStrategy(strategy, context.transports, {
        ttl: ttl,
        timeline: context.timeline
      });
    }),

    first_connected: returnWithOriginalContext(function(_, strategy) {
      return new Pusher.FirstConnectedStrategy(strategy);
    }),

    best_connected_ever: returnWithOriginalContext(function() {
      var strategies = Array.prototype.slice.call(arguments, 1);
      return new Pusher.BestConnectedEverStrategy(strategies);
    }),

    delayed: returnWithOriginalContext(function(_, delay, strategy) {
      return new Pusher.DelayedStrategy(strategy, { delay: delay });
    }),

    "if": returnWithOriginalContext(function(_, test, trueBranch, falseBranch) {
      return new Pusher.IfStrategy(test, trueBranch, falseBranch);
    }),

    is_supported: returnWithOriginalContext(function(_, strategy) {
      return function() {
        return strategy.isSupported();
      };
    })
  };

  // DSL interpreter

  function isSymbol(expression) {
    return (typeof expression === "string") && expression.charAt(0) === ":";
  }

  function getSymbolValue(expression, context) {
    return context[expression.slice(1)];
  }

  function evaluateListOfExpressions(expressions, context) {
    if (expressions.length === 0) {
      return [[], context];
    }
    var head = evaluate(expressions[0], context);
    var tail = evaluateListOfExpressions(expressions.slice(1), head[1]);
    return [[head[0]].concat(tail[0]), tail[1]];
  }

  function evaluateString(expression, context) {
    if (!isSymbol(expression)) {
      return [expression, context];
    }
    var value = getSymbolValue(expression, context);
    if (value === undefined) {
      throw "Undefined symbol " + expression;
    }
    return [value, context];
  }

  function evaluateArray(expression, context) {
    if (isSymbol(expression[0])) {
      var f = getSymbolValue(expression[0], context);
      if (expression.length > 1) {
        if (typeof f !== "function") {
          throw "Calling non-function " + expression[0];
        }
        var args = [Pusher.Util.extend({}, context)].concat(
          Pusher.Util.map(expression.slice(1), function(arg) {
            return evaluate(arg, Pusher.Util.extend({}, context))[0];
          })
        );
        return f.apply(this, args);
      } else {
        return [f, context];
      }
    } else {
      return evaluateListOfExpressions(expression, context);
    }
  }

  function evaluate(expression, context) {
    var expressionType = typeof expression;
    if (typeof expression === "string") {
      return evaluateString(expression, context);
    } else if (typeof expression === "object") {
      if (expression instanceof Array && expression.length > 0) {
        return evaluateArray(expression, context);
      }
    }
    return [expression, context];
  }

  Pusher.StrategyBuilder = StrategyBuilder;
}).call(this);

;(function() {
  /**
   * Provides Pusher protocol interface for transports.
   *
   * Emits following events:
   * - connected - after establishing connection and receiving a socket id
   * - message - on received messages
   * - ping - on ping requests
   * - pong - on pong responses
   * - error - when the transport emits an error
   * - closed - after closing the transport
   * - ssl_only - after trying to connect without ssl to a ssl-only app
   * - retry - when closed connection should be retried immediately
   * - backoff - when closed connection should be retried with a delay
   * - refused - when closed connection should not be retried
   *
   * @param {AbstractTransport} transport
   */
  function ProtocolWrapper(transport) {
    Pusher.EventsDispatcher.call(this);
    this.transport = transport;
    this.bindListeners();
  }
  var prototype = ProtocolWrapper.prototype;

  Pusher.Util.extend(prototype, Pusher.EventsDispatcher.prototype);

  /** Returns whether used transport handles ping/pong by itself
   *
   * @returns {Boolean} true if ping is handled by the transport
   */
  prototype.supportsPing = function() {
    return this.transport.supportsPing();
  };

  /** Sends raw data.
   *
   * @param {String} data
   */
  prototype.send = function(data) {
    return this.transport.send(data);
  };

  /** Sends an event.
   *
   * @param {String} name
   * @param {String} data
   * @param {String} [channel]
   * @returns {Boolean} whether message was sent or not
   */
  prototype.send_event = function(name, data, channel) {
    var payload = {
      event: name,
      data: data
    };
    if (channel) {
      payload.channel = channel;
    }

    Pusher.debug('Event sent', payload);
    return this.send(JSON.stringify(payload));
  };

  /** Closes the transport.  */
  prototype.close = function() {
    this.transport.close();
  };

  /** @private */
  prototype.bindListeners = function() {
    var self = this;

    var onMessageOpen = function(message) {
      message = self.parseMessage(message);

      if (message !== undefined) {
        if (message.event === 'pusher:connection_established') {
          self.id = message.data.socket_id;
          self.transport.unbind("message", onMessageOpen);
          self.transport.bind("message", onMessageConnected);
          self.transport.bind("ping_request", onPingRequest);
          self.emit("connected", self.id);
        } else if (message.event === "pusher:error") {
          // From protocol 6 close codes are sent only once, so this only
          // happens when connection does not support close codes
          self.handleCloseCode(message.data.code, message.data.message);
          self.transport.close();
        }
      }
    };
    var onMessageConnected = function(message) {
      message = self.parseMessage(message);

      if (message !== undefined) {
        Pusher.debug('Event recd', message);

        switch (message.event) {
          case 'pusher:error':
            self.emit('error', { type: 'PusherError', data: message.data });
            break;
          case 'pusher:ping':
            self.emit("ping");
            break;
          case 'pusher:pong':
            self.emit("pong");
            break;
        }
        self.emit('message', message);
      }
    };
    var onPingRequest = function() {
      self.emit("ping_request");
    };
    var onError = function(error) {
      self.emit("error", { type: "WebSocketError", error: error });
    };
    var onClosed = function(error) {
      if (error && error.code) {
        self.handleCloseCode(error.code, error.reason);
      }
      self.transport.unbind("message", onMessageOpen);
      self.transport.unbind("message", onMessageConnected);
      self.transport.unbind("ping_request", onPingRequest);
      self.transport.unbind("error", onError);
      self.transport.unbind("closed", onClosed);
      self.transport = null;
      self.emit("closed");
    };

    this.transport.bind("message", onMessageOpen);
    this.transport.bind("error", onError);
    this.transport.bind("closed", onClosed);
  };

  /** @private */
  prototype.parseMessage = function(message) {
    try {
      var params = JSON.parse(message.data);

      if (typeof params.data === 'string') {
        try {
          params.data = JSON.parse(params.data);
        } catch (e) {
          if (!(e instanceof SyntaxError)) {
            throw e;
          }
        }
      }

      return params;
    } catch (e) {
      this.emit(
        'error', { type: 'MessageParseError', error: e, data: message.data}
      );
    }
  };

  /** @private */
  prototype.handleCloseCode = function(code, message) {
    var shouldReport = true;
    // See:
    // 1. https://developer.mozilla.org/en-US/docs/WebSockets/WebSockets_reference/CloseEvent
    // 2. http://pusher.com/docs/pusher_protocol
    if (code < 4000) {
      // ignore 1000 CLOSE_NORMAL, 1001 CLOSE_GOING_AWAY,
      //        1005 CLOSE_NO_STATUS, 1006 CLOSE_ABNORMAL
      // ignore 1007...3999
      // handle 1002 CLOSE_PROTOCOL_ERROR, 1003 CLOSE_UNSUPPORTED,
      //        1004 CLOSE_TOO_LARGE
      if (code === 1000 || code === 1001) {
        shouldReport = false;
      }
      if (code >= 1002 && code <= 1004) {
        this.emit("backoff");
      }
    } else if (code === 4000) {
      this.emit("ssl_only");
    } else if (code < 4100) {
      this.emit("refused");
    } else if (code < 4200) {
      this.emit("backoff");
    } else if (code < 4300) {
      this.emit("retry");
    } else {
      // unknown error
      this.emit("refused");
    }

    if (shouldReport) {
      this.emit(
        'error', { type: 'PusherError', data: { code: code, message: message } }
      );
    }
  };

  Pusher.ProtocolWrapper = ProtocolWrapper;
}).call(this);

;(function() {
  /** Manages connection to Pusher.
   *
   * Uses a strategy (currently only default), timers and network availability
   * info to establish a connection and export its state. In case of failures,
   * manages reconnection attempts.
   *
   * Exports state changes as following events:
   * - "state_change", { previous: p, current: state }
   * - state
   *
   * States:
   * - initialized - initial state, never transitioned to
   * - connecting - connection is being established
   * - connected - connection has been fully established
   * - disconnected - on requested disconnection or before reconnecting
   * - unavailable - after connection timeout or when there's no network
   *
   * Options:
   * - unavailableTimeout - time to transition to unavailable state
   * - activityTimeout - time after which ping message should be sent
   * - pongTimeout - time for Pusher to respond with pong before reconnecting
   *
   * @param {String} key application key
   * @param {Object} options
   */
  function ConnectionManager(key, options) {
    Pusher.EventsDispatcher.call(this);

    this.key = key;
    this.options = options || {};
    this.state = "initialized";
    this.connection = null;
    this.encrypted = !!options.encrypted;
    this.timeline = this.options.getTimeline();

    this.connectionCallbacks = this.buildCallbacks();

    var self = this;

    Pusher.Network.bind("online", function() {
      if (self.state === "unavailable") {
        self.connect();
      }
    });
    Pusher.Network.bind("offline", function() {
      if (self.shouldRetry()) {
        self.disconnect();
        self.updateState("unavailable");
      }
    });

    var sendTimeline = function() {
      if (self.timelineSender) {
        self.timelineSender.send(function() {});
      }
    };
    this.bind("connected", sendTimeline);
    setInterval(sendTimeline, 60000);

    this.updateStrategy();
  }
  var prototype = ConnectionManager.prototype;

  Pusher.Util.extend(prototype, Pusher.EventsDispatcher.prototype);

  /** Establishes a connection to Pusher.
   *
   * Does nothing when connection is already established. See top-level doc
   * to find events emitted on connection attempts.
   */
  prototype.connect = function() {
    if (this.connection) {
      return;
    }
    if (this.state === "connecting") {
      return;
    }

    if (!this.strategy.isSupported()) {
      this.updateState("failed");
      return;
    }
    if (Pusher.Network.isOnline() === false) {
      this.updateState("unavailable");
      return;
    }

    this.updateState("connecting");
    this.timelineSender = this.options.getTimelineSender(
      this.timeline,
      { encrypted: this.encrypted },
      this
    );

    var self = this;
    var callback = function(error, transport) {
      if (error) {
        self.runner = self.strategy.connect(0, callback);
      } else {
        // we don't support switching connections yet
        self.runner.abort();
        self.setConnection(self.wrapTransport(transport));
      }
    };
    this.runner = this.strategy.connect(0, callback);

    this.setUnavailableTimer();
  };

  /** Sends raw data.
   *
   * @param {String} data
   */
  prototype.send = function(data) {
    if (this.connection) {
      return this.connection.send(data);
    } else {
      return false;
    }
  };

  /** Sends an event.
   *
   * @param {String} name
   * @param {String} data
   * @param {String} [channel]
   * @returns {Boolean} whether message was sent or not
   */
  prototype.send_event = function(name, data, channel) {
    if (this.connection) {
      return this.connection.send_event(name, data, channel);
    } else {
      return false;
    }
  };

  /** Closes the connection. */
  prototype.disconnect = function() {
    if (this.runner) {
      this.runner.abort();
    }
    this.clearRetryTimer();
    this.clearUnavailableTimer();
    this.stopActivityCheck();
    this.updateState("disconnected");
    // we're in disconnected state, so closing will not cause reconnecting
    if (this.connection) {
      this.connection.close();
      this.abandonConnection();
    }
  };

  /** @private */
  prototype.updateStrategy = function() {
    this.strategy = this.options.getStrategy({
      key: this.key,
      timeline: this.timeline,
      encrypted: this.encrypted
    });
  };

  /** @private */
  prototype.retryIn = function(delay) {
    var self = this;
    this.retryTimer = setTimeout(function() {
      if (self.retryTimer === null) {
        return;
      }
      self.retryTimer = null;
      self.disconnect();
      self.connect();
    }, delay || 0);
  };

  /** @private */
  prototype.clearRetryTimer = function() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  };

  /** @private */
  prototype.setUnavailableTimer = function() {
    var self = this;
    this.unavailableTimer = setTimeout(function() {
      if (!self.unavailableTimer) {
        return;
      }
      self.updateState("unavailable");
      self.unavailableTimer = null;
    }, this.options.unavailableTimeout);
  };

  /** @private */
  prototype.clearUnavailableTimer = function() {
    if (this.unavailableTimer) {
      clearTimeout(this.unavailableTimer);
      this.unavailableTimer = null;
    }
  };

  /** @private */
  prototype.resetActivityCheck = function() {
    this.stopActivityCheck();
    // send ping after inactivity
    if (!this.connection.supportsPing()) {
      var self = this;
      this.activityTimer = setTimeout(function() {
        self.send_event('pusher:ping', {});
        // wait for pong response
        self.activityTimer = setTimeout(function() {
          self.connection.close();
        }, (self.options.pongTimeout));
      }, (this.options.activityTimeout));
    }
  };

  /** @private */
  prototype.stopActivityCheck = function() {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
  };

  /** @private */
  prototype.buildCallbacks = function() {
    var self = this;
    return {
      connected: function(id) {
        self.clearUnavailableTimer();
        self.socket_id = id;
        self.updateState("connected");
        self.resetActivityCheck();
      },
      message: function(message) {
        // includes pong messages from server
        self.resetActivityCheck();
        self.emit('message', message);
      },
      ping: function() {
        self.send_event('pusher:pong', {});
      },
      ping_request: function() {
        self.send_event('pusher:ping', {});
      },
      error: function(error) {
        // just emit error to user - socket will already be closed by browser
        self.emit("error", { type: "WebSocketError", error: error });
      },
      closed: function() {
        self.abandonConnection();
        if (self.shouldRetry()) {
          self.retryIn(1000);
        }
      },
      ssl_only: function() {
        self.encrypted = true;
        self.updateStrategy();
        self.retryIn(0);
      },
      refused: function() {
        self.disconnect();
      },
      backoff: function() {
        self.retryIn(1000);
      },
      retry: function() {
        self.retryIn(0);
      }
    };
  };

  /** @private */
  prototype.setConnection = function(connection) {
    this.connection = connection;
    for (var event in this.connectionCallbacks) {
      this.connection.bind(event, this.connectionCallbacks[event]);
    }
    this.resetActivityCheck();
  };

  /** @private */
  prototype.abandonConnection = function() {
    for (var event in this.connectionCallbacks) {
      this.connection.unbind(event, this.connectionCallbacks[event]);
    }
    this.connection = null;
  };

  /** @private */
  prototype.updateState = function(newState, data) {
    var previousState = this.state;

    this.state = newState;
    // Only emit when the state changes
    if (previousState !== newState) {
      Pusher.debug('State changed', previousState + ' -> ' + newState);

      this.emit('state_change', { previous: previousState, current: newState });
      this.emit(newState, data);
    }
  };

  /** @private */
  prototype.shouldRetry = function() {
    return this.state === "connecting" || this.state === "connected";
  };

  /** @private */
  prototype.wrapTransport = function(transport) {
    return new Pusher.ProtocolWrapper(transport);
  };

  Pusher.ConnectionManager = ConnectionManager;
}).call(this);

;(function() {
  /** Really basic interface providing network availability info.
   *
   * Emits:
   * - online - when browser goes online
   * - offline - when browser goes offline
   */
  function NetInfo() {
    Pusher.EventsDispatcher.call(this);

    var self = this;
    // This is okay, as IE doesn't support this stuff anyway.
    if (window.addEventListener !== undefined) {
      window.addEventListener("online", function() {
        self.emit('online');
      }, false);
      window.addEventListener("offline", function() {
        self.emit('offline');
      }, false);
    }
  }
  Pusher.Util.extend(NetInfo.prototype, Pusher.EventsDispatcher.prototype);

  var prototype = NetInfo.prototype;

  /** Returns whether browser is online or not
   *
   * Offline means definitely offline (no connection to router).
   * Inverse does NOT mean definitely online (only currently supported in Safari
   * and even there only means the device has a connection to the router).
   *
   * @return {Boolean}
   */
  prototype.isOnline = function() {
    if (window.navigator.onLine === undefined) {
      return true;
    } else {
      return window.navigator.onLine;
    }
  };

  Pusher.NetInfo = NetInfo;
  Pusher.Network = new NetInfo();
}).call(this);

;(function() {
  Pusher.Channels = function() {
    this.channels = {};
  };

  Pusher.Channels.prototype = {
    add: function(channel_name, pusher) {
      var existing_channel = this.find(channel_name);
      if (!existing_channel) {
        var channel = Pusher.Channel.factory(channel_name, pusher);
        this.channels[channel_name] = channel;
        return channel;
      } else {
        return existing_channel;
      }
    },

    find: function(channel_name) {
      return this.channels[channel_name];
    },

    remove: function(channel_name) {
      delete this.channels[channel_name];
    },

    disconnect: function () {
      for(var channel_name in this.channels){
        this.channels[channel_name].disconnect()
      }
    }
  };

  Pusher.Channel = function(channel_name, pusher) {
    var self = this;
    Pusher.EventsDispatcher.call(this, function(event_name, event_data) {
      Pusher.debug('No callbacks on ' + channel_name + ' for ' + event_name);
    });

    this.pusher = pusher;
    this.name = channel_name;
    this.subscribed = false;

    this.bind('pusher_internal:subscription_succeeded', function(data) {
      self.onSubscriptionSucceeded(data);
    });
  };

  Pusher.Channel.prototype = {
    // inheritable constructor
    init: function() {},
    disconnect: function() {
      this.subscribed = false;
      this.emit("pusher_internal:disconnected");
    },

    onSubscriptionSucceeded: function(data) {
      this.subscribed = true;
      this.emit('pusher:subscription_succeeded');
    },

    authorize: function(socketId, options, callback){
      return callback(false, {}); // normal channels don't require auth
    },

    trigger: function(event, data) {
      return this.pusher.send_event(event, data, this.name);
    }
  };

  Pusher.Util.extend(Pusher.Channel.prototype, Pusher.EventsDispatcher.prototype);

  Pusher.Channel.PrivateChannel = {
    authorize: function(socketId, options, callback){
      var self = this;
      var authorizer = new Pusher.Channel.Authorizer(this, Pusher.channel_auth_transport, options);
      return authorizer.authorize(socketId, function(err, authData) {
        if(!err) {
          self.emit('pusher_internal:authorized', authData);
        }

        callback(err, authData);
      });
    }
  };

  Pusher.Channel.PresenceChannel = {
    init: function(){
      this.members = new Members(this); // leeches off channel events
    },

    onSubscriptionSucceeded: function(data) {
      this.subscribed = true;
      // We override this because we want the Members obj to be responsible for
      // emitting the pusher:subscription_succeeded.  It will do this after it has done its work.
    }
  };

  var Members = function(channel) {
    var self = this;
    var channelData = null;

    var reset = function() {
      self._members_map = {};
      self.count = 0;
      self.me = null;
      channelData = null;
    };
    reset();

    var subscriptionSucceeded = function(subscriptionData) {
      self._members_map = subscriptionData.presence.hash;
      self.count = subscriptionData.presence.count;
      self.me = self.get(channelData.user_id);
      channel.emit('pusher:subscription_succeeded', self);
    };

    channel.bind('pusher_internal:authorized', function(authorizedData) {
      channelData = JSON.parse(authorizedData.channel_data);
      channel.bind("pusher_internal:subscription_succeeded", subscriptionSucceeded);
    });

    channel.bind('pusher_internal:member_added', function(data) {
      if(self.get(data.user_id) === null) { // only incr if user_id does not already exist
        self.count++;
      }

      self._members_map[data.user_id] = data.user_info;
      channel.emit('pusher:member_added', self.get(data.user_id));
    });

    channel.bind('pusher_internal:member_removed', function(data) {
      var member = self.get(data.user_id);
      if(member) {
        delete self._members_map[data.user_id];
        self.count--;
        channel.emit('pusher:member_removed', member);
      }
    });

    channel.bind('pusher_internal:disconnected', function() {
      reset();
      channel.unbind("pusher_internal:subscription_succeeded", subscriptionSucceeded);
    });
  };

  Members.prototype = {
    each: function(callback) {
      for(var i in this._members_map) {
        callback(this.get(i));
      }
    },

    get: function(user_id) {
      if (this._members_map.hasOwnProperty(user_id)) { // have heard of this user user_id
        return {
          id: user_id,
          info: this._members_map[user_id]
        }
      } else { // have never heard of this user
        return null;
      }
    }
  };

  Pusher.Channel.factory = function(channel_name, pusher){
    var channel = new Pusher.Channel(channel_name, pusher);
    if (channel_name.indexOf('private-') === 0) {
      Pusher.Util.extend(channel, Pusher.Channel.PrivateChannel);
    } else if (channel_name.indexOf('presence-') === 0) {
      Pusher.Util.extend(channel, Pusher.Channel.PrivateChannel);
      Pusher.Util.extend(channel, Pusher.Channel.PresenceChannel);
    };
    channel.init();
    return channel;
  };
}).call(this);

;(function() {
  Pusher.Channel.Authorizer = function(channel, type, options) {
    this.channel = channel;
    this.type = type;

    this.authOptions = (options || {}).auth || {};
  };

  Pusher.Channel.Authorizer.prototype = {
    composeQuery: function(socketId) {
      var query = '&socket_id=' + encodeURIComponent(socketId)
        + '&channel_name=' + encodeURIComponent(this.channel.name);

      for(var i in this.authOptions.params) {
        query += "&" + encodeURIComponent(i) + "=" + encodeURIComponent(this.authOptions.params[i]);
      }

      return query;
    },

    authorize: function(socketId, callback) {
      return Pusher.authorizers[this.type].call(this, socketId, callback);
    }
  };


  Pusher.auth_callbacks = {};
  Pusher.authorizers = {
    ajax: function(socketId, callback){
      var self = this, xhr;

      if (Pusher.XHR) {
        xhr = new Pusher.XHR();
      } else {
        xhr = (window.XMLHttpRequest ? new window.XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP"));
      }

      xhr.open("POST", Pusher.channel_auth_endpoint, true);

      // add request headers
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded")
      for(var headerName in this.authOptions.headers) {
        xhr.setRequestHeader(headerName, this.authOptions.headers[headerName]);
      }

      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          if (xhr.status == 200) {
            var data, parsed = false;

            try {
              data = JSON.parse(xhr.responseText);
              parsed = true;
            } catch (e) {
              callback(true, 'JSON returned from webapp was invalid, yet status code was 200. Data was: ' + xhr.responseText);
            }

            if (parsed) { // prevents double execution.
              callback(false, data);
            }
          } else {
            Pusher.warn("Couldn't get auth info from your webapp", xhr.status);
            callback(true, xhr.status);
          }
        }
      };

      xhr.send(this.composeQuery(socketId));
      return xhr;
    },

    jsonp: function(socketId, callback){
      if(this.authOptions.headers !== undefined) {
        Pusher.warn("Warn", "To send headers with the auth request, you must use AJAX, rather than JSONP.");
      }

      var script = document.createElement("script");
      // Hacked wrapper.
      Pusher.auth_callbacks[this.channel.name] = function(data) {
        callback(false, data);
      };

      var callback_name = "Pusher.auth_callbacks['" + this.channel.name + "']";
      script.src = Pusher.channel_auth_endpoint
        + '?callback='
        + encodeURIComponent(callback_name)
        + this.composeQuery(socketId);

      var head = document.getElementsByTagName("head")[0] || document.documentElement;
      head.insertBefore( script, head.firstChild );
    }
  };
}).call(this);