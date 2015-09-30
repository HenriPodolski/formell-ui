(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Backbone.NativeAjax.js 0.4.3
// ---------------

//     (c) 2015 Adam Krebs, Paul Miller, Exoskeleton Project
//     Backbone.NativeAjax may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/akre54/Backbone.NativeAjax

(function (factory) {
  if (typeof define === 'function' && define.amd) { define(factory);
  } else if (typeof exports === 'object') { module.exports = factory();
  } else { Backbone.ajax = factory(); }
}(function() {
  // Make an AJAX request to the server.
  // Usage:
  //   var req = Backbone.ajax({url: 'url', type: 'PATCH', data: 'data'});
  //   req.then(..., ...) // if Promise is set
  var ajax = (function() {
    var xmlRe = /^(?:application|text)\/xml/;
    var jsonRe = /^application\/json/;

    var getData = function(accepts, xhr) {
      if (accepts == null) accepts = xhr.getResponseHeader('content-type');
      if (xmlRe.test(accepts)) {
        return xhr.responseXML;
      } else if (jsonRe.test(accepts) && xhr.responseText !== '') {
        return JSON.parse(xhr.responseText);
      } else {
        return xhr.responseText;
      }
    };

    var isValid = function(xhr) {
      return (xhr.status >= 200 && xhr.status < 300) ||
        (xhr.status === 304) ||
        (xhr.status === 0 && window.location.protocol === 'file:')
    };

    var end = function(xhr, options, promise, resolve, reject) {
      return function() {
        updatePromise(xhr, promise);

        if (xhr.readyState !== 4) return;

        var status = xhr.status;
        var data = getData(options.headers && options.headers.Accept, xhr);

        // Check for validity.
        if (isValid(xhr)) {
          if (options.success) options.success(data);
          if (resolve) resolve(data);
        } else {
          var error = new Error('Server responded with a status of ' + status);
          if (options.error) options.error(xhr, status, error);
          if (reject) reject(xhr);
        }
      }
    };

    var updatePromise = function(xhr, promise) {
      if (!promise) return;

      var props = ['readyState', 'status', 'statusText', 'responseText',
        'responseXML', 'setRequestHeader', 'getAllResponseHeaders',
        'getResponseHeader', 'statusCode', 'abort'];

      for (var i = 0; i < props.length; i++) {
        var prop = props[i];
        promise[prop] = typeof xhr[prop] === 'function' ?
                              xhr[prop].bind(xhr) :
                              xhr[prop];
      }
      return promise;
    }

    return function(options) {
      if (options == null) throw new Error('You must provide options');
      if (options.type == null) options.type = 'GET';

      var resolve, reject, xhr = new XMLHttpRequest();
      var PromiseFn = ajax.Promise || (typeof Promise !== 'undefined' && Promise);
      var promise = PromiseFn && new PromiseFn(function(res, rej) {
        resolve = res;
        reject = rej;
      });

      if (options.contentType) {
        if (options.headers == null) options.headers = {};
        options.headers['Content-Type'] = options.contentType;
      }

      // Stringify GET query params.
      if (options.type === 'GET' && typeof options.data === 'object') {
        var query = '';
        var stringifyKeyValuePair = function(key, value) {
          return value == null ? '' :
            '&' + encodeURIComponent(key) +
            '=' + encodeURIComponent(value);
        };
        for (var key in options.data) {
          query += stringifyKeyValuePair(key, options.data[key]);
        }

        if (query) {
          var sep = (options.url.indexOf('?') === -1) ? '?' : '&';
          options.url += sep + query.substring(1);
        }
      }

      xhr.onreadystatechange = end(xhr, options, promise, resolve, reject);
      xhr.open(options.type, options.url, true);

      if(!(options.headers && options.headers.Accept)) {
        var allTypes = "*/".concat("*");
        var xhrAccepts = {
          "*": allTypes,
          text: "text/plain",
          html: "text/html",
          xml: "application/xml, text/xml",
          json: "application/json, text/javascript"
        };
        xhr.setRequestHeader(
          "Accept",
          options.dataType && xhrAccepts[options.dataType] ?
            xhrAccepts[options.dataType] + (options.dataType !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
            xhrAccepts["*"]
        );
      }

      if (options.headers) for (var key in options.headers) {
        xhr.setRequestHeader(key, options.headers[key]);
      }
      if (options.beforeSend) options.beforeSend(xhr);
      xhr.send(options.data);

      options.originalXhr = xhr;

      updatePromise(xhr, promise);

      return promise ? promise : xhr;
    };
  })();
  return ajax;
}));

},{}],2:[function(require,module,exports){
// Backbone.NativeView.js 0.3.3
// ---------------

//     (c) 2015 Adam Krebs, Jimmy Yuen Ho Wong
//     Backbone.NativeView may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/akre54/Backbone.NativeView

(function (factory) {
  if (typeof define === 'function' && define.amd) { define(['backbone'], factory);
  } else if (typeof module === 'object') { module.exports = factory(require('exoskeleton'));
  } else { factory(Backbone); }
}(function (Backbone) {
  // Cached regex to match an opening '<' of an HTML tag, possibly left-padded
  // with whitespace.
  var paddedLt = /^\s*</;

  // Caches a local reference to `Element.prototype` for faster access.
  var ElementProto = (typeof Element !== 'undefined' && Element.prototype) || {};

  // Cross-browser event listener shims
  var elementAddEventListener = ElementProto.addEventListener || function(eventName, listener) {
    return this.attachEvent('on' + eventName, listener);
  }
  var elementRemoveEventListener = ElementProto.removeEventListener || function(eventName, listener) {
    return this.detachEvent('on' + eventName, listener);
  }

  var indexOf = function(array, item) {
    for (var i = 0, len = array.length; i < len; i++) if (array[i] === item) return i;
    return -1;
  }

  // Find the right `Element#matches` for IE>=9 and modern browsers.
  var matchesSelector = ElementProto.matches ||
      ElementProto.webkitMatchesSelector ||
      ElementProto.mozMatchesSelector ||
      ElementProto.msMatchesSelector ||
      ElementProto.oMatchesSelector ||
      // Make our own `Element#matches` for IE8
      function(selector) {
        // Use querySelectorAll to find all elements matching the selector,
        // then check if the given element is included in that list.
        // Executing the query on the parentNode reduces the resulting nodeList,
        // (document doesn't have a parentNode).
        var nodeList = (this.parentNode || document).querySelectorAll(selector) || [];
        return ~indexOf(nodeList, this);
      };

  // Cache Backbone.View for later access in constructor
  var BBView = Backbone.View;

  // To extend an existing view to use native methods, extend the View prototype
  // with the mixin: _.extend(MyView.prototype, Backbone.NativeViewMixin);
  Backbone.NativeViewMixin = {

    _domEvents: null,

    constructor: function() {
      this._domEvents = [];
      return BBView.apply(this, arguments);
    },

    $: function(selector) {
      return this.el.querySelectorAll(selector);
    },

    _removeElement: function() {
      this.undelegateEvents();
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    },

    // Apply the `element` to the view. `element` can be a CSS selector,
    // a string of HTML, or an Element node.
    _setElement: function(element) {
      if (typeof element == 'string') {
        if (paddedLt.test(element)) {
          var el = document.createElement('div');
          el.innerHTML = element;
          this.el = el.firstChild;
        } else {
          this.el = document.querySelector(element);
        }
      } else {
        this.el = element;
      }
    },

    // Set a hash of attributes to the view's `el`. We use the "prop" version
    // if available, falling back to `setAttribute` for the catch-all.
    _setAttributes: function(attrs) {
      for (var attr in attrs) {
        attr in this.el ? this.el[attr] = attrs[attr] : this.el.setAttribute(attr, attrs[attr]);
      }
    },

    // Make a event delegation handler for the given `eventName` and `selector`
    // and attach it to `this.el`.
    // If selector is empty, the listener will be bound to `this.el`. If not, a
    // new handler that will recursively traverse up the event target's DOM
    // hierarchy looking for a node that matches the selector. If one is found,
    // the event's `delegateTarget` property is set to it and the return the
    // result of calling bound `listener` with the parameters given to the
    // handler.
    delegate: function(eventName, selector, listener) {
      if (typeof selector === 'function') {
        listener = selector;
        selector = null;
      }

      var root = this.el;
      var handler = selector ? function (e) {
        var node = e.target || e.srcElement;
        for (; node && node != root; node = node.parentNode) {
          if (matchesSelector.call(node, selector)) {
            e.delegateTarget = node;
            listener(e);
          }
        }
      } : listener;

      elementAddEventListener.call(this.el, eventName, handler, false);
      this._domEvents.push({eventName: eventName, handler: handler, listener: listener, selector: selector});
      return handler;
    },

    // Remove a single delegated event. Either `eventName` or `selector` must
    // be included, `selector` and `listener` are optional.
    undelegate: function(eventName, selector, listener) {
      if (typeof selector === 'function') {
        listener = selector;
        selector = null;
      }

      if (this.el) {
        var handlers = this._domEvents.slice();
        for (var i = 0, len = handlers.length; i < len; i++) {
          var item = handlers[i];

          var match = item.eventName === eventName &&
              (listener ? item.listener === listener : true) &&
              (selector ? item.selector === selector : true);

          if (!match) continue;

          elementRemoveEventListener.call(this.el, item.eventName, item.handler, false);
          this._domEvents.splice(indexOf(handlers, item), 1);
        }
      }
      return this;
    },

    // Remove all events created with `delegate` from `el`
    undelegateEvents: function() {
      if (this.el) {
        for (var i = 0, len = this._domEvents.length; i < len; i++) {
          var item = this._domEvents[i];
          elementRemoveEventListener.call(this.el, item.eventName, item.handler, false);
        };
        this._domEvents.length = 0;
      }
      return this;
    }
  };

  Backbone.NativeView = Backbone.View.extend(Backbone.NativeViewMixin);

  return Backbone.NativeView;
}));

},{"exoskeleton":3}],3:[function(require,module,exports){
/*!
 * Exoskeleton.js 0.7.0
 * (c) 2013 Paul Miller <http://paulmillr.com>
 * Based on Backbone.js
 * (c) 2010-2013 Jeremy Ashkenas, DocumentCloud
 * Exoskeleton may be freely distributed under the MIT license.
 * For all details and documentation: <http://exosjs.com>
 */

(function(root, factory) {
  // Set up Backbone appropriately for the environment.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      root.Backbone = root.Exoskeleton = factory(root, exports, _, $);
    });
  } else if (typeof exports !== 'undefined') {
    var _, $;
    try { _ = require('underscore'); } catch(e) { }
    try { $ = require('jquery'); } catch(e) { }
    factory(root, exports, _, $);
  } else {
    root.Backbone = root.Exoskeleton = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

})(this, function(root, Backbone, _, $) {
  'use strict';

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;
  var previousExoskeleton = root.Exoskeleton;

  // Underscore replacement.
  var utils = Backbone.utils = _ = (_ || {});

  // Hold onto a local reference to `$`. Can be changed at any point.
  Backbone.$ = $;

  // Create local references to array methods we'll want to use later.
  var array = [];
  var push = array.push;
  var slice = array.slice;
  var toString = ({}).toString;

  // Current version of the library. Keep in sync with `package.json`.
  // Backbone.VERSION = '1.0.0';

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    root.Exoskeleton = previousExoskeleton;
    return this;
  };

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  Backbone.extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error(model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  // Checker for utility methods. Useful for custom builds.
  var utilExists = function(method) {
    return typeof _[method] === 'function';
  };
utils.result = function result(object, property) {
  var value = object ? object[property] : undefined;
  return typeof value === 'function' ? object[property]() : value;
};

utils.defaults = function defaults(obj) {
  slice.call(arguments, 1).forEach(function(item) {
    for (var key in item) if (obj[key] === undefined)
      obj[key] = item[key];
  });
  return obj;
};

utils.extend = function extend(obj) {
  slice.call(arguments, 1).forEach(function(item) {
    for (var key in item) obj[key] = item[key];
  });
  return obj;
};

var htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

utils.escape = function escape(string) {
  return string == null ? '' : String(string).replace(/[&<>"']/g, function(match) {
    return htmlEscapes[match];
  });
};

utils.sortBy = function(obj, value, context) {
  var iterator = typeof value === 'function' ? value : function(obj){ return obj[value]; };
  return obj
    .map(function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    })
    .sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    })
    .map(function(item) {
      return item.value;
    });
};

/** Used to generate unique IDs */
var idCounter = 0;

utils.uniqueId = function uniqueId(prefix) {
  var id = ++idCounter + '';
  return prefix ? prefix + id : id;
};

utils.has = function(obj, key) {
  return Object.hasOwnProperty.call(obj, key);
};

var eq = function(a, b, aStack, bStack) {
  // Identical objects are equal. `0 === -0`, but they aren't identical.
  // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
  if (a === b) return a !== 0 || 1 / a == 1 / b;
  // A strict comparison is necessary because `null == undefined`.
  if (a == null || b == null) return a === b;
  // Unwrap any wrapped objects.
  //if (a instanceof _) a = a._wrapped;
  //if (b instanceof _) b = b._wrapped;
  // Compare `[[Class]]` names.
  var className = toString.call(a);
  if (className != toString.call(b)) return false;
  switch (className) {
    // Strings, numbers, dates, and booleans are compared by value.
    case '[object String]':
      // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
      // equivalent to `new String("5")`.
      return a == String(b);
    case '[object Number]':
      // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
      // other numeric values.
      return a !== +a ? b !== +b : (a === 0 ? 1 / a === 1 / b : a === +b);
    case '[object Date]':
    case '[object Boolean]':
      // Coerce dates and booleans to numeric primitive values. Dates are compared by their
      // millisecond representations. Note that invalid dates with millisecond representations
      // of `NaN` are not equivalent.
      return +a == +b;
    // RegExps are compared by their source patterns and flags.
    case '[object RegExp]':
      return a.source == b.source &&
             a.global == b.global &&
             a.multiline == b.multiline &&
             a.ignoreCase == b.ignoreCase;
  }
  if (typeof a != 'object' || typeof b != 'object') return false;
  // Assume equality for cyclic structures. The algorithm for detecting cyclic
  // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
  var length = aStack.length;
  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    if (aStack[length] == a) return bStack[length] == b;
  }
  // Objects with different constructors are not equivalent, but `Object`s
  // from different frames are.
  var aCtor = a.constructor, bCtor = b.constructor;
  if (aCtor !== bCtor && !(typeof aCtor === 'function' && (aCtor instanceof aCtor) &&
                           typeof bCtor === 'function' && (bCtor instanceof bCtor))) {
    return false;
  }
  // Add the first object to the stack of traversed objects.
  aStack.push(a);
  bStack.push(b);
  var size = 0, result = true;
  // Recursively compare objects and arrays.
  if (className === '[object Array]') {
    // Compare array lengths to determine if a deep comparison is necessary.
    size = a.length;
    result = size === b.length;
    if (result) {
      // Deep compare the contents, ignoring non-numeric properties.
      while (size--) {
        if (!(result = eq(a[size], b[size], aStack, bStack))) break;
      }
    }
  } else {
    // Deep compare objects.
    for (var key in a) {
      if (_.has(a, key)) {
        // Count the expected number of properties.
        size++;
        // Deep compare each member.
        if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
      }
    }
    // Ensure that both objects contain the same number of properties.
    if (result) {
      for (key in b) {
        if (_.has(b, key) && !(size--)) break;
      }
      result = !size;
    }
  }
  // Remove the first object from the stack of traversed objects.
  aStack.pop();
  bStack.pop();
  return result;
};

// Perform a deep comparison to check if two objects are equal.
utils.isEqual = function(a, b) {
  return eq(a, b, [], []);
};
// Backbone.Events
// ---------------

// A module that can be mixed in to *any object* in order to provide it with
// custom events. You may bind with `on` or remove with `off` callback
// functions to an event; `trigger`-ing an event fires all callbacks in
// succession.
//
//     var object = {};
//     _.extend(object, Backbone.Events);
//     object.on('expand', function(){ alert('expanded'); });
//     object.trigger('expand');
//
var Events = Backbone.Events = {

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  on: function(name, callback, context) {
    if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
    this._events || (this._events = {});
    var events = this._events[name] || (this._events[name] = []);
    events.push({callback: callback, context: context, ctx: context || this});
    return this;
  },

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, it will be removed.
  once: function(name, callback, context) {
    if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
    var self = this;
    var ran;
    var once = function() {
      if (ran) return;
      ran = true;
      self.off(name, once);
      callback.apply(this, arguments);
    };
    once._callback = callback;
    return this.on(name, once, context);
  },

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  off: function(name, callback, context) {
    var retain, ev, events, names, i, l, j, k;
    if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
    if (!name && !callback && !context) {
      this._events = void 0;
      return this;
    }
    names = name ? [name] : Object.keys(this._events);
    for (i = 0, l = names.length; i < l; i++) {
      name = names[i];
      if (events = this._events[name]) {
        this._events[name] = retain = [];
        if (callback || context) {
          for (j = 0, k = events.length; j < k; j++) {
            ev = events[j];
            if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                (context && context !== ev.context)) {
              retain.push(ev);
            }
          }
        }
        if (!retain.length) delete this._events[name];
      }
    }

    return this;
  },

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  trigger: function(name) {
    if (!this._events) return this;
    var args = slice.call(arguments, 1);
    if (!eventsApi(this, 'trigger', name, args)) return this;
    var events = this._events[name];
    var allEvents = this._events.all;
    if (events) triggerEvents(events, args);
    if (allEvents) triggerEvents(allEvents, arguments);
    return this;
  },

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  stopListening: function(obj, name, callback) {
    var listeningTo = this._listeningTo;
    if (!listeningTo) return this;
    var remove = !name && !callback;
    if (!callback && typeof name === 'object') callback = this;
    if (obj) (listeningTo = {})[obj._listenId] = obj;
    for (var id in listeningTo) {
      obj = listeningTo[id];
      obj.off(name, callback, this);
      if (remove || !Object.keys(obj._events).length) delete this._listeningTo[id];
    }
    return this;
  }

};

// Regular expression used to split event strings.
var eventSplitter = /\s+/;

// Implement fancy features of the Events API such as multiple event
// names `"change blur"` and jQuery-style event maps `{change: action}`
// in terms of the existing API.
var eventsApi = function(obj, action, name, rest) {
  if (!name) return true;

  // Handle event maps.
  if (typeof name === 'object') {
    for (var key in name) {
      obj[action].apply(obj, [key, name[key]].concat(rest));
    }
    return false;
  }

  // Handle space separated event names.
  if (eventSplitter.test(name)) {
    var names = name.split(eventSplitter);
    for (var i = 0, l = names.length; i < l; i++) {
      obj[action].apply(obj, [names[i]].concat(rest));
    }
    return false;
  }

  return true;
};

// A difficult-to-believe, but optimized internal dispatch function for
// triggering events. Tries to keep the usual cases speedy (most internal
// Backbone events have 3 arguments).
var triggerEvents = function(events, args) {
  var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
  switch (args.length) {
    case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
    case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
    case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
    case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
    default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
  }
};

var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

// Inversion-of-control versions of `on` and `once`. Tell *this* object to
// listen to an event in another object ... keeping track of what it's
// listening to.
Object.keys(listenMethods).forEach(function(method) {
  var implementation = listenMethods[method];
  Events[method] = function(obj, name, callback) {
    var listeningTo = this._listeningTo || (this._listeningTo = {});
    var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
    listeningTo[id] = obj;
    if (!callback && typeof name === 'object') callback = this;
    obj[implementation](name, callback, this);
    return this;
  };
});

// Aliases for backwards compatibility.
Events.bind   = Events.on;
Events.unbind = Events.off;

// Allow the `Backbone` object to serve as a global event bus, for folks who
// want global "pubsub" in a convenient place.
_.extend(Backbone, Events);
// Backbone.Model
// --------------

// Backbone **Models** are the basic data object in the framework --
// frequently representing a row in a table in a database on your server.
// A discrete chunk of data and a bunch of useful, related methods for
// performing computations and transformations on that data.

// Create a new model with the specified attributes. A client id (`cid`)
// is automatically generated and assigned for you.
var Model = Backbone.Model = function(attributes, options) {
  var attrs = attributes || {};
  options || (options = {});
  this.cid = _.uniqueId('c');
  this.attributes = Object.create(null);
  if (options.collection) this.collection = options.collection;
  if (options.parse) attrs = this.parse(attrs, options) || {};
  attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
  this.set(attrs, options);
  this.changed = Object.create(null);
  this.initialize.apply(this, arguments);
};

// Attach all inheritable methods to the Model prototype.
_.extend(Model.prototype, Events, {

  // A hash of attributes whose current and previous value differ.
  changed: null,

  // The value returned during the last failed validation.
  validationError: null,

  // The default name for the JSON `id` attribute is `"id"`. MongoDB and
  // CouchDB users may want to set this to `"_id"`.
  idAttribute: 'id',

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize: function(){},

  // Return a copy of the model's `attributes` object.
  toJSON: function(options) {
    return _.extend({}, this.attributes);
  },

  // Proxy `Backbone.sync` by default -- but override this if you need
  // custom syncing semantics for *this* particular model.
  sync: function() {
    return Backbone.sync.apply(this, arguments);
  },

  // Get the value of an attribute.
  get: function(attr) {
    return this.attributes[attr];
  },

  // Get the HTML-escaped value of an attribute.
  escape: function(attr) {
    return _.escape(this.get(attr));
  },

  // Returns `true` if the attribute contains a value that is not null
  // or undefined.
  has: function(attr) {
    return this.get(attr) != null;
  },

  // Set a hash of model attributes on the object, firing `"change"`. This is
  // the core primitive operation of a model, updating the data and notifying
  // anyone who needs to know about the change in state. The heart of the beast.
  set: function(key, val, options) {
    var attr, attrs, unset, changes, silent, changing, prev, current;
    if (key == null) return this;

    // Handle both `"key", value` and `{key: value}` -style arguments.
    if (typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      (attrs = {})[key] = val;
    }

    options || (options = {});

    // Run validation.
    if (!this._validate(attrs, options)) return false;

    // Extract attributes and options.
    unset           = options.unset;
    silent          = options.silent;
    changes         = [];
    changing        = this._changing;
    this._changing  = true;

    if (!changing) {
      this._previousAttributes = _.extend(Object.create(null), this.attributes);
      this.changed = {};
    }
    current = this.attributes, prev = this._previousAttributes;

    // Check for changes of `id`.
    if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

    // For each `set` attribute, update or delete the current value.
    for (attr in attrs) {
      val = attrs[attr];
      if (!_.isEqual(current[attr], val)) changes.push(attr);
      if (!_.isEqual(prev[attr], val)) {
        this.changed[attr] = val;
      } else {
        delete this.changed[attr];
      }
      unset ? delete current[attr] : current[attr] = val;
    }

    // Trigger all relevant attribute changes.
    if (!silent) {
      if (changes.length) this._pending = options;
      for (var i = 0, l = changes.length; i < l; i++) {
        this.trigger('change:' + changes[i], this, current[changes[i]], options);
      }
    }

    // You might be wondering why there's a `while` loop here. Changes can
    // be recursively nested within `"change"` events.
    if (changing) return this;
    if (!silent) {
      while (this._pending) {
        options = this._pending;
        this._pending = false;
        this.trigger('change', this, options);
      }
    }
    this._pending = false;
    this._changing = false;
    return this;
  },

  // Remove an attribute from the model, firing `"change"`. `unset` is a noop
  // if the attribute doesn't exist.
  unset: function(attr, options) {
    return this.set(attr, void 0, _.extend({}, options, {unset: true}));
  },

  // Clear all attributes on the model, firing `"change"`.
  clear: function(options) {
    var attrs = {};
    for (var key in this.attributes) attrs[key] = void 0;
    return this.set(attrs, _.extend({}, options, {unset: true}));
  },

  // Determine if the model has changed since the last `"change"` event.
  // If you specify an attribute name, determine if that attribute has changed.
  hasChanged: function(attr) {
    if (attr == null) return !!Object.keys(this.changed).length;
    return _.has(this.changed, attr);
  },

  // Return an object containing all the attributes that have changed, or
  // false if there are no changed attributes. Useful for determining what
  // parts of a view need to be updated and/or what attributes need to be
  // persisted to the server. Unset attributes will be set to undefined.
  // You can also pass an attributes object to diff against the model,
  // determining if there *would be* a change.
  changedAttributes: function(diff) {
    if (!diff) return this.hasChanged() ? _.extend(Object.create(null), this.changed) : false;
    var val, changed = false;
    var old = this._changing ? this._previousAttributes : this.attributes;
    for (var attr in diff) {
      if (_.isEqual(old[attr], (val = diff[attr]))) continue;
      (changed || (changed = {}))[attr] = val;
    }
    return changed;
  },

  // Get the previous value of an attribute, recorded at the time the last
  // `"change"` event was fired.
  previous: function(attr) {
    if (attr == null || !this._previousAttributes) return null;
    return this._previousAttributes[attr];
  },

  // Get all of the attributes of the model at the time of the previous
  // `"change"` event.
  previousAttributes: function() {
    return _.extend(Object.create(null), this._previousAttributes);
  },

  // Fetch the model from the server. If the server's representation of the
  // model differs from its current attributes, they will be overridden,
  // triggering a `"change"` event.
  fetch: function(options) {
    options = options ? _.extend({}, options) : {};
    if (options.parse === void 0) options.parse = true;
    var model = this;
    var success = options.success;
    options.success = function(resp) {
      if (!model.set(model.parse(resp, options), options)) return false;
      if (success) success(model, resp, options);
      model.trigger('sync', model, resp, options);
    };
    wrapError(this, options);
    return this.sync('read', this, options);
  },

  // Set a hash of model attributes, and sync the model to the server.
  // If the server returns an attributes hash that differs, the model's
  // state will be `set` again.
  save: function(key, val, options) {
    var attrs, method, xhr, attributes = this.attributes;

    // Handle both `"key", value` and `{key: value}` -style arguments.
    if (key == null || typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      (attrs = {})[key] = val;
    }

    options = _.extend({validate: true}, options);

    // If we're not waiting and attributes exist, save acts as
    // `set(attr).save(null, opts)` with validation. Otherwise, check if
    // the model will be valid when the attributes, if any, are set.
    if (attrs && !options.wait) {
      if (!this.set(attrs, options)) return false;
    } else {
      if (!this._validate(attrs, options)) return false;
    }

    // Set temporary attributes if `{wait: true}`.
    if (attrs && options.wait) {
      this.attributes = _.extend(Object.create(null), attributes, attrs);
    }

    // After a successful server-side save, the client is (optionally)
    // updated with the server-side state.
    if (options.parse === void 0) options.parse = true;
    var model = this;
    var success = options.success;
    options.success = function(resp) {
      // Ensure attributes are restored during synchronous saves.
      model.attributes = attributes;
      var serverAttrs = model.parse(resp, options);
      if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
      if (serverAttrs && typeof serverAttrs === 'object' && !model.set(serverAttrs, options)) {
        return false;
      }
      if (success) success(model, resp, options);
      model.trigger('sync', model, resp, options);
    };
    wrapError(this, options);

    method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
    if (method === 'patch') options.attrs = attrs;
    xhr = this.sync(method, this, options);

    // Restore attributes.
    if (attrs && options.wait) this.attributes = attributes;

    return xhr;
  },

  // Destroy this model on the server if it was already persisted.
  // Optimistically removes the model from its collection, if it has one.
  // If `wait: true` is passed, waits for the server to respond before removal.
  destroy: function(options) {
    options = options ? _.extend({}, options) : {};
    var model = this;
    var success = options.success;

    var destroy = function() {
      model.trigger('destroy', model, model.collection, options);
    };

    options.success = function(resp) {
      if (options.wait || model.isNew()) destroy();
      if (success) success(model, resp, options);
      if (!model.isNew()) model.trigger('sync', model, resp, options);
    };

    if (this.isNew()) {
      options.success();
      return false;
    }
    wrapError(this, options);

    var xhr = this.sync('delete', this, options);
    if (!options.wait) destroy();
    return xhr;
  },

  // Default URL for the model's representation on the server -- if you're
  // using Backbone's restful methods, override this to change the endpoint
  // that will be called.
  url: function() {
    var base =
      _.result(this, 'urlRoot') ||
      _.result(this.collection, 'url') ||
      urlError();
    if (this.isNew()) return base;
    return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(this.id);
  },

  // **parse** converts a response into the hash of attributes to be `set` on
  // the model. The default implementation is just to pass the response along.
  parse: function(resp, options) {
    return resp;
  },

  // Create a new model with identical attributes to this one.
  clone: function() {
    return new this.constructor(this.attributes);
  },

  // A model is new if it has never been saved to the server, and lacks an id.
  isNew: function() {
    return !this.has(this.idAttribute);
  },

  // Check if the model is currently in a valid state.
  isValid: function(options) {
    return this._validate({}, _.extend(options || {}, { validate: true }));
  },

  // Run validation against the next complete set of model attributes,
  // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
  _validate: function(attrs, options) {
    if (!options.validate || !this.validate) return true;
    attrs = _.extend(Object.create(null), this.attributes, attrs);
    var error = this.validationError = this.validate(attrs, options) || null;
    if (!error) return true;
    this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
    return false;
  }

});

if (_.keys) {
  // Underscore methods that we want to implement on the Model.
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  modelMethods.filter(utilExists).forEach(function(method) {
    Model.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.attributes);
      return _[method].apply(_, args);
    };
  });
}
// Backbone.Collection
// -------------------

// If models tend to represent a single row of data, a Backbone Collection is
// more analagous to a table full of data ... or a small slice or page of that
// table, or a collection of rows that belong together for a particular reason
// -- all of the messages in this particular folder, all of the documents
// belonging to this particular author, and so on. Collections maintain
// indexes of their models, both in order, and for lookup by `id`.

// Create a new **Collection**, perhaps to contain a specific type of `model`.
// If a `comparator` is specified, the Collection will maintain
// its models in sort order, as they're added and removed.
var Collection = Backbone.Collection = function(models, options) {
  options || (options = {});
  if (options.model) this.model = options.model;
  if (options.comparator !== void 0) this.comparator = options.comparator;
  this._reset();
  this.initialize.apply(this, arguments);
  if (models) this.reset(models, _.extend({silent: true}, options));
};

// Default options for `Collection#set`.
var setOptions = {add: true, remove: true, merge: true};
var addOptions = {add: true, remove: false};

// Define the Collection's inheritable methods.
_.extend(Collection.prototype, Events, {

  // The default model for a collection is just a **Backbone.Model**.
  // This should be overridden in most cases.
  model: typeof Model === 'undefined' ? null : Model,

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize: function(){},

  // The JSON representation of a Collection is an array of the
  // models' attributes.
  toJSON: function(options) {
    return this.map(function(model){ return model.toJSON(options); });
  },

  // Proxy `Backbone.sync` by default.
  sync: function() {
    return Backbone.sync.apply(this, arguments);
  },

  // Add a model, or list of models to the set.
  add: function(models, options) {
    return this.set(models, _.extend({merge: false}, options, addOptions));
  },

  // Remove a model, or a list of models from the set.
  remove: function(models, options) {
    var singular = !Array.isArray(models);
    models = singular ? [models] : models.slice();
    options || (options = {});
    var i, l, index, model;
    for (i = 0, l = models.length; i < l; i++) {
      model = models[i] = this.get(models[i]);
      if (!model) continue;
      delete this._byId[model.id];
      delete this._byId[model.cid];
      index = this.indexOf(model);
      this.models.splice(index, 1);
      this.length--;
      if (!options.silent) {
        options.index = index;
        model.trigger('remove', model, this, options);
      }
      this._removeReference(model, options);
    }
    return singular ? models[0] : models;
  },

  // Update a collection by `set`-ing a new list of models, adding new ones,
  // removing models that are no longer present, and merging models that
  // already exist in the collection, as necessary. Similar to **Model#set**,
  // the core operation for updating the data contained by the collection.
  set: function(models, options) {
    options = _.defaults({}, options, setOptions);
    if (options.parse) models = this.parse(models, options);
    var singular = !Array.isArray(models);
    models = singular ? (models ? [models] : []) : models.slice();
    var i, l, id, model, attrs, existing, sort;
    var at = options.at;
    var targetModel = this.model;
    var sortable = this.comparator && (at == null) && options.sort !== false;
    var sortAttr = typeof this.comparator === 'string' ? this.comparator : null;
    var toAdd = [], toRemove = [], modelMap = {};
    var add = options.add, merge = options.merge, remove = options.remove;
    var order = !sortable && add && remove ? [] : false;

    // Turn bare objects into model references, and prevent invalid models
    // from being added.
    for (i = 0, l = models.length; i < l; i++) {
      attrs = models[i] || {};
      if (attrs instanceof Model) {
        id = model = attrs;
      } else {
        id = attrs[targetModel.prototype.idAttribute || 'id'];
      }

      // If a duplicate is found, prevent it from being added and
      // optionally merge it into the existing model.
      if (existing = this.get(id)) {
        if (remove) modelMap[existing.cid] = true;
        if (merge) {
          attrs = attrs === model ? model.attributes : attrs;
          if (options.parse) attrs = existing.parse(attrs, options);
          existing.set(attrs, options);
          if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
        }
        models[i] = existing;

      // If this is a new, valid model, push it to the `toAdd` list.
      } else if (add) {
        model = models[i] = this._prepareModel(attrs, options);
        if (!model) continue;
        toAdd.push(model);
        this._addReference(model, options);
      }

      // Do not add multiple models with the same `id`.
      model = existing || model;
      if (order && (model.isNew() || !modelMap[model.id])) order.push(model);
      modelMap[model.id] = true;
    }

    // Remove nonexistent models if appropriate.
    if (remove) {
      for (i = 0, l = this.length; i < l; ++i) {
        if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
      }
      if (toRemove.length) this.remove(toRemove, options);
    }

    // See if sorting is needed, update `length` and splice in new models.
    if (toAdd.length || (order && order.length)) {
      if (sortable) sort = true;
      this.length += toAdd.length;
      if (at != null) {
        for (i = 0, l = toAdd.length; i < l; i++) {
          this.models.splice(at + i, 0, toAdd[i]);
        }
      } else {
        if (order) this.models.length = 0;
        var orderedModels = order || toAdd;
        for (i = 0, l = orderedModels.length; i < l; i++) {
          this.models.push(orderedModels[i]);
        }
      }
    }

    // Silently sort the collection if appropriate.
    if (sort) this.sort({silent: true});

    // Unless silenced, it's time to fire all appropriate add/sort events.
    if (!options.silent) {
      for (i = 0, l = toAdd.length; i < l; i++) {
        (model = toAdd[i]).trigger('add', model, this, options);
      }
      if (sort || (order && order.length)) this.trigger('sort', this, options);
    }

    // Return the added (or merged) model (or models).
    return singular ? models[0] : models;
  },

  // When you have more items than you want to add or remove individually,
  // you can reset the entire set with a new list of models, without firing
  // any granular `add` or `remove` events. Fires `reset` when finished.
  // Useful for bulk operations and optimizations.
  reset: function(models, options) {
    options || (options = {});
    for (var i = 0, l = this.models.length; i < l; i++) {
      this._removeReference(this.models[i], options);
    }
    options.previousModels = this.models;
    this._reset();
    models = this.add(models, _.extend({silent: true}, options));
    if (!options.silent) this.trigger('reset', this, options);
    return models;
  },

  // Add a model to the end of the collection.
  push: function(model, options) {
    return this.add(model, _.extend({at: this.length}, options));
  },

  // Remove a model from the end of the collection.
  pop: function(options) {
    var model = this.at(this.length - 1);
    this.remove(model, options);
    return model;
  },

  // Add a model to the beginning of the collection.
  unshift: function(model, options) {
    return this.add(model, _.extend({at: 0}, options));
  },

  // Remove a model from the beginning of the collection.
  shift: function(options) {
    var model = this.at(0);
    this.remove(model, options);
    return model;
  },

  // Slice out a sub-array of models from the collection.
  slice: function() {
    return slice.apply(this.models, arguments);
  },

  // Get a model from the set by id.
  get: function(obj) {
    if (obj == null) return void 0;
    return this._byId[obj] || this._byId[obj.id] || this._byId[obj.cid];
  },

  // Get the model at the given index.
  at: function(index) {
    return this.models[index];
  },

  // Return models with matching attributes. Useful for simple cases of
  // `filter`.
  where: function(attrs, first) {
    if (!attrs || !Object.keys(attrs).length) return first ? void 0 : [];
    return this[first ? 'find' : 'filter'](function(model) {
      for (var key in attrs) {
        if (attrs[key] !== model.get(key)) return false;
      }
      return true;
    });
  },

  // Return the first model with matching attributes. Useful for simple cases
  // of `find`.
  findWhere: function(attrs) {
    return this.where(attrs, true);
  },

  // Force the collection to re-sort itself. You don't need to call this under
  // normal circumstances, as the set will maintain sort order as each item
  // is added.
  sort: function(options) {
    if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
    options || (options = {});

    // Run sort based on type of `comparator`.
    if (typeof this.comparator === 'string' || this.comparator.length === 1) {
      this.models = this.sortBy(this.comparator, this);
    } else {
      this.models.sort(this.comparator.bind(this));
    }

    if (!options.silent) this.trigger('sort', this, options);
    return this;
  },

  // Pluck an attribute from each model in the collection.
  pluck: function(attr) {
    return this.models.map(function(model) {
      return model.get(attr);
    });
  },

  // Fetch the default set of models for this collection, resetting the
  // collection when they arrive. If `reset: true` is passed, the response
  // data will be passed through the `reset` method instead of `set`.
  fetch: function(options) {
    options = options ? _.extend({}, options) : {};
    if (options.parse === void 0) options.parse = true;
    var success = options.success;
    var collection = this;
    options.success = function(resp) {
      var method = options.reset ? 'reset' : 'set';
      collection[method](resp, options);
      if (success) success(collection, resp, options);
      collection.trigger('sync', collection, resp, options);
    };
    wrapError(this, options);
    return this.sync('read', this, options);
  },

  // Create a new instance of a model in this collection. Add the model to the
  // collection immediately, unless `wait: true` is passed, in which case we
  // wait for the server to agree.
  create: function(model, options) {
    options = options ? _.extend({}, options) : {};
    if (!(model = this._prepareModel(model, options))) return false;
    if (!options.wait) this.add(model, options);
    var collection = this;
    var success = options.success;
    options.success = function(model, resp) {
      if (options.wait) collection.add(model, options);
      if (success) success(model, resp, options);
    };
    model.save(null, options);
    return model;
  },

  // **parse** converts a response into a list of models to be added to the
  // collection. The default implementation is just to pass it through.
  parse: function(resp, options) {
    return resp;
  },

  // Create a new collection with an identical list of models as this one.
  clone: function() {
    return new this.constructor(this.models);
  },

  // Private method to reset all internal state. Called when the collection
  // is first initialized or reset.
  _reset: function() {
    this.length = 0;
    this.models = [];
    this._byId  = Object.create(null);
  },

  // Prepare a hash of attributes (or other model) to be added to this
  // collection.
  _prepareModel: function(attrs, options) {
    if (attrs instanceof Model) return attrs;
    options = _.extend({}, options);
    options.collection = this;
    var model = new this.model(attrs, options);
    if (!model.validationError) return model;
    this.trigger('invalid', this, model.validationError, options);
    return false;
  },

  // Internal method to create a model's ties to a collection.
  _addReference: function(model, options) {
    this._byId[model.cid] = model;
    if (model.id != null) this._byId[model.id] = model;
    if (!model.collection) model.collection = this;
    model.on('all', this._onModelEvent, this);
  },

  // Internal method to sever a model's ties to a collection.
  _removeReference: function(model, options) {
    if (this === model.collection) delete model.collection;
    model.off('all', this._onModelEvent, this);
  },

  // Internal method called every time a model in the set fires an event.
  // Sets need to update their indexes when models change ids. All other
  // events simply proxy through. "add" and "remove" events that originate
  // in other collections are ignored.
  _onModelEvent: function(event, model, collection, options) {
    if ((event === 'add' || event === 'remove') && collection !== this) return;
    if (event === 'destroy') this.remove(model, options);
    if (model && event === 'change:' + model.idAttribute) {
      delete this._byId[model.previous(model.idAttribute)];
      if (model.id != null) this._byId[model.id] = model;
    }
    this.trigger.apply(this, arguments);
  }

});

if (utilExists('each')) {
  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
    'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
    'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
    'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
    'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
    'lastIndexOf', 'isEmpty', 'chain'];

  // Mix in each Underscore method as a proxy to `Collection#models`.
  methods.filter(utilExists).forEach(function(method) {
    Collection.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.models);
      return _[method].apply(_, args);
    };
  });

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy'];

  // Use attributes instead of properties.
  attributeMethods.filter(utilExists).forEach(function(method) {
    Collection.prototype[method] = function(value, context) {
      var iterator = typeof value === 'function' ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });
} else {
  ['forEach', 'map', 'filter', 'some', 'every', 'reduce', 'reduceRight',
    'indexOf', 'lastIndexOf'].forEach(function(method) {
    Collection.prototype[method] = function(arg, context) {
      return this.models[method](arg, context);
    };
  });

  // Exoskeleton-specific:
  Collection.prototype.find = function(iterator, context) {
    var result;
    this.some(function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Underscore methods that take a property name as an argument.
  ['sortBy'].forEach(function(method) {
    Collection.prototype[method] = function(value, context) {
      var iterator = typeof value === 'function' ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });
}
// Backbone.View
// -------------

// Backbone Views are almost more convention than they are actual code. A View
// is simply a JavaScript object that represents a logical chunk of UI in the
// DOM. This might be a single item, an entire list, a sidebar or panel, or
// even the surrounding frame which wraps your whole app. Defining a chunk of
// UI as a **View** allows you to define your DOM events declaratively, without
// having to worry about render order ... and makes it easy for the view to
// react to specific changes in the state of your models.

// Creating a Backbone.View creates its initial element outside of the DOM,
// if an existing element is not provided...
var View = Backbone.View = function(options) {
  this.cid = _.uniqueId('view');

  if (options) Object.keys(options).forEach(function(key) {
    if (viewOptions.indexOf(key) !== -1) this[key] = options[key];
  }, this);

  this._ensureElement();
  this.initialize.apply(this, arguments);
};

// Cached regex to split keys for `delegate`.
var delegateEventSplitter = /^(\S+)\s*(.*)$/;

// List of view options to be merged as properties.
var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

// Set up all inheritable **Backbone.View** properties and methods.
_.extend(View.prototype, Events, {

  // The default `tagName` of a View's element is `"div"`.
  tagName: 'div',

  // jQuery delegate for element lookup, scoped to DOM elements within the
  // current view. This should be preferred to global lookups where possible.
  $: function(selector) {
    return this.$el.find(selector);
  },

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize: function(){},

  // **render** is the core function that your view should override, in order
  // to populate its element (`this.el`), with the appropriate HTML. The
  // convention is for **render** to always return `this`.
  render: function() {
    return this;
  },

  // Remove this view by taking the element out of the DOM, and removing any
  // applicable Backbone.Events listeners.
  remove: function() {
    this._removeElement();
    this.stopListening();
    return this;
  },

  // Remove this view's element from the document and all event listeners
  // attached to it. Exposed for subclasses using an alternative DOM
  // manipulation API.
  _removeElement: function() {
    this.$el.remove();
  },

  // Change the view's element (`this.el` property) and re-delegate the
  // view's events on the new element.
  setElement: function(element) {
    this.undelegateEvents();
    this._setElement(element);
    this.delegateEvents();
    return this;
  },

  // Creates the `this.el` and `this.$el` references for this view using the
  // given `el` and a hash of `attributes`. `el` can be a CSS selector or an
  // HTML string, a jQuery context or an element. Subclasses can override
  // this to utilize an alternative DOM manipulation API and are only required
  // to set the `this.el` property.
  _setElement: function(el) {
    this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
    this.el = this.$el[0];
  },

  // Set callbacks, where `this.events` is a hash of
  //
  // *{"event selector": "callback"}*
  //
  //     {
  //       'mousedown .title':  'edit',
  //       'click .button':     'save',
  //       'click .open':       function(e) { ... }
  //     }
  //
  // pairs. Callbacks will be bound to the view, with `this` set properly.
  // Uses event delegation for efficiency.
  // Omitting the selector binds the event to `this.el`.
  delegateEvents: function(events) {
    if (!(events || (events = _.result(this, 'events')))) return this;
    this.undelegateEvents();
    for (var key in events) {
      var method = events[key];
      if (typeof method !== 'function') method = this[events[key]];
      // if (!method) continue;
      var match = key.match(delegateEventSplitter);
      this.delegate(match[1], match[2], method.bind(this));
    }
    return this;
  },

  // Add a single event listener to the view's element (or a child element
  // using `selector`). This only works for delegate-able events: not `focus`,
  // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
  delegate: function(eventName, selector, listener) {
    this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
  },

  // Clears all callbacks previously bound to the view by `delegateEvents`.
  // You usually don't need to use this, but may wish to if you have multiple
  // Backbone views attached to the same DOM element.
  undelegateEvents: function() {
    if (this.$el) this.$el.off('.delegateEvents' + this.cid);
    return this;
  },

  // A finer-grained `undelegateEvents` for removing a single delegated event.
  // `selector` and `listener` are both optional.
  undelegate: function(eventName, selector, listener) {
    this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
  },

  // Produces a DOM element to be assigned to your view. Exposed for
  // subclasses using an alternative DOM manipulation API.
  _createElement: function(tagName) {
    return document.createElement(tagName);
  },

  // Ensure that the View has a DOM element to render into.
  // If `this.el` is a string, pass it through `$()`, take the first
  // matching element, and re-assign it to `el`. Otherwise, create
  // an element from the `id`, `className` and `tagName` properties.
  _ensureElement: function() {
    if (!this.el) {
      var attrs = _.extend({}, _.result(this, 'attributes'));
      if (this.id) attrs.id = _.result(this, 'id');
      if (this.className) attrs['class'] = _.result(this, 'className');
      this.setElement(this._createElement(_.result(this, 'tagName')));
      this._setAttributes(attrs);
    } else {
      this.setElement(_.result(this, 'el'));
    }
  },

  // Set attributes from a hash on this view's element.  Exposed for
  // subclasses using an alternative DOM manipulation API.
  _setAttributes: function(attributes) {
    this.$el.attr(attributes);
  }

});
// Backbone.sync
// -------------

// Override this function to change the manner in which Backbone persists
// models to the server. You will be passed the type of request, and the
// model in question. By default, makes a RESTful Ajax request
// to the model's `url()`. Some possible customizations could be:
//
// * Use `setTimeout` to batch rapid-fire updates into a single request.
// * Send up the models as XML instead of JSON.
// * Persist models via WebSockets instead of Ajax.
Backbone.sync = function(method, model, options) {
  options || (options = {})

  var type = methodMap[method];

  // Default JSON-request options.
  var params = {type: type, dataType: 'json'};

  // Ensure that we have a URL.
  if (!options.url) {
    params.url = _.result(model, 'url') || urlError();
  }

  // Ensure that we have the appropriate request data.
  if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
    params.contentType = 'application/json';
    params.data = JSON.stringify(options.attrs || model.toJSON(options));
  }

  // Don't process data on a non-GET request.
  if (params.type !== 'GET') {
    params.processData = false;
  }

  // Make the request, allowing the user to override any Ajax options.
  var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
  model.trigger('request', model, xhr, options);
  return xhr;
};

// Map from CRUD to HTTP for our default `Backbone.sync` implementation.
var methodMap = {
  'create': 'POST',
  'update': 'PUT',
  'patch':  'PATCH',
  'delete': 'DELETE',
  'read':   'GET'
};

// Set the default implementation of `Backbone.ajax` to proxy through to `$`.
// Override this if you'd like to use a different library.
Backbone.ajax = function() {
  return Backbone.$.ajax.apply(Backbone.$, arguments);
};
// Backbone.Router
// ---------------

// Routers map faux-URLs to actions, and fire events when routes are
// matched. Creating a new one sets its `routes` hash, if not set statically.
var Router = Backbone.Router = function(options) {
  options || (options = {});
  if (options.routes) this.routes = options.routes;
  this._bindRoutes();
  this.initialize.apply(this, arguments);
};

// Cached regular expressions for matching named param parts and splatted
// parts of route strings.
var optionalParam = /\((.*?)\)/g;
var namedParam    = /(\(\?)?:\w+/g;
var splatParam    = /\*\w+/g;
var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

var isRegExp = function(value) {
  return value ? (typeof value === 'object' && toString.call(value) === '[object RegExp]') : false;
};

// Set up all inheritable **Backbone.Router** properties and methods.
_.extend(Router.prototype, Events, {

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize: function(){},

  // Manually bind a single named route to a callback. For example:
  //
  //     this.route('search/:query/p:num', 'search', function(query, num) {
  //       ...
  //     });
  //
  route: function(route, name, callback) {
    if (!isRegExp(route)) route = this._routeToRegExp(route);
    if (typeof name === 'function') {
      callback = name;
      name = '';
    }
    if (!callback) callback = this[name];
    var router = this;
    Backbone.history.route(route, function(fragment) {
      var args = router._extractParameters(route, fragment);
      router.execute(callback, args);
      router.trigger.apply(router, ['route:' + name].concat(args));
      router.trigger('route', name, args);
      Backbone.history.trigger('route', router, name, args);
    });
    return this;
  },

  // Execute a route handler with the provided parameters.  This is an
  // excellent place to do pre-route setup or post-route cleanup.
  execute: function(callback, args) {
    if (callback) callback.apply(this, args);
  },

  // Simple proxy to `Backbone.history` to save a fragment into the history.
  navigate: function(fragment, options) {
    Backbone.history.navigate(fragment, options);
    return this;
  },

  // Bind all defined routes to `Backbone.history`. We have to reverse the
  // order of the routes here to support behavior where the most general
  // routes can be defined at the bottom of the route map.
  _bindRoutes: function() {
    if (!this.routes) return;
    this.routes = _.result(this, 'routes');
    var route, routes = Object.keys(this.routes);
    while ((route = routes.pop()) != null) {
      this.route(route, this.routes[route]);
    }
  },

  // Convert a route string into a regular expression, suitable for matching
  // against the current location hash.
  _routeToRegExp: function(route) {
    route = route.replace(escapeRegExp, '\\$&')
                 .replace(optionalParam, '(?:$1)?')
                 .replace(namedParam, function(match, optional) {
                   return optional ? match : '([^/?]+)';
                 })
                 .replace(splatParam, '([^?]*?)');
    return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
  },

  // Given a route, and a URL fragment that it matches, return the array of
  // extracted decoded parameters. Empty or unmatched parameters will be
  // treated as `null` to normalize cross-browser behavior.
  _extractParameters: function(route, fragment) {
    var params = route.exec(fragment).slice(1);
    return params.map(function(param, i) {
      // Don't decode the search params.
      if (i === params.length - 1) return param || null;
      return param ? decodeURIComponent(param) : null;
    });
  }

});
// Backbone.History
// ----------------

// Handles cross-browser history management, based on either
// [pushState](http://diveintohtml5.info/history.html) and real URLs, or
// [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
// and URL fragments.
var History = Backbone.History = function() {
  this.handlers = [];
  this.checkUrl = this.checkUrl.bind(this);

  // Ensure that `History` can be used outside of the browser.
  if (typeof window !== 'undefined') {
    this.location = window.location;
    this.history = window.history;
  }
};

// Cached regex for stripping a leading hash/slash and trailing space.
var routeStripper = /^[#\/]|\s+$/g;

// Cached regex for stripping leading and trailing slashes.
var rootStripper = /^\/+|\/+$/g;

// Cached regex for removing a trailing slash.
var trailingSlash = /\/$/;

// Cached regex for stripping urls of hash and query.
var pathStripper = /[#].*$/;

// Has the history handling already been started?
History.started = false;

// Set up all inheritable **Backbone.History** properties and methods.
_.extend(History.prototype, Events, {

  // Are we at the app root?
  atRoot: function() {
    return this.location.pathname.replace(/[^\/]$/, '$&/') === this.root;
  },

  // Gets the true hash value. Cannot use location.hash directly due to bug
  // in Firefox where location.hash will always be decoded.
  getHash: function(window) {
    var match = (window || this).location.href.match(/#(.*)$/);
    return match ? match[1] : '';
  },

  // Get the cross-browser normalized URL fragment, either from the URL,
  // the hash, or the override.
  getFragment: function(fragment, forcePushState) {
    if (fragment == null) {
      if (this._wantsPushState || !this._wantsHashChange) {
        fragment = decodeURI(this.location.pathname + this.location.search);
        var root = this.root.replace(trailingSlash, '');
        if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
      } else {
        fragment = this.getHash();
      }
    }
    return fragment.replace(routeStripper, '');
  },

  // Start the hash change handling, returning `true` if the current URL matches
  // an existing route, and `false` otherwise.
  start: function(options) {
    if (History.started) throw new Error("Backbone.history has already been started");
    History.started = true;

    // Figure out the initial configuration.
    // Is pushState desired or should we use hashchange only?
    this.options          = _.extend({root: '/'}, this.options, options);
    this.root             = this.options.root;
    this._wantsHashChange = this.options.hashChange !== false;
    this._wantsPushState  = !!this.options.pushState;
    var fragment          = this.getFragment();

    // Normalize root to always include a leading and trailing slash.
    this.root = ('/' + this.root + '/').replace(rootStripper, '/');

    // Depending on whether we're using pushState or hashes, determine how we
    // check the URL state.
    if (this._wantsPushState) {
      window.addEventListener('popstate', this.checkUrl, false);
    } else if (this._wantsHashChange) {
      window.addEventListener('hashchange', this.checkUrl, false);
    }

    // Determine if we need to change the base url, for a pushState link
    // opened by a non-pushState browser.
    this.fragment = fragment;
    var loc = this.location;

    // Transition from hashChange to pushState or vice versa if both are
    // requested.
    if (this._wantsHashChange && this._wantsPushState) {

      // If we've started out with a hash-based route, but we're currently
      // in a browser where it could be `pushState`-based instead...
      if (this.atRoot() && loc.hash) {
        this.fragment = this.getHash().replace(routeStripper, '');
        this.history.replaceState({}, document.title, this.root + this.fragment);
      }

    }

    if (!this.options.silent) return this.loadUrl();
  },

  // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
  // but possibly useful for unit testing Routers.
  stop: function() {
    window.removeEventListener('popstate', this.checkUrl);
    window.removeEventListener('hashchange', this.checkUrl);
    History.started = false;
  },

  // Add a route to be tested when the fragment changes. Routes added later
  // may override previous routes.
  route: function(route, callback) {
    this.handlers.unshift({route: route, callback: callback});
  },

  // Checks the current URL to see if it has changed, and if it has,
  // calls `loadUrl`.
  checkUrl: function() {
    var current = this.getFragment();
    if (current === this.fragment) return false;
    this.loadUrl();
  },

  // Attempt to load the current URL fragment. If a route succeeds with a
  // match, returns `true`. If no defined routes matches the fragment,
  // returns `false`.
  loadUrl: function(fragment) {
    fragment = this.fragment = this.getFragment(fragment);
    return this.handlers.some(function(handler) {
      if (handler.route.test(fragment)) {
        handler.callback(fragment);
        return true;
      }
    });
  },

  // Save a fragment into the hash history, or replace the URL state if the
  // 'replace' option is passed. You are responsible for properly URL-encoding
  // the fragment in advance.
  //
  // The options object can contain `trigger: true` if you wish to have the
  // route callback be fired (not usually desirable), or `replace: true`, if
  // you wish to modify the current URL without adding an entry to the history.
  navigate: function(fragment, options) {
    if (!History.started) return false;
    if (!options || options === true) options = {trigger: !!options};

    var url = this.root + (fragment = this.getFragment(fragment || ''));

    // Strip the hash for matching.
    fragment = fragment.replace(pathStripper, '');

    if (this.fragment === fragment) return;
    this.fragment = fragment;

    // Don't include a trailing slash on the root.
    if (fragment === '' && url !== '/') url = url.slice(0, -1);

    // If we're using pushState we use it to set the fragment as a real URL.
    if (this._wantsPushState) {
      this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

    // If hash changes haven't been explicitly disabled, update the hash
    // fragment to store history.
    } else if (this._wantsHashChange) {
      this._updateHash(this.location, fragment, options.replace);
    // If you've told us that you explicitly don't want fallback hashchange-
    // based history, then `navigate` becomes a page refresh.
    } else {
      return this.location.assign(url);
    }
    if (options.trigger) return this.loadUrl(fragment);
  },

  // Update the hash location, either replacing the current entry, or adding
  // a new one to the browser history.
  _updateHash: function(location, fragment, replace) {
    if (replace) {
      var href = location.href.replace(/(javascript:|#).*$/, '');
      location.replace(href + '#' + fragment);
    } else {
      // Some browsers require that `hash` contains a leading #.
      location.hash = '#' + fragment;
    }
  }

});
  // !!!
  // Init.
  ['Model', 'Collection', 'Router', 'View', 'History'].forEach(function(name) {
    var item = Backbone[name];
    if (item) item.extend = Backbone.extend;
  });

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Create the default Backbone.history if the History module is included.
  if (History) Backbone.history = new History();
  return Backbone;
});

},{"jquery":undefined,"underscore":undefined}],4:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _modulesFormSchemaFormSchemaView = require('./modules/form-schema/form-schema-view');

var _modulesFormSchemaFormSchemaView2 = _interopRequireDefault(_modulesFormSchemaFormSchemaView);

var _libsHelpersEnvironment = require('./libs/helpers/environment');

var _libsFormellSchema = require('./libs/formell-schema');

var _libsFormellSchema2 = _interopRequireDefault(_libsFormellSchema);

var Formell = (function () {
	_createClass(Formell, [{
		key: 'formView',
		set: function set(formView) {
			this._formView = formView;
		},
		get: function get() {
			return this._formView;
		}
	}, {
		key: 'options',
		set: function set(options) {
			this._options = options;
		},
		get: function get() {
			return this._options;
		}
	}, {
		key: 'form',
		set: function set(form) {
			this._form = form;
		},
		get: function get() {
			return this._form;
		}
	}]);

	function Formell() {
		var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

		_classCallCheck(this, Formell);

		this.options = options;
		this.create();
	}

	Formell.prototype.create = function create() {

		this.formView = new _modulesFormSchemaFormSchemaView2['default']({
			action: this.options.action || 'javascript:void(0)',
			method: this.options.method || 'POST',
			data: this.options.data || {}
		});

		this.form = this.formView.render().el;

		return this.form;
	};

	return Formell;
})();

;

// add formel class to global namespace
_libsHelpersEnvironment.getGlobalObject().Formell = Formell;

exports['default'] = Formell;
module.exports = exports['default'];
},{"./libs/formell-schema":5,"./libs/helpers/environment":6,"./modules/form-schema/form-schema-view":10}],5:[function(require,module,exports){
/**
 * based on https://github.com/redpie/backbone-schema
 */
'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _helpersExoskelesston = require('./helpers/exoskelesston');

var _helpersExoskelesston2 = _interopRequireDefault(_helpersExoskelesston);

var _helpersEnvironment = require('./helpers/environment');

'use strict';

// helper
function undef() {
    return arguments[0];
}

var FormellSchema = (function () {
    var Schema = {};

    function log() {}

    function toObject(key, value) {
        var obj = {};
        obj[key] = value;
        return obj;
    }

    function typeOf(Value, aType) {
        return typeof Value == 'function' && typeof aType == 'function' ? new Value() instanceof aType : false;
    }

    function instanceOf(inst, aType) {
        return typeof aType == 'function' ? inst instanceof aType : false;
    }

    // Replace default backbone inheritance code with the following which
    // returns the value returned by the underlying constructors which
    // facilitates the IdentityMap feature
    var Ctor = function Ctor() {};

    function inherits(parent, protoProps, staticProps) {
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && protoProps.hasOwnProperty('constructor')) {
            child = protoProps.constructor;
        } else {
            child = function () {
                // Returning the return value from parent below facilitates
                // the IdentityMap feature
                return parent.apply(this, arguments);
            };
        }

        // Inherit class (static) properties from parent.
        Object.assign(child, parent);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        Ctor.prototype = parent.prototype;
        child.prototype = new Ctor();

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) {
            Object.assign(child.prototype, protoProps);
        }

        // Add static properties to the constructor function, if supplied.
        if (staticProps) {
            Object.assign(child, staticProps);
        }

        // Correctly set child's `prototype.constructor`.
        child.prototype.constructor = child;

        // Set a convenience property in case the parent's prototype is needed later.
        child['__super__'] = parent.prototype;

        return child;
    }

    function internalExtend(protoProps, staticProps) {
        var child = inherits(this, protoProps, staticProps);
        child.internalExtend = this.internalExtend;
        child.prototype.uniqueTypeId = _helpersExoskelesston2['default'].utils.uniqueId();
        return child;
    }

    /**
     * JSONPointer implementation of http://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-03
     * @param {Object} obj JSON object
     * @constructor
     */

    function JSONPointer(obj) {
        this.obj = obj;
    }
    JSONPointer.prototype = {

        /**
         * Gets the value located at the JSONPointer path
         * @param  {String} path Path in the format "/foo/bar/0"
         * @return {Number|String|Object}      Value located at path
         */
        get: function get(path) {
            if (path === '') {
                return this.obj;
            }
            return this._find(this.obj, this._toParts(path));
        },

        /**
         * Sets the proerty located at the provided path
         * @param {[type]} path  Path in the format "/foo/bar/0"
         * @param {[type]} value Value to set
         */
        set: function set(path, value) {
            if (path === '') {
                this.obj = value;
                return true;
            }
            var parts = this._toParts(path),
                name = parts.pop(),
                property = parts.length > 0 ? this._find(this.obj, parts) : this.obj;

            if (property !== undef() && property !== null) {
                property[name] = value;
                return true;
            }
            return false;
        },

        /**
         * @private
         */
        _toParts: function _toParts(path) {
            return path.split('/').slice(1).map(function (part) {
                return part.replace('~1', '/').replace('~0', '~');
            });
        },

        /**
         * @private
         */
        _find: function _find(obj, paths) {
            var property = obj[paths[0]];
            if (property !== undef() && property !== null && paths.length > 1) {
                paths.shift();
                return this._find(property, paths);
            }
            return property;
        }
    };
    JSONPointer.isPointer = function (pointer) {
        return pointer !== undef() && pointer !== null || pointer.indexOf('#') >= 0 ? true : false;
    };
    JSONPointer.fragmentPart = function (path) {
        var parts = path.split('#');
        return parts.length > 1 ? parts[1] : undef();
    };
    JSONPointer.removeFragment = function (path) {
        return path.split('#')[0];
    };

    /**
     * SchemaFactory provides methods to register and create new Models and Collections
     * from JSON Schemas.
     * @constructor
     */
    var SchemaFactory = Schema.Factory = function SchemaFactory(options) {

        // Initialise the options object
        options = options || {};
        this.options = options;

        /**
         * Maintains a list of registered schemas, indexed by schema.id
         * @type {Object}
         */
        this.registeredSchemas = {};

        /**
         * Maintains a list of registered models, indexed by schema.id
         * @type {Object}
         */
        this.registeredSchemaTypes = {};

        /**
         * Maintains a list of parsed schemas, indexed by schema.id
         * @type {Object}
         */
        this.parsedSchemaCache = {};

        /**
         * Maintains a list of constructed Models and Collections, indexed by schema.id
         * @type {Object}
         */
        this.typeCache = {};

        /**
         * Maintains a list of all instantiated models
         * @type {Object}
         * @private
         */
        this.instanceCache = {};

        // Ensure the base model is of type SchemaModel
        if (options.model && !typeOf(options.model, SchemaModel)) {
            throw new Error("options.model MUST extend Exoskelesston.Schema.Model");
        }
        // Ensure the base model is of type SchemaCollection
        if (options.collection && !typeOf(options.collection, SchemaCollection)) {
            throw new Error("options.collection MUST extend Exoskelesston.Schema.Collection");
        }
        // Ensure the base model is of type SchemaValueCollection
        if (options.valueCollection && !typeOf(options.valueCollection, SchemaValueCollection)) {
            throw new Error("options.valueCollection MUST extend Exoskelesston.Schema.ValueCollection");
        }

        // All models created by this factory will be of the provided type or SchemaModel
        this.baseModel = options.model || SchemaModel;
        // All collections created by this factory will be of the provided type or SchemaCollection
        this.baseCollection = options.collection || SchemaCollection;
        // All value collections created by this factory will be of the provided type or SchemaValueCollection
        this.baseValueCollection = options.valueCollection || SchemaValueCollection;
    };

    SchemaFactory.prototype = {

        /**
         * Registers the provided schema and optional model.
         * This method allows you to associate a Model or Collection with a
         * particular schema which is useful when you wish to provide custom
         * functionality for schemas which may be embedded in other schemas.
         * @param  {String|Object} schema Provide a schema id or a schema object
         * @param  {Exoskelesston.Schema.Model|Exoskelesston.Schema.Collection|Exoskelesston.Schema.ValueCollection} model  Provide a model or collection to associate with this schema
         * @return {this}
         */
        register: function register(schema, model) {
            var schemaId;
            if (typeof schema == 'string') {
                schemaId = schema;
            } else {
                schemaId = schema.id;
            }

            if (schemaId === undef() || schemaId === null || schemaId === '') {
                throw new Error('Cannot register a schema with no id');
            }

            if (_helpersExoskelesston2['default'].utils.isObject(schema)) {
                this.registeredSchemas[schemaId] = schema;
                delete this.parsedSchemaCache[schemaId];
            }

            if (model) {
                this.registeredSchemaTypes[schemaId] = model;
                delete this.typeCache[schemaId];
            }
        },

        /**
         * Unregister a schema
         * @param  {String} schemaId The schema id of the schema you wish to unregister
         * @return {this}
         */
        unregister: function unregister(schemaId) {
            delete this.registeredSchemas[schemaId];
            delete this.registeredSchemaTypes[schemaId];
            delete this.parsedSchemaCache[schemaId];
            delete this.typeCache[schemaId];
            return this;
        },

        /**
         * Clears all caches. Used by the tests
         * @return {this}
         */
        reset: function reset() {
            this.registeredSchemas = {};
            this.registeredSchemaTypes = {};
            this.parsedSchemaCache = {};
            this.typeCache = {};
            this.instanceCache = {};
            return this;
        },

        /**
         * Create a Model or Collection from the provided schema
         * @param  {String|Object} schema Provide the schema or the schema id of a previously refistered schema
         * @param  {Object=} model  Provides an optional model or collection which overrides the default base class.
         * @return {Object}        Returns the contructed model or collection
         */
        create: function create(schema, model) {
            if (typeof schema == 'string') {
                schema = this._get(schema);
            } else if (schema.id) {
                this.register(schema, model);
            }

            schema = this.parse(schema);

            if (schema.type && schema.type === 'array') {
                return this._createCollection(schema, undef(), model);
            }
            return this._createModel(schema, undef(), model);
        },

        /**
         * Create an instance of a Model or Collection from the provided schema
         * @param  {String|Object} schema Provide the schema or the schema id of a previously refistered schema
         * @param  {Object=} model  Provides an optional model or collection which overrides the default base class.
         * @param  {Object=} attributes [description]
         * @param  {Object=} options    [description]
         * @return {[type]}            Returns an instance of model or collection
         */
        createInstance: function createInstance(schema, model, attributes, options) {
            if (!(typeof model == 'function') && options === undef()) {
                options = attributes;
                attributes = model;
                model = undef();
            }
            var Model = this.create(schema, model);
            return new Model(attributes, options);
        },

        /**
         * @private
         */
        _get: function _get(schemaId) {

            if (schemaId === undef()) {
                return undef();
            }

            schemaId = schemaId.split('#')[0];

            var schema = this.registeredSchemas[schemaId];
            if (schema === undef()) {
                schema = this.fetch(schemaId);
                if (schema !== undef()) {
                    this.registeredSchemas[schemaId] = schema;
                } else {
                    throw new Error('Cannot find schema ' + schemaId ? schemaId : '');
                }
            }

            return schema;
        },

        /**
         * Override this method to provide a way to fetch schema from a server
         * @return {Object|undef()} Returns the schema or undef() if not found
         */
        fetch: function fetch(schemaId) {
            return undef();
        },

        /**
         * Creates an object model representation of schema by populating
         * all references and extensions ($ref's) which their corresponding
         * schemas in full.
         * @param  {Object} schema Provide the schema to parse
         * @return {Object}        Returns the parsed schema
         */
        parse: function parse(schema) {
            // Ensure that root schemas are identifiable by an id.
            // This is used for caching purposes internally
            if (schema.id === undef() || schema.id === null) {
                schema.id = JSON.stringify(schema);
            }
            return this._parse(schema, schema);
        },

        /**
         * Removed the trailing # from a schema id
         * @param  {String} schemaId Schema id
         * @return {String}          Schema id minus the trailing #
         * @private
         */
        _removeTrailingHash: function _removeTrailingHash(schemaId) {
            // Remove trailing #
            return schemaId !== undef() && schemaId.length > 1 ? schemaId.charAt(schemaId.length - 1) === '#' ? schemaId.slice(0, -1) : schemaId : undef();
        },

        /**
         * Provides the recursive parse method
         * @param  {Object} schema     Provide the schema to parse
         * @param  {Object} rootSchema Provide the root schema which corresponds to $ref="#"
         * @return {Object}            Returns the parsed schema
         * @private
         */
        _parse: function _parse(schema, rootSchema) {

            if (schema === undef() || schema === null) {
                return undef();
            }

            var schemaId = this._removeTrailingHash(schema.id);
            if (schemaId && this.parsedSchemaCache[schemaId]) {
                return this.parsedSchemaCache[schemaId];
            }

            var reference = schema['$ref'];
            if (reference && this.parsedSchemaCache[reference]) {
                return this.parsedSchemaCache[reference];
            }

            ///////////////
            // To avoid infinite loops on circular schema references, define the
            // expanded schema now (ahead of evaluating it) and add it to the cache.
            // Re-entrant calls will pull the empty object from the cache which
            // will eventually be populated as the recursions exit.
            //var expandedSchema = schema;
            if (schemaId !== undef()) {
                this.parsedSchemaCache[schemaId] = schema;
            }

            ///////////////
            // Process references early, as they can't have any other
            // fields/properties present.
            if (reference) {

                // Short circuit most common usage
                if (reference === '#') {
                    return rootSchema;
                }

                var parts = reference.split('#'),
                    referencedSchemaId = parts[0],
                    referencedFragment = parts.length > 1 ? parts[1] : '',
                    referencedSchema;
                if (referencedSchemaId === '') {
                    referencedSchema = rootSchema;
                } else {
                    var fetchedSchema = this._get(referencedSchemaId);
                    referencedSchema = this._parse(fetchedSchema, fetchedSchema);
                }

                var toReturn = referencedFragment.length > 0 ? new JSONPointer(referencedSchema).get(referencedFragment) : referencedSchema;
                // Ensure referenced fragment has an id
                if (toReturn && (toReturn.id === undef() || toReturn.id === null)) {
                    toReturn.id = reference.charAt(0) === '#' ? referencedSchema.id + reference : reference;
                }
                return toReturn;
            }

            //////////////
            // Process child properties first so that object graph completes
            // leaf nodes first
            var properties = schema.properties;
            var property;
            if (properties) {
                for (var key in properties) {
                    if (properties.hasOwnProperty(key)) {
                        property = properties[key];
                        properties[key] = this._parse(property, rootSchema);
                    }
                }
            }

            //////////////
            // TODO: "not" below is a strange one and needs thinking through
            ['items', 'anyOf', 'allOf', 'not'].forEach(function (propertyName) {
                var items = schema[propertyName];
                if (items) {
                    if (items instanceof Array) {
                        for (var i = 0, l = items.length; i < l; i++) {
                            schema[propertyName][i] = this._parse(items[i], rootSchema);
                        }
                    } else {
                        schema[propertyName] = this._parse(items, rootSchema);
                    }
                }
            }, this);

            var extensions = schema['extends'];
            if (extensions) {
                // Remove the extends attribute as we are going to perform the extension below
                schema['extends'] = undef();

                (extensions instanceof Array ? extensions : [extensions]).forEach(function (extension) {
                    var expandedExtension = this._parse(extension, rootSchema);
                    extendSchema(schema, expandedExtension);
                }, this);
            }

            return schema;
        },

        /**
         * Creates a SchemaModel from the provided Schema
         * @param  {Object} schema    Provide the schema with which to build the model
         * @param  {Object=} options   Provide any options
         * @param  {Object=} baseModel Provide a base model used to override the default
         * @return {Object}           Return a Schema Model
         * @private
         */
        _createModel: function _createModel(schema, options, baseModel) {

            var schemaId = schema.id;

            // Attempt to re-use previously constructed models
            if (schemaId && this.typeCache[schemaId]) {
                return this.typeCache[schemaId];
            }

            // Create a meaningful name for the mode using the schema.title (whitespace removed)
            var modelName = schema.title ? schema.title.replace(/[^\w]/gi, '') : 'Unknown';
            // Add SchemaModel on the end to create "{Title}SchemaModel"
            var typeLabel = modelName + 'SchemaModel';

            log('Create Custom Schema Model Type: ' + typeLabel);

            // Determine the base model starting with the baseModel passed in above,
            // next try the a model regsitered against the schemaId and
            // lastly try the SchemaFactory default baseModel
            var BaseModel = baseModel || schemaId && this.registeredSchemaTypes[schemaId] || this.baseModel;
            // Ensure the base model is of type "SchemaModel"
            if (!BaseModel.isSchemaModel) {
                throw new Error('Base model for schema ' + schemaId + ' is not a SchemaModel');
            }

            // Eval the constructor code as we want to inject the typeLabel which will allow models
            // created with this type to have meaningful names when debugging
            // Construct the new model
            var model = BaseModel.extend({
                constructor: function constructor(attributes, options) {
                    var toReturn = BaseModel.prototype.constructor.apply(this, arguments);
                    if (toReturn) {
                        return toReturn;
                    }
                    if (!options || options.validation !== false) {
                        this.validation = new ValidationModel(this.schema.properties ? Object.keys(this.schema.properties) : ['value']);
                    }
                },
                factory: this,
                // Save a reference to this factory for future use
                schema: schema,
                typeLabel: typeLabel
            }, {
                // Make the schema and typeLabel also available as static properties of the type
                schema: schema,
                typeLabel: typeLabel
            });

            // Only cache the resulting model if a we have a schema id.
            if (schemaId) {
                this.typeCache[schemaId] = model;
            }

            var defaults = {},
                schemaRelations = {},
                key,
                property;

            // Using the schema.properties definitions determine if there
            // are any relations and if so create corresponding models or collections
            if (schema.properties) {

                for (key in schema.properties) {
                    if (schema.properties.hasOwnProperty(key)) {
                        property = schema.properties[key];

                        // Extract any default values from schema and assign to model's default object
                        // Array access is required as 'default' is a reserved word.
                        if (property['default'] !== undef()) {
                            defaults[key] = property['default'];
                        }

                        // Only types "object" and "array" map to relations
                        switch (property.type) {
                            case 'object':
                                // Found a HasOne relation, so create a corresponding model
                                schemaRelations[key] = this._createModel(property, options);
                                break;
                            case 'array':
                                // Found a HasMany relation, so create a corresponding collection
                                schemaRelations[key] = this._createCollection(property, options);
                                break;
                            default:
                                break;
                        }
                    }
                }
            }

            // Assign the resulting default and relations to the model's prototype
            model.prototype.defaults = defaults;
            model.prototype.schemaRelations = schemaRelations;

            return model;
        },

        /**
         * Creates a SchemaCollection from the provided Schema
         * @param  {Object} schema    Provide the schema with which to build the model
         * @param  {Object=} options   Provide any options
         * @param  {Object=} baseCollection Provide a base collection used to override the default
         * @return {Object}           Return a Schema Collection
         * @private
         */
        _createCollection: function _createCollection(schema, options, baseCollection) {

            var schemaId = schema.id;

            // Attempt to re-use previously constructed collections
            if (schemaId && this.typeCache[schemaId] !== undef()) {
                return this.typeCache[schemaId];
            }

            // Create a meaningful name for the mode using the schema.title (whitespace removed)
            var collectionName = schema.title ? schema.title.replace(/[^\w]/gi, '') : 'Unknown',
                items = schema.items,
                model,
                typeLabel,
                BaseCollection;

            // Depending on the items.type we need to create a different base collection
            switch (items.type) {
                // Create a model based collection for object types
                case 'object':
                    // Create the model type from the items properties
                    model = this._createModel(items, options);
                    // Strip the word "Model" (5 letters) from the end of the model's schemaModelType
                    typeLabel = (schema.title ? collectionName : model.typeLabel.slice(0, -5)) + 'Collection';

                    // Determine the base collection starting with the baseCollection passed in above,
                    // next try the a collection regsitered against the schemaId and
                    // lastly try the SchemaFactory default baseCollection
                    BaseCollection = baseCollection || this.registeredSchemaTypes[schemaId] || this.baseCollection;
                    // Ensure the base collection is of type "SchemaCollection"
                    if (!BaseCollection.isSchemaCollection) {
                        throw new Error('Base collection for schema ' + schemaId + ' is not a SchemaCollection');
                    }
                    break;

                // Create a value based collection for value types
                case 'string':
                case 'number':
                case 'integer':
                case 'boolean':
                    typeLabel = (schema.title ? collectionName : items.type.charAt(0).toUpperCase() + items.type.slice(1)) + 'Collection';
                    // Determine the base collection starting with the collection regsitered against the schemaId and
                    // lastly try the SchemaFactory default baseValueCollection
                    BaseCollection = this.registeredSchemaTypes[schemaId] || this.baseValueCollection;
                    // Ensure the base collection is of type "SchemaValueCollection"
                    if (!BaseCollection.isSchemaValueCollection) {
                        throw new Error('Base collection for schema ' + schemaId + ' is not a SchemaValueCollection');
                    }
                    break;

                // These types are not currently supported
                case 'array':
                case 'any':
                case 'null':
                    throw new Error('Unsupport items type:' + items.type);

                default:
                    throw new Error('Unknown items type: ' + items.type);
            }

            log('Create Custom Schema Collection Type: ' + typeLabel);

            // Construct the new collection
            var collection = BaseCollection.extend({
                constructor: function constructor(models, options) {
                    var toReturn = BaseCollection.prototype.constructor.apply(this, arguments);
                    if (toReturn) {
                        return toReturn;
                    }
                    if (!options || options.validation !== false) {
                        this.validation = new ValidationErrorsCollection();
                    }
                },
                model: model,
                schema: schema,
                factory: this,
                // Save a reference to this factory for future use
                typeLabel: typeLabel,
                validation: undef(),
                initValidation: function initValidation() {
                    if (this.options.validate !== false) {
                        this.validation = new ValidationErrorsCollection();
                    }
                },
                newModel: function newModel(attributes, options) {
                    options = options || {};
                    options.schema = options.schema || this.schema.items;
                    return new this.model(attributes, options);
                },
                addNewModel: function addNewModel(attributes, options) {
                    var model = this.newModel(attributes, options);
                    this.add(model);
                    return model;
                }
            }, {
                // Make the schema and typeLabel also available as static properties of the type
                schema: schema,
                typeLabel: typeLabel
            });

            // Only cache the resulting collection if a we have a schema id.
            if (schemaId) {
                this.typeCache[schemaId] = collection;
            }

            return collection;
        }
    };

    /**
     * Exoskelesston.Schema.Model provides a schema aware Exoskelesston.Model
     * @constructor
     * @extends Exoskelesston.Model
     */
    var SchemaModel = Schema.Model = _helpersExoskelesston2['default'].Model.extend({

        /**
         * JSON Schema associated with this model
         * @type {Object}
         */
        schema: {},

        // Each time the Model is extended it will receive a new
        // uniqueTypeId which can later be used to differentiate types
        uniqueTypeId: _helpersExoskelesston2['default'].utils.uniqueId(),

        /**
         * Constructor function is used to provide named objects during debugging
         */
        constructor: function SchemaModel(attributes, options) {

            // IdentityMap using SchemaId
            // TODO: (MMI) Bind to dispose event in order to remove the instance from
            // the cache to avoid a memory leak
            if (attributes && attributes[this.idAttribute]) {
                var schemaId = this.schema ? this.schema.id : undef();
                if (schemaId) {
                    var cacheKey = attributes[this.idAttribute] + '|' + schemaId;
                    if (options === undef() || options.identityMap !== false) {
                        var cachedModel = this.factory.instanceCache[cacheKey];
                        if (cachedModel) {
                            return cachedModel;
                        }
                    }
                    this.factory.instanceCache[cacheKey] = this;
                }
            }

            _helpersExoskelesston2['default'].Model.prototype.constructor.call(this, attributes, options);
        },

        /**
         * Determines the server side url provided via schema links where model data can be located
         * @return {String} Returns an API endpoint URL
         */
        url: function url() {
            var schema = this.schema;
            if (schema !== undef() && schema.links !== undef()) {
                var url;
                var link;
                for (var key in schema.links) {
                    if (schema.links.hasOwnProperty(key)) {
                        link = schema.links[key];
                        if (link.rel !== undef() && link.rel === 'self') {
                            url = link.href;
                            break;
                        }
                    }
                }

                if (url !== undef()) {
                    // replace the url property on this method so that future calls
                    // don't need to re-process
                    return this.url = url.replace(/\{id\}/, encodeURIComponent(this.id));
                }
            }
            return _helpersExoskelesston2['default'].Model.prototype.url.apply(this, arguments);
        },

        /**
         * Overrides the default Exoskelesston.Model.fetch behaviour and sets the default options.parse=true
         * See https://github.com/documentcloud/backbone/issues/1843 for more details
         * @param  {Object=} options
         * @return {Object}         Returns a xhr object from the default fetch method
         */
        fetch: function fetch(options) {
            options = options || {};
            if (options.parse === void 0) {
                options.parse = true;
            }
            return _helpersExoskelesston2['default'].Model.prototype.fetch.call(this, options);
        },

        /**
         * Gets the value of a model attribute
         * @param  {String} key Provide the attribute name
         * @return {String|Number|Object}     Returns the attribute value
         */
        get: function get(key) {

            // Check if the model has a property or method for the key
            var value = this[key];
            if (value !== undef()) {
                return typeof value == 'function' ? value() : value;
            }

            var toReturn = _helpersExoskelesston2['default'].Model.prototype.get.apply(this, arguments);

            // Lazy Initialisation of relations
            // Check if the return value is an uninitialized relation
            if (toReturn === undef() || toReturn === null) {
                var RelationType = this.schemaRelations[key];
                if (RelationType !== undef()) {
                    toReturn = this.attributes[key] = new RelationType(undef(), {
                        silent: true
                    });
                }
            }

            return toReturn;
        },

        /**
         * Sets the value of an attribute
         * @param {String} key     The attribute name
         * @param {Number|String|Object} value   The attribute value
         * @param {Object=} options
         */
        set: function set(key, value, options) {
            var attributes;
            if (_helpersExoskelesston2['default'].utils.isObject(key) || key === undef()) {
                attributes = key;
                options = value;
            } else {
                attributes = {};
                attributes[key] = value;
            }

            options = options || {};
            if (options.validate === undef()) {
                options.validate = false;
            }
            attributes = this._prepareAttributes(attributes, options);

            return _helpersExoskelesston2['default'].Model.prototype.set.call(this, attributes, options);
        },

        /**
         * Interates over the provided attributes and initializes any relations
         * to their corresponding model or collection.
         * @param  {Object} attributes Attributes to initialize
         * @param  {Objects=} options
         * @return {Object}            Returns new initialized attributes
         */
        _prepareAttributes: function _prepareAttributes(attributes, options) {
            // TODO: If attributes are Models or Collections check the match the schema
            if (attributes !== undef() && this.schema !== undef() && this.schemaRelations !== undef()) {
                var attrs = {},
                    name,
                    attribute;

                for (name in attributes) {
                    if (typeof attributes.hasOwnProperty !== 'function' || attributes.hasOwnProperty(name)) {
                        attribute = attributes[name];
                        var Relation = this.schemaRelations[name];
                        if (Relation && !(attribute instanceof _helpersExoskelesston2['default'].Model || attribute instanceof _helpersExoskelesston2['default'].Collection)) {
                            attrs[name] = new Relation(attribute, Object.assign({
                                silent: true
                            }, options));
                        } else {
                            attrs[name] = attribute;
                        }
                    }
                }

                attributes = attrs;
            }
            return attributes;
        },

        /**
         * Lock used to stop circular references from causing a stack overflow
         * during toJSON serializtion
         * @type {Boolean}
         * @private
         */
        toJSONInProgress: false,

        /**
         * Creates a serializable model
         * @param  {Object=} options
         * @return {Object}  Serializable model
         */
        toJSON: function toJSON(options) {
            if (this.toJSONInProgress) {
                // This only happens when there is a circular reference
                // and the model has already been serialized previously
                return this.id ? toObject(this.idAttribute, this.id) : undef();
            }

            this.toJSONInProgress = true;

            var toReturn, name, property;
            if (this.schema) {
                for (name in this.schema.properties) {
                    if (this.schema.properties.hasOwnProperty(name)) {
                        property = this.schema.properties[name];
                        var attribute = this.attributes[name];
                        if ([undef(), null].indexOf(attribute) === -1) {
                            var value;
                            if (this.schemaRelations[name]) {
                                value = attribute.toJSON(options);
                            } else {
                                value = attribute;
                            }
                            if (value !== undef()) {
                                if (toReturn === undef()) {
                                    toReturn = {};
                                }
                                toReturn[name] = value;
                            }
                        }
                    }
                }
            } else {
                toReturn = _helpersExoskelesston2['default'].Model.prototype.toJSON.apply(this, arguments);
            }

            this.toJSONInProgress = false;

            return toReturn;
        },

        /**
         * Validates the model against the schema returning true if valid
         * @param  {Object}  options Passed to the validate method
         * @return {Boolean}         Returns true if valid, otherwise false
         */
        isValid: function isValid(options) {
            return this.validate(undef(), options) === undef();
        },

        _validate: function _validate(attributes, options) {
            var toReturn = _helpersExoskelesston2['default'].Model.prototype._validate.apply(this, arguments);
            if (options && options.validate === false) {
                return true;
            }
            return toReturn;
        },

        /**
         * Validates the model against the schema
         * @param  {Object=} options
         * @return {Array}  Returns an array of errors or undef()
         */
        validate: function validate(attributes, options) {

            if (!this.validation) {
                return;
            }

            // If no attributes are supplied, then validate all schema properties
            // by building an attributes array containing all properties.
            if (attributes === undef()) {
                attributes = {};

                for (var key in this.schema.properties) {
                    if (this.schema.properties.hasOwnProperty(key)) {
                        var value = this.schema.properties[key];
                        attributes[key] = this.attributes[key];
                    }
                }

                for (var _name in this.attributes) {
                    if (typeof this.attributes.hasOwnProperty !== 'function' || this.attributes.hasOwnProperty(_name)) {
                        if (attributes[_name] === undef()) {
                            attributes[_name] = this.attributes[_name];
                        }
                    }
                }
            }

            for (var key in this.validation.attributes) {
                if (typeof this.validation.attributes.hasOwnProperty !== 'function' || this.validation.attributes.hasOwnProperty(key)) {
                    var attribute = this.validation.attributes[key];
                    delete this.validation.attributes[key];
                    if (attribute.dispose) {
                        attribute.dispose();
                    }
                }
            }

            var errors = [];

            for (var key in attributes) {
                if (attributes.hasOwnProperty(key)) {
                    var value = attributes[key];
                    log('Validating attribute: ' + key);
                    var attributeErrors = this.validateAttribute(key, value, options);
                    if (attributeErrors.length > 0) {
                        this.validation.set(key, new ValidationErrorsCollection(attributeErrors));
                        errors.push.apply(errors, attributeErrors);
                    }
                }
            }

            // Return nothing on success
            if (errors.length > 0) {
                log('Validation failed: ', errors);
                return errors;
            }
        },

        /**
         * Validate an individual attribute
         * @param  {String} key     [description]
         * @param  {Number|String|Object} value   The value of the attribute
         * @param  {Object=} options
         * @return {Array}         Returns an array containing any validation errors
         */
        validateAttribute: function validateAttribute(key, value, options) {
            options = options || {};

            // If a property is not defined in schema and additionalProperties is not set to false, then allow anything.
            // Note: we don't currently support schema based additionalProperties, only boolean values
            if (this.schema.additionalProperties !== false && (this.schema.properties === undef() || this.schema.properties[key] === undef())) {
                return [];
            }

            var schemaProperty = this.schema.properties[key],
                errors = [];

            // Only validate Schema attributes
            if (schemaProperty === undef()) {

                if (this.schema.additionalProperties === false) {
                    errors.push({
                        level: 'error',
                        rule: 'type',
                        message: '%(property) is not allowed',
                        values: {
                            'property': key
                        }
                    });
                }
                return errors;
            }

            var schemaTitle = schemaProperty.title || key;

            // If a property is not require and is undef() then validation can be skipped
            var requiresValidation = false;

            if (schemaProperty.required === true) {
                // If the property is required, Run all validators
                requiresValidation = true;

                if (!Validators.required(value, true)) {
                    errors.push({
                        level: 'error',
                        rule: 'required',
                        message: '%(title) is a required field',
                        values: {
                            'title': schemaTitle
                        }
                    });
                }
            } else if (value !== undef()) {
                // Otherwise, only run validators if a value has been specified
                requiresValidation = true;
            }

            // Call into each necessary validator
            if (requiresValidation) {

                var isString = typeof value == 'string';
                var isNumber = !isString && typeof value == 'number';
                var isInteger = isNumber && value % 1 === 0;
                var isBoolean = !isString && !isNumber && typeof value == 'boolean';
                var isValue = isString || isNumber || isBoolean;
                var isModel = !isValue && instanceOf(value, SchemaModel);
                var isCollection = !isValue && instanceOf(value, SchemaCollection);
                var isRelation = isModel || isCollection;
                var isNull = value === undef() || value === null;

                var schemaType = schemaProperty.type;

                // Validate the type of each attribute
                switch (schemaType) {

                    case 'object':
                        if (!isModel) {
                            errors.push({
                                level: 'error',
                                rule: 'type',
                                message: '%(title) should be a model',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }
                        break;

                    case 'array':
                        if (!isCollection) {
                            errors.push({
                                level: 'error',
                                rule: 'type',
                                message: '%(title) should be a collection',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }
                        break;

                    case 'string':
                        if (!isString) {
                            errors.push({
                                level: 'error',
                                rule: 'type',
                                message: '%(title) should be a string',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }
                        break;

                    case 'number':
                        if (!isNumber) {
                            errors.push({
                                level: 'error',
                                rule: 'type',
                                message: '%(title) should be a number',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }
                        break;

                    case 'integer':
                        if (!isInteger) {
                            errors.push({
                                level: 'error',
                                rule: 'type',
                                message: '%(title) should be a integer',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }
                        break;

                    case 'boolean':
                        if (!isBoolean) {
                            errors.push({
                                level: 'error',
                                rule: 'type',
                                message: '%(title) should be a boolean',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }
                        break;

                    case 'null':
                        if (!isNull) {
                            errors.push({
                                level: 'error',
                                rule: 'type',
                                message: '%(title) should be null',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }
                        break;

                    case 'any':
                        break;

                    default:
                        throw new Error('Unknown Schema type: ' + schemaType);
                }

                if (isRelation) {

                    // Only validate relations when options.deep is specified
                    if (options.deep === true) {

                        if (isModel && !value.isValid(options)) {
                            errors.push({
                                level: 'error',
                                rule: 'relation',
                                message: '%(title) is invalid',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }

                        if (isCollection && !value.isValid(options)) {
                            errors.push({
                                level: 'error',
                                rule: 'relation',
                                message: '%(title) is invalid',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }
                    }
                } else if (isString) {

                    // maxLength validator
                    if (schemaProperty.maxLength != undef() && !Validators.maxLength(value, schemaProperty.maxLength)) {
                        errors.push({
                            level: 'error',
                            rule: 'maxLength',
                            message: '%(title) may not be longer than %(maxLength)',
                            values: {
                                'title': schemaTitle,
                                'maxLength': schemaProperty.maxLength
                            }
                        });
                    }

                    // minLength validator
                    if (schemaProperty.minLength != undef() && !Validators.minLength(value, schemaProperty.minLength)) {
                        errors.push({
                            level: 'error',
                            rule: 'minLength',
                            message: '%(title) must be longer than %(minLength)',
                            values: {
                                'title': schemaTitle,
                                'minLength': schemaProperty.minLength
                            }
                        });
                    }

                    // format validator
                    if (schemaProperty.format != undef() && !Validators.format(value, schemaProperty.format)) {
                        errors.push({
                            level: 'error',
                            rule: 'format',
                            message: '%(title) does not match %(format)',
                            values: {
                                'title': schemaTitle,
                                'format': schemaProperty.format
                            }
                        });
                    }

                    // pattern validator
                    if (schemaProperty.pattern != undef() && !Validators.pattern(value, schemaProperty.pattern)) {
                        errors.push({
                            level: 'error',
                            rule: 'pattern',
                            message: '%(title) is invalid',
                            values: {
                                'title': schemaTitle
                            }
                        });
                    }
                } else if (isNumber) {
                    // minimum validator
                    if (schemaProperty.minimum != undef() && !Validators.minimum(value, schemaProperty.minimum, schemaProperty.exclusiveMinimum)) {
                        errors.push({
                            level: 'error',
                            rule: 'minimum',
                            message: '%(title) may not be less than %(minimum)',
                            values: {
                                'title': schemaTitle,
                                'minimum': schemaProperty.minimum
                            }
                        });
                    }

                    // maximum validator
                    if (schemaProperty.maximum != undef() && !Validators.maximum(value, schemaProperty.maximum, schemaProperty.exclusiveMaximum)) {
                        errors.push({
                            level: 'error',
                            rule: 'maximum',
                            message: '%(title) may not be less than %(maximum)',
                            values: {
                                'title': schemaTitle,
                                'maximum': schemaProperty.maximum
                            }
                        });
                    }

                    // divisibleBy validator
                    if (schemaProperty.divisibleBy != undef() && !Validators.divisibleBy(value, schemaProperty.divisibleBy)) {
                        errors.push({
                            level: 'error',
                            rule: 'divisibleBy',
                            message: '%(title) is not divisible by %(divisibleBy)',
                            values: {
                                'title': schemaTitle,
                                'divisibleBy': schemaProperty.divisibleBy
                            }
                        });
                    }
                }
            }

            return errors;
        },

        isDisposed: false,
        dispose: function dispose() {
            // TODO: Add reference count functionality to avoid situation
            // where model is used multiple times
            /*if(!this.isDisposed) {
                this.isDisposed = true;
                // Call dispose on nested models and collections
                _.each(this.schemaRelations, function(relation, name) {
                    var rel = this.attributes[name];
                    if(rel !== undef() && rel.dispose) {
                        rel.dispose();
                    }
                }, this);
            }*/
        }
    }, {
        isSchemaModel: true,
        typeLabel: 'SchemaModel'
    });

    SchemaModel.extend = internalExtend;

    /**
     * Exoskelesston.Schema.Collection provides a schema aware Exoskelesston.Collection
     * @extends Exoskelesston.Collection
     */
    var SchemaCollection = Schema.Collection = _helpersExoskelesston2['default'].Collection.extend({

        /**
         * JSON Schema associated with this model
         * @type {Object}
         */
        schema: {},

        /**
         * Default collection model
         * @type {[type]}
         */
        model: SchemaModel,

        /**
         * Array contianing collection models
         * @type {Array}
         */
        models: undef(),

        /**
         * Number of items in the collection
         * @type {Number}
         */
        length: 0,

        // Each time the Collection is extended it will receive a new
        // uniqueTypeId which can later be used to differentiate types
        uniqueTypeId: _helpersExoskelesston2['default'].utils.uniqueId(),

        /**
         * Constructor function is used to provide named objects during debugging
         */
        constructor: function SchemaCollection(models, options) {
            _helpersExoskelesston2['default'].Collection.prototype.constructor.call(this, models, options);
        },

        /**
         * Validates the Collection against the schema returning true if valid
         * @param  {Object}  options Passed to the validate method
         * @return {Boolean}         Returns true if valid, otherwise false
         */
        isValid: function isValid(options) {
            return this.validate(options) === undef();
        },

        /**
         * Adds one or more models to the collection
         * @param {SchemaModel|array} models  Model or array of Models
         * @param {Object=} options
         */
        add: function add(models, options) {
            if (options && options.parse) {
                models = this.parse(models instanceof Array ? models : [models], options);
            }
            return _helpersExoskelesston2['default'].Collection.prototype.add.call(this, models, options);
        },

        /**
         * Removes one or more models from the collection
         * @param {SchemaModel|array} models  Model or array of Models
         * @param {Object=} options
         */
        remove: function remove(models, options) {
            if (options && options.parse) {
                models = this.parse(models instanceof Array ? models : [models], options);
            }
            return _helpersExoskelesston2['default'].Collection.prototype.remove.call(this, models, options);
        },

        /**
         * Resets the collection with the provided Models
         * @param {SchemaModel|array} models  Model or array of Models
         * @param {Object=} options
         */
        reset: function reset(models, options) {
            if (options && options.parse) {
                models = this.parse(models instanceof Array ? models : [models], options);
            }
            return _helpersExoskelesston2['default'].Collection.prototype.reset.call(this, models, options);
        },

        /**
         * Validates the collection against the schema
         * @param  {Object=} options
         * @return {Array}  Returns an array of errors or undef()
         */
        validate: function validate(options) {

            if (!this.validation) {
                return;
            }

            var schema = this.schema;
            var errors = [];

            if (schema.minItems != undef() && !Validators.minItems(this.models, schema.minItems)) {
                errors.push({
                    level: 'error',
                    rule: 'minItems',
                    message: 'Minimum of %(count) %(title) required',
                    values: {
                        'title': schema.title,
                        'count': schema.minItems
                    }
                });
            }

            if (schema.maxItems != undef() && !Validators.maxItems(this.models, schema.maxItems)) {
                errors.push({
                    level: 'error',
                    rule: 'maxItems',
                    message: 'Maximum of %(count) %(title) allowed',
                    values: {
                        'title': schema.title,
                        'count': schema.maxItems
                    }
                });
            }

            if (schema.uniqueItems != undef() && !Validators.uniqueItems(this.models, function (model) {
                return model.cid;
            })) {
                errors.push({
                    level: 'error',
                    rule: 'uniqueItems',
                    message: 'Duplicate %(title) are not allowed',
                    values: {
                        'title': schema.title
                    }
                });
            }

            if (options && options.deep === true) {
                errors.push.apply(errors, this._validateModels(options));
            }

            this.validation.reset(errors);

            if (errors.length > 0) {
                return errors;
            }
        },

        /**
         * Validates the collections models
         * @param  {Object=} options
         * @return {Array}  Returns an empty array or an array of errors
         * @private
         */
        _validateModels: function _validateModels(options) {
            var errors = [];
            var hasInvalid = false;
            var model;
            var key;

            for (key in this.models) {
                model = this.models[key];
                if (this.models.hasOwnProperty(key) && !model.isValid(options)) {
                    hasInvalid = true;
                    break;
                }
            }

            if (hasInvalid) {
                errors.push({
                    level: 'error',
                    rule: 'relation',
                    message: '%(title) is invalid',
                    values: {
                        'title': this.schema.title
                    }
                });
            }

            return errors;
        },

        /**
         * Lock used to stop circular references from causing a stack overflow
         * during toJSON serializtion
         * @type {Boolean}
         * @private
         */
        toJSONInProgress: false,

        /**
         * Creates a serializable array of models from the collection
         * @param  {Object=} options
         * @return {Array}  array of model objects that have themselves been passed through toJSON
         */
        toJSON: function toJSON(options) {
            if (this.toJSONInProgress) {
                // This only happens when there is a circular reference
                // and the model has already been serialized previously
                return undef();
            }
            this.toJSONInProgress = true;

            var toReturn;
            if (this.schema) {
                var models = this.models,
                    model,
                    key;
                toReturn = [];

                for (key in models) {
                    if (models.hasOwnProperty(key)) {
                        model = models[key];
                        var value = model.toJSON(options);
                        if (value !== undef()) {
                            toReturn.push(value);
                        }
                    }
                }
            } else {
                toReturn = _helpersExoskelesston2['default'].Collection.prototype.toJSON.apply(this, arguments);
            }

            this.toJSONInProgress = false;

            return toReturn;
        },

        /**
         * Lock which allows dispose to be called multiple times without disposing mutliple times
         * during toJSON serializtion
         * @type {Boolean}
         * @private
         */
        isDisposed: false,

        /**
         * Dispose the collection and all colletions models
         */
        dispose: function dispose() {
            // TODO: Add reference count functionality to avoid situation
            // where collection is used multiple times
            /*if(!this.isDisposed) {
                this.isDisposed = true;
                _.each(this.models, function(model) {
                    if(model.dispose) {
                        model.dispose();
                    }
                });
            }*/
        }

    }, {
        isSchemaCollection: true,
        typeLabel: 'SchemaCollection'
    });
    SchemaCollection.extend = internalExtend;

    /**
     * Exoskelesston.Schema.ValueCollection provides a Exoskelesston.Schema.Collection that contains simple value types rather than models
     * @constructor
     * @extends Exoskelesston.Collection
     */
    var SchemaValueCollection = Schema.ValueCollection = SchemaCollection.extend({

        /**
         * declare the model as undef() as we don't use models in this implementation
         * @type {[type]}
         */
        model: undef(),

        /**
         * Array used to contain the collections values
         * @type {Array}
         */
        models: [],

        /**
         * A hash object which is used to uniquely identify values already added to the collection
         * @type {Object}
         * @private
         */
        valueMaps: {},

        // Each time the Collection is extended it will receive a new
        // uniqueTypeId which can later be used to differentiate types
        uniqueTypeId: _helpersExoskelesston2['default'].utils.uniqueId(),

        /**
         * Constructor function is used to provide named objects during debugging
         */
        constructor: function SchemaValueCollection(values, options) {
            return SchemaCollection.prototype.constructor.apply(this, arguments);
        },

        /**
         * Add one or more values to the collection
         * @param {Number|String|Array} values  Value or array of values to added to the collection
         * @param {Object=} options
         * @return this
         */
        add: function add(values, options) {
            var key, value;

            values = this.schema.uniqueItems ? _helpersExoskelesston2['default'].utils.uniq(values) : values;

            for (key in values) {
                if (values.hasOwnProperty(key)) {
                    value = values[key];
                    if (!this.schema.uniqueItems || !this.valueMaps[value]) {
                        this.valueMaps[value] = true;
                        this.models.push(value);
                        if (!options || !options.silent) {
                            this.trigger('add', value, options);
                        }
                        this.length++;
                    }
                }
            }

            return this;
        },

        /**
         * Remove one or more values to the collection
         * @param {Number|String|Array} values  Value or array of values to added to the collection
         * @param {Object=} options
         * @return this
         */
        remove: function remove(values, options) {

            var key, value;

            values = this.schema.uniqueItems ? _helpersExoskelesston2['default'].utils.uniq(values) : values;

            for (key in values) {
                if (values.hasOwnProperty(key)) {
                    value = values[key];
                    if (this.valueMaps[value]) {
                        delete this.valueMaps[value];
                        var index = undefined;
                        while (index = this.indexOf(value) >= 0) {
                            this.models.splice(index, 1);
                            this.length--;
                            if (!options.silent) {
                                this.trigger('remove', value, options);
                            }
                        }
                    }
                }
            }

            return this;
        },

        /**
         * Resets the collection with the provided values
         * @param {Number|String|Array} values  Value or array of values
         * @param {Object=} options
         * @return this
         */
        reset: function reset(values, options) {

            var key, value;

            this.models = this.schema.uniqueItems ? _helpersExoskelesston2['default'].utils.uniq(values) : values;
            this.length = this.models.length;
            this.valueMaps = {};

            for (key in this.models) {
                if (this.models.hasOwnProperty(key)) {
                    value = this.models[key];
                    this.valueMaps[value] = true;
                }
            }

            if (!options.silent) {
                this.trigger('reset', this, options);
            }
            return this;
        },

        _prepareModel: function _prepareModel(value, options) {
            return value;
        },

        _validateModels: function _validateModels(options) {

            var errors = [];

            var validator;
            switch (this.schema.type) {
                case 'string':
                    validator = function isString(val) {
                        return typeof val === 'string';
                    };
                    break;
                case 'integer':
                    validator = function (object) {
                        return typeof n === 'number' && n % 1 === 0;
                    };
                    break;
                case 'number':
                    validator = function isNumber(val) {
                        return typeof val === 'number';
                    };
                    break;
                default:
                    break;
            }

            if (validator) {
                var hasInvalid = false;
                var model;
                var key;

                for (key in this.models) {
                    model = this.models[key];
                    if (this.models.hasOwnProperty(key) && !validator(model)) {
                        hasInvalid = true;
                        break;
                    }
                }

                if (hasInvalid) {
                    errors.push({
                        level: 'error',
                        rule: 'value',
                        message: '%(title) is invalid',
                        values: {
                            'title': schema.title
                        }
                    });
                }
            }

            return errors;
        },

        pluck: function pluck() {
            throw new Error('Not Supported');
        },

        getByCid: function getByCid() {
            throw new Error('Not Supported');
        },

        toJSON: function toJSON(options) {
            return this.models.length > 0 ? this.models.slice() : undef();
        }
    }, {
        isSchemaCollection: false,
        isSchemaValueCollection: true,
        typeLabel: 'SchemaValueCollection'
    });

    SchemaValueCollection.extend = internalExtend;

    /**
     * Severity Level for Errors
     * @type {number}
     */
    var errorLevels = {
        'error': 3,
        'warn': 2,
        'info': 1
    };

    var ValidationErrorsCollection = _helpersExoskelesston2['default'].Collection.extend({
        constructor: function ValidationErrorsCollection(models, options) {
            _helpersExoskelesston2['default'].Collection.prototype.constructor.apply(this, arguments);
            this.on('add', this.fireChange, this);
            this.on('remove', this.fireChange, this);
            this.on('change', this.fireChange, this);
        },

        fireChange: function fireChange(attribute) {
            this.trigger('change:maxLevel');
        },

        maxLevel: function maxLevel() {

            var key, model;

            // Short circuit
            if (this.models.length === 0) {
                return undef();
            }

            var levelString,
                level = 0;

            for (key in this.models) {
                if (this.models.hasOwnProperty(key)) {
                    model = this.models[key];
                    if (errorLevels[model.get('level')] > level) {
                        level = errorLevels[model.get('level')];
                        levelString = model.get('level');
                    }
                }
            }

            return levelString;
        },

        dispose: function dispose() {
            this.off();
            this.trigger('dispose');
        }

    });

    var ValidationModel = _helpersExoskelesston2['default'].Model.extend({
        constructor: function ValidationModel(attributes, options) {
            _helpersExoskelesston2['default'].Model.prototype.constructor.apply(this, arguments);
        },

        setError: function setError(key, errors) {
            var previous = this.get(key);
            if (previous && previous.dispose) {
                previous.dispose();
            }
            this.set(key, new ValidationErrorsCollection(errors));
        }
    });

    /**
     * Provides inheritance style Schema "extends" functionality
     * @param  {Object} target    Schema object which is being extended
     * @param  {Object} extension Schema properties to apply to target
     * @return {Object}           Returns the modified target schema
     */

    function extendSchema(target, extension) {
        for (var property in extension) {
            // Don't extend "id" properties
            //if(extension.hasOwnProperty(property) && property != 'id') {
            if (extension.hasOwnProperty(property)) {

                var extensionProperty = extension[property];
                if (extensionProperty !== undef()) {

                    var targetProperty = target[property];

                    // Don't process equal objects
                    if (targetProperty === extensionProperty) {
                        continue;
                    }

                    // If the target does not exist, then copy (by reference) the extension property directly
                    if (targetProperty === undef()) {
                        target[property] = extensionProperty;
                    } else {
                        // the target exists and is an object, then merge it
                        if (_helpersExoskelesston2['default'].utils.isObject(targetProperty)) {
                            extendSchema(targetProperty, extensionProperty);
                        }
                    }
                }
            }
        }
        return target;
    }

    /**
     * Cache object for RegExps
     * @type {Object}
     */
    var regexs = {};

    /**
     * Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
     * © 2011 Colin Snover <http://zetafleet.com>
     * Released under MIT license.
     */
    var numericKeys = [1, 4, 5, 6, 7, 10, 11];

    function DateParse(date) {
        var timestamp,
            struct,
            minutesOffset = 0;

        // ES5 §15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
        // before falling back to any implementation-specific date parsing, so that’s what we do, even if native
        // implementations could be faster
        //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 ±    10 tzHH    11 tzmm
        if (struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date)) {
            // avoid NaN timestamps caused by “undef()” values being passed to Date.UTC
            for (var i = 0, k; k = numericKeys[i]; ++i) {
                struct[k] = +struct[k] || 0;
            }

            // allow undef() days and months
            struct[2] = (+struct[2] || 1) - 1;
            struct[3] = +struct[3] || 1;

            if (struct[8] !== 'Z' && struct[9] !== undef()) {
                minutesOffset = struct[10] * 60 + struct[11];

                if (struct[9] === '+') {
                    minutesOffset = 0 - minutesOffset;
                }
            }

            timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
        } else {
            timestamp = Date.parse ? Date.parse(date) : NaN;
        }

        return timestamp;
    }

    /**
     * Various Validators
     * @type {Object}
     */
    var Validators = {
        required: function required(value, _required) {
            _required = _required || true;

            if (_required && (value === undef() || value === '')) {
                return false;
            } else if (value instanceof Array && value.length === 0) {
                return false;
            } else {
                return true;
            }
        },

        minLength: function minLength(value, _minLength) {
            if (value === undef() || value.length < _minLength) {
                return false;
            } else {
                return true;
            }
        },

        maxLength: function maxLength(value, _maxLength) {
            if (value === undef()) {
                return true;
            } else if (value.length > _maxLength) {
                return false;
            } else {
                return true;
            }
        },

        minimum: function minimum(value, _minimum, exclusiveMinimum) {
            if (isNaN(value)) {
                return false;
            }
            return exclusiveMinimum === true ? parseInt(value, 10) > _minimum : parseInt(value, 10) >= _minimum;
        },

        maximum: function maximum(value, _maximum, exclusiveMaximum) {
            if (isNaN(value)) {
                return false;
            }
            return exclusiveMaximum === true ? parseInt(value, 10) < _maximum : parseInt(value, 10) <= _maximum;
        },

        divisibleBy: function divisibleBy(value, _divisibleBy) {
            if (isNaN(value) || _divisibleBy === 0) {
                return false;
            }
            return value % _divisibleBy === 0;
        },

        format: function format(value, _format) {
            switch (_format) {

                case 'color':
                    return this.pattern(value, "^#[A-F0-9]{6}|aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|honeydew|hotpink|indianred |indigo |ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgrey|lightgreen|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen$");

                case 'style':
                    // TODO:
                    return true;

                case 'phone':
                    // from http://blog.stevenlevithan.com/archives/validate-phone-number
                    return this.pattern(value, "^\\+(?:[0-9]\\x20?){6,14}[0-9]$");

                case 'uri':
                    // from http://snipplr.com/view/6889/
                    return this.pattern(value, "^(?:https?|ftp)://.+\\..+$");

                case 'email':
                    // from http://fightingforalostcause.net/misc/2006/compare-email-regex.php
                    return this.pattern(value, '^[-a-z0-9~!$%^&*_=+}{\'?]+(\\.[-a-z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\\.[-a-z0-9_]+)*\\.(aero|arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|travel|mobi|[a-z][a-z])|([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}))(:[0-9]{1,5})?$');

                case 'ip-address':
                    return this.pattern(value, "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}");

                case 'ipv6':
                    return this.pattern(value, "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}");

                // TODO
                // case *various mime-types*
                case 'date-time':
                case 'date':
                case 'time':
                case 'utc-millisec':
                case 'regex':
                case 'street-address':
                case 'locality':
                case 'region':
                case 'postal-code':
                case 'country':
                    log('WARNING - Validation not implemented for format:' + _format);
                    return true;

                default:
                    log('WARNING - Unknown validation format:' + _format);
                    return true;
            }
        },

        pattern: function pattern(value, _pattern) {
            var regex = regexs[_pattern];

            if (regex === undef()) {
                regex = new RegExp(_pattern, "i");
                regexs[_pattern] = regex;
            }

            return regex.test(value);
        },

        minItems: function minItems(items, _minItems) {
            return items.length >= _minItems;
        },

        maxItems: function maxItems(items, _maxItems) {
            return items.length <= _maxItems;
        },

        uniqueItems: function uniqueItems(items, transform) {
            if (transform === undef()) {
                transform = function (a) {
                    return a;
                };
            }
            var uniqueItems = {};
            var hasUniqueItems = true;
            var key, value, id;

            for (key in items) {
                if (items.hasOwnProperty(key)) {
                    value = items[key];
                    id = transform(value);

                    if (uniqueItems[id]) {
                        hasUniqueItems = false;
                    }

                    uniqueItems[id] = id;
                }
            }

            return hasUniqueItems;
        }
    };

    /**
     * Provides access to otherwise private objects. Used from tests
     * @type {Object}
     */
    Schema.TestHelper = {
        Validators: Validators,
        JSONPointer: JSONPointer
    };

    return Schema;
}).call(undefined);

_helpersEnvironment.getGlobalObject().FormellSchema = FormellSchema;
exports['default'] = FormellSchema;
module.exports = exports['default'];
},{"./helpers/environment":6,"./helpers/exoskelesston":7}],6:[function(require,module,exports){
(function (global){
'use strict';

exports.__esModule = true;
exports.getGlobalObject = getGlobalObject;

function getGlobalObject() {
	// Workers don�t have `window`, only `self`
	if (typeof self !== 'undefined') {
		return self;
	}
	if (typeof global !== 'undefined') {
		return global;
	}
	// Not all environments allow eval and Function
	// Use only as a last resort:
	return new Function('return this')();
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],7:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.name = name;
exports.tagName = tagName;
exports.el = el;
exports.$el = $el;
exports.id = id;
exports.className = className;
exports.events = events;
exports.on = on;
exports.template = template;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _exoskeleton = require('exoskeleton');

var _exoskeleton2 = _interopRequireDefault(_exoskeleton);

var _backboneNativeview = require('backbone.nativeview');

var _backboneNativeview2 = _interopRequireDefault(_backboneNativeview);

var _backboneNativeajax = require('backbone.nativeajax');

var _backboneNativeajax2 = _interopRequireDefault(_backboneNativeajax);

var _string = require('./string');

_exoskeleton2['default'].View = _backboneNativeview2['default'];
_exoskeleton2['default'].View.prototype.toString = function toString() {
	return this.name;
};
_exoskeleton2['default'].ajax = _backboneNativeajax2['default'];

_exoskeleton2['default'].utils.isObject = function (obj) {
	var type = typeof obj;
	return type === 'function' || type === 'object' && !!obj;
};

_exoskeleton2['default'].utils.uniq = function (arr) {

	if (!arr) {
		arr = [];
	} else {
		arr = arr.filter(function (item, index) {
			return arr.indexOf(item) == index;
		});
	}

	return arr;
};

exports['default'] = _exoskeleton2['default'];

//decorators

function name(value) {
	return function decorator(target) {
		target.prototype.name = value;
	};
}

function tagName(value) {
	return function decorator(target) {
		target.prototype.tagName = value;
	};
}

function el(value) {
	return function decorator(target) {
		target.prototype.el = value;
	};
}

function $el(value) {
	return function decorator(target) {
		target.prototype.$el = value;
	};
}

function id(value) {
	return function decorator(target) {
		target.prototype.id = value;
	};
}

function className(value) {
	return function decorator(target) {
		target.prototype.className = value;
	};
}

function events(value) {
	return function decorator(target) {
		target.prototype.events = value;
	};
}

function on(eventName) {
	return function (target, name, descriptor) {
		if (!target.events) {
			target.events = {};
		}
		if (typeof target.events == 'function') {
			throw new Error('The on decorator is not compatible with an events method');
			return;
		}
		if (!eventName) {
			throw new Error('The on decorator requires an eventName argument');
		}
		target.events[eventName] = name;
		return descriptor;
	};
}

function template(value) {
	return function decorator(target) {
		target.prototype.template = _string.generateTemplateString(value);
	};
}
},{"./string":8,"backbone.nativeajax":1,"backbone.nativeview":2,"exoskeleton":3}],8:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.createUID = createUID;

function createUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0,
		    v = c == 'x' ? r : r & 0x3 | 0x8;
		return v.toString(16);
	});
}

var generateTemplateString = (function () {
	var cache = {};

	function generateTemplate(template) {

		var fn = cache[template];

		if (!fn) {

			// Replace ${expressions} (etc) with ${map.expressions}.
			var sanitized = template.replace(/\$\{([\s]*[^;\s]+[\s]*)\}/g, function (_, match) {
				return '${map.' + match.trim() + '}';
			})
			// Afterwards, replace anything that's not ${map.expressions}' (etc) with a blank string.
			.replace(/(\$\{(?!map\.)[^}]+\})/g, '');

			fn = Function('map', 'return `' + sanitized + '`');
		}

		return fn;
	};

	return generateTemplate;
})();
exports.generateTemplateString = generateTemplateString;
},{}],9:[function(require,module,exports){
/**
 * Copyright (c) 2010 Maxim Vasiliev
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * @author Maxim Vasiliev
 * Date: 09.09.2010
 * Time: 19:02:33
 */

'use strict';

(function (root, factory) {
	if (typeof exports !== 'undefined' && typeof module !== 'undefined' && module.exports) {
		// NodeJS
		module.exports = factory();
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(factory);
	} else {
		// Browser globals
		root.form2js = factory();
	}
})(undefined, function () {
	"use strict";

	/**
  * Returns form values represented as Javascript object
  * "name" attribute defines structure of resulting object
  *
  * @param rootNode {Element|String} root form element (or it's id) or array of root elements
  * @param delimiter {String} structure parts delimiter defaults to '.'
  * @param skipEmpty {Boolean} should skip empty text values, defaults to true
  * @param nodeCallback {Function} custom function to get node value
  * @param useIdIfEmptyName {Boolean} if true value of id attribute of field will be used if name of field is empty
  */
	function form2js(rootNode, delimiter, skipEmpty, nodeCallback, useIdIfEmptyName, getDisabled) {
		getDisabled = getDisabled ? true : false;
		if (typeof skipEmpty == 'undefined' || skipEmpty == null) skipEmpty = true;
		if (typeof delimiter == 'undefined' || delimiter == null) delimiter = '.';
		if (arguments.length < 5) useIdIfEmptyName = false;

		rootNode = typeof rootNode == 'string' ? document.getElementById(rootNode) : rootNode;

		var formValues = [],
		    currNode,
		    i = 0;

		/* If rootNode is array - combine values */
		if (rootNode.constructor == Array || typeof NodeList != "undefined" && rootNode.constructor == NodeList) {
			while (currNode = rootNode[i++]) {
				formValues = formValues.concat(getFormValues(currNode, nodeCallback, useIdIfEmptyName, getDisabled));
			}
		} else {
			formValues = getFormValues(rootNode, nodeCallback, useIdIfEmptyName, getDisabled);
		}

		return processNameValues(formValues, skipEmpty, delimiter);
	}

	/**
  * Processes collection of { name: 'name', value: 'value' } objects.
  * @param nameValues
  * @param skipEmpty if true skips elements with value == '' or value == null
  * @param delimiter
  */
	function processNameValues(nameValues, skipEmpty, delimiter) {
		var result = {},
		    arrays = {},
		    i,
		    j,
		    k,
		    l,
		    value,
		    nameParts,
		    currResult,
		    arrNameFull,
		    arrName,
		    arrIdx,
		    namePart,
		    name,
		    _nameParts;

		for (i = 0; i < nameValues.length; i++) {
			value = nameValues[i].value;

			if (skipEmpty && (value === '' || value === null)) continue;

			name = nameValues[i].name;
			_nameParts = name.split(delimiter);
			nameParts = [];
			currResult = result;
			arrNameFull = '';

			for (j = 0; j < _nameParts.length; j++) {
				namePart = _nameParts[j].split('][');
				if (namePart.length > 1) {
					for (k = 0; k < namePart.length; k++) {
						if (k == 0) {
							namePart[k] = namePart[k] + ']';
						} else if (k == namePart.length - 1) {
							namePart[k] = '[' + namePart[k];
						} else {
							namePart[k] = '[' + namePart[k] + ']';
						}

						arrIdx = namePart[k].match(/([a-z_]+)?\[([a-z_][a-z0-9_]+?)\]/i);
						if (arrIdx) {
							for (l = 1; l < arrIdx.length; l++) {
								if (arrIdx[l]) nameParts.push(arrIdx[l]);
							}
						} else {
							nameParts.push(namePart[k]);
						}
					}
				} else nameParts = nameParts.concat(namePart);
			}

			for (j = 0; j < nameParts.length; j++) {
				namePart = nameParts[j];

				if (namePart.indexOf('[]') > -1 && j == nameParts.length - 1) {
					arrName = namePart.substr(0, namePart.indexOf('['));
					arrNameFull += arrName;

					if (!currResult[arrName]) currResult[arrName] = [];
					currResult[arrName].push(value);
				} else if (namePart.indexOf('[') > -1) {
					arrName = namePart.substr(0, namePart.indexOf('['));
					arrIdx = namePart.replace(/(^([a-z_]+)?\[)|(\]$)/gi, '');

					/* Unique array name */
					arrNameFull += '_' + arrName + '_' + arrIdx;

					/*
      * Because arrIdx in field name can be not zero-based and step can be
      * other than 1, we can't use them in target array directly.
      * Instead we're making a hash where key is arrIdx and value is a reference to
      * added array element
      */

					if (!arrays[arrNameFull]) arrays[arrNameFull] = {};
					if (arrName != '' && !currResult[arrName]) currResult[arrName] = [];

					if (j == nameParts.length - 1) {
						if (arrName == '') {
							currResult.push(value);
							arrays[arrNameFull][arrIdx] = currResult[currResult.length - 1];
						} else {
							currResult[arrName].push(value);
							arrays[arrNameFull][arrIdx] = currResult[arrName][currResult[arrName].length - 1];
						}
					} else {
						if (!arrays[arrNameFull][arrIdx]) {
							if (/^[0-9a-z_]+\[?/i.test(nameParts[j + 1])) currResult[arrName].push({});else currResult[arrName].push([]);

							arrays[arrNameFull][arrIdx] = currResult[arrName][currResult[arrName].length - 1];
						}
					}

					currResult = arrays[arrNameFull][arrIdx];
				} else {
					arrNameFull += namePart;

					if (j < nameParts.length - 1) /* Not the last part of name - means object */
						{
							if (!currResult[namePart]) currResult[namePart] = {};
							currResult = currResult[namePart];
						} else {
						currResult[namePart] = value;
					}
				}
			}
		}

		return result;
	}

	function getFormValues(rootNode, nodeCallback, useIdIfEmptyName, getDisabled) {
		var result = extractNodeValues(rootNode, nodeCallback, useIdIfEmptyName, getDisabled);
		return result.length > 0 ? result : getSubFormValues(rootNode, nodeCallback, useIdIfEmptyName, getDisabled);
	}

	function getSubFormValues(rootNode, nodeCallback, useIdIfEmptyName, getDisabled) {
		var result = [],
		    currentNode = rootNode.firstChild;

		while (currentNode) {
			result = result.concat(extractNodeValues(currentNode, nodeCallback, useIdIfEmptyName, getDisabled));
			currentNode = currentNode.nextSibling;
		}

		return result;
	}

	function extractNodeValues(node, nodeCallback, useIdIfEmptyName, getDisabled) {
		if (node.disabled && !getDisabled) return [];

		var callbackResult,
		    fieldValue,
		    result,
		    fieldName = getFieldName(node, useIdIfEmptyName);

		callbackResult = nodeCallback && nodeCallback(node);

		if (callbackResult && callbackResult.name) {
			result = [callbackResult];
		} else if (fieldName != '' && node.nodeName.match(/INPUT|TEXTAREA/i)) {
			fieldValue = getFieldValue(node, getDisabled);
			if (null === fieldValue) {
				result = [];
			} else {
				result = [{ name: fieldName, value: fieldValue }];
			}
		} else if (fieldName != '' && node.nodeName.match(/SELECT/i)) {
			fieldValue = getFieldValue(node, getDisabled);
			result = [{ name: fieldName.replace(/\[\]$/, ''), value: fieldValue }];
		} else {
			result = getSubFormValues(node, nodeCallback, useIdIfEmptyName, getDisabled);
		}

		return result;
	}

	function getFieldName(node, useIdIfEmptyName) {
		if (node.name && node.name != '') return node.name;else if (useIdIfEmptyName && node.id && node.id != '') return node.id;else return '';
	}

	function getFieldValue(fieldNode, getDisabled) {
		if (fieldNode.disabled && !getDisabled) return null;

		switch (fieldNode.nodeName) {
			case 'INPUT':
			case 'TEXTAREA':
				switch (fieldNode.type.toLowerCase()) {
					case 'radio':
						if (fieldNode.checked && fieldNode.value === "false") return false;
					case 'checkbox':
						if (fieldNode.checked && fieldNode.value === "true") return true;
						if (!fieldNode.checked && fieldNode.value === "true") return false;
						if (fieldNode.checked) return fieldNode.value;
						break;

					case 'button':
					case 'reset':
					case 'submit':
					case 'image':
						return '';
						break;

					default:
						return fieldNode.value;
						break;
				}
				break;

			case 'SELECT':
				return getSelectedOptionValue(fieldNode);
				break;

			default:
				break;
		}

		return null;
	}

	function getSelectedOptionValue(selectNode) {
		var multiple = selectNode.multiple,
		    result = [],
		    options,
		    i,
		    l;

		if (!multiple) return selectNode.value;

		for (options = selectNode.getElementsByTagName("option"), i = 0, l = options.length; i < l; i++) {
			if (options[i].selected) result.push(options[i].value);
		}

		return result;
	}

	return form2js;
});
},{}],10:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _createDecoratedClass = (function () { function defineProperties(target, descriptors, initializers) { for (var i = 0; i < descriptors.length; i++) { var descriptor = descriptors[i]; var decorators = descriptor.decorators; var key = descriptor.key; delete descriptor.key; delete descriptor.decorators; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor || descriptor.initializer) descriptor.writable = true; if (decorators) { for (var f = 0; f < decorators.length; f++) { var decorator = decorators[f]; if (typeof decorator === 'function') { descriptor = decorator(target, key, descriptor) || descriptor; } else { throw new TypeError('The decorator for method ' + descriptor.key + ' is of the invalid type ' + typeof decorator); } } if (descriptor.initializer !== undefined) { initializers[key] = descriptor; continue; } } Object.defineProperty(target, key, descriptor); } } return function (Constructor, protoProps, staticProps, protoInitializers, staticInitializers) { if (protoProps) defineProperties(Constructor.prototype, protoProps, protoInitializers); if (staticProps) defineProperties(Constructor, staticProps, staticInitializers); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _libsHelpersExoskelesston = require('../../libs/helpers/exoskelesston');

var _libsHelpersExoskelesston2 = _interopRequireDefault(_libsHelpersExoskelesston);

var _itemsFormSchemaItemFactory = require('./items/form-schema-item-factory');

var _itemsFormSchemaItemFactory2 = _interopRequireDefault(_itemsFormSchemaItemFactory);

var _libsVendorForm2js = require('../../libs/vendor/form2js');

var _libsVendorForm2js2 = _interopRequireDefault(_libsVendorForm2js);

var FormSchemaView = (function (_Exoskeleton$View) {
	_inherits(FormSchemaView, _Exoskeleton$View);

	function FormSchemaView() {
		_classCallCheck(this, _FormSchemaView);

		_Exoskeleton$View.apply(this, arguments);
	}

	FormSchemaView.prototype.initialize = function initialize() {
		var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

		this.options = options;
	};

	FormSchemaView.prototype.addSubmit = function addSubmit() {

		if (!this.el.querySelector('[type="submit"]')) {

			var submitButton = document.createElement('button');
			submitButton.setAttribute('type', 'submit');
			// @todo i18n/l10n
			submitButton.innerHTML = 'OK';
			this.el.appendChild(submitButton);

			this.undelegateEvents();
			this.delegateEvents();
		}
	};

	FormSchemaView.prototype.serialize = function serialize() {};

	FormSchemaView.prototype.addOne = function addOne(name, property) {
		var ItemView = _itemsFormSchemaItemFactory2['default'].create(property.type);
		var view = new ItemView({
			data: {
				name: name,
				properties: property
			}
		});

		// @todo implement appendChild if wrapper is present
		// wrapperView.appendChild(...);
		this.el.appendChild(view.render().el);
	};

	FormSchemaView.prototype.addAll = function addAll() {

		var properties = this.options.data.properties;

		console.log(this.options.data);

		for (var key in properties) {

			if (properties.hasOwnProperty(key)) {
				this.addOne(key, properties[key]);
			}
		}
	};

	FormSchemaView.prototype.render = function render() {

		this.el.setAttribute('method', this.options.method);
		this.el.setAttribute('action', this.options.action);

		this.addAll();
		this.addSubmit();
		return this;
	};

	_createDecoratedClass(FormSchemaView, [{
		key: 'submit',
		decorators: [_libsHelpersExoskelesston.on('submit')],
		value: function submit(evt) {
			evt.preventDefault();
			console.log(this + '.submit()', '' + JSON.stringify(_libsVendorForm2js2['default'](this.el)));
		}
	}]);

	var _FormSchemaView = FormSchemaView;
	FormSchemaView = _libsHelpersExoskelesston.tagName('form')(FormSchemaView) || FormSchemaView;
	FormSchemaView = _libsHelpersExoskelesston.name('FormSchemaView')(FormSchemaView) || FormSchemaView;
	return FormSchemaView;
})(_libsHelpersExoskelesston2['default'].View);

;

exports['default'] = FormSchemaView;
module.exports = exports['default'];
},{"../../libs/helpers/exoskelesston":7,"../../libs/vendor/form2js":9,"./items/form-schema-item-factory":12}],11:[function(require,module,exports){
'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _libsHelpersExoskelesston = require('../../../libs/helpers/exoskelesston');

var _libsHelpersExoskelesston2 = _interopRequireDefault(_libsHelpersExoskelesston);

var FormSchemaBaseView = (function (_Exoskeleton$View) {
	_inherits(FormSchemaBaseView, _Exoskeleton$View);

	function FormSchemaBaseView() {
		_classCallCheck(this, _FormSchemaBaseView);

		_Exoskeleton$View.apply(this, arguments);
	}

	FormSchemaBaseView.prototype.initialize = function initialize() {
		var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

		this.options = options;
		this.data = options.data;
		this.props = options.data.properties;

		this.el.name = this.data.name;

		if (this.props.required) {
			this.el.setAttribute('required', 'required');
		}
	};

	FormSchemaBaseView.prototype.render = function render() {

		return this;
	};

	var _FormSchemaBaseView = FormSchemaBaseView;
	FormSchemaBaseView = _libsHelpersExoskelesston.name('items/FormSchemaBaseView')(FormSchemaBaseView) || FormSchemaBaseView;
	return FormSchemaBaseView;
})(_libsHelpersExoskelesston2['default'].View);

;

exports['default'] = FormSchemaBaseView;
module.exports = exports['default'];
},{"../../../libs/helpers/exoskelesston":7}],12:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _formSchemaStringView = require('./form-schema-string-view');

var _formSchemaStringView2 = _interopRequireDefault(_formSchemaStringView);

var FormSchemaItemFactory = (function () {
	function FormSchemaItemFactory() {
		_classCallCheck(this, FormSchemaItemFactory);
	}

	FormSchemaItemFactory.prototype.create = function create(type) {

		if (this.typesMapping[type]) {

			return this.typesMapping[type];
		}

		throw new Error('Type ' + type + ' is not implemented.');
	};

	_createClass(FormSchemaItemFactory, [{
		key: 'typesMapping',
		get: function get() {

			return {
				string: _formSchemaStringView2['default']
			};
		}
	}]);

	return FormSchemaItemFactory;
})();

var formSchemaItemFactory = new FormSchemaItemFactory();

exports['default'] = formSchemaItemFactory;
module.exports = exports['default'];
},{"./form-schema-string-view":13}],13:[function(require,module,exports){
'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _formSchemaBaseView = require('./form-schema-base-view');

var _formSchemaBaseView2 = _interopRequireDefault(_formSchemaBaseView);

var _libsHelpersExoskelesston = require('../../../libs/helpers/exoskelesston');

var FormSchemaStringView = (function (_FormSchemaBaseView) {
	_inherits(FormSchemaStringView, _FormSchemaBaseView);

	function FormSchemaStringView() {
		_classCallCheck(this, _FormSchemaStringView);

		_FormSchemaBaseView.apply(this, arguments);
	}

	FormSchemaStringView.prototype.initialize = function initialize() {
		var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

		_FormSchemaBaseView.prototype.initialize.call(this, options);
	};

	FormSchemaStringView.prototype.render = function render() {

		return this;
	};

	var _FormSchemaStringView = FormSchemaStringView;
	FormSchemaStringView = _libsHelpersExoskelesston.tagName('input')(FormSchemaStringView) || FormSchemaStringView;
	FormSchemaStringView = _libsHelpersExoskelesston.name('items/FormSchemaStringView')(FormSchemaStringView) || FormSchemaStringView;
	return FormSchemaStringView;
})(_formSchemaBaseView2['default']);

;

exports['default'] = FormSchemaStringView;
module.exports = exports['default'];
},{"../../../libs/helpers/exoskelesston":7,"./form-schema-base-view":11}]},{},[4])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFja2JvbmUubmF0aXZlYWpheC9iYWNrYm9uZS5uYXRpdmVhamF4LmpzIiwibm9kZV9tb2R1bGVzL2JhY2tib25lLm5hdGl2ZXZpZXcvYmFja2JvbmUubmF0aXZldmlldy5qcyIsIm5vZGVfbW9kdWxlcy9leG9za2VsZXRvbi9leG9za2VsZXRvbi5qcyIsInNyYy9mb3JtZWxsLmpzIiwic3JjL2xpYnMvZm9ybWVsbC1zY2hlbWEuanMiLCJzcmMvbGlicy9oZWxwZXJzL2Vudmlyb25tZW50LmpzIiwic3JjL2xpYnMvaGVscGVycy9leG9za2VsZXNzdG9uLmpzIiwic3JjL2xpYnMvaGVscGVycy9zdHJpbmcuanMiLCJzcmMvbGlicy92ZW5kb3IvZm9ybTJqcy5qcyIsInNyYy9tb2R1bGVzL2Zvcm0tc2NoZW1hL2Zvcm0tc2NoZW1hLXZpZXcuanMiLCJzcmMvbW9kdWxlcy9mb3JtLXNjaGVtYS9pdGVtcy9mb3JtLXNjaGVtYS1iYXNlLXZpZXcuanMiLCJzcmMvbW9kdWxlcy9mb3JtLXNjaGVtYS9pdGVtcy9mb3JtLXNjaGVtYS1pdGVtLWZhY3RvcnkuanMiLCJzcmMvbW9kdWxlcy9mb3JtLXNjaGVtYS9pdGVtcy9mb3JtLXNjaGVtYS1zdHJpbmctdmlldy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqdURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMxa0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBCYWNrYm9uZS5OYXRpdmVBamF4LmpzIDAuNC4zXG4vLyAtLS0tLS0tLS0tLS0tLS1cblxuLy8gICAgIChjKSAyMDE1IEFkYW0gS3JlYnMsIFBhdWwgTWlsbGVyLCBFeG9za2VsZXRvbiBQcm9qZWN0XG4vLyAgICAgQmFja2JvbmUuTmF0aXZlQWpheCBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbi8vICAgICBGb3IgYWxsIGRldGFpbHMgYW5kIGRvY3VtZW50YXRpb246XG4vLyAgICAgaHR0cHM6Ly9naXRodWIuY29tL2FrcmU1NC9CYWNrYm9uZS5OYXRpdmVBamF4XG5cbihmdW5jdGlvbiAoZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7IGRlZmluZShmYWN0b3J5KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHsgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XG4gIH0gZWxzZSB7IEJhY2tib25lLmFqYXggPSBmYWN0b3J5KCk7IH1cbn0oZnVuY3Rpb24oKSB7XG4gIC8vIE1ha2UgYW4gQUpBWCByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXIuXG4gIC8vIFVzYWdlOlxuICAvLyAgIHZhciByZXEgPSBCYWNrYm9uZS5hamF4KHt1cmw6ICd1cmwnLCB0eXBlOiAnUEFUQ0gnLCBkYXRhOiAnZGF0YSd9KTtcbiAgLy8gICByZXEudGhlbiguLi4sIC4uLikgLy8gaWYgUHJvbWlzZSBpcyBzZXRcbiAgdmFyIGFqYXggPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIHhtbFJlID0gL14oPzphcHBsaWNhdGlvbnx0ZXh0KVxcL3htbC87XG4gICAgdmFyIGpzb25SZSA9IC9eYXBwbGljYXRpb25cXC9qc29uLztcblxuICAgIHZhciBnZXREYXRhID0gZnVuY3Rpb24oYWNjZXB0cywgeGhyKSB7XG4gICAgICBpZiAoYWNjZXB0cyA9PSBudWxsKSBhY2NlcHRzID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdjb250ZW50LXR5cGUnKTtcbiAgICAgIGlmICh4bWxSZS50ZXN0KGFjY2VwdHMpKSB7XG4gICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VYTUw7XG4gICAgICB9IGVsc2UgaWYgKGpzb25SZS50ZXN0KGFjY2VwdHMpICYmIHhoci5yZXNwb25zZVRleHQgIT09ICcnKSB7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHQ7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHZhciBpc1ZhbGlkID0gZnVuY3Rpb24oeGhyKSB7XG4gICAgICByZXR1cm4gKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApIHx8XG4gICAgICAgICh4aHIuc3RhdHVzID09PSAzMDQpIHx8XG4gICAgICAgICh4aHIuc3RhdHVzID09PSAwICYmIHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2ZpbGU6JylcbiAgICB9O1xuXG4gICAgdmFyIGVuZCA9IGZ1bmN0aW9uKHhociwgb3B0aW9ucywgcHJvbWlzZSwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHVwZGF0ZVByb21pc2UoeGhyLCBwcm9taXNlKTtcblxuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgIT09IDQpIHJldHVybjtcblxuICAgICAgICB2YXIgc3RhdHVzID0geGhyLnN0YXR1cztcbiAgICAgICAgdmFyIGRhdGEgPSBnZXREYXRhKG9wdGlvbnMuaGVhZGVycyAmJiBvcHRpb25zLmhlYWRlcnMuQWNjZXB0LCB4aHIpO1xuXG4gICAgICAgIC8vIENoZWNrIGZvciB2YWxpZGl0eS5cbiAgICAgICAgaWYgKGlzVmFsaWQoeGhyKSkge1xuICAgICAgICAgIGlmIChvcHRpb25zLnN1Y2Nlc3MpIG9wdGlvbnMuc3VjY2VzcyhkYXRhKTtcbiAgICAgICAgICBpZiAocmVzb2x2ZSkgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoJ1NlcnZlciByZXNwb25kZWQgd2l0aCBhIHN0YXR1cyBvZiAnICsgc3RhdHVzKTtcbiAgICAgICAgICBpZiAob3B0aW9ucy5lcnJvcikgb3B0aW9ucy5lcnJvcih4aHIsIHN0YXR1cywgZXJyb3IpO1xuICAgICAgICAgIGlmIChyZWplY3QpIHJlamVjdCh4aHIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIHZhciB1cGRhdGVQcm9taXNlID0gZnVuY3Rpb24oeGhyLCBwcm9taXNlKSB7XG4gICAgICBpZiAoIXByb21pc2UpIHJldHVybjtcblxuICAgICAgdmFyIHByb3BzID0gWydyZWFkeVN0YXRlJywgJ3N0YXR1cycsICdzdGF0dXNUZXh0JywgJ3Jlc3BvbnNlVGV4dCcsXG4gICAgICAgICdyZXNwb25zZVhNTCcsICdzZXRSZXF1ZXN0SGVhZGVyJywgJ2dldEFsbFJlc3BvbnNlSGVhZGVycycsXG4gICAgICAgICdnZXRSZXNwb25zZUhlYWRlcicsICdzdGF0dXNDb2RlJywgJ2Fib3J0J107XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHByb3AgPSBwcm9wc1tpXTtcbiAgICAgICAgcHJvbWlzZVtwcm9wXSA9IHR5cGVvZiB4aHJbcHJvcF0gPT09ICdmdW5jdGlvbicgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeGhyW3Byb3BdLmJpbmQoeGhyKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB4aHJbcHJvcF07XG4gICAgICB9XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgaWYgKG9wdGlvbnMgPT0gbnVsbCkgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBwcm92aWRlIG9wdGlvbnMnKTtcbiAgICAgIGlmIChvcHRpb25zLnR5cGUgPT0gbnVsbCkgb3B0aW9ucy50eXBlID0gJ0dFVCc7XG5cbiAgICAgIHZhciByZXNvbHZlLCByZWplY3QsIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgdmFyIFByb21pc2VGbiA9IGFqYXguUHJvbWlzZSB8fCAodHlwZW9mIFByb21pc2UgIT09ICd1bmRlZmluZWQnICYmIFByb21pc2UpO1xuICAgICAgdmFyIHByb21pc2UgPSBQcm9taXNlRm4gJiYgbmV3IFByb21pc2VGbihmdW5jdGlvbihyZXMsIHJlaikge1xuICAgICAgICByZXNvbHZlID0gcmVzO1xuICAgICAgICByZWplY3QgPSByZWo7XG4gICAgICB9KTtcblxuICAgICAgaWYgKG9wdGlvbnMuY29udGVudFR5cGUpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuaGVhZGVycyA9PSBudWxsKSBvcHRpb25zLmhlYWRlcnMgPSB7fTtcbiAgICAgICAgb3B0aW9ucy5oZWFkZXJzWydDb250ZW50LVR5cGUnXSA9IG9wdGlvbnMuY29udGVudFR5cGU7XG4gICAgICB9XG5cbiAgICAgIC8vIFN0cmluZ2lmeSBHRVQgcXVlcnkgcGFyYW1zLlxuICAgICAgaWYgKG9wdGlvbnMudHlwZSA9PT0gJ0dFVCcgJiYgdHlwZW9mIG9wdGlvbnMuZGF0YSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdmFyIHF1ZXJ5ID0gJyc7XG4gICAgICAgIHZhciBzdHJpbmdpZnlLZXlWYWx1ZVBhaXIgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICAgICAgcmV0dXJuIHZhbHVlID09IG51bGwgPyAnJyA6XG4gICAgICAgICAgICAnJicgKyBlbmNvZGVVUklDb21wb25lbnQoa2V5KSArXG4gICAgICAgICAgICAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gb3B0aW9ucy5kYXRhKSB7XG4gICAgICAgICAgcXVlcnkgKz0gc3RyaW5naWZ5S2V5VmFsdWVQYWlyKGtleSwgb3B0aW9ucy5kYXRhW2tleV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgICAgdmFyIHNlcCA9IChvcHRpb25zLnVybC5pbmRleE9mKCc/JykgPT09IC0xKSA/ICc/JyA6ICcmJztcbiAgICAgICAgICBvcHRpb25zLnVybCArPSBzZXAgKyBxdWVyeS5zdWJzdHJpbmcoMSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGVuZCh4aHIsIG9wdGlvbnMsIHByb21pc2UsIHJlc29sdmUsIHJlamVjdCk7XG4gICAgICB4aHIub3BlbihvcHRpb25zLnR5cGUsIG9wdGlvbnMudXJsLCB0cnVlKTtcblxuICAgICAgaWYoIShvcHRpb25zLmhlYWRlcnMgJiYgb3B0aW9ucy5oZWFkZXJzLkFjY2VwdCkpIHtcbiAgICAgICAgdmFyIGFsbFR5cGVzID0gXCIqL1wiLmNvbmNhdChcIipcIik7XG4gICAgICAgIHZhciB4aHJBY2NlcHRzID0ge1xuICAgICAgICAgIFwiKlwiOiBhbGxUeXBlcyxcbiAgICAgICAgICB0ZXh0OiBcInRleHQvcGxhaW5cIixcbiAgICAgICAgICBodG1sOiBcInRleHQvaHRtbFwiLFxuICAgICAgICAgIHhtbDogXCJhcHBsaWNhdGlvbi94bWwsIHRleHQveG1sXCIsXG4gICAgICAgICAganNvbjogXCJhcHBsaWNhdGlvbi9qc29uLCB0ZXh0L2phdmFzY3JpcHRcIlxuICAgICAgICB9O1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihcbiAgICAgICAgICBcIkFjY2VwdFwiLFxuICAgICAgICAgIG9wdGlvbnMuZGF0YVR5cGUgJiYgeGhyQWNjZXB0c1tvcHRpb25zLmRhdGFUeXBlXSA/XG4gICAgICAgICAgICB4aHJBY2NlcHRzW29wdGlvbnMuZGF0YVR5cGVdICsgKG9wdGlvbnMuZGF0YVR5cGUgIT09IFwiKlwiID8gXCIsIFwiICsgYWxsVHlwZXMgKyBcIjsgcT0wLjAxXCIgOiBcIlwiICkgOlxuICAgICAgICAgICAgeGhyQWNjZXB0c1tcIipcIl1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMuaGVhZGVycykgZm9yICh2YXIga2V5IGluIG9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIG9wdGlvbnMuaGVhZGVyc1trZXldKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcHRpb25zLmJlZm9yZVNlbmQpIG9wdGlvbnMuYmVmb3JlU2VuZCh4aHIpO1xuICAgICAgeGhyLnNlbmQob3B0aW9ucy5kYXRhKTtcblxuICAgICAgb3B0aW9ucy5vcmlnaW5hbFhociA9IHhocjtcblxuICAgICAgdXBkYXRlUHJvbWlzZSh4aHIsIHByb21pc2UpO1xuXG4gICAgICByZXR1cm4gcHJvbWlzZSA/IHByb21pc2UgOiB4aHI7XG4gICAgfTtcbiAgfSkoKTtcbiAgcmV0dXJuIGFqYXg7XG59KSk7XG4iLCIvLyBCYWNrYm9uZS5OYXRpdmVWaWV3LmpzIDAuMy4zXG4vLyAtLS0tLS0tLS0tLS0tLS1cblxuLy8gICAgIChjKSAyMDE1IEFkYW0gS3JlYnMsIEppbW15IFl1ZW4gSG8gV29uZ1xuLy8gICAgIEJhY2tib25lLk5hdGl2ZVZpZXcgbWF5IGJlIGZyZWVseSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4vLyAgICAgRm9yIGFsbCBkZXRhaWxzIGFuZCBkb2N1bWVudGF0aW9uOlxuLy8gICAgIGh0dHBzOi8vZ2l0aHViLmNvbS9ha3JlNTQvQmFja2JvbmUuTmF0aXZlVmlld1xuXG4oZnVuY3Rpb24gKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkgeyBkZWZpbmUoWydiYWNrYm9uZSddLCBmYWN0b3J5KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JykgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSgnZXhvc2tlbGV0b24nKSk7XG4gIH0gZWxzZSB7IGZhY3RvcnkoQmFja2JvbmUpOyB9XG59KGZ1bmN0aW9uIChCYWNrYm9uZSkge1xuICAvLyBDYWNoZWQgcmVnZXggdG8gbWF0Y2ggYW4gb3BlbmluZyAnPCcgb2YgYW4gSFRNTCB0YWcsIHBvc3NpYmx5IGxlZnQtcGFkZGVkXG4gIC8vIHdpdGggd2hpdGVzcGFjZS5cbiAgdmFyIHBhZGRlZEx0ID0gL15cXHMqPC87XG5cbiAgLy8gQ2FjaGVzIGEgbG9jYWwgcmVmZXJlbmNlIHRvIGBFbGVtZW50LnByb3RvdHlwZWAgZm9yIGZhc3RlciBhY2Nlc3MuXG4gIHZhciBFbGVtZW50UHJvdG8gPSAodHlwZW9mIEVsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmIEVsZW1lbnQucHJvdG90eXBlKSB8fCB7fTtcblxuICAvLyBDcm9zcy1icm93c2VyIGV2ZW50IGxpc3RlbmVyIHNoaW1zXG4gIHZhciBlbGVtZW50QWRkRXZlbnRMaXN0ZW5lciA9IEVsZW1lbnRQcm90by5hZGRFdmVudExpc3RlbmVyIHx8IGZ1bmN0aW9uKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hdHRhY2hFdmVudCgnb24nICsgZXZlbnROYW1lLCBsaXN0ZW5lcik7XG4gIH1cbiAgdmFyIGVsZW1lbnRSZW1vdmVFdmVudExpc3RlbmVyID0gRWxlbWVudFByb3RvLnJlbW92ZUV2ZW50TGlzdGVuZXIgfHwgZnVuY3Rpb24oZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHJldHVybiB0aGlzLmRldGFjaEV2ZW50KCdvbicgKyBldmVudE5hbWUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHZhciBpbmRleE9mID0gZnVuY3Rpb24oYXJyYXksIGl0ZW0pIHtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIGlmIChhcnJheVtpXSA9PT0gaXRlbSkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLy8gRmluZCB0aGUgcmlnaHQgYEVsZW1lbnQjbWF0Y2hlc2AgZm9yIElFPj05IGFuZCBtb2Rlcm4gYnJvd3NlcnMuXG4gIHZhciBtYXRjaGVzU2VsZWN0b3IgPSBFbGVtZW50UHJvdG8ubWF0Y2hlcyB8fFxuICAgICAgRWxlbWVudFByb3RvLndlYmtpdE1hdGNoZXNTZWxlY3RvciB8fFxuICAgICAgRWxlbWVudFByb3RvLm1vek1hdGNoZXNTZWxlY3RvciB8fFxuICAgICAgRWxlbWVudFByb3RvLm1zTWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgICBFbGVtZW50UHJvdG8ub01hdGNoZXNTZWxlY3RvciB8fFxuICAgICAgLy8gTWFrZSBvdXIgb3duIGBFbGVtZW50I21hdGNoZXNgIGZvciBJRThcbiAgICAgIGZ1bmN0aW9uKHNlbGVjdG9yKSB7XG4gICAgICAgIC8vIFVzZSBxdWVyeVNlbGVjdG9yQWxsIHRvIGZpbmQgYWxsIGVsZW1lbnRzIG1hdGNoaW5nIHRoZSBzZWxlY3RvcixcbiAgICAgICAgLy8gdGhlbiBjaGVjayBpZiB0aGUgZ2l2ZW4gZWxlbWVudCBpcyBpbmNsdWRlZCBpbiB0aGF0IGxpc3QuXG4gICAgICAgIC8vIEV4ZWN1dGluZyB0aGUgcXVlcnkgb24gdGhlIHBhcmVudE5vZGUgcmVkdWNlcyB0aGUgcmVzdWx0aW5nIG5vZGVMaXN0LFxuICAgICAgICAvLyAoZG9jdW1lbnQgZG9lc24ndCBoYXZlIGEgcGFyZW50Tm9kZSkuXG4gICAgICAgIHZhciBub2RlTGlzdCA9ICh0aGlzLnBhcmVudE5vZGUgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpIHx8IFtdO1xuICAgICAgICByZXR1cm4gfmluZGV4T2Yobm9kZUxpc3QsIHRoaXMpO1xuICAgICAgfTtcblxuICAvLyBDYWNoZSBCYWNrYm9uZS5WaWV3IGZvciBsYXRlciBhY2Nlc3MgaW4gY29uc3RydWN0b3JcbiAgdmFyIEJCVmlldyA9IEJhY2tib25lLlZpZXc7XG5cbiAgLy8gVG8gZXh0ZW5kIGFuIGV4aXN0aW5nIHZpZXcgdG8gdXNlIG5hdGl2ZSBtZXRob2RzLCBleHRlbmQgdGhlIFZpZXcgcHJvdG90eXBlXG4gIC8vIHdpdGggdGhlIG1peGluOiBfLmV4dGVuZChNeVZpZXcucHJvdG90eXBlLCBCYWNrYm9uZS5OYXRpdmVWaWV3TWl4aW4pO1xuICBCYWNrYm9uZS5OYXRpdmVWaWV3TWl4aW4gPSB7XG5cbiAgICBfZG9tRXZlbnRzOiBudWxsLFxuXG4gICAgY29uc3RydWN0b3I6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5fZG9tRXZlbnRzID0gW107XG4gICAgICByZXR1cm4gQkJWaWV3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfSxcblxuICAgICQ6IGZ1bmN0aW9uKHNlbGVjdG9yKSB7XG4gICAgICByZXR1cm4gdGhpcy5lbC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICB9LFxuXG4gICAgX3JlbW92ZUVsZW1lbnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy51bmRlbGVnYXRlRXZlbnRzKCk7XG4gICAgICBpZiAodGhpcy5lbC5wYXJlbnROb2RlKSB0aGlzLmVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5lbCk7XG4gICAgfSxcblxuICAgIC8vIEFwcGx5IHRoZSBgZWxlbWVudGAgdG8gdGhlIHZpZXcuIGBlbGVtZW50YCBjYW4gYmUgYSBDU1Mgc2VsZWN0b3IsXG4gICAgLy8gYSBzdHJpbmcgb2YgSFRNTCwgb3IgYW4gRWxlbWVudCBub2RlLlxuICAgIF9zZXRFbGVtZW50OiBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgICBpZiAodHlwZW9mIGVsZW1lbnQgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKHBhZGRlZEx0LnRlc3QoZWxlbWVudCkpIHtcbiAgICAgICAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICBlbC5pbm5lckhUTUwgPSBlbGVtZW50O1xuICAgICAgICAgIHRoaXMuZWwgPSBlbC5maXJzdENoaWxkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmVsID0gZWxlbWVudDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gU2V0IGEgaGFzaCBvZiBhdHRyaWJ1dGVzIHRvIHRoZSB2aWV3J3MgYGVsYC4gV2UgdXNlIHRoZSBcInByb3BcIiB2ZXJzaW9uXG4gICAgLy8gaWYgYXZhaWxhYmxlLCBmYWxsaW5nIGJhY2sgdG8gYHNldEF0dHJpYnV0ZWAgZm9yIHRoZSBjYXRjaC1hbGwuXG4gICAgX3NldEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKGF0dHJzKSB7XG4gICAgICBmb3IgKHZhciBhdHRyIGluIGF0dHJzKSB7XG4gICAgICAgIGF0dHIgaW4gdGhpcy5lbCA/IHRoaXMuZWxbYXR0cl0gPSBhdHRyc1thdHRyXSA6IHRoaXMuZWwuc2V0QXR0cmlidXRlKGF0dHIsIGF0dHJzW2F0dHJdKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gTWFrZSBhIGV2ZW50IGRlbGVnYXRpb24gaGFuZGxlciBmb3IgdGhlIGdpdmVuIGBldmVudE5hbWVgIGFuZCBgc2VsZWN0b3JgXG4gICAgLy8gYW5kIGF0dGFjaCBpdCB0byBgdGhpcy5lbGAuXG4gICAgLy8gSWYgc2VsZWN0b3IgaXMgZW1wdHksIHRoZSBsaXN0ZW5lciB3aWxsIGJlIGJvdW5kIHRvIGB0aGlzLmVsYC4gSWYgbm90LCBhXG4gICAgLy8gbmV3IGhhbmRsZXIgdGhhdCB3aWxsIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIHVwIHRoZSBldmVudCB0YXJnZXQncyBET01cbiAgICAvLyBoaWVyYXJjaHkgbG9va2luZyBmb3IgYSBub2RlIHRoYXQgbWF0Y2hlcyB0aGUgc2VsZWN0b3IuIElmIG9uZSBpcyBmb3VuZCxcbiAgICAvLyB0aGUgZXZlbnQncyBgZGVsZWdhdGVUYXJnZXRgIHByb3BlcnR5IGlzIHNldCB0byBpdCBhbmQgdGhlIHJldHVybiB0aGVcbiAgICAvLyByZXN1bHQgb2YgY2FsbGluZyBib3VuZCBgbGlzdGVuZXJgIHdpdGggdGhlIHBhcmFtZXRlcnMgZ2l2ZW4gdG8gdGhlXG4gICAgLy8gaGFuZGxlci5cbiAgICBkZWxlZ2F0ZTogZnVuY3Rpb24oZXZlbnROYW1lLCBzZWxlY3RvciwgbGlzdGVuZXIpIHtcbiAgICAgIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgbGlzdGVuZXIgPSBzZWxlY3RvcjtcbiAgICAgICAgc2VsZWN0b3IgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICB2YXIgcm9vdCA9IHRoaXMuZWw7XG4gICAgICB2YXIgaGFuZGxlciA9IHNlbGVjdG9yID8gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyIG5vZGUgPSBlLnRhcmdldCB8fCBlLnNyY0VsZW1lbnQ7XG4gICAgICAgIGZvciAoOyBub2RlICYmIG5vZGUgIT0gcm9vdDsgbm9kZSA9IG5vZGUucGFyZW50Tm9kZSkge1xuICAgICAgICAgIGlmIChtYXRjaGVzU2VsZWN0b3IuY2FsbChub2RlLCBzZWxlY3RvcikpIHtcbiAgICAgICAgICAgIGUuZGVsZWdhdGVUYXJnZXQgPSBub2RlO1xuICAgICAgICAgICAgbGlzdGVuZXIoZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IDogbGlzdGVuZXI7XG5cbiAgICAgIGVsZW1lbnRBZGRFdmVudExpc3RlbmVyLmNhbGwodGhpcy5lbCwgZXZlbnROYW1lLCBoYW5kbGVyLCBmYWxzZSk7XG4gICAgICB0aGlzLl9kb21FdmVudHMucHVzaCh7ZXZlbnROYW1lOiBldmVudE5hbWUsIGhhbmRsZXI6IGhhbmRsZXIsIGxpc3RlbmVyOiBsaXN0ZW5lciwgc2VsZWN0b3I6IHNlbGVjdG9yfSk7XG4gICAgICByZXR1cm4gaGFuZGxlcjtcbiAgICB9LFxuXG4gICAgLy8gUmVtb3ZlIGEgc2luZ2xlIGRlbGVnYXRlZCBldmVudC4gRWl0aGVyIGBldmVudE5hbWVgIG9yIGBzZWxlY3RvcmAgbXVzdFxuICAgIC8vIGJlIGluY2x1ZGVkLCBgc2VsZWN0b3JgIGFuZCBgbGlzdGVuZXJgIGFyZSBvcHRpb25hbC5cbiAgICB1bmRlbGVnYXRlOiBmdW5jdGlvbihldmVudE5hbWUsIHNlbGVjdG9yLCBsaXN0ZW5lcikge1xuICAgICAgaWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBsaXN0ZW5lciA9IHNlbGVjdG9yO1xuICAgICAgICBzZWxlY3RvciA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLmVsKSB7XG4gICAgICAgIHZhciBoYW5kbGVycyA9IHRoaXMuX2RvbUV2ZW50cy5zbGljZSgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gaGFuZGxlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICB2YXIgaXRlbSA9IGhhbmRsZXJzW2ldO1xuXG4gICAgICAgICAgdmFyIG1hdGNoID0gaXRlbS5ldmVudE5hbWUgPT09IGV2ZW50TmFtZSAmJlxuICAgICAgICAgICAgICAobGlzdGVuZXIgPyBpdGVtLmxpc3RlbmVyID09PSBsaXN0ZW5lciA6IHRydWUpICYmXG4gICAgICAgICAgICAgIChzZWxlY3RvciA/IGl0ZW0uc2VsZWN0b3IgPT09IHNlbGVjdG9yIDogdHJ1ZSk7XG5cbiAgICAgICAgICBpZiAoIW1hdGNoKSBjb250aW51ZTtcblxuICAgICAgICAgIGVsZW1lbnRSZW1vdmVFdmVudExpc3RlbmVyLmNhbGwodGhpcy5lbCwgaXRlbS5ldmVudE5hbWUsIGl0ZW0uaGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgIHRoaXMuX2RvbUV2ZW50cy5zcGxpY2UoaW5kZXhPZihoYW5kbGVycywgaXRlbSksIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLy8gUmVtb3ZlIGFsbCBldmVudHMgY3JlYXRlZCB3aXRoIGBkZWxlZ2F0ZWAgZnJvbSBgZWxgXG4gICAgdW5kZWxlZ2F0ZUV2ZW50czogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5lbCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5fZG9tRXZlbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgdmFyIGl0ZW0gPSB0aGlzLl9kb21FdmVudHNbaV07XG4gICAgICAgICAgZWxlbWVudFJlbW92ZUV2ZW50TGlzdGVuZXIuY2FsbCh0aGlzLmVsLCBpdGVtLmV2ZW50TmFtZSwgaXRlbS5oYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX2RvbUV2ZW50cy5sZW5ndGggPSAwO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9O1xuXG4gIEJhY2tib25lLk5hdGl2ZVZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZChCYWNrYm9uZS5OYXRpdmVWaWV3TWl4aW4pO1xuXG4gIHJldHVybiBCYWNrYm9uZS5OYXRpdmVWaWV3O1xufSkpO1xuIiwiLyohXG4gKiBFeG9za2VsZXRvbi5qcyAwLjcuMFxuICogKGMpIDIwMTMgUGF1bCBNaWxsZXIgPGh0dHA6Ly9wYXVsbWlsbHIuY29tPlxuICogQmFzZWQgb24gQmFja2JvbmUuanNcbiAqIChjKSAyMDEwLTIwMTMgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkXG4gKiBFeG9za2VsZXRvbiBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqIEZvciBhbGwgZGV0YWlscyBhbmQgZG9jdW1lbnRhdGlvbjogPGh0dHA6Ly9leG9zanMuY29tPlxuICovXG5cbihmdW5jdGlvbihyb290LCBmYWN0b3J5KSB7XG4gIC8vIFNldCB1cCBCYWNrYm9uZSBhcHByb3ByaWF0ZWx5IGZvciB0aGUgZW52aXJvbm1lbnQuXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoWyd1bmRlcnNjb3JlJywgJ2pxdWVyeScsICdleHBvcnRzJ10sIGZ1bmN0aW9uKF8sICQsIGV4cG9ydHMpIHtcbiAgICAgIHJvb3QuQmFja2JvbmUgPSByb290LkV4b3NrZWxldG9uID0gZmFjdG9yeShyb290LCBleHBvcnRzLCBfLCAkKTtcbiAgICB9KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB2YXIgXywgJDtcbiAgICB0cnkgeyBfID0gcmVxdWlyZSgndW5kZXJzY29yZScpOyB9IGNhdGNoKGUpIHsgfVxuICAgIHRyeSB7ICQgPSByZXF1aXJlKCdqcXVlcnknKTsgfSBjYXRjaChlKSB7IH1cbiAgICBmYWN0b3J5KHJvb3QsIGV4cG9ydHMsIF8sICQpO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuQmFja2JvbmUgPSByb290LkV4b3NrZWxldG9uID0gZmFjdG9yeShyb290LCB7fSwgcm9vdC5fLCAocm9vdC5qUXVlcnkgfHwgcm9vdC5aZXB0byB8fCByb290LmVuZGVyIHx8IHJvb3QuJCkpO1xuICB9XG5cbn0pKHRoaXMsIGZ1bmN0aW9uKHJvb3QsIEJhY2tib25lLCBfLCAkKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAvLyBJbml0aWFsIFNldHVwXG4gIC8vIC0tLS0tLS0tLS0tLS1cblxuICAvLyBTYXZlIHRoZSBwcmV2aW91cyB2YWx1ZSBvZiB0aGUgYEJhY2tib25lYCB2YXJpYWJsZSwgc28gdGhhdCBpdCBjYW4gYmVcbiAgLy8gcmVzdG9yZWQgbGF0ZXIgb24sIGlmIGBub0NvbmZsaWN0YCBpcyB1c2VkLlxuICB2YXIgcHJldmlvdXNCYWNrYm9uZSA9IHJvb3QuQmFja2JvbmU7XG4gIHZhciBwcmV2aW91c0V4b3NrZWxldG9uID0gcm9vdC5FeG9za2VsZXRvbjtcblxuICAvLyBVbmRlcnNjb3JlIHJlcGxhY2VtZW50LlxuICB2YXIgdXRpbHMgPSBCYWNrYm9uZS51dGlscyA9IF8gPSAoXyB8fCB7fSk7XG5cbiAgLy8gSG9sZCBvbnRvIGEgbG9jYWwgcmVmZXJlbmNlIHRvIGAkYC4gQ2FuIGJlIGNoYW5nZWQgYXQgYW55IHBvaW50LlxuICBCYWNrYm9uZS4kID0gJDtcblxuICAvLyBDcmVhdGUgbG9jYWwgcmVmZXJlbmNlcyB0byBhcnJheSBtZXRob2RzIHdlJ2xsIHdhbnQgdG8gdXNlIGxhdGVyLlxuICB2YXIgYXJyYXkgPSBbXTtcbiAgdmFyIHB1c2ggPSBhcnJheS5wdXNoO1xuICB2YXIgc2xpY2UgPSBhcnJheS5zbGljZTtcbiAgdmFyIHRvU3RyaW5nID0gKHt9KS50b1N0cmluZztcblxuICAvLyBDdXJyZW50IHZlcnNpb24gb2YgdGhlIGxpYnJhcnkuIEtlZXAgaW4gc3luYyB3aXRoIGBwYWNrYWdlLmpzb25gLlxuICAvLyBCYWNrYm9uZS5WRVJTSU9OID0gJzEuMC4wJztcblxuICAvLyBSdW5zIEJhY2tib25lLmpzIGluICpub0NvbmZsaWN0KiBtb2RlLCByZXR1cm5pbmcgdGhlIGBCYWNrYm9uZWAgdmFyaWFibGVcbiAgLy8gdG8gaXRzIHByZXZpb3VzIG93bmVyLiBSZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoaXMgQmFja2JvbmUgb2JqZWN0LlxuICBCYWNrYm9uZS5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgcm9vdC5CYWNrYm9uZSA9IHByZXZpb3VzQmFja2JvbmU7XG4gICAgcm9vdC5FeG9za2VsZXRvbiA9IHByZXZpb3VzRXhvc2tlbGV0b247XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLy8gSGVscGVyc1xuICAvLyAtLS0tLS0tXG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGNvcnJlY3RseSBzZXQgdXAgdGhlIHByb3RvdHlwZSBjaGFpbiwgZm9yIHN1YmNsYXNzZXMuXG4gIC8vIFNpbWlsYXIgdG8gYGdvb2cuaW5oZXJpdHNgLCBidXQgdXNlcyBhIGhhc2ggb2YgcHJvdG90eXBlIHByb3BlcnRpZXMgYW5kXG4gIC8vIGNsYXNzIHByb3BlcnRpZXMgdG8gYmUgZXh0ZW5kZWQuXG4gIEJhY2tib25lLmV4dGVuZCA9IGZ1bmN0aW9uKHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG4gICAgdmFyIHBhcmVudCA9IHRoaXM7XG4gICAgdmFyIGNoaWxkO1xuXG4gICAgLy8gVGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGZvciB0aGUgbmV3IHN1YmNsYXNzIGlzIGVpdGhlciBkZWZpbmVkIGJ5IHlvdVxuICAgIC8vICh0aGUgXCJjb25zdHJ1Y3RvclwiIHByb3BlcnR5IGluIHlvdXIgYGV4dGVuZGAgZGVmaW5pdGlvbiksIG9yIGRlZmF1bHRlZFxuICAgIC8vIGJ5IHVzIHRvIHNpbXBseSBjYWxsIHRoZSBwYXJlbnQncyBjb25zdHJ1Y3Rvci5cbiAgICBpZiAocHJvdG9Qcm9wcyAmJiBfLmhhcyhwcm90b1Byb3BzLCAnY29uc3RydWN0b3InKSkge1xuICAgICAgY2hpbGQgPSBwcm90b1Byb3BzLmNvbnN0cnVjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICBjaGlsZCA9IGZ1bmN0aW9uKCl7IHJldHVybiBwYXJlbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTsgfTtcbiAgICB9XG5cbiAgICAvLyBBZGQgc3RhdGljIHByb3BlcnRpZXMgdG8gdGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLCBpZiBzdXBwbGllZC5cbiAgICBfLmV4dGVuZChjaGlsZCwgcGFyZW50LCBzdGF0aWNQcm9wcyk7XG5cbiAgICAvLyBTZXQgdGhlIHByb3RvdHlwZSBjaGFpbiB0byBpbmhlcml0IGZyb20gYHBhcmVudGAsIHdpdGhvdXQgY2FsbGluZ1xuICAgIC8vIGBwYXJlbnRgJ3MgY29uc3RydWN0b3IgZnVuY3Rpb24uXG4gICAgdmFyIFN1cnJvZ2F0ZSA9IGZ1bmN0aW9uKCl7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfTtcbiAgICBTdXJyb2dhdGUucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTtcbiAgICBjaGlsZC5wcm90b3R5cGUgPSBuZXcgU3Vycm9nYXRlO1xuXG4gICAgLy8gQWRkIHByb3RvdHlwZSBwcm9wZXJ0aWVzIChpbnN0YW5jZSBwcm9wZXJ0aWVzKSB0byB0aGUgc3ViY2xhc3MsXG4gICAgLy8gaWYgc3VwcGxpZWQuXG4gICAgaWYgKHByb3RvUHJvcHMpIF8uZXh0ZW5kKGNoaWxkLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7XG5cbiAgICAvLyBTZXQgYSBjb252ZW5pZW5jZSBwcm9wZXJ0eSBpbiBjYXNlIHRoZSBwYXJlbnQncyBwcm90b3R5cGUgaXMgbmVlZGVkXG4gICAgLy8gbGF0ZXIuXG4gICAgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTtcblxuICAgIHJldHVybiBjaGlsZDtcbiAgfTtcblxuICAvLyBUaHJvdyBhbiBlcnJvciB3aGVuIGEgVVJMIGlzIG5lZWRlZCwgYW5kIG5vbmUgaXMgc3VwcGxpZWQuXG4gIHZhciB1cmxFcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQSBcInVybFwiIHByb3BlcnR5IG9yIGZ1bmN0aW9uIG11c3QgYmUgc3BlY2lmaWVkJyk7XG4gIH07XG5cbiAgLy8gV3JhcCBhbiBvcHRpb25hbCBlcnJvciBjYWxsYmFjayB3aXRoIGEgZmFsbGJhY2sgZXJyb3IgZXZlbnQuXG4gIHZhciB3cmFwRXJyb3IgPSBmdW5jdGlvbihtb2RlbCwgb3B0aW9ucykge1xuICAgIHZhciBlcnJvciA9IG9wdGlvbnMuZXJyb3I7XG4gICAgb3B0aW9ucy5lcnJvciA9IGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgIGlmIChlcnJvcikgZXJyb3IobW9kZWwsIHJlc3AsIG9wdGlvbnMpO1xuICAgICAgbW9kZWwudHJpZ2dlcignZXJyb3InLCBtb2RlbCwgcmVzcCwgb3B0aW9ucyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBDaGVja2VyIGZvciB1dGlsaXR5IG1ldGhvZHMuIFVzZWZ1bCBmb3IgY3VzdG9tIGJ1aWxkcy5cbiAgdmFyIHV0aWxFeGlzdHMgPSBmdW5jdGlvbihtZXRob2QpIHtcbiAgICByZXR1cm4gdHlwZW9mIF9bbWV0aG9kXSA9PT0gJ2Z1bmN0aW9uJztcbiAgfTtcbnV0aWxzLnJlc3VsdCA9IGZ1bmN0aW9uIHJlc3VsdChvYmplY3QsIHByb3BlcnR5KSB7XG4gIHZhciB2YWx1ZSA9IG9iamVjdCA/IG9iamVjdFtwcm9wZXJ0eV0gOiB1bmRlZmluZWQ7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgPyBvYmplY3RbcHJvcGVydHldKCkgOiB2YWx1ZTtcbn07XG5cbnV0aWxzLmRlZmF1bHRzID0gZnVuY3Rpb24gZGVmYXVsdHMob2JqKSB7XG4gIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gaXRlbSkgaWYgKG9ialtrZXldID09PSB1bmRlZmluZWQpXG4gICAgICBvYmpba2V5XSA9IGl0ZW1ba2V5XTtcbiAgfSk7XG4gIHJldHVybiBvYmo7XG59O1xuXG51dGlscy5leHRlbmQgPSBmdW5jdGlvbiBleHRlbmQob2JqKSB7XG4gIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gaXRlbSkgb2JqW2tleV0gPSBpdGVtW2tleV07XG4gIH0pO1xuICByZXR1cm4gb2JqO1xufTtcblxudmFyIGh0bWxFc2NhcGVzID0ge1xuICAnJic6ICcmYW1wOycsXG4gICc8JzogJyZsdDsnLFxuICAnPic6ICcmZ3Q7JyxcbiAgJ1wiJzogJyZxdW90OycsXG4gIFwiJ1wiOiAnJiMzOTsnXG59O1xuXG51dGlscy5lc2NhcGUgPSBmdW5jdGlvbiBlc2NhcGUoc3RyaW5nKSB7XG4gIHJldHVybiBzdHJpbmcgPT0gbnVsbCA/ICcnIDogU3RyaW5nKHN0cmluZykucmVwbGFjZSgvWyY8PlwiJ10vZywgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICByZXR1cm4gaHRtbEVzY2FwZXNbbWF0Y2hdO1xuICB9KTtcbn07XG5cbnV0aWxzLnNvcnRCeSA9IGZ1bmN0aW9uKG9iaiwgdmFsdWUsIGNvbnRleHQpIHtcbiAgdmFyIGl0ZXJhdG9yID0gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nID8gdmFsdWUgOiBmdW5jdGlvbihvYmopeyByZXR1cm4gb2JqW3ZhbHVlXTsgfTtcbiAgcmV0dXJuIG9ialxuICAgIC5tYXAoZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgY3JpdGVyaWE6IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KVxuICAgICAgfTtcbiAgICB9KVxuICAgIC5zb3J0KGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWE7XG4gICAgICB2YXIgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgaWYgKGEgIT09IGIpIHtcbiAgICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHZvaWQgMCkgcmV0dXJuIDE7XG4gICAgICAgIGlmIChhIDwgYiB8fCBiID09PSB2b2lkIDApIHJldHVybiAtMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBsZWZ0LmluZGV4IC0gcmlnaHQuaW5kZXg7XG4gICAgfSlcbiAgICAubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLnZhbHVlO1xuICAgIH0pO1xufTtcblxuLyoqIFVzZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIElEcyAqL1xudmFyIGlkQ291bnRlciA9IDA7XG5cbnV0aWxzLnVuaXF1ZUlkID0gZnVuY3Rpb24gdW5pcXVlSWQocHJlZml4KSB7XG4gIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gIHJldHVybiBwcmVmaXggPyBwcmVmaXggKyBpZCA6IGlkO1xufTtcblxudXRpbHMuaGFzID0gZnVuY3Rpb24ob2JqLCBrZXkpIHtcbiAgcmV0dXJuIE9iamVjdC5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KTtcbn07XG5cbnZhciBlcSA9IGZ1bmN0aW9uKGEsIGIsIGFTdGFjaywgYlN0YWNrKSB7XG4gIC8vIElkZW50aWNhbCBvYmplY3RzIGFyZSBlcXVhbC4gYDAgPT09IC0wYCwgYnV0IHRoZXkgYXJlbid0IGlkZW50aWNhbC5cbiAgLy8gU2VlIHRoZSBbSGFybW9ueSBgZWdhbGAgcHJvcG9zYWxdKGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6ZWdhbCkuXG4gIGlmIChhID09PSBiKSByZXR1cm4gYSAhPT0gMCB8fCAxIC8gYSA9PSAxIC8gYjtcbiAgLy8gQSBzdHJpY3QgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkgYmVjYXVzZSBgbnVsbCA9PSB1bmRlZmluZWRgLlxuICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGEgPT09IGI7XG4gIC8vIFVud3JhcCBhbnkgd3JhcHBlZCBvYmplY3RzLlxuICAvL2lmIChhIGluc3RhbmNlb2YgXykgYSA9IGEuX3dyYXBwZWQ7XG4gIC8vaWYgKGIgaW5zdGFuY2VvZiBfKSBiID0gYi5fd3JhcHBlZDtcbiAgLy8gQ29tcGFyZSBgW1tDbGFzc11dYCBuYW1lcy5cbiAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwoYSk7XG4gIGlmIChjbGFzc05hbWUgIT0gdG9TdHJpbmcuY2FsbChiKSkgcmV0dXJuIGZhbHNlO1xuICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xuICAgIC8vIFN0cmluZ3MsIG51bWJlcnMsIGRhdGVzLCBhbmQgYm9vbGVhbnMgYXJlIGNvbXBhcmVkIGJ5IHZhbHVlLlxuICAgIGNhc2UgJ1tvYmplY3QgU3RyaW5nXSc6XG4gICAgICAvLyBQcmltaXRpdmVzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIG9iamVjdCB3cmFwcGVycyBhcmUgZXF1aXZhbGVudDsgdGh1cywgYFwiNVwiYCBpc1xuICAgICAgLy8gZXF1aXZhbGVudCB0byBgbmV3IFN0cmluZyhcIjVcIilgLlxuICAgICAgcmV0dXJuIGEgPT0gU3RyaW5nKGIpO1xuICAgIGNhc2UgJ1tvYmplY3QgTnVtYmVyXSc6XG4gICAgICAvLyBgTmFOYHMgYXJlIGVxdWl2YWxlbnQsIGJ1dCBub24tcmVmbGV4aXZlLiBBbiBgZWdhbGAgY29tcGFyaXNvbiBpcyBwZXJmb3JtZWQgZm9yXG4gICAgICAvLyBvdGhlciBudW1lcmljIHZhbHVlcy5cbiAgICAgIHJldHVybiBhICE9PSArYSA/IGIgIT09ICtiIDogKGEgPT09IDAgPyAxIC8gYSA9PT0gMSAvIGIgOiBhID09PSArYik7XG4gICAgY2FzZSAnW29iamVjdCBEYXRlXSc6XG4gICAgY2FzZSAnW29iamVjdCBCb29sZWFuXSc6XG4gICAgICAvLyBDb2VyY2UgZGF0ZXMgYW5kIGJvb2xlYW5zIHRvIG51bWVyaWMgcHJpbWl0aXZlIHZhbHVlcy4gRGF0ZXMgYXJlIGNvbXBhcmVkIGJ5IHRoZWlyXG4gICAgICAvLyBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnMuIE5vdGUgdGhhdCBpbnZhbGlkIGRhdGVzIHdpdGggbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zXG4gICAgICAvLyBvZiBgTmFOYCBhcmUgbm90IGVxdWl2YWxlbnQuXG4gICAgICByZXR1cm4gK2EgPT0gK2I7XG4gICAgLy8gUmVnRXhwcyBhcmUgY29tcGFyZWQgYnkgdGhlaXIgc291cmNlIHBhdHRlcm5zIGFuZCBmbGFncy5cbiAgICBjYXNlICdbb2JqZWN0IFJlZ0V4cF0nOlxuICAgICAgcmV0dXJuIGEuc291cmNlID09IGIuc291cmNlICYmXG4gICAgICAgICAgICAgYS5nbG9iYWwgPT0gYi5nbG9iYWwgJiZcbiAgICAgICAgICAgICBhLm11bHRpbGluZSA9PSBiLm11bHRpbGluZSAmJlxuICAgICAgICAgICAgIGEuaWdub3JlQ2FzZSA9PSBiLmlnbm9yZUNhc2U7XG4gIH1cbiAgaWYgKHR5cGVvZiBhICE9ICdvYmplY3QnIHx8IHR5cGVvZiBiICE9ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gIC8vIEFzc3VtZSBlcXVhbGl0eSBmb3IgY3ljbGljIHN0cnVjdHVyZXMuIFRoZSBhbGdvcml0aG0gZm9yIGRldGVjdGluZyBjeWNsaWNcbiAgLy8gc3RydWN0dXJlcyBpcyBhZGFwdGVkIGZyb20gRVMgNS4xIHNlY3Rpb24gMTUuMTIuMywgYWJzdHJhY3Qgb3BlcmF0aW9uIGBKT2AuXG4gIHZhciBsZW5ndGggPSBhU3RhY2subGVuZ3RoO1xuICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAvLyBMaW5lYXIgc2VhcmNoLiBQZXJmb3JtYW5jZSBpcyBpbnZlcnNlbHkgcHJvcG9ydGlvbmFsIHRvIHRoZSBudW1iZXIgb2ZcbiAgICAvLyB1bmlxdWUgbmVzdGVkIHN0cnVjdHVyZXMuXG4gICAgaWYgKGFTdGFja1tsZW5ndGhdID09IGEpIHJldHVybiBiU3RhY2tbbGVuZ3RoXSA9PSBiO1xuICB9XG4gIC8vIE9iamVjdHMgd2l0aCBkaWZmZXJlbnQgY29uc3RydWN0b3JzIGFyZSBub3QgZXF1aXZhbGVudCwgYnV0IGBPYmplY3Rgc1xuICAvLyBmcm9tIGRpZmZlcmVudCBmcmFtZXMgYXJlLlxuICB2YXIgYUN0b3IgPSBhLmNvbnN0cnVjdG9yLCBiQ3RvciA9IGIuY29uc3RydWN0b3I7XG4gIGlmIChhQ3RvciAhPT0gYkN0b3IgJiYgISh0eXBlb2YgYUN0b3IgPT09ICdmdW5jdGlvbicgJiYgKGFDdG9yIGluc3RhbmNlb2YgYUN0b3IpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgYkN0b3IgPT09ICdmdW5jdGlvbicgJiYgKGJDdG9yIGluc3RhbmNlb2YgYkN0b3IpKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvLyBBZGQgdGhlIGZpcnN0IG9iamVjdCB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gIGFTdGFjay5wdXNoKGEpO1xuICBiU3RhY2sucHVzaChiKTtcbiAgdmFyIHNpemUgPSAwLCByZXN1bHQgPSB0cnVlO1xuICAvLyBSZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cy5cbiAgaWYgKGNsYXNzTmFtZSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgIC8vIENvbXBhcmUgYXJyYXkgbGVuZ3RocyB0byBkZXRlcm1pbmUgaWYgYSBkZWVwIGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5LlxuICAgIHNpemUgPSBhLmxlbmd0aDtcbiAgICByZXN1bHQgPSBzaXplID09PSBiLmxlbmd0aDtcbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICAvLyBEZWVwIGNvbXBhcmUgdGhlIGNvbnRlbnRzLCBpZ25vcmluZyBub24tbnVtZXJpYyBwcm9wZXJ0aWVzLlxuICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICBpZiAoIShyZXN1bHQgPSBlcShhW3NpemVdLCBiW3NpemVdLCBhU3RhY2ssIGJTdGFjaykpKSBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gRGVlcCBjb21wYXJlIG9iamVjdHMuXG4gICAgZm9yICh2YXIga2V5IGluIGEpIHtcbiAgICAgIGlmIChfLmhhcyhhLCBrZXkpKSB7XG4gICAgICAgIC8vIENvdW50IHRoZSBleHBlY3RlZCBudW1iZXIgb2YgcHJvcGVydGllcy5cbiAgICAgICAgc2l6ZSsrO1xuICAgICAgICAvLyBEZWVwIGNvbXBhcmUgZWFjaCBtZW1iZXIuXG4gICAgICAgIGlmICghKHJlc3VsdCA9IF8uaGFzKGIsIGtleSkgJiYgZXEoYVtrZXldLCBiW2tleV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBFbnN1cmUgdGhhdCBib3RoIG9iamVjdHMgY29udGFpbiB0aGUgc2FtZSBudW1iZXIgb2YgcHJvcGVydGllcy5cbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICBmb3IgKGtleSBpbiBiKSB7XG4gICAgICAgIGlmIChfLmhhcyhiLCBrZXkpICYmICEoc2l6ZS0tKSkgYnJlYWs7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSAhc2l6ZTtcbiAgICB9XG4gIH1cbiAgLy8gUmVtb3ZlIHRoZSBmaXJzdCBvYmplY3QgZnJvbSB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gIGFTdGFjay5wb3AoKTtcbiAgYlN0YWNrLnBvcCgpO1xuICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gUGVyZm9ybSBhIGRlZXAgY29tcGFyaXNvbiB0byBjaGVjayBpZiB0d28gb2JqZWN0cyBhcmUgZXF1YWwuXG51dGlscy5pc0VxdWFsID0gZnVuY3Rpb24oYSwgYikge1xuICByZXR1cm4gZXEoYSwgYiwgW10sIFtdKTtcbn07XG4vLyBCYWNrYm9uZS5FdmVudHNcbi8vIC0tLS0tLS0tLS0tLS0tLVxuXG4vLyBBIG1vZHVsZSB0aGF0IGNhbiBiZSBtaXhlZCBpbiB0byAqYW55IG9iamVjdCogaW4gb3JkZXIgdG8gcHJvdmlkZSBpdCB3aXRoXG4vLyBjdXN0b20gZXZlbnRzLiBZb3UgbWF5IGJpbmQgd2l0aCBgb25gIG9yIHJlbW92ZSB3aXRoIGBvZmZgIGNhbGxiYWNrXG4vLyBmdW5jdGlvbnMgdG8gYW4gZXZlbnQ7IGB0cmlnZ2VyYC1pbmcgYW4gZXZlbnQgZmlyZXMgYWxsIGNhbGxiYWNrcyBpblxuLy8gc3VjY2Vzc2lvbi5cbi8vXG4vLyAgICAgdmFyIG9iamVjdCA9IHt9O1xuLy8gICAgIF8uZXh0ZW5kKG9iamVjdCwgQmFja2JvbmUuRXZlbnRzKTtcbi8vICAgICBvYmplY3Qub24oJ2V4cGFuZCcsIGZ1bmN0aW9uKCl7IGFsZXJ0KCdleHBhbmRlZCcpOyB9KTtcbi8vICAgICBvYmplY3QudHJpZ2dlcignZXhwYW5kJyk7XG4vL1xudmFyIEV2ZW50cyA9IEJhY2tib25lLkV2ZW50cyA9IHtcblxuICAvLyBCaW5kIGFuIGV2ZW50IHRvIGEgYGNhbGxiYWNrYCBmdW5jdGlvbi4gUGFzc2luZyBgXCJhbGxcImAgd2lsbCBiaW5kXG4gIC8vIHRoZSBjYWxsYmFjayB0byBhbGwgZXZlbnRzIGZpcmVkLlxuICBvbjogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBpZiAoIWV2ZW50c0FwaSh0aGlzLCAnb24nLCBuYW1lLCBbY2FsbGJhY2ssIGNvbnRleHRdKSB8fCAhY2FsbGJhY2spIHJldHVybiB0aGlzO1xuICAgIHRoaXMuX2V2ZW50cyB8fCAodGhpcy5fZXZlbnRzID0ge30pO1xuICAgIHZhciBldmVudHMgPSB0aGlzLl9ldmVudHNbbmFtZV0gfHwgKHRoaXMuX2V2ZW50c1tuYW1lXSA9IFtdKTtcbiAgICBldmVudHMucHVzaCh7Y2FsbGJhY2s6IGNhbGxiYWNrLCBjb250ZXh0OiBjb250ZXh0LCBjdHg6IGNvbnRleHQgfHwgdGhpc30pO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIEJpbmQgYW4gZXZlbnQgdG8gb25seSBiZSB0cmlnZ2VyZWQgYSBzaW5nbGUgdGltZS4gQWZ0ZXIgdGhlIGZpcnN0IHRpbWVcbiAgLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQsIGl0IHdpbGwgYmUgcmVtb3ZlZC5cbiAgb25jZTogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBpZiAoIWV2ZW50c0FwaSh0aGlzLCAnb25jZScsIG5hbWUsIFtjYWxsYmFjaywgY29udGV4dF0pIHx8ICFjYWxsYmFjaykgcmV0dXJuIHRoaXM7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciByYW47XG4gICAgdmFyIG9uY2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChyYW4pIHJldHVybjtcbiAgICAgIHJhbiA9IHRydWU7XG4gICAgICBzZWxmLm9mZihuYW1lLCBvbmNlKTtcbiAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgICBvbmNlLl9jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIHJldHVybiB0aGlzLm9uKG5hbWUsIG9uY2UsIGNvbnRleHQpO1xuICB9LFxuXG4gIC8vIFJlbW92ZSBvbmUgb3IgbWFueSBjYWxsYmFja3MuIElmIGBjb250ZXh0YCBpcyBudWxsLCByZW1vdmVzIGFsbFxuICAvLyBjYWxsYmFja3Mgd2l0aCB0aGF0IGZ1bmN0aW9uLiBJZiBgY2FsbGJhY2tgIGlzIG51bGwsIHJlbW92ZXMgYWxsXG4gIC8vIGNhbGxiYWNrcyBmb3IgdGhlIGV2ZW50LiBJZiBgbmFtZWAgaXMgbnVsbCwgcmVtb3ZlcyBhbGwgYm91bmRcbiAgLy8gY2FsbGJhY2tzIGZvciBhbGwgZXZlbnRzLlxuICBvZmY6IGZ1bmN0aW9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgdmFyIHJldGFpbiwgZXYsIGV2ZW50cywgbmFtZXMsIGksIGwsIGosIGs7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIWV2ZW50c0FwaSh0aGlzLCAnb2ZmJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkpIHJldHVybiB0aGlzO1xuICAgIGlmICghbmFtZSAmJiAhY2FsbGJhY2sgJiYgIWNvbnRleHQpIHtcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHZvaWQgMDtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBuYW1lcyA9IG5hbWUgPyBbbmFtZV0gOiBPYmplY3Qua2V5cyh0aGlzLl9ldmVudHMpO1xuICAgIGZvciAoaSA9IDAsIGwgPSBuYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIG5hbWUgPSBuYW1lc1tpXTtcbiAgICAgIGlmIChldmVudHMgPSB0aGlzLl9ldmVudHNbbmFtZV0pIHtcbiAgICAgICAgdGhpcy5fZXZlbnRzW25hbWVdID0gcmV0YWluID0gW107XG4gICAgICAgIGlmIChjYWxsYmFjayB8fCBjb250ZXh0KSB7XG4gICAgICAgICAgZm9yIChqID0gMCwgayA9IGV2ZW50cy5sZW5ndGg7IGogPCBrOyBqKyspIHtcbiAgICAgICAgICAgIGV2ID0gZXZlbnRzW2pdO1xuICAgICAgICAgICAgaWYgKChjYWxsYmFjayAmJiBjYWxsYmFjayAhPT0gZXYuY2FsbGJhY2sgJiYgY2FsbGJhY2sgIT09IGV2LmNhbGxiYWNrLl9jYWxsYmFjaykgfHxcbiAgICAgICAgICAgICAgICAoY29udGV4dCAmJiBjb250ZXh0ICE9PSBldi5jb250ZXh0KSkge1xuICAgICAgICAgICAgICByZXRhaW4ucHVzaChldik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghcmV0YWluLmxlbmd0aCkgZGVsZXRlIHRoaXMuX2V2ZW50c1tuYW1lXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBUcmlnZ2VyIG9uZSBvciBtYW55IGV2ZW50cywgZmlyaW5nIGFsbCBib3VuZCBjYWxsYmFja3MuIENhbGxiYWNrcyBhcmVcbiAgLy8gcGFzc2VkIHRoZSBzYW1lIGFyZ3VtZW50cyBhcyBgdHJpZ2dlcmAgaXMsIGFwYXJ0IGZyb20gdGhlIGV2ZW50IG5hbWVcbiAgLy8gKHVubGVzcyB5b3UncmUgbGlzdGVuaW5nIG9uIGBcImFsbFwiYCwgd2hpY2ggd2lsbCBjYXVzZSB5b3VyIGNhbGxiYWNrIHRvXG4gIC8vIHJlY2VpdmUgdGhlIHRydWUgbmFtZSBvZiB0aGUgZXZlbnQgYXMgdGhlIGZpcnN0IGFyZ3VtZW50KS5cbiAgdHJpZ2dlcjogZnVuY3Rpb24obmFtZSkge1xuICAgIGlmICghdGhpcy5fZXZlbnRzKSByZXR1cm4gdGhpcztcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBpZiAoIWV2ZW50c0FwaSh0aGlzLCAndHJpZ2dlcicsIG5hbWUsIGFyZ3MpKSByZXR1cm4gdGhpcztcbiAgICB2YXIgZXZlbnRzID0gdGhpcy5fZXZlbnRzW25hbWVdO1xuICAgIHZhciBhbGxFdmVudHMgPSB0aGlzLl9ldmVudHMuYWxsO1xuICAgIGlmIChldmVudHMpIHRyaWdnZXJFdmVudHMoZXZlbnRzLCBhcmdzKTtcbiAgICBpZiAoYWxsRXZlbnRzKSB0cmlnZ2VyRXZlbnRzKGFsbEV2ZW50cywgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBUZWxsIHRoaXMgb2JqZWN0IHRvIHN0b3AgbGlzdGVuaW5nIHRvIGVpdGhlciBzcGVjaWZpYyBldmVudHMgLi4uIG9yXG4gIC8vIHRvIGV2ZXJ5IG9iamVjdCBpdCdzIGN1cnJlbnRseSBsaXN0ZW5pbmcgdG8uXG4gIHN0b3BMaXN0ZW5pbmc6IGZ1bmN0aW9uKG9iaiwgbmFtZSwgY2FsbGJhY2spIHtcbiAgICB2YXIgbGlzdGVuaW5nVG8gPSB0aGlzLl9saXN0ZW5pbmdUbztcbiAgICBpZiAoIWxpc3RlbmluZ1RvKSByZXR1cm4gdGhpcztcbiAgICB2YXIgcmVtb3ZlID0gIW5hbWUgJiYgIWNhbGxiYWNrO1xuICAgIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSBjYWxsYmFjayA9IHRoaXM7XG4gICAgaWYgKG9iaikgKGxpc3RlbmluZ1RvID0ge30pW29iai5fbGlzdGVuSWRdID0gb2JqO1xuICAgIGZvciAodmFyIGlkIGluIGxpc3RlbmluZ1RvKSB7XG4gICAgICBvYmogPSBsaXN0ZW5pbmdUb1tpZF07XG4gICAgICBvYmoub2ZmKG5hbWUsIGNhbGxiYWNrLCB0aGlzKTtcbiAgICAgIGlmIChyZW1vdmUgfHwgIU9iamVjdC5rZXlzKG9iai5fZXZlbnRzKS5sZW5ndGgpIGRlbGV0ZSB0aGlzLl9saXN0ZW5pbmdUb1tpZF07XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbn07XG5cbi8vIFJlZ3VsYXIgZXhwcmVzc2lvbiB1c2VkIHRvIHNwbGl0IGV2ZW50IHN0cmluZ3MuXG52YXIgZXZlbnRTcGxpdHRlciA9IC9cXHMrLztcblxuLy8gSW1wbGVtZW50IGZhbmN5IGZlYXR1cmVzIG9mIHRoZSBFdmVudHMgQVBJIHN1Y2ggYXMgbXVsdGlwbGUgZXZlbnRcbi8vIG5hbWVzIGBcImNoYW5nZSBibHVyXCJgIGFuZCBqUXVlcnktc3R5bGUgZXZlbnQgbWFwcyBge2NoYW5nZTogYWN0aW9ufWBcbi8vIGluIHRlcm1zIG9mIHRoZSBleGlzdGluZyBBUEkuXG52YXIgZXZlbnRzQXBpID0gZnVuY3Rpb24ob2JqLCBhY3Rpb24sIG5hbWUsIHJlc3QpIHtcbiAgaWYgKCFuYW1lKSByZXR1cm4gdHJ1ZTtcblxuICAvLyBIYW5kbGUgZXZlbnQgbWFwcy5cbiAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgIGZvciAodmFyIGtleSBpbiBuYW1lKSB7XG4gICAgICBvYmpbYWN0aW9uXS5hcHBseShvYmosIFtrZXksIG5hbWVba2V5XV0uY29uY2F0KHJlc3QpKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gSGFuZGxlIHNwYWNlIHNlcGFyYXRlZCBldmVudCBuYW1lcy5cbiAgaWYgKGV2ZW50U3BsaXR0ZXIudGVzdChuYW1lKSkge1xuICAgIHZhciBuYW1lcyA9IG5hbWUuc3BsaXQoZXZlbnRTcGxpdHRlcik7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBuYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIG9ialthY3Rpb25dLmFwcGx5KG9iaiwgW25hbWVzW2ldXS5jb25jYXQocmVzdCkpO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8vIEEgZGlmZmljdWx0LXRvLWJlbGlldmUsIGJ1dCBvcHRpbWl6ZWQgaW50ZXJuYWwgZGlzcGF0Y2ggZnVuY3Rpb24gZm9yXG4vLyB0cmlnZ2VyaW5nIGV2ZW50cy4gVHJpZXMgdG8ga2VlcCB0aGUgdXN1YWwgY2FzZXMgc3BlZWR5IChtb3N0IGludGVybmFsXG4vLyBCYWNrYm9uZSBldmVudHMgaGF2ZSAzIGFyZ3VtZW50cykuXG52YXIgdHJpZ2dlckV2ZW50cyA9IGZ1bmN0aW9uKGV2ZW50cywgYXJncykge1xuICB2YXIgZXYsIGkgPSAtMSwgbCA9IGV2ZW50cy5sZW5ndGgsIGExID0gYXJnc1swXSwgYTIgPSBhcmdzWzFdLCBhMyA9IGFyZ3NbMl07XG4gIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICBjYXNlIDA6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4KTsgcmV0dXJuO1xuICAgIGNhc2UgMTogd2hpbGUgKCsraSA8IGwpIChldiA9IGV2ZW50c1tpXSkuY2FsbGJhY2suY2FsbChldi5jdHgsIGExKTsgcmV0dXJuO1xuICAgIGNhc2UgMjogd2hpbGUgKCsraSA8IGwpIChldiA9IGV2ZW50c1tpXSkuY2FsbGJhY2suY2FsbChldi5jdHgsIGExLCBhMik7IHJldHVybjtcbiAgICBjYXNlIDM6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSwgYTIsIGEzKTsgcmV0dXJuO1xuICAgIGRlZmF1bHQ6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmFwcGx5KGV2LmN0eCwgYXJncyk7IHJldHVybjtcbiAgfVxufTtcblxudmFyIGxpc3Rlbk1ldGhvZHMgPSB7bGlzdGVuVG86ICdvbicsIGxpc3RlblRvT25jZTogJ29uY2UnfTtcblxuLy8gSW52ZXJzaW9uLW9mLWNvbnRyb2wgdmVyc2lvbnMgb2YgYG9uYCBhbmQgYG9uY2VgLiBUZWxsICp0aGlzKiBvYmplY3QgdG9cbi8vIGxpc3RlbiB0byBhbiBldmVudCBpbiBhbm90aGVyIG9iamVjdCAuLi4ga2VlcGluZyB0cmFjayBvZiB3aGF0IGl0J3Ncbi8vIGxpc3RlbmluZyB0by5cbk9iamVjdC5rZXlzKGxpc3Rlbk1ldGhvZHMpLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gIHZhciBpbXBsZW1lbnRhdGlvbiA9IGxpc3Rlbk1ldGhvZHNbbWV0aG9kXTtcbiAgRXZlbnRzW21ldGhvZF0gPSBmdW5jdGlvbihvYmosIG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGxpc3RlbmluZ1RvID0gdGhpcy5fbGlzdGVuaW5nVG8gfHwgKHRoaXMuX2xpc3RlbmluZ1RvID0ge30pO1xuICAgIHZhciBpZCA9IG9iai5fbGlzdGVuSWQgfHwgKG9iai5fbGlzdGVuSWQgPSBfLnVuaXF1ZUlkKCdsJykpO1xuICAgIGxpc3RlbmluZ1RvW2lkXSA9IG9iajtcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JykgY2FsbGJhY2sgPSB0aGlzO1xuICAgIG9ialtpbXBsZW1lbnRhdGlvbl0obmFtZSwgY2FsbGJhY2ssIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xufSk7XG5cbi8vIEFsaWFzZXMgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuRXZlbnRzLmJpbmQgICA9IEV2ZW50cy5vbjtcbkV2ZW50cy51bmJpbmQgPSBFdmVudHMub2ZmO1xuXG4vLyBBbGxvdyB0aGUgYEJhY2tib25lYCBvYmplY3QgdG8gc2VydmUgYXMgYSBnbG9iYWwgZXZlbnQgYnVzLCBmb3IgZm9sa3Mgd2hvXG4vLyB3YW50IGdsb2JhbCBcInB1YnN1YlwiIGluIGEgY29udmVuaWVudCBwbGFjZS5cbl8uZXh0ZW5kKEJhY2tib25lLCBFdmVudHMpO1xuLy8gQmFja2JvbmUuTW9kZWxcbi8vIC0tLS0tLS0tLS0tLS0tXG5cbi8vIEJhY2tib25lICoqTW9kZWxzKiogYXJlIHRoZSBiYXNpYyBkYXRhIG9iamVjdCBpbiB0aGUgZnJhbWV3b3JrIC0tXG4vLyBmcmVxdWVudGx5IHJlcHJlc2VudGluZyBhIHJvdyBpbiBhIHRhYmxlIGluIGEgZGF0YWJhc2Ugb24geW91ciBzZXJ2ZXIuXG4vLyBBIGRpc2NyZXRlIGNodW5rIG9mIGRhdGEgYW5kIGEgYnVuY2ggb2YgdXNlZnVsLCByZWxhdGVkIG1ldGhvZHMgZm9yXG4vLyBwZXJmb3JtaW5nIGNvbXB1dGF0aW9ucyBhbmQgdHJhbnNmb3JtYXRpb25zIG9uIHRoYXQgZGF0YS5cblxuLy8gQ3JlYXRlIGEgbmV3IG1vZGVsIHdpdGggdGhlIHNwZWNpZmllZCBhdHRyaWJ1dGVzLiBBIGNsaWVudCBpZCAoYGNpZGApXG4vLyBpcyBhdXRvbWF0aWNhbGx5IGdlbmVyYXRlZCBhbmQgYXNzaWduZWQgZm9yIHlvdS5cbnZhciBNb2RlbCA9IEJhY2tib25lLk1vZGVsID0gZnVuY3Rpb24oYXR0cmlidXRlcywgb3B0aW9ucykge1xuICB2YXIgYXR0cnMgPSBhdHRyaWJ1dGVzIHx8IHt9O1xuICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuICB0aGlzLmNpZCA9IF8udW5pcXVlSWQoJ2MnKTtcbiAgdGhpcy5hdHRyaWJ1dGVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgaWYgKG9wdGlvbnMuY29sbGVjdGlvbikgdGhpcy5jb2xsZWN0aW9uID0gb3B0aW9ucy5jb2xsZWN0aW9uO1xuICBpZiAob3B0aW9ucy5wYXJzZSkgYXR0cnMgPSB0aGlzLnBhcnNlKGF0dHJzLCBvcHRpb25zKSB8fCB7fTtcbiAgYXR0cnMgPSBfLmRlZmF1bHRzKHt9LCBhdHRycywgXy5yZXN1bHQodGhpcywgJ2RlZmF1bHRzJykpO1xuICB0aGlzLnNldChhdHRycywgb3B0aW9ucyk7XG4gIHRoaXMuY2hhbmdlZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIHRoaXMuaW5pdGlhbGl6ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuLy8gQXR0YWNoIGFsbCBpbmhlcml0YWJsZSBtZXRob2RzIHRvIHRoZSBNb2RlbCBwcm90b3R5cGUuXG5fLmV4dGVuZChNb2RlbC5wcm90b3R5cGUsIEV2ZW50cywge1xuXG4gIC8vIEEgaGFzaCBvZiBhdHRyaWJ1dGVzIHdob3NlIGN1cnJlbnQgYW5kIHByZXZpb3VzIHZhbHVlIGRpZmZlci5cbiAgY2hhbmdlZDogbnVsbCxcblxuICAvLyBUaGUgdmFsdWUgcmV0dXJuZWQgZHVyaW5nIHRoZSBsYXN0IGZhaWxlZCB2YWxpZGF0aW9uLlxuICB2YWxpZGF0aW9uRXJyb3I6IG51bGwsXG5cbiAgLy8gVGhlIGRlZmF1bHQgbmFtZSBmb3IgdGhlIEpTT04gYGlkYCBhdHRyaWJ1dGUgaXMgYFwiaWRcImAuIE1vbmdvREIgYW5kXG4gIC8vIENvdWNoREIgdXNlcnMgbWF5IHdhbnQgdG8gc2V0IHRoaXMgdG8gYFwiX2lkXCJgLlxuICBpZEF0dHJpYnV0ZTogJ2lkJyxcblxuICAvLyBJbml0aWFsaXplIGlzIGFuIGVtcHR5IGZ1bmN0aW9uIGJ5IGRlZmF1bHQuIE92ZXJyaWRlIGl0IHdpdGggeW91ciBvd25cbiAgLy8gaW5pdGlhbGl6YXRpb24gbG9naWMuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKCl7fSxcblxuICAvLyBSZXR1cm4gYSBjb3B5IG9mIHRoZSBtb2RlbCdzIGBhdHRyaWJ1dGVzYCBvYmplY3QuXG4gIHRvSlNPTjogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHJldHVybiBfLmV4dGVuZCh7fSwgdGhpcy5hdHRyaWJ1dGVzKTtcbiAgfSxcblxuICAvLyBQcm94eSBgQmFja2JvbmUuc3luY2AgYnkgZGVmYXVsdCAtLSBidXQgb3ZlcnJpZGUgdGhpcyBpZiB5b3UgbmVlZFxuICAvLyBjdXN0b20gc3luY2luZyBzZW1hbnRpY3MgZm9yICp0aGlzKiBwYXJ0aWN1bGFyIG1vZGVsLlxuICBzeW5jOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gQmFja2JvbmUuc3luYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9LFxuXG4gIC8vIEdldCB0aGUgdmFsdWUgb2YgYW4gYXR0cmlidXRlLlxuICBnZXQ6IGZ1bmN0aW9uKGF0dHIpIHtcbiAgICByZXR1cm4gdGhpcy5hdHRyaWJ1dGVzW2F0dHJdO1xuICB9LFxuXG4gIC8vIEdldCB0aGUgSFRNTC1lc2NhcGVkIHZhbHVlIG9mIGFuIGF0dHJpYnV0ZS5cbiAgZXNjYXBlOiBmdW5jdGlvbihhdHRyKSB7XG4gICAgcmV0dXJuIF8uZXNjYXBlKHRoaXMuZ2V0KGF0dHIpKTtcbiAgfSxcblxuICAvLyBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYXR0cmlidXRlIGNvbnRhaW5zIGEgdmFsdWUgdGhhdCBpcyBub3QgbnVsbFxuICAvLyBvciB1bmRlZmluZWQuXG4gIGhhczogZnVuY3Rpb24oYXR0cikge1xuICAgIHJldHVybiB0aGlzLmdldChhdHRyKSAhPSBudWxsO1xuICB9LFxuXG4gIC8vIFNldCBhIGhhc2ggb2YgbW9kZWwgYXR0cmlidXRlcyBvbiB0aGUgb2JqZWN0LCBmaXJpbmcgYFwiY2hhbmdlXCJgLiBUaGlzIGlzXG4gIC8vIHRoZSBjb3JlIHByaW1pdGl2ZSBvcGVyYXRpb24gb2YgYSBtb2RlbCwgdXBkYXRpbmcgdGhlIGRhdGEgYW5kIG5vdGlmeWluZ1xuICAvLyBhbnlvbmUgd2hvIG5lZWRzIHRvIGtub3cgYWJvdXQgdGhlIGNoYW5nZSBpbiBzdGF0ZS4gVGhlIGhlYXJ0IG9mIHRoZSBiZWFzdC5cbiAgc2V0OiBmdW5jdGlvbihrZXksIHZhbCwgb3B0aW9ucykge1xuICAgIHZhciBhdHRyLCBhdHRycywgdW5zZXQsIGNoYW5nZXMsIHNpbGVudCwgY2hhbmdpbmcsIHByZXYsIGN1cnJlbnQ7XG4gICAgaWYgKGtleSA9PSBudWxsKSByZXR1cm4gdGhpcztcblxuICAgIC8vIEhhbmRsZSBib3RoIGBcImtleVwiLCB2YWx1ZWAgYW5kIGB7a2V5OiB2YWx1ZX1gIC1zdHlsZSBhcmd1bWVudHMuXG4gICAgaWYgKHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSB7XG4gICAgICBhdHRycyA9IGtleTtcbiAgICAgIG9wdGlvbnMgPSB2YWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIChhdHRycyA9IHt9KVtrZXldID0gdmFsO1xuICAgIH1cblxuICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG5cbiAgICAvLyBSdW4gdmFsaWRhdGlvbi5cbiAgICBpZiAoIXRoaXMuX3ZhbGlkYXRlKGF0dHJzLCBvcHRpb25zKSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gRXh0cmFjdCBhdHRyaWJ1dGVzIGFuZCBvcHRpb25zLlxuICAgIHVuc2V0ICAgICAgICAgICA9IG9wdGlvbnMudW5zZXQ7XG4gICAgc2lsZW50ICAgICAgICAgID0gb3B0aW9ucy5zaWxlbnQ7XG4gICAgY2hhbmdlcyAgICAgICAgID0gW107XG4gICAgY2hhbmdpbmcgICAgICAgID0gdGhpcy5fY2hhbmdpbmc7XG4gICAgdGhpcy5fY2hhbmdpbmcgID0gdHJ1ZTtcblxuICAgIGlmICghY2hhbmdpbmcpIHtcbiAgICAgIHRoaXMuX3ByZXZpb3VzQXR0cmlidXRlcyA9IF8uZXh0ZW5kKE9iamVjdC5jcmVhdGUobnVsbCksIHRoaXMuYXR0cmlidXRlcyk7XG4gICAgICB0aGlzLmNoYW5nZWQgPSB7fTtcbiAgICB9XG4gICAgY3VycmVudCA9IHRoaXMuYXR0cmlidXRlcywgcHJldiA9IHRoaXMuX3ByZXZpb3VzQXR0cmlidXRlcztcblxuICAgIC8vIENoZWNrIGZvciBjaGFuZ2VzIG9mIGBpZGAuXG4gICAgaWYgKHRoaXMuaWRBdHRyaWJ1dGUgaW4gYXR0cnMpIHRoaXMuaWQgPSBhdHRyc1t0aGlzLmlkQXR0cmlidXRlXTtcblxuICAgIC8vIEZvciBlYWNoIGBzZXRgIGF0dHJpYnV0ZSwgdXBkYXRlIG9yIGRlbGV0ZSB0aGUgY3VycmVudCB2YWx1ZS5cbiAgICBmb3IgKGF0dHIgaW4gYXR0cnMpIHtcbiAgICAgIHZhbCA9IGF0dHJzW2F0dHJdO1xuICAgICAgaWYgKCFfLmlzRXF1YWwoY3VycmVudFthdHRyXSwgdmFsKSkgY2hhbmdlcy5wdXNoKGF0dHIpO1xuICAgICAgaWYgKCFfLmlzRXF1YWwocHJldlthdHRyXSwgdmFsKSkge1xuICAgICAgICB0aGlzLmNoYW5nZWRbYXR0cl0gPSB2YWw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWxldGUgdGhpcy5jaGFuZ2VkW2F0dHJdO1xuICAgICAgfVxuICAgICAgdW5zZXQgPyBkZWxldGUgY3VycmVudFthdHRyXSA6IGN1cnJlbnRbYXR0cl0gPSB2YWw7XG4gICAgfVxuXG4gICAgLy8gVHJpZ2dlciBhbGwgcmVsZXZhbnQgYXR0cmlidXRlIGNoYW5nZXMuXG4gICAgaWYgKCFzaWxlbnQpIHtcbiAgICAgIGlmIChjaGFuZ2VzLmxlbmd0aCkgdGhpcy5fcGVuZGluZyA9IG9wdGlvbnM7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNoYW5nZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlOicgKyBjaGFuZ2VzW2ldLCB0aGlzLCBjdXJyZW50W2NoYW5nZXNbaV1dLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBZb3UgbWlnaHQgYmUgd29uZGVyaW5nIHdoeSB0aGVyZSdzIGEgYHdoaWxlYCBsb29wIGhlcmUuIENoYW5nZXMgY2FuXG4gICAgLy8gYmUgcmVjdXJzaXZlbHkgbmVzdGVkIHdpdGhpbiBgXCJjaGFuZ2VcImAgZXZlbnRzLlxuICAgIGlmIChjaGFuZ2luZykgcmV0dXJuIHRoaXM7XG4gICAgaWYgKCFzaWxlbnQpIHtcbiAgICAgIHdoaWxlICh0aGlzLl9wZW5kaW5nKSB7XG4gICAgICAgIG9wdGlvbnMgPSB0aGlzLl9wZW5kaW5nO1xuICAgICAgICB0aGlzLl9wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlJywgdGhpcywgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX3BlbmRpbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9jaGFuZ2luZyA9IGZhbHNlO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIFJlbW92ZSBhbiBhdHRyaWJ1dGUgZnJvbSB0aGUgbW9kZWwsIGZpcmluZyBgXCJjaGFuZ2VcImAuIGB1bnNldGAgaXMgYSBub29wXG4gIC8vIGlmIHRoZSBhdHRyaWJ1dGUgZG9lc24ndCBleGlzdC5cbiAgdW5zZXQ6IGZ1bmN0aW9uKGF0dHIsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5zZXQoYXR0ciwgdm9pZCAwLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywge3Vuc2V0OiB0cnVlfSkpO1xuICB9LFxuXG4gIC8vIENsZWFyIGFsbCBhdHRyaWJ1dGVzIG9uIHRoZSBtb2RlbCwgZmlyaW5nIGBcImNoYW5nZVwiYC5cbiAgY2xlYXI6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB2YXIgYXR0cnMgPSB7fTtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5hdHRyaWJ1dGVzKSBhdHRyc1trZXldID0gdm9pZCAwO1xuICAgIHJldHVybiB0aGlzLnNldChhdHRycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIHt1bnNldDogdHJ1ZX0pKTtcbiAgfSxcblxuICAvLyBEZXRlcm1pbmUgaWYgdGhlIG1vZGVsIGhhcyBjaGFuZ2VkIHNpbmNlIHRoZSBsYXN0IGBcImNoYW5nZVwiYCBldmVudC5cbiAgLy8gSWYgeW91IHNwZWNpZnkgYW4gYXR0cmlidXRlIG5hbWUsIGRldGVybWluZSBpZiB0aGF0IGF0dHJpYnV0ZSBoYXMgY2hhbmdlZC5cbiAgaGFzQ2hhbmdlZDogZnVuY3Rpb24oYXR0cikge1xuICAgIGlmIChhdHRyID09IG51bGwpIHJldHVybiAhIU9iamVjdC5rZXlzKHRoaXMuY2hhbmdlZCkubGVuZ3RoO1xuICAgIHJldHVybiBfLmhhcyh0aGlzLmNoYW5nZWQsIGF0dHIpO1xuICB9LFxuXG4gIC8vIFJldHVybiBhbiBvYmplY3QgY29udGFpbmluZyBhbGwgdGhlIGF0dHJpYnV0ZXMgdGhhdCBoYXZlIGNoYW5nZWQsIG9yXG4gIC8vIGZhbHNlIGlmIHRoZXJlIGFyZSBubyBjaGFuZ2VkIGF0dHJpYnV0ZXMuIFVzZWZ1bCBmb3IgZGV0ZXJtaW5pbmcgd2hhdFxuICAvLyBwYXJ0cyBvZiBhIHZpZXcgbmVlZCB0byBiZSB1cGRhdGVkIGFuZC9vciB3aGF0IGF0dHJpYnV0ZXMgbmVlZCB0byBiZVxuICAvLyBwZXJzaXN0ZWQgdG8gdGhlIHNlcnZlci4gVW5zZXQgYXR0cmlidXRlcyB3aWxsIGJlIHNldCB0byB1bmRlZmluZWQuXG4gIC8vIFlvdSBjYW4gYWxzbyBwYXNzIGFuIGF0dHJpYnV0ZXMgb2JqZWN0IHRvIGRpZmYgYWdhaW5zdCB0aGUgbW9kZWwsXG4gIC8vIGRldGVybWluaW5nIGlmIHRoZXJlICp3b3VsZCBiZSogYSBjaGFuZ2UuXG4gIGNoYW5nZWRBdHRyaWJ1dGVzOiBmdW5jdGlvbihkaWZmKSB7XG4gICAgaWYgKCFkaWZmKSByZXR1cm4gdGhpcy5oYXNDaGFuZ2VkKCkgPyBfLmV4dGVuZChPYmplY3QuY3JlYXRlKG51bGwpLCB0aGlzLmNoYW5nZWQpIDogZmFsc2U7XG4gICAgdmFyIHZhbCwgY2hhbmdlZCA9IGZhbHNlO1xuICAgIHZhciBvbGQgPSB0aGlzLl9jaGFuZ2luZyA/IHRoaXMuX3ByZXZpb3VzQXR0cmlidXRlcyA6IHRoaXMuYXR0cmlidXRlcztcbiAgICBmb3IgKHZhciBhdHRyIGluIGRpZmYpIHtcbiAgICAgIGlmIChfLmlzRXF1YWwob2xkW2F0dHJdLCAodmFsID0gZGlmZlthdHRyXSkpKSBjb250aW51ZTtcbiAgICAgIChjaGFuZ2VkIHx8IChjaGFuZ2VkID0ge30pKVthdHRyXSA9IHZhbDtcbiAgICB9XG4gICAgcmV0dXJuIGNoYW5nZWQ7XG4gIH0sXG5cbiAgLy8gR2V0IHRoZSBwcmV2aW91cyB2YWx1ZSBvZiBhbiBhdHRyaWJ1dGUsIHJlY29yZGVkIGF0IHRoZSB0aW1lIHRoZSBsYXN0XG4gIC8vIGBcImNoYW5nZVwiYCBldmVudCB3YXMgZmlyZWQuXG4gIHByZXZpb3VzOiBmdW5jdGlvbihhdHRyKSB7XG4gICAgaWYgKGF0dHIgPT0gbnVsbCB8fCAhdGhpcy5fcHJldmlvdXNBdHRyaWJ1dGVzKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gdGhpcy5fcHJldmlvdXNBdHRyaWJ1dGVzW2F0dHJdO1xuICB9LFxuXG4gIC8vIEdldCBhbGwgb2YgdGhlIGF0dHJpYnV0ZXMgb2YgdGhlIG1vZGVsIGF0IHRoZSB0aW1lIG9mIHRoZSBwcmV2aW91c1xuICAvLyBgXCJjaGFuZ2VcImAgZXZlbnQuXG4gIHByZXZpb3VzQXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF8uZXh0ZW5kKE9iamVjdC5jcmVhdGUobnVsbCksIHRoaXMuX3ByZXZpb3VzQXR0cmlidXRlcyk7XG4gIH0sXG5cbiAgLy8gRmV0Y2ggdGhlIG1vZGVsIGZyb20gdGhlIHNlcnZlci4gSWYgdGhlIHNlcnZlcidzIHJlcHJlc2VudGF0aW9uIG9mIHRoZVxuICAvLyBtb2RlbCBkaWZmZXJzIGZyb20gaXRzIGN1cnJlbnQgYXR0cmlidXRlcywgdGhleSB3aWxsIGJlIG92ZXJyaWRkZW4sXG4gIC8vIHRyaWdnZXJpbmcgYSBgXCJjaGFuZ2VcImAgZXZlbnQuXG4gIGZldGNoOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgPyBfLmV4dGVuZCh7fSwgb3B0aW9ucykgOiB7fTtcbiAgICBpZiAob3B0aW9ucy5wYXJzZSA9PT0gdm9pZCAwKSBvcHRpb25zLnBhcnNlID0gdHJ1ZTtcbiAgICB2YXIgbW9kZWwgPSB0aGlzO1xuICAgIHZhciBzdWNjZXNzID0gb3B0aW9ucy5zdWNjZXNzO1xuICAgIG9wdGlvbnMuc3VjY2VzcyA9IGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgIGlmICghbW9kZWwuc2V0KG1vZGVsLnBhcnNlKHJlc3AsIG9wdGlvbnMpLCBvcHRpb25zKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKHN1Y2Nlc3MpIHN1Y2Nlc3MobW9kZWwsIHJlc3AsIG9wdGlvbnMpO1xuICAgICAgbW9kZWwudHJpZ2dlcignc3luYycsIG1vZGVsLCByZXNwLCBvcHRpb25zKTtcbiAgICB9O1xuICAgIHdyYXBFcnJvcih0aGlzLCBvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5zeW5jKCdyZWFkJywgdGhpcywgb3B0aW9ucyk7XG4gIH0sXG5cbiAgLy8gU2V0IGEgaGFzaCBvZiBtb2RlbCBhdHRyaWJ1dGVzLCBhbmQgc3luYyB0aGUgbW9kZWwgdG8gdGhlIHNlcnZlci5cbiAgLy8gSWYgdGhlIHNlcnZlciByZXR1cm5zIGFuIGF0dHJpYnV0ZXMgaGFzaCB0aGF0IGRpZmZlcnMsIHRoZSBtb2RlbCdzXG4gIC8vIHN0YXRlIHdpbGwgYmUgYHNldGAgYWdhaW4uXG4gIHNhdmU6IGZ1bmN0aW9uKGtleSwgdmFsLCBvcHRpb25zKSB7XG4gICAgdmFyIGF0dHJzLCBtZXRob2QsIHhociwgYXR0cmlidXRlcyA9IHRoaXMuYXR0cmlidXRlcztcblxuICAgIC8vIEhhbmRsZSBib3RoIGBcImtleVwiLCB2YWx1ZWAgYW5kIGB7a2V5OiB2YWx1ZX1gIC1zdHlsZSBhcmd1bWVudHMuXG4gICAgaWYgKGtleSA9PSBudWxsIHx8IHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSB7XG4gICAgICBhdHRycyA9IGtleTtcbiAgICAgIG9wdGlvbnMgPSB2YWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIChhdHRycyA9IHt9KVtrZXldID0gdmFsO1xuICAgIH1cblxuICAgIG9wdGlvbnMgPSBfLmV4dGVuZCh7dmFsaWRhdGU6IHRydWV9LCBvcHRpb25zKTtcblxuICAgIC8vIElmIHdlJ3JlIG5vdCB3YWl0aW5nIGFuZCBhdHRyaWJ1dGVzIGV4aXN0LCBzYXZlIGFjdHMgYXNcbiAgICAvLyBgc2V0KGF0dHIpLnNhdmUobnVsbCwgb3B0cylgIHdpdGggdmFsaWRhdGlvbi4gT3RoZXJ3aXNlLCBjaGVjayBpZlxuICAgIC8vIHRoZSBtb2RlbCB3aWxsIGJlIHZhbGlkIHdoZW4gdGhlIGF0dHJpYnV0ZXMsIGlmIGFueSwgYXJlIHNldC5cbiAgICBpZiAoYXR0cnMgJiYgIW9wdGlvbnMud2FpdCkge1xuICAgICAgaWYgKCF0aGlzLnNldChhdHRycywgb3B0aW9ucykpIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLl92YWxpZGF0ZShhdHRycywgb3B0aW9ucykpIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBTZXQgdGVtcG9yYXJ5IGF0dHJpYnV0ZXMgaWYgYHt3YWl0OiB0cnVlfWAuXG4gICAgaWYgKGF0dHJzICYmIG9wdGlvbnMud2FpdCkge1xuICAgICAgdGhpcy5hdHRyaWJ1dGVzID0gXy5leHRlbmQoT2JqZWN0LmNyZWF0ZShudWxsKSwgYXR0cmlidXRlcywgYXR0cnMpO1xuICAgIH1cblxuICAgIC8vIEFmdGVyIGEgc3VjY2Vzc2Z1bCBzZXJ2ZXItc2lkZSBzYXZlLCB0aGUgY2xpZW50IGlzIChvcHRpb25hbGx5KVxuICAgIC8vIHVwZGF0ZWQgd2l0aCB0aGUgc2VydmVyLXNpZGUgc3RhdGUuXG4gICAgaWYgKG9wdGlvbnMucGFyc2UgPT09IHZvaWQgMCkgb3B0aW9ucy5wYXJzZSA9IHRydWU7XG4gICAgdmFyIG1vZGVsID0gdGhpcztcbiAgICB2YXIgc3VjY2VzcyA9IG9wdGlvbnMuc3VjY2VzcztcbiAgICBvcHRpb25zLnN1Y2Nlc3MgPSBmdW5jdGlvbihyZXNwKSB7XG4gICAgICAvLyBFbnN1cmUgYXR0cmlidXRlcyBhcmUgcmVzdG9yZWQgZHVyaW5nIHN5bmNocm9ub3VzIHNhdmVzLlxuICAgICAgbW9kZWwuYXR0cmlidXRlcyA9IGF0dHJpYnV0ZXM7XG4gICAgICB2YXIgc2VydmVyQXR0cnMgPSBtb2RlbC5wYXJzZShyZXNwLCBvcHRpb25zKTtcbiAgICAgIGlmIChvcHRpb25zLndhaXQpIHNlcnZlckF0dHJzID0gXy5leHRlbmQoYXR0cnMgfHwge30sIHNlcnZlckF0dHJzKTtcbiAgICAgIGlmIChzZXJ2ZXJBdHRycyAmJiB0eXBlb2Ygc2VydmVyQXR0cnMgPT09ICdvYmplY3QnICYmICFtb2RlbC5zZXQoc2VydmVyQXR0cnMsIG9wdGlvbnMpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChzdWNjZXNzKSBzdWNjZXNzKG1vZGVsLCByZXNwLCBvcHRpb25zKTtcbiAgICAgIG1vZGVsLnRyaWdnZXIoJ3N5bmMnLCBtb2RlbCwgcmVzcCwgb3B0aW9ucyk7XG4gICAgfTtcbiAgICB3cmFwRXJyb3IodGhpcywgb3B0aW9ucyk7XG5cbiAgICBtZXRob2QgPSB0aGlzLmlzTmV3KCkgPyAnY3JlYXRlJyA6IChvcHRpb25zLnBhdGNoID8gJ3BhdGNoJyA6ICd1cGRhdGUnKTtcbiAgICBpZiAobWV0aG9kID09PSAncGF0Y2gnKSBvcHRpb25zLmF0dHJzID0gYXR0cnM7XG4gICAgeGhyID0gdGhpcy5zeW5jKG1ldGhvZCwgdGhpcywgb3B0aW9ucyk7XG5cbiAgICAvLyBSZXN0b3JlIGF0dHJpYnV0ZXMuXG4gICAgaWYgKGF0dHJzICYmIG9wdGlvbnMud2FpdCkgdGhpcy5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcblxuICAgIHJldHVybiB4aHI7XG4gIH0sXG5cbiAgLy8gRGVzdHJveSB0aGlzIG1vZGVsIG9uIHRoZSBzZXJ2ZXIgaWYgaXQgd2FzIGFscmVhZHkgcGVyc2lzdGVkLlxuICAvLyBPcHRpbWlzdGljYWxseSByZW1vdmVzIHRoZSBtb2RlbCBmcm9tIGl0cyBjb2xsZWN0aW9uLCBpZiBpdCBoYXMgb25lLlxuICAvLyBJZiBgd2FpdDogdHJ1ZWAgaXMgcGFzc2VkLCB3YWl0cyBmb3IgdGhlIHNlcnZlciB0byByZXNwb25kIGJlZm9yZSByZW1vdmFsLlxuICBkZXN0cm95OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgPyBfLmV4dGVuZCh7fSwgb3B0aW9ucykgOiB7fTtcbiAgICB2YXIgbW9kZWwgPSB0aGlzO1xuICAgIHZhciBzdWNjZXNzID0gb3B0aW9ucy5zdWNjZXNzO1xuXG4gICAgdmFyIGRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICAgIG1vZGVsLnRyaWdnZXIoJ2Rlc3Ryb3knLCBtb2RlbCwgbW9kZWwuY29sbGVjdGlvbiwgb3B0aW9ucyk7XG4gICAgfTtcblxuICAgIG9wdGlvbnMuc3VjY2VzcyA9IGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgIGlmIChvcHRpb25zLndhaXQgfHwgbW9kZWwuaXNOZXcoKSkgZGVzdHJveSgpO1xuICAgICAgaWYgKHN1Y2Nlc3MpIHN1Y2Nlc3MobW9kZWwsIHJlc3AsIG9wdGlvbnMpO1xuICAgICAgaWYgKCFtb2RlbC5pc05ldygpKSBtb2RlbC50cmlnZ2VyKCdzeW5jJywgbW9kZWwsIHJlc3AsIG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBpZiAodGhpcy5pc05ldygpKSB7XG4gICAgICBvcHRpb25zLnN1Y2Nlc3MoKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgd3JhcEVycm9yKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgdmFyIHhociA9IHRoaXMuc3luYygnZGVsZXRlJywgdGhpcywgb3B0aW9ucyk7XG4gICAgaWYgKCFvcHRpb25zLndhaXQpIGRlc3Ryb3koKTtcbiAgICByZXR1cm4geGhyO1xuICB9LFxuXG4gIC8vIERlZmF1bHQgVVJMIGZvciB0aGUgbW9kZWwncyByZXByZXNlbnRhdGlvbiBvbiB0aGUgc2VydmVyIC0tIGlmIHlvdSdyZVxuICAvLyB1c2luZyBCYWNrYm9uZSdzIHJlc3RmdWwgbWV0aG9kcywgb3ZlcnJpZGUgdGhpcyB0byBjaGFuZ2UgdGhlIGVuZHBvaW50XG4gIC8vIHRoYXQgd2lsbCBiZSBjYWxsZWQuXG4gIHVybDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJhc2UgPVxuICAgICAgXy5yZXN1bHQodGhpcywgJ3VybFJvb3QnKSB8fFxuICAgICAgXy5yZXN1bHQodGhpcy5jb2xsZWN0aW9uLCAndXJsJykgfHxcbiAgICAgIHVybEVycm9yKCk7XG4gICAgaWYgKHRoaXMuaXNOZXcoKSkgcmV0dXJuIGJhc2U7XG4gICAgcmV0dXJuIGJhc2UucmVwbGFjZSgvKFteXFwvXSkkLywgJyQxLycpICsgZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuaWQpO1xuICB9LFxuXG4gIC8vICoqcGFyc2UqKiBjb252ZXJ0cyBhIHJlc3BvbnNlIGludG8gdGhlIGhhc2ggb2YgYXR0cmlidXRlcyB0byBiZSBgc2V0YCBvblxuICAvLyB0aGUgbW9kZWwuIFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIGlzIGp1c3QgdG8gcGFzcyB0aGUgcmVzcG9uc2UgYWxvbmcuXG4gIHBhcnNlOiBmdW5jdGlvbihyZXNwLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHJlc3A7XG4gIH0sXG5cbiAgLy8gQ3JlYXRlIGEgbmV3IG1vZGVsIHdpdGggaWRlbnRpY2FsIGF0dHJpYnV0ZXMgdG8gdGhpcyBvbmUuXG4gIGNsb25lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IodGhpcy5hdHRyaWJ1dGVzKTtcbiAgfSxcblxuICAvLyBBIG1vZGVsIGlzIG5ldyBpZiBpdCBoYXMgbmV2ZXIgYmVlbiBzYXZlZCB0byB0aGUgc2VydmVyLCBhbmQgbGFja3MgYW4gaWQuXG4gIGlzTmV3OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gIXRoaXMuaGFzKHRoaXMuaWRBdHRyaWJ1dGUpO1xuICB9LFxuXG4gIC8vIENoZWNrIGlmIHRoZSBtb2RlbCBpcyBjdXJyZW50bHkgaW4gYSB2YWxpZCBzdGF0ZS5cbiAgaXNWYWxpZDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLl92YWxpZGF0ZSh7fSwgXy5leHRlbmQob3B0aW9ucyB8fCB7fSwgeyB2YWxpZGF0ZTogdHJ1ZSB9KSk7XG4gIH0sXG5cbiAgLy8gUnVuIHZhbGlkYXRpb24gYWdhaW5zdCB0aGUgbmV4dCBjb21wbGV0ZSBzZXQgb2YgbW9kZWwgYXR0cmlidXRlcyxcbiAgLy8gcmV0dXJuaW5nIGB0cnVlYCBpZiBhbGwgaXMgd2VsbC4gT3RoZXJ3aXNlLCBmaXJlIGFuIGBcImludmFsaWRcImAgZXZlbnQuXG4gIF92YWxpZGF0ZTogZnVuY3Rpb24oYXR0cnMsIG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudmFsaWRhdGUgfHwgIXRoaXMudmFsaWRhdGUpIHJldHVybiB0cnVlO1xuICAgIGF0dHJzID0gXy5leHRlbmQoT2JqZWN0LmNyZWF0ZShudWxsKSwgdGhpcy5hdHRyaWJ1dGVzLCBhdHRycyk7XG4gICAgdmFyIGVycm9yID0gdGhpcy52YWxpZGF0aW9uRXJyb3IgPSB0aGlzLnZhbGlkYXRlKGF0dHJzLCBvcHRpb25zKSB8fCBudWxsO1xuICAgIGlmICghZXJyb3IpIHJldHVybiB0cnVlO1xuICAgIHRoaXMudHJpZ2dlcignaW52YWxpZCcsIHRoaXMsIGVycm9yLCBfLmV4dGVuZChvcHRpb25zLCB7dmFsaWRhdGlvbkVycm9yOiBlcnJvcn0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxufSk7XG5cbmlmIChfLmtleXMpIHtcbiAgLy8gVW5kZXJzY29yZSBtZXRob2RzIHRoYXQgd2Ugd2FudCB0byBpbXBsZW1lbnQgb24gdGhlIE1vZGVsLlxuICB2YXIgbW9kZWxNZXRob2RzID0gWydrZXlzJywgJ3ZhbHVlcycsICdwYWlycycsICdpbnZlcnQnLCAncGljaycsICdvbWl0J107XG5cbiAgLy8gTWl4IGluIGVhY2ggVW5kZXJzY29yZSBtZXRob2QgYXMgYSBwcm94eSB0byBgTW9kZWwjYXR0cmlidXRlc2AuXG4gIG1vZGVsTWV0aG9kcy5maWx0ZXIodXRpbEV4aXN0cykuZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgICBNb2RlbC5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICBhcmdzLnVuc2hpZnQodGhpcy5hdHRyaWJ1dGVzKTtcbiAgICAgIHJldHVybiBfW21ldGhvZF0uYXBwbHkoXywgYXJncyk7XG4gICAgfTtcbiAgfSk7XG59XG4vLyBCYWNrYm9uZS5Db2xsZWN0aW9uXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8vIElmIG1vZGVscyB0ZW5kIHRvIHJlcHJlc2VudCBhIHNpbmdsZSByb3cgb2YgZGF0YSwgYSBCYWNrYm9uZSBDb2xsZWN0aW9uIGlzXG4vLyBtb3JlIGFuYWxhZ291cyB0byBhIHRhYmxlIGZ1bGwgb2YgZGF0YSAuLi4gb3IgYSBzbWFsbCBzbGljZSBvciBwYWdlIG9mIHRoYXRcbi8vIHRhYmxlLCBvciBhIGNvbGxlY3Rpb24gb2Ygcm93cyB0aGF0IGJlbG9uZyB0b2dldGhlciBmb3IgYSBwYXJ0aWN1bGFyIHJlYXNvblxuLy8gLS0gYWxsIG9mIHRoZSBtZXNzYWdlcyBpbiB0aGlzIHBhcnRpY3VsYXIgZm9sZGVyLCBhbGwgb2YgdGhlIGRvY3VtZW50c1xuLy8gYmVsb25naW5nIHRvIHRoaXMgcGFydGljdWxhciBhdXRob3IsIGFuZCBzbyBvbi4gQ29sbGVjdGlvbnMgbWFpbnRhaW5cbi8vIGluZGV4ZXMgb2YgdGhlaXIgbW9kZWxzLCBib3RoIGluIG9yZGVyLCBhbmQgZm9yIGxvb2t1cCBieSBgaWRgLlxuXG4vLyBDcmVhdGUgYSBuZXcgKipDb2xsZWN0aW9uKiosIHBlcmhhcHMgdG8gY29udGFpbiBhIHNwZWNpZmljIHR5cGUgb2YgYG1vZGVsYC5cbi8vIElmIGEgYGNvbXBhcmF0b3JgIGlzIHNwZWNpZmllZCwgdGhlIENvbGxlY3Rpb24gd2lsbCBtYWludGFpblxuLy8gaXRzIG1vZGVscyBpbiBzb3J0IG9yZGVyLCBhcyB0aGV5J3JlIGFkZGVkIGFuZCByZW1vdmVkLlxudmFyIENvbGxlY3Rpb24gPSBCYWNrYm9uZS5Db2xsZWN0aW9uID0gZnVuY3Rpb24obW9kZWxzLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG4gIGlmIChvcHRpb25zLm1vZGVsKSB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgaWYgKG9wdGlvbnMuY29tcGFyYXRvciAhPT0gdm9pZCAwKSB0aGlzLmNvbXBhcmF0b3IgPSBvcHRpb25zLmNvbXBhcmF0b3I7XG4gIHRoaXMuX3Jlc2V0KCk7XG4gIHRoaXMuaW5pdGlhbGl6ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICBpZiAobW9kZWxzKSB0aGlzLnJlc2V0KG1vZGVscywgXy5leHRlbmQoe3NpbGVudDogdHJ1ZX0sIG9wdGlvbnMpKTtcbn07XG5cbi8vIERlZmF1bHQgb3B0aW9ucyBmb3IgYENvbGxlY3Rpb24jc2V0YC5cbnZhciBzZXRPcHRpb25zID0ge2FkZDogdHJ1ZSwgcmVtb3ZlOiB0cnVlLCBtZXJnZTogdHJ1ZX07XG52YXIgYWRkT3B0aW9ucyA9IHthZGQ6IHRydWUsIHJlbW92ZTogZmFsc2V9O1xuXG4vLyBEZWZpbmUgdGhlIENvbGxlY3Rpb24ncyBpbmhlcml0YWJsZSBtZXRob2RzLlxuXy5leHRlbmQoQ29sbGVjdGlvbi5wcm90b3R5cGUsIEV2ZW50cywge1xuXG4gIC8vIFRoZSBkZWZhdWx0IG1vZGVsIGZvciBhIGNvbGxlY3Rpb24gaXMganVzdCBhICoqQmFja2JvbmUuTW9kZWwqKi5cbiAgLy8gVGhpcyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBpbiBtb3N0IGNhc2VzLlxuICBtb2RlbDogdHlwZW9mIE1vZGVsID09PSAndW5kZWZpbmVkJyA/IG51bGwgOiBNb2RlbCxcblxuICAvLyBJbml0aWFsaXplIGlzIGFuIGVtcHR5IGZ1bmN0aW9uIGJ5IGRlZmF1bHQuIE92ZXJyaWRlIGl0IHdpdGggeW91ciBvd25cbiAgLy8gaW5pdGlhbGl6YXRpb24gbG9naWMuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKCl7fSxcblxuICAvLyBUaGUgSlNPTiByZXByZXNlbnRhdGlvbiBvZiBhIENvbGxlY3Rpb24gaXMgYW4gYXJyYXkgb2YgdGhlXG4gIC8vIG1vZGVscycgYXR0cmlidXRlcy5cbiAgdG9KU09OOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKG1vZGVsKXsgcmV0dXJuIG1vZGVsLnRvSlNPTihvcHRpb25zKTsgfSk7XG4gIH0sXG5cbiAgLy8gUHJveHkgYEJhY2tib25lLnN5bmNgIGJ5IGRlZmF1bHQuXG4gIHN5bmM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBCYWNrYm9uZS5zeW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH0sXG5cbiAgLy8gQWRkIGEgbW9kZWwsIG9yIGxpc3Qgb2YgbW9kZWxzIHRvIHRoZSBzZXQuXG4gIGFkZDogZnVuY3Rpb24obW9kZWxzLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuc2V0KG1vZGVscywgXy5leHRlbmQoe21lcmdlOiBmYWxzZX0sIG9wdGlvbnMsIGFkZE9wdGlvbnMpKTtcbiAgfSxcblxuICAvLyBSZW1vdmUgYSBtb2RlbCwgb3IgYSBsaXN0IG9mIG1vZGVscyBmcm9tIHRoZSBzZXQuXG4gIHJlbW92ZTogZnVuY3Rpb24obW9kZWxzLCBvcHRpb25zKSB7XG4gICAgdmFyIHNpbmd1bGFyID0gIUFycmF5LmlzQXJyYXkobW9kZWxzKTtcbiAgICBtb2RlbHMgPSBzaW5ndWxhciA/IFttb2RlbHNdIDogbW9kZWxzLnNsaWNlKCk7XG4gICAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IHt9KTtcbiAgICB2YXIgaSwgbCwgaW5kZXgsIG1vZGVsO1xuICAgIGZvciAoaSA9IDAsIGwgPSBtb2RlbHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBtb2RlbCA9IG1vZGVsc1tpXSA9IHRoaXMuZ2V0KG1vZGVsc1tpXSk7XG4gICAgICBpZiAoIW1vZGVsKSBjb250aW51ZTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ieUlkW21vZGVsLmlkXTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ieUlkW21vZGVsLmNpZF07XG4gICAgICBpbmRleCA9IHRoaXMuaW5kZXhPZihtb2RlbCk7XG4gICAgICB0aGlzLm1vZGVscy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgdGhpcy5sZW5ndGgtLTtcbiAgICAgIGlmICghb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgb3B0aW9ucy5pbmRleCA9IGluZGV4O1xuICAgICAgICBtb2RlbC50cmlnZ2VyKCdyZW1vdmUnLCBtb2RlbCwgdGhpcywgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICB0aGlzLl9yZW1vdmVSZWZlcmVuY2UobW9kZWwsIG9wdGlvbnMpO1xuICAgIH1cbiAgICByZXR1cm4gc2luZ3VsYXIgPyBtb2RlbHNbMF0gOiBtb2RlbHM7XG4gIH0sXG5cbiAgLy8gVXBkYXRlIGEgY29sbGVjdGlvbiBieSBgc2V0YC1pbmcgYSBuZXcgbGlzdCBvZiBtb2RlbHMsIGFkZGluZyBuZXcgb25lcyxcbiAgLy8gcmVtb3ZpbmcgbW9kZWxzIHRoYXQgYXJlIG5vIGxvbmdlciBwcmVzZW50LCBhbmQgbWVyZ2luZyBtb2RlbHMgdGhhdFxuICAvLyBhbHJlYWR5IGV4aXN0IGluIHRoZSBjb2xsZWN0aW9uLCBhcyBuZWNlc3NhcnkuIFNpbWlsYXIgdG8gKipNb2RlbCNzZXQqKixcbiAgLy8gdGhlIGNvcmUgb3BlcmF0aW9uIGZvciB1cGRhdGluZyB0aGUgZGF0YSBjb250YWluZWQgYnkgdGhlIGNvbGxlY3Rpb24uXG4gIHNldDogZnVuY3Rpb24obW9kZWxzLCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IF8uZGVmYXVsdHMoe30sIG9wdGlvbnMsIHNldE9wdGlvbnMpO1xuICAgIGlmIChvcHRpb25zLnBhcnNlKSBtb2RlbHMgPSB0aGlzLnBhcnNlKG1vZGVscywgb3B0aW9ucyk7XG4gICAgdmFyIHNpbmd1bGFyID0gIUFycmF5LmlzQXJyYXkobW9kZWxzKTtcbiAgICBtb2RlbHMgPSBzaW5ndWxhciA/IChtb2RlbHMgPyBbbW9kZWxzXSA6IFtdKSA6IG1vZGVscy5zbGljZSgpO1xuICAgIHZhciBpLCBsLCBpZCwgbW9kZWwsIGF0dHJzLCBleGlzdGluZywgc29ydDtcbiAgICB2YXIgYXQgPSBvcHRpb25zLmF0O1xuICAgIHZhciB0YXJnZXRNb2RlbCA9IHRoaXMubW9kZWw7XG4gICAgdmFyIHNvcnRhYmxlID0gdGhpcy5jb21wYXJhdG9yICYmIChhdCA9PSBudWxsKSAmJiBvcHRpb25zLnNvcnQgIT09IGZhbHNlO1xuICAgIHZhciBzb3J0QXR0ciA9IHR5cGVvZiB0aGlzLmNvbXBhcmF0b3IgPT09ICdzdHJpbmcnID8gdGhpcy5jb21wYXJhdG9yIDogbnVsbDtcbiAgICB2YXIgdG9BZGQgPSBbXSwgdG9SZW1vdmUgPSBbXSwgbW9kZWxNYXAgPSB7fTtcbiAgICB2YXIgYWRkID0gb3B0aW9ucy5hZGQsIG1lcmdlID0gb3B0aW9ucy5tZXJnZSwgcmVtb3ZlID0gb3B0aW9ucy5yZW1vdmU7XG4gICAgdmFyIG9yZGVyID0gIXNvcnRhYmxlICYmIGFkZCAmJiByZW1vdmUgPyBbXSA6IGZhbHNlO1xuXG4gICAgLy8gVHVybiBiYXJlIG9iamVjdHMgaW50byBtb2RlbCByZWZlcmVuY2VzLCBhbmQgcHJldmVudCBpbnZhbGlkIG1vZGVsc1xuICAgIC8vIGZyb20gYmVpbmcgYWRkZWQuXG4gICAgZm9yIChpID0gMCwgbCA9IG1vZGVscy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGF0dHJzID0gbW9kZWxzW2ldIHx8IHt9O1xuICAgICAgaWYgKGF0dHJzIGluc3RhbmNlb2YgTW9kZWwpIHtcbiAgICAgICAgaWQgPSBtb2RlbCA9IGF0dHJzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWQgPSBhdHRyc1t0YXJnZXRNb2RlbC5wcm90b3R5cGUuaWRBdHRyaWJ1dGUgfHwgJ2lkJ107XG4gICAgICB9XG5cbiAgICAgIC8vIElmIGEgZHVwbGljYXRlIGlzIGZvdW5kLCBwcmV2ZW50IGl0IGZyb20gYmVpbmcgYWRkZWQgYW5kXG4gICAgICAvLyBvcHRpb25hbGx5IG1lcmdlIGl0IGludG8gdGhlIGV4aXN0aW5nIG1vZGVsLlxuICAgICAgaWYgKGV4aXN0aW5nID0gdGhpcy5nZXQoaWQpKSB7XG4gICAgICAgIGlmIChyZW1vdmUpIG1vZGVsTWFwW2V4aXN0aW5nLmNpZF0gPSB0cnVlO1xuICAgICAgICBpZiAobWVyZ2UpIHtcbiAgICAgICAgICBhdHRycyA9IGF0dHJzID09PSBtb2RlbCA/IG1vZGVsLmF0dHJpYnV0ZXMgOiBhdHRycztcbiAgICAgICAgICBpZiAob3B0aW9ucy5wYXJzZSkgYXR0cnMgPSBleGlzdGluZy5wYXJzZShhdHRycywgb3B0aW9ucyk7XG4gICAgICAgICAgZXhpc3Rpbmcuc2V0KGF0dHJzLCBvcHRpb25zKTtcbiAgICAgICAgICBpZiAoc29ydGFibGUgJiYgIXNvcnQgJiYgZXhpc3RpbmcuaGFzQ2hhbmdlZChzb3J0QXR0cikpIHNvcnQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIG1vZGVsc1tpXSA9IGV4aXN0aW5nO1xuXG4gICAgICAvLyBJZiB0aGlzIGlzIGEgbmV3LCB2YWxpZCBtb2RlbCwgcHVzaCBpdCB0byB0aGUgYHRvQWRkYCBsaXN0LlxuICAgICAgfSBlbHNlIGlmIChhZGQpIHtcbiAgICAgICAgbW9kZWwgPSBtb2RlbHNbaV0gPSB0aGlzLl9wcmVwYXJlTW9kZWwoYXR0cnMsIG9wdGlvbnMpO1xuICAgICAgICBpZiAoIW1vZGVsKSBjb250aW51ZTtcbiAgICAgICAgdG9BZGQucHVzaChtb2RlbCk7XG4gICAgICAgIHRoaXMuX2FkZFJlZmVyZW5jZShtb2RlbCwgb3B0aW9ucyk7XG4gICAgICB9XG5cbiAgICAgIC8vIERvIG5vdCBhZGQgbXVsdGlwbGUgbW9kZWxzIHdpdGggdGhlIHNhbWUgYGlkYC5cbiAgICAgIG1vZGVsID0gZXhpc3RpbmcgfHwgbW9kZWw7XG4gICAgICBpZiAob3JkZXIgJiYgKG1vZGVsLmlzTmV3KCkgfHwgIW1vZGVsTWFwW21vZGVsLmlkXSkpIG9yZGVyLnB1c2gobW9kZWwpO1xuICAgICAgbW9kZWxNYXBbbW9kZWwuaWRdID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgbm9uZXhpc3RlbnQgbW9kZWxzIGlmIGFwcHJvcHJpYXRlLlxuICAgIGlmIChyZW1vdmUpIHtcbiAgICAgIGZvciAoaSA9IDAsIGwgPSB0aGlzLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICBpZiAoIW1vZGVsTWFwWyhtb2RlbCA9IHRoaXMubW9kZWxzW2ldKS5jaWRdKSB0b1JlbW92ZS5wdXNoKG1vZGVsKTtcbiAgICAgIH1cbiAgICAgIGlmICh0b1JlbW92ZS5sZW5ndGgpIHRoaXMucmVtb3ZlKHRvUmVtb3ZlLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvLyBTZWUgaWYgc29ydGluZyBpcyBuZWVkZWQsIHVwZGF0ZSBgbGVuZ3RoYCBhbmQgc3BsaWNlIGluIG5ldyBtb2RlbHMuXG4gICAgaWYgKHRvQWRkLmxlbmd0aCB8fCAob3JkZXIgJiYgb3JkZXIubGVuZ3RoKSkge1xuICAgICAgaWYgKHNvcnRhYmxlKSBzb3J0ID0gdHJ1ZTtcbiAgICAgIHRoaXMubGVuZ3RoICs9IHRvQWRkLmxlbmd0aDtcbiAgICAgIGlmIChhdCAhPSBudWxsKSB7XG4gICAgICAgIGZvciAoaSA9IDAsIGwgPSB0b0FkZC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICB0aGlzLm1vZGVscy5zcGxpY2UoYXQgKyBpLCAwLCB0b0FkZFtpXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvcmRlcikgdGhpcy5tb2RlbHMubGVuZ3RoID0gMDtcbiAgICAgICAgdmFyIG9yZGVyZWRNb2RlbHMgPSBvcmRlciB8fCB0b0FkZDtcbiAgICAgICAgZm9yIChpID0gMCwgbCA9IG9yZGVyZWRNb2RlbHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgdGhpcy5tb2RlbHMucHVzaChvcmRlcmVkTW9kZWxzW2ldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNpbGVudGx5IHNvcnQgdGhlIGNvbGxlY3Rpb24gaWYgYXBwcm9wcmlhdGUuXG4gICAgaWYgKHNvcnQpIHRoaXMuc29ydCh7c2lsZW50OiB0cnVlfSk7XG5cbiAgICAvLyBVbmxlc3Mgc2lsZW5jZWQsIGl0J3MgdGltZSB0byBmaXJlIGFsbCBhcHByb3ByaWF0ZSBhZGQvc29ydCBldmVudHMuXG4gICAgaWYgKCFvcHRpb25zLnNpbGVudCkge1xuICAgICAgZm9yIChpID0gMCwgbCA9IHRvQWRkLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAobW9kZWwgPSB0b0FkZFtpXSkudHJpZ2dlcignYWRkJywgbW9kZWwsIHRoaXMsIG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKHNvcnQgfHwgKG9yZGVyICYmIG9yZGVyLmxlbmd0aCkpIHRoaXMudHJpZ2dlcignc29ydCcsIHRoaXMsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIFJldHVybiB0aGUgYWRkZWQgKG9yIG1lcmdlZCkgbW9kZWwgKG9yIG1vZGVscykuXG4gICAgcmV0dXJuIHNpbmd1bGFyID8gbW9kZWxzWzBdIDogbW9kZWxzO1xuICB9LFxuXG4gIC8vIFdoZW4geW91IGhhdmUgbW9yZSBpdGVtcyB0aGFuIHlvdSB3YW50IHRvIGFkZCBvciByZW1vdmUgaW5kaXZpZHVhbGx5LFxuICAvLyB5b3UgY2FuIHJlc2V0IHRoZSBlbnRpcmUgc2V0IHdpdGggYSBuZXcgbGlzdCBvZiBtb2RlbHMsIHdpdGhvdXQgZmlyaW5nXG4gIC8vIGFueSBncmFudWxhciBgYWRkYCBvciBgcmVtb3ZlYCBldmVudHMuIEZpcmVzIGByZXNldGAgd2hlbiBmaW5pc2hlZC5cbiAgLy8gVXNlZnVsIGZvciBidWxrIG9wZXJhdGlvbnMgYW5kIG9wdGltaXphdGlvbnMuXG4gIHJlc2V0OiBmdW5jdGlvbihtb2RlbHMsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5tb2RlbHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICB0aGlzLl9yZW1vdmVSZWZlcmVuY2UodGhpcy5tb2RlbHNbaV0sIG9wdGlvbnMpO1xuICAgIH1cbiAgICBvcHRpb25zLnByZXZpb3VzTW9kZWxzID0gdGhpcy5tb2RlbHM7XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgICBtb2RlbHMgPSB0aGlzLmFkZChtb2RlbHMsIF8uZXh0ZW5kKHtzaWxlbnQ6IHRydWV9LCBvcHRpb25zKSk7XG4gICAgaWYgKCFvcHRpb25zLnNpbGVudCkgdGhpcy50cmlnZ2VyKCdyZXNldCcsIHRoaXMsIG9wdGlvbnMpO1xuICAgIHJldHVybiBtb2RlbHM7XG4gIH0sXG5cbiAgLy8gQWRkIGEgbW9kZWwgdG8gdGhlIGVuZCBvZiB0aGUgY29sbGVjdGlvbi5cbiAgcHVzaDogZnVuY3Rpb24obW9kZWwsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5hZGQobW9kZWwsIF8uZXh0ZW5kKHthdDogdGhpcy5sZW5ndGh9LCBvcHRpb25zKSk7XG4gIH0sXG5cbiAgLy8gUmVtb3ZlIGEgbW9kZWwgZnJvbSB0aGUgZW5kIG9mIHRoZSBjb2xsZWN0aW9uLlxuICBwb3A6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLmF0KHRoaXMubGVuZ3RoIC0gMSk7XG4gICAgdGhpcy5yZW1vdmUobW9kZWwsIG9wdGlvbnMpO1xuICAgIHJldHVybiBtb2RlbDtcbiAgfSxcblxuICAvLyBBZGQgYSBtb2RlbCB0byB0aGUgYmVnaW5uaW5nIG9mIHRoZSBjb2xsZWN0aW9uLlxuICB1bnNoaWZ0OiBmdW5jdGlvbihtb2RlbCwgb3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLmFkZChtb2RlbCwgXy5leHRlbmQoe2F0OiAwfSwgb3B0aW9ucykpO1xuICB9LFxuXG4gIC8vIFJlbW92ZSBhIG1vZGVsIGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgY29sbGVjdGlvbi5cbiAgc2hpZnQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB2YXIgbW9kZWwgPSB0aGlzLmF0KDApO1xuICAgIHRoaXMucmVtb3ZlKG1vZGVsLCBvcHRpb25zKTtcbiAgICByZXR1cm4gbW9kZWw7XG4gIH0sXG5cbiAgLy8gU2xpY2Ugb3V0IGEgc3ViLWFycmF5IG9mIG1vZGVscyBmcm9tIHRoZSBjb2xsZWN0aW9uLlxuICBzbGljZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHNsaWNlLmFwcGx5KHRoaXMubW9kZWxzLCBhcmd1bWVudHMpO1xuICB9LFxuXG4gIC8vIEdldCBhIG1vZGVsIGZyb20gdGhlIHNldCBieSBpZC5cbiAgZ2V0OiBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgcmV0dXJuIHRoaXMuX2J5SWRbb2JqXSB8fCB0aGlzLl9ieUlkW29iai5pZF0gfHwgdGhpcy5fYnlJZFtvYmouY2lkXTtcbiAgfSxcblxuICAvLyBHZXQgdGhlIG1vZGVsIGF0IHRoZSBnaXZlbiBpbmRleC5cbiAgYXQ6IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW2luZGV4XTtcbiAgfSxcblxuICAvLyBSZXR1cm4gbW9kZWxzIHdpdGggbWF0Y2hpbmcgYXR0cmlidXRlcy4gVXNlZnVsIGZvciBzaW1wbGUgY2FzZXMgb2ZcbiAgLy8gYGZpbHRlcmAuXG4gIHdoZXJlOiBmdW5jdGlvbihhdHRycywgZmlyc3QpIHtcbiAgICBpZiAoIWF0dHJzIHx8ICFPYmplY3Qua2V5cyhhdHRycykubGVuZ3RoKSByZXR1cm4gZmlyc3QgPyB2b2lkIDAgOiBbXTtcbiAgICByZXR1cm4gdGhpc1tmaXJzdCA/ICdmaW5kJyA6ICdmaWx0ZXInXShmdW5jdGlvbihtb2RlbCkge1xuICAgICAgZm9yICh2YXIga2V5IGluIGF0dHJzKSB7XG4gICAgICAgIGlmIChhdHRyc1trZXldICE9PSBtb2RlbC5nZXQoa2V5KSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gUmV0dXJuIHRoZSBmaXJzdCBtb2RlbCB3aXRoIG1hdGNoaW5nIGF0dHJpYnV0ZXMuIFVzZWZ1bCBmb3Igc2ltcGxlIGNhc2VzXG4gIC8vIG9mIGBmaW5kYC5cbiAgZmluZFdoZXJlOiBmdW5jdGlvbihhdHRycykge1xuICAgIHJldHVybiB0aGlzLndoZXJlKGF0dHJzLCB0cnVlKTtcbiAgfSxcblxuICAvLyBGb3JjZSB0aGUgY29sbGVjdGlvbiB0byByZS1zb3J0IGl0c2VsZi4gWW91IGRvbid0IG5lZWQgdG8gY2FsbCB0aGlzIHVuZGVyXG4gIC8vIG5vcm1hbCBjaXJjdW1zdGFuY2VzLCBhcyB0aGUgc2V0IHdpbGwgbWFpbnRhaW4gc29ydCBvcmRlciBhcyBlYWNoIGl0ZW1cbiAgLy8gaXMgYWRkZWQuXG4gIHNvcnQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBpZiAoIXRoaXMuY29tcGFyYXRvcikgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3Qgc29ydCBhIHNldCB3aXRob3V0IGEgY29tcGFyYXRvcicpO1xuICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG5cbiAgICAvLyBSdW4gc29ydCBiYXNlZCBvbiB0eXBlIG9mIGBjb21wYXJhdG9yYC5cbiAgICBpZiAodHlwZW9mIHRoaXMuY29tcGFyYXRvciA9PT0gJ3N0cmluZycgfHwgdGhpcy5jb21wYXJhdG9yLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdGhpcy5tb2RlbHMgPSB0aGlzLnNvcnRCeSh0aGlzLmNvbXBhcmF0b3IsIHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm1vZGVscy5zb3J0KHRoaXMuY29tcGFyYXRvci5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMuc2lsZW50KSB0aGlzLnRyaWdnZXIoJ3NvcnQnLCB0aGlzLCBvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBQbHVjayBhbiBhdHRyaWJ1dGUgZnJvbSBlYWNoIG1vZGVsIGluIHRoZSBjb2xsZWN0aW9uLlxuICBwbHVjazogZnVuY3Rpb24oYXR0cikge1xuICAgIHJldHVybiB0aGlzLm1vZGVscy5tYXAoZnVuY3Rpb24obW9kZWwpIHtcbiAgICAgIHJldHVybiBtb2RlbC5nZXQoYXR0cik7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gRmV0Y2ggdGhlIGRlZmF1bHQgc2V0IG9mIG1vZGVscyBmb3IgdGhpcyBjb2xsZWN0aW9uLCByZXNldHRpbmcgdGhlXG4gIC8vIGNvbGxlY3Rpb24gd2hlbiB0aGV5IGFycml2ZS4gSWYgYHJlc2V0OiB0cnVlYCBpcyBwYXNzZWQsIHRoZSByZXNwb25zZVxuICAvLyBkYXRhIHdpbGwgYmUgcGFzc2VkIHRocm91Z2ggdGhlIGByZXNldGAgbWV0aG9kIGluc3RlYWQgb2YgYHNldGAuXG4gIGZldGNoOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgPyBfLmV4dGVuZCh7fSwgb3B0aW9ucykgOiB7fTtcbiAgICBpZiAob3B0aW9ucy5wYXJzZSA9PT0gdm9pZCAwKSBvcHRpb25zLnBhcnNlID0gdHJ1ZTtcbiAgICB2YXIgc3VjY2VzcyA9IG9wdGlvbnMuc3VjY2VzcztcbiAgICB2YXIgY29sbGVjdGlvbiA9IHRoaXM7XG4gICAgb3B0aW9ucy5zdWNjZXNzID0gZnVuY3Rpb24ocmVzcCkge1xuICAgICAgdmFyIG1ldGhvZCA9IG9wdGlvbnMucmVzZXQgPyAncmVzZXQnIDogJ3NldCc7XG4gICAgICBjb2xsZWN0aW9uW21ldGhvZF0ocmVzcCwgb3B0aW9ucyk7XG4gICAgICBpZiAoc3VjY2Vzcykgc3VjY2Vzcyhjb2xsZWN0aW9uLCByZXNwLCBvcHRpb25zKTtcbiAgICAgIGNvbGxlY3Rpb24udHJpZ2dlcignc3luYycsIGNvbGxlY3Rpb24sIHJlc3AsIG9wdGlvbnMpO1xuICAgIH07XG4gICAgd3JhcEVycm9yKHRoaXMsIG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLnN5bmMoJ3JlYWQnLCB0aGlzLCBvcHRpb25zKTtcbiAgfSxcblxuICAvLyBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgYSBtb2RlbCBpbiB0aGlzIGNvbGxlY3Rpb24uIEFkZCB0aGUgbW9kZWwgdG8gdGhlXG4gIC8vIGNvbGxlY3Rpb24gaW1tZWRpYXRlbHksIHVubGVzcyBgd2FpdDogdHJ1ZWAgaXMgcGFzc2VkLCBpbiB3aGljaCBjYXNlIHdlXG4gIC8vIHdhaXQgZm9yIHRoZSBzZXJ2ZXIgdG8gYWdyZWUuXG4gIGNyZWF0ZTogZnVuY3Rpb24obW9kZWwsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyA/IF8uZXh0ZW5kKHt9LCBvcHRpb25zKSA6IHt9O1xuICAgIGlmICghKG1vZGVsID0gdGhpcy5fcHJlcGFyZU1vZGVsKG1vZGVsLCBvcHRpb25zKSkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIW9wdGlvbnMud2FpdCkgdGhpcy5hZGQobW9kZWwsIG9wdGlvbnMpO1xuICAgIHZhciBjb2xsZWN0aW9uID0gdGhpcztcbiAgICB2YXIgc3VjY2VzcyA9IG9wdGlvbnMuc3VjY2VzcztcbiAgICBvcHRpb25zLnN1Y2Nlc3MgPSBmdW5jdGlvbihtb2RlbCwgcmVzcCkge1xuICAgICAgaWYgKG9wdGlvbnMud2FpdCkgY29sbGVjdGlvbi5hZGQobW9kZWwsIG9wdGlvbnMpO1xuICAgICAgaWYgKHN1Y2Nlc3MpIHN1Y2Nlc3MobW9kZWwsIHJlc3AsIG9wdGlvbnMpO1xuICAgIH07XG4gICAgbW9kZWwuc2F2ZShudWxsLCBvcHRpb25zKTtcbiAgICByZXR1cm4gbW9kZWw7XG4gIH0sXG5cbiAgLy8gKipwYXJzZSoqIGNvbnZlcnRzIGEgcmVzcG9uc2UgaW50byBhIGxpc3Qgb2YgbW9kZWxzIHRvIGJlIGFkZGVkIHRvIHRoZVxuICAvLyBjb2xsZWN0aW9uLiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiBpcyBqdXN0IHRvIHBhc3MgaXQgdGhyb3VnaC5cbiAgcGFyc2U6IGZ1bmN0aW9uKHJlc3AsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gcmVzcDtcbiAgfSxcblxuICAvLyBDcmVhdGUgYSBuZXcgY29sbGVjdGlvbiB3aXRoIGFuIGlkZW50aWNhbCBsaXN0IG9mIG1vZGVscyBhcyB0aGlzIG9uZS5cbiAgY2xvbmU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLm1vZGVscyk7XG4gIH0sXG5cbiAgLy8gUHJpdmF0ZSBtZXRob2QgdG8gcmVzZXQgYWxsIGludGVybmFsIHN0YXRlLiBDYWxsZWQgd2hlbiB0aGUgY29sbGVjdGlvblxuICAvLyBpcyBmaXJzdCBpbml0aWFsaXplZCBvciByZXNldC5cbiAgX3Jlc2V0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5tb2RlbHMgPSBbXTtcbiAgICB0aGlzLl9ieUlkICA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIH0sXG5cbiAgLy8gUHJlcGFyZSBhIGhhc2ggb2YgYXR0cmlidXRlcyAob3Igb3RoZXIgbW9kZWwpIHRvIGJlIGFkZGVkIHRvIHRoaXNcbiAgLy8gY29sbGVjdGlvbi5cbiAgX3ByZXBhcmVNb2RlbDogZnVuY3Rpb24oYXR0cnMsIG9wdGlvbnMpIHtcbiAgICBpZiAoYXR0cnMgaW5zdGFuY2VvZiBNb2RlbCkgcmV0dXJuIGF0dHJzO1xuICAgIG9wdGlvbnMgPSBfLmV4dGVuZCh7fSwgb3B0aW9ucyk7XG4gICAgb3B0aW9ucy5jb2xsZWN0aW9uID0gdGhpcztcbiAgICB2YXIgbW9kZWwgPSBuZXcgdGhpcy5tb2RlbChhdHRycywgb3B0aW9ucyk7XG4gICAgaWYgKCFtb2RlbC52YWxpZGF0aW9uRXJyb3IpIHJldHVybiBtb2RlbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2ludmFsaWQnLCB0aGlzLCBtb2RlbC52YWxpZGF0aW9uRXJyb3IsIG9wdGlvbnMpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcblxuICAvLyBJbnRlcm5hbCBtZXRob2QgdG8gY3JlYXRlIGEgbW9kZWwncyB0aWVzIHRvIGEgY29sbGVjdGlvbi5cbiAgX2FkZFJlZmVyZW5jZTogZnVuY3Rpb24obW9kZWwsIG9wdGlvbnMpIHtcbiAgICB0aGlzLl9ieUlkW21vZGVsLmNpZF0gPSBtb2RlbDtcbiAgICBpZiAobW9kZWwuaWQgIT0gbnVsbCkgdGhpcy5fYnlJZFttb2RlbC5pZF0gPSBtb2RlbDtcbiAgICBpZiAoIW1vZGVsLmNvbGxlY3Rpb24pIG1vZGVsLmNvbGxlY3Rpb24gPSB0aGlzO1xuICAgIG1vZGVsLm9uKCdhbGwnLCB0aGlzLl9vbk1vZGVsRXZlbnQsIHRoaXMpO1xuICB9LFxuXG4gIC8vIEludGVybmFsIG1ldGhvZCB0byBzZXZlciBhIG1vZGVsJ3MgdGllcyB0byBhIGNvbGxlY3Rpb24uXG4gIF9yZW1vdmVSZWZlcmVuY2U6IGZ1bmN0aW9uKG1vZGVsLCBvcHRpb25zKSB7XG4gICAgaWYgKHRoaXMgPT09IG1vZGVsLmNvbGxlY3Rpb24pIGRlbGV0ZSBtb2RlbC5jb2xsZWN0aW9uO1xuICAgIG1vZGVsLm9mZignYWxsJywgdGhpcy5fb25Nb2RlbEV2ZW50LCB0aGlzKTtcbiAgfSxcblxuICAvLyBJbnRlcm5hbCBtZXRob2QgY2FsbGVkIGV2ZXJ5IHRpbWUgYSBtb2RlbCBpbiB0aGUgc2V0IGZpcmVzIGFuIGV2ZW50LlxuICAvLyBTZXRzIG5lZWQgdG8gdXBkYXRlIHRoZWlyIGluZGV4ZXMgd2hlbiBtb2RlbHMgY2hhbmdlIGlkcy4gQWxsIG90aGVyXG4gIC8vIGV2ZW50cyBzaW1wbHkgcHJveHkgdGhyb3VnaC4gXCJhZGRcIiBhbmQgXCJyZW1vdmVcIiBldmVudHMgdGhhdCBvcmlnaW5hdGVcbiAgLy8gaW4gb3RoZXIgY29sbGVjdGlvbnMgYXJlIGlnbm9yZWQuXG4gIF9vbk1vZGVsRXZlbnQ6IGZ1bmN0aW9uKGV2ZW50LCBtb2RlbCwgY29sbGVjdGlvbiwgb3B0aW9ucykge1xuICAgIGlmICgoZXZlbnQgPT09ICdhZGQnIHx8IGV2ZW50ID09PSAncmVtb3ZlJykgJiYgY29sbGVjdGlvbiAhPT0gdGhpcykgcmV0dXJuO1xuICAgIGlmIChldmVudCA9PT0gJ2Rlc3Ryb3knKSB0aGlzLnJlbW92ZShtb2RlbCwgb3B0aW9ucyk7XG4gICAgaWYgKG1vZGVsICYmIGV2ZW50ID09PSAnY2hhbmdlOicgKyBtb2RlbC5pZEF0dHJpYnV0ZSkge1xuICAgICAgZGVsZXRlIHRoaXMuX2J5SWRbbW9kZWwucHJldmlvdXMobW9kZWwuaWRBdHRyaWJ1dGUpXTtcbiAgICAgIGlmIChtb2RlbC5pZCAhPSBudWxsKSB0aGlzLl9ieUlkW21vZGVsLmlkXSA9IG1vZGVsO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG59KTtcblxuaWYgKHV0aWxFeGlzdHMoJ2VhY2gnKSkge1xuICAvLyBVbmRlcnNjb3JlIG1ldGhvZHMgdGhhdCB3ZSB3YW50IHRvIGltcGxlbWVudCBvbiB0aGUgQ29sbGVjdGlvbi5cbiAgLy8gOTAlIG9mIHRoZSBjb3JlIHVzZWZ1bG5lc3Mgb2YgQmFja2JvbmUgQ29sbGVjdGlvbnMgaXMgYWN0dWFsbHkgaW1wbGVtZW50ZWRcbiAgLy8gcmlnaHQgaGVyZTpcbiAgdmFyIG1ldGhvZHMgPSBbJ2ZvckVhY2gnLCAnZWFjaCcsICdtYXAnLCAnY29sbGVjdCcsICdyZWR1Y2UnLCAnZm9sZGwnLFxuICAgICdpbmplY3QnLCAncmVkdWNlUmlnaHQnLCAnZm9sZHInLCAnZmluZCcsICdkZXRlY3QnLCAnZmlsdGVyJywgJ3NlbGVjdCcsXG4gICAgJ3JlamVjdCcsICdldmVyeScsICdhbGwnLCAnc29tZScsICdhbnknLCAnaW5jbHVkZScsICdjb250YWlucycsICdpbnZva2UnLFxuICAgICdtYXgnLCAnbWluJywgJ3RvQXJyYXknLCAnc2l6ZScsICdmaXJzdCcsICdoZWFkJywgJ3Rha2UnLCAnaW5pdGlhbCcsICdyZXN0JyxcbiAgICAndGFpbCcsICdkcm9wJywgJ2xhc3QnLCAnd2l0aG91dCcsICdkaWZmZXJlbmNlJywgJ2luZGV4T2YnLCAnc2h1ZmZsZScsXG4gICAgJ2xhc3RJbmRleE9mJywgJ2lzRW1wdHknLCAnY2hhaW4nXTtcblxuICAvLyBNaXggaW4gZWFjaCBVbmRlcnNjb3JlIG1ldGhvZCBhcyBhIHByb3h5IHRvIGBDb2xsZWN0aW9uI21vZGVsc2AuXG4gIG1ldGhvZHMuZmlsdGVyKHV0aWxFeGlzdHMpLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgQ29sbGVjdGlvbi5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICBhcmdzLnVuc2hpZnQodGhpcy5tb2RlbHMpO1xuICAgICAgcmV0dXJuIF9bbWV0aG9kXS5hcHBseShfLCBhcmdzKTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBVbmRlcnNjb3JlIG1ldGhvZHMgdGhhdCB0YWtlIGEgcHJvcGVydHkgbmFtZSBhcyBhbiBhcmd1bWVudC5cbiAgdmFyIGF0dHJpYnV0ZU1ldGhvZHMgPSBbJ2dyb3VwQnknLCAnY291bnRCeScsICdzb3J0QnknXTtcblxuICAvLyBVc2UgYXR0cmlidXRlcyBpbnN0ZWFkIG9mIHByb3BlcnRpZXMuXG4gIGF0dHJpYnV0ZU1ldGhvZHMuZmlsdGVyKHV0aWxFeGlzdHMpLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgQ29sbGVjdGlvbi5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKHZhbHVlLCBjb250ZXh0KSB7XG4gICAgICB2YXIgaXRlcmF0b3IgPSB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgPyB2YWx1ZSA6IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICAgIHJldHVybiBtb2RlbC5nZXQodmFsdWUpO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBfW21ldGhvZF0odGhpcy5tb2RlbHMsIGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICB9O1xuICB9KTtcbn0gZWxzZSB7XG4gIFsnZm9yRWFjaCcsICdtYXAnLCAnZmlsdGVyJywgJ3NvbWUnLCAnZXZlcnknLCAncmVkdWNlJywgJ3JlZHVjZVJpZ2h0JyxcbiAgICAnaW5kZXhPZicsICdsYXN0SW5kZXhPZiddLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgQ29sbGVjdGlvbi5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKGFyZywgY29udGV4dCkge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWxzW21ldGhvZF0oYXJnLCBjb250ZXh0KTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBFeG9za2VsZXRvbi1zcGVjaWZpYzpcbiAgQ29sbGVjdGlvbi5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uKGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICB0aGlzLnNvbWUoZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFVuZGVyc2NvcmUgbWV0aG9kcyB0aGF0IHRha2UgYSBwcm9wZXJ0eSBuYW1lIGFzIGFuIGFyZ3VtZW50LlxuICBbJ3NvcnRCeSddLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgQ29sbGVjdGlvbi5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKHZhbHVlLCBjb250ZXh0KSB7XG4gICAgICB2YXIgaXRlcmF0b3IgPSB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgPyB2YWx1ZSA6IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICAgIHJldHVybiBtb2RlbC5nZXQodmFsdWUpO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBfW21ldGhvZF0odGhpcy5tb2RlbHMsIGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICB9O1xuICB9KTtcbn1cbi8vIEJhY2tib25lLlZpZXdcbi8vIC0tLS0tLS0tLS0tLS1cblxuLy8gQmFja2JvbmUgVmlld3MgYXJlIGFsbW9zdCBtb3JlIGNvbnZlbnRpb24gdGhhbiB0aGV5IGFyZSBhY3R1YWwgY29kZS4gQSBWaWV3XG4vLyBpcyBzaW1wbHkgYSBKYXZhU2NyaXB0IG9iamVjdCB0aGF0IHJlcHJlc2VudHMgYSBsb2dpY2FsIGNodW5rIG9mIFVJIGluIHRoZVxuLy8gRE9NLiBUaGlzIG1pZ2h0IGJlIGEgc2luZ2xlIGl0ZW0sIGFuIGVudGlyZSBsaXN0LCBhIHNpZGViYXIgb3IgcGFuZWwsIG9yXG4vLyBldmVuIHRoZSBzdXJyb3VuZGluZyBmcmFtZSB3aGljaCB3cmFwcyB5b3VyIHdob2xlIGFwcC4gRGVmaW5pbmcgYSBjaHVuayBvZlxuLy8gVUkgYXMgYSAqKlZpZXcqKiBhbGxvd3MgeW91IHRvIGRlZmluZSB5b3VyIERPTSBldmVudHMgZGVjbGFyYXRpdmVseSwgd2l0aG91dFxuLy8gaGF2aW5nIHRvIHdvcnJ5IGFib3V0IHJlbmRlciBvcmRlciAuLi4gYW5kIG1ha2VzIGl0IGVhc3kgZm9yIHRoZSB2aWV3IHRvXG4vLyByZWFjdCB0byBzcGVjaWZpYyBjaGFuZ2VzIGluIHRoZSBzdGF0ZSBvZiB5b3VyIG1vZGVscy5cblxuLy8gQ3JlYXRpbmcgYSBCYWNrYm9uZS5WaWV3IGNyZWF0ZXMgaXRzIGluaXRpYWwgZWxlbWVudCBvdXRzaWRlIG9mIHRoZSBET00sXG4vLyBpZiBhbiBleGlzdGluZyBlbGVtZW50IGlzIG5vdCBwcm92aWRlZC4uLlxudmFyIFZpZXcgPSBCYWNrYm9uZS5WaWV3ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICB0aGlzLmNpZCA9IF8udW5pcXVlSWQoJ3ZpZXcnKTtcblxuICBpZiAob3B0aW9ucykgT2JqZWN0LmtleXMob3B0aW9ucykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICBpZiAodmlld09wdGlvbnMuaW5kZXhPZihrZXkpICE9PSAtMSkgdGhpc1trZXldID0gb3B0aW9uc1trZXldO1xuICB9LCB0aGlzKTtcblxuICB0aGlzLl9lbnN1cmVFbGVtZW50KCk7XG4gIHRoaXMuaW5pdGlhbGl6ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuLy8gQ2FjaGVkIHJlZ2V4IHRvIHNwbGl0IGtleXMgZm9yIGBkZWxlZ2F0ZWAuXG52YXIgZGVsZWdhdGVFdmVudFNwbGl0dGVyID0gL14oXFxTKylcXHMqKC4qKSQvO1xuXG4vLyBMaXN0IG9mIHZpZXcgb3B0aW9ucyB0byBiZSBtZXJnZWQgYXMgcHJvcGVydGllcy5cbnZhciB2aWV3T3B0aW9ucyA9IFsnbW9kZWwnLCAnY29sbGVjdGlvbicsICdlbCcsICdpZCcsICdhdHRyaWJ1dGVzJywgJ2NsYXNzTmFtZScsICd0YWdOYW1lJywgJ2V2ZW50cyddO1xuXG4vLyBTZXQgdXAgYWxsIGluaGVyaXRhYmxlICoqQmFja2JvbmUuVmlldyoqIHByb3BlcnRpZXMgYW5kIG1ldGhvZHMuXG5fLmV4dGVuZChWaWV3LnByb3RvdHlwZSwgRXZlbnRzLCB7XG5cbiAgLy8gVGhlIGRlZmF1bHQgYHRhZ05hbWVgIG9mIGEgVmlldydzIGVsZW1lbnQgaXMgYFwiZGl2XCJgLlxuICB0YWdOYW1lOiAnZGl2JyxcblxuICAvLyBqUXVlcnkgZGVsZWdhdGUgZm9yIGVsZW1lbnQgbG9va3VwLCBzY29wZWQgdG8gRE9NIGVsZW1lbnRzIHdpdGhpbiB0aGVcbiAgLy8gY3VycmVudCB2aWV3LiBUaGlzIHNob3VsZCBiZSBwcmVmZXJyZWQgdG8gZ2xvYmFsIGxvb2t1cHMgd2hlcmUgcG9zc2libGUuXG4gICQ6IGZ1bmN0aW9uKHNlbGVjdG9yKSB7XG4gICAgcmV0dXJuIHRoaXMuJGVsLmZpbmQoc2VsZWN0b3IpO1xuICB9LFxuXG4gIC8vIEluaXRpYWxpemUgaXMgYW4gZW1wdHkgZnVuY3Rpb24gYnkgZGVmYXVsdC4gT3ZlcnJpZGUgaXQgd2l0aCB5b3VyIG93blxuICAvLyBpbml0aWFsaXphdGlvbiBsb2dpYy5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oKXt9LFxuXG4gIC8vICoqcmVuZGVyKiogaXMgdGhlIGNvcmUgZnVuY3Rpb24gdGhhdCB5b3VyIHZpZXcgc2hvdWxkIG92ZXJyaWRlLCBpbiBvcmRlclxuICAvLyB0byBwb3B1bGF0ZSBpdHMgZWxlbWVudCAoYHRoaXMuZWxgKSwgd2l0aCB0aGUgYXBwcm9wcmlhdGUgSFRNTC4gVGhlXG4gIC8vIGNvbnZlbnRpb24gaXMgZm9yICoqcmVuZGVyKiogdG8gYWx3YXlzIHJldHVybiBgdGhpc2AuXG4gIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLy8gUmVtb3ZlIHRoaXMgdmlldyBieSB0YWtpbmcgdGhlIGVsZW1lbnQgb3V0IG9mIHRoZSBET00sIGFuZCByZW1vdmluZyBhbnlcbiAgLy8gYXBwbGljYWJsZSBCYWNrYm9uZS5FdmVudHMgbGlzdGVuZXJzLlxuICByZW1vdmU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3JlbW92ZUVsZW1lbnQoKTtcbiAgICB0aGlzLnN0b3BMaXN0ZW5pbmcoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBSZW1vdmUgdGhpcyB2aWV3J3MgZWxlbWVudCBmcm9tIHRoZSBkb2N1bWVudCBhbmQgYWxsIGV2ZW50IGxpc3RlbmVyc1xuICAvLyBhdHRhY2hlZCB0byBpdC4gRXhwb3NlZCBmb3Igc3ViY2xhc3NlcyB1c2luZyBhbiBhbHRlcm5hdGl2ZSBET01cbiAgLy8gbWFuaXB1bGF0aW9uIEFQSS5cbiAgX3JlbW92ZUVsZW1lbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuJGVsLnJlbW92ZSgpO1xuICB9LFxuXG4gIC8vIENoYW5nZSB0aGUgdmlldydzIGVsZW1lbnQgKGB0aGlzLmVsYCBwcm9wZXJ0eSkgYW5kIHJlLWRlbGVnYXRlIHRoZVxuICAvLyB2aWV3J3MgZXZlbnRzIG9uIHRoZSBuZXcgZWxlbWVudC5cbiAgc2V0RWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCkge1xuICAgIHRoaXMudW5kZWxlZ2F0ZUV2ZW50cygpO1xuICAgIHRoaXMuX3NldEVsZW1lbnQoZWxlbWVudCk7XG4gICAgdGhpcy5kZWxlZ2F0ZUV2ZW50cygpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIENyZWF0ZXMgdGhlIGB0aGlzLmVsYCBhbmQgYHRoaXMuJGVsYCByZWZlcmVuY2VzIGZvciB0aGlzIHZpZXcgdXNpbmcgdGhlXG4gIC8vIGdpdmVuIGBlbGAgYW5kIGEgaGFzaCBvZiBgYXR0cmlidXRlc2AuIGBlbGAgY2FuIGJlIGEgQ1NTIHNlbGVjdG9yIG9yIGFuXG4gIC8vIEhUTUwgc3RyaW5nLCBhIGpRdWVyeSBjb250ZXh0IG9yIGFuIGVsZW1lbnQuIFN1YmNsYXNzZXMgY2FuIG92ZXJyaWRlXG4gIC8vIHRoaXMgdG8gdXRpbGl6ZSBhbiBhbHRlcm5hdGl2ZSBET00gbWFuaXB1bGF0aW9uIEFQSSBhbmQgYXJlIG9ubHkgcmVxdWlyZWRcbiAgLy8gdG8gc2V0IHRoZSBgdGhpcy5lbGAgcHJvcGVydHkuXG4gIF9zZXRFbGVtZW50OiBmdW5jdGlvbihlbCkge1xuICAgIHRoaXMuJGVsID0gZWwgaW5zdGFuY2VvZiBCYWNrYm9uZS4kID8gZWwgOiBCYWNrYm9uZS4kKGVsKTtcbiAgICB0aGlzLmVsID0gdGhpcy4kZWxbMF07XG4gIH0sXG5cbiAgLy8gU2V0IGNhbGxiYWNrcywgd2hlcmUgYHRoaXMuZXZlbnRzYCBpcyBhIGhhc2ggb2ZcbiAgLy9cbiAgLy8gKntcImV2ZW50IHNlbGVjdG9yXCI6IFwiY2FsbGJhY2tcIn0qXG4gIC8vXG4gIC8vICAgICB7XG4gIC8vICAgICAgICdtb3VzZWRvd24gLnRpdGxlJzogICdlZGl0JyxcbiAgLy8gICAgICAgJ2NsaWNrIC5idXR0b24nOiAgICAgJ3NhdmUnLFxuICAvLyAgICAgICAnY2xpY2sgLm9wZW4nOiAgICAgICBmdW5jdGlvbihlKSB7IC4uLiB9XG4gIC8vICAgICB9XG4gIC8vXG4gIC8vIHBhaXJzLiBDYWxsYmFja3Mgd2lsbCBiZSBib3VuZCB0byB0aGUgdmlldywgd2l0aCBgdGhpc2Agc2V0IHByb3Blcmx5LlxuICAvLyBVc2VzIGV2ZW50IGRlbGVnYXRpb24gZm9yIGVmZmljaWVuY3kuXG4gIC8vIE9taXR0aW5nIHRoZSBzZWxlY3RvciBiaW5kcyB0aGUgZXZlbnQgdG8gYHRoaXMuZWxgLlxuICBkZWxlZ2F0ZUV2ZW50czogZnVuY3Rpb24oZXZlbnRzKSB7XG4gICAgaWYgKCEoZXZlbnRzIHx8IChldmVudHMgPSBfLnJlc3VsdCh0aGlzLCAnZXZlbnRzJykpKSkgcmV0dXJuIHRoaXM7XG4gICAgdGhpcy51bmRlbGVnYXRlRXZlbnRzKCk7XG4gICAgZm9yICh2YXIga2V5IGluIGV2ZW50cykge1xuICAgICAgdmFyIG1ldGhvZCA9IGV2ZW50c1trZXldO1xuICAgICAgaWYgKHR5cGVvZiBtZXRob2QgIT09ICdmdW5jdGlvbicpIG1ldGhvZCA9IHRoaXNbZXZlbnRzW2tleV1dO1xuICAgICAgLy8gaWYgKCFtZXRob2QpIGNvbnRpbnVlO1xuICAgICAgdmFyIG1hdGNoID0ga2V5Lm1hdGNoKGRlbGVnYXRlRXZlbnRTcGxpdHRlcik7XG4gICAgICB0aGlzLmRlbGVnYXRlKG1hdGNoWzFdLCBtYXRjaFsyXSwgbWV0aG9kLmJpbmQodGhpcykpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBBZGQgYSBzaW5nbGUgZXZlbnQgbGlzdGVuZXIgdG8gdGhlIHZpZXcncyBlbGVtZW50IChvciBhIGNoaWxkIGVsZW1lbnRcbiAgLy8gdXNpbmcgYHNlbGVjdG9yYCkuIFRoaXMgb25seSB3b3JrcyBmb3IgZGVsZWdhdGUtYWJsZSBldmVudHM6IG5vdCBgZm9jdXNgLFxuICAvLyBgYmx1cmAsIGFuZCBub3QgYGNoYW5nZWAsIGBzdWJtaXRgLCBhbmQgYHJlc2V0YCBpbiBJbnRlcm5ldCBFeHBsb3Jlci5cbiAgZGVsZWdhdGU6IGZ1bmN0aW9uKGV2ZW50TmFtZSwgc2VsZWN0b3IsIGxpc3RlbmVyKSB7XG4gICAgdGhpcy4kZWwub24oZXZlbnROYW1lICsgJy5kZWxlZ2F0ZUV2ZW50cycgKyB0aGlzLmNpZCwgc2VsZWN0b3IsIGxpc3RlbmVyKTtcbiAgfSxcblxuICAvLyBDbGVhcnMgYWxsIGNhbGxiYWNrcyBwcmV2aW91c2x5IGJvdW5kIHRvIHRoZSB2aWV3IGJ5IGBkZWxlZ2F0ZUV2ZW50c2AuXG4gIC8vIFlvdSB1c3VhbGx5IGRvbid0IG5lZWQgdG8gdXNlIHRoaXMsIGJ1dCBtYXkgd2lzaCB0byBpZiB5b3UgaGF2ZSBtdWx0aXBsZVxuICAvLyBCYWNrYm9uZSB2aWV3cyBhdHRhY2hlZCB0byB0aGUgc2FtZSBET00gZWxlbWVudC5cbiAgdW5kZWxlZ2F0ZUV2ZW50czogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuJGVsKSB0aGlzLiRlbC5vZmYoJy5kZWxlZ2F0ZUV2ZW50cycgKyB0aGlzLmNpZCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLy8gQSBmaW5lci1ncmFpbmVkIGB1bmRlbGVnYXRlRXZlbnRzYCBmb3IgcmVtb3ZpbmcgYSBzaW5nbGUgZGVsZWdhdGVkIGV2ZW50LlxuICAvLyBgc2VsZWN0b3JgIGFuZCBgbGlzdGVuZXJgIGFyZSBib3RoIG9wdGlvbmFsLlxuICB1bmRlbGVnYXRlOiBmdW5jdGlvbihldmVudE5hbWUsIHNlbGVjdG9yLCBsaXN0ZW5lcikge1xuICAgIHRoaXMuJGVsLm9mZihldmVudE5hbWUgKyAnLmRlbGVnYXRlRXZlbnRzJyArIHRoaXMuY2lkLCBzZWxlY3RvciwgbGlzdGVuZXIpO1xuICB9LFxuXG4gIC8vIFByb2R1Y2VzIGEgRE9NIGVsZW1lbnQgdG8gYmUgYXNzaWduZWQgdG8geW91ciB2aWV3LiBFeHBvc2VkIGZvclxuICAvLyBzdWJjbGFzc2VzIHVzaW5nIGFuIGFsdGVybmF0aXZlIERPTSBtYW5pcHVsYXRpb24gQVBJLlxuICBfY3JlYXRlRWxlbWVudDogZnVuY3Rpb24odGFnTmFtZSkge1xuICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xuICB9LFxuXG4gIC8vIEVuc3VyZSB0aGF0IHRoZSBWaWV3IGhhcyBhIERPTSBlbGVtZW50IHRvIHJlbmRlciBpbnRvLlxuICAvLyBJZiBgdGhpcy5lbGAgaXMgYSBzdHJpbmcsIHBhc3MgaXQgdGhyb3VnaCBgJCgpYCwgdGFrZSB0aGUgZmlyc3RcbiAgLy8gbWF0Y2hpbmcgZWxlbWVudCwgYW5kIHJlLWFzc2lnbiBpdCB0byBgZWxgLiBPdGhlcndpc2UsIGNyZWF0ZVxuICAvLyBhbiBlbGVtZW50IGZyb20gdGhlIGBpZGAsIGBjbGFzc05hbWVgIGFuZCBgdGFnTmFtZWAgcHJvcGVydGllcy5cbiAgX2Vuc3VyZUVsZW1lbnQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5lbCkge1xuICAgICAgdmFyIGF0dHJzID0gXy5leHRlbmQoe30sIF8ucmVzdWx0KHRoaXMsICdhdHRyaWJ1dGVzJykpO1xuICAgICAgaWYgKHRoaXMuaWQpIGF0dHJzLmlkID0gXy5yZXN1bHQodGhpcywgJ2lkJyk7XG4gICAgICBpZiAodGhpcy5jbGFzc05hbWUpIGF0dHJzWydjbGFzcyddID0gXy5yZXN1bHQodGhpcywgJ2NsYXNzTmFtZScpO1xuICAgICAgdGhpcy5zZXRFbGVtZW50KHRoaXMuX2NyZWF0ZUVsZW1lbnQoXy5yZXN1bHQodGhpcywgJ3RhZ05hbWUnKSkpO1xuICAgICAgdGhpcy5fc2V0QXR0cmlidXRlcyhhdHRycyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0RWxlbWVudChfLnJlc3VsdCh0aGlzLCAnZWwnKSk7XG4gICAgfVxuICB9LFxuXG4gIC8vIFNldCBhdHRyaWJ1dGVzIGZyb20gYSBoYXNoIG9uIHRoaXMgdmlldydzIGVsZW1lbnQuICBFeHBvc2VkIGZvclxuICAvLyBzdWJjbGFzc2VzIHVzaW5nIGFuIGFsdGVybmF0aXZlIERPTSBtYW5pcHVsYXRpb24gQVBJLlxuICBfc2V0QXR0cmlidXRlczogZnVuY3Rpb24oYXR0cmlidXRlcykge1xuICAgIHRoaXMuJGVsLmF0dHIoYXR0cmlidXRlcyk7XG4gIH1cblxufSk7XG4vLyBCYWNrYm9uZS5zeW5jXG4vLyAtLS0tLS0tLS0tLS0tXG5cbi8vIE92ZXJyaWRlIHRoaXMgZnVuY3Rpb24gdG8gY2hhbmdlIHRoZSBtYW5uZXIgaW4gd2hpY2ggQmFja2JvbmUgcGVyc2lzdHNcbi8vIG1vZGVscyB0byB0aGUgc2VydmVyLiBZb3Ugd2lsbCBiZSBwYXNzZWQgdGhlIHR5cGUgb2YgcmVxdWVzdCwgYW5kIHRoZVxuLy8gbW9kZWwgaW4gcXVlc3Rpb24uIEJ5IGRlZmF1bHQsIG1ha2VzIGEgUkVTVGZ1bCBBamF4IHJlcXVlc3Rcbi8vIHRvIHRoZSBtb2RlbCdzIGB1cmwoKWAuIFNvbWUgcG9zc2libGUgY3VzdG9taXphdGlvbnMgY291bGQgYmU6XG4vL1xuLy8gKiBVc2UgYHNldFRpbWVvdXRgIHRvIGJhdGNoIHJhcGlkLWZpcmUgdXBkYXRlcyBpbnRvIGEgc2luZ2xlIHJlcXVlc3QuXG4vLyAqIFNlbmQgdXAgdGhlIG1vZGVscyBhcyBYTUwgaW5zdGVhZCBvZiBKU09OLlxuLy8gKiBQZXJzaXN0IG1vZGVscyB2aWEgV2ViU29ja2V0cyBpbnN0ZWFkIG9mIEFqYXguXG5CYWNrYm9uZS5zeW5jID0gZnVuY3Rpb24obWV0aG9kLCBtb2RlbCwgb3B0aW9ucykge1xuICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pXG5cbiAgdmFyIHR5cGUgPSBtZXRob2RNYXBbbWV0aG9kXTtcblxuICAvLyBEZWZhdWx0IEpTT04tcmVxdWVzdCBvcHRpb25zLlxuICB2YXIgcGFyYW1zID0ge3R5cGU6IHR5cGUsIGRhdGFUeXBlOiAnanNvbid9O1xuXG4gIC8vIEVuc3VyZSB0aGF0IHdlIGhhdmUgYSBVUkwuXG4gIGlmICghb3B0aW9ucy51cmwpIHtcbiAgICBwYXJhbXMudXJsID0gXy5yZXN1bHQobW9kZWwsICd1cmwnKSB8fCB1cmxFcnJvcigpO1xuICB9XG5cbiAgLy8gRW5zdXJlIHRoYXQgd2UgaGF2ZSB0aGUgYXBwcm9wcmlhdGUgcmVxdWVzdCBkYXRhLlxuICBpZiAob3B0aW9ucy5kYXRhID09IG51bGwgJiYgbW9kZWwgJiYgKG1ldGhvZCA9PT0gJ2NyZWF0ZScgfHwgbWV0aG9kID09PSAndXBkYXRlJyB8fCBtZXRob2QgPT09ICdwYXRjaCcpKSB7XG4gICAgcGFyYW1zLmNvbnRlbnRUeXBlID0gJ2FwcGxpY2F0aW9uL2pzb24nO1xuICAgIHBhcmFtcy5kYXRhID0gSlNPTi5zdHJpbmdpZnkob3B0aW9ucy5hdHRycyB8fCBtb2RlbC50b0pTT04ob3B0aW9ucykpO1xuICB9XG5cbiAgLy8gRG9uJ3QgcHJvY2VzcyBkYXRhIG9uIGEgbm9uLUdFVCByZXF1ZXN0LlxuICBpZiAocGFyYW1zLnR5cGUgIT09ICdHRVQnKSB7XG4gICAgcGFyYW1zLnByb2Nlc3NEYXRhID0gZmFsc2U7XG4gIH1cblxuICAvLyBNYWtlIHRoZSByZXF1ZXN0LCBhbGxvd2luZyB0aGUgdXNlciB0byBvdmVycmlkZSBhbnkgQWpheCBvcHRpb25zLlxuICB2YXIgeGhyID0gb3B0aW9ucy54aHIgPSBCYWNrYm9uZS5hamF4KF8uZXh0ZW5kKHBhcmFtcywgb3B0aW9ucykpO1xuICBtb2RlbC50cmlnZ2VyKCdyZXF1ZXN0JywgbW9kZWwsIHhociwgb3B0aW9ucyk7XG4gIHJldHVybiB4aHI7XG59O1xuXG4vLyBNYXAgZnJvbSBDUlVEIHRvIEhUVFAgZm9yIG91ciBkZWZhdWx0IGBCYWNrYm9uZS5zeW5jYCBpbXBsZW1lbnRhdGlvbi5cbnZhciBtZXRob2RNYXAgPSB7XG4gICdjcmVhdGUnOiAnUE9TVCcsXG4gICd1cGRhdGUnOiAnUFVUJyxcbiAgJ3BhdGNoJzogICdQQVRDSCcsXG4gICdkZWxldGUnOiAnREVMRVRFJyxcbiAgJ3JlYWQnOiAgICdHRVQnXG59O1xuXG4vLyBTZXQgdGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24gb2YgYEJhY2tib25lLmFqYXhgIHRvIHByb3h5IHRocm91Z2ggdG8gYCRgLlxuLy8gT3ZlcnJpZGUgdGhpcyBpZiB5b3UnZCBsaWtlIHRvIHVzZSBhIGRpZmZlcmVudCBsaWJyYXJ5LlxuQmFja2JvbmUuYWpheCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gQmFja2JvbmUuJC5hamF4LmFwcGx5KEJhY2tib25lLiQsIGFyZ3VtZW50cyk7XG59O1xuLy8gQmFja2JvbmUuUm91dGVyXG4vLyAtLS0tLS0tLS0tLS0tLS1cblxuLy8gUm91dGVycyBtYXAgZmF1eC1VUkxzIHRvIGFjdGlvbnMsIGFuZCBmaXJlIGV2ZW50cyB3aGVuIHJvdXRlcyBhcmVcbi8vIG1hdGNoZWQuIENyZWF0aW5nIGEgbmV3IG9uZSBzZXRzIGl0cyBgcm91dGVzYCBoYXNoLCBpZiBub3Qgc2V0IHN0YXRpY2FsbHkuXG52YXIgUm91dGVyID0gQmFja2JvbmUuUm91dGVyID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuICBpZiAob3B0aW9ucy5yb3V0ZXMpIHRoaXMucm91dGVzID0gb3B0aW9ucy5yb3V0ZXM7XG4gIHRoaXMuX2JpbmRSb3V0ZXMoKTtcbiAgdGhpcy5pbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG4vLyBDYWNoZWQgcmVndWxhciBleHByZXNzaW9ucyBmb3IgbWF0Y2hpbmcgbmFtZWQgcGFyYW0gcGFydHMgYW5kIHNwbGF0dGVkXG4vLyBwYXJ0cyBvZiByb3V0ZSBzdHJpbmdzLlxudmFyIG9wdGlvbmFsUGFyYW0gPSAvXFwoKC4qPylcXCkvZztcbnZhciBuYW1lZFBhcmFtICAgID0gLyhcXChcXD8pPzpcXHcrL2c7XG52YXIgc3BsYXRQYXJhbSAgICA9IC9cXCpcXHcrL2c7XG52YXIgZXNjYXBlUmVnRXhwICA9IC9bXFwte31cXFtcXF0rPy4sXFxcXFxcXiR8I1xcc10vZztcblxudmFyIGlzUmVnRXhwID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID8gKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nKSA6IGZhbHNlO1xufTtcblxuLy8gU2V0IHVwIGFsbCBpbmhlcml0YWJsZSAqKkJhY2tib25lLlJvdXRlcioqIHByb3BlcnRpZXMgYW5kIG1ldGhvZHMuXG5fLmV4dGVuZChSb3V0ZXIucHJvdG90eXBlLCBFdmVudHMsIHtcblxuICAvLyBJbml0aWFsaXplIGlzIGFuIGVtcHR5IGZ1bmN0aW9uIGJ5IGRlZmF1bHQuIE92ZXJyaWRlIGl0IHdpdGggeW91ciBvd25cbiAgLy8gaW5pdGlhbGl6YXRpb24gbG9naWMuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKCl7fSxcblxuICAvLyBNYW51YWxseSBiaW5kIGEgc2luZ2xlIG5hbWVkIHJvdXRlIHRvIGEgY2FsbGJhY2suIEZvciBleGFtcGxlOlxuICAvL1xuICAvLyAgICAgdGhpcy5yb3V0ZSgnc2VhcmNoLzpxdWVyeS9wOm51bScsICdzZWFyY2gnLCBmdW5jdGlvbihxdWVyeSwgbnVtKSB7XG4gIC8vICAgICAgIC4uLlxuICAvLyAgICAgfSk7XG4gIC8vXG4gIHJvdXRlOiBmdW5jdGlvbihyb3V0ZSwgbmFtZSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIWlzUmVnRXhwKHJvdXRlKSkgcm91dGUgPSB0aGlzLl9yb3V0ZVRvUmVnRXhwKHJvdXRlKTtcbiAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gbmFtZTtcbiAgICAgIG5hbWUgPSAnJztcbiAgICB9XG4gICAgaWYgKCFjYWxsYmFjaykgY2FsbGJhY2sgPSB0aGlzW25hbWVdO1xuICAgIHZhciByb3V0ZXIgPSB0aGlzO1xuICAgIEJhY2tib25lLmhpc3Rvcnkucm91dGUocm91dGUsIGZ1bmN0aW9uKGZyYWdtZW50KSB7XG4gICAgICB2YXIgYXJncyA9IHJvdXRlci5fZXh0cmFjdFBhcmFtZXRlcnMocm91dGUsIGZyYWdtZW50KTtcbiAgICAgIHJvdXRlci5leGVjdXRlKGNhbGxiYWNrLCBhcmdzKTtcbiAgICAgIHJvdXRlci50cmlnZ2VyLmFwcGx5KHJvdXRlciwgWydyb3V0ZTonICsgbmFtZV0uY29uY2F0KGFyZ3MpKTtcbiAgICAgIHJvdXRlci50cmlnZ2VyKCdyb3V0ZScsIG5hbWUsIGFyZ3MpO1xuICAgICAgQmFja2JvbmUuaGlzdG9yeS50cmlnZ2VyKCdyb3V0ZScsIHJvdXRlciwgbmFtZSwgYXJncyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLy8gRXhlY3V0ZSBhIHJvdXRlIGhhbmRsZXIgd2l0aCB0aGUgcHJvdmlkZWQgcGFyYW1ldGVycy4gIFRoaXMgaXMgYW5cbiAgLy8gZXhjZWxsZW50IHBsYWNlIHRvIGRvIHByZS1yb3V0ZSBzZXR1cCBvciBwb3N0LXJvdXRlIGNsZWFudXAuXG4gIGV4ZWN1dGU6IGZ1bmN0aW9uKGNhbGxiYWNrLCBhcmdzKSB7XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfSxcblxuICAvLyBTaW1wbGUgcHJveHkgdG8gYEJhY2tib25lLmhpc3RvcnlgIHRvIHNhdmUgYSBmcmFnbWVudCBpbnRvIHRoZSBoaXN0b3J5LlxuICBuYXZpZ2F0ZTogZnVuY3Rpb24oZnJhZ21lbnQsIG9wdGlvbnMpIHtcbiAgICBCYWNrYm9uZS5oaXN0b3J5Lm5hdmlnYXRlKGZyYWdtZW50LCBvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBCaW5kIGFsbCBkZWZpbmVkIHJvdXRlcyB0byBgQmFja2JvbmUuaGlzdG9yeWAuIFdlIGhhdmUgdG8gcmV2ZXJzZSB0aGVcbiAgLy8gb3JkZXIgb2YgdGhlIHJvdXRlcyBoZXJlIHRvIHN1cHBvcnQgYmVoYXZpb3Igd2hlcmUgdGhlIG1vc3QgZ2VuZXJhbFxuICAvLyByb3V0ZXMgY2FuIGJlIGRlZmluZWQgYXQgdGhlIGJvdHRvbSBvZiB0aGUgcm91dGUgbWFwLlxuICBfYmluZFJvdXRlczogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLnJvdXRlcykgcmV0dXJuO1xuICAgIHRoaXMucm91dGVzID0gXy5yZXN1bHQodGhpcywgJ3JvdXRlcycpO1xuICAgIHZhciByb3V0ZSwgcm91dGVzID0gT2JqZWN0LmtleXModGhpcy5yb3V0ZXMpO1xuICAgIHdoaWxlICgocm91dGUgPSByb3V0ZXMucG9wKCkpICE9IG51bGwpIHtcbiAgICAgIHRoaXMucm91dGUocm91dGUsIHRoaXMucm91dGVzW3JvdXRlXSk7XG4gICAgfVxuICB9LFxuXG4gIC8vIENvbnZlcnQgYSByb3V0ZSBzdHJpbmcgaW50byBhIHJlZ3VsYXIgZXhwcmVzc2lvbiwgc3VpdGFibGUgZm9yIG1hdGNoaW5nXG4gIC8vIGFnYWluc3QgdGhlIGN1cnJlbnQgbG9jYXRpb24gaGFzaC5cbiAgX3JvdXRlVG9SZWdFeHA6IGZ1bmN0aW9uKHJvdXRlKSB7XG4gICAgcm91dGUgPSByb3V0ZS5yZXBsYWNlKGVzY2FwZVJlZ0V4cCwgJ1xcXFwkJicpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKG9wdGlvbmFsUGFyYW0sICcoPzokMSk/JylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UobmFtZWRQYXJhbSwgZnVuY3Rpb24obWF0Y2gsIG9wdGlvbmFsKSB7XG4gICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbmFsID8gbWF0Y2ggOiAnKFteLz9dKyknO1xuICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAucmVwbGFjZShzcGxhdFBhcmFtLCAnKFteP10qPyknKTtcbiAgICByZXR1cm4gbmV3IFJlZ0V4cCgnXicgKyByb3V0ZSArICcoPzpcXFxcPyhbXFxcXHNcXFxcU10qKSk/JCcpO1xuICB9LFxuXG4gIC8vIEdpdmVuIGEgcm91dGUsIGFuZCBhIFVSTCBmcmFnbWVudCB0aGF0IGl0IG1hdGNoZXMsIHJldHVybiB0aGUgYXJyYXkgb2ZcbiAgLy8gZXh0cmFjdGVkIGRlY29kZWQgcGFyYW1ldGVycy4gRW1wdHkgb3IgdW5tYXRjaGVkIHBhcmFtZXRlcnMgd2lsbCBiZVxuICAvLyB0cmVhdGVkIGFzIGBudWxsYCB0byBub3JtYWxpemUgY3Jvc3MtYnJvd3NlciBiZWhhdmlvci5cbiAgX2V4dHJhY3RQYXJhbWV0ZXJzOiBmdW5jdGlvbihyb3V0ZSwgZnJhZ21lbnQpIHtcbiAgICB2YXIgcGFyYW1zID0gcm91dGUuZXhlYyhmcmFnbWVudCkuc2xpY2UoMSk7XG4gICAgcmV0dXJuIHBhcmFtcy5tYXAoZnVuY3Rpb24ocGFyYW0sIGkpIHtcbiAgICAgIC8vIERvbid0IGRlY29kZSB0aGUgc2VhcmNoIHBhcmFtcy5cbiAgICAgIGlmIChpID09PSBwYXJhbXMubGVuZ3RoIC0gMSkgcmV0dXJuIHBhcmFtIHx8IG51bGw7XG4gICAgICByZXR1cm4gcGFyYW0gPyBkZWNvZGVVUklDb21wb25lbnQocGFyYW0pIDogbnVsbDtcbiAgICB9KTtcbiAgfVxuXG59KTtcbi8vIEJhY2tib25lLkhpc3Rvcnlcbi8vIC0tLS0tLS0tLS0tLS0tLS1cblxuLy8gSGFuZGxlcyBjcm9zcy1icm93c2VyIGhpc3RvcnkgbWFuYWdlbWVudCwgYmFzZWQgb24gZWl0aGVyXG4vLyBbcHVzaFN0YXRlXShodHRwOi8vZGl2ZWludG9odG1sNS5pbmZvL2hpc3RvcnkuaHRtbCkgYW5kIHJlYWwgVVJMcywgb3Jcbi8vIFtvbmhhc2hjaGFuZ2VdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvRE9NL3dpbmRvdy5vbmhhc2hjaGFuZ2UpXG4vLyBhbmQgVVJMIGZyYWdtZW50cy5cbnZhciBIaXN0b3J5ID0gQmFja2JvbmUuSGlzdG9yeSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmhhbmRsZXJzID0gW107XG4gIHRoaXMuY2hlY2tVcmwgPSB0aGlzLmNoZWNrVXJsLmJpbmQodGhpcyk7XG5cbiAgLy8gRW5zdXJlIHRoYXQgYEhpc3RvcnlgIGNhbiBiZSB1c2VkIG91dHNpZGUgb2YgdGhlIGJyb3dzZXIuXG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHRoaXMubG9jYXRpb24gPSB3aW5kb3cubG9jYXRpb247XG4gICAgdGhpcy5oaXN0b3J5ID0gd2luZG93Lmhpc3Rvcnk7XG4gIH1cbn07XG5cbi8vIENhY2hlZCByZWdleCBmb3Igc3RyaXBwaW5nIGEgbGVhZGluZyBoYXNoL3NsYXNoIGFuZCB0cmFpbGluZyBzcGFjZS5cbnZhciByb3V0ZVN0cmlwcGVyID0gL15bI1xcL118XFxzKyQvZztcblxuLy8gQ2FjaGVkIHJlZ2V4IGZvciBzdHJpcHBpbmcgbGVhZGluZyBhbmQgdHJhaWxpbmcgc2xhc2hlcy5cbnZhciByb290U3RyaXBwZXIgPSAvXlxcLyt8XFwvKyQvZztcblxuLy8gQ2FjaGVkIHJlZ2V4IGZvciByZW1vdmluZyBhIHRyYWlsaW5nIHNsYXNoLlxudmFyIHRyYWlsaW5nU2xhc2ggPSAvXFwvJC87XG5cbi8vIENhY2hlZCByZWdleCBmb3Igc3RyaXBwaW5nIHVybHMgb2YgaGFzaCBhbmQgcXVlcnkuXG52YXIgcGF0aFN0cmlwcGVyID0gL1sjXS4qJC87XG5cbi8vIEhhcyB0aGUgaGlzdG9yeSBoYW5kbGluZyBhbHJlYWR5IGJlZW4gc3RhcnRlZD9cbkhpc3Rvcnkuc3RhcnRlZCA9IGZhbHNlO1xuXG4vLyBTZXQgdXAgYWxsIGluaGVyaXRhYmxlICoqQmFja2JvbmUuSGlzdG9yeSoqIHByb3BlcnRpZXMgYW5kIG1ldGhvZHMuXG5fLmV4dGVuZChIaXN0b3J5LnByb3RvdHlwZSwgRXZlbnRzLCB7XG5cbiAgLy8gQXJlIHdlIGF0IHRoZSBhcHAgcm9vdD9cbiAgYXRSb290OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5sb2NhdGlvbi5wYXRobmFtZS5yZXBsYWNlKC9bXlxcL10kLywgJyQmLycpID09PSB0aGlzLnJvb3Q7XG4gIH0sXG5cbiAgLy8gR2V0cyB0aGUgdHJ1ZSBoYXNoIHZhbHVlLiBDYW5ub3QgdXNlIGxvY2F0aW9uLmhhc2ggZGlyZWN0bHkgZHVlIHRvIGJ1Z1xuICAvLyBpbiBGaXJlZm94IHdoZXJlIGxvY2F0aW9uLmhhc2ggd2lsbCBhbHdheXMgYmUgZGVjb2RlZC5cbiAgZ2V0SGFzaDogZnVuY3Rpb24od2luZG93KSB7XG4gICAgdmFyIG1hdGNoID0gKHdpbmRvdyB8fCB0aGlzKS5sb2NhdGlvbi5ocmVmLm1hdGNoKC8jKC4qKSQvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6ICcnO1xuICB9LFxuXG4gIC8vIEdldCB0aGUgY3Jvc3MtYnJvd3NlciBub3JtYWxpemVkIFVSTCBmcmFnbWVudCwgZWl0aGVyIGZyb20gdGhlIFVSTCxcbiAgLy8gdGhlIGhhc2gsIG9yIHRoZSBvdmVycmlkZS5cbiAgZ2V0RnJhZ21lbnQ6IGZ1bmN0aW9uKGZyYWdtZW50LCBmb3JjZVB1c2hTdGF0ZSkge1xuICAgIGlmIChmcmFnbWVudCA9PSBudWxsKSB7XG4gICAgICBpZiAodGhpcy5fd2FudHNQdXNoU3RhdGUgfHwgIXRoaXMuX3dhbnRzSGFzaENoYW5nZSkge1xuICAgICAgICBmcmFnbWVudCA9IGRlY29kZVVSSSh0aGlzLmxvY2F0aW9uLnBhdGhuYW1lICsgdGhpcy5sb2NhdGlvbi5zZWFyY2gpO1xuICAgICAgICB2YXIgcm9vdCA9IHRoaXMucm9vdC5yZXBsYWNlKHRyYWlsaW5nU2xhc2gsICcnKTtcbiAgICAgICAgaWYgKCFmcmFnbWVudC5pbmRleE9mKHJvb3QpKSBmcmFnbWVudCA9IGZyYWdtZW50LnNsaWNlKHJvb3QubGVuZ3RoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdtZW50ID0gdGhpcy5nZXRIYXNoKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmcmFnbWVudC5yZXBsYWNlKHJvdXRlU3RyaXBwZXIsICcnKTtcbiAgfSxcblxuICAvLyBTdGFydCB0aGUgaGFzaCBjaGFuZ2UgaGFuZGxpbmcsIHJldHVybmluZyBgdHJ1ZWAgaWYgdGhlIGN1cnJlbnQgVVJMIG1hdGNoZXNcbiAgLy8gYW4gZXhpc3Rpbmcgcm91dGUsIGFuZCBgZmFsc2VgIG90aGVyd2lzZS5cbiAgc3RhcnQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBpZiAoSGlzdG9yeS5zdGFydGVkKSB0aHJvdyBuZXcgRXJyb3IoXCJCYWNrYm9uZS5oaXN0b3J5IGhhcyBhbHJlYWR5IGJlZW4gc3RhcnRlZFwiKTtcbiAgICBIaXN0b3J5LnN0YXJ0ZWQgPSB0cnVlO1xuXG4gICAgLy8gRmlndXJlIG91dCB0aGUgaW5pdGlhbCBjb25maWd1cmF0aW9uLlxuICAgIC8vIElzIHB1c2hTdGF0ZSBkZXNpcmVkIG9yIHNob3VsZCB3ZSB1c2UgaGFzaGNoYW5nZSBvbmx5P1xuICAgIHRoaXMub3B0aW9ucyAgICAgICAgICA9IF8uZXh0ZW5kKHtyb290OiAnLyd9LCB0aGlzLm9wdGlvbnMsIG9wdGlvbnMpO1xuICAgIHRoaXMucm9vdCAgICAgICAgICAgICA9IHRoaXMub3B0aW9ucy5yb290O1xuICAgIHRoaXMuX3dhbnRzSGFzaENoYW5nZSA9IHRoaXMub3B0aW9ucy5oYXNoQ2hhbmdlICE9PSBmYWxzZTtcbiAgICB0aGlzLl93YW50c1B1c2hTdGF0ZSAgPSAhIXRoaXMub3B0aW9ucy5wdXNoU3RhdGU7XG4gICAgdmFyIGZyYWdtZW50ICAgICAgICAgID0gdGhpcy5nZXRGcmFnbWVudCgpO1xuXG4gICAgLy8gTm9ybWFsaXplIHJvb3QgdG8gYWx3YXlzIGluY2x1ZGUgYSBsZWFkaW5nIGFuZCB0cmFpbGluZyBzbGFzaC5cbiAgICB0aGlzLnJvb3QgPSAoJy8nICsgdGhpcy5yb290ICsgJy8nKS5yZXBsYWNlKHJvb3RTdHJpcHBlciwgJy8nKTtcblxuICAgIC8vIERlcGVuZGluZyBvbiB3aGV0aGVyIHdlJ3JlIHVzaW5nIHB1c2hTdGF0ZSBvciBoYXNoZXMsIGRldGVybWluZSBob3cgd2VcbiAgICAvLyBjaGVjayB0aGUgVVJMIHN0YXRlLlxuICAgIGlmICh0aGlzLl93YW50c1B1c2hTdGF0ZSkge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgdGhpcy5jaGVja1VybCwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fd2FudHNIYXNoQ2hhbmdlKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignaGFzaGNoYW5nZScsIHRoaXMuY2hlY2tVcmwsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvLyBEZXRlcm1pbmUgaWYgd2UgbmVlZCB0byBjaGFuZ2UgdGhlIGJhc2UgdXJsLCBmb3IgYSBwdXNoU3RhdGUgbGlua1xuICAgIC8vIG9wZW5lZCBieSBhIG5vbi1wdXNoU3RhdGUgYnJvd3Nlci5cbiAgICB0aGlzLmZyYWdtZW50ID0gZnJhZ21lbnQ7XG4gICAgdmFyIGxvYyA9IHRoaXMubG9jYXRpb247XG5cbiAgICAvLyBUcmFuc2l0aW9uIGZyb20gaGFzaENoYW5nZSB0byBwdXNoU3RhdGUgb3IgdmljZSB2ZXJzYSBpZiBib3RoIGFyZVxuICAgIC8vIHJlcXVlc3RlZC5cbiAgICBpZiAodGhpcy5fd2FudHNIYXNoQ2hhbmdlICYmIHRoaXMuX3dhbnRzUHVzaFN0YXRlKSB7XG5cbiAgICAgIC8vIElmIHdlJ3ZlIHN0YXJ0ZWQgb3V0IHdpdGggYSBoYXNoLWJhc2VkIHJvdXRlLCBidXQgd2UncmUgY3VycmVudGx5XG4gICAgICAvLyBpbiBhIGJyb3dzZXIgd2hlcmUgaXQgY291bGQgYmUgYHB1c2hTdGF0ZWAtYmFzZWQgaW5zdGVhZC4uLlxuICAgICAgaWYgKHRoaXMuYXRSb290KCkgJiYgbG9jLmhhc2gpIHtcbiAgICAgICAgdGhpcy5mcmFnbWVudCA9IHRoaXMuZ2V0SGFzaCgpLnJlcGxhY2Uocm91dGVTdHJpcHBlciwgJycpO1xuICAgICAgICB0aGlzLmhpc3RvcnkucmVwbGFjZVN0YXRlKHt9LCBkb2N1bWVudC50aXRsZSwgdGhpcy5yb290ICsgdGhpcy5mcmFnbWVudCk7XG4gICAgICB9XG5cbiAgICB9XG5cbiAgICBpZiAoIXRoaXMub3B0aW9ucy5zaWxlbnQpIHJldHVybiB0aGlzLmxvYWRVcmwoKTtcbiAgfSxcblxuICAvLyBEaXNhYmxlIEJhY2tib25lLmhpc3RvcnksIHBlcmhhcHMgdGVtcG9yYXJpbHkuIE5vdCB1c2VmdWwgaW4gYSByZWFsIGFwcCxcbiAgLy8gYnV0IHBvc3NpYmx5IHVzZWZ1bCBmb3IgdW5pdCB0ZXN0aW5nIFJvdXRlcnMuXG4gIHN0b3A6IGZ1bmN0aW9uKCkge1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIHRoaXMuY2hlY2tVcmwpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdoYXNoY2hhbmdlJywgdGhpcy5jaGVja1VybCk7XG4gICAgSGlzdG9yeS5zdGFydGVkID0gZmFsc2U7XG4gIH0sXG5cbiAgLy8gQWRkIGEgcm91dGUgdG8gYmUgdGVzdGVkIHdoZW4gdGhlIGZyYWdtZW50IGNoYW5nZXMuIFJvdXRlcyBhZGRlZCBsYXRlclxuICAvLyBtYXkgb3ZlcnJpZGUgcHJldmlvdXMgcm91dGVzLlxuICByb3V0ZTogZnVuY3Rpb24ocm91dGUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5oYW5kbGVycy51bnNoaWZ0KHtyb3V0ZTogcm91dGUsIGNhbGxiYWNrOiBjYWxsYmFja30pO1xuICB9LFxuXG4gIC8vIENoZWNrcyB0aGUgY3VycmVudCBVUkwgdG8gc2VlIGlmIGl0IGhhcyBjaGFuZ2VkLCBhbmQgaWYgaXQgaGFzLFxuICAvLyBjYWxscyBgbG9hZFVybGAuXG4gIGNoZWNrVXJsOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgY3VycmVudCA9IHRoaXMuZ2V0RnJhZ21lbnQoKTtcbiAgICBpZiAoY3VycmVudCA9PT0gdGhpcy5mcmFnbWVudCkgcmV0dXJuIGZhbHNlO1xuICAgIHRoaXMubG9hZFVybCgpO1xuICB9LFxuXG4gIC8vIEF0dGVtcHQgdG8gbG9hZCB0aGUgY3VycmVudCBVUkwgZnJhZ21lbnQuIElmIGEgcm91dGUgc3VjY2VlZHMgd2l0aCBhXG4gIC8vIG1hdGNoLCByZXR1cm5zIGB0cnVlYC4gSWYgbm8gZGVmaW5lZCByb3V0ZXMgbWF0Y2hlcyB0aGUgZnJhZ21lbnQsXG4gIC8vIHJldHVybnMgYGZhbHNlYC5cbiAgbG9hZFVybDogZnVuY3Rpb24oZnJhZ21lbnQpIHtcbiAgICBmcmFnbWVudCA9IHRoaXMuZnJhZ21lbnQgPSB0aGlzLmdldEZyYWdtZW50KGZyYWdtZW50KTtcbiAgICByZXR1cm4gdGhpcy5oYW5kbGVycy5zb21lKGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgICAgIGlmIChoYW5kbGVyLnJvdXRlLnRlc3QoZnJhZ21lbnQpKSB7XG4gICAgICAgIGhhbmRsZXIuY2FsbGJhY2soZnJhZ21lbnQpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICAvLyBTYXZlIGEgZnJhZ21lbnQgaW50byB0aGUgaGFzaCBoaXN0b3J5LCBvciByZXBsYWNlIHRoZSBVUkwgc3RhdGUgaWYgdGhlXG4gIC8vICdyZXBsYWNlJyBvcHRpb24gaXMgcGFzc2VkLiBZb3UgYXJlIHJlc3BvbnNpYmxlIGZvciBwcm9wZXJseSBVUkwtZW5jb2RpbmdcbiAgLy8gdGhlIGZyYWdtZW50IGluIGFkdmFuY2UuXG4gIC8vXG4gIC8vIFRoZSBvcHRpb25zIG9iamVjdCBjYW4gY29udGFpbiBgdHJpZ2dlcjogdHJ1ZWAgaWYgeW91IHdpc2ggdG8gaGF2ZSB0aGVcbiAgLy8gcm91dGUgY2FsbGJhY2sgYmUgZmlyZWQgKG5vdCB1c3VhbGx5IGRlc2lyYWJsZSksIG9yIGByZXBsYWNlOiB0cnVlYCwgaWZcbiAgLy8geW91IHdpc2ggdG8gbW9kaWZ5IHRoZSBjdXJyZW50IFVSTCB3aXRob3V0IGFkZGluZyBhbiBlbnRyeSB0byB0aGUgaGlzdG9yeS5cbiAgbmF2aWdhdGU6IGZ1bmN0aW9uKGZyYWdtZW50LCBvcHRpb25zKSB7XG4gICAgaWYgKCFIaXN0b3J5LnN0YXJ0ZWQpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIW9wdGlvbnMgfHwgb3B0aW9ucyA9PT0gdHJ1ZSkgb3B0aW9ucyA9IHt0cmlnZ2VyOiAhIW9wdGlvbnN9O1xuXG4gICAgdmFyIHVybCA9IHRoaXMucm9vdCArIChmcmFnbWVudCA9IHRoaXMuZ2V0RnJhZ21lbnQoZnJhZ21lbnQgfHwgJycpKTtcblxuICAgIC8vIFN0cmlwIHRoZSBoYXNoIGZvciBtYXRjaGluZy5cbiAgICBmcmFnbWVudCA9IGZyYWdtZW50LnJlcGxhY2UocGF0aFN0cmlwcGVyLCAnJyk7XG5cbiAgICBpZiAodGhpcy5mcmFnbWVudCA9PT0gZnJhZ21lbnQpIHJldHVybjtcbiAgICB0aGlzLmZyYWdtZW50ID0gZnJhZ21lbnQ7XG5cbiAgICAvLyBEb24ndCBpbmNsdWRlIGEgdHJhaWxpbmcgc2xhc2ggb24gdGhlIHJvb3QuXG4gICAgaWYgKGZyYWdtZW50ID09PSAnJyAmJiB1cmwgIT09ICcvJykgdXJsID0gdXJsLnNsaWNlKDAsIC0xKTtcblxuICAgIC8vIElmIHdlJ3JlIHVzaW5nIHB1c2hTdGF0ZSB3ZSB1c2UgaXQgdG8gc2V0IHRoZSBmcmFnbWVudCBhcyBhIHJlYWwgVVJMLlxuICAgIGlmICh0aGlzLl93YW50c1B1c2hTdGF0ZSkge1xuICAgICAgdGhpcy5oaXN0b3J5W29wdGlvbnMucmVwbGFjZSA/ICdyZXBsYWNlU3RhdGUnIDogJ3B1c2hTdGF0ZSddKHt9LCBkb2N1bWVudC50aXRsZSwgdXJsKTtcblxuICAgIC8vIElmIGhhc2ggY2hhbmdlcyBoYXZlbid0IGJlZW4gZXhwbGljaXRseSBkaXNhYmxlZCwgdXBkYXRlIHRoZSBoYXNoXG4gICAgLy8gZnJhZ21lbnQgdG8gc3RvcmUgaGlzdG9yeS5cbiAgICB9IGVsc2UgaWYgKHRoaXMuX3dhbnRzSGFzaENoYW5nZSkge1xuICAgICAgdGhpcy5fdXBkYXRlSGFzaCh0aGlzLmxvY2F0aW9uLCBmcmFnbWVudCwgb3B0aW9ucy5yZXBsYWNlKTtcbiAgICAvLyBJZiB5b3UndmUgdG9sZCB1cyB0aGF0IHlvdSBleHBsaWNpdGx5IGRvbid0IHdhbnQgZmFsbGJhY2sgaGFzaGNoYW5nZS1cbiAgICAvLyBiYXNlZCBoaXN0b3J5LCB0aGVuIGBuYXZpZ2F0ZWAgYmVjb21lcyBhIHBhZ2UgcmVmcmVzaC5cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMubG9jYXRpb24uYXNzaWduKHVybCk7XG4gICAgfVxuICAgIGlmIChvcHRpb25zLnRyaWdnZXIpIHJldHVybiB0aGlzLmxvYWRVcmwoZnJhZ21lbnQpO1xuICB9LFxuXG4gIC8vIFVwZGF0ZSB0aGUgaGFzaCBsb2NhdGlvbiwgZWl0aGVyIHJlcGxhY2luZyB0aGUgY3VycmVudCBlbnRyeSwgb3IgYWRkaW5nXG4gIC8vIGEgbmV3IG9uZSB0byB0aGUgYnJvd3NlciBoaXN0b3J5LlxuICBfdXBkYXRlSGFzaDogZnVuY3Rpb24obG9jYXRpb24sIGZyYWdtZW50LCByZXBsYWNlKSB7XG4gICAgaWYgKHJlcGxhY2UpIHtcbiAgICAgIHZhciBocmVmID0gbG9jYXRpb24uaHJlZi5yZXBsYWNlKC8oamF2YXNjcmlwdDp8IykuKiQvLCAnJyk7XG4gICAgICBsb2NhdGlvbi5yZXBsYWNlKGhyZWYgKyAnIycgKyBmcmFnbWVudCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNvbWUgYnJvd3NlcnMgcmVxdWlyZSB0aGF0IGBoYXNoYCBjb250YWlucyBhIGxlYWRpbmcgIy5cbiAgICAgIGxvY2F0aW9uLmhhc2ggPSAnIycgKyBmcmFnbWVudDtcbiAgICB9XG4gIH1cblxufSk7XG4gIC8vICEhIVxuICAvLyBJbml0LlxuICBbJ01vZGVsJywgJ0NvbGxlY3Rpb24nLCAnUm91dGVyJywgJ1ZpZXcnLCAnSGlzdG9yeSddLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBpdGVtID0gQmFja2JvbmVbbmFtZV07XG4gICAgaWYgKGl0ZW0pIGl0ZW0uZXh0ZW5kID0gQmFja2JvbmUuZXh0ZW5kO1xuICB9KTtcblxuICAvLyBBbGxvdyB0aGUgYEJhY2tib25lYCBvYmplY3QgdG8gc2VydmUgYXMgYSBnbG9iYWwgZXZlbnQgYnVzLCBmb3IgZm9sa3Mgd2hvXG4gIC8vIHdhbnQgZ2xvYmFsIFwicHVic3ViXCIgaW4gYSBjb252ZW5pZW50IHBsYWNlLlxuICBfLmV4dGVuZChCYWNrYm9uZSwgRXZlbnRzKTtcblxuICAvLyBDcmVhdGUgdGhlIGRlZmF1bHQgQmFja2JvbmUuaGlzdG9yeSBpZiB0aGUgSGlzdG9yeSBtb2R1bGUgaXMgaW5jbHVkZWQuXG4gIGlmIChIaXN0b3J5KSBCYWNrYm9uZS5oaXN0b3J5ID0gbmV3IEhpc3RvcnkoKTtcbiAgcmV0dXJuIEJhY2tib25lO1xufSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5cbnZhciBfY3JlYXRlQ2xhc3MgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKCd2YWx1ZScgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0pKCk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbnZhciBfbW9kdWxlc0Zvcm1TY2hlbWFGb3JtU2NoZW1hVmlldyA9IHJlcXVpcmUoJy4vbW9kdWxlcy9mb3JtLXNjaGVtYS9mb3JtLXNjaGVtYS12aWV3Jyk7XG5cbnZhciBfbW9kdWxlc0Zvcm1TY2hlbWFGb3JtU2NoZW1hVmlldzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9tb2R1bGVzRm9ybVNjaGVtYUZvcm1TY2hlbWFWaWV3KTtcblxudmFyIF9saWJzSGVscGVyc0Vudmlyb25tZW50ID0gcmVxdWlyZSgnLi9saWJzL2hlbHBlcnMvZW52aXJvbm1lbnQnKTtcblxudmFyIF9saWJzRm9ybWVsbFNjaGVtYSA9IHJlcXVpcmUoJy4vbGlicy9mb3JtZWxsLXNjaGVtYScpO1xuXG52YXIgX2xpYnNGb3JtZWxsU2NoZW1hMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2xpYnNGb3JtZWxsU2NoZW1hKTtcblxudmFyIEZvcm1lbGwgPSAoZnVuY3Rpb24gKCkge1xuXHRfY3JlYXRlQ2xhc3MoRm9ybWVsbCwgW3tcblx0XHRrZXk6ICdmb3JtVmlldycsXG5cdFx0c2V0OiBmdW5jdGlvbiBzZXQoZm9ybVZpZXcpIHtcblx0XHRcdHRoaXMuX2Zvcm1WaWV3ID0gZm9ybVZpZXc7XG5cdFx0fSxcblx0XHRnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcblx0XHRcdHJldHVybiB0aGlzLl9mb3JtVmlldztcblx0XHR9XG5cdH0sIHtcblx0XHRrZXk6ICdvcHRpb25zJyxcblx0XHRzZXQ6IGZ1bmN0aW9uIHNldChvcHRpb25zKSB7XG5cdFx0XHR0aGlzLl9vcHRpb25zID0gb3B0aW9ucztcblx0XHR9LFxuXHRcdGdldDogZnVuY3Rpb24gZ2V0KCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX29wdGlvbnM7XG5cdFx0fVxuXHR9LCB7XG5cdFx0a2V5OiAnZm9ybScsXG5cdFx0c2V0OiBmdW5jdGlvbiBzZXQoZm9ybSkge1xuXHRcdFx0dGhpcy5fZm9ybSA9IGZvcm07XG5cdFx0fSxcblx0XHRnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcblx0XHRcdHJldHVybiB0aGlzLl9mb3JtO1xuXHRcdH1cblx0fV0pO1xuXG5cdGZ1bmN0aW9uIEZvcm1lbGwoKSB7XG5cdFx0dmFyIG9wdGlvbnMgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1swXTtcblxuXHRcdF9jbGFzc0NhbGxDaGVjayh0aGlzLCBGb3JtZWxsKTtcblxuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fVxuXG5cdEZvcm1lbGwucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uIGNyZWF0ZSgpIHtcblxuXHRcdHRoaXMuZm9ybVZpZXcgPSBuZXcgX21vZHVsZXNGb3JtU2NoZW1hRm9ybVNjaGVtYVZpZXcyWydkZWZhdWx0J10oe1xuXHRcdFx0YWN0aW9uOiB0aGlzLm9wdGlvbnMuYWN0aW9uIHx8ICdqYXZhc2NyaXB0OnZvaWQoMCknLFxuXHRcdFx0bWV0aG9kOiB0aGlzLm9wdGlvbnMubWV0aG9kIHx8ICdQT1NUJyxcblx0XHRcdGRhdGE6IHRoaXMub3B0aW9ucy5kYXRhIHx8IHt9XG5cdFx0fSk7XG5cblx0XHR0aGlzLmZvcm0gPSB0aGlzLmZvcm1WaWV3LnJlbmRlcigpLmVsO1xuXG5cdFx0cmV0dXJuIHRoaXMuZm9ybTtcblx0fTtcblxuXHRyZXR1cm4gRm9ybWVsbDtcbn0pKCk7XG5cbjtcblxuLy8gYWRkIGZvcm1lbCBjbGFzcyB0byBnbG9iYWwgbmFtZXNwYWNlXG5fbGlic0hlbHBlcnNFbnZpcm9ubWVudC5nZXRHbG9iYWxPYmplY3QoKS5Gb3JtZWxsID0gRm9ybWVsbDtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gRm9ybWVsbDtcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1snZGVmYXVsdCddOyIsIi8qKlxuICogYmFzZWQgb24gaHR0cHM6Ly9naXRodWIuY29tL3JlZHBpZS9iYWNrYm9uZS1zY2hlbWFcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyAnZGVmYXVsdCc6IG9iaiB9OyB9XG5cbnZhciBfaGVscGVyc0V4b3NrZWxlc3N0b24gPSByZXF1aXJlKCcuL2hlbHBlcnMvZXhvc2tlbGVzc3RvbicpO1xuXG52YXIgX2hlbHBlcnNFeG9za2VsZXNzdG9uMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2hlbHBlcnNFeG9za2VsZXNzdG9uKTtcblxudmFyIF9oZWxwZXJzRW52aXJvbm1lbnQgPSByZXF1aXJlKCcuL2hlbHBlcnMvZW52aXJvbm1lbnQnKTtcblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBoZWxwZXJcbmZ1bmN0aW9uIHVuZGVmKCkge1xuICAgIHJldHVybiBhcmd1bWVudHNbMF07XG59XG5cbnZhciBGb3JtZWxsU2NoZW1hID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgU2NoZW1hID0ge307XG5cbiAgICBmdW5jdGlvbiBsb2coKSB7fVxuXG4gICAgZnVuY3Rpb24gdG9PYmplY3Qoa2V5LCB2YWx1ZSkge1xuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9ialtrZXldID0gdmFsdWU7XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHlwZU9mKFZhbHVlLCBhVHlwZSkge1xuICAgICAgICByZXR1cm4gdHlwZW9mIFZhbHVlID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGFUeXBlID09ICdmdW5jdGlvbicgPyBuZXcgVmFsdWUoKSBpbnN0YW5jZW9mIGFUeXBlIDogZmFsc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5zdGFuY2VPZihpbnN0LCBhVHlwZSkge1xuICAgICAgICByZXR1cm4gdHlwZW9mIGFUeXBlID09ICdmdW5jdGlvbicgPyBpbnN0IGluc3RhbmNlb2YgYVR5cGUgOiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBSZXBsYWNlIGRlZmF1bHQgYmFja2JvbmUgaW5oZXJpdGFuY2UgY29kZSB3aXRoIHRoZSBmb2xsb3dpbmcgd2hpY2hcbiAgICAvLyByZXR1cm5zIHRoZSB2YWx1ZSByZXR1cm5lZCBieSB0aGUgdW5kZXJseWluZyBjb25zdHJ1Y3RvcnMgd2hpY2hcbiAgICAvLyBmYWNpbGl0YXRlcyB0aGUgSWRlbnRpdHlNYXAgZmVhdHVyZVxuICAgIHZhciBDdG9yID0gZnVuY3Rpb24gQ3RvcigpIHt9O1xuXG4gICAgZnVuY3Rpb24gaW5oZXJpdHMocGFyZW50LCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykge1xuICAgICAgICB2YXIgY2hpbGQ7XG5cbiAgICAgICAgLy8gVGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGZvciB0aGUgbmV3IHN1YmNsYXNzIGlzIGVpdGhlciBkZWZpbmVkIGJ5IHlvdVxuICAgICAgICAvLyAodGhlIFwiY29uc3RydWN0b3JcIiBwcm9wZXJ0eSBpbiB5b3VyIGBleHRlbmRgIGRlZmluaXRpb24pLCBvciBkZWZhdWx0ZWRcbiAgICAgICAgLy8gYnkgdXMgdG8gc2ltcGx5IGNhbGwgdGhlIHBhcmVudCdzIGNvbnN0cnVjdG9yLlxuICAgICAgICBpZiAocHJvdG9Qcm9wcyAmJiBwcm90b1Byb3BzLmhhc093blByb3BlcnR5KCdjb25zdHJ1Y3RvcicpKSB7XG4gICAgICAgICAgICBjaGlsZCA9IHByb3RvUHJvcHMuY29uc3RydWN0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjaGlsZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAvLyBSZXR1cm5pbmcgdGhlIHJldHVybiB2YWx1ZSBmcm9tIHBhcmVudCBiZWxvdyBmYWNpbGl0YXRlc1xuICAgICAgICAgICAgICAgIC8vIHRoZSBJZGVudGl0eU1hcCBmZWF0dXJlXG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEluaGVyaXQgY2xhc3MgKHN0YXRpYykgcHJvcGVydGllcyBmcm9tIHBhcmVudC5cbiAgICAgICAgT2JqZWN0LmFzc2lnbihjaGlsZCwgcGFyZW50KTtcblxuICAgICAgICAvLyBTZXQgdGhlIHByb3RvdHlwZSBjaGFpbiB0byBpbmhlcml0IGZyb20gYHBhcmVudGAsIHdpdGhvdXQgY2FsbGluZ1xuICAgICAgICAvLyBgcGFyZW50YCdzIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLlxuICAgICAgICBDdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7XG4gICAgICAgIGNoaWxkLnByb3RvdHlwZSA9IG5ldyBDdG9yKCk7XG5cbiAgICAgICAgLy8gQWRkIHByb3RvdHlwZSBwcm9wZXJ0aWVzIChpbnN0YW5jZSBwcm9wZXJ0aWVzKSB0byB0aGUgc3ViY2xhc3MsXG4gICAgICAgIC8vIGlmIHN1cHBsaWVkLlxuICAgICAgICBpZiAocHJvdG9Qcm9wcykge1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihjaGlsZC5wcm90b3R5cGUsIHByb3RvUHJvcHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHN0YXRpYyBwcm9wZXJ0aWVzIHRvIHRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiwgaWYgc3VwcGxpZWQuXG4gICAgICAgIGlmIChzdGF0aWNQcm9wcykge1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihjaGlsZCwgc3RhdGljUHJvcHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29ycmVjdGx5IHNldCBjaGlsZCdzIGBwcm90b3R5cGUuY29uc3RydWN0b3JgLlxuICAgICAgICBjaGlsZC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjaGlsZDtcblxuICAgICAgICAvLyBTZXQgYSBjb252ZW5pZW5jZSBwcm9wZXJ0eSBpbiBjYXNlIHRoZSBwYXJlbnQncyBwcm90b3R5cGUgaXMgbmVlZGVkIGxhdGVyLlxuICAgICAgICBjaGlsZFsnX19zdXBlcl9fJ10gPSBwYXJlbnQucHJvdG90eXBlO1xuXG4gICAgICAgIHJldHVybiBjaGlsZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbnRlcm5hbEV4dGVuZChwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykge1xuICAgICAgICB2YXIgY2hpbGQgPSBpbmhlcml0cyh0aGlzLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcyk7XG4gICAgICAgIGNoaWxkLmludGVybmFsRXh0ZW5kID0gdGhpcy5pbnRlcm5hbEV4dGVuZDtcbiAgICAgICAgY2hpbGQucHJvdG90eXBlLnVuaXF1ZVR5cGVJZCA9IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS51dGlscy51bmlxdWVJZCgpO1xuICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSlNPTlBvaW50ZXIgaW1wbGVtZW50YXRpb24gb2YgaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvZHJhZnQtaWV0Zi1hcHBzYXdnLWpzb24tcG9pbnRlci0wM1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmogSlNPTiBvYmplY3RcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIEpTT05Qb2ludGVyKG9iaikge1xuICAgICAgICB0aGlzLm9iaiA9IG9iajtcbiAgICB9XG4gICAgSlNPTlBvaW50ZXIucHJvdG90eXBlID0ge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXRzIHRoZSB2YWx1ZSBsb2NhdGVkIGF0IHRoZSBKU09OUG9pbnRlciBwYXRoXG4gICAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gcGF0aCBQYXRoIGluIHRoZSBmb3JtYXQgXCIvZm9vL2Jhci8wXCJcbiAgICAgICAgICogQHJldHVybiB7TnVtYmVyfFN0cmluZ3xPYmplY3R9ICAgICAgVmFsdWUgbG9jYXRlZCBhdCBwYXRoXG4gICAgICAgICAqL1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldChwYXRoKSB7XG4gICAgICAgICAgICBpZiAocGF0aCA9PT0gJycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5vYmo7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZmluZCh0aGlzLm9iaiwgdGhpcy5fdG9QYXJ0cyhwYXRoKSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldHMgdGhlIHByb2VydHkgbG9jYXRlZCBhdCB0aGUgcHJvdmlkZWQgcGF0aFxuICAgICAgICAgKiBAcGFyYW0ge1t0eXBlXX0gcGF0aCAgUGF0aCBpbiB0aGUgZm9ybWF0IFwiL2Zvby9iYXIvMFwiXG4gICAgICAgICAqIEBwYXJhbSB7W3R5cGVdfSB2YWx1ZSBWYWx1ZSB0byBzZXRcbiAgICAgICAgICovXG4gICAgICAgIHNldDogZnVuY3Rpb24gc2V0KHBhdGgsIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAocGF0aCA9PT0gJycpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9iaiA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHBhcnRzID0gdGhpcy5fdG9QYXJ0cyhwYXRoKSxcbiAgICAgICAgICAgICAgICBuYW1lID0gcGFydHMucG9wKCksXG4gICAgICAgICAgICAgICAgcHJvcGVydHkgPSBwYXJ0cy5sZW5ndGggPiAwID8gdGhpcy5fZmluZCh0aGlzLm9iaiwgcGFydHMpIDogdGhpcy5vYmo7XG5cbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eSAhPT0gdW5kZWYoKSAmJiBwcm9wZXJ0eSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5W25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfdG9QYXJ0czogZnVuY3Rpb24gX3RvUGFydHMocGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHBhdGguc3BsaXQoJy8nKS5zbGljZSgxKS5tYXAoZnVuY3Rpb24gKHBhcnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFydC5yZXBsYWNlKCd+MScsICcvJykucmVwbGFjZSgnfjAnLCAnficpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfZmluZDogZnVuY3Rpb24gX2ZpbmQob2JqLCBwYXRocykge1xuICAgICAgICAgICAgdmFyIHByb3BlcnR5ID0gb2JqW3BhdGhzWzBdXTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eSAhPT0gdW5kZWYoKSAmJiBwcm9wZXJ0eSAhPT0gbnVsbCAmJiBwYXRocy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgcGF0aHMuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZmluZChwcm9wZXJ0eSwgcGF0aHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BlcnR5O1xuICAgICAgICB9XG4gICAgfTtcbiAgICBKU09OUG9pbnRlci5pc1BvaW50ZXIgPSBmdW5jdGlvbiAocG9pbnRlcikge1xuICAgICAgICByZXR1cm4gcG9pbnRlciAhPT0gdW5kZWYoKSAmJiBwb2ludGVyICE9PSBudWxsIHx8IHBvaW50ZXIuaW5kZXhPZignIycpID49IDAgPyB0cnVlIDogZmFsc2U7XG4gICAgfTtcbiAgICBKU09OUG9pbnRlci5mcmFnbWVudFBhcnQgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICB2YXIgcGFydHMgPSBwYXRoLnNwbGl0KCcjJyk7XG4gICAgICAgIHJldHVybiBwYXJ0cy5sZW5ndGggPiAxID8gcGFydHNbMV0gOiB1bmRlZigpO1xuICAgIH07XG4gICAgSlNPTlBvaW50ZXIucmVtb3ZlRnJhZ21lbnQgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICByZXR1cm4gcGF0aC5zcGxpdCgnIycpWzBdO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTY2hlbWFGYWN0b3J5IHByb3ZpZGVzIG1ldGhvZHMgdG8gcmVnaXN0ZXIgYW5kIGNyZWF0ZSBuZXcgTW9kZWxzIGFuZCBDb2xsZWN0aW9uc1xuICAgICAqIGZyb20gSlNPTiBTY2hlbWFzLlxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIHZhciBTY2hlbWFGYWN0b3J5ID0gU2NoZW1hLkZhY3RvcnkgPSBmdW5jdGlvbiBTY2hlbWFGYWN0b3J5KG9wdGlvbnMpIHtcblxuICAgICAgICAvLyBJbml0aWFsaXNlIHRoZSBvcHRpb25zIG9iamVjdFxuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICAgICAgICAvKipcbiAgICAgICAgICogTWFpbnRhaW5zIGEgbGlzdCBvZiByZWdpc3RlcmVkIHNjaGVtYXMsIGluZGV4ZWQgYnkgc2NoZW1hLmlkXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlZ2lzdGVyZWRTY2hlbWFzID0ge307XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1haW50YWlucyBhIGxpc3Qgb2YgcmVnaXN0ZXJlZCBtb2RlbHMsIGluZGV4ZWQgYnkgc2NoZW1hLmlkXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlZ2lzdGVyZWRTY2hlbWFUeXBlcyA9IHt9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYWludGFpbnMgYSBsaXN0IG9mIHBhcnNlZCBzY2hlbWFzLCBpbmRleGVkIGJ5IHNjaGVtYS5pZFxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wYXJzZWRTY2hlbWFDYWNoZSA9IHt9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYWludGFpbnMgYSBsaXN0IG9mIGNvbnN0cnVjdGVkIE1vZGVscyBhbmQgQ29sbGVjdGlvbnMsIGluZGV4ZWQgYnkgc2NoZW1hLmlkXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnR5cGVDYWNoZSA9IHt9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYWludGFpbnMgYSBsaXN0IG9mIGFsbCBpbnN0YW50aWF0ZWQgbW9kZWxzXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmluc3RhbmNlQ2FjaGUgPSB7fTtcblxuICAgICAgICAvLyBFbnN1cmUgdGhlIGJhc2UgbW9kZWwgaXMgb2YgdHlwZSBTY2hlbWFNb2RlbFxuICAgICAgICBpZiAob3B0aW9ucy5tb2RlbCAmJiAhdHlwZU9mKG9wdGlvbnMubW9kZWwsIFNjaGVtYU1vZGVsKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwib3B0aW9ucy5tb2RlbCBNVVNUIGV4dGVuZCBFeG9za2VsZXNzdG9uLlNjaGVtYS5Nb2RlbFwiKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBFbnN1cmUgdGhlIGJhc2UgbW9kZWwgaXMgb2YgdHlwZSBTY2hlbWFDb2xsZWN0aW9uXG4gICAgICAgIGlmIChvcHRpb25zLmNvbGxlY3Rpb24gJiYgIXR5cGVPZihvcHRpb25zLmNvbGxlY3Rpb24sIFNjaGVtYUNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJvcHRpb25zLmNvbGxlY3Rpb24gTVVTVCBleHRlbmQgRXhvc2tlbGVzc3Rvbi5TY2hlbWEuQ29sbGVjdGlvblwiKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBFbnN1cmUgdGhlIGJhc2UgbW9kZWwgaXMgb2YgdHlwZSBTY2hlbWFWYWx1ZUNvbGxlY3Rpb25cbiAgICAgICAgaWYgKG9wdGlvbnMudmFsdWVDb2xsZWN0aW9uICYmICF0eXBlT2Yob3B0aW9ucy52YWx1ZUNvbGxlY3Rpb24sIFNjaGVtYVZhbHVlQ29sbGVjdGlvbikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIm9wdGlvbnMudmFsdWVDb2xsZWN0aW9uIE1VU1QgZXh0ZW5kIEV4b3NrZWxlc3N0b24uU2NoZW1hLlZhbHVlQ29sbGVjdGlvblwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFsbCBtb2RlbHMgY3JlYXRlZCBieSB0aGlzIGZhY3Rvcnkgd2lsbCBiZSBvZiB0aGUgcHJvdmlkZWQgdHlwZSBvciBTY2hlbWFNb2RlbFxuICAgICAgICB0aGlzLmJhc2VNb2RlbCA9IG9wdGlvbnMubW9kZWwgfHwgU2NoZW1hTW9kZWw7XG4gICAgICAgIC8vIEFsbCBjb2xsZWN0aW9ucyBjcmVhdGVkIGJ5IHRoaXMgZmFjdG9yeSB3aWxsIGJlIG9mIHRoZSBwcm92aWRlZCB0eXBlIG9yIFNjaGVtYUNvbGxlY3Rpb25cbiAgICAgICAgdGhpcy5iYXNlQ29sbGVjdGlvbiA9IG9wdGlvbnMuY29sbGVjdGlvbiB8fCBTY2hlbWFDb2xsZWN0aW9uO1xuICAgICAgICAvLyBBbGwgdmFsdWUgY29sbGVjdGlvbnMgY3JlYXRlZCBieSB0aGlzIGZhY3Rvcnkgd2lsbCBiZSBvZiB0aGUgcHJvdmlkZWQgdHlwZSBvciBTY2hlbWFWYWx1ZUNvbGxlY3Rpb25cbiAgICAgICAgdGhpcy5iYXNlVmFsdWVDb2xsZWN0aW9uID0gb3B0aW9ucy52YWx1ZUNvbGxlY3Rpb24gfHwgU2NoZW1hVmFsdWVDb2xsZWN0aW9uO1xuICAgIH07XG5cbiAgICBTY2hlbWFGYWN0b3J5LnByb3RvdHlwZSA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVnaXN0ZXJzIHRoZSBwcm92aWRlZCBzY2hlbWEgYW5kIG9wdGlvbmFsIG1vZGVsLlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBhbGxvd3MgeW91IHRvIGFzc29jaWF0ZSBhIE1vZGVsIG9yIENvbGxlY3Rpb24gd2l0aCBhXG4gICAgICAgICAqIHBhcnRpY3VsYXIgc2NoZW1hIHdoaWNoIGlzIHVzZWZ1bCB3aGVuIHlvdSB3aXNoIHRvIHByb3ZpZGUgY3VzdG9tXG4gICAgICAgICAqIGZ1bmN0aW9uYWxpdHkgZm9yIHNjaGVtYXMgd2hpY2ggbWF5IGJlIGVtYmVkZGVkIGluIG90aGVyIHNjaGVtYXMuXG4gICAgICAgICAqIEBwYXJhbSAge1N0cmluZ3xPYmplY3R9IHNjaGVtYSBQcm92aWRlIGEgc2NoZW1hIGlkIG9yIGEgc2NoZW1hIG9iamVjdFxuICAgICAgICAgKiBAcGFyYW0gIHtFeG9za2VsZXNzdG9uLlNjaGVtYS5Nb2RlbHxFeG9za2VsZXNzdG9uLlNjaGVtYS5Db2xsZWN0aW9ufEV4b3NrZWxlc3N0b24uU2NoZW1hLlZhbHVlQ29sbGVjdGlvbn0gbW9kZWwgIFByb3ZpZGUgYSBtb2RlbCBvciBjb2xsZWN0aW9uIHRvIGFzc29jaWF0ZSB3aXRoIHRoaXMgc2NoZW1hXG4gICAgICAgICAqIEByZXR1cm4ge3RoaXN9XG4gICAgICAgICAqL1xuICAgICAgICByZWdpc3RlcjogZnVuY3Rpb24gcmVnaXN0ZXIoc2NoZW1hLCBtb2RlbCkge1xuICAgICAgICAgICAgdmFyIHNjaGVtYUlkO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBzY2hlbWEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBzY2hlbWFJZCA9IHNjaGVtYTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2NoZW1hSWQgPSBzY2hlbWEuaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzY2hlbWFJZCA9PT0gdW5kZWYoKSB8fCBzY2hlbWFJZCA9PT0gbnVsbCB8fCBzY2hlbWFJZCA9PT0gJycpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZWdpc3RlciBhIHNjaGVtYSB3aXRoIG5vIGlkJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10udXRpbHMuaXNPYmplY3Qoc2NoZW1hKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVnaXN0ZXJlZFNjaGVtYXNbc2NoZW1hSWRdID0gc2NoZW1hO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBhcnNlZFNjaGVtYUNhY2hlW3NjaGVtYUlkXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RlcmVkU2NoZW1hVHlwZXNbc2NoZW1hSWRdID0gbW9kZWw7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMudHlwZUNhY2hlW3NjaGVtYUlkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVW5yZWdpc3RlciBhIHNjaGVtYVxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IHNjaGVtYUlkIFRoZSBzY2hlbWEgaWQgb2YgdGhlIHNjaGVtYSB5b3Ugd2lzaCB0byB1bnJlZ2lzdGVyXG4gICAgICAgICAqIEByZXR1cm4ge3RoaXN9XG4gICAgICAgICAqL1xuICAgICAgICB1bnJlZ2lzdGVyOiBmdW5jdGlvbiB1bnJlZ2lzdGVyKHNjaGVtYUlkKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5yZWdpc3RlcmVkU2NoZW1hc1tzY2hlbWFJZF07XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5yZWdpc3RlcmVkU2NoZW1hVHlwZXNbc2NoZW1hSWRdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMucGFyc2VkU2NoZW1hQ2FjaGVbc2NoZW1hSWRdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMudHlwZUNhY2hlW3NjaGVtYUlkXTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDbGVhcnMgYWxsIGNhY2hlcy4gVXNlZCBieSB0aGUgdGVzdHNcbiAgICAgICAgICogQHJldHVybiB7dGhpc31cbiAgICAgICAgICovXG4gICAgICAgIHJlc2V0OiBmdW5jdGlvbiByZXNldCgpIHtcbiAgICAgICAgICAgIHRoaXMucmVnaXN0ZXJlZFNjaGVtYXMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVnaXN0ZXJlZFNjaGVtYVR5cGVzID0ge307XG4gICAgICAgICAgICB0aGlzLnBhcnNlZFNjaGVtYUNhY2hlID0ge307XG4gICAgICAgICAgICB0aGlzLnR5cGVDYWNoZSA9IHt9O1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jZUNhY2hlID0ge307XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3JlYXRlIGEgTW9kZWwgb3IgQ29sbGVjdGlvbiBmcm9tIHRoZSBwcm92aWRlZCBzY2hlbWFcbiAgICAgICAgICogQHBhcmFtICB7U3RyaW5nfE9iamVjdH0gc2NoZW1hIFByb3ZpZGUgdGhlIHNjaGVtYSBvciB0aGUgc2NoZW1hIGlkIG9mIGEgcHJldmlvdXNseSByZWZpc3RlcmVkIHNjaGVtYVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBtb2RlbCAgUHJvdmlkZXMgYW4gb3B0aW9uYWwgbW9kZWwgb3IgY29sbGVjdGlvbiB3aGljaCBvdmVycmlkZXMgdGhlIGRlZmF1bHQgYmFzZSBjbGFzcy5cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgUmV0dXJucyB0aGUgY29udHJ1Y3RlZCBtb2RlbCBvciBjb2xsZWN0aW9uXG4gICAgICAgICAqL1xuICAgICAgICBjcmVhdGU6IGZ1bmN0aW9uIGNyZWF0ZShzY2hlbWEsIG1vZGVsKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHNjaGVtYSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHNjaGVtYSA9IHRoaXMuX2dldChzY2hlbWEpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzY2hlbWEuaWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlZ2lzdGVyKHNjaGVtYSwgbW9kZWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzY2hlbWEgPSB0aGlzLnBhcnNlKHNjaGVtYSk7XG5cbiAgICAgICAgICAgIGlmIChzY2hlbWEudHlwZSAmJiBzY2hlbWEudHlwZSA9PT0gJ2FycmF5Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9jcmVhdGVDb2xsZWN0aW9uKHNjaGVtYSwgdW5kZWYoKSwgbW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NyZWF0ZU1vZGVsKHNjaGVtYSwgdW5kZWYoKSwgbW9kZWwpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdGUgYW4gaW5zdGFuY2Ugb2YgYSBNb2RlbCBvciBDb2xsZWN0aW9uIGZyb20gdGhlIHByb3ZpZGVkIHNjaGVtYVxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd8T2JqZWN0fSBzY2hlbWEgUHJvdmlkZSB0aGUgc2NoZW1hIG9yIHRoZSBzY2hlbWEgaWQgb2YgYSBwcmV2aW91c2x5IHJlZmlzdGVyZWQgc2NoZW1hXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdD19IG1vZGVsICBQcm92aWRlcyBhbiBvcHRpb25hbCBtb2RlbCBvciBjb2xsZWN0aW9uIHdoaWNoIG92ZXJyaWRlcyB0aGUgZGVmYXVsdCBiYXNlIGNsYXNzLlxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBhdHRyaWJ1dGVzIFtkZXNjcmlwdGlvbl1cbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9ucyAgICBbZGVzY3JpcHRpb25dXG4gICAgICAgICAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgICAgICBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIG1vZGVsIG9yIGNvbGxlY3Rpb25cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZUluc3RhbmNlOiBmdW5jdGlvbiBjcmVhdGVJbnN0YW5jZShzY2hlbWEsIG1vZGVsLCBhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBpZiAoISh0eXBlb2YgbW9kZWwgPT0gJ2Z1bmN0aW9uJykgJiYgb3B0aW9ucyA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBhdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMgPSBtb2RlbDtcbiAgICAgICAgICAgICAgICBtb2RlbCA9IHVuZGVmKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgTW9kZWwgPSB0aGlzLmNyZWF0ZShzY2hlbWEsIG1vZGVsKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTW9kZWwoYXR0cmlidXRlcywgb3B0aW9ucyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfZ2V0OiBmdW5jdGlvbiBfZ2V0KHNjaGVtYUlkKSB7XG5cbiAgICAgICAgICAgIGlmIChzY2hlbWFJZCA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzY2hlbWFJZCA9IHNjaGVtYUlkLnNwbGl0KCcjJylbMF07XG5cbiAgICAgICAgICAgIHZhciBzY2hlbWEgPSB0aGlzLnJlZ2lzdGVyZWRTY2hlbWFzW3NjaGVtYUlkXTtcbiAgICAgICAgICAgIGlmIChzY2hlbWEgPT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICBzY2hlbWEgPSB0aGlzLmZldGNoKHNjaGVtYUlkKTtcbiAgICAgICAgICAgICAgICBpZiAoc2NoZW1hICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVnaXN0ZXJlZFNjaGVtYXNbc2NoZW1hSWRdID0gc2NoZW1hO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZpbmQgc2NoZW1hICcgKyBzY2hlbWFJZCA/IHNjaGVtYUlkIDogJycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNjaGVtYTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogT3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gcHJvdmlkZSBhIHdheSB0byBmZXRjaCBzY2hlbWEgZnJvbSBhIHNlcnZlclxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R8dW5kZWYoKX0gUmV0dXJucyB0aGUgc2NoZW1hIG9yIHVuZGVmKCkgaWYgbm90IGZvdW5kXG4gICAgICAgICAqL1xuICAgICAgICBmZXRjaDogZnVuY3Rpb24gZmV0Y2goc2NoZW1hSWQpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZigpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdGVzIGFuIG9iamVjdCBtb2RlbCByZXByZXNlbnRhdGlvbiBvZiBzY2hlbWEgYnkgcG9wdWxhdGluZ1xuICAgICAgICAgKiBhbGwgcmVmZXJlbmNlcyBhbmQgZXh0ZW5zaW9ucyAoJHJlZidzKSB3aGljaCB0aGVpciBjb3JyZXNwb25kaW5nXG4gICAgICAgICAqIHNjaGVtYXMgaW4gZnVsbC5cbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSBzY2hlbWEgUHJvdmlkZSB0aGUgc2NoZW1hIHRvIHBhcnNlXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgIFJldHVybnMgdGhlIHBhcnNlZCBzY2hlbWFcbiAgICAgICAgICovXG4gICAgICAgIHBhcnNlOiBmdW5jdGlvbiBwYXJzZShzY2hlbWEpIHtcbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGF0IHJvb3Qgc2NoZW1hcyBhcmUgaWRlbnRpZmlhYmxlIGJ5IGFuIGlkLlxuICAgICAgICAgICAgLy8gVGhpcyBpcyB1c2VkIGZvciBjYWNoaW5nIHB1cnBvc2VzIGludGVybmFsbHlcbiAgICAgICAgICAgIGlmIChzY2hlbWEuaWQgPT09IHVuZGVmKCkgfHwgc2NoZW1hLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgc2NoZW1hLmlkID0gSlNPTi5zdHJpbmdpZnkoc2NoZW1hKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9wYXJzZShzY2hlbWEsIHNjaGVtYSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZWQgdGhlIHRyYWlsaW5nICMgZnJvbSBhIHNjaGVtYSBpZFxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IHNjaGVtYUlkIFNjaGVtYSBpZFxuICAgICAgICAgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICAgICAgIFNjaGVtYSBpZCBtaW51cyB0aGUgdHJhaWxpbmcgI1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3JlbW92ZVRyYWlsaW5nSGFzaDogZnVuY3Rpb24gX3JlbW92ZVRyYWlsaW5nSGFzaChzY2hlbWFJZCkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHRyYWlsaW5nICNcbiAgICAgICAgICAgIHJldHVybiBzY2hlbWFJZCAhPT0gdW5kZWYoKSAmJiBzY2hlbWFJZC5sZW5ndGggPiAxID8gc2NoZW1hSWQuY2hhckF0KHNjaGVtYUlkLmxlbmd0aCAtIDEpID09PSAnIycgPyBzY2hlbWFJZC5zbGljZSgwLCAtMSkgOiBzY2hlbWFJZCA6IHVuZGVmKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFByb3ZpZGVzIHRoZSByZWN1cnNpdmUgcGFyc2UgbWV0aG9kXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdH0gc2NoZW1hICAgICBQcm92aWRlIHRoZSBzY2hlbWEgdG8gcGFyc2VcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSByb290U2NoZW1hIFByb3ZpZGUgdGhlIHJvb3Qgc2NoZW1hIHdoaWNoIGNvcnJlc3BvbmRzIHRvICRyZWY9XCIjXCJcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgIFJldHVybnMgdGhlIHBhcnNlZCBzY2hlbWFcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9wYXJzZTogZnVuY3Rpb24gX3BhcnNlKHNjaGVtYSwgcm9vdFNjaGVtYSkge1xuXG4gICAgICAgICAgICBpZiAoc2NoZW1hID09PSB1bmRlZigpIHx8IHNjaGVtYSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc2NoZW1hSWQgPSB0aGlzLl9yZW1vdmVUcmFpbGluZ0hhc2goc2NoZW1hLmlkKTtcbiAgICAgICAgICAgIGlmIChzY2hlbWFJZCAmJiB0aGlzLnBhcnNlZFNjaGVtYUNhY2hlW3NjaGVtYUlkXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlZFNjaGVtYUNhY2hlW3NjaGVtYUlkXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJlZmVyZW5jZSA9IHNjaGVtYVsnJHJlZiddO1xuICAgICAgICAgICAgaWYgKHJlZmVyZW5jZSAmJiB0aGlzLnBhcnNlZFNjaGVtYUNhY2hlW3JlZmVyZW5jZV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZWRTY2hlbWFDYWNoZVtyZWZlcmVuY2VdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgIC8vIFRvIGF2b2lkIGluZmluaXRlIGxvb3BzIG9uIGNpcmN1bGFyIHNjaGVtYSByZWZlcmVuY2VzLCBkZWZpbmUgdGhlXG4gICAgICAgICAgICAvLyBleHBhbmRlZCBzY2hlbWEgbm93IChhaGVhZCBvZiBldmFsdWF0aW5nIGl0KSBhbmQgYWRkIGl0IHRvIHRoZSBjYWNoZS5cbiAgICAgICAgICAgIC8vIFJlLWVudHJhbnQgY2FsbHMgd2lsbCBwdWxsIHRoZSBlbXB0eSBvYmplY3QgZnJvbSB0aGUgY2FjaGUgd2hpY2hcbiAgICAgICAgICAgIC8vIHdpbGwgZXZlbnR1YWxseSBiZSBwb3B1bGF0ZWQgYXMgdGhlIHJlY3Vyc2lvbnMgZXhpdC5cbiAgICAgICAgICAgIC8vdmFyIGV4cGFuZGVkU2NoZW1hID0gc2NoZW1hO1xuICAgICAgICAgICAgaWYgKHNjaGVtYUlkICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZWRTY2hlbWFDYWNoZVtzY2hlbWFJZF0gPSBzY2hlbWE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgLy8gUHJvY2VzcyByZWZlcmVuY2VzIGVhcmx5LCBhcyB0aGV5IGNhbid0IGhhdmUgYW55IG90aGVyXG4gICAgICAgICAgICAvLyBmaWVsZHMvcHJvcGVydGllcyBwcmVzZW50LlxuICAgICAgICAgICAgaWYgKHJlZmVyZW5jZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCBtb3N0IGNvbW1vbiB1c2FnZVxuICAgICAgICAgICAgICAgIGlmIChyZWZlcmVuY2UgPT09ICcjJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcm9vdFNjaGVtYTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgcGFydHMgPSByZWZlcmVuY2Uuc3BsaXQoJyMnKSxcbiAgICAgICAgICAgICAgICAgICAgcmVmZXJlbmNlZFNjaGVtYUlkID0gcGFydHNbMF0sXG4gICAgICAgICAgICAgICAgICAgIHJlZmVyZW5jZWRGcmFnbWVudCA9IHBhcnRzLmxlbmd0aCA+IDEgPyBwYXJ0c1sxXSA6ICcnLFxuICAgICAgICAgICAgICAgICAgICByZWZlcmVuY2VkU2NoZW1hO1xuICAgICAgICAgICAgICAgIGlmIChyZWZlcmVuY2VkU2NoZW1hSWQgPT09ICcnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlZmVyZW5jZWRTY2hlbWEgPSByb290U2NoZW1hO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmZXRjaGVkU2NoZW1hID0gdGhpcy5fZ2V0KHJlZmVyZW5jZWRTY2hlbWFJZCk7XG4gICAgICAgICAgICAgICAgICAgIHJlZmVyZW5jZWRTY2hlbWEgPSB0aGlzLl9wYXJzZShmZXRjaGVkU2NoZW1hLCBmZXRjaGVkU2NoZW1hKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgdG9SZXR1cm4gPSByZWZlcmVuY2VkRnJhZ21lbnQubGVuZ3RoID4gMCA/IG5ldyBKU09OUG9pbnRlcihyZWZlcmVuY2VkU2NoZW1hKS5nZXQocmVmZXJlbmNlZEZyYWdtZW50KSA6IHJlZmVyZW5jZWRTY2hlbWE7XG4gICAgICAgICAgICAgICAgLy8gRW5zdXJlIHJlZmVyZW5jZWQgZnJhZ21lbnQgaGFzIGFuIGlkXG4gICAgICAgICAgICAgICAgaWYgKHRvUmV0dXJuICYmICh0b1JldHVybi5pZCA9PT0gdW5kZWYoKSB8fCB0b1JldHVybi5pZCA9PT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdG9SZXR1cm4uaWQgPSByZWZlcmVuY2UuY2hhckF0KDApID09PSAnIycgPyByZWZlcmVuY2VkU2NoZW1hLmlkICsgcmVmZXJlbmNlIDogcmVmZXJlbmNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdG9SZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vLy8vLy8vLy8vLy8vXG4gICAgICAgICAgICAvLyBQcm9jZXNzIGNoaWxkIHByb3BlcnRpZXMgZmlyc3Qgc28gdGhhdCBvYmplY3QgZ3JhcGggY29tcGxldGVzXG4gICAgICAgICAgICAvLyBsZWFmIG5vZGVzIGZpcnN0XG4gICAgICAgICAgICB2YXIgcHJvcGVydGllcyA9IHNjaGVtYS5wcm9wZXJ0aWVzO1xuICAgICAgICAgICAgdmFyIHByb3BlcnR5O1xuICAgICAgICAgICAgaWYgKHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gcHJvcGVydGllcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSA9IHByb3BlcnRpZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNba2V5XSA9IHRoaXMuX3BhcnNlKHByb3BlcnR5LCByb290U2NoZW1hKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgIC8vIFRPRE86IFwibm90XCIgYmVsb3cgaXMgYSBzdHJhbmdlIG9uZSBhbmQgbmVlZHMgdGhpbmtpbmcgdGhyb3VnaFxuICAgICAgICAgICAgWydpdGVtcycsICdhbnlPZicsICdhbGxPZicsICdub3QnXS5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wZXJ0eU5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgaXRlbXMgPSBzY2hlbWFbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoaXRlbXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGl0ZW1zIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gaXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NoZW1hW3Byb3BlcnR5TmFtZV1baV0gPSB0aGlzLl9wYXJzZShpdGVtc1tpXSwgcm9vdFNjaGVtYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWFbcHJvcGVydHlOYW1lXSA9IHRoaXMuX3BhcnNlKGl0ZW1zLCByb290U2NoZW1hKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgICAgICB2YXIgZXh0ZW5zaW9ucyA9IHNjaGVtYVsnZXh0ZW5kcyddO1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbnMpIHtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgdGhlIGV4dGVuZHMgYXR0cmlidXRlIGFzIHdlIGFyZSBnb2luZyB0byBwZXJmb3JtIHRoZSBleHRlbnNpb24gYmVsb3dcbiAgICAgICAgICAgICAgICBzY2hlbWFbJ2V4dGVuZHMnXSA9IHVuZGVmKCk7XG5cbiAgICAgICAgICAgICAgICAoZXh0ZW5zaW9ucyBpbnN0YW5jZW9mIEFycmF5ID8gZXh0ZW5zaW9ucyA6IFtleHRlbnNpb25zXSkuZm9yRWFjaChmdW5jdGlvbiAoZXh0ZW5zaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBleHBhbmRlZEV4dGVuc2lvbiA9IHRoaXMuX3BhcnNlKGV4dGVuc2lvbiwgcm9vdFNjaGVtYSk7XG4gICAgICAgICAgICAgICAgICAgIGV4dGVuZFNjaGVtYShzY2hlbWEsIGV4cGFuZGVkRXh0ZW5zaW9uKTtcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNjaGVtYTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3JlYXRlcyBhIFNjaGVtYU1vZGVsIGZyb20gdGhlIHByb3ZpZGVkIFNjaGVtYVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3R9IHNjaGVtYSAgICBQcm92aWRlIHRoZSBzY2hlbWEgd2l0aCB3aGljaCB0byBidWlsZCB0aGUgbW9kZWxcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9ucyAgIFByb3ZpZGUgYW55IG9wdGlvbnNcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gYmFzZU1vZGVsIFByb3ZpZGUgYSBiYXNlIG1vZGVsIHVzZWQgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHRcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgUmV0dXJuIGEgU2NoZW1hIE1vZGVsXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfY3JlYXRlTW9kZWw6IGZ1bmN0aW9uIF9jcmVhdGVNb2RlbChzY2hlbWEsIG9wdGlvbnMsIGJhc2VNb2RlbCkge1xuXG4gICAgICAgICAgICB2YXIgc2NoZW1hSWQgPSBzY2hlbWEuaWQ7XG5cbiAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmUtdXNlIHByZXZpb3VzbHkgY29uc3RydWN0ZWQgbW9kZWxzXG4gICAgICAgICAgICBpZiAoc2NoZW1hSWQgJiYgdGhpcy50eXBlQ2FjaGVbc2NoZW1hSWRdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudHlwZUNhY2hlW3NjaGVtYUlkXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbWVhbmluZ2Z1bCBuYW1lIGZvciB0aGUgbW9kZSB1c2luZyB0aGUgc2NoZW1hLnRpdGxlICh3aGl0ZXNwYWNlIHJlbW92ZWQpXG4gICAgICAgICAgICB2YXIgbW9kZWxOYW1lID0gc2NoZW1hLnRpdGxlID8gc2NoZW1hLnRpdGxlLnJlcGxhY2UoL1teXFx3XS9naSwgJycpIDogJ1Vua25vd24nO1xuICAgICAgICAgICAgLy8gQWRkIFNjaGVtYU1vZGVsIG9uIHRoZSBlbmQgdG8gY3JlYXRlIFwie1RpdGxlfVNjaGVtYU1vZGVsXCJcbiAgICAgICAgICAgIHZhciB0eXBlTGFiZWwgPSBtb2RlbE5hbWUgKyAnU2NoZW1hTW9kZWwnO1xuXG4gICAgICAgICAgICBsb2coJ0NyZWF0ZSBDdXN0b20gU2NoZW1hIE1vZGVsIFR5cGU6ICcgKyB0eXBlTGFiZWwpO1xuXG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgdGhlIGJhc2UgbW9kZWwgc3RhcnRpbmcgd2l0aCB0aGUgYmFzZU1vZGVsIHBhc3NlZCBpbiBhYm92ZSxcbiAgICAgICAgICAgIC8vIG5leHQgdHJ5IHRoZSBhIG1vZGVsIHJlZ3NpdGVyZWQgYWdhaW5zdCB0aGUgc2NoZW1hSWQgYW5kXG4gICAgICAgICAgICAvLyBsYXN0bHkgdHJ5IHRoZSBTY2hlbWFGYWN0b3J5IGRlZmF1bHQgYmFzZU1vZGVsXG4gICAgICAgICAgICB2YXIgQmFzZU1vZGVsID0gYmFzZU1vZGVsIHx8IHNjaGVtYUlkICYmIHRoaXMucmVnaXN0ZXJlZFNjaGVtYVR5cGVzW3NjaGVtYUlkXSB8fCB0aGlzLmJhc2VNb2RlbDtcbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgYmFzZSBtb2RlbCBpcyBvZiB0eXBlIFwiU2NoZW1hTW9kZWxcIlxuICAgICAgICAgICAgaWYgKCFCYXNlTW9kZWwuaXNTY2hlbWFNb2RlbCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQmFzZSBtb2RlbCBmb3Igc2NoZW1hICcgKyBzY2hlbWFJZCArICcgaXMgbm90IGEgU2NoZW1hTW9kZWwnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXZhbCB0aGUgY29uc3RydWN0b3IgY29kZSBhcyB3ZSB3YW50IHRvIGluamVjdCB0aGUgdHlwZUxhYmVsIHdoaWNoIHdpbGwgYWxsb3cgbW9kZWxzXG4gICAgICAgICAgICAvLyBjcmVhdGVkIHdpdGggdGhpcyB0eXBlIHRvIGhhdmUgbWVhbmluZ2Z1bCBuYW1lcyB3aGVuIGRlYnVnZ2luZ1xuICAgICAgICAgICAgLy8gQ29uc3RydWN0IHRoZSBuZXcgbW9kZWxcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IEJhc2VNb2RlbC5leHRlbmQoe1xuICAgICAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBmdW5jdGlvbiBjb25zdHJ1Y3RvcihhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0b1JldHVybiA9IEJhc2VNb2RlbC5wcm90b3R5cGUuY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvUmV0dXJuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdG9SZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zIHx8IG9wdGlvbnMudmFsaWRhdGlvbiAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmFsaWRhdGlvbiA9IG5ldyBWYWxpZGF0aW9uTW9kZWwodGhpcy5zY2hlbWEucHJvcGVydGllcyA/IE9iamVjdC5rZXlzKHRoaXMuc2NoZW1hLnByb3BlcnRpZXMpIDogWyd2YWx1ZSddKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZmFjdG9yeTogdGhpcyxcbiAgICAgICAgICAgICAgICAvLyBTYXZlIGEgcmVmZXJlbmNlIHRvIHRoaXMgZmFjdG9yeSBmb3IgZnV0dXJlIHVzZVxuICAgICAgICAgICAgICAgIHNjaGVtYTogc2NoZW1hLFxuICAgICAgICAgICAgICAgIHR5cGVMYWJlbDogdHlwZUxhYmVsXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgLy8gTWFrZSB0aGUgc2NoZW1hIGFuZCB0eXBlTGFiZWwgYWxzbyBhdmFpbGFibGUgYXMgc3RhdGljIHByb3BlcnRpZXMgb2YgdGhlIHR5cGVcbiAgICAgICAgICAgICAgICBzY2hlbWE6IHNjaGVtYSxcbiAgICAgICAgICAgICAgICB0eXBlTGFiZWw6IHR5cGVMYWJlbFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIE9ubHkgY2FjaGUgdGhlIHJlc3VsdGluZyBtb2RlbCBpZiBhIHdlIGhhdmUgYSBzY2hlbWEgaWQuXG4gICAgICAgICAgICBpZiAoc2NoZW1hSWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnR5cGVDYWNoZVtzY2hlbWFJZF0gPSBtb2RlbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGRlZmF1bHRzID0ge30sXG4gICAgICAgICAgICAgICAgc2NoZW1hUmVsYXRpb25zID0ge30sXG4gICAgICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgICAgIHByb3BlcnR5O1xuXG4gICAgICAgICAgICAvLyBVc2luZyB0aGUgc2NoZW1hLnByb3BlcnRpZXMgZGVmaW5pdGlvbnMgZGV0ZXJtaW5lIGlmIHRoZXJlXG4gICAgICAgICAgICAvLyBhcmUgYW55IHJlbGF0aW9ucyBhbmQgaWYgc28gY3JlYXRlIGNvcnJlc3BvbmRpbmcgbW9kZWxzIG9yIGNvbGxlY3Rpb25zXG4gICAgICAgICAgICBpZiAoc2NoZW1hLnByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgICAgIGZvciAoa2V5IGluIHNjaGVtYS5wcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzY2hlbWEucHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSA9IHNjaGVtYS5wcm9wZXJ0aWVzW2tleV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgYW55IGRlZmF1bHQgdmFsdWVzIGZyb20gc2NoZW1hIGFuZCBhc3NpZ24gdG8gbW9kZWwncyBkZWZhdWx0IG9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQXJyYXkgYWNjZXNzIGlzIHJlcXVpcmVkIGFzICdkZWZhdWx0JyBpcyBhIHJlc2VydmVkIHdvcmQuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydHlbJ2RlZmF1bHQnXSAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHRzW2tleV0gPSBwcm9wZXJ0eVsnZGVmYXVsdCddO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHR5cGVzIFwib2JqZWN0XCIgYW5kIFwiYXJyYXlcIiBtYXAgdG8gcmVsYXRpb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKHByb3BlcnR5LnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3VuZCBhIEhhc09uZSByZWxhdGlvbiwgc28gY3JlYXRlIGEgY29ycmVzcG9uZGluZyBtb2RlbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWFSZWxhdGlvbnNba2V5XSA9IHRoaXMuX2NyZWF0ZU1vZGVsKHByb3BlcnR5LCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnYXJyYXknOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3VuZCBhIEhhc01hbnkgcmVsYXRpb24sIHNvIGNyZWF0ZSBhIGNvcnJlc3BvbmRpbmcgY29sbGVjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWFSZWxhdGlvbnNba2V5XSA9IHRoaXMuX2NyZWF0ZUNvbGxlY3Rpb24ocHJvcGVydHksIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQXNzaWduIHRoZSByZXN1bHRpbmcgZGVmYXVsdCBhbmQgcmVsYXRpb25zIHRvIHRoZSBtb2RlbCdzIHByb3RvdHlwZVxuICAgICAgICAgICAgbW9kZWwucHJvdG90eXBlLmRlZmF1bHRzID0gZGVmYXVsdHM7XG4gICAgICAgICAgICBtb2RlbC5wcm90b3R5cGUuc2NoZW1hUmVsYXRpb25zID0gc2NoZW1hUmVsYXRpb25zO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZXMgYSBTY2hlbWFDb2xsZWN0aW9uIGZyb20gdGhlIHByb3ZpZGVkIFNjaGVtYVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3R9IHNjaGVtYSAgICBQcm92aWRlIHRoZSBzY2hlbWEgd2l0aCB3aGljaCB0byBidWlsZCB0aGUgbW9kZWxcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9ucyAgIFByb3ZpZGUgYW55IG9wdGlvbnNcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gYmFzZUNvbGxlY3Rpb24gUHJvdmlkZSBhIGJhc2UgY29sbGVjdGlvbiB1c2VkIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgIFJldHVybiBhIFNjaGVtYSBDb2xsZWN0aW9uXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfY3JlYXRlQ29sbGVjdGlvbjogZnVuY3Rpb24gX2NyZWF0ZUNvbGxlY3Rpb24oc2NoZW1hLCBvcHRpb25zLCBiYXNlQ29sbGVjdGlvbikge1xuXG4gICAgICAgICAgICB2YXIgc2NoZW1hSWQgPSBzY2hlbWEuaWQ7XG5cbiAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmUtdXNlIHByZXZpb3VzbHkgY29uc3RydWN0ZWQgY29sbGVjdGlvbnNcbiAgICAgICAgICAgIGlmIChzY2hlbWFJZCAmJiB0aGlzLnR5cGVDYWNoZVtzY2hlbWFJZF0gIT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50eXBlQ2FjaGVbc2NoZW1hSWRdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBtZWFuaW5nZnVsIG5hbWUgZm9yIHRoZSBtb2RlIHVzaW5nIHRoZSBzY2hlbWEudGl0bGUgKHdoaXRlc3BhY2UgcmVtb3ZlZClcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uTmFtZSA9IHNjaGVtYS50aXRsZSA/IHNjaGVtYS50aXRsZS5yZXBsYWNlKC9bXlxcd10vZ2ksICcnKSA6ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICBpdGVtcyA9IHNjaGVtYS5pdGVtcyxcbiAgICAgICAgICAgICAgICBtb2RlbCxcbiAgICAgICAgICAgICAgICB0eXBlTGFiZWwsXG4gICAgICAgICAgICAgICAgQmFzZUNvbGxlY3Rpb247XG5cbiAgICAgICAgICAgIC8vIERlcGVuZGluZyBvbiB0aGUgaXRlbXMudHlwZSB3ZSBuZWVkIHRvIGNyZWF0ZSBhIGRpZmZlcmVudCBiYXNlIGNvbGxlY3Rpb25cbiAgICAgICAgICAgIHN3aXRjaCAoaXRlbXMudHlwZSkge1xuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBhIG1vZGVsIGJhc2VkIGNvbGxlY3Rpb24gZm9yIG9iamVjdCB0eXBlc1xuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgICAgICAgIC8vIENyZWF0ZSB0aGUgbW9kZWwgdHlwZSBmcm9tIHRoZSBpdGVtcyBwcm9wZXJ0aWVzXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsID0gdGhpcy5fY3JlYXRlTW9kZWwoaXRlbXMsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICAvLyBTdHJpcCB0aGUgd29yZCBcIk1vZGVsXCIgKDUgbGV0dGVycykgZnJvbSB0aGUgZW5kIG9mIHRoZSBtb2RlbCdzIHNjaGVtYU1vZGVsVHlwZVxuICAgICAgICAgICAgICAgICAgICB0eXBlTGFiZWwgPSAoc2NoZW1hLnRpdGxlID8gY29sbGVjdGlvbk5hbWUgOiBtb2RlbC50eXBlTGFiZWwuc2xpY2UoMCwgLTUpKSArICdDb2xsZWN0aW9uJztcblxuICAgICAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgdGhlIGJhc2UgY29sbGVjdGlvbiBzdGFydGluZyB3aXRoIHRoZSBiYXNlQ29sbGVjdGlvbiBwYXNzZWQgaW4gYWJvdmUsXG4gICAgICAgICAgICAgICAgICAgIC8vIG5leHQgdHJ5IHRoZSBhIGNvbGxlY3Rpb24gcmVnc2l0ZXJlZCBhZ2FpbnN0IHRoZSBzY2hlbWFJZCBhbmRcbiAgICAgICAgICAgICAgICAgICAgLy8gbGFzdGx5IHRyeSB0aGUgU2NoZW1hRmFjdG9yeSBkZWZhdWx0IGJhc2VDb2xsZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgIEJhc2VDb2xsZWN0aW9uID0gYmFzZUNvbGxlY3Rpb24gfHwgdGhpcy5yZWdpc3RlcmVkU2NoZW1hVHlwZXNbc2NoZW1hSWRdIHx8IHRoaXMuYmFzZUNvbGxlY3Rpb247XG4gICAgICAgICAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgYmFzZSBjb2xsZWN0aW9uIGlzIG9mIHR5cGUgXCJTY2hlbWFDb2xsZWN0aW9uXCJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFCYXNlQ29sbGVjdGlvbi5pc1NjaGVtYUNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQmFzZSBjb2xsZWN0aW9uIGZvciBzY2hlbWEgJyArIHNjaGVtYUlkICsgJyBpcyBub3QgYSBTY2hlbWFDb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAvLyBDcmVhdGUgYSB2YWx1ZSBiYXNlZCBjb2xsZWN0aW9uIGZvciB2YWx1ZSB0eXBlc1xuICAgICAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgICAgICBjYXNlICdpbnRlZ2VyJzpcbiAgICAgICAgICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgICAgICAgICAgdHlwZUxhYmVsID0gKHNjaGVtYS50aXRsZSA/IGNvbGxlY3Rpb25OYW1lIDogaXRlbXMudHlwZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGl0ZW1zLnR5cGUuc2xpY2UoMSkpICsgJ0NvbGxlY3Rpb24nO1xuICAgICAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgdGhlIGJhc2UgY29sbGVjdGlvbiBzdGFydGluZyB3aXRoIHRoZSBjb2xsZWN0aW9uIHJlZ3NpdGVyZWQgYWdhaW5zdCB0aGUgc2NoZW1hSWQgYW5kXG4gICAgICAgICAgICAgICAgICAgIC8vIGxhc3RseSB0cnkgdGhlIFNjaGVtYUZhY3RvcnkgZGVmYXVsdCBiYXNlVmFsdWVDb2xsZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgIEJhc2VDb2xsZWN0aW9uID0gdGhpcy5yZWdpc3RlcmVkU2NoZW1hVHlwZXNbc2NoZW1hSWRdIHx8IHRoaXMuYmFzZVZhbHVlQ29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgLy8gRW5zdXJlIHRoZSBiYXNlIGNvbGxlY3Rpb24gaXMgb2YgdHlwZSBcIlNjaGVtYVZhbHVlQ29sbGVjdGlvblwiXG4gICAgICAgICAgICAgICAgICAgIGlmICghQmFzZUNvbGxlY3Rpb24uaXNTY2hlbWFWYWx1ZUNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQmFzZSBjb2xsZWN0aW9uIGZvciBzY2hlbWEgJyArIHNjaGVtYUlkICsgJyBpcyBub3QgYSBTY2hlbWFWYWx1ZUNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIC8vIFRoZXNlIHR5cGVzIGFyZSBub3QgY3VycmVudGx5IHN1cHBvcnRlZFxuICAgICAgICAgICAgICAgIGNhc2UgJ2FycmF5JzpcbiAgICAgICAgICAgICAgICBjYXNlICdhbnknOlxuICAgICAgICAgICAgICAgIGNhc2UgJ251bGwnOlxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydCBpdGVtcyB0eXBlOicgKyBpdGVtcy50eXBlKTtcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBpdGVtcyB0eXBlOiAnICsgaXRlbXMudHlwZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxvZygnQ3JlYXRlIEN1c3RvbSBTY2hlbWEgQ29sbGVjdGlvbiBUeXBlOiAnICsgdHlwZUxhYmVsKTtcblxuICAgICAgICAgICAgLy8gQ29uc3RydWN0IHRoZSBuZXcgY29sbGVjdGlvblxuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBCYXNlQ29sbGVjdGlvbi5leHRlbmQoe1xuICAgICAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBmdW5jdGlvbiBjb25zdHJ1Y3Rvcihtb2RlbHMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRvUmV0dXJuID0gQmFzZUNvbGxlY3Rpb24ucHJvdG90eXBlLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0b1JldHVybikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRvUmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucyB8fCBvcHRpb25zLnZhbGlkYXRpb24gIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbGlkYXRpb24gPSBuZXcgVmFsaWRhdGlvbkVycm9yc0NvbGxlY3Rpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgbW9kZWw6IG1vZGVsLFxuICAgICAgICAgICAgICAgIHNjaGVtYTogc2NoZW1hLFxuICAgICAgICAgICAgICAgIGZhY3Rvcnk6IHRoaXMsXG4gICAgICAgICAgICAgICAgLy8gU2F2ZSBhIHJlZmVyZW5jZSB0byB0aGlzIGZhY3RvcnkgZm9yIGZ1dHVyZSB1c2VcbiAgICAgICAgICAgICAgICB0eXBlTGFiZWw6IHR5cGVMYWJlbCxcbiAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiB1bmRlZigpLFxuICAgICAgICAgICAgICAgIGluaXRWYWxpZGF0aW9uOiBmdW5jdGlvbiBpbml0VmFsaWRhdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy52YWxpZGF0ZSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmFsaWRhdGlvbiA9IG5ldyBWYWxpZGF0aW9uRXJyb3JzQ29sbGVjdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBuZXdNb2RlbDogZnVuY3Rpb24gbmV3TW9kZWwoYXR0cmlidXRlcywgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5zY2hlbWEgPSBvcHRpb25zLnNjaGVtYSB8fCB0aGlzLnNjaGVtYS5pdGVtcztcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyB0aGlzLm1vZGVsKGF0dHJpYnV0ZXMsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYWRkTmV3TW9kZWw6IGZ1bmN0aW9uIGFkZE5ld01vZGVsKGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5uZXdNb2RlbChhdHRyaWJ1dGVzLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGQobW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbW9kZWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIC8vIE1ha2UgdGhlIHNjaGVtYSBhbmQgdHlwZUxhYmVsIGFsc28gYXZhaWxhYmxlIGFzIHN0YXRpYyBwcm9wZXJ0aWVzIG9mIHRoZSB0eXBlXG4gICAgICAgICAgICAgICAgc2NoZW1hOiBzY2hlbWEsXG4gICAgICAgICAgICAgICAgdHlwZUxhYmVsOiB0eXBlTGFiZWxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBPbmx5IGNhY2hlIHRoZSByZXN1bHRpbmcgY29sbGVjdGlvbiBpZiBhIHdlIGhhdmUgYSBzY2hlbWEgaWQuXG4gICAgICAgICAgICBpZiAoc2NoZW1hSWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnR5cGVDYWNoZVtzY2hlbWFJZF0gPSBjb2xsZWN0aW9uO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29sbGVjdGlvbjtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFeG9za2VsZXNzdG9uLlNjaGVtYS5Nb2RlbCBwcm92aWRlcyBhIHNjaGVtYSBhd2FyZSBFeG9za2VsZXNzdG9uLk1vZGVsXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGV4dGVuZHMgRXhvc2tlbGVzc3Rvbi5Nb2RlbFxuICAgICAqL1xuICAgIHZhciBTY2hlbWFNb2RlbCA9IFNjaGVtYS5Nb2RlbCA9IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Nb2RlbC5leHRlbmQoe1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBKU09OIFNjaGVtYSBhc3NvY2lhdGVkIHdpdGggdGhpcyBtb2RlbFxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgc2NoZW1hOiB7fSxcblxuICAgICAgICAvLyBFYWNoIHRpbWUgdGhlIE1vZGVsIGlzIGV4dGVuZGVkIGl0IHdpbGwgcmVjZWl2ZSBhIG5ld1xuICAgICAgICAvLyB1bmlxdWVUeXBlSWQgd2hpY2ggY2FuIGxhdGVyIGJlIHVzZWQgdG8gZGlmZmVyZW50aWF0ZSB0eXBlc1xuICAgICAgICB1bmlxdWVUeXBlSWQ6IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS51dGlscy51bmlxdWVJZCgpLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb25zdHJ1Y3RvciBmdW5jdGlvbiBpcyB1c2VkIHRvIHByb3ZpZGUgbmFtZWQgb2JqZWN0cyBkdXJpbmcgZGVidWdnaW5nXG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24gU2NoZW1hTW9kZWwoYXR0cmlidXRlcywgb3B0aW9ucykge1xuXG4gICAgICAgICAgICAvLyBJZGVudGl0eU1hcCB1c2luZyBTY2hlbWFJZFxuICAgICAgICAgICAgLy8gVE9ETzogKE1NSSkgQmluZCB0byBkaXNwb3NlIGV2ZW50IGluIG9yZGVyIHRvIHJlbW92ZSB0aGUgaW5zdGFuY2UgZnJvbVxuICAgICAgICAgICAgLy8gdGhlIGNhY2hlIHRvIGF2b2lkIGEgbWVtb3J5IGxlYWtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXNbdGhpcy5pZEF0dHJpYnV0ZV0pIHtcbiAgICAgICAgICAgICAgICB2YXIgc2NoZW1hSWQgPSB0aGlzLnNjaGVtYSA/IHRoaXMuc2NoZW1hLmlkIDogdW5kZWYoKTtcbiAgICAgICAgICAgICAgICBpZiAoc2NoZW1hSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNhY2hlS2V5ID0gYXR0cmlidXRlc1t0aGlzLmlkQXR0cmlidXRlXSArICd8JyArIHNjaGVtYUlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucyA9PT0gdW5kZWYoKSB8fCBvcHRpb25zLmlkZW50aXR5TWFwICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNhY2hlZE1vZGVsID0gdGhpcy5mYWN0b3J5Lmluc3RhbmNlQ2FjaGVbY2FjaGVLZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhY2hlZE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhY2hlZE1vZGVsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmFjdG9yeS5pbnN0YW5jZUNhY2hlW2NhY2hlS2V5XSA9IHRoaXM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uTW9kZWwucHJvdG90eXBlLmNvbnN0cnVjdG9yLmNhbGwodGhpcywgYXR0cmlidXRlcywgb3B0aW9ucyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERldGVybWluZXMgdGhlIHNlcnZlciBzaWRlIHVybCBwcm92aWRlZCB2aWEgc2NoZW1hIGxpbmtzIHdoZXJlIG1vZGVsIGRhdGEgY2FuIGJlIGxvY2F0ZWRcbiAgICAgICAgICogQHJldHVybiB7U3RyaW5nfSBSZXR1cm5zIGFuIEFQSSBlbmRwb2ludCBVUkxcbiAgICAgICAgICovXG4gICAgICAgIHVybDogZnVuY3Rpb24gdXJsKCkge1xuICAgICAgICAgICAgdmFyIHNjaGVtYSA9IHRoaXMuc2NoZW1hO1xuICAgICAgICAgICAgaWYgKHNjaGVtYSAhPT0gdW5kZWYoKSAmJiBzY2hlbWEubGlua3MgIT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgdXJsO1xuICAgICAgICAgICAgICAgIHZhciBsaW5rO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBzY2hlbWEubGlua3MpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjaGVtYS5saW5rcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5rID0gc2NoZW1hLmxpbmtzW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGluay5yZWwgIT09IHVuZGVmKCkgJiYgbGluay5yZWwgPT09ICdzZWxmJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA9IGxpbmsuaHJlZjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh1cmwgIT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVwbGFjZSB0aGUgdXJsIHByb3BlcnR5IG9uIHRoaXMgbWV0aG9kIHNvIHRoYXQgZnV0dXJlIGNhbGxzXG4gICAgICAgICAgICAgICAgICAgIC8vIGRvbid0IG5lZWQgdG8gcmUtcHJvY2Vzc1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy51cmwgPSB1cmwucmVwbGFjZSgvXFx7aWRcXH0vLCBlbmNvZGVVUklDb21wb25lbnQodGhpcy5pZCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uTW9kZWwucHJvdG90eXBlLnVybC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBPdmVycmlkZXMgdGhlIGRlZmF1bHQgRXhvc2tlbGVzc3Rvbi5Nb2RlbC5mZXRjaCBiZWhhdmlvdXIgYW5kIHNldHMgdGhlIGRlZmF1bHQgb3B0aW9ucy5wYXJzZT10cnVlXG4gICAgICAgICAqIFNlZSBodHRwczovL2dpdGh1Yi5jb20vZG9jdW1lbnRjbG91ZC9iYWNrYm9uZS9pc3N1ZXMvMTg0MyBmb3IgbW9yZSBkZXRhaWxzXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgIFJldHVybnMgYSB4aHIgb2JqZWN0IGZyb20gdGhlIGRlZmF1bHQgZmV0Y2ggbWV0aG9kXG4gICAgICAgICAqL1xuICAgICAgICBmZXRjaDogZnVuY3Rpb24gZmV0Y2gob3B0aW9ucykge1xuICAgICAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5wYXJzZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5wYXJzZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLk1vZGVsLnByb3RvdHlwZS5mZXRjaC5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXRzIHRoZSB2YWx1ZSBvZiBhIG1vZGVsIGF0dHJpYnV0ZVxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IGtleSBQcm92aWRlIHRoZSBhdHRyaWJ1dGUgbmFtZVxuICAgICAgICAgKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfE9iamVjdH0gICAgIFJldHVybnMgdGhlIGF0dHJpYnV0ZSB2YWx1ZVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoa2V5KSB7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBtb2RlbCBoYXMgYSBwcm9wZXJ0eSBvciBtZXRob2QgZm9yIHRoZSBrZXlcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXNba2V5XTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ2Z1bmN0aW9uJyA/IHZhbHVlKCkgOiB2YWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHRvUmV0dXJuID0gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLk1vZGVsLnByb3RvdHlwZS5nZXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgICAgICAgLy8gTGF6eSBJbml0aWFsaXNhdGlvbiBvZiByZWxhdGlvbnNcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSByZXR1cm4gdmFsdWUgaXMgYW4gdW5pbml0aWFsaXplZCByZWxhdGlvblxuICAgICAgICAgICAgaWYgKHRvUmV0dXJuID09PSB1bmRlZigpIHx8IHRvUmV0dXJuID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdmFyIFJlbGF0aW9uVHlwZSA9IHRoaXMuc2NoZW1hUmVsYXRpb25zW2tleV07XG4gICAgICAgICAgICAgICAgaWYgKFJlbGF0aW9uVHlwZSAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgICAgICB0b1JldHVybiA9IHRoaXMuYXR0cmlidXRlc1trZXldID0gbmV3IFJlbGF0aW9uVHlwZSh1bmRlZigpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaWxlbnQ6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdG9SZXR1cm47XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldHMgdGhlIHZhbHVlIG9mIGFuIGF0dHJpYnV0ZVxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5ICAgICBUaGUgYXR0cmlidXRlIG5hbWVcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ8U3RyaW5nfE9iamVjdH0gdmFsdWUgICBUaGUgYXR0cmlidXRlIHZhbHVlXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKi9cbiAgICAgICAgc2V0OiBmdW5jdGlvbiBzZXQoa2V5LCB2YWx1ZSwgb3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIGF0dHJpYnV0ZXM7XG4gICAgICAgICAgICBpZiAoX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLnV0aWxzLmlzT2JqZWN0KGtleSkgfHwga2V5ID09PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgYXR0cmlidXRlcyA9IGtleTtcbiAgICAgICAgICAgICAgICBvcHRpb25zID0gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICAgICAgICBpZiAob3B0aW9ucy52YWxpZGF0ZSA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMudmFsaWRhdGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF0dHJpYnV0ZXMgPSB0aGlzLl9wcmVwYXJlQXR0cmlidXRlcyhhdHRyaWJ1dGVzLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgcmV0dXJuIF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Nb2RlbC5wcm90b3R5cGUuc2V0LmNhbGwodGhpcywgYXR0cmlidXRlcywgb3B0aW9ucyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEludGVyYXRlcyBvdmVyIHRoZSBwcm92aWRlZCBhdHRyaWJ1dGVzIGFuZCBpbml0aWFsaXplcyBhbnkgcmVsYXRpb25zXG4gICAgICAgICAqIHRvIHRoZWlyIGNvcnJlc3BvbmRpbmcgbW9kZWwgb3IgY29sbGVjdGlvbi5cbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSBhdHRyaWJ1dGVzIEF0dHJpYnV0ZXMgdG8gaW5pdGlhbGl6ZVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3RzPX0gb3B0aW9uc1xuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICAgUmV0dXJucyBuZXcgaW5pdGlhbGl6ZWQgYXR0cmlidXRlc1xuICAgICAgICAgKi9cbiAgICAgICAgX3ByZXBhcmVBdHRyaWJ1dGVzOiBmdW5jdGlvbiBfcHJlcGFyZUF0dHJpYnV0ZXMoYXR0cmlidXRlcywgb3B0aW9ucykge1xuICAgICAgICAgICAgLy8gVE9ETzogSWYgYXR0cmlidXRlcyBhcmUgTW9kZWxzIG9yIENvbGxlY3Rpb25zIGNoZWNrIHRoZSBtYXRjaCB0aGUgc2NoZW1hXG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlcyAhPT0gdW5kZWYoKSAmJiB0aGlzLnNjaGVtYSAhPT0gdW5kZWYoKSAmJiB0aGlzLnNjaGVtYVJlbGF0aW9ucyAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIHZhciBhdHRycyA9IHt9LFxuICAgICAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGU7XG5cbiAgICAgICAgICAgICAgICBmb3IgKG5hbWUgaW4gYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkgIT09ICdmdW5jdGlvbicgfHwgYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlID0gYXR0cmlidXRlc1tuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBSZWxhdGlvbiA9IHRoaXMuc2NoZW1hUmVsYXRpb25zW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFJlbGF0aW9uICYmICEoYXR0cmlidXRlIGluc3RhbmNlb2YgX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLk1vZGVsIHx8IGF0dHJpYnV0ZSBpbnN0YW5jZW9mIF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Db2xsZWN0aW9uKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF0dHJzW25hbWVdID0gbmV3IFJlbGF0aW9uKGF0dHJpYnV0ZSwgT2JqZWN0LmFzc2lnbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpbGVudDogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIG9wdGlvbnMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXR0cnNbbmFtZV0gPSBhdHRyaWJ1dGU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzID0gYXR0cnM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYXR0cmlidXRlcztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogTG9jayB1c2VkIHRvIHN0b3AgY2lyY3VsYXIgcmVmZXJlbmNlcyBmcm9tIGNhdXNpbmcgYSBzdGFjayBvdmVyZmxvd1xuICAgICAgICAgKiBkdXJpbmcgdG9KU09OIHNlcmlhbGl6dGlvblxuICAgICAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRvSlNPTkluUHJvZ3Jlc3M6IGZhbHNlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdGVzIGEgc2VyaWFsaXphYmxlIG1vZGVsXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSAgU2VyaWFsaXphYmxlIG1vZGVsXG4gICAgICAgICAqL1xuICAgICAgICB0b0pTT046IGZ1bmN0aW9uIHRvSlNPTihvcHRpb25zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50b0pTT05JblByb2dyZXNzKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhpcyBvbmx5IGhhcHBlbnMgd2hlbiB0aGVyZSBpcyBhIGNpcmN1bGFyIHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgIC8vIGFuZCB0aGUgbW9kZWwgaGFzIGFscmVhZHkgYmVlbiBzZXJpYWxpemVkIHByZXZpb3VzbHlcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5pZCA/IHRvT2JqZWN0KHRoaXMuaWRBdHRyaWJ1dGUsIHRoaXMuaWQpIDogdW5kZWYoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy50b0pTT05JblByb2dyZXNzID0gdHJ1ZTtcblxuICAgICAgICAgICAgdmFyIHRvUmV0dXJuLCBuYW1lLCBwcm9wZXJ0eTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYSkge1xuICAgICAgICAgICAgICAgIGZvciAobmFtZSBpbiB0aGlzLnNjaGVtYS5wcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYS5wcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSA9IHRoaXMuc2NoZW1hLnByb3BlcnRpZXNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYXR0cmlidXRlID0gdGhpcy5hdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFt1bmRlZigpLCBudWxsXS5pbmRleE9mKGF0dHJpYnV0ZSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYVJlbGF0aW9uc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IGF0dHJpYnV0ZS50b0pTT04ob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBhdHRyaWJ1dGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodG9SZXR1cm4gPT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvUmV0dXJuID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9SZXR1cm5bbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRvUmV0dXJuID0gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLk1vZGVsLnByb3RvdHlwZS50b0pTT04uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy50b0pTT05JblByb2dyZXNzID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHJldHVybiB0b1JldHVybjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVmFsaWRhdGVzIHRoZSBtb2RlbCBhZ2FpbnN0IHRoZSBzY2hlbWEgcmV0dXJuaW5nIHRydWUgaWYgdmFsaWRcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgb3B0aW9ucyBQYXNzZWQgdG8gdGhlIHZhbGlkYXRlIG1ldGhvZFxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgIFJldHVybnMgdHJ1ZSBpZiB2YWxpZCwgb3RoZXJ3aXNlIGZhbHNlXG4gICAgICAgICAqL1xuICAgICAgICBpc1ZhbGlkOiBmdW5jdGlvbiBpc1ZhbGlkKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbGlkYXRlKHVuZGVmKCksIG9wdGlvbnMpID09PSB1bmRlZigpO1xuICAgICAgICB9LFxuXG4gICAgICAgIF92YWxpZGF0ZTogZnVuY3Rpb24gX3ZhbGlkYXRlKGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciB0b1JldHVybiA9IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Nb2RlbC5wcm90b3R5cGUuX3ZhbGlkYXRlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnZhbGlkYXRlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRvUmV0dXJuO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBWYWxpZGF0ZXMgdGhlIG1vZGVsIGFnYWluc3QgdGhlIHNjaGVtYVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBvcHRpb25zXG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fSAgUmV0dXJucyBhbiBhcnJheSBvZiBlcnJvcnMgb3IgdW5kZWYoKVxuICAgICAgICAgKi9cbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIHZhbGlkYXRlKGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnZhbGlkYXRpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIG5vIGF0dHJpYnV0ZXMgYXJlIHN1cHBsaWVkLCB0aGVuIHZhbGlkYXRlIGFsbCBzY2hlbWEgcHJvcGVydGllc1xuICAgICAgICAgICAgLy8gYnkgYnVpbGRpbmcgYW4gYXR0cmlidXRlcyBhcnJheSBjb250YWluaW5nIGFsbCBwcm9wZXJ0aWVzLlxuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZXMgPT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzID0ge307XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5zY2hlbWEucHJvcGVydGllcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2hlbWEucHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLnNjaGVtYS5wcm9wZXJ0aWVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSB0aGlzLmF0dHJpYnV0ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAodmFyIF9uYW1lIGluIHRoaXMuYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eSAhPT0gJ2Z1bmN0aW9uJyB8fCB0aGlzLmF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoX25hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlc1tfbmFtZV0gPT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzW19uYW1lXSA9IHRoaXMuYXR0cmlidXRlc1tfbmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiB0aGlzLnZhbGlkYXRpb24uYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy52YWxpZGF0aW9uLmF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkgIT09ICdmdW5jdGlvbicgfHwgdGhpcy52YWxpZGF0aW9uLmF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXR0cmlidXRlID0gdGhpcy52YWxpZGF0aW9uLmF0dHJpYnV0ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMudmFsaWRhdGlvbi5hdHRyaWJ1dGVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGUuZGlzcG9zZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gYXR0cmlidXRlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBsb2coJ1ZhbGlkYXRpbmcgYXR0cmlidXRlOiAnICsga2V5KTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGF0dHJpYnV0ZUVycm9ycyA9IHRoaXMudmFsaWRhdGVBdHRyaWJ1dGUoa2V5LCB2YWx1ZSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVFcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52YWxpZGF0aW9uLnNldChrZXksIG5ldyBWYWxpZGF0aW9uRXJyb3JzQ29sbGVjdGlvbihhdHRyaWJ1dGVFcnJvcnMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoLmFwcGx5KGVycm9ycywgYXR0cmlidXRlRXJyb3JzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmV0dXJuIG5vdGhpbmcgb24gc3VjY2Vzc1xuICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgbG9nKCdWYWxpZGF0aW9uIGZhaWxlZDogJywgZXJyb3JzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBWYWxpZGF0ZSBhbiBpbmRpdmlkdWFsIGF0dHJpYnV0ZVxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IGtleSAgICAgW2Rlc2NyaXB0aW9uXVxuICAgICAgICAgKiBAcGFyYW0gIHtOdW1iZXJ8U3RyaW5nfE9iamVjdH0gdmFsdWUgICBUaGUgdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBvcHRpb25zXG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgIFJldHVybnMgYW4gYXJyYXkgY29udGFpbmluZyBhbnkgdmFsaWRhdGlvbiBlcnJvcnNcbiAgICAgICAgICovXG4gICAgICAgIHZhbGlkYXRlQXR0cmlidXRlOiBmdW5jdGlvbiB2YWxpZGF0ZUF0dHJpYnV0ZShrZXksIHZhbHVlLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgICAgICAgLy8gSWYgYSBwcm9wZXJ0eSBpcyBub3QgZGVmaW5lZCBpbiBzY2hlbWEgYW5kIGFkZGl0aW9uYWxQcm9wZXJ0aWVzIGlzIG5vdCBzZXQgdG8gZmFsc2UsIHRoZW4gYWxsb3cgYW55dGhpbmcuXG4gICAgICAgICAgICAvLyBOb3RlOiB3ZSBkb24ndCBjdXJyZW50bHkgc3VwcG9ydCBzY2hlbWEgYmFzZWQgYWRkaXRpb25hbFByb3BlcnRpZXMsIG9ubHkgYm9vbGVhbiB2YWx1ZXNcbiAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYS5hZGRpdGlvbmFsUHJvcGVydGllcyAhPT0gZmFsc2UgJiYgKHRoaXMuc2NoZW1hLnByb3BlcnRpZXMgPT09IHVuZGVmKCkgfHwgdGhpcy5zY2hlbWEucHJvcGVydGllc1trZXldID09PSB1bmRlZigpKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHNjaGVtYVByb3BlcnR5ID0gdGhpcy5zY2hlbWEucHJvcGVydGllc1trZXldLFxuICAgICAgICAgICAgICAgIGVycm9ycyA9IFtdO1xuXG4gICAgICAgICAgICAvLyBPbmx5IHZhbGlkYXRlIFNjaGVtYSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICBpZiAoc2NoZW1hUHJvcGVydHkgPT09IHVuZGVmKCkpIHtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYS5hZGRpdGlvbmFsUHJvcGVydGllcyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAndHlwZScsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJShwcm9wZXJ0eSkgaXMgbm90IGFsbG93ZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3Byb3BlcnR5Jzoga2V5XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc2NoZW1hVGl0bGUgPSBzY2hlbWFQcm9wZXJ0eS50aXRsZSB8fCBrZXk7XG5cbiAgICAgICAgICAgIC8vIElmIGEgcHJvcGVydHkgaXMgbm90IHJlcXVpcmUgYW5kIGlzIHVuZGVmKCkgdGhlbiB2YWxpZGF0aW9uIGNhbiBiZSBza2lwcGVkXG4gICAgICAgICAgICB2YXIgcmVxdWlyZXNWYWxpZGF0aW9uID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmIChzY2hlbWFQcm9wZXJ0eS5yZXF1aXJlZCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBwcm9wZXJ0eSBpcyByZXF1aXJlZCwgUnVuIGFsbCB2YWxpZGF0b3JzXG4gICAgICAgICAgICAgICAgcmVxdWlyZXNWYWxpZGF0aW9uID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGlmICghVmFsaWRhdG9ycy5yZXF1aXJlZCh2YWx1ZSwgdHJ1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAncmVxdWlyZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIGlzIGEgcmVxdWlyZWQgZmllbGQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSwgb25seSBydW4gdmFsaWRhdG9ycyBpZiBhIHZhbHVlIGhhcyBiZWVuIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgIHJlcXVpcmVzVmFsaWRhdGlvbiA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENhbGwgaW50byBlYWNoIG5lY2Vzc2FyeSB2YWxpZGF0b3JcbiAgICAgICAgICAgIGlmIChyZXF1aXJlc1ZhbGlkYXRpb24pIHtcblxuICAgICAgICAgICAgICAgIHZhciBpc1N0cmluZyA9IHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJztcbiAgICAgICAgICAgICAgICB2YXIgaXNOdW1iZXIgPSAhaXNTdHJpbmcgJiYgdHlwZW9mIHZhbHVlID09ICdudW1iZXInO1xuICAgICAgICAgICAgICAgIHZhciBpc0ludGVnZXIgPSBpc051bWJlciAmJiB2YWx1ZSAlIDEgPT09IDA7XG4gICAgICAgICAgICAgICAgdmFyIGlzQm9vbGVhbiA9ICFpc1N0cmluZyAmJiAhaXNOdW1iZXIgJiYgdHlwZW9mIHZhbHVlID09ICdib29sZWFuJztcbiAgICAgICAgICAgICAgICB2YXIgaXNWYWx1ZSA9IGlzU3RyaW5nIHx8IGlzTnVtYmVyIHx8IGlzQm9vbGVhbjtcbiAgICAgICAgICAgICAgICB2YXIgaXNNb2RlbCA9ICFpc1ZhbHVlICYmIGluc3RhbmNlT2YodmFsdWUsIFNjaGVtYU1vZGVsKTtcbiAgICAgICAgICAgICAgICB2YXIgaXNDb2xsZWN0aW9uID0gIWlzVmFsdWUgJiYgaW5zdGFuY2VPZih2YWx1ZSwgU2NoZW1hQ29sbGVjdGlvbik7XG4gICAgICAgICAgICAgICAgdmFyIGlzUmVsYXRpb24gPSBpc01vZGVsIHx8IGlzQ29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICB2YXIgaXNOdWxsID0gdmFsdWUgPT09IHVuZGVmKCkgfHwgdmFsdWUgPT09IG51bGw7XG5cbiAgICAgICAgICAgICAgICB2YXIgc2NoZW1hVHlwZSA9IHNjaGVtYVByb3BlcnR5LnR5cGU7XG5cbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSB0aGUgdHlwZSBvZiBlYWNoIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgIHN3aXRjaCAoc2NoZW1hVHlwZSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAndHlwZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBzaG91bGQgYmUgYSBtb2RlbCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnYXJyYXknOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0NvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAndHlwZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBzaG91bGQgYmUgYSBjb2xsZWN0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc1N0cmluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICd0eXBlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIHNob3VsZCBiZSBhIHN0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOdW1iZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAndHlwZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBzaG91bGQgYmUgYSBudW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYVRpdGxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2ludGVnZXInOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0ludGVnZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAndHlwZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBzaG91bGQgYmUgYSBpbnRlZ2VyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNCb29sZWFuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVsZTogJ3R5cGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgc2hvdWxkIGJlIGEgYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbnVsbCc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICd0eXBlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIHNob3VsZCBiZSBudWxsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlICdhbnknOlxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBTY2hlbWEgdHlwZTogJyArIHNjaGVtYVR5cGUpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChpc1JlbGF0aW9uKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSB2YWxpZGF0ZSByZWxhdGlvbnMgd2hlbiBvcHRpb25zLmRlZXAgaXMgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmRlZXAgPT09IHRydWUpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzTW9kZWwgJiYgIXZhbHVlLmlzVmFsaWQob3B0aW9ucykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAncmVsYXRpb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgaXMgaW52YWxpZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNDb2xsZWN0aW9uICYmICF2YWx1ZS5pc1ZhbGlkKG9wdGlvbnMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVsZTogJ3JlbGF0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIGlzIGludmFsaWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYVRpdGxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtYXhMZW5ndGggdmFsaWRhdG9yXG4gICAgICAgICAgICAgICAgICAgIGlmIChzY2hlbWFQcm9wZXJ0eS5tYXhMZW5ndGggIT0gdW5kZWYoKSAmJiAhVmFsaWRhdG9ycy5tYXhMZW5ndGgodmFsdWUsIHNjaGVtYVByb3BlcnR5Lm1heExlbmd0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAnbWF4TGVuZ3RoJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgbWF5IG5vdCBiZSBsb25nZXIgdGhhbiAlKG1heExlbmd0aCknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21heExlbmd0aCc6IHNjaGVtYVByb3BlcnR5Lm1heExlbmd0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbWluTGVuZ3RoIHZhbGlkYXRvclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2NoZW1hUHJvcGVydHkubWluTGVuZ3RoICE9IHVuZGVmKCkgJiYgIVZhbGlkYXRvcnMubWluTGVuZ3RoKHZhbHVlLCBzY2hlbWFQcm9wZXJ0eS5taW5MZW5ndGgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVsZTogJ21pbkxlbmd0aCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIG11c3QgYmUgbG9uZ2VyIHRoYW4gJShtaW5MZW5ndGgpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtaW5MZW5ndGgnOiBzY2hlbWFQcm9wZXJ0eS5taW5MZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZvcm1hdCB2YWxpZGF0b3JcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjaGVtYVByb3BlcnR5LmZvcm1hdCAhPSB1bmRlZigpICYmICFWYWxpZGF0b3JzLmZvcm1hdCh2YWx1ZSwgc2NoZW1hUHJvcGVydHkuZm9ybWF0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICdmb3JtYXQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBkb2VzIG5vdCBtYXRjaCAlKGZvcm1hdCknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2Zvcm1hdCc6IHNjaGVtYVByb3BlcnR5LmZvcm1hdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcGF0dGVybiB2YWxpZGF0b3JcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjaGVtYVByb3BlcnR5LnBhdHRlcm4gIT0gdW5kZWYoKSAmJiAhVmFsaWRhdG9ycy5wYXR0ZXJuKHZhbHVlLCBzY2hlbWFQcm9wZXJ0eS5wYXR0ZXJuKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICdwYXR0ZXJuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgaXMgaW52YWxpZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYVRpdGxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzTnVtYmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG1pbmltdW0gdmFsaWRhdG9yXG4gICAgICAgICAgICAgICAgICAgIGlmIChzY2hlbWFQcm9wZXJ0eS5taW5pbXVtICE9IHVuZGVmKCkgJiYgIVZhbGlkYXRvcnMubWluaW11bSh2YWx1ZSwgc2NoZW1hUHJvcGVydHkubWluaW11bSwgc2NoZW1hUHJvcGVydHkuZXhjbHVzaXZlTWluaW11bSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAnbWluaW11bScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIG1heSBub3QgYmUgbGVzcyB0aGFuICUobWluaW11bSknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21pbmltdW0nOiBzY2hlbWFQcm9wZXJ0eS5taW5pbXVtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBtYXhpbXVtIHZhbGlkYXRvclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2NoZW1hUHJvcGVydHkubWF4aW11bSAhPSB1bmRlZigpICYmICFWYWxpZGF0b3JzLm1heGltdW0odmFsdWUsIHNjaGVtYVByb3BlcnR5Lm1heGltdW0sIHNjaGVtYVByb3BlcnR5LmV4Y2x1c2l2ZU1heGltdW0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVsZTogJ21heGltdW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBtYXkgbm90IGJlIGxlc3MgdGhhbiAlKG1heGltdW0pJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdtYXhpbXVtJzogc2NoZW1hUHJvcGVydHkubWF4aW11bVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZGl2aXNpYmxlQnkgdmFsaWRhdG9yXG4gICAgICAgICAgICAgICAgICAgIGlmIChzY2hlbWFQcm9wZXJ0eS5kaXZpc2libGVCeSAhPSB1bmRlZigpICYmICFWYWxpZGF0b3JzLmRpdmlzaWJsZUJ5KHZhbHVlLCBzY2hlbWFQcm9wZXJ0eS5kaXZpc2libGVCeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAnZGl2aXNpYmxlQnknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBpcyBub3QgZGl2aXNpYmxlIGJ5ICUoZGl2aXNpYmxlQnkpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdkaXZpc2libGVCeSc6IHNjaGVtYVByb3BlcnR5LmRpdmlzaWJsZUJ5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBlcnJvcnM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgaXNEaXNwb3NlZDogZmFsc2UsXG4gICAgICAgIGRpc3Bvc2U6IGZ1bmN0aW9uIGRpc3Bvc2UoKSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBBZGQgcmVmZXJlbmNlIGNvdW50IGZ1bmN0aW9uYWxpdHkgdG8gYXZvaWQgc2l0dWF0aW9uXG4gICAgICAgICAgICAvLyB3aGVyZSBtb2RlbCBpcyB1c2VkIG11bHRpcGxlIHRpbWVzXG4gICAgICAgICAgICAvKmlmKCF0aGlzLmlzRGlzcG9zZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlzRGlzcG9zZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIC8vIENhbGwgZGlzcG9zZSBvbiBuZXN0ZWQgbW9kZWxzIGFuZCBjb2xsZWN0aW9uc1xuICAgICAgICAgICAgICAgIF8uZWFjaCh0aGlzLnNjaGVtYVJlbGF0aW9ucywgZnVuY3Rpb24ocmVsYXRpb24sIG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbCA9IHRoaXMuYXR0cmlidXRlc1tuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgaWYocmVsICE9PSB1bmRlZigpICYmIHJlbC5kaXNwb3NlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWwuZGlzcG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgICAgICB9Ki9cbiAgICAgICAgfVxuICAgIH0sIHtcbiAgICAgICAgaXNTY2hlbWFNb2RlbDogdHJ1ZSxcbiAgICAgICAgdHlwZUxhYmVsOiAnU2NoZW1hTW9kZWwnXG4gICAgfSk7XG5cbiAgICBTY2hlbWFNb2RlbC5leHRlbmQgPSBpbnRlcm5hbEV4dGVuZDtcblxuICAgIC8qKlxuICAgICAqIEV4b3NrZWxlc3N0b24uU2NoZW1hLkNvbGxlY3Rpb24gcHJvdmlkZXMgYSBzY2hlbWEgYXdhcmUgRXhvc2tlbGVzc3Rvbi5Db2xsZWN0aW9uXG4gICAgICogQGV4dGVuZHMgRXhvc2tlbGVzc3Rvbi5Db2xsZWN0aW9uXG4gICAgICovXG4gICAgdmFyIFNjaGVtYUNvbGxlY3Rpb24gPSBTY2hlbWEuQ29sbGVjdGlvbiA9IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Db2xsZWN0aW9uLmV4dGVuZCh7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEpTT04gU2NoZW1hIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vZGVsXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBzY2hlbWE6IHt9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWZhdWx0IGNvbGxlY3Rpb24gbW9kZWxcbiAgICAgICAgICogQHR5cGUge1t0eXBlXX1cbiAgICAgICAgICovXG4gICAgICAgIG1vZGVsOiBTY2hlbWFNb2RlbCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgY29udGlhbmluZyBjb2xsZWN0aW9uIG1vZGVsc1xuICAgICAgICAgKiBAdHlwZSB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBtb2RlbHM6IHVuZGVmKCksXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE51bWJlciBvZiBpdGVtcyBpbiB0aGUgY29sbGVjdGlvblxuICAgICAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgbGVuZ3RoOiAwLFxuXG4gICAgICAgIC8vIEVhY2ggdGltZSB0aGUgQ29sbGVjdGlvbiBpcyBleHRlbmRlZCBpdCB3aWxsIHJlY2VpdmUgYSBuZXdcbiAgICAgICAgLy8gdW5pcXVlVHlwZUlkIHdoaWNoIGNhbiBsYXRlciBiZSB1c2VkIHRvIGRpZmZlcmVudGlhdGUgdHlwZXNcbiAgICAgICAgdW5pcXVlVHlwZUlkOiBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10udXRpbHMudW5pcXVlSWQoKSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29uc3RydWN0b3IgZnVuY3Rpb24gaXMgdXNlZCB0byBwcm92aWRlIG5hbWVkIG9iamVjdHMgZHVyaW5nIGRlYnVnZ2luZ1xuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3I6IGZ1bmN0aW9uIFNjaGVtYUNvbGxlY3Rpb24obW9kZWxzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uQ29sbGVjdGlvbi5wcm90b3R5cGUuY29uc3RydWN0b3IuY2FsbCh0aGlzLCBtb2RlbHMsIG9wdGlvbnMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBWYWxpZGF0ZXMgdGhlIENvbGxlY3Rpb24gYWdhaW5zdCB0aGUgc2NoZW1hIHJldHVybmluZyB0cnVlIGlmIHZhbGlkXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdH0gIG9wdGlvbnMgUGFzc2VkIHRvIHRoZSB2YWxpZGF0ZSBtZXRob2RcbiAgICAgICAgICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgICBSZXR1cm5zIHRydWUgaWYgdmFsaWQsIG90aGVyd2lzZSBmYWxzZVxuICAgICAgICAgKi9cbiAgICAgICAgaXNWYWxpZDogZnVuY3Rpb24gaXNWYWxpZChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy52YWxpZGF0ZShvcHRpb25zKSA9PT0gdW5kZWYoKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkcyBvbmUgb3IgbW9yZSBtb2RlbHMgdG8gdGhlIGNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIHtTY2hlbWFNb2RlbHxhcnJheX0gbW9kZWxzICBNb2RlbCBvciBhcnJheSBvZiBNb2RlbHNcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBvcHRpb25zXG4gICAgICAgICAqL1xuICAgICAgICBhZGQ6IGZ1bmN0aW9uIGFkZChtb2RlbHMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMucGFyc2UpIHtcbiAgICAgICAgICAgICAgICBtb2RlbHMgPSB0aGlzLnBhcnNlKG1vZGVscyBpbnN0YW5jZW9mIEFycmF5ID8gbW9kZWxzIDogW21vZGVsc10sIG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Db2xsZWN0aW9uLnByb3RvdHlwZS5hZGQuY2FsbCh0aGlzLCBtb2RlbHMsIG9wdGlvbnMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmVzIG9uZSBvciBtb3JlIG1vZGVscyBmcm9tIHRoZSBjb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSB7U2NoZW1hTW9kZWx8YXJyYXl9IG1vZGVscyAgTW9kZWwgb3IgYXJyYXkgb2YgTW9kZWxzXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUobW9kZWxzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnBhcnNlKSB7XG4gICAgICAgICAgICAgICAgbW9kZWxzID0gdGhpcy5wYXJzZShtb2RlbHMgaW5zdGFuY2VvZiBBcnJheSA/IG1vZGVscyA6IFttb2RlbHNdLCBvcHRpb25zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uQ29sbGVjdGlvbi5wcm90b3R5cGUucmVtb3ZlLmNhbGwodGhpcywgbW9kZWxzLCBvcHRpb25zKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzZXRzIHRoZSBjb2xsZWN0aW9uIHdpdGggdGhlIHByb3ZpZGVkIE1vZGVsc1xuICAgICAgICAgKiBAcGFyYW0ge1NjaGVtYU1vZGVsfGFycmF5fSBtb2RlbHMgIE1vZGVsIG9yIGFycmF5IG9mIE1vZGVsc1xuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICovXG4gICAgICAgIHJlc2V0OiBmdW5jdGlvbiByZXNldChtb2RlbHMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMucGFyc2UpIHtcbiAgICAgICAgICAgICAgICBtb2RlbHMgPSB0aGlzLnBhcnNlKG1vZGVscyBpbnN0YW5jZW9mIEFycmF5ID8gbW9kZWxzIDogW21vZGVsc10sIG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Db2xsZWN0aW9uLnByb3RvdHlwZS5yZXNldC5jYWxsKHRoaXMsIG1vZGVscywgb3B0aW9ucyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZhbGlkYXRlcyB0aGUgY29sbGVjdGlvbiBhZ2FpbnN0IHRoZSBzY2hlbWFcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX0gIFJldHVybnMgYW4gYXJyYXkgb2YgZXJyb3JzIG9yIHVuZGVmKClcbiAgICAgICAgICovXG4gICAgICAgIHZhbGlkYXRlOiBmdW5jdGlvbiB2YWxpZGF0ZShvcHRpb25zKSB7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy52YWxpZGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc2NoZW1hID0gdGhpcy5zY2hlbWE7XG4gICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG5cbiAgICAgICAgICAgIGlmIChzY2hlbWEubWluSXRlbXMgIT0gdW5kZWYoKSAmJiAhVmFsaWRhdG9ycy5taW5JdGVtcyh0aGlzLm1vZGVscywgc2NoZW1hLm1pbkl0ZW1zKSkge1xuICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgIHJ1bGU6ICdtaW5JdGVtcycsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdNaW5pbXVtIG9mICUoY291bnQpICUodGl0bGUpIHJlcXVpcmVkJyxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWEudGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAnY291bnQnOiBzY2hlbWEubWluSXRlbXNcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2NoZW1hLm1heEl0ZW1zICE9IHVuZGVmKCkgJiYgIVZhbGlkYXRvcnMubWF4SXRlbXModGhpcy5tb2RlbHMsIHNjaGVtYS5tYXhJdGVtcykpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICBydWxlOiAnbWF4SXRlbXMnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnTWF4aW11bSBvZiAlKGNvdW50KSAlKHRpdGxlKSBhbGxvd2VkJyxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWEudGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAnY291bnQnOiBzY2hlbWEubWF4SXRlbXNcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2NoZW1hLnVuaXF1ZUl0ZW1zICE9IHVuZGVmKCkgJiYgIVZhbGlkYXRvcnMudW5pcXVlSXRlbXModGhpcy5tb2RlbHMsIGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtb2RlbC5jaWQ7XG4gICAgICAgICAgICB9KSkge1xuICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgIHJ1bGU6ICd1bmlxdWVJdGVtcycsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdEdXBsaWNhdGUgJSh0aXRsZSkgYXJlIG5vdCBhbGxvd2VkJyxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWEudGl0bGVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmRlZXAgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaC5hcHBseShlcnJvcnMsIHRoaXMuX3ZhbGlkYXRlTW9kZWxzKG9wdGlvbnMpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy52YWxpZGF0aW9uLnJlc2V0KGVycm9ycyk7XG5cbiAgICAgICAgICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvcnM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZhbGlkYXRlcyB0aGUgY29sbGVjdGlvbnMgbW9kZWxzXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9ICBSZXR1cm5zIGFuIGVtcHR5IGFycmF5IG9yIGFuIGFycmF5IG9mIGVycm9yc1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3ZhbGlkYXRlTW9kZWxzOiBmdW5jdGlvbiBfdmFsaWRhdGVNb2RlbHMob3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuICAgICAgICAgICAgdmFyIGhhc0ludmFsaWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHZhciBtb2RlbDtcbiAgICAgICAgICAgIHZhciBrZXk7XG5cbiAgICAgICAgICAgIGZvciAoa2V5IGluIHRoaXMubW9kZWxzKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwgPSB0aGlzLm1vZGVsc1trZXldO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1vZGVscy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmICFtb2RlbC5pc1ZhbGlkKG9wdGlvbnMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhc0ludmFsaWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChoYXNJbnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgcnVsZTogJ3JlbGF0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIGlzIGludmFsaWQnLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHRoaXMuc2NoZW1hLnRpdGxlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGVycm9ycztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogTG9jayB1c2VkIHRvIHN0b3AgY2lyY3VsYXIgcmVmZXJlbmNlcyBmcm9tIGNhdXNpbmcgYSBzdGFjayBvdmVyZmxvd1xuICAgICAgICAgKiBkdXJpbmcgdG9KU09OIHNlcmlhbGl6dGlvblxuICAgICAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRvSlNPTkluUHJvZ3Jlc3M6IGZhbHNlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdGVzIGEgc2VyaWFsaXphYmxlIGFycmF5IG9mIG1vZGVscyBmcm9tIHRoZSBjb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9ICBhcnJheSBvZiBtb2RlbCBvYmplY3RzIHRoYXQgaGF2ZSB0aGVtc2VsdmVzIGJlZW4gcGFzc2VkIHRocm91Z2ggdG9KU09OXG4gICAgICAgICAqL1xuICAgICAgICB0b0pTT046IGZ1bmN0aW9uIHRvSlNPTihvcHRpb25zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50b0pTT05JblByb2dyZXNzKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhpcyBvbmx5IGhhcHBlbnMgd2hlbiB0aGVyZSBpcyBhIGNpcmN1bGFyIHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgIC8vIGFuZCB0aGUgbW9kZWwgaGFzIGFscmVhZHkgYmVlbiBzZXJpYWxpemVkIHByZXZpb3VzbHlcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWYoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudG9KU09OSW5Qcm9ncmVzcyA9IHRydWU7XG5cbiAgICAgICAgICAgIHZhciB0b1JldHVybjtcbiAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYSkge1xuICAgICAgICAgICAgICAgIHZhciBtb2RlbHMgPSB0aGlzLm1vZGVscyxcbiAgICAgICAgICAgICAgICAgICAgbW9kZWwsXG4gICAgICAgICAgICAgICAgICAgIGtleTtcbiAgICAgICAgICAgICAgICB0b1JldHVybiA9IFtdO1xuXG4gICAgICAgICAgICAgICAgZm9yIChrZXkgaW4gbW9kZWxzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtb2RlbHMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWwgPSBtb2RlbHNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IG1vZGVsLnRvSlNPTihvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvUmV0dXJuLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0b1JldHVybiA9IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Db2xsZWN0aW9uLnByb3RvdHlwZS50b0pTT04uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy50b0pTT05JblByb2dyZXNzID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHJldHVybiB0b1JldHVybjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogTG9jayB3aGljaCBhbGxvd3MgZGlzcG9zZSB0byBiZSBjYWxsZWQgbXVsdGlwbGUgdGltZXMgd2l0aG91dCBkaXNwb3NpbmcgbXV0bGlwbGUgdGltZXNcbiAgICAgICAgICogZHVyaW5nIHRvSlNPTiBzZXJpYWxpenRpb25cbiAgICAgICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBpc0Rpc3Bvc2VkOiBmYWxzZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGlzcG9zZSB0aGUgY29sbGVjdGlvbiBhbmQgYWxsIGNvbGxldGlvbnMgbW9kZWxzXG4gICAgICAgICAqL1xuICAgICAgICBkaXNwb3NlOiBmdW5jdGlvbiBkaXNwb3NlKCkge1xuICAgICAgICAgICAgLy8gVE9ETzogQWRkIHJlZmVyZW5jZSBjb3VudCBmdW5jdGlvbmFsaXR5IHRvIGF2b2lkIHNpdHVhdGlvblxuICAgICAgICAgICAgLy8gd2hlcmUgY29sbGVjdGlvbiBpcyB1c2VkIG11bHRpcGxlIHRpbWVzXG4gICAgICAgICAgICAvKmlmKCF0aGlzLmlzRGlzcG9zZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlzRGlzcG9zZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIF8uZWFjaCh0aGlzLm1vZGVscywgZnVuY3Rpb24obW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYobW9kZWwuZGlzcG9zZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWwuZGlzcG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9Ki9cbiAgICAgICAgfVxuXG4gICAgfSwge1xuICAgICAgICBpc1NjaGVtYUNvbGxlY3Rpb246IHRydWUsXG4gICAgICAgIHR5cGVMYWJlbDogJ1NjaGVtYUNvbGxlY3Rpb24nXG4gICAgfSk7XG4gICAgU2NoZW1hQ29sbGVjdGlvbi5leHRlbmQgPSBpbnRlcm5hbEV4dGVuZDtcblxuICAgIC8qKlxuICAgICAqIEV4b3NrZWxlc3N0b24uU2NoZW1hLlZhbHVlQ29sbGVjdGlvbiBwcm92aWRlcyBhIEV4b3NrZWxlc3N0b24uU2NoZW1hLkNvbGxlY3Rpb24gdGhhdCBjb250YWlucyBzaW1wbGUgdmFsdWUgdHlwZXMgcmF0aGVyIHRoYW4gbW9kZWxzXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGV4dGVuZHMgRXhvc2tlbGVzc3Rvbi5Db2xsZWN0aW9uXG4gICAgICovXG4gICAgdmFyIFNjaGVtYVZhbHVlQ29sbGVjdGlvbiA9IFNjaGVtYS5WYWx1ZUNvbGxlY3Rpb24gPSBTY2hlbWFDb2xsZWN0aW9uLmV4dGVuZCh7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRlY2xhcmUgdGhlIG1vZGVsIGFzIHVuZGVmKCkgYXMgd2UgZG9uJ3QgdXNlIG1vZGVscyBpbiB0aGlzIGltcGxlbWVudGF0aW9uXG4gICAgICAgICAqIEB0eXBlIHtbdHlwZV19XG4gICAgICAgICAqL1xuICAgICAgICBtb2RlbDogdW5kZWYoKSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgdXNlZCB0byBjb250YWluIHRoZSBjb2xsZWN0aW9ucyB2YWx1ZXNcbiAgICAgICAgICogQHR5cGUge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgbW9kZWxzOiBbXSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSBoYXNoIG9iamVjdCB3aGljaCBpcyB1c2VkIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IHZhbHVlcyBhbHJlYWR5IGFkZGVkIHRvIHRoZSBjb2xsZWN0aW9uXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB2YWx1ZU1hcHM6IHt9LFxuXG4gICAgICAgIC8vIEVhY2ggdGltZSB0aGUgQ29sbGVjdGlvbiBpcyBleHRlbmRlZCBpdCB3aWxsIHJlY2VpdmUgYSBuZXdcbiAgICAgICAgLy8gdW5pcXVlVHlwZUlkIHdoaWNoIGNhbiBsYXRlciBiZSB1c2VkIHRvIGRpZmZlcmVudGlhdGUgdHlwZXNcbiAgICAgICAgdW5pcXVlVHlwZUlkOiBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10udXRpbHMudW5pcXVlSWQoKSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29uc3RydWN0b3IgZnVuY3Rpb24gaXMgdXNlZCB0byBwcm92aWRlIG5hbWVkIG9iamVjdHMgZHVyaW5nIGRlYnVnZ2luZ1xuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3I6IGZ1bmN0aW9uIFNjaGVtYVZhbHVlQ29sbGVjdGlvbih2YWx1ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBTY2hlbWFDb2xsZWN0aW9uLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgb25lIG9yIG1vcmUgdmFsdWVzIHRvIHRoZSBjb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfFN0cmluZ3xBcnJheX0gdmFsdWVzICBWYWx1ZSBvciBhcnJheSBvZiB2YWx1ZXMgdG8gYWRkZWQgdG8gdGhlIGNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBvcHRpb25zXG4gICAgICAgICAqIEByZXR1cm4gdGhpc1xuICAgICAgICAgKi9cbiAgICAgICAgYWRkOiBmdW5jdGlvbiBhZGQodmFsdWVzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIga2V5LCB2YWx1ZTtcblxuICAgICAgICAgICAgdmFsdWVzID0gdGhpcy5zY2hlbWEudW5pcXVlSXRlbXMgPyBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10udXRpbHMudW5pcSh2YWx1ZXMpIDogdmFsdWVzO1xuXG4gICAgICAgICAgICBmb3IgKGtleSBpbiB2YWx1ZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnNjaGVtYS51bmlxdWVJdGVtcyB8fCAhdGhpcy52YWx1ZU1hcHNbdmFsdWVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlTWFwc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbHMucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMgfHwgIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyKCdhZGQnLCB2YWx1ZSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmxlbmd0aCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlIG9uZSBvciBtb3JlIHZhbHVlcyB0byB0aGUgY29sbGVjdGlvblxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcnxTdHJpbmd8QXJyYXl9IHZhbHVlcyAgVmFsdWUgb3IgYXJyYXkgb2YgdmFsdWVzIHRvIGFkZGVkIHRvIHRoZSBjb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKiBAcmV0dXJuIHRoaXNcbiAgICAgICAgICovXG4gICAgICAgIHJlbW92ZTogZnVuY3Rpb24gcmVtb3ZlKHZhbHVlcywgb3B0aW9ucykge1xuXG4gICAgICAgICAgICB2YXIga2V5LCB2YWx1ZTtcblxuICAgICAgICAgICAgdmFsdWVzID0gdGhpcy5zY2hlbWEudW5pcXVlSXRlbXMgPyBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10udXRpbHMudW5pcSh2YWx1ZXMpIDogdmFsdWVzO1xuXG4gICAgICAgICAgICBmb3IgKGtleSBpbiB2YWx1ZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMudmFsdWVNYXBzW3ZhbHVlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMudmFsdWVNYXBzW3ZhbHVlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChpbmRleCA9IHRoaXMuaW5kZXhPZih2YWx1ZSkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5sZW5ndGgtLTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudHJpZ2dlcigncmVtb3ZlJywgdmFsdWUsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc2V0cyB0aGUgY29sbGVjdGlvbiB3aXRoIHRoZSBwcm92aWRlZCB2YWx1ZXNcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ8U3RyaW5nfEFycmF5fSB2YWx1ZXMgIFZhbHVlIG9yIGFycmF5IG9mIHZhbHVlc1xuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICogQHJldHVybiB0aGlzXG4gICAgICAgICAqL1xuICAgICAgICByZXNldDogZnVuY3Rpb24gcmVzZXQodmFsdWVzLCBvcHRpb25zKSB7XG5cbiAgICAgICAgICAgIHZhciBrZXksIHZhbHVlO1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVscyA9IHRoaXMuc2NoZW1hLnVuaXF1ZUl0ZW1zID8gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLnV0aWxzLnVuaXEodmFsdWVzKSA6IHZhbHVlcztcbiAgICAgICAgICAgIHRoaXMubGVuZ3RoID0gdGhpcy5tb2RlbHMubGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy52YWx1ZU1hcHMgPSB7fTtcblxuICAgICAgICAgICAgZm9yIChrZXkgaW4gdGhpcy5tb2RlbHMpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tb2RlbHMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHRoaXMubW9kZWxzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudmFsdWVNYXBzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyKCdyZXNldCcsIHRoaXMsIG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX3ByZXBhcmVNb2RlbDogZnVuY3Rpb24gX3ByZXBhcmVNb2RlbCh2YWx1ZSwgb3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9LFxuXG4gICAgICAgIF92YWxpZGF0ZU1vZGVsczogZnVuY3Rpb24gX3ZhbGlkYXRlTW9kZWxzKG9wdGlvbnMpIHtcblxuICAgICAgICAgICAgdmFyIGVycm9ycyA9IFtdO1xuXG4gICAgICAgICAgICB2YXIgdmFsaWRhdG9yO1xuICAgICAgICAgICAgc3dpdGNoICh0aGlzLnNjaGVtYS50eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRhdG9yID0gZnVuY3Rpb24gaXNTdHJpbmcodmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3N0cmluZyc7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2ludGVnZXInOlxuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHlwZW9mIG4gPT09ICdudW1iZXInICYmIG4gJSAxID09PSAwO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IgPSBmdW5jdGlvbiBpc051bWJlcih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgdmFsID09PSAnbnVtYmVyJztcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2YWxpZGF0b3IpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGFzSW52YWxpZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHZhciBtb2RlbDtcbiAgICAgICAgICAgICAgICB2YXIga2V5O1xuXG4gICAgICAgICAgICAgICAgZm9yIChrZXkgaW4gdGhpcy5tb2RlbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWwgPSB0aGlzLm1vZGVsc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5tb2RlbHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAhdmFsaWRhdG9yKG1vZGVsKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFzSW52YWxpZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChoYXNJbnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgcnVsZTogJ3ZhbHVlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBpcyBpbnZhbGlkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYS50aXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBlcnJvcnM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcGx1Y2s6IGZ1bmN0aW9uIHBsdWNrKCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgU3VwcG9ydGVkJyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0QnlDaWQ6IGZ1bmN0aW9uIGdldEJ5Q2lkKCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgU3VwcG9ydGVkJyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdG9KU09OOiBmdW5jdGlvbiB0b0pTT04ob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWxzLmxlbmd0aCA+IDAgPyB0aGlzLm1vZGVscy5zbGljZSgpIDogdW5kZWYoKTtcbiAgICAgICAgfVxuICAgIH0sIHtcbiAgICAgICAgaXNTY2hlbWFDb2xsZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgaXNTY2hlbWFWYWx1ZUNvbGxlY3Rpb246IHRydWUsXG4gICAgICAgIHR5cGVMYWJlbDogJ1NjaGVtYVZhbHVlQ29sbGVjdGlvbidcbiAgICB9KTtcblxuICAgIFNjaGVtYVZhbHVlQ29sbGVjdGlvbi5leHRlbmQgPSBpbnRlcm5hbEV4dGVuZDtcblxuICAgIC8qKlxuICAgICAqIFNldmVyaXR5IExldmVsIGZvciBFcnJvcnNcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHZhciBlcnJvckxldmVscyA9IHtcbiAgICAgICAgJ2Vycm9yJzogMyxcbiAgICAgICAgJ3dhcm4nOiAyLFxuICAgICAgICAnaW5mbyc6IDFcbiAgICB9O1xuXG4gICAgdmFyIFZhbGlkYXRpb25FcnJvcnNDb2xsZWN0aW9uID0gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLkNvbGxlY3Rpb24uZXh0ZW5kKHtcbiAgICAgICAgY29uc3RydWN0b3I6IGZ1bmN0aW9uIFZhbGlkYXRpb25FcnJvcnNDb2xsZWN0aW9uKG1vZGVscywgb3B0aW9ucykge1xuICAgICAgICAgICAgX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLkNvbGxlY3Rpb24ucHJvdG90eXBlLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB0aGlzLm9uKCdhZGQnLCB0aGlzLmZpcmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5vbigncmVtb3ZlJywgdGhpcy5maXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMub24oJ2NoYW5nZScsIHRoaXMuZmlyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZmlyZUNoYW5nZTogZnVuY3Rpb24gZmlyZUNoYW5nZShhdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlOm1heExldmVsJyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgbWF4TGV2ZWw6IGZ1bmN0aW9uIG1heExldmVsKCkge1xuXG4gICAgICAgICAgICB2YXIga2V5LCBtb2RlbDtcblxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdFxuICAgICAgICAgICAgaWYgKHRoaXMubW9kZWxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgbGV2ZWxTdHJpbmcsXG4gICAgICAgICAgICAgICAgbGV2ZWwgPSAwO1xuXG4gICAgICAgICAgICBmb3IgKGtleSBpbiB0aGlzLm1vZGVscykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1vZGVscy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsID0gdGhpcy5tb2RlbHNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yTGV2ZWxzW21vZGVsLmdldCgnbGV2ZWwnKV0gPiBsZXZlbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWwgPSBlcnJvckxldmVsc1ttb2RlbC5nZXQoJ2xldmVsJyldO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWxTdHJpbmcgPSBtb2RlbC5nZXQoJ2xldmVsJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBsZXZlbFN0cmluZztcbiAgICAgICAgfSxcblxuICAgICAgICBkaXNwb3NlOiBmdW5jdGlvbiBkaXNwb3NlKCkge1xuICAgICAgICAgICAgdGhpcy5vZmYoKTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcignZGlzcG9zZScpO1xuICAgICAgICB9XG5cbiAgICB9KTtcblxuICAgIHZhciBWYWxpZGF0aW9uTW9kZWwgPSBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uTW9kZWwuZXh0ZW5kKHtcbiAgICAgICAgY29uc3RydWN0b3I6IGZ1bmN0aW9uIFZhbGlkYXRpb25Nb2RlbChhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uTW9kZWwucHJvdG90eXBlLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0RXJyb3I6IGZ1bmN0aW9uIHNldEVycm9yKGtleSwgZXJyb3JzKSB7XG4gICAgICAgICAgICB2YXIgcHJldmlvdXMgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICAgICAgaWYgKHByZXZpb3VzICYmIHByZXZpb3VzLmRpc3Bvc2UpIHtcbiAgICAgICAgICAgICAgICBwcmV2aW91cy5kaXNwb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnNldChrZXksIG5ldyBWYWxpZGF0aW9uRXJyb3JzQ29sbGVjdGlvbihlcnJvcnMpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgaW5oZXJpdGFuY2Ugc3R5bGUgU2NoZW1hIFwiZXh0ZW5kc1wiIGZ1bmN0aW9uYWxpdHlcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IHRhcmdldCAgICBTY2hlbWEgb2JqZWN0IHdoaWNoIGlzIGJlaW5nIGV4dGVuZGVkXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBleHRlbnNpb24gU2NoZW1hIHByb3BlcnRpZXMgdG8gYXBwbHkgdG8gdGFyZ2V0XG4gICAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgUmV0dXJucyB0aGUgbW9kaWZpZWQgdGFyZ2V0IHNjaGVtYVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gZXh0ZW5kU2NoZW1hKHRhcmdldCwgZXh0ZW5zaW9uKSB7XG4gICAgICAgIGZvciAodmFyIHByb3BlcnR5IGluIGV4dGVuc2lvbikge1xuICAgICAgICAgICAgLy8gRG9uJ3QgZXh0ZW5kIFwiaWRcIiBwcm9wZXJ0aWVzXG4gICAgICAgICAgICAvL2lmKGV4dGVuc2lvbi5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkgJiYgcHJvcGVydHkgIT0gJ2lkJykge1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbi5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcblxuICAgICAgICAgICAgICAgIHZhciBleHRlbnNpb25Qcm9wZXJ0eSA9IGV4dGVuc2lvbltwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgaWYgKGV4dGVuc2lvblByb3BlcnR5ICE9PSB1bmRlZigpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHRhcmdldFByb3BlcnR5ID0gdGFyZ2V0W3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBEb24ndCBwcm9jZXNzIGVxdWFsIG9iamVjdHNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFByb3BlcnR5ID09PSBleHRlbnNpb25Qcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGUgdGFyZ2V0IGRvZXMgbm90IGV4aXN0LCB0aGVuIGNvcHkgKGJ5IHJlZmVyZW5jZSkgdGhlIGV4dGVuc2lvbiBwcm9wZXJ0eSBkaXJlY3RseVxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0UHJvcGVydHkgPT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtwcm9wZXJ0eV0gPSBleHRlbnNpb25Qcm9wZXJ0eTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSB0YXJnZXQgZXhpc3RzIGFuZCBpcyBhbiBvYmplY3QsIHRoZW4gbWVyZ2UgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10udXRpbHMuaXNPYmplY3QodGFyZ2V0UHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0ZW5kU2NoZW1hKHRhcmdldFByb3BlcnR5LCBleHRlbnNpb25Qcm9wZXJ0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWNoZSBvYmplY3QgZm9yIFJlZ0V4cHNcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIHZhciByZWdleHMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIERhdGUucGFyc2Ugd2l0aCBwcm9ncmVzc2l2ZSBlbmhhbmNlbWVudCBmb3IgSVNPIDg2MDEgPGh0dHBzOi8vZ2l0aHViLmNvbS9jc25vdmVyL2pzLWlzbzg2MDE+XG4gICAgICogwqkgMjAxMSBDb2xpbiBTbm92ZXIgPGh0dHA6Ly96ZXRhZmxlZXQuY29tPlxuICAgICAqIFJlbGVhc2VkIHVuZGVyIE1JVCBsaWNlbnNlLlxuICAgICAqL1xuICAgIHZhciBudW1lcmljS2V5cyA9IFsxLCA0LCA1LCA2LCA3LCAxMCwgMTFdO1xuXG4gICAgZnVuY3Rpb24gRGF0ZVBhcnNlKGRhdGUpIHtcbiAgICAgICAgdmFyIHRpbWVzdGFtcCxcbiAgICAgICAgICAgIHN0cnVjdCxcbiAgICAgICAgICAgIG1pbnV0ZXNPZmZzZXQgPSAwO1xuXG4gICAgICAgIC8vIEVTNSDCpzE1LjkuNC4yIHN0YXRlcyB0aGF0IHRoZSBzdHJpbmcgc2hvdWxkIGF0dGVtcHQgdG8gYmUgcGFyc2VkIGFzIGEgRGF0ZSBUaW1lIFN0cmluZyBGb3JtYXQgc3RyaW5nXG4gICAgICAgIC8vIGJlZm9yZSBmYWxsaW5nIGJhY2sgdG8gYW55IGltcGxlbWVudGF0aW9uLXNwZWNpZmljIGRhdGUgcGFyc2luZywgc28gdGhhdOKAmXMgd2hhdCB3ZSBkbywgZXZlbiBpZiBuYXRpdmVcbiAgICAgICAgLy8gaW1wbGVtZW50YXRpb25zIGNvdWxkIGJlIGZhc3RlclxuICAgICAgICAvLyAgICAgICAgICAgICAgMSBZWVlZICAgICAgICAgICAgICAgIDIgTU0gICAgICAgMyBERCAgICAgICAgICAgNCBISCAgICA1IG1tICAgICAgIDYgc3MgICAgICAgIDcgbXNlYyAgICAgICAgOCBaIDkgwrEgICAgMTAgdHpISCAgICAxMSB0em1tXG4gICAgICAgIGlmIChzdHJ1Y3QgPSAvXihcXGR7NH18WytcXC1dXFxkezZ9KSg/Oi0oXFxkezJ9KSg/Oi0oXFxkezJ9KSk/KT8oPzpUKFxcZHsyfSk6KFxcZHsyfSkoPzo6KFxcZHsyfSkoPzpcXC4oXFxkezN9KSk/KT8oPzooWil8KFsrXFwtXSkoXFxkezJ9KSg/OjooXFxkezJ9KSk/KT8pPyQvLmV4ZWMoZGF0ZSkpIHtcbiAgICAgICAgICAgIC8vIGF2b2lkIE5hTiB0aW1lc3RhbXBzIGNhdXNlZCBieSDigJx1bmRlZigp4oCdIHZhbHVlcyBiZWluZyBwYXNzZWQgdG8gRGF0ZS5VVENcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBrOyBrID0gbnVtZXJpY0tleXNbaV07ICsraSkge1xuICAgICAgICAgICAgICAgIHN0cnVjdFtrXSA9ICtzdHJ1Y3Rba10gfHwgMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYWxsb3cgdW5kZWYoKSBkYXlzIGFuZCBtb250aHNcbiAgICAgICAgICAgIHN0cnVjdFsyXSA9ICgrc3RydWN0WzJdIHx8IDEpIC0gMTtcbiAgICAgICAgICAgIHN0cnVjdFszXSA9ICtzdHJ1Y3RbM10gfHwgMTtcblxuICAgICAgICAgICAgaWYgKHN0cnVjdFs4XSAhPT0gJ1onICYmIHN0cnVjdFs5XSAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIG1pbnV0ZXNPZmZzZXQgPSBzdHJ1Y3RbMTBdICogNjAgKyBzdHJ1Y3RbMTFdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHN0cnVjdFs5XSA9PT0gJysnKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pbnV0ZXNPZmZzZXQgPSAwIC0gbWludXRlc09mZnNldDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRpbWVzdGFtcCA9IERhdGUuVVRDKHN0cnVjdFsxXSwgc3RydWN0WzJdLCBzdHJ1Y3RbM10sIHN0cnVjdFs0XSwgc3RydWN0WzVdICsgbWludXRlc09mZnNldCwgc3RydWN0WzZdLCBzdHJ1Y3RbN10pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGltZXN0YW1wID0gRGF0ZS5wYXJzZSA/IERhdGUucGFyc2UoZGF0ZSkgOiBOYU47XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGltZXN0YW1wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFZhcmlvdXMgVmFsaWRhdG9yc1xuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgdmFyIFZhbGlkYXRvcnMgPSB7XG4gICAgICAgIHJlcXVpcmVkOiBmdW5jdGlvbiByZXF1aXJlZCh2YWx1ZSwgX3JlcXVpcmVkKSB7XG4gICAgICAgICAgICBfcmVxdWlyZWQgPSBfcmVxdWlyZWQgfHwgdHJ1ZTtcblxuICAgICAgICAgICAgaWYgKF9yZXF1aXJlZCAmJiAodmFsdWUgPT09IHVuZGVmKCkgfHwgdmFsdWUgPT09ICcnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheSAmJiB2YWx1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIG1pbkxlbmd0aDogZnVuY3Rpb24gbWluTGVuZ3RoKHZhbHVlLCBfbWluTGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmKCkgfHwgdmFsdWUubGVuZ3RoIDwgX21pbkxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgbWF4TGVuZ3RoOiBmdW5jdGlvbiBtYXhMZW5ndGgodmFsdWUsIF9tYXhMZW5ndGgpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS5sZW5ndGggPiBfbWF4TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBtaW5pbXVtOiBmdW5jdGlvbiBtaW5pbXVtKHZhbHVlLCBfbWluaW11bSwgZXhjbHVzaXZlTWluaW11bSkge1xuICAgICAgICAgICAgaWYgKGlzTmFOKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBleGNsdXNpdmVNaW5pbXVtID09PSB0cnVlID8gcGFyc2VJbnQodmFsdWUsIDEwKSA+IF9taW5pbXVtIDogcGFyc2VJbnQodmFsdWUsIDEwKSA+PSBfbWluaW11bTtcbiAgICAgICAgfSxcblxuICAgICAgICBtYXhpbXVtOiBmdW5jdGlvbiBtYXhpbXVtKHZhbHVlLCBfbWF4aW11bSwgZXhjbHVzaXZlTWF4aW11bSkge1xuICAgICAgICAgICAgaWYgKGlzTmFOKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBleGNsdXNpdmVNYXhpbXVtID09PSB0cnVlID8gcGFyc2VJbnQodmFsdWUsIDEwKSA8IF9tYXhpbXVtIDogcGFyc2VJbnQodmFsdWUsIDEwKSA8PSBfbWF4aW11bTtcbiAgICAgICAgfSxcblxuICAgICAgICBkaXZpc2libGVCeTogZnVuY3Rpb24gZGl2aXNpYmxlQnkodmFsdWUsIF9kaXZpc2libGVCeSkge1xuICAgICAgICAgICAgaWYgKGlzTmFOKHZhbHVlKSB8fCBfZGl2aXNpYmxlQnkgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUgJSBfZGl2aXNpYmxlQnkgPT09IDA7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZm9ybWF0OiBmdW5jdGlvbiBmb3JtYXQodmFsdWUsIF9mb3JtYXQpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoX2Zvcm1hdCkge1xuXG4gICAgICAgICAgICAgICAgY2FzZSAnY29sb3InOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXR0ZXJuKHZhbHVlLCBcIl4jW0EtRjAtOV17Nn18YWxpY2VibHVlfGFudGlxdWV3aGl0ZXxhcXVhfGFxdWFtYXJpbmV8YXp1cmV8YmVpZ2V8YmlzcXVlfGJsYWNrfGJsYW5jaGVkYWxtb25kfGJsdWV8Ymx1ZXZpb2xldHxicm93bnxidXJseXdvb2R8Y2FkZXRibHVlfGNoYXJ0cmV1c2V8Y2hvY29sYXRlfGNvcmFsfGNvcm5mbG93ZXJibHVlfGNvcm5zaWxrfGNyaW1zb258Y3lhbnxkYXJrYmx1ZXxkYXJrY3lhbnxkYXJrZ29sZGVucm9kfGRhcmtncmF5fGRhcmtncmVlbnxkYXJra2hha2l8ZGFya21hZ2VudGF8ZGFya29saXZlZ3JlZW58ZGFya29yYW5nZXxkYXJrb3JjaGlkfGRhcmtyZWR8ZGFya3NhbG1vbnxkYXJrc2VhZ3JlZW58ZGFya3NsYXRlYmx1ZXxkYXJrc2xhdGVncmF5fGRhcmt0dXJxdW9pc2V8ZGFya3Zpb2xldHxkZWVwcGlua3xkZWVwc2t5Ymx1ZXxkaW1ncmF5fGRvZGdlcmJsdWV8ZmlyZWJyaWNrfGZsb3JhbHdoaXRlfGZvcmVzdGdyZWVufGZ1Y2hzaWF8Z2FpbnNib3JvfGdob3N0d2hpdGV8Z29sZHxnb2xkZW5yb2R8Z3JheXxncmVlbnxncmVlbnllbGxvd3xob25leWRld3xob3RwaW5rfGluZGlhbnJlZCB8aW5kaWdvIHxpdm9yeXxraGFraXxsYXZlbmRlcnxsYXZlbmRlcmJsdXNofGxhd25ncmVlbnxsZW1vbmNoaWZmb258bGlnaHRibHVlfGxpZ2h0Y29yYWx8bGlnaHRjeWFufGxpZ2h0Z29sZGVucm9keWVsbG93fGxpZ2h0Z3JleXxsaWdodGdyZWVufGxpZ2h0cGlua3xsaWdodHNhbG1vbnxsaWdodHNlYWdyZWVufGxpZ2h0c2t5Ymx1ZXxsaWdodHNsYXRlZ3JheXxsaWdodHN0ZWVsYmx1ZXxsaWdodHllbGxvd3xsaW1lfGxpbWVncmVlbnxsaW5lbnxtYWdlbnRhfG1hcm9vbnxtZWRpdW1hcXVhbWFyaW5lfG1lZGl1bWJsdWV8bWVkaXVtb3JjaGlkfG1lZGl1bXB1cnBsZXxtZWRpdW1zZWFncmVlbnxtZWRpdW1zbGF0ZWJsdWV8bWVkaXVtc3ByaW5nZ3JlZW58bWVkaXVtdHVycXVvaXNlfG1lZGl1bXZpb2xldHJlZHxtaWRuaWdodGJsdWV8bWludGNyZWFtfG1pc3R5cm9zZXxtb2NjYXNpbnxuYXZham93aGl0ZXxuYXZ5fG9sZGxhY2V8b2xpdmV8b2xpdmVkcmFifG9yYW5nZXxvcmFuZ2VyZWR8b3JjaGlkfHBhbGVnb2xkZW5yb2R8cGFsZWdyZWVufHBhbGV0dXJxdW9pc2V8cGFsZXZpb2xldHJlZHxwYXBheWF3aGlwfHBlYWNocHVmZnxwZXJ1fHBpbmt8cGx1bXxwb3dkZXJibHVlfHB1cnBsZXxyZWR8cm9zeWJyb3dufHJveWFsYmx1ZXxzYWRkbGVicm93bnxzYWxtb258c2FuZHlicm93bnxzZWFncmVlbnxzZWFzaGVsbHxzaWVubmF8c2lsdmVyfHNreWJsdWV8c2xhdGVibHVlfHNsYXRlZ3JheXxzbm93fHNwcmluZ2dyZWVufHN0ZWVsYmx1ZXx0YW58dGVhbHx0aGlzdGxlfHRvbWF0b3x0dXJxdW9pc2V8dmlvbGV0fHdoZWF0fHdoaXRlfHdoaXRlc21va2V8eWVsbG93fHllbGxvd2dyZWVuJFwiKTtcblxuICAgICAgICAgICAgICAgIGNhc2UgJ3N0eWxlJzpcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdwaG9uZSc6XG4gICAgICAgICAgICAgICAgICAgIC8vIGZyb20gaHR0cDovL2Jsb2cuc3RldmVubGV2aXRoYW4uY29tL2FyY2hpdmVzL3ZhbGlkYXRlLXBob25lLW51bWJlclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXR0ZXJuKHZhbHVlLCBcIl5cXFxcKyg/OlswLTldXFxcXHgyMD8pezYsMTR9WzAtOV0kXCIpO1xuXG4gICAgICAgICAgICAgICAgY2FzZSAndXJpJzpcbiAgICAgICAgICAgICAgICAgICAgLy8gZnJvbSBodHRwOi8vc25pcHBsci5jb20vdmlldy82ODg5L1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXR0ZXJuKHZhbHVlLCBcIl4oPzpodHRwcz98ZnRwKTovLy4rXFxcXC4uKyRcIik7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdlbWFpbCc6XG4gICAgICAgICAgICAgICAgICAgIC8vIGZyb20gaHR0cDovL2ZpZ2h0aW5nZm9yYWxvc3RjYXVzZS5uZXQvbWlzYy8yMDA2L2NvbXBhcmUtZW1haWwtcmVnZXgucGhwXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdHRlcm4odmFsdWUsICdeWy1hLXowLTl+ISQlXiYqXz0rfXtcXCc/XSsoXFxcXC5bLWEtejAtOX4hJCVeJipfPSt9e1xcJz9dKykqQChbYS16MC05X11bLWEtejAtOV9dKihcXFxcLlstYS16MC05X10rKSpcXFxcLihhZXJvfGFycGF8Yml6fGNvbXxjb29wfGVkdXxnb3Z8aW5mb3xpbnR8bWlsfG11c2V1bXxuYW1lfG5ldHxvcmd8cHJvfHRyYXZlbHxtb2JpfFthLXpdW2Etel0pfChbMC05XXsxLDN9XFxcXC5bMC05XXsxLDN9XFxcXC5bMC05XXsxLDN9XFxcXC5bMC05XXsxLDN9KSkoOlswLTldezEsNX0pPyQnKTtcblxuICAgICAgICAgICAgICAgIGNhc2UgJ2lwLWFkZHJlc3MnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXR0ZXJuKHZhbHVlLCBcIlxcXFxkezEsM31cXFxcLlxcXFxkezEsM31cXFxcLlxcXFxkezEsM31cXFxcLlxcXFxkezEsM31cIik7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdpcHY2JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0dGVybih2YWx1ZSwgXCJcXFxcZHsxLDN9XFxcXC5cXFxcZHsxLDN9XFxcXC5cXFxcZHsxLDN9XFxcXC5cXFxcZHsxLDN9XCIpO1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ET1xuICAgICAgICAgICAgICAgIC8vIGNhc2UgKnZhcmlvdXMgbWltZS10eXBlcypcbiAgICAgICAgICAgICAgICBjYXNlICdkYXRlLXRpbWUnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ3RpbWUnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ3V0Yy1taWxsaXNlYyc6XG4gICAgICAgICAgICAgICAgY2FzZSAncmVnZXgnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ3N0cmVldC1hZGRyZXNzJzpcbiAgICAgICAgICAgICAgICBjYXNlICdsb2NhbGl0eSc6XG4gICAgICAgICAgICAgICAgY2FzZSAncmVnaW9uJzpcbiAgICAgICAgICAgICAgICBjYXNlICdwb3N0YWwtY29kZSc6XG4gICAgICAgICAgICAgICAgY2FzZSAnY291bnRyeSc6XG4gICAgICAgICAgICAgICAgICAgIGxvZygnV0FSTklORyAtIFZhbGlkYXRpb24gbm90IGltcGxlbWVudGVkIGZvciBmb3JtYXQ6JyArIF9mb3JtYXQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGxvZygnV0FSTklORyAtIFVua25vd24gdmFsaWRhdGlvbiBmb3JtYXQ6JyArIF9mb3JtYXQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBwYXR0ZXJuOiBmdW5jdGlvbiBwYXR0ZXJuKHZhbHVlLCBfcGF0dGVybikge1xuICAgICAgICAgICAgdmFyIHJlZ2V4ID0gcmVnZXhzW19wYXR0ZXJuXTtcblxuICAgICAgICAgICAgaWYgKHJlZ2V4ID09PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKF9wYXR0ZXJuLCBcImlcIik7XG4gICAgICAgICAgICAgICAgcmVnZXhzW19wYXR0ZXJuXSA9IHJlZ2V4O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVnZXgudGVzdCh2YWx1ZSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgbWluSXRlbXM6IGZ1bmN0aW9uIG1pbkl0ZW1zKGl0ZW1zLCBfbWluSXRlbXMpIHtcbiAgICAgICAgICAgIHJldHVybiBpdGVtcy5sZW5ndGggPj0gX21pbkl0ZW1zO1xuICAgICAgICB9LFxuXG4gICAgICAgIG1heEl0ZW1zOiBmdW5jdGlvbiBtYXhJdGVtcyhpdGVtcywgX21heEl0ZW1zKSB7XG4gICAgICAgICAgICByZXR1cm4gaXRlbXMubGVuZ3RoIDw9IF9tYXhJdGVtcztcbiAgICAgICAgfSxcblxuICAgICAgICB1bmlxdWVJdGVtczogZnVuY3Rpb24gdW5pcXVlSXRlbXMoaXRlbXMsIHRyYW5zZm9ybSkge1xuICAgICAgICAgICAgaWYgKHRyYW5zZm9ybSA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIHRyYW5zZm9ybSA9IGZ1bmN0aW9uIChhKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgdW5pcXVlSXRlbXMgPSB7fTtcbiAgICAgICAgICAgIHZhciBoYXNVbmlxdWVJdGVtcyA9IHRydWU7XG4gICAgICAgICAgICB2YXIga2V5LCB2YWx1ZSwgaWQ7XG5cbiAgICAgICAgICAgIGZvciAoa2V5IGluIGl0ZW1zKSB7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZW1zLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBpdGVtc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZCA9IHRyYW5zZm9ybSh2YWx1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHVuaXF1ZUl0ZW1zW2lkXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFzVW5pcXVlSXRlbXMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHVuaXF1ZUl0ZW1zW2lkXSA9IGlkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGhhc1VuaXF1ZUl0ZW1zO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBvdGhlcndpc2UgcHJpdmF0ZSBvYmplY3RzLiBVc2VkIGZyb20gdGVzdHNcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIFNjaGVtYS5UZXN0SGVscGVyID0ge1xuICAgICAgICBWYWxpZGF0b3JzOiBWYWxpZGF0b3JzLFxuICAgICAgICBKU09OUG9pbnRlcjogSlNPTlBvaW50ZXJcbiAgICB9O1xuXG4gICAgcmV0dXJuIFNjaGVtYTtcbn0pLmNhbGwodW5kZWZpbmVkKTtcblxuX2hlbHBlcnNFbnZpcm9ubWVudC5nZXRHbG9iYWxPYmplY3QoKS5Gb3JtZWxsU2NoZW1hID0gRm9ybWVsbFNjaGVtYTtcbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IEZvcm1lbGxTY2hlbWE7XG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbJ2RlZmF1bHQnXTsiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5leHBvcnRzLmdldEdsb2JhbE9iamVjdCA9IGdldEdsb2JhbE9iamVjdDtcblxuZnVuY3Rpb24gZ2V0R2xvYmFsT2JqZWN0KCkge1xuXHQvLyBXb3JrZXJzIGRvbu+/vXQgaGF2ZSBgd2luZG93YCwgb25seSBgc2VsZmBcblx0aWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuXHRcdHJldHVybiBzZWxmO1xuXHR9XG5cdGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuXHRcdHJldHVybiBnbG9iYWw7XG5cdH1cblx0Ly8gTm90IGFsbCBlbnZpcm9ubWVudHMgYWxsb3cgZXZhbCBhbmQgRnVuY3Rpb25cblx0Ly8gVXNlIG9ubHkgYXMgYSBsYXN0IHJlc29ydDpcblx0cmV0dXJuIG5ldyBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xufSIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHMubmFtZSA9IG5hbWU7XG5leHBvcnRzLnRhZ05hbWUgPSB0YWdOYW1lO1xuZXhwb3J0cy5lbCA9IGVsO1xuZXhwb3J0cy4kZWwgPSAkZWw7XG5leHBvcnRzLmlkID0gaWQ7XG5leHBvcnRzLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbmV4cG9ydHMuZXZlbnRzID0gZXZlbnRzO1xuZXhwb3J0cy5vbiA9IG9uO1xuZXhwb3J0cy50ZW1wbGF0ZSA9IHRlbXBsYXRlO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyAnZGVmYXVsdCc6IG9iaiB9OyB9XG5cbnZhciBfZXhvc2tlbGV0b24gPSByZXF1aXJlKCdleG9za2VsZXRvbicpO1xuXG52YXIgX2V4b3NrZWxldG9uMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2V4b3NrZWxldG9uKTtcblxudmFyIF9iYWNrYm9uZU5hdGl2ZXZpZXcgPSByZXF1aXJlKCdiYWNrYm9uZS5uYXRpdmV2aWV3Jyk7XG5cbnZhciBfYmFja2JvbmVOYXRpdmV2aWV3MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2JhY2tib25lTmF0aXZldmlldyk7XG5cbnZhciBfYmFja2JvbmVOYXRpdmVhamF4ID0gcmVxdWlyZSgnYmFja2JvbmUubmF0aXZlYWpheCcpO1xuXG52YXIgX2JhY2tib25lTmF0aXZlYWpheDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9iYWNrYm9uZU5hdGl2ZWFqYXgpO1xuXG52YXIgX3N0cmluZyA9IHJlcXVpcmUoJy4vc3RyaW5nJyk7XG5cbl9leG9za2VsZXRvbjJbJ2RlZmF1bHQnXS5WaWV3ID0gX2JhY2tib25lTmF0aXZldmlldzJbJ2RlZmF1bHQnXTtcbl9leG9za2VsZXRvbjJbJ2RlZmF1bHQnXS5WaWV3LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xuXHRyZXR1cm4gdGhpcy5uYW1lO1xufTtcbl9leG9za2VsZXRvbjJbJ2RlZmF1bHQnXS5hamF4ID0gX2JhY2tib25lTmF0aXZlYWpheDJbJ2RlZmF1bHQnXTtcblxuX2V4b3NrZWxldG9uMlsnZGVmYXVsdCddLnV0aWxzLmlzT2JqZWN0ID0gZnVuY3Rpb24gKG9iaikge1xuXHR2YXIgdHlwZSA9IHR5cGVvZiBvYmo7XG5cdHJldHVybiB0eXBlID09PSAnZnVuY3Rpb24nIHx8IHR5cGUgPT09ICdvYmplY3QnICYmICEhb2JqO1xufTtcblxuX2V4b3NrZWxldG9uMlsnZGVmYXVsdCddLnV0aWxzLnVuaXEgPSBmdW5jdGlvbiAoYXJyKSB7XG5cblx0aWYgKCFhcnIpIHtcblx0XHRhcnIgPSBbXTtcblx0fSBlbHNlIHtcblx0XHRhcnIgPSBhcnIuZmlsdGVyKGZ1bmN0aW9uIChpdGVtLCBpbmRleCkge1xuXHRcdFx0cmV0dXJuIGFyci5pbmRleE9mKGl0ZW0pID09IGluZGV4O1xuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIGFycjtcbn07XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IF9leG9za2VsZXRvbjJbJ2RlZmF1bHQnXTtcblxuLy9kZWNvcmF0b3JzXG5cbmZ1bmN0aW9uIG5hbWUodmFsdWUpIHtcblx0cmV0dXJuIGZ1bmN0aW9uIGRlY29yYXRvcih0YXJnZXQpIHtcblx0XHR0YXJnZXQucHJvdG90eXBlLm5hbWUgPSB2YWx1ZTtcblx0fTtcbn1cblxuZnVuY3Rpb24gdGFnTmFtZSh2YWx1ZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gZGVjb3JhdG9yKHRhcmdldCkge1xuXHRcdHRhcmdldC5wcm90b3R5cGUudGFnTmFtZSA9IHZhbHVlO1xuXHR9O1xufVxuXG5mdW5jdGlvbiBlbCh2YWx1ZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gZGVjb3JhdG9yKHRhcmdldCkge1xuXHRcdHRhcmdldC5wcm90b3R5cGUuZWwgPSB2YWx1ZTtcblx0fTtcbn1cblxuZnVuY3Rpb24gJGVsKHZhbHVlKSB7XG5cdHJldHVybiBmdW5jdGlvbiBkZWNvcmF0b3IodGFyZ2V0KSB7XG5cdFx0dGFyZ2V0LnByb3RvdHlwZS4kZWwgPSB2YWx1ZTtcblx0fTtcbn1cblxuZnVuY3Rpb24gaWQodmFsdWUpIHtcblx0cmV0dXJuIGZ1bmN0aW9uIGRlY29yYXRvcih0YXJnZXQpIHtcblx0XHR0YXJnZXQucHJvdG90eXBlLmlkID0gdmFsdWU7XG5cdH07XG59XG5cbmZ1bmN0aW9uIGNsYXNzTmFtZSh2YWx1ZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gZGVjb3JhdG9yKHRhcmdldCkge1xuXHRcdHRhcmdldC5wcm90b3R5cGUuY2xhc3NOYW1lID0gdmFsdWU7XG5cdH07XG59XG5cbmZ1bmN0aW9uIGV2ZW50cyh2YWx1ZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gZGVjb3JhdG9yKHRhcmdldCkge1xuXHRcdHRhcmdldC5wcm90b3R5cGUuZXZlbnRzID0gdmFsdWU7XG5cdH07XG59XG5cbmZ1bmN0aW9uIG9uKGV2ZW50TmFtZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwgbmFtZSwgZGVzY3JpcHRvcikge1xuXHRcdGlmICghdGFyZ2V0LmV2ZW50cykge1xuXHRcdFx0dGFyZ2V0LmV2ZW50cyA9IHt9O1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIHRhcmdldC5ldmVudHMgPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdUaGUgb24gZGVjb3JhdG9yIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggYW4gZXZlbnRzIG1ldGhvZCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIWV2ZW50TmFtZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdUaGUgb24gZGVjb3JhdG9yIHJlcXVpcmVzIGFuIGV2ZW50TmFtZSBhcmd1bWVudCcpO1xuXHRcdH1cblx0XHR0YXJnZXQuZXZlbnRzW2V2ZW50TmFtZV0gPSBuYW1lO1xuXHRcdHJldHVybiBkZXNjcmlwdG9yO1xuXHR9O1xufVxuXG5mdW5jdGlvbiB0ZW1wbGF0ZSh2YWx1ZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gZGVjb3JhdG9yKHRhcmdldCkge1xuXHRcdHRhcmdldC5wcm90b3R5cGUudGVtcGxhdGUgPSBfc3RyaW5nLmdlbmVyYXRlVGVtcGxhdGVTdHJpbmcodmFsdWUpO1xuXHR9O1xufSIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHMuY3JlYXRlVUlEID0gY3JlYXRlVUlEO1xuXG5mdW5jdGlvbiBjcmVhdGVVSUQoKSB7XG5cdHJldHVybiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uIChjKSB7XG5cdFx0dmFyIHIgPSBNYXRoLnJhbmRvbSgpICogMTYgfCAwLFxuXHRcdCAgICB2ID0gYyA9PSAneCcgPyByIDogciAmIDB4MyB8IDB4ODtcblx0XHRyZXR1cm4gdi50b1N0cmluZygxNik7XG5cdH0pO1xufVxuXG52YXIgZ2VuZXJhdGVUZW1wbGF0ZVN0cmluZyA9IChmdW5jdGlvbiAoKSB7XG5cdHZhciBjYWNoZSA9IHt9O1xuXG5cdGZ1bmN0aW9uIGdlbmVyYXRlVGVtcGxhdGUodGVtcGxhdGUpIHtcblxuXHRcdHZhciBmbiA9IGNhY2hlW3RlbXBsYXRlXTtcblxuXHRcdGlmICghZm4pIHtcblxuXHRcdFx0Ly8gUmVwbGFjZSAke2V4cHJlc3Npb25zfSAoZXRjKSB3aXRoICR7bWFwLmV4cHJlc3Npb25zfS5cblx0XHRcdHZhciBzYW5pdGl6ZWQgPSB0ZW1wbGF0ZS5yZXBsYWNlKC9cXCRcXHsoW1xcc10qW147XFxzXStbXFxzXSopXFx9L2csIGZ1bmN0aW9uIChfLCBtYXRjaCkge1xuXHRcdFx0XHRyZXR1cm4gJyR7bWFwLicgKyBtYXRjaC50cmltKCkgKyAnfSc7XG5cdFx0XHR9KVxuXHRcdFx0Ly8gQWZ0ZXJ3YXJkcywgcmVwbGFjZSBhbnl0aGluZyB0aGF0J3Mgbm90ICR7bWFwLmV4cHJlc3Npb25zfScgKGV0Yykgd2l0aCBhIGJsYW5rIHN0cmluZy5cblx0XHRcdC5yZXBsYWNlKC8oXFwkXFx7KD8hbWFwXFwuKVtefV0rXFx9KS9nLCAnJyk7XG5cblx0XHRcdGZuID0gRnVuY3Rpb24oJ21hcCcsICdyZXR1cm4gYCcgKyBzYW5pdGl6ZWQgKyAnYCcpO1xuXHRcdH1cblxuXHRcdHJldHVybiBmbjtcblx0fTtcblxuXHRyZXR1cm4gZ2VuZXJhdGVUZW1wbGF0ZTtcbn0pKCk7XG5leHBvcnRzLmdlbmVyYXRlVGVtcGxhdGVTdHJpbmcgPSBnZW5lcmF0ZVRlbXBsYXRlU3RyaW5nOyIsIi8qKlxyXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAgTWF4aW0gVmFzaWxpZXZcclxuICpcclxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcclxuICogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuICpcclxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cclxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcbiAqXHJcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXHJcbiAqIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXHJcbiAqIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cclxuICogVEhFIFNPRlRXQVJFLlxyXG4gKlxyXG4gKiBAYXV0aG9yIE1heGltIFZhc2lsaWV2XHJcbiAqIERhdGU6IDA5LjA5LjIwMTBcclxuICogVGltZTogMTk6MDI6MzNcclxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG5cdGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcblx0XHQvLyBOb2RlSlNcblx0XHRtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcblx0fSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcblx0XHQvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG5cdFx0ZGVmaW5lKGZhY3RvcnkpO1xuXHR9IGVsc2Uge1xuXHRcdC8vIEJyb3dzZXIgZ2xvYmFsc1xuXHRcdHJvb3QuZm9ybTJqcyA9IGZhY3RvcnkoKTtcblx0fVxufSkodW5kZWZpbmVkLCBmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdC8qKlxyXG4gICogUmV0dXJucyBmb3JtIHZhbHVlcyByZXByZXNlbnRlZCBhcyBKYXZhc2NyaXB0IG9iamVjdFxyXG4gICogXCJuYW1lXCIgYXR0cmlidXRlIGRlZmluZXMgc3RydWN0dXJlIG9mIHJlc3VsdGluZyBvYmplY3RcclxuICAqXHJcbiAgKiBAcGFyYW0gcm9vdE5vZGUge0VsZW1lbnR8U3RyaW5nfSByb290IGZvcm0gZWxlbWVudCAob3IgaXQncyBpZCkgb3IgYXJyYXkgb2Ygcm9vdCBlbGVtZW50c1xyXG4gICogQHBhcmFtIGRlbGltaXRlciB7U3RyaW5nfSBzdHJ1Y3R1cmUgcGFydHMgZGVsaW1pdGVyIGRlZmF1bHRzIHRvICcuJ1xyXG4gICogQHBhcmFtIHNraXBFbXB0eSB7Qm9vbGVhbn0gc2hvdWxkIHNraXAgZW1wdHkgdGV4dCB2YWx1ZXMsIGRlZmF1bHRzIHRvIHRydWVcclxuICAqIEBwYXJhbSBub2RlQ2FsbGJhY2sge0Z1bmN0aW9ufSBjdXN0b20gZnVuY3Rpb24gdG8gZ2V0IG5vZGUgdmFsdWVcclxuICAqIEBwYXJhbSB1c2VJZElmRW1wdHlOYW1lIHtCb29sZWFufSBpZiB0cnVlIHZhbHVlIG9mIGlkIGF0dHJpYnV0ZSBvZiBmaWVsZCB3aWxsIGJlIHVzZWQgaWYgbmFtZSBvZiBmaWVsZCBpcyBlbXB0eVxyXG4gICovXG5cdGZ1bmN0aW9uIGZvcm0yanMocm9vdE5vZGUsIGRlbGltaXRlciwgc2tpcEVtcHR5LCBub2RlQ2FsbGJhY2ssIHVzZUlkSWZFbXB0eU5hbWUsIGdldERpc2FibGVkKSB7XG5cdFx0Z2V0RGlzYWJsZWQgPSBnZXREaXNhYmxlZCA/IHRydWUgOiBmYWxzZTtcblx0XHRpZiAodHlwZW9mIHNraXBFbXB0eSA9PSAndW5kZWZpbmVkJyB8fCBza2lwRW1wdHkgPT0gbnVsbCkgc2tpcEVtcHR5ID0gdHJ1ZTtcblx0XHRpZiAodHlwZW9mIGRlbGltaXRlciA9PSAndW5kZWZpbmVkJyB8fCBkZWxpbWl0ZXIgPT0gbnVsbCkgZGVsaW1pdGVyID0gJy4nO1xuXHRcdGlmIChhcmd1bWVudHMubGVuZ3RoIDwgNSkgdXNlSWRJZkVtcHR5TmFtZSA9IGZhbHNlO1xuXG5cdFx0cm9vdE5vZGUgPSB0eXBlb2Ygcm9vdE5vZGUgPT0gJ3N0cmluZycgPyBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChyb290Tm9kZSkgOiByb290Tm9kZTtcblxuXHRcdHZhciBmb3JtVmFsdWVzID0gW10sXG5cdFx0ICAgIGN1cnJOb2RlLFxuXHRcdCAgICBpID0gMDtcblxuXHRcdC8qIElmIHJvb3ROb2RlIGlzIGFycmF5IC0gY29tYmluZSB2YWx1ZXMgKi9cblx0XHRpZiAocm9vdE5vZGUuY29uc3RydWN0b3IgPT0gQXJyYXkgfHwgdHlwZW9mIE5vZGVMaXN0ICE9IFwidW5kZWZpbmVkXCIgJiYgcm9vdE5vZGUuY29uc3RydWN0b3IgPT0gTm9kZUxpc3QpIHtcblx0XHRcdHdoaWxlIChjdXJyTm9kZSA9IHJvb3ROb2RlW2krK10pIHtcblx0XHRcdFx0Zm9ybVZhbHVlcyA9IGZvcm1WYWx1ZXMuY29uY2F0KGdldEZvcm1WYWx1ZXMoY3Vyck5vZGUsIG5vZGVDYWxsYmFjaywgdXNlSWRJZkVtcHR5TmFtZSwgZ2V0RGlzYWJsZWQpKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9ybVZhbHVlcyA9IGdldEZvcm1WYWx1ZXMocm9vdE5vZGUsIG5vZGVDYWxsYmFjaywgdXNlSWRJZkVtcHR5TmFtZSwgZ2V0RGlzYWJsZWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBwcm9jZXNzTmFtZVZhbHVlcyhmb3JtVmFsdWVzLCBza2lwRW1wdHksIGRlbGltaXRlcik7XG5cdH1cblxuXHQvKipcclxuICAqIFByb2Nlc3NlcyBjb2xsZWN0aW9uIG9mIHsgbmFtZTogJ25hbWUnLCB2YWx1ZTogJ3ZhbHVlJyB9IG9iamVjdHMuXHJcbiAgKiBAcGFyYW0gbmFtZVZhbHVlc1xyXG4gICogQHBhcmFtIHNraXBFbXB0eSBpZiB0cnVlIHNraXBzIGVsZW1lbnRzIHdpdGggdmFsdWUgPT0gJycgb3IgdmFsdWUgPT0gbnVsbFxyXG4gICogQHBhcmFtIGRlbGltaXRlclxyXG4gICovXG5cdGZ1bmN0aW9uIHByb2Nlc3NOYW1lVmFsdWVzKG5hbWVWYWx1ZXMsIHNraXBFbXB0eSwgZGVsaW1pdGVyKSB7XG5cdFx0dmFyIHJlc3VsdCA9IHt9LFxuXHRcdCAgICBhcnJheXMgPSB7fSxcblx0XHQgICAgaSxcblx0XHQgICAgaixcblx0XHQgICAgayxcblx0XHQgICAgbCxcblx0XHQgICAgdmFsdWUsXG5cdFx0ICAgIG5hbWVQYXJ0cyxcblx0XHQgICAgY3VyclJlc3VsdCxcblx0XHQgICAgYXJyTmFtZUZ1bGwsXG5cdFx0ICAgIGFyck5hbWUsXG5cdFx0ICAgIGFycklkeCxcblx0XHQgICAgbmFtZVBhcnQsXG5cdFx0ICAgIG5hbWUsXG5cdFx0ICAgIF9uYW1lUGFydHM7XG5cblx0XHRmb3IgKGkgPSAwOyBpIDwgbmFtZVZhbHVlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFsdWUgPSBuYW1lVmFsdWVzW2ldLnZhbHVlO1xuXG5cdFx0XHRpZiAoc2tpcEVtcHR5ICYmICh2YWx1ZSA9PT0gJycgfHwgdmFsdWUgPT09IG51bGwpKSBjb250aW51ZTtcblxuXHRcdFx0bmFtZSA9IG5hbWVWYWx1ZXNbaV0ubmFtZTtcblx0XHRcdF9uYW1lUGFydHMgPSBuYW1lLnNwbGl0KGRlbGltaXRlcik7XG5cdFx0XHRuYW1lUGFydHMgPSBbXTtcblx0XHRcdGN1cnJSZXN1bHQgPSByZXN1bHQ7XG5cdFx0XHRhcnJOYW1lRnVsbCA9ICcnO1xuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgX25hbWVQYXJ0cy5sZW5ndGg7IGorKykge1xuXHRcdFx0XHRuYW1lUGFydCA9IF9uYW1lUGFydHNbal0uc3BsaXQoJ11bJyk7XG5cdFx0XHRcdGlmIChuYW1lUGFydC5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdFx0Zm9yIChrID0gMDsgayA8IG5hbWVQYXJ0Lmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdFx0XHRpZiAoayA9PSAwKSB7XG5cdFx0XHRcdFx0XHRcdG5hbWVQYXJ0W2tdID0gbmFtZVBhcnRba10gKyAnXSc7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGsgPT0gbmFtZVBhcnQubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0XHRuYW1lUGFydFtrXSA9ICdbJyArIG5hbWVQYXJ0W2tdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0bmFtZVBhcnRba10gPSAnWycgKyBuYW1lUGFydFtrXSArICddJztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0YXJySWR4ID0gbmFtZVBhcnRba10ubWF0Y2goLyhbYS16X10rKT9cXFsoW2Etel9dW2EtejAtOV9dKz8pXFxdL2kpO1xuXHRcdFx0XHRcdFx0aWYgKGFycklkeCkge1xuXHRcdFx0XHRcdFx0XHRmb3IgKGwgPSAxOyBsIDwgYXJySWR4Lmxlbmd0aDsgbCsrKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGFycklkeFtsXSkgbmFtZVBhcnRzLnB1c2goYXJySWR4W2xdKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0bmFtZVBhcnRzLnB1c2gobmFtZVBhcnRba10pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIG5hbWVQYXJ0cyA9IG5hbWVQYXJ0cy5jb25jYXQobmFtZVBhcnQpO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgbmFtZVBhcnRzLmxlbmd0aDsgaisrKSB7XG5cdFx0XHRcdG5hbWVQYXJ0ID0gbmFtZVBhcnRzW2pdO1xuXG5cdFx0XHRcdGlmIChuYW1lUGFydC5pbmRleE9mKCdbXScpID4gLTEgJiYgaiA9PSBuYW1lUGFydHMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdGFyck5hbWUgPSBuYW1lUGFydC5zdWJzdHIoMCwgbmFtZVBhcnQuaW5kZXhPZignWycpKTtcblx0XHRcdFx0XHRhcnJOYW1lRnVsbCArPSBhcnJOYW1lO1xuXG5cdFx0XHRcdFx0aWYgKCFjdXJyUmVzdWx0W2Fyck5hbWVdKSBjdXJyUmVzdWx0W2Fyck5hbWVdID0gW107XG5cdFx0XHRcdFx0Y3VyclJlc3VsdFthcnJOYW1lXS5wdXNoKHZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChuYW1lUGFydC5pbmRleE9mKCdbJykgPiAtMSkge1xuXHRcdFx0XHRcdGFyck5hbWUgPSBuYW1lUGFydC5zdWJzdHIoMCwgbmFtZVBhcnQuaW5kZXhPZignWycpKTtcblx0XHRcdFx0XHRhcnJJZHggPSBuYW1lUGFydC5yZXBsYWNlKC8oXihbYS16X10rKT9cXFspfChcXF0kKS9naSwgJycpO1xuXG5cdFx0XHRcdFx0LyogVW5pcXVlIGFycmF5IG5hbWUgKi9cblx0XHRcdFx0XHRhcnJOYW1lRnVsbCArPSAnXycgKyBhcnJOYW1lICsgJ18nICsgYXJySWR4O1xuXG5cdFx0XHRcdFx0LypcclxuICAgICAgKiBCZWNhdXNlIGFycklkeCBpbiBmaWVsZCBuYW1lIGNhbiBiZSBub3QgemVyby1iYXNlZCBhbmQgc3RlcCBjYW4gYmVcclxuICAgICAgKiBvdGhlciB0aGFuIDEsIHdlIGNhbid0IHVzZSB0aGVtIGluIHRhcmdldCBhcnJheSBkaXJlY3RseS5cclxuICAgICAgKiBJbnN0ZWFkIHdlJ3JlIG1ha2luZyBhIGhhc2ggd2hlcmUga2V5IGlzIGFycklkeCBhbmQgdmFsdWUgaXMgYSByZWZlcmVuY2UgdG9cclxuICAgICAgKiBhZGRlZCBhcnJheSBlbGVtZW50XHJcbiAgICAgICovXG5cblx0XHRcdFx0XHRpZiAoIWFycmF5c1thcnJOYW1lRnVsbF0pIGFycmF5c1thcnJOYW1lRnVsbF0gPSB7fTtcblx0XHRcdFx0XHRpZiAoYXJyTmFtZSAhPSAnJyAmJiAhY3VyclJlc3VsdFthcnJOYW1lXSkgY3VyclJlc3VsdFthcnJOYW1lXSA9IFtdO1xuXG5cdFx0XHRcdFx0aWYgKGogPT0gbmFtZVBhcnRzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRcdGlmIChhcnJOYW1lID09ICcnKSB7XG5cdFx0XHRcdFx0XHRcdGN1cnJSZXN1bHQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdGFycmF5c1thcnJOYW1lRnVsbF1bYXJySWR4XSA9IGN1cnJSZXN1bHRbY3VyclJlc3VsdC5sZW5ndGggLSAxXTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGN1cnJSZXN1bHRbYXJyTmFtZV0ucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdGFycmF5c1thcnJOYW1lRnVsbF1bYXJySWR4XSA9IGN1cnJSZXN1bHRbYXJyTmFtZV1bY3VyclJlc3VsdFthcnJOYW1lXS5sZW5ndGggLSAxXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWYgKCFhcnJheXNbYXJyTmFtZUZ1bGxdW2FycklkeF0pIHtcblx0XHRcdFx0XHRcdFx0aWYgKC9eWzAtOWEtel9dK1xcWz8vaS50ZXN0KG5hbWVQYXJ0c1tqICsgMV0pKSBjdXJyUmVzdWx0W2Fyck5hbWVdLnB1c2goe30pO2Vsc2UgY3VyclJlc3VsdFthcnJOYW1lXS5wdXNoKFtdKTtcblxuXHRcdFx0XHRcdFx0XHRhcnJheXNbYXJyTmFtZUZ1bGxdW2FycklkeF0gPSBjdXJyUmVzdWx0W2Fyck5hbWVdW2N1cnJSZXN1bHRbYXJyTmFtZV0ubGVuZ3RoIC0gMV07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y3VyclJlc3VsdCA9IGFycmF5c1thcnJOYW1lRnVsbF1bYXJySWR4XTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhcnJOYW1lRnVsbCArPSBuYW1lUGFydDtcblxuXHRcdFx0XHRcdGlmIChqIDwgbmFtZVBhcnRzLmxlbmd0aCAtIDEpIC8qIE5vdCB0aGUgbGFzdCBwYXJ0IG9mIG5hbWUgLSBtZWFucyBvYmplY3QgKi9cblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aWYgKCFjdXJyUmVzdWx0W25hbWVQYXJ0XSkgY3VyclJlc3VsdFtuYW1lUGFydF0gPSB7fTtcblx0XHRcdFx0XHRcdFx0Y3VyclJlc3VsdCA9IGN1cnJSZXN1bHRbbmFtZVBhcnRdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGN1cnJSZXN1bHRbbmFtZVBhcnRdID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldEZvcm1WYWx1ZXMocm9vdE5vZGUsIG5vZGVDYWxsYmFjaywgdXNlSWRJZkVtcHR5TmFtZSwgZ2V0RGlzYWJsZWQpIHtcblx0XHR2YXIgcmVzdWx0ID0gZXh0cmFjdE5vZGVWYWx1ZXMocm9vdE5vZGUsIG5vZGVDYWxsYmFjaywgdXNlSWRJZkVtcHR5TmFtZSwgZ2V0RGlzYWJsZWQpO1xuXHRcdHJldHVybiByZXN1bHQubGVuZ3RoID4gMCA/IHJlc3VsdCA6IGdldFN1YkZvcm1WYWx1ZXMocm9vdE5vZGUsIG5vZGVDYWxsYmFjaywgdXNlSWRJZkVtcHR5TmFtZSwgZ2V0RGlzYWJsZWQpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0U3ViRm9ybVZhbHVlcyhyb290Tm9kZSwgbm9kZUNhbGxiYWNrLCB1c2VJZElmRW1wdHlOYW1lLCBnZXREaXNhYmxlZCkge1xuXHRcdHZhciByZXN1bHQgPSBbXSxcblx0XHQgICAgY3VycmVudE5vZGUgPSByb290Tm9kZS5maXJzdENoaWxkO1xuXG5cdFx0d2hpbGUgKGN1cnJlbnROb2RlKSB7XG5cdFx0XHRyZXN1bHQgPSByZXN1bHQuY29uY2F0KGV4dHJhY3ROb2RlVmFsdWVzKGN1cnJlbnROb2RlLCBub2RlQ2FsbGJhY2ssIHVzZUlkSWZFbXB0eU5hbWUsIGdldERpc2FibGVkKSk7XG5cdFx0XHRjdXJyZW50Tm9kZSA9IGN1cnJlbnROb2RlLm5leHRTaWJsaW5nO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRmdW5jdGlvbiBleHRyYWN0Tm9kZVZhbHVlcyhub2RlLCBub2RlQ2FsbGJhY2ssIHVzZUlkSWZFbXB0eU5hbWUsIGdldERpc2FibGVkKSB7XG5cdFx0aWYgKG5vZGUuZGlzYWJsZWQgJiYgIWdldERpc2FibGVkKSByZXR1cm4gW107XG5cblx0XHR2YXIgY2FsbGJhY2tSZXN1bHQsXG5cdFx0ICAgIGZpZWxkVmFsdWUsXG5cdFx0ICAgIHJlc3VsdCxcblx0XHQgICAgZmllbGROYW1lID0gZ2V0RmllbGROYW1lKG5vZGUsIHVzZUlkSWZFbXB0eU5hbWUpO1xuXG5cdFx0Y2FsbGJhY2tSZXN1bHQgPSBub2RlQ2FsbGJhY2sgJiYgbm9kZUNhbGxiYWNrKG5vZGUpO1xuXG5cdFx0aWYgKGNhbGxiYWNrUmVzdWx0ICYmIGNhbGxiYWNrUmVzdWx0Lm5hbWUpIHtcblx0XHRcdHJlc3VsdCA9IFtjYWxsYmFja1Jlc3VsdF07XG5cdFx0fSBlbHNlIGlmIChmaWVsZE5hbWUgIT0gJycgJiYgbm9kZS5ub2RlTmFtZS5tYXRjaCgvSU5QVVR8VEVYVEFSRUEvaSkpIHtcblx0XHRcdGZpZWxkVmFsdWUgPSBnZXRGaWVsZFZhbHVlKG5vZGUsIGdldERpc2FibGVkKTtcblx0XHRcdGlmIChudWxsID09PSBmaWVsZFZhbHVlKSB7XG5cdFx0XHRcdHJlc3VsdCA9IFtdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0ID0gW3sgbmFtZTogZmllbGROYW1lLCB2YWx1ZTogZmllbGRWYWx1ZSB9XTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGZpZWxkTmFtZSAhPSAnJyAmJiBub2RlLm5vZGVOYW1lLm1hdGNoKC9TRUxFQ1QvaSkpIHtcblx0XHRcdGZpZWxkVmFsdWUgPSBnZXRGaWVsZFZhbHVlKG5vZGUsIGdldERpc2FibGVkKTtcblx0XHRcdHJlc3VsdCA9IFt7IG5hbWU6IGZpZWxkTmFtZS5yZXBsYWNlKC9cXFtcXF0kLywgJycpLCB2YWx1ZTogZmllbGRWYWx1ZSB9XTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0ID0gZ2V0U3ViRm9ybVZhbHVlcyhub2RlLCBub2RlQ2FsbGJhY2ssIHVzZUlkSWZFbXB0eU5hbWUsIGdldERpc2FibGVkKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0RmllbGROYW1lKG5vZGUsIHVzZUlkSWZFbXB0eU5hbWUpIHtcblx0XHRpZiAobm9kZS5uYW1lICYmIG5vZGUubmFtZSAhPSAnJykgcmV0dXJuIG5vZGUubmFtZTtlbHNlIGlmICh1c2VJZElmRW1wdHlOYW1lICYmIG5vZGUuaWQgJiYgbm9kZS5pZCAhPSAnJykgcmV0dXJuIG5vZGUuaWQ7ZWxzZSByZXR1cm4gJyc7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRGaWVsZFZhbHVlKGZpZWxkTm9kZSwgZ2V0RGlzYWJsZWQpIHtcblx0XHRpZiAoZmllbGROb2RlLmRpc2FibGVkICYmICFnZXREaXNhYmxlZCkgcmV0dXJuIG51bGw7XG5cblx0XHRzd2l0Y2ggKGZpZWxkTm9kZS5ub2RlTmFtZSkge1xuXHRcdFx0Y2FzZSAnSU5QVVQnOlxuXHRcdFx0Y2FzZSAnVEVYVEFSRUEnOlxuXHRcdFx0XHRzd2l0Y2ggKGZpZWxkTm9kZS50eXBlLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdFx0XHRjYXNlICdyYWRpbyc6XG5cdFx0XHRcdFx0XHRpZiAoZmllbGROb2RlLmNoZWNrZWQgJiYgZmllbGROb2RlLnZhbHVlID09PSBcImZhbHNlXCIpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRjYXNlICdjaGVja2JveCc6XG5cdFx0XHRcdFx0XHRpZiAoZmllbGROb2RlLmNoZWNrZWQgJiYgZmllbGROb2RlLnZhbHVlID09PSBcInRydWVcIikgcmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0XHRpZiAoIWZpZWxkTm9kZS5jaGVja2VkICYmIGZpZWxkTm9kZS52YWx1ZSA9PT0gXCJ0cnVlXCIpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdGlmIChmaWVsZE5vZGUuY2hlY2tlZCkgcmV0dXJuIGZpZWxkTm9kZS52YWx1ZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdFx0Y2FzZSAnYnV0dG9uJzpcblx0XHRcdFx0XHRjYXNlICdyZXNldCc6XG5cdFx0XHRcdFx0Y2FzZSAnc3VibWl0Jzpcblx0XHRcdFx0XHRjYXNlICdpbWFnZSc6XG5cdFx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmllbGROb2RlLnZhbHVlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ1NFTEVDVCc6XG5cdFx0XHRcdHJldHVybiBnZXRTZWxlY3RlZE9wdGlvblZhbHVlKGZpZWxkTm9kZSk7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFNlbGVjdGVkT3B0aW9uVmFsdWUoc2VsZWN0Tm9kZSkge1xuXHRcdHZhciBtdWx0aXBsZSA9IHNlbGVjdE5vZGUubXVsdGlwbGUsXG5cdFx0ICAgIHJlc3VsdCA9IFtdLFxuXHRcdCAgICBvcHRpb25zLFxuXHRcdCAgICBpLFxuXHRcdCAgICBsO1xuXG5cdFx0aWYgKCFtdWx0aXBsZSkgcmV0dXJuIHNlbGVjdE5vZGUudmFsdWU7XG5cblx0XHRmb3IgKG9wdGlvbnMgPSBzZWxlY3ROb2RlLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwib3B0aW9uXCIpLCBpID0gMCwgbCA9IG9wdGlvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdFx0XHRpZiAob3B0aW9uc1tpXS5zZWxlY3RlZCkgcmVzdWx0LnB1c2gob3B0aW9uc1tpXS52YWx1ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHJldHVybiBmb3JtMmpzO1xufSk7IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuXG52YXIgX2NyZWF0ZURlY29yYXRlZENsYXNzID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIGRlc2NyaXB0b3JzLCBpbml0aWFsaXplcnMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBkZXNjcmlwdG9ycy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IGRlc2NyaXB0b3JzW2ldOyB2YXIgZGVjb3JhdG9ycyA9IGRlc2NyaXB0b3IuZGVjb3JhdG9yczsgdmFyIGtleSA9IGRlc2NyaXB0b3Iua2V5OyBkZWxldGUgZGVzY3JpcHRvci5rZXk7IGRlbGV0ZSBkZXNjcmlwdG9yLmRlY29yYXRvcnM7IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yIHx8IGRlc2NyaXB0b3IuaW5pdGlhbGl6ZXIpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBpZiAoZGVjb3JhdG9ycykgeyBmb3IgKHZhciBmID0gMDsgZiA8IGRlY29yYXRvcnMubGVuZ3RoOyBmKyspIHsgdmFyIGRlY29yYXRvciA9IGRlY29yYXRvcnNbZl07IGlmICh0eXBlb2YgZGVjb3JhdG9yID09PSAnZnVuY3Rpb24nKSB7IGRlc2NyaXB0b3IgPSBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpIHx8IGRlc2NyaXB0b3I7IH0gZWxzZSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBkZWNvcmF0b3IgZm9yIG1ldGhvZCAnICsgZGVzY3JpcHRvci5rZXkgKyAnIGlzIG9mIHRoZSBpbnZhbGlkIHR5cGUgJyArIHR5cGVvZiBkZWNvcmF0b3IpOyB9IH0gaWYgKGRlc2NyaXB0b3IuaW5pdGlhbGl6ZXIgIT09IHVuZGVmaW5lZCkgeyBpbml0aWFsaXplcnNba2V5XSA9IGRlc2NyaXB0b3I7IGNvbnRpbnVlOyB9IH0gT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzLCBwcm90b0luaXRpYWxpemVycywgc3RhdGljSW5pdGlhbGl6ZXJzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcywgcHJvdG9Jbml0aWFsaXplcnMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzLCBzdGF0aWNJbml0aWFsaXplcnMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0pKCk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbmZ1bmN0aW9uIF9pbmhlcml0cyhzdWJDbGFzcywgc3VwZXJDbGFzcykgeyBpZiAodHlwZW9mIHN1cGVyQ2xhc3MgIT09ICdmdW5jdGlvbicgJiYgc3VwZXJDbGFzcyAhPT0gbnVsbCkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90ICcgKyB0eXBlb2Ygc3VwZXJDbGFzcyk7IH0gc3ViQ2xhc3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7IGNvbnN0cnVjdG9yOiB7IHZhbHVlOiBzdWJDbGFzcywgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlLCBjb25maWd1cmFibGU6IHRydWUgfSB9KTsgaWYgKHN1cGVyQ2xhc3MpIE9iamVjdC5zZXRQcm90b3R5cGVPZiA/IE9iamVjdC5zZXRQcm90b3R5cGVPZihzdWJDbGFzcywgc3VwZXJDbGFzcykgOiBzdWJDbGFzcy5fX3Byb3RvX18gPSBzdXBlckNsYXNzOyB9XG5cbnZhciBfbGlic0hlbHBlcnNFeG9za2VsZXNzdG9uID0gcmVxdWlyZSgnLi4vLi4vbGlicy9oZWxwZXJzL2V4b3NrZWxlc3N0b24nKTtcblxudmFyIF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfbGlic0hlbHBlcnNFeG9za2VsZXNzdG9uKTtcblxudmFyIF9pdGVtc0Zvcm1TY2hlbWFJdGVtRmFjdG9yeSA9IHJlcXVpcmUoJy4vaXRlbXMvZm9ybS1zY2hlbWEtaXRlbS1mYWN0b3J5Jyk7XG5cbnZhciBfaXRlbXNGb3JtU2NoZW1hSXRlbUZhY3RvcnkyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaXRlbXNGb3JtU2NoZW1hSXRlbUZhY3RvcnkpO1xuXG52YXIgX2xpYnNWZW5kb3JGb3JtMmpzID0gcmVxdWlyZSgnLi4vLi4vbGlicy92ZW5kb3IvZm9ybTJqcycpO1xuXG52YXIgX2xpYnNWZW5kb3JGb3JtMmpzMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2xpYnNWZW5kb3JGb3JtMmpzKTtcblxudmFyIEZvcm1TY2hlbWFWaWV3ID0gKGZ1bmN0aW9uIChfRXhvc2tlbGV0b24kVmlldykge1xuXHRfaW5oZXJpdHMoRm9ybVNjaGVtYVZpZXcsIF9FeG9za2VsZXRvbiRWaWV3KTtcblxuXHRmdW5jdGlvbiBGb3JtU2NoZW1hVmlldygpIHtcblx0XHRfY2xhc3NDYWxsQ2hlY2sodGhpcywgX0Zvcm1TY2hlbWFWaWV3KTtcblxuXHRcdF9FeG9za2VsZXRvbiRWaWV3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdH1cblxuXHRGb3JtU2NoZW1hVmlldy5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uIGluaXRpYWxpemUoKSB7XG5cdFx0dmFyIG9wdGlvbnMgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1swXTtcblxuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdH07XG5cblx0Rm9ybVNjaGVtYVZpZXcucHJvdG90eXBlLmFkZFN1Ym1pdCA9IGZ1bmN0aW9uIGFkZFN1Ym1pdCgpIHtcblxuXHRcdGlmICghdGhpcy5lbC5xdWVyeVNlbGVjdG9yKCdbdHlwZT1cInN1Ym1pdFwiXScpKSB7XG5cblx0XHRcdHZhciBzdWJtaXRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblx0XHRcdHN1Ym1pdEJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAnc3VibWl0Jyk7XG5cdFx0XHQvLyBAdG9kbyBpMThuL2wxMG5cblx0XHRcdHN1Ym1pdEJ1dHRvbi5pbm5lckhUTUwgPSAnT0snO1xuXHRcdFx0dGhpcy5lbC5hcHBlbmRDaGlsZChzdWJtaXRCdXR0b24pO1xuXG5cdFx0XHR0aGlzLnVuZGVsZWdhdGVFdmVudHMoKTtcblx0XHRcdHRoaXMuZGVsZWdhdGVFdmVudHMoKTtcblx0XHR9XG5cdH07XG5cblx0Rm9ybVNjaGVtYVZpZXcucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uIHNlcmlhbGl6ZSgpIHt9O1xuXG5cdEZvcm1TY2hlbWFWaWV3LnByb3RvdHlwZS5hZGRPbmUgPSBmdW5jdGlvbiBhZGRPbmUobmFtZSwgcHJvcGVydHkpIHtcblx0XHR2YXIgSXRlbVZpZXcgPSBfaXRlbXNGb3JtU2NoZW1hSXRlbUZhY3RvcnkyWydkZWZhdWx0J10uY3JlYXRlKHByb3BlcnR5LnR5cGUpO1xuXHRcdHZhciB2aWV3ID0gbmV3IEl0ZW1WaWV3KHtcblx0XHRcdGRhdGE6IHtcblx0XHRcdFx0bmFtZTogbmFtZSxcblx0XHRcdFx0cHJvcGVydGllczogcHJvcGVydHlcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIEB0b2RvIGltcGxlbWVudCBhcHBlbmRDaGlsZCBpZiB3cmFwcGVyIGlzIHByZXNlbnRcblx0XHQvLyB3cmFwcGVyVmlldy5hcHBlbmRDaGlsZCguLi4pO1xuXHRcdHRoaXMuZWwuYXBwZW5kQ2hpbGQodmlldy5yZW5kZXIoKS5lbCk7XG5cdH07XG5cblx0Rm9ybVNjaGVtYVZpZXcucHJvdG90eXBlLmFkZEFsbCA9IGZ1bmN0aW9uIGFkZEFsbCgpIHtcblxuXHRcdHZhciBwcm9wZXJ0aWVzID0gdGhpcy5vcHRpb25zLmRhdGEucHJvcGVydGllcztcblxuXHRcdGNvbnNvbGUubG9nKHRoaXMub3B0aW9ucy5kYXRhKTtcblxuXHRcdGZvciAodmFyIGtleSBpbiBwcm9wZXJ0aWVzKSB7XG5cblx0XHRcdGlmIChwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0dGhpcy5hZGRPbmUoa2V5LCBwcm9wZXJ0aWVzW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHRGb3JtU2NoZW1hVmlldy5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyKCkge1xuXG5cdFx0dGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ21ldGhvZCcsIHRoaXMub3B0aW9ucy5tZXRob2QpO1xuXHRcdHRoaXMuZWwuc2V0QXR0cmlidXRlKCdhY3Rpb24nLCB0aGlzLm9wdGlvbnMuYWN0aW9uKTtcblxuXHRcdHRoaXMuYWRkQWxsKCk7XG5cdFx0dGhpcy5hZGRTdWJtaXQoKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fTtcblxuXHRfY3JlYXRlRGVjb3JhdGVkQ2xhc3MoRm9ybVNjaGVtYVZpZXcsIFt7XG5cdFx0a2V5OiAnc3VibWl0Jyxcblx0XHRkZWNvcmF0b3JzOiBbX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3Rvbi5vbignc3VibWl0JyldLFxuXHRcdHZhbHVlOiBmdW5jdGlvbiBzdWJtaXQoZXZ0KSB7XG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNvbnNvbGUubG9nKHRoaXMgKyAnLnN1Ym1pdCgpJywgJycgKyBKU09OLnN0cmluZ2lmeShfbGlic1ZlbmRvckZvcm0yanMyWydkZWZhdWx0J10odGhpcy5lbCkpKTtcblx0XHR9XG5cdH1dKTtcblxuXHR2YXIgX0Zvcm1TY2hlbWFWaWV3ID0gRm9ybVNjaGVtYVZpZXc7XG5cdEZvcm1TY2hlbWFWaWV3ID0gX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3Rvbi50YWdOYW1lKCdmb3JtJykoRm9ybVNjaGVtYVZpZXcpIHx8IEZvcm1TY2hlbWFWaWV3O1xuXHRGb3JtU2NoZW1hVmlldyA9IF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24ubmFtZSgnRm9ybVNjaGVtYVZpZXcnKShGb3JtU2NoZW1hVmlldykgfHwgRm9ybVNjaGVtYVZpZXc7XG5cdHJldHVybiBGb3JtU2NoZW1hVmlldztcbn0pKF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uVmlldyk7XG5cbjtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gRm9ybVNjaGVtYVZpZXc7XG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbJ2RlZmF1bHQnXTsiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbmZ1bmN0aW9uIF9pbmhlcml0cyhzdWJDbGFzcywgc3VwZXJDbGFzcykgeyBpZiAodHlwZW9mIHN1cGVyQ2xhc3MgIT09ICdmdW5jdGlvbicgJiYgc3VwZXJDbGFzcyAhPT0gbnVsbCkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90ICcgKyB0eXBlb2Ygc3VwZXJDbGFzcyk7IH0gc3ViQ2xhc3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7IGNvbnN0cnVjdG9yOiB7IHZhbHVlOiBzdWJDbGFzcywgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlLCBjb25maWd1cmFibGU6IHRydWUgfSB9KTsgaWYgKHN1cGVyQ2xhc3MpIE9iamVjdC5zZXRQcm90b3R5cGVPZiA/IE9iamVjdC5zZXRQcm90b3R5cGVPZihzdWJDbGFzcywgc3VwZXJDbGFzcykgOiBzdWJDbGFzcy5fX3Byb3RvX18gPSBzdXBlckNsYXNzOyB9XG5cbnZhciBfbGlic0hlbHBlcnNFeG9za2VsZXNzdG9uID0gcmVxdWlyZSgnLi4vLi4vLi4vbGlicy9oZWxwZXJzL2V4b3NrZWxlc3N0b24nKTtcblxudmFyIF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfbGlic0hlbHBlcnNFeG9za2VsZXNzdG9uKTtcblxudmFyIEZvcm1TY2hlbWFCYXNlVmlldyA9IChmdW5jdGlvbiAoX0V4b3NrZWxldG9uJFZpZXcpIHtcblx0X2luaGVyaXRzKEZvcm1TY2hlbWFCYXNlVmlldywgX0V4b3NrZWxldG9uJFZpZXcpO1xuXG5cdGZ1bmN0aW9uIEZvcm1TY2hlbWFCYXNlVmlldygpIHtcblx0XHRfY2xhc3NDYWxsQ2hlY2sodGhpcywgX0Zvcm1TY2hlbWFCYXNlVmlldyk7XG5cblx0XHRfRXhvc2tlbGV0b24kVmlldy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHR9XG5cblx0Rm9ybVNjaGVtYUJhc2VWaWV3LnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcblx0XHR2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLmRhdGEgPSBvcHRpb25zLmRhdGE7XG5cdFx0dGhpcy5wcm9wcyA9IG9wdGlvbnMuZGF0YS5wcm9wZXJ0aWVzO1xuXG5cdFx0dGhpcy5lbC5uYW1lID0gdGhpcy5kYXRhLm5hbWU7XG5cblx0XHRpZiAodGhpcy5wcm9wcy5yZXF1aXJlZCkge1xuXHRcdFx0dGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ3JlcXVpcmVkJywgJ3JlcXVpcmVkJyk7XG5cdFx0fVxuXHR9O1xuXG5cdEZvcm1TY2hlbWFCYXNlVmlldy5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyKCkge1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0dmFyIF9Gb3JtU2NoZW1hQmFzZVZpZXcgPSBGb3JtU2NoZW1hQmFzZVZpZXc7XG5cdEZvcm1TY2hlbWFCYXNlVmlldyA9IF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24ubmFtZSgnaXRlbXMvRm9ybVNjaGVtYUJhc2VWaWV3JykoRm9ybVNjaGVtYUJhc2VWaWV3KSB8fCBGb3JtU2NoZW1hQmFzZVZpZXc7XG5cdHJldHVybiBGb3JtU2NoZW1hQmFzZVZpZXc7XG59KShfbGlic0hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLlZpZXcpO1xuXG47XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IEZvcm1TY2hlbWFCYXNlVmlldztcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1snZGVmYXVsdCddOyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxudmFyIF9mb3JtU2NoZW1hU3RyaW5nVmlldyA9IHJlcXVpcmUoJy4vZm9ybS1zY2hlbWEtc3RyaW5nLXZpZXcnKTtcblxudmFyIF9mb3JtU2NoZW1hU3RyaW5nVmlldzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9mb3JtU2NoZW1hU3RyaW5nVmlldyk7XG5cbnZhciBGb3JtU2NoZW1hSXRlbUZhY3RvcnkgPSAoZnVuY3Rpb24gKCkge1xuXHRmdW5jdGlvbiBGb3JtU2NoZW1hSXRlbUZhY3RvcnkoKSB7XG5cdFx0X2NsYXNzQ2FsbENoZWNrKHRoaXMsIEZvcm1TY2hlbWFJdGVtRmFjdG9yeSk7XG5cdH1cblxuXHRGb3JtU2NoZW1hSXRlbUZhY3RvcnkucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uIGNyZWF0ZSh0eXBlKSB7XG5cblx0XHRpZiAodGhpcy50eXBlc01hcHBpbmdbdHlwZV0pIHtcblxuXHRcdFx0cmV0dXJuIHRoaXMudHlwZXNNYXBwaW5nW3R5cGVdO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcignVHlwZSAnICsgdHlwZSArICcgaXMgbm90IGltcGxlbWVudGVkLicpO1xuXHR9O1xuXG5cdF9jcmVhdGVDbGFzcyhGb3JtU2NoZW1hSXRlbUZhY3RvcnksIFt7XG5cdFx0a2V5OiAndHlwZXNNYXBwaW5nJyxcblx0XHRnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c3RyaW5nOiBfZm9ybVNjaGVtYVN0cmluZ1ZpZXcyWydkZWZhdWx0J11cblx0XHRcdH07XG5cdFx0fVxuXHR9XSk7XG5cblx0cmV0dXJuIEZvcm1TY2hlbWFJdGVtRmFjdG9yeTtcbn0pKCk7XG5cbnZhciBmb3JtU2NoZW1hSXRlbUZhY3RvcnkgPSBuZXcgRm9ybVNjaGVtYUl0ZW1GYWN0b3J5KCk7XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IGZvcm1TY2hlbWFJdGVtRmFjdG9yeTtcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1snZGVmYXVsdCddOyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gJ2Z1bmN0aW9uJyAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ1N1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgJyArIHR5cGVvZiBzdXBlckNsYXNzKTsgfSBzdWJDbGFzcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MgJiYgc3VwZXJDbGFzcy5wcm90b3R5cGUsIHsgY29uc3RydWN0b3I6IHsgdmFsdWU6IHN1YkNsYXNzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9IH0pOyBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7IH1cblxudmFyIF9mb3JtU2NoZW1hQmFzZVZpZXcgPSByZXF1aXJlKCcuL2Zvcm0tc2NoZW1hLWJhc2UtdmlldycpO1xuXG52YXIgX2Zvcm1TY2hlbWFCYXNlVmlldzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9mb3JtU2NoZW1hQmFzZVZpZXcpO1xuXG52YXIgX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3RvbiA9IHJlcXVpcmUoJy4uLy4uLy4uL2xpYnMvaGVscGVycy9leG9za2VsZXNzdG9uJyk7XG5cbnZhciBGb3JtU2NoZW1hU3RyaW5nVmlldyA9IChmdW5jdGlvbiAoX0Zvcm1TY2hlbWFCYXNlVmlldykge1xuXHRfaW5oZXJpdHMoRm9ybVNjaGVtYVN0cmluZ1ZpZXcsIF9Gb3JtU2NoZW1hQmFzZVZpZXcpO1xuXG5cdGZ1bmN0aW9uIEZvcm1TY2hlbWFTdHJpbmdWaWV3KCkge1xuXHRcdF9jbGFzc0NhbGxDaGVjayh0aGlzLCBfRm9ybVNjaGVtYVN0cmluZ1ZpZXcpO1xuXG5cdFx0X0Zvcm1TY2hlbWFCYXNlVmlldy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHR9XG5cblx0Rm9ybVNjaGVtYVN0cmluZ1ZpZXcucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuXHRcdHZhciBvcHRpb25zID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8ge30gOiBhcmd1bWVudHNbMF07XG5cblx0XHRfRm9ybVNjaGVtYUJhc2VWaWV3LnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgb3B0aW9ucyk7XG5cdH07XG5cblx0Rm9ybVNjaGVtYVN0cmluZ1ZpZXcucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcigpIHtcblxuXHRcdHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdHZhciBfRm9ybVNjaGVtYVN0cmluZ1ZpZXcgPSBGb3JtU2NoZW1hU3RyaW5nVmlldztcblx0Rm9ybVNjaGVtYVN0cmluZ1ZpZXcgPSBfbGlic0hlbHBlcnNFeG9za2VsZXNzdG9uLnRhZ05hbWUoJ2lucHV0JykoRm9ybVNjaGVtYVN0cmluZ1ZpZXcpIHx8IEZvcm1TY2hlbWFTdHJpbmdWaWV3O1xuXHRGb3JtU2NoZW1hU3RyaW5nVmlldyA9IF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24ubmFtZSgnaXRlbXMvRm9ybVNjaGVtYVN0cmluZ1ZpZXcnKShGb3JtU2NoZW1hU3RyaW5nVmlldykgfHwgRm9ybVNjaGVtYVN0cmluZ1ZpZXc7XG5cdHJldHVybiBGb3JtU2NoZW1hU3RyaW5nVmlldztcbn0pKF9mb3JtU2NoZW1hQmFzZVZpZXcyWydkZWZhdWx0J10pO1xuXG47XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IEZvcm1TY2hlbWFTdHJpbmdWaWV3O1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzWydkZWZhdWx0J107Il19
