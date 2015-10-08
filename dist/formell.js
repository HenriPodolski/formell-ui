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

var _libsHelpersString = require('../../libs/helpers/string');

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
		key: 'submitButtonClick',
		decorators: [_libsHelpersExoskelesston.on('click [type="submit"]')],
		value: function submitButtonClick(evt) {
			console.log(this + '.submitButtonClick()');
		}
	}, {
		key: 'submit',
		decorators: [_libsHelpersExoskelesston.on('submit')],
		value: function submit(evt) {
			evt.preventDefault();
			console.log(this + '.submit()', '' + JSON.stringify(_libsVendorForm2js2['default'](this.el)));
		}
	}]);

	var _FormSchemaView = FormSchemaView;
	FormSchemaView = _libsHelpersExoskelesston.tagName('form')(FormSchemaView) || FormSchemaView;
	FormSchemaView = _libsHelpersExoskelesston.id('frmll-' + _libsHelpersString.createUID())(FormSchemaView) || FormSchemaView;
	FormSchemaView = _libsHelpersExoskelesston.name('FormSchemaView')(FormSchemaView) || FormSchemaView;
	return FormSchemaView;
})(_libsHelpersExoskelesston2['default'].View);

;

exports['default'] = FormSchemaView;
module.exports = exports['default'];
},{"../../libs/helpers/exoskelesston":7,"../../libs/helpers/string":8,"../../libs/vendor/form2js":9,"./items/form-schema-item-factory":12}],11:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFja2JvbmUubmF0aXZlYWpheC9iYWNrYm9uZS5uYXRpdmVhamF4LmpzIiwibm9kZV9tb2R1bGVzL2JhY2tib25lLm5hdGl2ZXZpZXcvYmFja2JvbmUubmF0aXZldmlldy5qcyIsIm5vZGVfbW9kdWxlcy9leG9za2VsZXRvbi9leG9za2VsZXRvbi5qcyIsInNyYy9mb3JtZWxsLmpzIiwic3JjL2xpYnMvZm9ybWVsbC1zY2hlbWEuanMiLCJzcmMvbGlicy9oZWxwZXJzL2Vudmlyb25tZW50LmpzIiwic3JjL2xpYnMvaGVscGVycy9leG9za2VsZXNzdG9uLmpzIiwic3JjL2xpYnMvaGVscGVycy9zdHJpbmcuanMiLCJzcmMvbGlicy92ZW5kb3IvZm9ybTJqcy5qcyIsInNyYy9tb2R1bGVzL2Zvcm0tc2NoZW1hL2Zvcm0tc2NoZW1hLXZpZXcuanMiLCJzcmMvbW9kdWxlcy9mb3JtLXNjaGVtYS9pdGVtcy9mb3JtLXNjaGVtYS1iYXNlLXZpZXcuanMiLCJzcmMvbW9kdWxlcy9mb3JtLXNjaGVtYS9pdGVtcy9mb3JtLXNjaGVtYS1pdGVtLWZhY3RvcnkuanMiLCJzcmMvbW9kdWxlcy9mb3JtLXNjaGVtYS9pdGVtcy9mb3JtLXNjaGVtYS1zdHJpbmctdmlldy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqdURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMxa0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIEJhY2tib25lLk5hdGl2ZUFqYXguanMgMC40LjNcbi8vIC0tLS0tLS0tLS0tLS0tLVxuXG4vLyAgICAgKGMpIDIwMTUgQWRhbSBLcmVicywgUGF1bCBNaWxsZXIsIEV4b3NrZWxldG9uIFByb2plY3Rcbi8vICAgICBCYWNrYm9uZS5OYXRpdmVBamF4IG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuLy8gICAgIEZvciBhbGwgZGV0YWlscyBhbmQgZG9jdW1lbnRhdGlvbjpcbi8vICAgICBodHRwczovL2dpdGh1Yi5jb20vYWtyZTU0L0JhY2tib25lLk5hdGl2ZUFqYXhcblxuKGZ1bmN0aW9uIChmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHsgZGVmaW5lKGZhY3RvcnkpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JykgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcbiAgfSBlbHNlIHsgQmFja2JvbmUuYWpheCA9IGZhY3RvcnkoKTsgfVxufShmdW5jdGlvbigpIHtcbiAgLy8gTWFrZSBhbiBBSkFYIHJlcXVlc3QgdG8gdGhlIHNlcnZlci5cbiAgLy8gVXNhZ2U6XG4gIC8vICAgdmFyIHJlcSA9IEJhY2tib25lLmFqYXgoe3VybDogJ3VybCcsIHR5cGU6ICdQQVRDSCcsIGRhdGE6ICdkYXRhJ30pO1xuICAvLyAgIHJlcS50aGVuKC4uLiwgLi4uKSAvLyBpZiBQcm9taXNlIGlzIHNldFxuICB2YXIgYWpheCA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgeG1sUmUgPSAvXig/OmFwcGxpY2F0aW9ufHRleHQpXFwveG1sLztcbiAgICB2YXIganNvblJlID0gL15hcHBsaWNhdGlvblxcL2pzb24vO1xuXG4gICAgdmFyIGdldERhdGEgPSBmdW5jdGlvbihhY2NlcHRzLCB4aHIpIHtcbiAgICAgIGlmIChhY2NlcHRzID09IG51bGwpIGFjY2VwdHMgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ2NvbnRlbnQtdHlwZScpO1xuICAgICAgaWYgKHhtbFJlLnRlc3QoYWNjZXB0cykpIHtcbiAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVhNTDtcbiAgICAgIH0gZWxzZSBpZiAoanNvblJlLnRlc3QoYWNjZXB0cykgJiYgeGhyLnJlc3BvbnNlVGV4dCAhPT0gJycpIHtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIGlzVmFsaWQgPSBmdW5jdGlvbih4aHIpIHtcbiAgICAgIHJldHVybiAoeGhyLnN0YXR1cyA+PSAyMDAgJiYgeGhyLnN0YXR1cyA8IDMwMCkgfHxcbiAgICAgICAgKHhoci5zdGF0dXMgPT09IDMwNCkgfHxcbiAgICAgICAgKHhoci5zdGF0dXMgPT09IDAgJiYgd2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnZmlsZTonKVxuICAgIH07XG5cbiAgICB2YXIgZW5kID0gZnVuY3Rpb24oeGhyLCBvcHRpb25zLCBwcm9taXNlLCByZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgdXBkYXRlUHJvbWlzZSh4aHIsIHByb21pc2UpO1xuXG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSAhPT0gNCkgcmV0dXJuO1xuXG4gICAgICAgIHZhciBzdGF0dXMgPSB4aHIuc3RhdHVzO1xuICAgICAgICB2YXIgZGF0YSA9IGdldERhdGEob3B0aW9ucy5oZWFkZXJzICYmIG9wdGlvbnMuaGVhZGVycy5BY2NlcHQsIHhocik7XG5cbiAgICAgICAgLy8gQ2hlY2sgZm9yIHZhbGlkaXR5LlxuICAgICAgICBpZiAoaXNWYWxpZCh4aHIpKSB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMuc3VjY2Vzcykgb3B0aW9ucy5zdWNjZXNzKGRhdGEpO1xuICAgICAgICAgIGlmIChyZXNvbHZlKSByZXNvbHZlKGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcignU2VydmVyIHJlc3BvbmRlZCB3aXRoIGEgc3RhdHVzIG9mICcgKyBzdGF0dXMpO1xuICAgICAgICAgIGlmIChvcHRpb25zLmVycm9yKSBvcHRpb25zLmVycm9yKHhociwgc3RhdHVzLCBlcnJvcik7XG4gICAgICAgICAgaWYgKHJlamVjdCkgcmVqZWN0KHhocik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIHVwZGF0ZVByb21pc2UgPSBmdW5jdGlvbih4aHIsIHByb21pc2UpIHtcbiAgICAgIGlmICghcHJvbWlzZSkgcmV0dXJuO1xuXG4gICAgICB2YXIgcHJvcHMgPSBbJ3JlYWR5U3RhdGUnLCAnc3RhdHVzJywgJ3N0YXR1c1RleHQnLCAncmVzcG9uc2VUZXh0JyxcbiAgICAgICAgJ3Jlc3BvbnNlWE1MJywgJ3NldFJlcXVlc3RIZWFkZXInLCAnZ2V0QWxsUmVzcG9uc2VIZWFkZXJzJyxcbiAgICAgICAgJ2dldFJlc3BvbnNlSGVhZGVyJywgJ3N0YXR1c0NvZGUnLCAnYWJvcnQnXTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcHJvcCA9IHByb3BzW2ldO1xuICAgICAgICBwcm9taXNlW3Byb3BdID0gdHlwZW9mIHhocltwcm9wXSA9PT0gJ2Z1bmN0aW9uJyA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB4aHJbcHJvcF0uYmluZCh4aHIpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHhocltwcm9wXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBpZiAob3B0aW9ucyA9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IHByb3ZpZGUgb3B0aW9ucycpO1xuICAgICAgaWYgKG9wdGlvbnMudHlwZSA9PSBudWxsKSBvcHRpb25zLnR5cGUgPSAnR0VUJztcblxuICAgICAgdmFyIHJlc29sdmUsIHJlamVjdCwgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICB2YXIgUHJvbWlzZUZuID0gYWpheC5Qcm9taXNlIHx8ICh0eXBlb2YgUHJvbWlzZSAhPT0gJ3VuZGVmaW5lZCcgJiYgUHJvbWlzZSk7XG4gICAgICB2YXIgcHJvbWlzZSA9IFByb21pc2VGbiAmJiBuZXcgUHJvbWlzZUZuKGZ1bmN0aW9uKHJlcywgcmVqKSB7XG4gICAgICAgIHJlc29sdmUgPSByZXM7XG4gICAgICAgIHJlamVjdCA9IHJlajtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAob3B0aW9ucy5jb250ZW50VHlwZSkge1xuICAgICAgICBpZiAob3B0aW9ucy5oZWFkZXJzID09IG51bGwpIG9wdGlvbnMuaGVhZGVycyA9IHt9O1xuICAgICAgICBvcHRpb25zLmhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gb3B0aW9ucy5jb250ZW50VHlwZTtcbiAgICAgIH1cblxuICAgICAgLy8gU3RyaW5naWZ5IEdFVCBxdWVyeSBwYXJhbXMuXG4gICAgICBpZiAob3B0aW9ucy50eXBlID09PSAnR0VUJyAmJiB0eXBlb2Ygb3B0aW9ucy5kYXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgICB2YXIgcXVlcnkgPSAnJztcbiAgICAgICAgdmFyIHN0cmluZ2lmeUtleVZhbHVlUGFpciA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWUgPT0gbnVsbCA/ICcnIDpcbiAgICAgICAgICAgICcmJyArIGVuY29kZVVSSUNvbXBvbmVudChrZXkpICtcbiAgICAgICAgICAgICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBvcHRpb25zLmRhdGEpIHtcbiAgICAgICAgICBxdWVyeSArPSBzdHJpbmdpZnlLZXlWYWx1ZVBhaXIoa2V5LCBvcHRpb25zLmRhdGFba2V5XSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgICB2YXIgc2VwID0gKG9wdGlvbnMudXJsLmluZGV4T2YoJz8nKSA9PT0gLTEpID8gJz8nIDogJyYnO1xuICAgICAgICAgIG9wdGlvbnMudXJsICs9IHNlcCArIHF1ZXJ5LnN1YnN0cmluZygxKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZW5kKHhociwgb3B0aW9ucywgcHJvbWlzZSwgcmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgIHhoci5vcGVuKG9wdGlvbnMudHlwZSwgb3B0aW9ucy51cmwsIHRydWUpO1xuXG4gICAgICBpZighKG9wdGlvbnMuaGVhZGVycyAmJiBvcHRpb25zLmhlYWRlcnMuQWNjZXB0KSkge1xuICAgICAgICB2YXIgYWxsVHlwZXMgPSBcIiovXCIuY29uY2F0KFwiKlwiKTtcbiAgICAgICAgdmFyIHhockFjY2VwdHMgPSB7XG4gICAgICAgICAgXCIqXCI6IGFsbFR5cGVzLFxuICAgICAgICAgIHRleHQ6IFwidGV4dC9wbGFpblwiLFxuICAgICAgICAgIGh0bWw6IFwidGV4dC9odG1sXCIsXG4gICAgICAgICAgeG1sOiBcImFwcGxpY2F0aW9uL3htbCwgdGV4dC94bWxcIixcbiAgICAgICAgICBqc29uOiBcImFwcGxpY2F0aW9uL2pzb24sIHRleHQvamF2YXNjcmlwdFwiXG4gICAgICAgIH07XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKFxuICAgICAgICAgIFwiQWNjZXB0XCIsXG4gICAgICAgICAgb3B0aW9ucy5kYXRhVHlwZSAmJiB4aHJBY2NlcHRzW29wdGlvbnMuZGF0YVR5cGVdID9cbiAgICAgICAgICAgIHhockFjY2VwdHNbb3B0aW9ucy5kYXRhVHlwZV0gKyAob3B0aW9ucy5kYXRhVHlwZSAhPT0gXCIqXCIgPyBcIiwgXCIgKyBhbGxUeXBlcyArIFwiOyBxPTAuMDFcIiA6IFwiXCIgKSA6XG4gICAgICAgICAgICB4aHJBY2NlcHRzW1wiKlwiXVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5oZWFkZXJzKSBmb3IgKHZhciBrZXkgaW4gb3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgb3B0aW9ucy5oZWFkZXJzW2tleV0pO1xuICAgICAgfVxuICAgICAgaWYgKG9wdGlvbnMuYmVmb3JlU2VuZCkgb3B0aW9ucy5iZWZvcmVTZW5kKHhocik7XG4gICAgICB4aHIuc2VuZChvcHRpb25zLmRhdGEpO1xuXG4gICAgICBvcHRpb25zLm9yaWdpbmFsWGhyID0geGhyO1xuXG4gICAgICB1cGRhdGVQcm9taXNlKHhociwgcHJvbWlzZSk7XG5cbiAgICAgIHJldHVybiBwcm9taXNlID8gcHJvbWlzZSA6IHhocjtcbiAgICB9O1xuICB9KSgpO1xuICByZXR1cm4gYWpheDtcbn0pKTtcbiIsIi8vIEJhY2tib25lLk5hdGl2ZVZpZXcuanMgMC4zLjNcbi8vIC0tLS0tLS0tLS0tLS0tLVxuXG4vLyAgICAgKGMpIDIwMTUgQWRhbSBLcmVicywgSmltbXkgWXVlbiBIbyBXb25nXG4vLyAgICAgQmFja2JvbmUuTmF0aXZlVmlldyBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbi8vICAgICBGb3IgYWxsIGRldGFpbHMgYW5kIGRvY3VtZW50YXRpb246XG4vLyAgICAgaHR0cHM6Ly9naXRodWIuY29tL2FrcmU1NC9CYWNrYm9uZS5OYXRpdmVWaWV3XG5cbihmdW5jdGlvbiAoZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7IGRlZmluZShbJ2JhY2tib25lJ10sIGZhY3RvcnkpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKSB7IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShyZXF1aXJlKCdleG9za2VsZXRvbicpKTtcbiAgfSBlbHNlIHsgZmFjdG9yeShCYWNrYm9uZSk7IH1cbn0oZnVuY3Rpb24gKEJhY2tib25lKSB7XG4gIC8vIENhY2hlZCByZWdleCB0byBtYXRjaCBhbiBvcGVuaW5nICc8JyBvZiBhbiBIVE1MIHRhZywgcG9zc2libHkgbGVmdC1wYWRkZWRcbiAgLy8gd2l0aCB3aGl0ZXNwYWNlLlxuICB2YXIgcGFkZGVkTHQgPSAvXlxccyo8LztcblxuICAvLyBDYWNoZXMgYSBsb2NhbCByZWZlcmVuY2UgdG8gYEVsZW1lbnQucHJvdG90eXBlYCBmb3IgZmFzdGVyIGFjY2Vzcy5cbiAgdmFyIEVsZW1lbnRQcm90byA9ICh0eXBlb2YgRWxlbWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgRWxlbWVudC5wcm90b3R5cGUpIHx8IHt9O1xuXG4gIC8vIENyb3NzLWJyb3dzZXIgZXZlbnQgbGlzdGVuZXIgc2hpbXNcbiAgdmFyIGVsZW1lbnRBZGRFdmVudExpc3RlbmVyID0gRWxlbWVudFByb3RvLmFkZEV2ZW50TGlzdGVuZXIgfHwgZnVuY3Rpb24oZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHJldHVybiB0aGlzLmF0dGFjaEV2ZW50KCdvbicgKyBldmVudE5hbWUsIGxpc3RlbmVyKTtcbiAgfVxuICB2YXIgZWxlbWVudFJlbW92ZUV2ZW50TGlzdGVuZXIgPSBFbGVtZW50UHJvdG8ucmVtb3ZlRXZlbnRMaXN0ZW5lciB8fCBmdW5jdGlvbihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZGV0YWNoRXZlbnQoJ29uJyArIGV2ZW50TmFtZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgdmFyIGluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSkge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykgaWYgKGFycmF5W2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICAvLyBGaW5kIHRoZSByaWdodCBgRWxlbWVudCNtYXRjaGVzYCBmb3IgSUU+PTkgYW5kIG1vZGVybiBicm93c2Vycy5cbiAgdmFyIG1hdGNoZXNTZWxlY3RvciA9IEVsZW1lbnRQcm90by5tYXRjaGVzIHx8XG4gICAgICBFbGVtZW50UHJvdG8ud2Via2l0TWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgICBFbGVtZW50UHJvdG8ubW96TWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgICBFbGVtZW50UHJvdG8ubXNNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICAgIEVsZW1lbnRQcm90by5vTWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgICAvLyBNYWtlIG91ciBvd24gYEVsZW1lbnQjbWF0Y2hlc2AgZm9yIElFOFxuICAgICAgZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICAgICAgLy8gVXNlIHF1ZXJ5U2VsZWN0b3JBbGwgdG8gZmluZCBhbGwgZWxlbWVudHMgbWF0Y2hpbmcgdGhlIHNlbGVjdG9yLFxuICAgICAgICAvLyB0aGVuIGNoZWNrIGlmIHRoZSBnaXZlbiBlbGVtZW50IGlzIGluY2x1ZGVkIGluIHRoYXQgbGlzdC5cbiAgICAgICAgLy8gRXhlY3V0aW5nIHRoZSBxdWVyeSBvbiB0aGUgcGFyZW50Tm9kZSByZWR1Y2VzIHRoZSByZXN1bHRpbmcgbm9kZUxpc3QsXG4gICAgICAgIC8vIChkb2N1bWVudCBkb2Vzbid0IGhhdmUgYSBwYXJlbnROb2RlKS5cbiAgICAgICAgdmFyIG5vZGVMaXN0ID0gKHRoaXMucGFyZW50Tm9kZSB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikgfHwgW107XG4gICAgICAgIHJldHVybiB+aW5kZXhPZihub2RlTGlzdCwgdGhpcyk7XG4gICAgICB9O1xuXG4gIC8vIENhY2hlIEJhY2tib25lLlZpZXcgZm9yIGxhdGVyIGFjY2VzcyBpbiBjb25zdHJ1Y3RvclxuICB2YXIgQkJWaWV3ID0gQmFja2JvbmUuVmlldztcblxuICAvLyBUbyBleHRlbmQgYW4gZXhpc3RpbmcgdmlldyB0byB1c2UgbmF0aXZlIG1ldGhvZHMsIGV4dGVuZCB0aGUgVmlldyBwcm90b3R5cGVcbiAgLy8gd2l0aCB0aGUgbWl4aW46IF8uZXh0ZW5kKE15Vmlldy5wcm90b3R5cGUsIEJhY2tib25lLk5hdGl2ZVZpZXdNaXhpbik7XG4gIEJhY2tib25lLk5hdGl2ZVZpZXdNaXhpbiA9IHtcblxuICAgIF9kb21FdmVudHM6IG51bGwsXG5cbiAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl9kb21FdmVudHMgPSBbXTtcbiAgICAgIHJldHVybiBCQlZpZXcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9LFxuXG4gICAgJDogZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICAgIHJldHVybiB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgIH0sXG5cbiAgICBfcmVtb3ZlRWxlbWVudDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnVuZGVsZWdhdGVFdmVudHMoKTtcbiAgICAgIGlmICh0aGlzLmVsLnBhcmVudE5vZGUpIHRoaXMuZWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmVsKTtcbiAgICB9LFxuXG4gICAgLy8gQXBwbHkgdGhlIGBlbGVtZW50YCB0byB0aGUgdmlldy4gYGVsZW1lbnRgIGNhbiBiZSBhIENTUyBzZWxlY3RvcixcbiAgICAvLyBhIHN0cmluZyBvZiBIVE1MLCBvciBhbiBFbGVtZW50IG5vZGUuXG4gICAgX3NldEVsZW1lbnQ6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICAgIGlmICh0eXBlb2YgZWxlbWVudCA9PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAocGFkZGVkTHQudGVzdChlbGVtZW50KSkge1xuICAgICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgIGVsLmlubmVySFRNTCA9IGVsZW1lbnQ7XG4gICAgICAgICAgdGhpcy5lbCA9IGVsLmZpcnN0Q2hpbGQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5lbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWxlbWVudCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZWwgPSBlbGVtZW50O1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyBTZXQgYSBoYXNoIG9mIGF0dHJpYnV0ZXMgdG8gdGhlIHZpZXcncyBgZWxgLiBXZSB1c2UgdGhlIFwicHJvcFwiIHZlcnNpb25cbiAgICAvLyBpZiBhdmFpbGFibGUsIGZhbGxpbmcgYmFjayB0byBgc2V0QXR0cmlidXRlYCBmb3IgdGhlIGNhdGNoLWFsbC5cbiAgICBfc2V0QXR0cmlidXRlczogZnVuY3Rpb24oYXR0cnMpIHtcbiAgICAgIGZvciAodmFyIGF0dHIgaW4gYXR0cnMpIHtcbiAgICAgICAgYXR0ciBpbiB0aGlzLmVsID8gdGhpcy5lbFthdHRyXSA9IGF0dHJzW2F0dHJdIDogdGhpcy5lbC5zZXRBdHRyaWJ1dGUoYXR0ciwgYXR0cnNbYXR0cl0pO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyBNYWtlIGEgZXZlbnQgZGVsZWdhdGlvbiBoYW5kbGVyIGZvciB0aGUgZ2l2ZW4gYGV2ZW50TmFtZWAgYW5kIGBzZWxlY3RvcmBcbiAgICAvLyBhbmQgYXR0YWNoIGl0IHRvIGB0aGlzLmVsYC5cbiAgICAvLyBJZiBzZWxlY3RvciBpcyBlbXB0eSwgdGhlIGxpc3RlbmVyIHdpbGwgYmUgYm91bmQgdG8gYHRoaXMuZWxgLiBJZiBub3QsIGFcbiAgICAvLyBuZXcgaGFuZGxlciB0aGF0IHdpbGwgcmVjdXJzaXZlbHkgdHJhdmVyc2UgdXAgdGhlIGV2ZW50IHRhcmdldCdzIERPTVxuICAgIC8vIGhpZXJhcmNoeSBsb29raW5nIGZvciBhIG5vZGUgdGhhdCBtYXRjaGVzIHRoZSBzZWxlY3Rvci4gSWYgb25lIGlzIGZvdW5kLFxuICAgIC8vIHRoZSBldmVudCdzIGBkZWxlZ2F0ZVRhcmdldGAgcHJvcGVydHkgaXMgc2V0IHRvIGl0IGFuZCB0aGUgcmV0dXJuIHRoZVxuICAgIC8vIHJlc3VsdCBvZiBjYWxsaW5nIGJvdW5kIGBsaXN0ZW5lcmAgd2l0aCB0aGUgcGFyYW1ldGVycyBnaXZlbiB0byB0aGVcbiAgICAvLyBoYW5kbGVyLlxuICAgIGRlbGVnYXRlOiBmdW5jdGlvbihldmVudE5hbWUsIHNlbGVjdG9yLCBsaXN0ZW5lcikge1xuICAgICAgaWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBsaXN0ZW5lciA9IHNlbGVjdG9yO1xuICAgICAgICBzZWxlY3RvciA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIHZhciByb290ID0gdGhpcy5lbDtcbiAgICAgIHZhciBoYW5kbGVyID0gc2VsZWN0b3IgPyBmdW5jdGlvbiAoZSkge1xuICAgICAgICB2YXIgbm9kZSA9IGUudGFyZ2V0IHx8IGUuc3JjRWxlbWVudDtcbiAgICAgICAgZm9yICg7IG5vZGUgJiYgbm9kZSAhPSByb290OyBub2RlID0gbm9kZS5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgaWYgKG1hdGNoZXNTZWxlY3Rvci5jYWxsKG5vZGUsIHNlbGVjdG9yKSkge1xuICAgICAgICAgICAgZS5kZWxlZ2F0ZVRhcmdldCA9IG5vZGU7XG4gICAgICAgICAgICBsaXN0ZW5lcihlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gOiBsaXN0ZW5lcjtcblxuICAgICAgZWxlbWVudEFkZEV2ZW50TGlzdGVuZXIuY2FsbCh0aGlzLmVsLCBldmVudE5hbWUsIGhhbmRsZXIsIGZhbHNlKTtcbiAgICAgIHRoaXMuX2RvbUV2ZW50cy5wdXNoKHtldmVudE5hbWU6IGV2ZW50TmFtZSwgaGFuZGxlcjogaGFuZGxlciwgbGlzdGVuZXI6IGxpc3RlbmVyLCBzZWxlY3Rvcjogc2VsZWN0b3J9KTtcbiAgICAgIHJldHVybiBoYW5kbGVyO1xuICAgIH0sXG5cbiAgICAvLyBSZW1vdmUgYSBzaW5nbGUgZGVsZWdhdGVkIGV2ZW50LiBFaXRoZXIgYGV2ZW50TmFtZWAgb3IgYHNlbGVjdG9yYCBtdXN0XG4gICAgLy8gYmUgaW5jbHVkZWQsIGBzZWxlY3RvcmAgYW5kIGBsaXN0ZW5lcmAgYXJlIG9wdGlvbmFsLlxuICAgIHVuZGVsZWdhdGU6IGZ1bmN0aW9uKGV2ZW50TmFtZSwgc2VsZWN0b3IsIGxpc3RlbmVyKSB7XG4gICAgICBpZiAodHlwZW9mIHNlbGVjdG9yID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGxpc3RlbmVyID0gc2VsZWN0b3I7XG4gICAgICAgIHNlbGVjdG9yID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuZWwpIHtcbiAgICAgICAgdmFyIGhhbmRsZXJzID0gdGhpcy5fZG9tRXZlbnRzLnNsaWNlKCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBoYW5kbGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgIHZhciBpdGVtID0gaGFuZGxlcnNbaV07XG5cbiAgICAgICAgICB2YXIgbWF0Y2ggPSBpdGVtLmV2ZW50TmFtZSA9PT0gZXZlbnROYW1lICYmXG4gICAgICAgICAgICAgIChsaXN0ZW5lciA/IGl0ZW0ubGlzdGVuZXIgPT09IGxpc3RlbmVyIDogdHJ1ZSkgJiZcbiAgICAgICAgICAgICAgKHNlbGVjdG9yID8gaXRlbS5zZWxlY3RvciA9PT0gc2VsZWN0b3IgOiB0cnVlKTtcblxuICAgICAgICAgIGlmICghbWF0Y2gpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgZWxlbWVudFJlbW92ZUV2ZW50TGlzdGVuZXIuY2FsbCh0aGlzLmVsLCBpdGVtLmV2ZW50TmFtZSwgaXRlbS5oYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgdGhpcy5fZG9tRXZlbnRzLnNwbGljZShpbmRleE9mKGhhbmRsZXJzLCBpdGVtKSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBSZW1vdmUgYWxsIGV2ZW50cyBjcmVhdGVkIHdpdGggYGRlbGVnYXRlYCBmcm9tIGBlbGBcbiAgICB1bmRlbGVnYXRlRXZlbnRzOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmVsKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLl9kb21FdmVudHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICB2YXIgaXRlbSA9IHRoaXMuX2RvbUV2ZW50c1tpXTtcbiAgICAgICAgICBlbGVtZW50UmVtb3ZlRXZlbnRMaXN0ZW5lci5jYWxsKHRoaXMuZWwsIGl0ZW0uZXZlbnROYW1lLCBpdGVtLmhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fZG9tRXZlbnRzLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH07XG5cbiAgQmFja2JvbmUuTmF0aXZlVmlldyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKEJhY2tib25lLk5hdGl2ZVZpZXdNaXhpbik7XG5cbiAgcmV0dXJuIEJhY2tib25lLk5hdGl2ZVZpZXc7XG59KSk7XG4iLCIvKiFcbiAqIEV4b3NrZWxldG9uLmpzIDAuNy4wXG4gKiAoYykgMjAxMyBQYXVsIE1pbGxlciA8aHR0cDovL3BhdWxtaWxsci5jb20+XG4gKiBCYXNlZCBvbiBCYWNrYm9uZS5qc1xuICogKGMpIDIwMTAtMjAxMyBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWRcbiAqIEV4b3NrZWxldG9uIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuICogRm9yIGFsbCBkZXRhaWxzIGFuZCBkb2N1bWVudGF0aW9uOiA8aHR0cDovL2V4b3Nqcy5jb20+XG4gKi9cblxuKGZ1bmN0aW9uKHJvb3QsIGZhY3RvcnkpIHtcbiAgLy8gU2V0IHVwIEJhY2tib25lIGFwcHJvcHJpYXRlbHkgZm9yIHRoZSBlbnZpcm9ubWVudC5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbJ3VuZGVyc2NvcmUnLCAnanF1ZXJ5JywgJ2V4cG9ydHMnXSwgZnVuY3Rpb24oXywgJCwgZXhwb3J0cykge1xuICAgICAgcm9vdC5CYWNrYm9uZSA9IHJvb3QuRXhvc2tlbGV0b24gPSBmYWN0b3J5KHJvb3QsIGV4cG9ydHMsIF8sICQpO1xuICAgIH0pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIHZhciBfLCAkO1xuICAgIHRyeSB7IF8gPSByZXF1aXJlKCd1bmRlcnNjb3JlJyk7IH0gY2F0Y2goZSkgeyB9XG4gICAgdHJ5IHsgJCA9IHJlcXVpcmUoJ2pxdWVyeScpOyB9IGNhdGNoKGUpIHsgfVxuICAgIGZhY3Rvcnkocm9vdCwgZXhwb3J0cywgXywgJCk7XG4gIH0gZWxzZSB7XG4gICAgcm9vdC5CYWNrYm9uZSA9IHJvb3QuRXhvc2tlbGV0b24gPSBmYWN0b3J5KHJvb3QsIHt9LCByb290Ll8sIChyb290LmpRdWVyeSB8fCByb290LlplcHRvIHx8IHJvb3QuZW5kZXIgfHwgcm9vdC4kKSk7XG4gIH1cblxufSkodGhpcywgZnVuY3Rpb24ocm9vdCwgQmFja2JvbmUsIF8sICQpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIC8vIEluaXRpYWwgU2V0dXBcbiAgLy8gLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFNhdmUgdGhlIHByZXZpb3VzIHZhbHVlIG9mIHRoZSBgQmFja2JvbmVgIHZhcmlhYmxlLCBzbyB0aGF0IGl0IGNhbiBiZVxuICAvLyByZXN0b3JlZCBsYXRlciBvbiwgaWYgYG5vQ29uZmxpY3RgIGlzIHVzZWQuXG4gIHZhciBwcmV2aW91c0JhY2tib25lID0gcm9vdC5CYWNrYm9uZTtcbiAgdmFyIHByZXZpb3VzRXhvc2tlbGV0b24gPSByb290LkV4b3NrZWxldG9uO1xuXG4gIC8vIFVuZGVyc2NvcmUgcmVwbGFjZW1lbnQuXG4gIHZhciB1dGlscyA9IEJhY2tib25lLnV0aWxzID0gXyA9IChfIHx8IHt9KTtcblxuICAvLyBIb2xkIG9udG8gYSBsb2NhbCByZWZlcmVuY2UgdG8gYCRgLiBDYW4gYmUgY2hhbmdlZCBhdCBhbnkgcG9pbnQuXG4gIEJhY2tib25lLiQgPSAkO1xuXG4gIC8vIENyZWF0ZSBsb2NhbCByZWZlcmVuY2VzIHRvIGFycmF5IG1ldGhvZHMgd2UnbGwgd2FudCB0byB1c2UgbGF0ZXIuXG4gIHZhciBhcnJheSA9IFtdO1xuICB2YXIgcHVzaCA9IGFycmF5LnB1c2g7XG4gIHZhciBzbGljZSA9IGFycmF5LnNsaWNlO1xuICB2YXIgdG9TdHJpbmcgPSAoe30pLnRvU3RyaW5nO1xuXG4gIC8vIEN1cnJlbnQgdmVyc2lvbiBvZiB0aGUgbGlicmFyeS4gS2VlcCBpbiBzeW5jIHdpdGggYHBhY2thZ2UuanNvbmAuXG4gIC8vIEJhY2tib25lLlZFUlNJT04gPSAnMS4wLjAnO1xuXG4gIC8vIFJ1bnMgQmFja2JvbmUuanMgaW4gKm5vQ29uZmxpY3QqIG1vZGUsIHJldHVybmluZyB0aGUgYEJhY2tib25lYCB2YXJpYWJsZVxuICAvLyB0byBpdHMgcHJldmlvdXMgb3duZXIuIFJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhpcyBCYWNrYm9uZSBvYmplY3QuXG4gIEJhY2tib25lLm5vQ29uZmxpY3QgPSBmdW5jdGlvbigpIHtcbiAgICByb290LkJhY2tib25lID0gcHJldmlvdXNCYWNrYm9uZTtcbiAgICByb290LkV4b3NrZWxldG9uID0gcHJldmlvdXNFeG9za2VsZXRvbjtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvLyBIZWxwZXJzXG4gIC8vIC0tLS0tLS1cblxuICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY29ycmVjdGx5IHNldCB1cCB0aGUgcHJvdG90eXBlIGNoYWluLCBmb3Igc3ViY2xhc3Nlcy5cbiAgLy8gU2ltaWxhciB0byBgZ29vZy5pbmhlcml0c2AsIGJ1dCB1c2VzIGEgaGFzaCBvZiBwcm90b3R5cGUgcHJvcGVydGllcyBhbmRcbiAgLy8gY2xhc3MgcHJvcGVydGllcyB0byBiZSBleHRlbmRlZC5cbiAgQmFja2JvbmUuZXh0ZW5kID0gZnVuY3Rpb24ocHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHtcbiAgICB2YXIgcGFyZW50ID0gdGhpcztcbiAgICB2YXIgY2hpbGQ7XG5cbiAgICAvLyBUaGUgY29uc3RydWN0b3IgZnVuY3Rpb24gZm9yIHRoZSBuZXcgc3ViY2xhc3MgaXMgZWl0aGVyIGRlZmluZWQgYnkgeW91XG4gICAgLy8gKHRoZSBcImNvbnN0cnVjdG9yXCIgcHJvcGVydHkgaW4geW91ciBgZXh0ZW5kYCBkZWZpbml0aW9uKSwgb3IgZGVmYXVsdGVkXG4gICAgLy8gYnkgdXMgdG8gc2ltcGx5IGNhbGwgdGhlIHBhcmVudCdzIGNvbnN0cnVjdG9yLlxuICAgIGlmIChwcm90b1Byb3BzICYmIF8uaGFzKHByb3RvUHJvcHMsICdjb25zdHJ1Y3RvcicpKSB7XG4gICAgICBjaGlsZCA9IHByb3RvUHJvcHMuY29uc3RydWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNoaWxkID0gZnVuY3Rpb24oKXsgcmV0dXJuIHBhcmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpOyB9O1xuICAgIH1cblxuICAgIC8vIEFkZCBzdGF0aWMgcHJvcGVydGllcyB0byB0aGUgY29uc3RydWN0b3IgZnVuY3Rpb24sIGlmIHN1cHBsaWVkLlxuICAgIF8uZXh0ZW5kKGNoaWxkLCBwYXJlbnQsIHN0YXRpY1Byb3BzKTtcblxuICAgIC8vIFNldCB0aGUgcHJvdG90eXBlIGNoYWluIHRvIGluaGVyaXQgZnJvbSBgcGFyZW50YCwgd2l0aG91dCBjYWxsaW5nXG4gICAgLy8gYHBhcmVudGAncyBjb25zdHJ1Y3RvciBmdW5jdGlvbi5cbiAgICB2YXIgU3Vycm9nYXRlID0gZnVuY3Rpb24oKXsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9O1xuICAgIFN1cnJvZ2F0ZS5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlO1xuICAgIGNoaWxkLnByb3RvdHlwZSA9IG5ldyBTdXJyb2dhdGU7XG5cbiAgICAvLyBBZGQgcHJvdG90eXBlIHByb3BlcnRpZXMgKGluc3RhbmNlIHByb3BlcnRpZXMpIHRvIHRoZSBzdWJjbGFzcyxcbiAgICAvLyBpZiBzdXBwbGllZC5cbiAgICBpZiAocHJvdG9Qcm9wcykgXy5leHRlbmQoY2hpbGQucHJvdG90eXBlLCBwcm90b1Byb3BzKTtcblxuICAgIC8vIFNldCBhIGNvbnZlbmllbmNlIHByb3BlcnR5IGluIGNhc2UgdGhlIHBhcmVudCdzIHByb3RvdHlwZSBpcyBuZWVkZWRcbiAgICAvLyBsYXRlci5cbiAgICBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlO1xuXG4gICAgcmV0dXJuIGNoaWxkO1xuICB9O1xuXG4gIC8vIFRocm93IGFuIGVycm9yIHdoZW4gYSBVUkwgaXMgbmVlZGVkLCBhbmQgbm9uZSBpcyBzdXBwbGllZC5cbiAgdmFyIHVybEVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBIFwidXJsXCIgcHJvcGVydHkgb3IgZnVuY3Rpb24gbXVzdCBiZSBzcGVjaWZpZWQnKTtcbiAgfTtcblxuICAvLyBXcmFwIGFuIG9wdGlvbmFsIGVycm9yIGNhbGxiYWNrIHdpdGggYSBmYWxsYmFjayBlcnJvciBldmVudC5cbiAgdmFyIHdyYXBFcnJvciA9IGZ1bmN0aW9uKG1vZGVsLCBvcHRpb25zKSB7XG4gICAgdmFyIGVycm9yID0gb3B0aW9ucy5lcnJvcjtcbiAgICBvcHRpb25zLmVycm9yID0gZnVuY3Rpb24ocmVzcCkge1xuICAgICAgaWYgKGVycm9yKSBlcnJvcihtb2RlbCwgcmVzcCwgb3B0aW9ucyk7XG4gICAgICBtb2RlbC50cmlnZ2VyKCdlcnJvcicsIG1vZGVsLCByZXNwLCBvcHRpb25zKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIENoZWNrZXIgZm9yIHV0aWxpdHkgbWV0aG9kcy4gVXNlZnVsIGZvciBjdXN0b20gYnVpbGRzLlxuICB2YXIgdXRpbEV4aXN0cyA9IGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgIHJldHVybiB0eXBlb2YgX1ttZXRob2RdID09PSAnZnVuY3Rpb24nO1xuICB9O1xudXRpbHMucmVzdWx0ID0gZnVuY3Rpb24gcmVzdWx0KG9iamVjdCwgcHJvcGVydHkpIHtcbiAgdmFyIHZhbHVlID0gb2JqZWN0ID8gb2JqZWN0W3Byb3BlcnR5XSA6IHVuZGVmaW5lZDtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IG9iamVjdFtwcm9wZXJ0eV0oKSA6IHZhbHVlO1xufTtcblxudXRpbHMuZGVmYXVsdHMgPSBmdW5jdGlvbiBkZWZhdWx0cyhvYmopIHtcbiAgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgIGZvciAodmFyIGtleSBpbiBpdGVtKSBpZiAob2JqW2tleV0gPT09IHVuZGVmaW5lZClcbiAgICAgIG9ialtrZXldID0gaXRlbVtrZXldO1xuICB9KTtcbiAgcmV0dXJuIG9iajtcbn07XG5cbnV0aWxzLmV4dGVuZCA9IGZ1bmN0aW9uIGV4dGVuZChvYmopIHtcbiAgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgIGZvciAodmFyIGtleSBpbiBpdGVtKSBvYmpba2V5XSA9IGl0ZW1ba2V5XTtcbiAgfSk7XG4gIHJldHVybiBvYmo7XG59O1xuXG52YXIgaHRtbEVzY2FwZXMgPSB7XG4gICcmJzogJyZhbXA7JyxcbiAgJzwnOiAnJmx0OycsXG4gICc+JzogJyZndDsnLFxuICAnXCInOiAnJnF1b3Q7JyxcbiAgXCInXCI6ICcmIzM5Oydcbn07XG5cbnV0aWxzLmVzY2FwZSA9IGZ1bmN0aW9uIGVzY2FwZShzdHJpbmcpIHtcbiAgcmV0dXJuIHN0cmluZyA9PSBudWxsID8gJycgOiBTdHJpbmcoc3RyaW5nKS5yZXBsYWNlKC9bJjw+XCInXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIHJldHVybiBodG1sRXNjYXBlc1ttYXRjaF07XG4gIH0pO1xufTtcblxudXRpbHMuc29ydEJ5ID0gZnVuY3Rpb24ob2JqLCB2YWx1ZSwgY29udGV4dCkge1xuICB2YXIgaXRlcmF0b3IgPSB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgPyB2YWx1ZSA6IGZ1bmN0aW9uKG9iail7IHJldHVybiBvYmpbdmFsdWVdOyB9O1xuICByZXR1cm4gb2JqXG4gICAgLm1hcChmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICBjcml0ZXJpYTogaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICB9O1xuICAgIH0pXG4gICAgLnNvcnQoZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgIHZhciBhID0gbGVmdC5jcml0ZXJpYTtcbiAgICAgIHZhciBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KVxuICAgIC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0udmFsdWU7XG4gICAgfSk7XG59O1xuXG4vKiogVXNlZCB0byBnZW5lcmF0ZSB1bmlxdWUgSURzICovXG52YXIgaWRDb3VudGVyID0gMDtcblxudXRpbHMudW5pcXVlSWQgPSBmdW5jdGlvbiB1bmlxdWVJZChwcmVmaXgpIHtcbiAgdmFyIGlkID0gKytpZENvdW50ZXIgKyAnJztcbiAgcmV0dXJuIHByZWZpeCA/IHByZWZpeCArIGlkIDogaWQ7XG59O1xuXG51dGlscy5oYXMgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICByZXR1cm4gT2JqZWN0Lmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xufTtcblxudmFyIGVxID0gZnVuY3Rpb24oYSwgYiwgYVN0YWNrLCBiU3RhY2spIHtcbiAgLy8gSWRlbnRpY2FsIG9iamVjdHMgYXJlIGVxdWFsLiBgMCA9PT0gLTBgLCBidXQgdGhleSBhcmVuJ3QgaWRlbnRpY2FsLlxuICAvLyBTZWUgdGhlIFtIYXJtb255IGBlZ2FsYCBwcm9wb3NhbF0oaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTplZ2FsKS5cbiAgaWYgKGEgPT09IGIpIHJldHVybiBhICE9PSAwIHx8IDEgLyBhID09IDEgLyBiO1xuICAvLyBBIHN0cmljdCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIGBudWxsID09IHVuZGVmaW5lZGAuXG4gIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gYSA9PT0gYjtcbiAgLy8gVW53cmFwIGFueSB3cmFwcGVkIG9iamVjdHMuXG4gIC8vaWYgKGEgaW5zdGFuY2VvZiBfKSBhID0gYS5fd3JhcHBlZDtcbiAgLy9pZiAoYiBpbnN0YW5jZW9mIF8pIGIgPSBiLl93cmFwcGVkO1xuICAvLyBDb21wYXJlIGBbW0NsYXNzXV1gIG5hbWVzLlxuICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbChhKTtcbiAgaWYgKGNsYXNzTmFtZSAhPSB0b1N0cmluZy5jYWxsKGIpKSByZXR1cm4gZmFsc2U7XG4gIHN3aXRjaCAoY2xhc3NOYW1lKSB7XG4gICAgLy8gU3RyaW5ncywgbnVtYmVycywgZGF0ZXMsIGFuZCBib29sZWFucyBhcmUgY29tcGFyZWQgYnkgdmFsdWUuXG4gICAgY2FzZSAnW29iamVjdCBTdHJpbmddJzpcbiAgICAgIC8vIFByaW1pdGl2ZXMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgb2JqZWN0IHdyYXBwZXJzIGFyZSBlcXVpdmFsZW50OyB0aHVzLCBgXCI1XCJgIGlzXG4gICAgICAvLyBlcXVpdmFsZW50IHRvIGBuZXcgU3RyaW5nKFwiNVwiKWAuXG4gICAgICByZXR1cm4gYSA9PSBTdHJpbmcoYik7XG4gICAgY2FzZSAnW29iamVjdCBOdW1iZXJdJzpcbiAgICAgIC8vIGBOYU5gcyBhcmUgZXF1aXZhbGVudCwgYnV0IG5vbi1yZWZsZXhpdmUuIEFuIGBlZ2FsYCBjb21wYXJpc29uIGlzIHBlcmZvcm1lZCBmb3JcbiAgICAgIC8vIG90aGVyIG51bWVyaWMgdmFsdWVzLlxuICAgICAgcmV0dXJuIGEgIT09ICthID8gYiAhPT0gK2IgOiAoYSA9PT0gMCA/IDEgLyBhID09PSAxIC8gYiA6IGEgPT09ICtiKTtcbiAgICBjYXNlICdbb2JqZWN0IERhdGVdJzpcbiAgICBjYXNlICdbb2JqZWN0IEJvb2xlYW5dJzpcbiAgICAgIC8vIENvZXJjZSBkYXRlcyBhbmQgYm9vbGVhbnMgdG8gbnVtZXJpYyBwcmltaXRpdmUgdmFsdWVzLiBEYXRlcyBhcmUgY29tcGFyZWQgYnkgdGhlaXJcbiAgICAgIC8vIG1pbGxpc2Vjb25kIHJlcHJlc2VudGF0aW9ucy4gTm90ZSB0aGF0IGludmFsaWQgZGF0ZXMgd2l0aCBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnNcbiAgICAgIC8vIG9mIGBOYU5gIGFyZSBub3QgZXF1aXZhbGVudC5cbiAgICAgIHJldHVybiArYSA9PSArYjtcbiAgICAvLyBSZWdFeHBzIGFyZSBjb21wYXJlZCBieSB0aGVpciBzb3VyY2UgcGF0dGVybnMgYW5kIGZsYWdzLlxuICAgIGNhc2UgJ1tvYmplY3QgUmVnRXhwXSc6XG4gICAgICByZXR1cm4gYS5zb3VyY2UgPT0gYi5zb3VyY2UgJiZcbiAgICAgICAgICAgICBhLmdsb2JhbCA9PSBiLmdsb2JhbCAmJlxuICAgICAgICAgICAgIGEubXVsdGlsaW5lID09IGIubXVsdGlsaW5lICYmXG4gICAgICAgICAgICAgYS5pZ25vcmVDYXNlID09IGIuaWdub3JlQ2FzZTtcbiAgfVxuICBpZiAodHlwZW9mIGEgIT0gJ29iamVjdCcgfHwgdHlwZW9mIGIgIT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgLy8gQXNzdW1lIGVxdWFsaXR5IGZvciBjeWNsaWMgc3RydWN0dXJlcy4gVGhlIGFsZ29yaXRobSBmb3IgZGV0ZWN0aW5nIGN5Y2xpY1xuICAvLyBzdHJ1Y3R1cmVzIGlzIGFkYXB0ZWQgZnJvbSBFUyA1LjEgc2VjdGlvbiAxNS4xMi4zLCBhYnN0cmFjdCBvcGVyYXRpb24gYEpPYC5cbiAgdmFyIGxlbmd0aCA9IGFTdGFjay5sZW5ndGg7XG4gIHdoaWxlIChsZW5ndGgtLSkge1xuICAgIC8vIExpbmVhciBzZWFyY2guIFBlcmZvcm1hbmNlIGlzIGludmVyc2VseSBwcm9wb3J0aW9uYWwgdG8gdGhlIG51bWJlciBvZlxuICAgIC8vIHVuaXF1ZSBuZXN0ZWQgc3RydWN0dXJlcy5cbiAgICBpZiAoYVN0YWNrW2xlbmd0aF0gPT0gYSkgcmV0dXJuIGJTdGFja1tsZW5ndGhdID09IGI7XG4gIH1cbiAgLy8gT2JqZWN0cyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVpdmFsZW50LCBidXQgYE9iamVjdGBzXG4gIC8vIGZyb20gZGlmZmVyZW50IGZyYW1lcyBhcmUuXG4gIHZhciBhQ3RvciA9IGEuY29uc3RydWN0b3IsIGJDdG9yID0gYi5jb25zdHJ1Y3RvcjtcbiAgaWYgKGFDdG9yICE9PSBiQ3RvciAmJiAhKHR5cGVvZiBhQ3RvciA9PT0gJ2Z1bmN0aW9uJyAmJiAoYUN0b3IgaW5zdGFuY2VvZiBhQ3RvcikgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiBiQ3RvciA9PT0gJ2Z1bmN0aW9uJyAmJiAoYkN0b3IgaW5zdGFuY2VvZiBiQ3RvcikpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vIEFkZCB0aGUgZmlyc3Qgb2JqZWN0IHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgYVN0YWNrLnB1c2goYSk7XG4gIGJTdGFjay5wdXNoKGIpO1xuICB2YXIgc2l6ZSA9IDAsIHJlc3VsdCA9IHRydWU7XG4gIC8vIFJlY3Vyc2l2ZWx5IGNvbXBhcmUgb2JqZWN0cyBhbmQgYXJyYXlzLlxuICBpZiAoY2xhc3NOYW1lID09PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgLy8gQ29tcGFyZSBhcnJheSBsZW5ndGhzIHRvIGRldGVybWluZSBpZiBhIGRlZXAgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkuXG4gICAgc2l6ZSA9IGEubGVuZ3RoO1xuICAgIHJlc3VsdCA9IHNpemUgPT09IGIubGVuZ3RoO1xuICAgIGlmIChyZXN1bHQpIHtcbiAgICAgIC8vIERlZXAgY29tcGFyZSB0aGUgY29udGVudHMsIGlnbm9yaW5nIG5vbi1udW1lcmljIHByb3BlcnRpZXMuXG4gICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgIGlmICghKHJlc3VsdCA9IGVxKGFbc2l6ZV0sIGJbc2l6ZV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBEZWVwIGNvbXBhcmUgb2JqZWN0cy5cbiAgICBmb3IgKHZhciBrZXkgaW4gYSkge1xuICAgICAgaWYgKF8uaGFzKGEsIGtleSkpIHtcbiAgICAgICAgLy8gQ291bnQgdGhlIGV4cGVjdGVkIG51bWJlciBvZiBwcm9wZXJ0aWVzLlxuICAgICAgICBzaXplKys7XG4gICAgICAgIC8vIERlZXAgY29tcGFyZSBlYWNoIG1lbWJlci5cbiAgICAgICAgaWYgKCEocmVzdWx0ID0gXy5oYXMoYiwga2V5KSAmJiBlcShhW2tleV0sIGJba2V5XSwgYVN0YWNrLCBiU3RhY2spKSkgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEVuc3VyZSB0aGF0IGJvdGggb2JqZWN0cyBjb250YWluIHRoZSBzYW1lIG51bWJlciBvZiBwcm9wZXJ0aWVzLlxuICAgIGlmIChyZXN1bHQpIHtcbiAgICAgIGZvciAoa2V5IGluIGIpIHtcbiAgICAgICAgaWYgKF8uaGFzKGIsIGtleSkgJiYgIShzaXplLS0pKSBicmVhaztcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9ICFzaXplO1xuICAgIH1cbiAgfVxuICAvLyBSZW1vdmUgdGhlIGZpcnN0IG9iamVjdCBmcm9tIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgYVN0YWNrLnBvcCgpO1xuICBiU3RhY2sucG9wKCk7XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBQZXJmb3JtIGEgZGVlcCBjb21wYXJpc29uIHRvIGNoZWNrIGlmIHR3byBvYmplY3RzIGFyZSBlcXVhbC5cbnV0aWxzLmlzRXF1YWwgPSBmdW5jdGlvbihhLCBiKSB7XG4gIHJldHVybiBlcShhLCBiLCBbXSwgW10pO1xufTtcbi8vIEJhY2tib25lLkV2ZW50c1xuLy8gLS0tLS0tLS0tLS0tLS0tXG5cbi8vIEEgbW9kdWxlIHRoYXQgY2FuIGJlIG1peGVkIGluIHRvICphbnkgb2JqZWN0KiBpbiBvcmRlciB0byBwcm92aWRlIGl0IHdpdGhcbi8vIGN1c3RvbSBldmVudHMuIFlvdSBtYXkgYmluZCB3aXRoIGBvbmAgb3IgcmVtb3ZlIHdpdGggYG9mZmAgY2FsbGJhY2tcbi8vIGZ1bmN0aW9ucyB0byBhbiBldmVudDsgYHRyaWdnZXJgLWluZyBhbiBldmVudCBmaXJlcyBhbGwgY2FsbGJhY2tzIGluXG4vLyBzdWNjZXNzaW9uLlxuLy9cbi8vICAgICB2YXIgb2JqZWN0ID0ge307XG4vLyAgICAgXy5leHRlbmQob2JqZWN0LCBCYWNrYm9uZS5FdmVudHMpO1xuLy8gICAgIG9iamVjdC5vbignZXhwYW5kJywgZnVuY3Rpb24oKXsgYWxlcnQoJ2V4cGFuZGVkJyk7IH0pO1xuLy8gICAgIG9iamVjdC50cmlnZ2VyKCdleHBhbmQnKTtcbi8vXG52YXIgRXZlbnRzID0gQmFja2JvbmUuRXZlbnRzID0ge1xuXG4gIC8vIEJpbmQgYW4gZXZlbnQgdG8gYSBgY2FsbGJhY2tgIGZ1bmN0aW9uLiBQYXNzaW5nIGBcImFsbFwiYCB3aWxsIGJpbmRcbiAgLy8gdGhlIGNhbGxiYWNrIHRvIGFsbCBldmVudHMgZmlyZWQuXG4gIG9uOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgIGlmICghZXZlbnRzQXBpKHRoaXMsICdvbicsIG5hbWUsIFtjYWxsYmFjaywgY29udGV4dF0pIHx8ICFjYWxsYmFjaykgcmV0dXJuIHRoaXM7XG4gICAgdGhpcy5fZXZlbnRzIHx8ICh0aGlzLl9ldmVudHMgPSB7fSk7XG4gICAgdmFyIGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tuYW1lXSB8fCAodGhpcy5fZXZlbnRzW25hbWVdID0gW10pO1xuICAgIGV2ZW50cy5wdXNoKHtjYWxsYmFjazogY2FsbGJhY2ssIGNvbnRleHQ6IGNvbnRleHQsIGN0eDogY29udGV4dCB8fCB0aGlzfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLy8gQmluZCBhbiBldmVudCB0byBvbmx5IGJlIHRyaWdnZXJlZCBhIHNpbmdsZSB0aW1lLiBBZnRlciB0aGUgZmlyc3QgdGltZVxuICAvLyB0aGUgY2FsbGJhY2sgaXMgaW52b2tlZCwgaXQgd2lsbCBiZSByZW1vdmVkLlxuICBvbmNlOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgIGlmICghZXZlbnRzQXBpKHRoaXMsICdvbmNlJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkgfHwgIWNhbGxiYWNrKSByZXR1cm4gdGhpcztcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJhbjtcbiAgICB2YXIgb25jZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHJhbikgcmV0dXJuO1xuICAgICAgcmFuID0gdHJ1ZTtcbiAgICAgIHNlbGYub2ZmKG5hbWUsIG9uY2UpO1xuICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICAgIG9uY2UuX2NhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgcmV0dXJuIHRoaXMub24obmFtZSwgb25jZSwgY29udGV4dCk7XG4gIH0sXG5cbiAgLy8gUmVtb3ZlIG9uZSBvciBtYW55IGNhbGxiYWNrcy4gSWYgYGNvbnRleHRgIGlzIG51bGwsIHJlbW92ZXMgYWxsXG4gIC8vIGNhbGxiYWNrcyB3aXRoIHRoYXQgZnVuY3Rpb24uIElmIGBjYWxsYmFja2AgaXMgbnVsbCwgcmVtb3ZlcyBhbGxcbiAgLy8gY2FsbGJhY2tzIGZvciB0aGUgZXZlbnQuIElmIGBuYW1lYCBpcyBudWxsLCByZW1vdmVzIGFsbCBib3VuZFxuICAvLyBjYWxsYmFja3MgZm9yIGFsbCBldmVudHMuXG4gIG9mZjogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICB2YXIgcmV0YWluLCBldiwgZXZlbnRzLCBuYW1lcywgaSwgbCwgaiwgaztcbiAgICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhZXZlbnRzQXBpKHRoaXMsICdvZmYnLCBuYW1lLCBbY2FsbGJhY2ssIGNvbnRleHRdKSkgcmV0dXJuIHRoaXM7XG4gICAgaWYgKCFuYW1lICYmICFjYWxsYmFjayAmJiAhY29udGV4dCkge1xuICAgICAgdGhpcy5fZXZlbnRzID0gdm9pZCAwO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIG5hbWVzID0gbmFtZSA/IFtuYW1lXSA6IE9iamVjdC5rZXlzKHRoaXMuX2V2ZW50cyk7XG4gICAgZm9yIChpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgbmFtZSA9IG5hbWVzW2ldO1xuICAgICAgaWYgKGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tuYW1lXSkge1xuICAgICAgICB0aGlzLl9ldmVudHNbbmFtZV0gPSByZXRhaW4gPSBbXTtcbiAgICAgICAgaWYgKGNhbGxiYWNrIHx8IGNvbnRleHQpIHtcbiAgICAgICAgICBmb3IgKGogPSAwLCBrID0gZXZlbnRzLmxlbmd0aDsgaiA8IGs7IGorKykge1xuICAgICAgICAgICAgZXYgPSBldmVudHNbal07XG4gICAgICAgICAgICBpZiAoKGNhbGxiYWNrICYmIGNhbGxiYWNrICE9PSBldi5jYWxsYmFjayAmJiBjYWxsYmFjayAhPT0gZXYuY2FsbGJhY2suX2NhbGxiYWNrKSB8fFxuICAgICAgICAgICAgICAgIChjb250ZXh0ICYmIGNvbnRleHQgIT09IGV2LmNvbnRleHQpKSB7XG4gICAgICAgICAgICAgIHJldGFpbi5wdXNoKGV2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFyZXRhaW4ubGVuZ3RoKSBkZWxldGUgdGhpcy5fZXZlbnRzW25hbWVdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIFRyaWdnZXIgb25lIG9yIG1hbnkgZXZlbnRzLCBmaXJpbmcgYWxsIGJvdW5kIGNhbGxiYWNrcy4gQ2FsbGJhY2tzIGFyZVxuICAvLyBwYXNzZWQgdGhlIHNhbWUgYXJndW1lbnRzIGFzIGB0cmlnZ2VyYCBpcywgYXBhcnQgZnJvbSB0aGUgZXZlbnQgbmFtZVxuICAvLyAodW5sZXNzIHlvdSdyZSBsaXN0ZW5pbmcgb24gYFwiYWxsXCJgLCB3aGljaCB3aWxsIGNhdXNlIHlvdXIgY2FsbGJhY2sgdG9cbiAgLy8gcmVjZWl2ZSB0aGUgdHJ1ZSBuYW1lIG9mIHRoZSBldmVudCBhcyB0aGUgZmlyc3QgYXJndW1lbnQpLlxuICB0cmlnZ2VyOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMpIHJldHVybiB0aGlzO1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGlmICghZXZlbnRzQXBpKHRoaXMsICd0cmlnZ2VyJywgbmFtZSwgYXJncykpIHJldHVybiB0aGlzO1xuICAgIHZhciBldmVudHMgPSB0aGlzLl9ldmVudHNbbmFtZV07XG4gICAgdmFyIGFsbEV2ZW50cyA9IHRoaXMuX2V2ZW50cy5hbGw7XG4gICAgaWYgKGV2ZW50cykgdHJpZ2dlckV2ZW50cyhldmVudHMsIGFyZ3MpO1xuICAgIGlmIChhbGxFdmVudHMpIHRyaWdnZXJFdmVudHMoYWxsRXZlbnRzLCBhcmd1bWVudHMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIFRlbGwgdGhpcyBvYmplY3QgdG8gc3RvcCBsaXN0ZW5pbmcgdG8gZWl0aGVyIHNwZWNpZmljIGV2ZW50cyAuLi4gb3JcbiAgLy8gdG8gZXZlcnkgb2JqZWN0IGl0J3MgY3VycmVudGx5IGxpc3RlbmluZyB0by5cbiAgc3RvcExpc3RlbmluZzogZnVuY3Rpb24ob2JqLCBuYW1lLCBjYWxsYmFjaykge1xuICAgIHZhciBsaXN0ZW5pbmdUbyA9IHRoaXMuX2xpc3RlbmluZ1RvO1xuICAgIGlmICghbGlzdGVuaW5nVG8pIHJldHVybiB0aGlzO1xuICAgIHZhciByZW1vdmUgPSAhbmFtZSAmJiAhY2FsbGJhY2s7XG4gICAgaWYgKCFjYWxsYmFjayAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIGNhbGxiYWNrID0gdGhpcztcbiAgICBpZiAob2JqKSAobGlzdGVuaW5nVG8gPSB7fSlbb2JqLl9saXN0ZW5JZF0gPSBvYmo7XG4gICAgZm9yICh2YXIgaWQgaW4gbGlzdGVuaW5nVG8pIHtcbiAgICAgIG9iaiA9IGxpc3RlbmluZ1RvW2lkXTtcbiAgICAgIG9iai5vZmYobmFtZSwgY2FsbGJhY2ssIHRoaXMpO1xuICAgICAgaWYgKHJlbW92ZSB8fCAhT2JqZWN0LmtleXMob2JqLl9ldmVudHMpLmxlbmd0aCkgZGVsZXRlIHRoaXMuX2xpc3RlbmluZ1RvW2lkXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxufTtcblxuLy8gUmVndWxhciBleHByZXNzaW9uIHVzZWQgdG8gc3BsaXQgZXZlbnQgc3RyaW5ncy5cbnZhciBldmVudFNwbGl0dGVyID0gL1xccysvO1xuXG4vLyBJbXBsZW1lbnQgZmFuY3kgZmVhdHVyZXMgb2YgdGhlIEV2ZW50cyBBUEkgc3VjaCBhcyBtdWx0aXBsZSBldmVudFxuLy8gbmFtZXMgYFwiY2hhbmdlIGJsdXJcImAgYW5kIGpRdWVyeS1zdHlsZSBldmVudCBtYXBzIGB7Y2hhbmdlOiBhY3Rpb259YFxuLy8gaW4gdGVybXMgb2YgdGhlIGV4aXN0aW5nIEFQSS5cbnZhciBldmVudHNBcGkgPSBmdW5jdGlvbihvYmosIGFjdGlvbiwgbmFtZSwgcmVzdCkge1xuICBpZiAoIW5hbWUpIHJldHVybiB0cnVlO1xuXG4gIC8vIEhhbmRsZSBldmVudCBtYXBzLlxuICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgZm9yICh2YXIga2V5IGluIG5hbWUpIHtcbiAgICAgIG9ialthY3Rpb25dLmFwcGx5KG9iaiwgW2tleSwgbmFtZVtrZXldXS5jb25jYXQocmVzdCkpO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBIYW5kbGUgc3BhY2Ugc2VwYXJhdGVkIGV2ZW50IG5hbWVzLlxuICBpZiAoZXZlbnRTcGxpdHRlci50ZXN0KG5hbWUpKSB7XG4gICAgdmFyIG5hbWVzID0gbmFtZS5zcGxpdChldmVudFNwbGl0dGVyKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgb2JqW2FjdGlvbl0uYXBwbHkob2JqLCBbbmFtZXNbaV1dLmNvbmNhdChyZXN0KSk7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuLy8gQSBkaWZmaWN1bHQtdG8tYmVsaWV2ZSwgYnV0IG9wdGltaXplZCBpbnRlcm5hbCBkaXNwYXRjaCBmdW5jdGlvbiBmb3Jcbi8vIHRyaWdnZXJpbmcgZXZlbnRzLiBUcmllcyB0byBrZWVwIHRoZSB1c3VhbCBjYXNlcyBzcGVlZHkgKG1vc3QgaW50ZXJuYWxcbi8vIEJhY2tib25lIGV2ZW50cyBoYXZlIDMgYXJndW1lbnRzKS5cbnZhciB0cmlnZ2VyRXZlbnRzID0gZnVuY3Rpb24oZXZlbnRzLCBhcmdzKSB7XG4gIHZhciBldiwgaSA9IC0xLCBsID0gZXZlbnRzLmxlbmd0aCwgYTEgPSBhcmdzWzBdLCBhMiA9IGFyZ3NbMV0sIGEzID0gYXJnc1syXTtcbiAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgIGNhc2UgMDogd2hpbGUgKCsraSA8IGwpIChldiA9IGV2ZW50c1tpXSkuY2FsbGJhY2suY2FsbChldi5jdHgpOyByZXR1cm47XG4gICAgY2FzZSAxOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCwgYTEpOyByZXR1cm47XG4gICAgY2FzZSAyOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCwgYTEsIGEyKTsgcmV0dXJuO1xuICAgIGNhc2UgMzogd2hpbGUgKCsraSA8IGwpIChldiA9IGV2ZW50c1tpXSkuY2FsbGJhY2suY2FsbChldi5jdHgsIGExLCBhMiwgYTMpOyByZXR1cm47XG4gICAgZGVmYXVsdDogd2hpbGUgKCsraSA8IGwpIChldiA9IGV2ZW50c1tpXSkuY2FsbGJhY2suYXBwbHkoZXYuY3R4LCBhcmdzKTsgcmV0dXJuO1xuICB9XG59O1xuXG52YXIgbGlzdGVuTWV0aG9kcyA9IHtsaXN0ZW5UbzogJ29uJywgbGlzdGVuVG9PbmNlOiAnb25jZSd9O1xuXG4vLyBJbnZlcnNpb24tb2YtY29udHJvbCB2ZXJzaW9ucyBvZiBgb25gIGFuZCBgb25jZWAuIFRlbGwgKnRoaXMqIG9iamVjdCB0b1xuLy8gbGlzdGVuIHRvIGFuIGV2ZW50IGluIGFub3RoZXIgb2JqZWN0IC4uLiBrZWVwaW5nIHRyYWNrIG9mIHdoYXQgaXQnc1xuLy8gbGlzdGVuaW5nIHRvLlxuT2JqZWN0LmtleXMobGlzdGVuTWV0aG9kcykuZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgdmFyIGltcGxlbWVudGF0aW9uID0gbGlzdGVuTWV0aG9kc1ttZXRob2RdO1xuICBFdmVudHNbbWV0aG9kXSA9IGZ1bmN0aW9uKG9iaiwgbmFtZSwgY2FsbGJhY2spIHtcbiAgICB2YXIgbGlzdGVuaW5nVG8gPSB0aGlzLl9saXN0ZW5pbmdUbyB8fCAodGhpcy5fbGlzdGVuaW5nVG8gPSB7fSk7XG4gICAgdmFyIGlkID0gb2JqLl9saXN0ZW5JZCB8fCAob2JqLl9saXN0ZW5JZCA9IF8udW5pcXVlSWQoJ2wnKSk7XG4gICAgbGlzdGVuaW5nVG9baWRdID0gb2JqO1xuICAgIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSBjYWxsYmFjayA9IHRoaXM7XG4gICAgb2JqW2ltcGxlbWVudGF0aW9uXShuYW1lLCBjYWxsYmFjaywgdGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG59KTtcblxuLy8gQWxpYXNlcyBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG5FdmVudHMuYmluZCAgID0gRXZlbnRzLm9uO1xuRXZlbnRzLnVuYmluZCA9IEV2ZW50cy5vZmY7XG5cbi8vIEFsbG93IHRoZSBgQmFja2JvbmVgIG9iamVjdCB0byBzZXJ2ZSBhcyBhIGdsb2JhbCBldmVudCBidXMsIGZvciBmb2xrcyB3aG9cbi8vIHdhbnQgZ2xvYmFsIFwicHVic3ViXCIgaW4gYSBjb252ZW5pZW50IHBsYWNlLlxuXy5leHRlbmQoQmFja2JvbmUsIEV2ZW50cyk7XG4vLyBCYWNrYm9uZS5Nb2RlbFxuLy8gLS0tLS0tLS0tLS0tLS1cblxuLy8gQmFja2JvbmUgKipNb2RlbHMqKiBhcmUgdGhlIGJhc2ljIGRhdGEgb2JqZWN0IGluIHRoZSBmcmFtZXdvcmsgLS1cbi8vIGZyZXF1ZW50bHkgcmVwcmVzZW50aW5nIGEgcm93IGluIGEgdGFibGUgaW4gYSBkYXRhYmFzZSBvbiB5b3VyIHNlcnZlci5cbi8vIEEgZGlzY3JldGUgY2h1bmsgb2YgZGF0YSBhbmQgYSBidW5jaCBvZiB1c2VmdWwsIHJlbGF0ZWQgbWV0aG9kcyBmb3Jcbi8vIHBlcmZvcm1pbmcgY29tcHV0YXRpb25zIGFuZCB0cmFuc2Zvcm1hdGlvbnMgb24gdGhhdCBkYXRhLlxuXG4vLyBDcmVhdGUgYSBuZXcgbW9kZWwgd2l0aCB0aGUgc3BlY2lmaWVkIGF0dHJpYnV0ZXMuIEEgY2xpZW50IGlkIChgY2lkYClcbi8vIGlzIGF1dG9tYXRpY2FsbHkgZ2VuZXJhdGVkIGFuZCBhc3NpZ25lZCBmb3IgeW91LlxudmFyIE1vZGVsID0gQmFja2JvbmUuTW9kZWwgPSBmdW5jdGlvbihhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG4gIHZhciBhdHRycyA9IGF0dHJpYnV0ZXMgfHwge307XG4gIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG4gIHRoaXMuY2lkID0gXy51bmlxdWVJZCgnYycpO1xuICB0aGlzLmF0dHJpYnV0ZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBpZiAob3B0aW9ucy5jb2xsZWN0aW9uKSB0aGlzLmNvbGxlY3Rpb24gPSBvcHRpb25zLmNvbGxlY3Rpb247XG4gIGlmIChvcHRpb25zLnBhcnNlKSBhdHRycyA9IHRoaXMucGFyc2UoYXR0cnMsIG9wdGlvbnMpIHx8IHt9O1xuICBhdHRycyA9IF8uZGVmYXVsdHMoe30sIGF0dHJzLCBfLnJlc3VsdCh0aGlzLCAnZGVmYXVsdHMnKSk7XG4gIHRoaXMuc2V0KGF0dHJzLCBvcHRpb25zKTtcbiAgdGhpcy5jaGFuZ2VkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgdGhpcy5pbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG4vLyBBdHRhY2ggYWxsIGluaGVyaXRhYmxlIG1ldGhvZHMgdG8gdGhlIE1vZGVsIHByb3RvdHlwZS5cbl8uZXh0ZW5kKE1vZGVsLnByb3RvdHlwZSwgRXZlbnRzLCB7XG5cbiAgLy8gQSBoYXNoIG9mIGF0dHJpYnV0ZXMgd2hvc2UgY3VycmVudCBhbmQgcHJldmlvdXMgdmFsdWUgZGlmZmVyLlxuICBjaGFuZ2VkOiBudWxsLFxuXG4gIC8vIFRoZSB2YWx1ZSByZXR1cm5lZCBkdXJpbmcgdGhlIGxhc3QgZmFpbGVkIHZhbGlkYXRpb24uXG4gIHZhbGlkYXRpb25FcnJvcjogbnVsbCxcblxuICAvLyBUaGUgZGVmYXVsdCBuYW1lIGZvciB0aGUgSlNPTiBgaWRgIGF0dHJpYnV0ZSBpcyBgXCJpZFwiYC4gTW9uZ29EQiBhbmRcbiAgLy8gQ291Y2hEQiB1c2VycyBtYXkgd2FudCB0byBzZXQgdGhpcyB0byBgXCJfaWRcImAuXG4gIGlkQXR0cmlidXRlOiAnaWQnLFxuXG4gIC8vIEluaXRpYWxpemUgaXMgYW4gZW1wdHkgZnVuY3Rpb24gYnkgZGVmYXVsdC4gT3ZlcnJpZGUgaXQgd2l0aCB5b3VyIG93blxuICAvLyBpbml0aWFsaXphdGlvbiBsb2dpYy5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oKXt9LFxuXG4gIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG1vZGVsJ3MgYGF0dHJpYnV0ZXNgIG9iamVjdC5cbiAgdG9KU09OOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCB0aGlzLmF0dHJpYnV0ZXMpO1xuICB9LFxuXG4gIC8vIFByb3h5IGBCYWNrYm9uZS5zeW5jYCBieSBkZWZhdWx0IC0tIGJ1dCBvdmVycmlkZSB0aGlzIGlmIHlvdSBuZWVkXG4gIC8vIGN1c3RvbSBzeW5jaW5nIHNlbWFudGljcyBmb3IgKnRoaXMqIHBhcnRpY3VsYXIgbW9kZWwuXG4gIHN5bmM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBCYWNrYm9uZS5zeW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH0sXG5cbiAgLy8gR2V0IHRoZSB2YWx1ZSBvZiBhbiBhdHRyaWJ1dGUuXG4gIGdldDogZnVuY3Rpb24oYXR0cikge1xuICAgIHJldHVybiB0aGlzLmF0dHJpYnV0ZXNbYXR0cl07XG4gIH0sXG5cbiAgLy8gR2V0IHRoZSBIVE1MLWVzY2FwZWQgdmFsdWUgb2YgYW4gYXR0cmlidXRlLlxuICBlc2NhcGU6IGZ1bmN0aW9uKGF0dHIpIHtcbiAgICByZXR1cm4gXy5lc2NhcGUodGhpcy5nZXQoYXR0cikpO1xuICB9LFxuXG4gIC8vIFJldHVybnMgYHRydWVgIGlmIHRoZSBhdHRyaWJ1dGUgY29udGFpbnMgYSB2YWx1ZSB0aGF0IGlzIG5vdCBudWxsXG4gIC8vIG9yIHVuZGVmaW5lZC5cbiAgaGFzOiBmdW5jdGlvbihhdHRyKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0KGF0dHIpICE9IG51bGw7XG4gIH0sXG5cbiAgLy8gU2V0IGEgaGFzaCBvZiBtb2RlbCBhdHRyaWJ1dGVzIG9uIHRoZSBvYmplY3QsIGZpcmluZyBgXCJjaGFuZ2VcImAuIFRoaXMgaXNcbiAgLy8gdGhlIGNvcmUgcHJpbWl0aXZlIG9wZXJhdGlvbiBvZiBhIG1vZGVsLCB1cGRhdGluZyB0aGUgZGF0YSBhbmQgbm90aWZ5aW5nXG4gIC8vIGFueW9uZSB3aG8gbmVlZHMgdG8ga25vdyBhYm91dCB0aGUgY2hhbmdlIGluIHN0YXRlLiBUaGUgaGVhcnQgb2YgdGhlIGJlYXN0LlxuICBzZXQ6IGZ1bmN0aW9uKGtleSwgdmFsLCBvcHRpb25zKSB7XG4gICAgdmFyIGF0dHIsIGF0dHJzLCB1bnNldCwgY2hhbmdlcywgc2lsZW50LCBjaGFuZ2luZywgcHJldiwgY3VycmVudDtcbiAgICBpZiAoa2V5ID09IG51bGwpIHJldHVybiB0aGlzO1xuXG4gICAgLy8gSGFuZGxlIGJvdGggYFwia2V5XCIsIHZhbHVlYCBhbmQgYHtrZXk6IHZhbHVlfWAgLXN0eWxlIGFyZ3VtZW50cy5cbiAgICBpZiAodHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGF0dHJzID0ga2V5O1xuICAgICAgb3B0aW9ucyA9IHZhbDtcbiAgICB9IGVsc2Uge1xuICAgICAgKGF0dHJzID0ge30pW2tleV0gPSB2YWw7XG4gICAgfVxuXG4gICAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IHt9KTtcblxuICAgIC8vIFJ1biB2YWxpZGF0aW9uLlxuICAgIGlmICghdGhpcy5fdmFsaWRhdGUoYXR0cnMsIG9wdGlvbnMpKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBFeHRyYWN0IGF0dHJpYnV0ZXMgYW5kIG9wdGlvbnMuXG4gICAgdW5zZXQgICAgICAgICAgID0gb3B0aW9ucy51bnNldDtcbiAgICBzaWxlbnQgICAgICAgICAgPSBvcHRpb25zLnNpbGVudDtcbiAgICBjaGFuZ2VzICAgICAgICAgPSBbXTtcbiAgICBjaGFuZ2luZyAgICAgICAgPSB0aGlzLl9jaGFuZ2luZztcbiAgICB0aGlzLl9jaGFuZ2luZyAgPSB0cnVlO1xuXG4gICAgaWYgKCFjaGFuZ2luZykge1xuICAgICAgdGhpcy5fcHJldmlvdXNBdHRyaWJ1dGVzID0gXy5leHRlbmQoT2JqZWN0LmNyZWF0ZShudWxsKSwgdGhpcy5hdHRyaWJ1dGVzKTtcbiAgICAgIHRoaXMuY2hhbmdlZCA9IHt9O1xuICAgIH1cbiAgICBjdXJyZW50ID0gdGhpcy5hdHRyaWJ1dGVzLCBwcmV2ID0gdGhpcy5fcHJldmlvdXNBdHRyaWJ1dGVzO1xuXG4gICAgLy8gQ2hlY2sgZm9yIGNoYW5nZXMgb2YgYGlkYC5cbiAgICBpZiAodGhpcy5pZEF0dHJpYnV0ZSBpbiBhdHRycykgdGhpcy5pZCA9IGF0dHJzW3RoaXMuaWRBdHRyaWJ1dGVdO1xuXG4gICAgLy8gRm9yIGVhY2ggYHNldGAgYXR0cmlidXRlLCB1cGRhdGUgb3IgZGVsZXRlIHRoZSBjdXJyZW50IHZhbHVlLlxuICAgIGZvciAoYXR0ciBpbiBhdHRycykge1xuICAgICAgdmFsID0gYXR0cnNbYXR0cl07XG4gICAgICBpZiAoIV8uaXNFcXVhbChjdXJyZW50W2F0dHJdLCB2YWwpKSBjaGFuZ2VzLnB1c2goYXR0cik7XG4gICAgICBpZiAoIV8uaXNFcXVhbChwcmV2W2F0dHJdLCB2YWwpKSB7XG4gICAgICAgIHRoaXMuY2hhbmdlZFthdHRyXSA9IHZhbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmNoYW5nZWRbYXR0cl07XG4gICAgICB9XG4gICAgICB1bnNldCA/IGRlbGV0ZSBjdXJyZW50W2F0dHJdIDogY3VycmVudFthdHRyXSA9IHZhbDtcbiAgICB9XG5cbiAgICAvLyBUcmlnZ2VyIGFsbCByZWxldmFudCBhdHRyaWJ1dGUgY2hhbmdlcy5cbiAgICBpZiAoIXNpbGVudCkge1xuICAgICAgaWYgKGNoYW5nZXMubGVuZ3RoKSB0aGlzLl9wZW5kaW5nID0gb3B0aW9ucztcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2hhbmdlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2U6JyArIGNoYW5nZXNbaV0sIHRoaXMsIGN1cnJlbnRbY2hhbmdlc1tpXV0sIG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFlvdSBtaWdodCBiZSB3b25kZXJpbmcgd2h5IHRoZXJlJ3MgYSBgd2hpbGVgIGxvb3AgaGVyZS4gQ2hhbmdlcyBjYW5cbiAgICAvLyBiZSByZWN1cnNpdmVseSBuZXN0ZWQgd2l0aGluIGBcImNoYW5nZVwiYCBldmVudHMuXG4gICAgaWYgKGNoYW5naW5nKSByZXR1cm4gdGhpcztcbiAgICBpZiAoIXNpbGVudCkge1xuICAgICAgd2hpbGUgKHRoaXMuX3BlbmRpbmcpIHtcbiAgICAgICAgb3B0aW9ucyA9IHRoaXMuX3BlbmRpbmc7XG4gICAgICAgIHRoaXMuX3BlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2UnLCB0aGlzLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fcGVuZGluZyA9IGZhbHNlO1xuICAgIHRoaXMuX2NoYW5naW5nID0gZmFsc2U7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLy8gUmVtb3ZlIGFuIGF0dHJpYnV0ZSBmcm9tIHRoZSBtb2RlbCwgZmlyaW5nIGBcImNoYW5nZVwiYC4gYHVuc2V0YCBpcyBhIG5vb3BcbiAgLy8gaWYgdGhlIGF0dHJpYnV0ZSBkb2Vzbid0IGV4aXN0LlxuICB1bnNldDogZnVuY3Rpb24oYXR0ciwgb3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLnNldChhdHRyLCB2b2lkIDAsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7dW5zZXQ6IHRydWV9KSk7XG4gIH0sXG5cbiAgLy8gQ2xlYXIgYWxsIGF0dHJpYnV0ZXMgb24gdGhlIG1vZGVsLCBmaXJpbmcgYFwiY2hhbmdlXCJgLlxuICBjbGVhcjogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHZhciBhdHRycyA9IHt9O1xuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLmF0dHJpYnV0ZXMpIGF0dHJzW2tleV0gPSB2b2lkIDA7XG4gICAgcmV0dXJuIHRoaXMuc2V0KGF0dHJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywge3Vuc2V0OiB0cnVlfSkpO1xuICB9LFxuXG4gIC8vIERldGVybWluZSBpZiB0aGUgbW9kZWwgaGFzIGNoYW5nZWQgc2luY2UgdGhlIGxhc3QgYFwiY2hhbmdlXCJgIGV2ZW50LlxuICAvLyBJZiB5b3Ugc3BlY2lmeSBhbiBhdHRyaWJ1dGUgbmFtZSwgZGV0ZXJtaW5lIGlmIHRoYXQgYXR0cmlidXRlIGhhcyBjaGFuZ2VkLlxuICBoYXNDaGFuZ2VkOiBmdW5jdGlvbihhdHRyKSB7XG4gICAgaWYgKGF0dHIgPT0gbnVsbCkgcmV0dXJuICEhT2JqZWN0LmtleXModGhpcy5jaGFuZ2VkKS5sZW5ndGg7XG4gICAgcmV0dXJuIF8uaGFzKHRoaXMuY2hhbmdlZCwgYXR0cik7XG4gIH0sXG5cbiAgLy8gUmV0dXJuIGFuIG9iamVjdCBjb250YWluaW5nIGFsbCB0aGUgYXR0cmlidXRlcyB0aGF0IGhhdmUgY2hhbmdlZCwgb3JcbiAgLy8gZmFsc2UgaWYgdGhlcmUgYXJlIG5vIGNoYW5nZWQgYXR0cmlidXRlcy4gVXNlZnVsIGZvciBkZXRlcm1pbmluZyB3aGF0XG4gIC8vIHBhcnRzIG9mIGEgdmlldyBuZWVkIHRvIGJlIHVwZGF0ZWQgYW5kL29yIHdoYXQgYXR0cmlidXRlcyBuZWVkIHRvIGJlXG4gIC8vIHBlcnNpc3RlZCB0byB0aGUgc2VydmVyLiBVbnNldCBhdHRyaWJ1dGVzIHdpbGwgYmUgc2V0IHRvIHVuZGVmaW5lZC5cbiAgLy8gWW91IGNhbiBhbHNvIHBhc3MgYW4gYXR0cmlidXRlcyBvYmplY3QgdG8gZGlmZiBhZ2FpbnN0IHRoZSBtb2RlbCxcbiAgLy8gZGV0ZXJtaW5pbmcgaWYgdGhlcmUgKndvdWxkIGJlKiBhIGNoYW5nZS5cbiAgY2hhbmdlZEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKGRpZmYpIHtcbiAgICBpZiAoIWRpZmYpIHJldHVybiB0aGlzLmhhc0NoYW5nZWQoKSA/IF8uZXh0ZW5kKE9iamVjdC5jcmVhdGUobnVsbCksIHRoaXMuY2hhbmdlZCkgOiBmYWxzZTtcbiAgICB2YXIgdmFsLCBjaGFuZ2VkID0gZmFsc2U7XG4gICAgdmFyIG9sZCA9IHRoaXMuX2NoYW5naW5nID8gdGhpcy5fcHJldmlvdXNBdHRyaWJ1dGVzIDogdGhpcy5hdHRyaWJ1dGVzO1xuICAgIGZvciAodmFyIGF0dHIgaW4gZGlmZikge1xuICAgICAgaWYgKF8uaXNFcXVhbChvbGRbYXR0cl0sICh2YWwgPSBkaWZmW2F0dHJdKSkpIGNvbnRpbnVlO1xuICAgICAgKGNoYW5nZWQgfHwgKGNoYW5nZWQgPSB7fSkpW2F0dHJdID0gdmFsO1xuICAgIH1cbiAgICByZXR1cm4gY2hhbmdlZDtcbiAgfSxcblxuICAvLyBHZXQgdGhlIHByZXZpb3VzIHZhbHVlIG9mIGFuIGF0dHJpYnV0ZSwgcmVjb3JkZWQgYXQgdGhlIHRpbWUgdGhlIGxhc3RcbiAgLy8gYFwiY2hhbmdlXCJgIGV2ZW50IHdhcyBmaXJlZC5cbiAgcHJldmlvdXM6IGZ1bmN0aW9uKGF0dHIpIHtcbiAgICBpZiAoYXR0ciA9PSBudWxsIHx8ICF0aGlzLl9wcmV2aW91c0F0dHJpYnV0ZXMpIHJldHVybiBudWxsO1xuICAgIHJldHVybiB0aGlzLl9wcmV2aW91c0F0dHJpYnV0ZXNbYXR0cl07XG4gIH0sXG5cbiAgLy8gR2V0IGFsbCBvZiB0aGUgYXR0cmlidXRlcyBvZiB0aGUgbW9kZWwgYXQgdGhlIHRpbWUgb2YgdGhlIHByZXZpb3VzXG4gIC8vIGBcImNoYW5nZVwiYCBldmVudC5cbiAgcHJldmlvdXNBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXy5leHRlbmQoT2JqZWN0LmNyZWF0ZShudWxsKSwgdGhpcy5fcHJldmlvdXNBdHRyaWJ1dGVzKTtcbiAgfSxcblxuICAvLyBGZXRjaCB0aGUgbW9kZWwgZnJvbSB0aGUgc2VydmVyLiBJZiB0aGUgc2VydmVyJ3MgcmVwcmVzZW50YXRpb24gb2YgdGhlXG4gIC8vIG1vZGVsIGRpZmZlcnMgZnJvbSBpdHMgY3VycmVudCBhdHRyaWJ1dGVzLCB0aGV5IHdpbGwgYmUgb3ZlcnJpZGRlbixcbiAgLy8gdHJpZ2dlcmluZyBhIGBcImNoYW5nZVwiYCBldmVudC5cbiAgZmV0Y2g6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyA/IF8uZXh0ZW5kKHt9LCBvcHRpb25zKSA6IHt9O1xuICAgIGlmIChvcHRpb25zLnBhcnNlID09PSB2b2lkIDApIG9wdGlvbnMucGFyc2UgPSB0cnVlO1xuICAgIHZhciBtb2RlbCA9IHRoaXM7XG4gICAgdmFyIHN1Y2Nlc3MgPSBvcHRpb25zLnN1Y2Nlc3M7XG4gICAgb3B0aW9ucy5zdWNjZXNzID0gZnVuY3Rpb24ocmVzcCkge1xuICAgICAgaWYgKCFtb2RlbC5zZXQobW9kZWwucGFyc2UocmVzcCwgb3B0aW9ucyksIG9wdGlvbnMpKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAoc3VjY2Vzcykgc3VjY2Vzcyhtb2RlbCwgcmVzcCwgb3B0aW9ucyk7XG4gICAgICBtb2RlbC50cmlnZ2VyKCdzeW5jJywgbW9kZWwsIHJlc3AsIG9wdGlvbnMpO1xuICAgIH07XG4gICAgd3JhcEVycm9yKHRoaXMsIG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLnN5bmMoJ3JlYWQnLCB0aGlzLCBvcHRpb25zKTtcbiAgfSxcblxuICAvLyBTZXQgYSBoYXNoIG9mIG1vZGVsIGF0dHJpYnV0ZXMsIGFuZCBzeW5jIHRoZSBtb2RlbCB0byB0aGUgc2VydmVyLlxuICAvLyBJZiB0aGUgc2VydmVyIHJldHVybnMgYW4gYXR0cmlidXRlcyBoYXNoIHRoYXQgZGlmZmVycywgdGhlIG1vZGVsJ3NcbiAgLy8gc3RhdGUgd2lsbCBiZSBgc2V0YCBhZ2Fpbi5cbiAgc2F2ZTogZnVuY3Rpb24oa2V5LCB2YWwsIG9wdGlvbnMpIHtcbiAgICB2YXIgYXR0cnMsIG1ldGhvZCwgeGhyLCBhdHRyaWJ1dGVzID0gdGhpcy5hdHRyaWJ1dGVzO1xuXG4gICAgLy8gSGFuZGxlIGJvdGggYFwia2V5XCIsIHZhbHVlYCBhbmQgYHtrZXk6IHZhbHVlfWAgLXN0eWxlIGFyZ3VtZW50cy5cbiAgICBpZiAoa2V5ID09IG51bGwgfHwgdHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGF0dHJzID0ga2V5O1xuICAgICAgb3B0aW9ucyA9IHZhbDtcbiAgICB9IGVsc2Uge1xuICAgICAgKGF0dHJzID0ge30pW2tleV0gPSB2YWw7XG4gICAgfVxuXG4gICAgb3B0aW9ucyA9IF8uZXh0ZW5kKHt2YWxpZGF0ZTogdHJ1ZX0sIG9wdGlvbnMpO1xuXG4gICAgLy8gSWYgd2UncmUgbm90IHdhaXRpbmcgYW5kIGF0dHJpYnV0ZXMgZXhpc3QsIHNhdmUgYWN0cyBhc1xuICAgIC8vIGBzZXQoYXR0cikuc2F2ZShudWxsLCBvcHRzKWAgd2l0aCB2YWxpZGF0aW9uLiBPdGhlcndpc2UsIGNoZWNrIGlmXG4gICAgLy8gdGhlIG1vZGVsIHdpbGwgYmUgdmFsaWQgd2hlbiB0aGUgYXR0cmlidXRlcywgaWYgYW55LCBhcmUgc2V0LlxuICAgIGlmIChhdHRycyAmJiAhb3B0aW9ucy53YWl0KSB7XG4gICAgICBpZiAoIXRoaXMuc2V0KGF0dHJzLCBvcHRpb25zKSkgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXRoaXMuX3ZhbGlkYXRlKGF0dHJzLCBvcHRpb25zKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFNldCB0ZW1wb3JhcnkgYXR0cmlidXRlcyBpZiBge3dhaXQ6IHRydWV9YC5cbiAgICBpZiAoYXR0cnMgJiYgb3B0aW9ucy53YWl0KSB7XG4gICAgICB0aGlzLmF0dHJpYnV0ZXMgPSBfLmV4dGVuZChPYmplY3QuY3JlYXRlKG51bGwpLCBhdHRyaWJ1dGVzLCBhdHRycyk7XG4gICAgfVxuXG4gICAgLy8gQWZ0ZXIgYSBzdWNjZXNzZnVsIHNlcnZlci1zaWRlIHNhdmUsIHRoZSBjbGllbnQgaXMgKG9wdGlvbmFsbHkpXG4gICAgLy8gdXBkYXRlZCB3aXRoIHRoZSBzZXJ2ZXItc2lkZSBzdGF0ZS5cbiAgICBpZiAob3B0aW9ucy5wYXJzZSA9PT0gdm9pZCAwKSBvcHRpb25zLnBhcnNlID0gdHJ1ZTtcbiAgICB2YXIgbW9kZWwgPSB0aGlzO1xuICAgIHZhciBzdWNjZXNzID0gb3B0aW9ucy5zdWNjZXNzO1xuICAgIG9wdGlvbnMuc3VjY2VzcyA9IGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgIC8vIEVuc3VyZSBhdHRyaWJ1dGVzIGFyZSByZXN0b3JlZCBkdXJpbmcgc3luY2hyb25vdXMgc2F2ZXMuXG4gICAgICBtb2RlbC5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcbiAgICAgIHZhciBzZXJ2ZXJBdHRycyA9IG1vZGVsLnBhcnNlKHJlc3AsIG9wdGlvbnMpO1xuICAgICAgaWYgKG9wdGlvbnMud2FpdCkgc2VydmVyQXR0cnMgPSBfLmV4dGVuZChhdHRycyB8fCB7fSwgc2VydmVyQXR0cnMpO1xuICAgICAgaWYgKHNlcnZlckF0dHJzICYmIHR5cGVvZiBzZXJ2ZXJBdHRycyA9PT0gJ29iamVjdCcgJiYgIW1vZGVsLnNldChzZXJ2ZXJBdHRycywgb3B0aW9ucykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKHN1Y2Nlc3MpIHN1Y2Nlc3MobW9kZWwsIHJlc3AsIG9wdGlvbnMpO1xuICAgICAgbW9kZWwudHJpZ2dlcignc3luYycsIG1vZGVsLCByZXNwLCBvcHRpb25zKTtcbiAgICB9O1xuICAgIHdyYXBFcnJvcih0aGlzLCBvcHRpb25zKTtcblxuICAgIG1ldGhvZCA9IHRoaXMuaXNOZXcoKSA/ICdjcmVhdGUnIDogKG9wdGlvbnMucGF0Y2ggPyAncGF0Y2gnIDogJ3VwZGF0ZScpO1xuICAgIGlmIChtZXRob2QgPT09ICdwYXRjaCcpIG9wdGlvbnMuYXR0cnMgPSBhdHRycztcbiAgICB4aHIgPSB0aGlzLnN5bmMobWV0aG9kLCB0aGlzLCBvcHRpb25zKTtcblxuICAgIC8vIFJlc3RvcmUgYXR0cmlidXRlcy5cbiAgICBpZiAoYXR0cnMgJiYgb3B0aW9ucy53YWl0KSB0aGlzLmF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzO1xuXG4gICAgcmV0dXJuIHhocjtcbiAgfSxcblxuICAvLyBEZXN0cm95IHRoaXMgbW9kZWwgb24gdGhlIHNlcnZlciBpZiBpdCB3YXMgYWxyZWFkeSBwZXJzaXN0ZWQuXG4gIC8vIE9wdGltaXN0aWNhbGx5IHJlbW92ZXMgdGhlIG1vZGVsIGZyb20gaXRzIGNvbGxlY3Rpb24sIGlmIGl0IGhhcyBvbmUuXG4gIC8vIElmIGB3YWl0OiB0cnVlYCBpcyBwYXNzZWQsIHdhaXRzIGZvciB0aGUgc2VydmVyIHRvIHJlc3BvbmQgYmVmb3JlIHJlbW92YWwuXG4gIGRlc3Ryb3k6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyA/IF8uZXh0ZW5kKHt9LCBvcHRpb25zKSA6IHt9O1xuICAgIHZhciBtb2RlbCA9IHRoaXM7XG4gICAgdmFyIHN1Y2Nlc3MgPSBvcHRpb25zLnN1Y2Nlc3M7XG5cbiAgICB2YXIgZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgICAgbW9kZWwudHJpZ2dlcignZGVzdHJveScsIG1vZGVsLCBtb2RlbC5jb2xsZWN0aW9uLCBvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgb3B0aW9ucy5zdWNjZXNzID0gZnVuY3Rpb24ocmVzcCkge1xuICAgICAgaWYgKG9wdGlvbnMud2FpdCB8fCBtb2RlbC5pc05ldygpKSBkZXN0cm95KCk7XG4gICAgICBpZiAoc3VjY2Vzcykgc3VjY2Vzcyhtb2RlbCwgcmVzcCwgb3B0aW9ucyk7XG4gICAgICBpZiAoIW1vZGVsLmlzTmV3KCkpIG1vZGVsLnRyaWdnZXIoJ3N5bmMnLCBtb2RlbCwgcmVzcCwgb3B0aW9ucyk7XG4gICAgfTtcblxuICAgIGlmICh0aGlzLmlzTmV3KCkpIHtcbiAgICAgIG9wdGlvbnMuc3VjY2VzcygpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB3cmFwRXJyb3IodGhpcywgb3B0aW9ucyk7XG5cbiAgICB2YXIgeGhyID0gdGhpcy5zeW5jKCdkZWxldGUnLCB0aGlzLCBvcHRpb25zKTtcbiAgICBpZiAoIW9wdGlvbnMud2FpdCkgZGVzdHJveSgpO1xuICAgIHJldHVybiB4aHI7XG4gIH0sXG5cbiAgLy8gRGVmYXVsdCBVUkwgZm9yIHRoZSBtb2RlbCdzIHJlcHJlc2VudGF0aW9uIG9uIHRoZSBzZXJ2ZXIgLS0gaWYgeW91J3JlXG4gIC8vIHVzaW5nIEJhY2tib25lJ3MgcmVzdGZ1bCBtZXRob2RzLCBvdmVycmlkZSB0aGlzIHRvIGNoYW5nZSB0aGUgZW5kcG9pbnRcbiAgLy8gdGhhdCB3aWxsIGJlIGNhbGxlZC5cbiAgdXJsOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgYmFzZSA9XG4gICAgICBfLnJlc3VsdCh0aGlzLCAndXJsUm9vdCcpIHx8XG4gICAgICBfLnJlc3VsdCh0aGlzLmNvbGxlY3Rpb24sICd1cmwnKSB8fFxuICAgICAgdXJsRXJyb3IoKTtcbiAgICBpZiAodGhpcy5pc05ldygpKSByZXR1cm4gYmFzZTtcbiAgICByZXR1cm4gYmFzZS5yZXBsYWNlKC8oW15cXC9dKSQvLCAnJDEvJykgKyBlbmNvZGVVUklDb21wb25lbnQodGhpcy5pZCk7XG4gIH0sXG5cbiAgLy8gKipwYXJzZSoqIGNvbnZlcnRzIGEgcmVzcG9uc2UgaW50byB0aGUgaGFzaCBvZiBhdHRyaWJ1dGVzIHRvIGJlIGBzZXRgIG9uXG4gIC8vIHRoZSBtb2RlbC4gVGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24gaXMganVzdCB0byBwYXNzIHRoZSByZXNwb25zZSBhbG9uZy5cbiAgcGFyc2U6IGZ1bmN0aW9uKHJlc3AsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gcmVzcDtcbiAgfSxcblxuICAvLyBDcmVhdGUgYSBuZXcgbW9kZWwgd2l0aCBpZGVudGljYWwgYXR0cmlidXRlcyB0byB0aGlzIG9uZS5cbiAgY2xvbmU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLmF0dHJpYnV0ZXMpO1xuICB9LFxuXG4gIC8vIEEgbW9kZWwgaXMgbmV3IGlmIGl0IGhhcyBuZXZlciBiZWVuIHNhdmVkIHRvIHRoZSBzZXJ2ZXIsIGFuZCBsYWNrcyBhbiBpZC5cbiAgaXNOZXc6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAhdGhpcy5oYXModGhpcy5pZEF0dHJpYnV0ZSk7XG4gIH0sXG5cbiAgLy8gQ2hlY2sgaWYgdGhlIG1vZGVsIGlzIGN1cnJlbnRseSBpbiBhIHZhbGlkIHN0YXRlLlxuICBpc1ZhbGlkOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuX3ZhbGlkYXRlKHt9LCBfLmV4dGVuZChvcHRpb25zIHx8IHt9LCB7IHZhbGlkYXRlOiB0cnVlIH0pKTtcbiAgfSxcblxuICAvLyBSdW4gdmFsaWRhdGlvbiBhZ2FpbnN0IHRoZSBuZXh0IGNvbXBsZXRlIHNldCBvZiBtb2RlbCBhdHRyaWJ1dGVzLFxuICAvLyByZXR1cm5pbmcgYHRydWVgIGlmIGFsbCBpcyB3ZWxsLiBPdGhlcndpc2UsIGZpcmUgYW4gYFwiaW52YWxpZFwiYCBldmVudC5cbiAgX3ZhbGlkYXRlOiBmdW5jdGlvbihhdHRycywgb3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy52YWxpZGF0ZSB8fCAhdGhpcy52YWxpZGF0ZSkgcmV0dXJuIHRydWU7XG4gICAgYXR0cnMgPSBfLmV4dGVuZChPYmplY3QuY3JlYXRlKG51bGwpLCB0aGlzLmF0dHJpYnV0ZXMsIGF0dHJzKTtcbiAgICB2YXIgZXJyb3IgPSB0aGlzLnZhbGlkYXRpb25FcnJvciA9IHRoaXMudmFsaWRhdGUoYXR0cnMsIG9wdGlvbnMpIHx8IG51bGw7XG4gICAgaWYgKCFlcnJvcikgcmV0dXJuIHRydWU7XG4gICAgdGhpcy50cmlnZ2VyKCdpbnZhbGlkJywgdGhpcywgZXJyb3IsIF8uZXh0ZW5kKG9wdGlvbnMsIHt2YWxpZGF0aW9uRXJyb3I6IGVycm9yfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG59KTtcblxuaWYgKF8ua2V5cykge1xuICAvLyBVbmRlcnNjb3JlIG1ldGhvZHMgdGhhdCB3ZSB3YW50IHRvIGltcGxlbWVudCBvbiB0aGUgTW9kZWwuXG4gIHZhciBtb2RlbE1ldGhvZHMgPSBbJ2tleXMnLCAndmFsdWVzJywgJ3BhaXJzJywgJ2ludmVydCcsICdwaWNrJywgJ29taXQnXTtcblxuICAvLyBNaXggaW4gZWFjaCBVbmRlcnNjb3JlIG1ldGhvZCBhcyBhIHByb3h5IHRvIGBNb2RlbCNhdHRyaWJ1dGVzYC5cbiAgbW9kZWxNZXRob2RzLmZpbHRlcih1dGlsRXhpc3RzKS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgIE1vZGVsLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIGFyZ3MudW5zaGlmdCh0aGlzLmF0dHJpYnV0ZXMpO1xuICAgICAgcmV0dXJuIF9bbWV0aG9kXS5hcHBseShfLCBhcmdzKTtcbiAgICB9O1xuICB9KTtcbn1cbi8vIEJhY2tib25lLkNvbGxlY3Rpb25cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLy8gSWYgbW9kZWxzIHRlbmQgdG8gcmVwcmVzZW50IGEgc2luZ2xlIHJvdyBvZiBkYXRhLCBhIEJhY2tib25lIENvbGxlY3Rpb24gaXNcbi8vIG1vcmUgYW5hbGFnb3VzIHRvIGEgdGFibGUgZnVsbCBvZiBkYXRhIC4uLiBvciBhIHNtYWxsIHNsaWNlIG9yIHBhZ2Ugb2YgdGhhdFxuLy8gdGFibGUsIG9yIGEgY29sbGVjdGlvbiBvZiByb3dzIHRoYXQgYmVsb25nIHRvZ2V0aGVyIGZvciBhIHBhcnRpY3VsYXIgcmVhc29uXG4vLyAtLSBhbGwgb2YgdGhlIG1lc3NhZ2VzIGluIHRoaXMgcGFydGljdWxhciBmb2xkZXIsIGFsbCBvZiB0aGUgZG9jdW1lbnRzXG4vLyBiZWxvbmdpbmcgdG8gdGhpcyBwYXJ0aWN1bGFyIGF1dGhvciwgYW5kIHNvIG9uLiBDb2xsZWN0aW9ucyBtYWludGFpblxuLy8gaW5kZXhlcyBvZiB0aGVpciBtb2RlbHMsIGJvdGggaW4gb3JkZXIsIGFuZCBmb3IgbG9va3VwIGJ5IGBpZGAuXG5cbi8vIENyZWF0ZSBhIG5ldyAqKkNvbGxlY3Rpb24qKiwgcGVyaGFwcyB0byBjb250YWluIGEgc3BlY2lmaWMgdHlwZSBvZiBgbW9kZWxgLlxuLy8gSWYgYSBgY29tcGFyYXRvcmAgaXMgc3BlY2lmaWVkLCB0aGUgQ29sbGVjdGlvbiB3aWxsIG1haW50YWluXG4vLyBpdHMgbW9kZWxzIGluIHNvcnQgb3JkZXIsIGFzIHRoZXkncmUgYWRkZWQgYW5kIHJlbW92ZWQuXG52YXIgQ29sbGVjdGlvbiA9IEJhY2tib25lLkNvbGxlY3Rpb24gPSBmdW5jdGlvbihtb2RlbHMsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IHt9KTtcbiAgaWYgKG9wdGlvbnMubW9kZWwpIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICBpZiAob3B0aW9ucy5jb21wYXJhdG9yICE9PSB2b2lkIDApIHRoaXMuY29tcGFyYXRvciA9IG9wdGlvbnMuY29tcGFyYXRvcjtcbiAgdGhpcy5fcmVzZXQoKTtcbiAgdGhpcy5pbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIGlmIChtb2RlbHMpIHRoaXMucmVzZXQobW9kZWxzLCBfLmV4dGVuZCh7c2lsZW50OiB0cnVlfSwgb3B0aW9ucykpO1xufTtcblxuLy8gRGVmYXVsdCBvcHRpb25zIGZvciBgQ29sbGVjdGlvbiNzZXRgLlxudmFyIHNldE9wdGlvbnMgPSB7YWRkOiB0cnVlLCByZW1vdmU6IHRydWUsIG1lcmdlOiB0cnVlfTtcbnZhciBhZGRPcHRpb25zID0ge2FkZDogdHJ1ZSwgcmVtb3ZlOiBmYWxzZX07XG5cbi8vIERlZmluZSB0aGUgQ29sbGVjdGlvbidzIGluaGVyaXRhYmxlIG1ldGhvZHMuXG5fLmV4dGVuZChDb2xsZWN0aW9uLnByb3RvdHlwZSwgRXZlbnRzLCB7XG5cbiAgLy8gVGhlIGRlZmF1bHQgbW9kZWwgZm9yIGEgY29sbGVjdGlvbiBpcyBqdXN0IGEgKipCYWNrYm9uZS5Nb2RlbCoqLlxuICAvLyBUaGlzIHNob3VsZCBiZSBvdmVycmlkZGVuIGluIG1vc3QgY2FzZXMuXG4gIG1vZGVsOiB0eXBlb2YgTW9kZWwgPT09ICd1bmRlZmluZWQnID8gbnVsbCA6IE1vZGVsLFxuXG4gIC8vIEluaXRpYWxpemUgaXMgYW4gZW1wdHkgZnVuY3Rpb24gYnkgZGVmYXVsdC4gT3ZlcnJpZGUgaXQgd2l0aCB5b3VyIG93blxuICAvLyBpbml0aWFsaXphdGlvbiBsb2dpYy5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oKXt9LFxuXG4gIC8vIFRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIGEgQ29sbGVjdGlvbiBpcyBhbiBhcnJheSBvZiB0aGVcbiAgLy8gbW9kZWxzJyBhdHRyaWJ1dGVzLlxuICB0b0pTT046IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24obW9kZWwpeyByZXR1cm4gbW9kZWwudG9KU09OKG9wdGlvbnMpOyB9KTtcbiAgfSxcblxuICAvLyBQcm94eSBgQmFja2JvbmUuc3luY2AgYnkgZGVmYXVsdC5cbiAgc3luYzogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIEJhY2tib25lLnN5bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfSxcblxuICAvLyBBZGQgYSBtb2RlbCwgb3IgbGlzdCBvZiBtb2RlbHMgdG8gdGhlIHNldC5cbiAgYWRkOiBmdW5jdGlvbihtb2RlbHMsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5zZXQobW9kZWxzLCBfLmV4dGVuZCh7bWVyZ2U6IGZhbHNlfSwgb3B0aW9ucywgYWRkT3B0aW9ucykpO1xuICB9LFxuXG4gIC8vIFJlbW92ZSBhIG1vZGVsLCBvciBhIGxpc3Qgb2YgbW9kZWxzIGZyb20gdGhlIHNldC5cbiAgcmVtb3ZlOiBmdW5jdGlvbihtb2RlbHMsIG9wdGlvbnMpIHtcbiAgICB2YXIgc2luZ3VsYXIgPSAhQXJyYXkuaXNBcnJheShtb2RlbHMpO1xuICAgIG1vZGVscyA9IHNpbmd1bGFyID8gW21vZGVsc10gOiBtb2RlbHMuc2xpY2UoKTtcbiAgICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuICAgIHZhciBpLCBsLCBpbmRleCwgbW9kZWw7XG4gICAgZm9yIChpID0gMCwgbCA9IG1vZGVscy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIG1vZGVsID0gbW9kZWxzW2ldID0gdGhpcy5nZXQobW9kZWxzW2ldKTtcbiAgICAgIGlmICghbW9kZWwpIGNvbnRpbnVlO1xuICAgICAgZGVsZXRlIHRoaXMuX2J5SWRbbW9kZWwuaWRdO1xuICAgICAgZGVsZXRlIHRoaXMuX2J5SWRbbW9kZWwuY2lkXTtcbiAgICAgIGluZGV4ID0gdGhpcy5pbmRleE9mKG1vZGVsKTtcbiAgICAgIHRoaXMubW9kZWxzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB0aGlzLmxlbmd0aC0tO1xuICAgICAgaWYgKCFvcHRpb25zLnNpbGVudCkge1xuICAgICAgICBvcHRpb25zLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIG1vZGVsLnRyaWdnZXIoJ3JlbW92ZScsIG1vZGVsLCB0aGlzLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3JlbW92ZVJlZmVyZW5jZShtb2RlbCwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJldHVybiBzaW5ndWxhciA/IG1vZGVsc1swXSA6IG1vZGVscztcbiAgfSxcblxuICAvLyBVcGRhdGUgYSBjb2xsZWN0aW9uIGJ5IGBzZXRgLWluZyBhIG5ldyBsaXN0IG9mIG1vZGVscywgYWRkaW5nIG5ldyBvbmVzLFxuICAvLyByZW1vdmluZyBtb2RlbHMgdGhhdCBhcmUgbm8gbG9uZ2VyIHByZXNlbnQsIGFuZCBtZXJnaW5nIG1vZGVscyB0aGF0XG4gIC8vIGFscmVhZHkgZXhpc3QgaW4gdGhlIGNvbGxlY3Rpb24sIGFzIG5lY2Vzc2FyeS4gU2ltaWxhciB0byAqKk1vZGVsI3NldCoqLFxuICAvLyB0aGUgY29yZSBvcGVyYXRpb24gZm9yIHVwZGF0aW5nIHRoZSBkYXRhIGNvbnRhaW5lZCBieSB0aGUgY29sbGVjdGlvbi5cbiAgc2V0OiBmdW5jdGlvbihtb2RlbHMsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gXy5kZWZhdWx0cyh7fSwgb3B0aW9ucywgc2V0T3B0aW9ucyk7XG4gICAgaWYgKG9wdGlvbnMucGFyc2UpIG1vZGVscyA9IHRoaXMucGFyc2UobW9kZWxzLCBvcHRpb25zKTtcbiAgICB2YXIgc2luZ3VsYXIgPSAhQXJyYXkuaXNBcnJheShtb2RlbHMpO1xuICAgIG1vZGVscyA9IHNpbmd1bGFyID8gKG1vZGVscyA/IFttb2RlbHNdIDogW10pIDogbW9kZWxzLnNsaWNlKCk7XG4gICAgdmFyIGksIGwsIGlkLCBtb2RlbCwgYXR0cnMsIGV4aXN0aW5nLCBzb3J0O1xuICAgIHZhciBhdCA9IG9wdGlvbnMuYXQ7XG4gICAgdmFyIHRhcmdldE1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICB2YXIgc29ydGFibGUgPSB0aGlzLmNvbXBhcmF0b3IgJiYgKGF0ID09IG51bGwpICYmIG9wdGlvbnMuc29ydCAhPT0gZmFsc2U7XG4gICAgdmFyIHNvcnRBdHRyID0gdHlwZW9mIHRoaXMuY29tcGFyYXRvciA9PT0gJ3N0cmluZycgPyB0aGlzLmNvbXBhcmF0b3IgOiBudWxsO1xuICAgIHZhciB0b0FkZCA9IFtdLCB0b1JlbW92ZSA9IFtdLCBtb2RlbE1hcCA9IHt9O1xuICAgIHZhciBhZGQgPSBvcHRpb25zLmFkZCwgbWVyZ2UgPSBvcHRpb25zLm1lcmdlLCByZW1vdmUgPSBvcHRpb25zLnJlbW92ZTtcbiAgICB2YXIgb3JkZXIgPSAhc29ydGFibGUgJiYgYWRkICYmIHJlbW92ZSA/IFtdIDogZmFsc2U7XG5cbiAgICAvLyBUdXJuIGJhcmUgb2JqZWN0cyBpbnRvIG1vZGVsIHJlZmVyZW5jZXMsIGFuZCBwcmV2ZW50IGludmFsaWQgbW9kZWxzXG4gICAgLy8gZnJvbSBiZWluZyBhZGRlZC5cbiAgICBmb3IgKGkgPSAwLCBsID0gbW9kZWxzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgYXR0cnMgPSBtb2RlbHNbaV0gfHwge307XG4gICAgICBpZiAoYXR0cnMgaW5zdGFuY2VvZiBNb2RlbCkge1xuICAgICAgICBpZCA9IG1vZGVsID0gYXR0cnM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZCA9IGF0dHJzW3RhcmdldE1vZGVsLnByb3RvdHlwZS5pZEF0dHJpYnV0ZSB8fCAnaWQnXTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgYSBkdXBsaWNhdGUgaXMgZm91bmQsIHByZXZlbnQgaXQgZnJvbSBiZWluZyBhZGRlZCBhbmRcbiAgICAgIC8vIG9wdGlvbmFsbHkgbWVyZ2UgaXQgaW50byB0aGUgZXhpc3RpbmcgbW9kZWwuXG4gICAgICBpZiAoZXhpc3RpbmcgPSB0aGlzLmdldChpZCkpIHtcbiAgICAgICAgaWYgKHJlbW92ZSkgbW9kZWxNYXBbZXhpc3RpbmcuY2lkXSA9IHRydWU7XG4gICAgICAgIGlmIChtZXJnZSkge1xuICAgICAgICAgIGF0dHJzID0gYXR0cnMgPT09IG1vZGVsID8gbW9kZWwuYXR0cmlidXRlcyA6IGF0dHJzO1xuICAgICAgICAgIGlmIChvcHRpb25zLnBhcnNlKSBhdHRycyA9IGV4aXN0aW5nLnBhcnNlKGF0dHJzLCBvcHRpb25zKTtcbiAgICAgICAgICBleGlzdGluZy5zZXQoYXR0cnMsIG9wdGlvbnMpO1xuICAgICAgICAgIGlmIChzb3J0YWJsZSAmJiAhc29ydCAmJiBleGlzdGluZy5oYXNDaGFuZ2VkKHNvcnRBdHRyKSkgc29ydCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgbW9kZWxzW2ldID0gZXhpc3Rpbmc7XG5cbiAgICAgIC8vIElmIHRoaXMgaXMgYSBuZXcsIHZhbGlkIG1vZGVsLCBwdXNoIGl0IHRvIHRoZSBgdG9BZGRgIGxpc3QuXG4gICAgICB9IGVsc2UgaWYgKGFkZCkge1xuICAgICAgICBtb2RlbCA9IG1vZGVsc1tpXSA9IHRoaXMuX3ByZXBhcmVNb2RlbChhdHRycywgb3B0aW9ucyk7XG4gICAgICAgIGlmICghbW9kZWwpIGNvbnRpbnVlO1xuICAgICAgICB0b0FkZC5wdXNoKG1vZGVsKTtcbiAgICAgICAgdGhpcy5fYWRkUmVmZXJlbmNlKG1vZGVsLCBvcHRpb25zKTtcbiAgICAgIH1cblxuICAgICAgLy8gRG8gbm90IGFkZCBtdWx0aXBsZSBtb2RlbHMgd2l0aCB0aGUgc2FtZSBgaWRgLlxuICAgICAgbW9kZWwgPSBleGlzdGluZyB8fCBtb2RlbDtcbiAgICAgIGlmIChvcmRlciAmJiAobW9kZWwuaXNOZXcoKSB8fCAhbW9kZWxNYXBbbW9kZWwuaWRdKSkgb3JkZXIucHVzaChtb2RlbCk7XG4gICAgICBtb2RlbE1hcFttb2RlbC5pZF0gPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBub25leGlzdGVudCBtb2RlbHMgaWYgYXBwcm9wcmlhdGUuXG4gICAgaWYgKHJlbW92ZSkge1xuICAgICAgZm9yIChpID0gMCwgbCA9IHRoaXMubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgIGlmICghbW9kZWxNYXBbKG1vZGVsID0gdGhpcy5tb2RlbHNbaV0pLmNpZF0pIHRvUmVtb3ZlLnB1c2gobW9kZWwpO1xuICAgICAgfVxuICAgICAgaWYgKHRvUmVtb3ZlLmxlbmd0aCkgdGhpcy5yZW1vdmUodG9SZW1vdmUsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIFNlZSBpZiBzb3J0aW5nIGlzIG5lZWRlZCwgdXBkYXRlIGBsZW5ndGhgIGFuZCBzcGxpY2UgaW4gbmV3IG1vZGVscy5cbiAgICBpZiAodG9BZGQubGVuZ3RoIHx8IChvcmRlciAmJiBvcmRlci5sZW5ndGgpKSB7XG4gICAgICBpZiAoc29ydGFibGUpIHNvcnQgPSB0cnVlO1xuICAgICAgdGhpcy5sZW5ndGggKz0gdG9BZGQubGVuZ3RoO1xuICAgICAgaWYgKGF0ICE9IG51bGwpIHtcbiAgICAgICAgZm9yIChpID0gMCwgbCA9IHRvQWRkLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgIHRoaXMubW9kZWxzLnNwbGljZShhdCArIGksIDAsIHRvQWRkW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG9yZGVyKSB0aGlzLm1vZGVscy5sZW5ndGggPSAwO1xuICAgICAgICB2YXIgb3JkZXJlZE1vZGVscyA9IG9yZGVyIHx8IHRvQWRkO1xuICAgICAgICBmb3IgKGkgPSAwLCBsID0gb3JkZXJlZE1vZGVscy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICB0aGlzLm1vZGVscy5wdXNoKG9yZGVyZWRNb2RlbHNbaV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU2lsZW50bHkgc29ydCB0aGUgY29sbGVjdGlvbiBpZiBhcHByb3ByaWF0ZS5cbiAgICBpZiAoc29ydCkgdGhpcy5zb3J0KHtzaWxlbnQ6IHRydWV9KTtcblxuICAgIC8vIFVubGVzcyBzaWxlbmNlZCwgaXQncyB0aW1lIHRvIGZpcmUgYWxsIGFwcHJvcHJpYXRlIGFkZC9zb3J0IGV2ZW50cy5cbiAgICBpZiAoIW9wdGlvbnMuc2lsZW50KSB7XG4gICAgICBmb3IgKGkgPSAwLCBsID0gdG9BZGQubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIChtb2RlbCA9IHRvQWRkW2ldKS50cmlnZ2VyKCdhZGQnLCBtb2RlbCwgdGhpcywgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAoc29ydCB8fCAob3JkZXIgJiYgb3JkZXIubGVuZ3RoKSkgdGhpcy50cmlnZ2VyKCdzb3J0JywgdGhpcywgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBhZGRlZCAob3IgbWVyZ2VkKSBtb2RlbCAob3IgbW9kZWxzKS5cbiAgICByZXR1cm4gc2luZ3VsYXIgPyBtb2RlbHNbMF0gOiBtb2RlbHM7XG4gIH0sXG5cbiAgLy8gV2hlbiB5b3UgaGF2ZSBtb3JlIGl0ZW1zIHRoYW4geW91IHdhbnQgdG8gYWRkIG9yIHJlbW92ZSBpbmRpdmlkdWFsbHksXG4gIC8vIHlvdSBjYW4gcmVzZXQgdGhlIGVudGlyZSBzZXQgd2l0aCBhIG5ldyBsaXN0IG9mIG1vZGVscywgd2l0aG91dCBmaXJpbmdcbiAgLy8gYW55IGdyYW51bGFyIGBhZGRgIG9yIGByZW1vdmVgIGV2ZW50cy4gRmlyZXMgYHJlc2V0YCB3aGVuIGZpbmlzaGVkLlxuICAvLyBVc2VmdWwgZm9yIGJ1bGsgb3BlcmF0aW9ucyBhbmQgb3B0aW1pemF0aW9ucy5cbiAgcmVzZXQ6IGZ1bmN0aW9uKG1vZGVscywgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLm1vZGVscy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHRoaXMuX3JlbW92ZVJlZmVyZW5jZSh0aGlzLm1vZGVsc1tpXSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIG9wdGlvbnMucHJldmlvdXNNb2RlbHMgPSB0aGlzLm1vZGVscztcbiAgICB0aGlzLl9yZXNldCgpO1xuICAgIG1vZGVscyA9IHRoaXMuYWRkKG1vZGVscywgXy5leHRlbmQoe3NpbGVudDogdHJ1ZX0sIG9wdGlvbnMpKTtcbiAgICBpZiAoIW9wdGlvbnMuc2lsZW50KSB0aGlzLnRyaWdnZXIoJ3Jlc2V0JywgdGhpcywgb3B0aW9ucyk7XG4gICAgcmV0dXJuIG1vZGVscztcbiAgfSxcblxuICAvLyBBZGQgYSBtb2RlbCB0byB0aGUgZW5kIG9mIHRoZSBjb2xsZWN0aW9uLlxuICBwdXNoOiBmdW5jdGlvbihtb2RlbCwgb3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLmFkZChtb2RlbCwgXy5leHRlbmQoe2F0OiB0aGlzLmxlbmd0aH0sIG9wdGlvbnMpKTtcbiAgfSxcblxuICAvLyBSZW1vdmUgYSBtb2RlbCBmcm9tIHRoZSBlbmQgb2YgdGhlIGNvbGxlY3Rpb24uXG4gIHBvcDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHZhciBtb2RlbCA9IHRoaXMuYXQodGhpcy5sZW5ndGggLSAxKTtcbiAgICB0aGlzLnJlbW92ZShtb2RlbCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIG1vZGVsO1xuICB9LFxuXG4gIC8vIEFkZCBhIG1vZGVsIHRvIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGNvbGxlY3Rpb24uXG4gIHVuc2hpZnQ6IGZ1bmN0aW9uKG1vZGVsLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkKG1vZGVsLCBfLmV4dGVuZCh7YXQ6IDB9LCBvcHRpb25zKSk7XG4gIH0sXG5cbiAgLy8gUmVtb3ZlIGEgbW9kZWwgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBjb2xsZWN0aW9uLlxuICBzaGlmdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHZhciBtb2RlbCA9IHRoaXMuYXQoMCk7XG4gICAgdGhpcy5yZW1vdmUobW9kZWwsIG9wdGlvbnMpO1xuICAgIHJldHVybiBtb2RlbDtcbiAgfSxcblxuICAvLyBTbGljZSBvdXQgYSBzdWItYXJyYXkgb2YgbW9kZWxzIGZyb20gdGhlIGNvbGxlY3Rpb24uXG4gIHNsaWNlOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gc2xpY2UuYXBwbHkodGhpcy5tb2RlbHMsIGFyZ3VtZW50cyk7XG4gIH0sXG5cbiAgLy8gR2V0IGEgbW9kZWwgZnJvbSB0aGUgc2V0IGJ5IGlkLlxuICBnZXQ6IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICByZXR1cm4gdGhpcy5fYnlJZFtvYmpdIHx8IHRoaXMuX2J5SWRbb2JqLmlkXSB8fCB0aGlzLl9ieUlkW29iai5jaWRdO1xuICB9LFxuXG4gIC8vIEdldCB0aGUgbW9kZWwgYXQgdGhlIGdpdmVuIGluZGV4LlxuICBhdDogZnVuY3Rpb24oaW5kZXgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbaW5kZXhdO1xuICB9LFxuXG4gIC8vIFJldHVybiBtb2RlbHMgd2l0aCBtYXRjaGluZyBhdHRyaWJ1dGVzLiBVc2VmdWwgZm9yIHNpbXBsZSBjYXNlcyBvZlxuICAvLyBgZmlsdGVyYC5cbiAgd2hlcmU6IGZ1bmN0aW9uKGF0dHJzLCBmaXJzdCkge1xuICAgIGlmICghYXR0cnMgfHwgIU9iamVjdC5rZXlzKGF0dHJzKS5sZW5ndGgpIHJldHVybiBmaXJzdCA/IHZvaWQgMCA6IFtdO1xuICAgIHJldHVybiB0aGlzW2ZpcnN0ID8gJ2ZpbmQnIDogJ2ZpbHRlciddKGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcbiAgICAgICAgaWYgKGF0dHJzW2tleV0gIT09IG1vZGVsLmdldChrZXkpKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBSZXR1cm4gdGhlIGZpcnN0IG1vZGVsIHdpdGggbWF0Y2hpbmcgYXR0cmlidXRlcy4gVXNlZnVsIGZvciBzaW1wbGUgY2FzZXNcbiAgLy8gb2YgYGZpbmRgLlxuICBmaW5kV2hlcmU6IGZ1bmN0aW9uKGF0dHJzKSB7XG4gICAgcmV0dXJuIHRoaXMud2hlcmUoYXR0cnMsIHRydWUpO1xuICB9LFxuXG4gIC8vIEZvcmNlIHRoZSBjb2xsZWN0aW9uIHRvIHJlLXNvcnQgaXRzZWxmLiBZb3UgZG9uJ3QgbmVlZCB0byBjYWxsIHRoaXMgdW5kZXJcbiAgLy8gbm9ybWFsIGNpcmN1bXN0YW5jZXMsIGFzIHRoZSBzZXQgd2lsbCBtYWludGFpbiBzb3J0IG9yZGVyIGFzIGVhY2ggaXRlbVxuICAvLyBpcyBhZGRlZC5cbiAgc29ydDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIGlmICghdGhpcy5jb21wYXJhdG9yKSB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBzb3J0IGEgc2V0IHdpdGhvdXQgYSBjb21wYXJhdG9yJyk7XG4gICAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IHt9KTtcblxuICAgIC8vIFJ1biBzb3J0IGJhc2VkIG9uIHR5cGUgb2YgYGNvbXBhcmF0b3JgLlxuICAgIGlmICh0eXBlb2YgdGhpcy5jb21wYXJhdG9yID09PSAnc3RyaW5nJyB8fCB0aGlzLmNvbXBhcmF0b3IubGVuZ3RoID09PSAxKSB7XG4gICAgICB0aGlzLm1vZGVscyA9IHRoaXMuc29ydEJ5KHRoaXMuY29tcGFyYXRvciwgdGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubW9kZWxzLnNvcnQodGhpcy5jb21wYXJhdG9yLmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGlmICghb3B0aW9ucy5zaWxlbnQpIHRoaXMudHJpZ2dlcignc29ydCcsIHRoaXMsIG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIFBsdWNrIGFuIGF0dHJpYnV0ZSBmcm9tIGVhY2ggbW9kZWwgaW4gdGhlIGNvbGxlY3Rpb24uXG4gIHBsdWNrOiBmdW5jdGlvbihhdHRyKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzLm1hcChmdW5jdGlvbihtb2RlbCkge1xuICAgICAgcmV0dXJuIG1vZGVsLmdldChhdHRyKTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBGZXRjaCB0aGUgZGVmYXVsdCBzZXQgb2YgbW9kZWxzIGZvciB0aGlzIGNvbGxlY3Rpb24sIHJlc2V0dGluZyB0aGVcbiAgLy8gY29sbGVjdGlvbiB3aGVuIHRoZXkgYXJyaXZlLiBJZiBgcmVzZXQ6IHRydWVgIGlzIHBhc3NlZCwgdGhlIHJlc3BvbnNlXG4gIC8vIGRhdGEgd2lsbCBiZSBwYXNzZWQgdGhyb3VnaCB0aGUgYHJlc2V0YCBtZXRob2QgaW5zdGVhZCBvZiBgc2V0YC5cbiAgZmV0Y2g6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyA/IF8uZXh0ZW5kKHt9LCBvcHRpb25zKSA6IHt9O1xuICAgIGlmIChvcHRpb25zLnBhcnNlID09PSB2b2lkIDApIG9wdGlvbnMucGFyc2UgPSB0cnVlO1xuICAgIHZhciBzdWNjZXNzID0gb3B0aW9ucy5zdWNjZXNzO1xuICAgIHZhciBjb2xsZWN0aW9uID0gdGhpcztcbiAgICBvcHRpb25zLnN1Y2Nlc3MgPSBmdW5jdGlvbihyZXNwKSB7XG4gICAgICB2YXIgbWV0aG9kID0gb3B0aW9ucy5yZXNldCA/ICdyZXNldCcgOiAnc2V0JztcbiAgICAgIGNvbGxlY3Rpb25bbWV0aG9kXShyZXNwLCBvcHRpb25zKTtcbiAgICAgIGlmIChzdWNjZXNzKSBzdWNjZXNzKGNvbGxlY3Rpb24sIHJlc3AsIG9wdGlvbnMpO1xuICAgICAgY29sbGVjdGlvbi50cmlnZ2VyKCdzeW5jJywgY29sbGVjdGlvbiwgcmVzcCwgb3B0aW9ucyk7XG4gICAgfTtcbiAgICB3cmFwRXJyb3IodGhpcywgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuc3luYygncmVhZCcsIHRoaXMsIG9wdGlvbnMpO1xuICB9LFxuXG4gIC8vIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBhIG1vZGVsIGluIHRoaXMgY29sbGVjdGlvbi4gQWRkIHRoZSBtb2RlbCB0byB0aGVcbiAgLy8gY29sbGVjdGlvbiBpbW1lZGlhdGVseSwgdW5sZXNzIGB3YWl0OiB0cnVlYCBpcyBwYXNzZWQsIGluIHdoaWNoIGNhc2Ugd2VcbiAgLy8gd2FpdCBmb3IgdGhlIHNlcnZlciB0byBhZ3JlZS5cbiAgY3JlYXRlOiBmdW5jdGlvbihtb2RlbCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zID8gXy5leHRlbmQoe30sIG9wdGlvbnMpIDoge307XG4gICAgaWYgKCEobW9kZWwgPSB0aGlzLl9wcmVwYXJlTW9kZWwobW9kZWwsIG9wdGlvbnMpKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghb3B0aW9ucy53YWl0KSB0aGlzLmFkZChtb2RlbCwgb3B0aW9ucyk7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSB0aGlzO1xuICAgIHZhciBzdWNjZXNzID0gb3B0aW9ucy5zdWNjZXNzO1xuICAgIG9wdGlvbnMuc3VjY2VzcyA9IGZ1bmN0aW9uKG1vZGVsLCByZXNwKSB7XG4gICAgICBpZiAob3B0aW9ucy53YWl0KSBjb2xsZWN0aW9uLmFkZChtb2RlbCwgb3B0aW9ucyk7XG4gICAgICBpZiAoc3VjY2Vzcykgc3VjY2Vzcyhtb2RlbCwgcmVzcCwgb3B0aW9ucyk7XG4gICAgfTtcbiAgICBtb2RlbC5zYXZlKG51bGwsIG9wdGlvbnMpO1xuICAgIHJldHVybiBtb2RlbDtcbiAgfSxcblxuICAvLyAqKnBhcnNlKiogY29udmVydHMgYSByZXNwb25zZSBpbnRvIGEgbGlzdCBvZiBtb2RlbHMgdG8gYmUgYWRkZWQgdG8gdGhlXG4gIC8vIGNvbGxlY3Rpb24uIFRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIGlzIGp1c3QgdG8gcGFzcyBpdCB0aHJvdWdoLlxuICBwYXJzZTogZnVuY3Rpb24ocmVzcCwgb3B0aW9ucykge1xuICAgIHJldHVybiByZXNwO1xuICB9LFxuXG4gIC8vIENyZWF0ZSBhIG5ldyBjb2xsZWN0aW9uIHdpdGggYW4gaWRlbnRpY2FsIGxpc3Qgb2YgbW9kZWxzIGFzIHRoaXMgb25lLlxuICBjbG9uZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMubW9kZWxzKTtcbiAgfSxcblxuICAvLyBQcml2YXRlIG1ldGhvZCB0byByZXNldCBhbGwgaW50ZXJuYWwgc3RhdGUuIENhbGxlZCB3aGVuIHRoZSBjb2xsZWN0aW9uXG4gIC8vIGlzIGZpcnN0IGluaXRpYWxpemVkIG9yIHJlc2V0LlxuICBfcmVzZXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLm1vZGVscyA9IFtdO1xuICAgIHRoaXMuX2J5SWQgID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfSxcblxuICAvLyBQcmVwYXJlIGEgaGFzaCBvZiBhdHRyaWJ1dGVzIChvciBvdGhlciBtb2RlbCkgdG8gYmUgYWRkZWQgdG8gdGhpc1xuICAvLyBjb2xsZWN0aW9uLlxuICBfcHJlcGFyZU1vZGVsOiBmdW5jdGlvbihhdHRycywgb3B0aW9ucykge1xuICAgIGlmIChhdHRycyBpbnN0YW5jZW9mIE1vZGVsKSByZXR1cm4gYXR0cnM7XG4gICAgb3B0aW9ucyA9IF8uZXh0ZW5kKHt9LCBvcHRpb25zKTtcbiAgICBvcHRpb25zLmNvbGxlY3Rpb24gPSB0aGlzO1xuICAgIHZhciBtb2RlbCA9IG5ldyB0aGlzLm1vZGVsKGF0dHJzLCBvcHRpb25zKTtcbiAgICBpZiAoIW1vZGVsLnZhbGlkYXRpb25FcnJvcikgcmV0dXJuIG1vZGVsO1xuICAgIHRoaXMudHJpZ2dlcignaW52YWxpZCcsIHRoaXMsIG1vZGVsLnZhbGlkYXRpb25FcnJvciwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuXG4gIC8vIEludGVybmFsIG1ldGhvZCB0byBjcmVhdGUgYSBtb2RlbCdzIHRpZXMgdG8gYSBjb2xsZWN0aW9uLlxuICBfYWRkUmVmZXJlbmNlOiBmdW5jdGlvbihtb2RlbCwgb3B0aW9ucykge1xuICAgIHRoaXMuX2J5SWRbbW9kZWwuY2lkXSA9IG1vZGVsO1xuICAgIGlmIChtb2RlbC5pZCAhPSBudWxsKSB0aGlzLl9ieUlkW21vZGVsLmlkXSA9IG1vZGVsO1xuICAgIGlmICghbW9kZWwuY29sbGVjdGlvbikgbW9kZWwuY29sbGVjdGlvbiA9IHRoaXM7XG4gICAgbW9kZWwub24oJ2FsbCcsIHRoaXMuX29uTW9kZWxFdmVudCwgdGhpcyk7XG4gIH0sXG5cbiAgLy8gSW50ZXJuYWwgbWV0aG9kIHRvIHNldmVyIGEgbW9kZWwncyB0aWVzIHRvIGEgY29sbGVjdGlvbi5cbiAgX3JlbW92ZVJlZmVyZW5jZTogZnVuY3Rpb24obW9kZWwsIG9wdGlvbnMpIHtcbiAgICBpZiAodGhpcyA9PT0gbW9kZWwuY29sbGVjdGlvbikgZGVsZXRlIG1vZGVsLmNvbGxlY3Rpb247XG4gICAgbW9kZWwub2ZmKCdhbGwnLCB0aGlzLl9vbk1vZGVsRXZlbnQsIHRoaXMpO1xuICB9LFxuXG4gIC8vIEludGVybmFsIG1ldGhvZCBjYWxsZWQgZXZlcnkgdGltZSBhIG1vZGVsIGluIHRoZSBzZXQgZmlyZXMgYW4gZXZlbnQuXG4gIC8vIFNldHMgbmVlZCB0byB1cGRhdGUgdGhlaXIgaW5kZXhlcyB3aGVuIG1vZGVscyBjaGFuZ2UgaWRzLiBBbGwgb3RoZXJcbiAgLy8gZXZlbnRzIHNpbXBseSBwcm94eSB0aHJvdWdoLiBcImFkZFwiIGFuZCBcInJlbW92ZVwiIGV2ZW50cyB0aGF0IG9yaWdpbmF0ZVxuICAvLyBpbiBvdGhlciBjb2xsZWN0aW9ucyBhcmUgaWdub3JlZC5cbiAgX29uTW9kZWxFdmVudDogZnVuY3Rpb24oZXZlbnQsIG1vZGVsLCBjb2xsZWN0aW9uLCBvcHRpb25zKSB7XG4gICAgaWYgKChldmVudCA9PT0gJ2FkZCcgfHwgZXZlbnQgPT09ICdyZW1vdmUnKSAmJiBjb2xsZWN0aW9uICE9PSB0aGlzKSByZXR1cm47XG4gICAgaWYgKGV2ZW50ID09PSAnZGVzdHJveScpIHRoaXMucmVtb3ZlKG1vZGVsLCBvcHRpb25zKTtcbiAgICBpZiAobW9kZWwgJiYgZXZlbnQgPT09ICdjaGFuZ2U6JyArIG1vZGVsLmlkQXR0cmlidXRlKSB7XG4gICAgICBkZWxldGUgdGhpcy5fYnlJZFttb2RlbC5wcmV2aW91cyhtb2RlbC5pZEF0dHJpYnV0ZSldO1xuICAgICAgaWYgKG1vZGVsLmlkICE9IG51bGwpIHRoaXMuX2J5SWRbbW9kZWwuaWRdID0gbW9kZWw7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbn0pO1xuXG5pZiAodXRpbEV4aXN0cygnZWFjaCcpKSB7XG4gIC8vIFVuZGVyc2NvcmUgbWV0aG9kcyB0aGF0IHdlIHdhbnQgdG8gaW1wbGVtZW50IG9uIHRoZSBDb2xsZWN0aW9uLlxuICAvLyA5MCUgb2YgdGhlIGNvcmUgdXNlZnVsbmVzcyBvZiBCYWNrYm9uZSBDb2xsZWN0aW9ucyBpcyBhY3R1YWxseSBpbXBsZW1lbnRlZFxuICAvLyByaWdodCBoZXJlOlxuICB2YXIgbWV0aG9kcyA9IFsnZm9yRWFjaCcsICdlYWNoJywgJ21hcCcsICdjb2xsZWN0JywgJ3JlZHVjZScsICdmb2xkbCcsXG4gICAgJ2luamVjdCcsICdyZWR1Y2VSaWdodCcsICdmb2xkcicsICdmaW5kJywgJ2RldGVjdCcsICdmaWx0ZXInLCAnc2VsZWN0JyxcbiAgICAncmVqZWN0JywgJ2V2ZXJ5JywgJ2FsbCcsICdzb21lJywgJ2FueScsICdpbmNsdWRlJywgJ2NvbnRhaW5zJywgJ2ludm9rZScsXG4gICAgJ21heCcsICdtaW4nLCAndG9BcnJheScsICdzaXplJywgJ2ZpcnN0JywgJ2hlYWQnLCAndGFrZScsICdpbml0aWFsJywgJ3Jlc3QnLFxuICAgICd0YWlsJywgJ2Ryb3AnLCAnbGFzdCcsICd3aXRob3V0JywgJ2RpZmZlcmVuY2UnLCAnaW5kZXhPZicsICdzaHVmZmxlJyxcbiAgICAnbGFzdEluZGV4T2YnLCAnaXNFbXB0eScsICdjaGFpbiddO1xuXG4gIC8vIE1peCBpbiBlYWNoIFVuZGVyc2NvcmUgbWV0aG9kIGFzIGEgcHJveHkgdG8gYENvbGxlY3Rpb24jbW9kZWxzYC5cbiAgbWV0aG9kcy5maWx0ZXIodXRpbEV4aXN0cykuZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgICBDb2xsZWN0aW9uLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIGFyZ3MudW5zaGlmdCh0aGlzLm1vZGVscyk7XG4gICAgICByZXR1cm4gX1ttZXRob2RdLmFwcGx5KF8sIGFyZ3MpO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIFVuZGVyc2NvcmUgbWV0aG9kcyB0aGF0IHRha2UgYSBwcm9wZXJ0eSBuYW1lIGFzIGFuIGFyZ3VtZW50LlxuICB2YXIgYXR0cmlidXRlTWV0aG9kcyA9IFsnZ3JvdXBCeScsICdjb3VudEJ5JywgJ3NvcnRCeSddO1xuXG4gIC8vIFVzZSBhdHRyaWJ1dGVzIGluc3RlYWQgb2YgcHJvcGVydGllcy5cbiAgYXR0cmlidXRlTWV0aG9kcy5maWx0ZXIodXRpbEV4aXN0cykuZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgICBDb2xsZWN0aW9uLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24odmFsdWUsIGNvbnRleHQpIHtcbiAgICAgIHZhciBpdGVyYXRvciA9IHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IHZhbHVlIDogZnVuY3Rpb24obW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIG1vZGVsLmdldCh2YWx1ZSk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIF9bbWV0aG9kXSh0aGlzLm1vZGVscywgaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIH07XG4gIH0pO1xufSBlbHNlIHtcbiAgWydmb3JFYWNoJywgJ21hcCcsICdmaWx0ZXInLCAnc29tZScsICdldmVyeScsICdyZWR1Y2UnLCAncmVkdWNlUmlnaHQnLFxuICAgICdpbmRleE9mJywgJ2xhc3RJbmRleE9mJ10uZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgICBDb2xsZWN0aW9uLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24oYXJnLCBjb250ZXh0KSB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbHNbbWV0aG9kXShhcmcsIGNvbnRleHQpO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIEV4b3NrZWxldG9uLXNwZWNpZmljOlxuICBDb2xsZWN0aW9uLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24oaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0O1xuICAgIHRoaXMuc29tZShmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpIHtcbiAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gVW5kZXJzY29yZSBtZXRob2RzIHRoYXQgdGFrZSBhIHByb3BlcnR5IG5hbWUgYXMgYW4gYXJndW1lbnQuXG4gIFsnc29ydEJ5J10uZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgICBDb2xsZWN0aW9uLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24odmFsdWUsIGNvbnRleHQpIHtcbiAgICAgIHZhciBpdGVyYXRvciA9IHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IHZhbHVlIDogZnVuY3Rpb24obW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIG1vZGVsLmdldCh2YWx1ZSk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIF9bbWV0aG9kXSh0aGlzLm1vZGVscywgaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIH07XG4gIH0pO1xufVxuLy8gQmFja2JvbmUuVmlld1xuLy8gLS0tLS0tLS0tLS0tLVxuXG4vLyBCYWNrYm9uZSBWaWV3cyBhcmUgYWxtb3N0IG1vcmUgY29udmVudGlvbiB0aGFuIHRoZXkgYXJlIGFjdHVhbCBjb2RlLiBBIFZpZXdcbi8vIGlzIHNpbXBseSBhIEphdmFTY3JpcHQgb2JqZWN0IHRoYXQgcmVwcmVzZW50cyBhIGxvZ2ljYWwgY2h1bmsgb2YgVUkgaW4gdGhlXG4vLyBET00uIFRoaXMgbWlnaHQgYmUgYSBzaW5nbGUgaXRlbSwgYW4gZW50aXJlIGxpc3QsIGEgc2lkZWJhciBvciBwYW5lbCwgb3Jcbi8vIGV2ZW4gdGhlIHN1cnJvdW5kaW5nIGZyYW1lIHdoaWNoIHdyYXBzIHlvdXIgd2hvbGUgYXBwLiBEZWZpbmluZyBhIGNodW5rIG9mXG4vLyBVSSBhcyBhICoqVmlldyoqIGFsbG93cyB5b3UgdG8gZGVmaW5lIHlvdXIgRE9NIGV2ZW50cyBkZWNsYXJhdGl2ZWx5LCB3aXRob3V0XG4vLyBoYXZpbmcgdG8gd29ycnkgYWJvdXQgcmVuZGVyIG9yZGVyIC4uLiBhbmQgbWFrZXMgaXQgZWFzeSBmb3IgdGhlIHZpZXcgdG9cbi8vIHJlYWN0IHRvIHNwZWNpZmljIGNoYW5nZXMgaW4gdGhlIHN0YXRlIG9mIHlvdXIgbW9kZWxzLlxuXG4vLyBDcmVhdGluZyBhIEJhY2tib25lLlZpZXcgY3JlYXRlcyBpdHMgaW5pdGlhbCBlbGVtZW50IG91dHNpZGUgb2YgdGhlIERPTSxcbi8vIGlmIGFuIGV4aXN0aW5nIGVsZW1lbnQgaXMgbm90IHByb3ZpZGVkLi4uXG52YXIgVmlldyA9IEJhY2tib25lLlZpZXcgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHRoaXMuY2lkID0gXy51bmlxdWVJZCgndmlldycpO1xuXG4gIGlmIChvcHRpb25zKSBPYmplY3Qua2V5cyhvcHRpb25zKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIGlmICh2aWV3T3B0aW9ucy5pbmRleE9mKGtleSkgIT09IC0xKSB0aGlzW2tleV0gPSBvcHRpb25zW2tleV07XG4gIH0sIHRoaXMpO1xuXG4gIHRoaXMuX2Vuc3VyZUVsZW1lbnQoKTtcbiAgdGhpcy5pbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG4vLyBDYWNoZWQgcmVnZXggdG8gc3BsaXQga2V5cyBmb3IgYGRlbGVnYXRlYC5cbnZhciBkZWxlZ2F0ZUV2ZW50U3BsaXR0ZXIgPSAvXihcXFMrKVxccyooLiopJC87XG5cbi8vIExpc3Qgb2YgdmlldyBvcHRpb25zIHRvIGJlIG1lcmdlZCBhcyBwcm9wZXJ0aWVzLlxudmFyIHZpZXdPcHRpb25zID0gWydtb2RlbCcsICdjb2xsZWN0aW9uJywgJ2VsJywgJ2lkJywgJ2F0dHJpYnV0ZXMnLCAnY2xhc3NOYW1lJywgJ3RhZ05hbWUnLCAnZXZlbnRzJ107XG5cbi8vIFNldCB1cCBhbGwgaW5oZXJpdGFibGUgKipCYWNrYm9uZS5WaWV3KiogcHJvcGVydGllcyBhbmQgbWV0aG9kcy5cbl8uZXh0ZW5kKFZpZXcucHJvdG90eXBlLCBFdmVudHMsIHtcblxuICAvLyBUaGUgZGVmYXVsdCBgdGFnTmFtZWAgb2YgYSBWaWV3J3MgZWxlbWVudCBpcyBgXCJkaXZcImAuXG4gIHRhZ05hbWU6ICdkaXYnLFxuXG4gIC8vIGpRdWVyeSBkZWxlZ2F0ZSBmb3IgZWxlbWVudCBsb29rdXAsIHNjb3BlZCB0byBET00gZWxlbWVudHMgd2l0aGluIHRoZVxuICAvLyBjdXJyZW50IHZpZXcuIFRoaXMgc2hvdWxkIGJlIHByZWZlcnJlZCB0byBnbG9iYWwgbG9va3VwcyB3aGVyZSBwb3NzaWJsZS5cbiAgJDogZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gdGhpcy4kZWwuZmluZChzZWxlY3Rvcik7XG4gIH0sXG5cbiAgLy8gSW5pdGlhbGl6ZSBpcyBhbiBlbXB0eSBmdW5jdGlvbiBieSBkZWZhdWx0LiBPdmVycmlkZSBpdCB3aXRoIHlvdXIgb3duXG4gIC8vIGluaXRpYWxpemF0aW9uIGxvZ2ljLlxuICBpbml0aWFsaXplOiBmdW5jdGlvbigpe30sXG5cbiAgLy8gKipyZW5kZXIqKiBpcyB0aGUgY29yZSBmdW5jdGlvbiB0aGF0IHlvdXIgdmlldyBzaG91bGQgb3ZlcnJpZGUsIGluIG9yZGVyXG4gIC8vIHRvIHBvcHVsYXRlIGl0cyBlbGVtZW50IChgdGhpcy5lbGApLCB3aXRoIHRoZSBhcHByb3ByaWF0ZSBIVE1MLiBUaGVcbiAgLy8gY29udmVudGlvbiBpcyBmb3IgKipyZW5kZXIqKiB0byBhbHdheXMgcmV0dXJuIGB0aGlzYC5cbiAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBSZW1vdmUgdGhpcyB2aWV3IGJ5IHRha2luZyB0aGUgZWxlbWVudCBvdXQgb2YgdGhlIERPTSwgYW5kIHJlbW92aW5nIGFueVxuICAvLyBhcHBsaWNhYmxlIEJhY2tib25lLkV2ZW50cyBsaXN0ZW5lcnMuXG4gIHJlbW92ZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcmVtb3ZlRWxlbWVudCgpO1xuICAgIHRoaXMuc3RvcExpc3RlbmluZygpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIFJlbW92ZSB0aGlzIHZpZXcncyBlbGVtZW50IGZyb20gdGhlIGRvY3VtZW50IGFuZCBhbGwgZXZlbnQgbGlzdGVuZXJzXG4gIC8vIGF0dGFjaGVkIHRvIGl0LiBFeHBvc2VkIGZvciBzdWJjbGFzc2VzIHVzaW5nIGFuIGFsdGVybmF0aXZlIERPTVxuICAvLyBtYW5pcHVsYXRpb24gQVBJLlxuICBfcmVtb3ZlRWxlbWVudDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy4kZWwucmVtb3ZlKCk7XG4gIH0sXG5cbiAgLy8gQ2hhbmdlIHRoZSB2aWV3J3MgZWxlbWVudCAoYHRoaXMuZWxgIHByb3BlcnR5KSBhbmQgcmUtZGVsZWdhdGUgdGhlXG4gIC8vIHZpZXcncyBldmVudHMgb24gdGhlIG5ldyBlbGVtZW50LlxuICBzZXRFbGVtZW50OiBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgdGhpcy51bmRlbGVnYXRlRXZlbnRzKCk7XG4gICAgdGhpcy5fc2V0RWxlbWVudChlbGVtZW50KTtcbiAgICB0aGlzLmRlbGVnYXRlRXZlbnRzKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLy8gQ3JlYXRlcyB0aGUgYHRoaXMuZWxgIGFuZCBgdGhpcy4kZWxgIHJlZmVyZW5jZXMgZm9yIHRoaXMgdmlldyB1c2luZyB0aGVcbiAgLy8gZ2l2ZW4gYGVsYCBhbmQgYSBoYXNoIG9mIGBhdHRyaWJ1dGVzYC4gYGVsYCBjYW4gYmUgYSBDU1Mgc2VsZWN0b3Igb3IgYW5cbiAgLy8gSFRNTCBzdHJpbmcsIGEgalF1ZXJ5IGNvbnRleHQgb3IgYW4gZWxlbWVudC4gU3ViY2xhc3NlcyBjYW4gb3ZlcnJpZGVcbiAgLy8gdGhpcyB0byB1dGlsaXplIGFuIGFsdGVybmF0aXZlIERPTSBtYW5pcHVsYXRpb24gQVBJIGFuZCBhcmUgb25seSByZXF1aXJlZFxuICAvLyB0byBzZXQgdGhlIGB0aGlzLmVsYCBwcm9wZXJ0eS5cbiAgX3NldEVsZW1lbnQ6IGZ1bmN0aW9uKGVsKSB7XG4gICAgdGhpcy4kZWwgPSBlbCBpbnN0YW5jZW9mIEJhY2tib25lLiQgPyBlbCA6IEJhY2tib25lLiQoZWwpO1xuICAgIHRoaXMuZWwgPSB0aGlzLiRlbFswXTtcbiAgfSxcblxuICAvLyBTZXQgY2FsbGJhY2tzLCB3aGVyZSBgdGhpcy5ldmVudHNgIGlzIGEgaGFzaCBvZlxuICAvL1xuICAvLyAqe1wiZXZlbnQgc2VsZWN0b3JcIjogXCJjYWxsYmFja1wifSpcbiAgLy9cbiAgLy8gICAgIHtcbiAgLy8gICAgICAgJ21vdXNlZG93biAudGl0bGUnOiAgJ2VkaXQnLFxuICAvLyAgICAgICAnY2xpY2sgLmJ1dHRvbic6ICAgICAnc2F2ZScsXG4gIC8vICAgICAgICdjbGljayAub3Blbic6ICAgICAgIGZ1bmN0aW9uKGUpIHsgLi4uIH1cbiAgLy8gICAgIH1cbiAgLy9cbiAgLy8gcGFpcnMuIENhbGxiYWNrcyB3aWxsIGJlIGJvdW5kIHRvIHRoZSB2aWV3LCB3aXRoIGB0aGlzYCBzZXQgcHJvcGVybHkuXG4gIC8vIFVzZXMgZXZlbnQgZGVsZWdhdGlvbiBmb3IgZWZmaWNpZW5jeS5cbiAgLy8gT21pdHRpbmcgdGhlIHNlbGVjdG9yIGJpbmRzIHRoZSBldmVudCB0byBgdGhpcy5lbGAuXG4gIGRlbGVnYXRlRXZlbnRzOiBmdW5jdGlvbihldmVudHMpIHtcbiAgICBpZiAoIShldmVudHMgfHwgKGV2ZW50cyA9IF8ucmVzdWx0KHRoaXMsICdldmVudHMnKSkpKSByZXR1cm4gdGhpcztcbiAgICB0aGlzLnVuZGVsZWdhdGVFdmVudHMoKTtcbiAgICBmb3IgKHZhciBrZXkgaW4gZXZlbnRzKSB7XG4gICAgICB2YXIgbWV0aG9kID0gZXZlbnRzW2tleV07XG4gICAgICBpZiAodHlwZW9mIG1ldGhvZCAhPT0gJ2Z1bmN0aW9uJykgbWV0aG9kID0gdGhpc1tldmVudHNba2V5XV07XG4gICAgICAvLyBpZiAoIW1ldGhvZCkgY29udGludWU7XG4gICAgICB2YXIgbWF0Y2ggPSBrZXkubWF0Y2goZGVsZWdhdGVFdmVudFNwbGl0dGVyKTtcbiAgICAgIHRoaXMuZGVsZWdhdGUobWF0Y2hbMV0sIG1hdGNoWzJdLCBtZXRob2QuYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIEFkZCBhIHNpbmdsZSBldmVudCBsaXN0ZW5lciB0byB0aGUgdmlldydzIGVsZW1lbnQgKG9yIGEgY2hpbGQgZWxlbWVudFxuICAvLyB1c2luZyBgc2VsZWN0b3JgKS4gVGhpcyBvbmx5IHdvcmtzIGZvciBkZWxlZ2F0ZS1hYmxlIGV2ZW50czogbm90IGBmb2N1c2AsXG4gIC8vIGBibHVyYCwgYW5kIG5vdCBgY2hhbmdlYCwgYHN1Ym1pdGAsIGFuZCBgcmVzZXRgIGluIEludGVybmV0IEV4cGxvcmVyLlxuICBkZWxlZ2F0ZTogZnVuY3Rpb24oZXZlbnROYW1lLCBzZWxlY3RvciwgbGlzdGVuZXIpIHtcbiAgICB0aGlzLiRlbC5vbihldmVudE5hbWUgKyAnLmRlbGVnYXRlRXZlbnRzJyArIHRoaXMuY2lkLCBzZWxlY3RvciwgbGlzdGVuZXIpO1xuICB9LFxuXG4gIC8vIENsZWFycyBhbGwgY2FsbGJhY2tzIHByZXZpb3VzbHkgYm91bmQgdG8gdGhlIHZpZXcgYnkgYGRlbGVnYXRlRXZlbnRzYC5cbiAgLy8gWW91IHVzdWFsbHkgZG9uJ3QgbmVlZCB0byB1c2UgdGhpcywgYnV0IG1heSB3aXNoIHRvIGlmIHlvdSBoYXZlIG11bHRpcGxlXG4gIC8vIEJhY2tib25lIHZpZXdzIGF0dGFjaGVkIHRvIHRoZSBzYW1lIERPTSBlbGVtZW50LlxuICB1bmRlbGVnYXRlRXZlbnRzOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy4kZWwpIHRoaXMuJGVsLm9mZignLmRlbGVnYXRlRXZlbnRzJyArIHRoaXMuY2lkKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBBIGZpbmVyLWdyYWluZWQgYHVuZGVsZWdhdGVFdmVudHNgIGZvciByZW1vdmluZyBhIHNpbmdsZSBkZWxlZ2F0ZWQgZXZlbnQuXG4gIC8vIGBzZWxlY3RvcmAgYW5kIGBsaXN0ZW5lcmAgYXJlIGJvdGggb3B0aW9uYWwuXG4gIHVuZGVsZWdhdGU6IGZ1bmN0aW9uKGV2ZW50TmFtZSwgc2VsZWN0b3IsIGxpc3RlbmVyKSB7XG4gICAgdGhpcy4kZWwub2ZmKGV2ZW50TmFtZSArICcuZGVsZWdhdGVFdmVudHMnICsgdGhpcy5jaWQsIHNlbGVjdG9yLCBsaXN0ZW5lcik7XG4gIH0sXG5cbiAgLy8gUHJvZHVjZXMgYSBET00gZWxlbWVudCB0byBiZSBhc3NpZ25lZCB0byB5b3VyIHZpZXcuIEV4cG9zZWQgZm9yXG4gIC8vIHN1YmNsYXNzZXMgdXNpbmcgYW4gYWx0ZXJuYXRpdmUgRE9NIG1hbmlwdWxhdGlvbiBBUEkuXG4gIF9jcmVhdGVFbGVtZW50OiBmdW5jdGlvbih0YWdOYW1lKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG4gIH0sXG5cbiAgLy8gRW5zdXJlIHRoYXQgdGhlIFZpZXcgaGFzIGEgRE9NIGVsZW1lbnQgdG8gcmVuZGVyIGludG8uXG4gIC8vIElmIGB0aGlzLmVsYCBpcyBhIHN0cmluZywgcGFzcyBpdCB0aHJvdWdoIGAkKClgLCB0YWtlIHRoZSBmaXJzdFxuICAvLyBtYXRjaGluZyBlbGVtZW50LCBhbmQgcmUtYXNzaWduIGl0IHRvIGBlbGAuIE90aGVyd2lzZSwgY3JlYXRlXG4gIC8vIGFuIGVsZW1lbnQgZnJvbSB0aGUgYGlkYCwgYGNsYXNzTmFtZWAgYW5kIGB0YWdOYW1lYCBwcm9wZXJ0aWVzLlxuICBfZW5zdXJlRWxlbWVudDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmVsKSB7XG4gICAgICB2YXIgYXR0cnMgPSBfLmV4dGVuZCh7fSwgXy5yZXN1bHQodGhpcywgJ2F0dHJpYnV0ZXMnKSk7XG4gICAgICBpZiAodGhpcy5pZCkgYXR0cnMuaWQgPSBfLnJlc3VsdCh0aGlzLCAnaWQnKTtcbiAgICAgIGlmICh0aGlzLmNsYXNzTmFtZSkgYXR0cnNbJ2NsYXNzJ10gPSBfLnJlc3VsdCh0aGlzLCAnY2xhc3NOYW1lJyk7XG4gICAgICB0aGlzLnNldEVsZW1lbnQodGhpcy5fY3JlYXRlRWxlbWVudChfLnJlc3VsdCh0aGlzLCAndGFnTmFtZScpKSk7XG4gICAgICB0aGlzLl9zZXRBdHRyaWJ1dGVzKGF0dHJzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZXRFbGVtZW50KF8ucmVzdWx0KHRoaXMsICdlbCcpKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gU2V0IGF0dHJpYnV0ZXMgZnJvbSBhIGhhc2ggb24gdGhpcyB2aWV3J3MgZWxlbWVudC4gIEV4cG9zZWQgZm9yXG4gIC8vIHN1YmNsYXNzZXMgdXNpbmcgYW4gYWx0ZXJuYXRpdmUgRE9NIG1hbmlwdWxhdGlvbiBBUEkuXG4gIF9zZXRBdHRyaWJ1dGVzOiBmdW5jdGlvbihhdHRyaWJ1dGVzKSB7XG4gICAgdGhpcy4kZWwuYXR0cihhdHRyaWJ1dGVzKTtcbiAgfVxuXG59KTtcbi8vIEJhY2tib25lLnN5bmNcbi8vIC0tLS0tLS0tLS0tLS1cblxuLy8gT3ZlcnJpZGUgdGhpcyBmdW5jdGlvbiB0byBjaGFuZ2UgdGhlIG1hbm5lciBpbiB3aGljaCBCYWNrYm9uZSBwZXJzaXN0c1xuLy8gbW9kZWxzIHRvIHRoZSBzZXJ2ZXIuIFlvdSB3aWxsIGJlIHBhc3NlZCB0aGUgdHlwZSBvZiByZXF1ZXN0LCBhbmQgdGhlXG4vLyBtb2RlbCBpbiBxdWVzdGlvbi4gQnkgZGVmYXVsdCwgbWFrZXMgYSBSRVNUZnVsIEFqYXggcmVxdWVzdFxuLy8gdG8gdGhlIG1vZGVsJ3MgYHVybCgpYC4gU29tZSBwb3NzaWJsZSBjdXN0b21pemF0aW9ucyBjb3VsZCBiZTpcbi8vXG4vLyAqIFVzZSBgc2V0VGltZW91dGAgdG8gYmF0Y2ggcmFwaWQtZmlyZSB1cGRhdGVzIGludG8gYSBzaW5nbGUgcmVxdWVzdC5cbi8vICogU2VuZCB1cCB0aGUgbW9kZWxzIGFzIFhNTCBpbnN0ZWFkIG9mIEpTT04uXG4vLyAqIFBlcnNpc3QgbW9kZWxzIHZpYSBXZWJTb2NrZXRzIGluc3RlYWQgb2YgQWpheC5cbkJhY2tib25lLnN5bmMgPSBmdW5jdGlvbihtZXRob2QsIG1vZGVsLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSlcblxuICB2YXIgdHlwZSA9IG1ldGhvZE1hcFttZXRob2RdO1xuXG4gIC8vIERlZmF1bHQgSlNPTi1yZXF1ZXN0IG9wdGlvbnMuXG4gIHZhciBwYXJhbXMgPSB7dHlwZTogdHlwZSwgZGF0YVR5cGU6ICdqc29uJ307XG5cbiAgLy8gRW5zdXJlIHRoYXQgd2UgaGF2ZSBhIFVSTC5cbiAgaWYgKCFvcHRpb25zLnVybCkge1xuICAgIHBhcmFtcy51cmwgPSBfLnJlc3VsdChtb2RlbCwgJ3VybCcpIHx8IHVybEVycm9yKCk7XG4gIH1cblxuICAvLyBFbnN1cmUgdGhhdCB3ZSBoYXZlIHRoZSBhcHByb3ByaWF0ZSByZXF1ZXN0IGRhdGEuXG4gIGlmIChvcHRpb25zLmRhdGEgPT0gbnVsbCAmJiBtb2RlbCAmJiAobWV0aG9kID09PSAnY3JlYXRlJyB8fCBtZXRob2QgPT09ICd1cGRhdGUnIHx8IG1ldGhvZCA9PT0gJ3BhdGNoJykpIHtcbiAgICBwYXJhbXMuY29udGVudFR5cGUgPSAnYXBwbGljYXRpb24vanNvbic7XG4gICAgcGFyYW1zLmRhdGEgPSBKU09OLnN0cmluZ2lmeShvcHRpb25zLmF0dHJzIHx8IG1vZGVsLnRvSlNPTihvcHRpb25zKSk7XG4gIH1cblxuICAvLyBEb24ndCBwcm9jZXNzIGRhdGEgb24gYSBub24tR0VUIHJlcXVlc3QuXG4gIGlmIChwYXJhbXMudHlwZSAhPT0gJ0dFVCcpIHtcbiAgICBwYXJhbXMucHJvY2Vzc0RhdGEgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIE1ha2UgdGhlIHJlcXVlc3QsIGFsbG93aW5nIHRoZSB1c2VyIHRvIG92ZXJyaWRlIGFueSBBamF4IG9wdGlvbnMuXG4gIHZhciB4aHIgPSBvcHRpb25zLnhociA9IEJhY2tib25lLmFqYXgoXy5leHRlbmQocGFyYW1zLCBvcHRpb25zKSk7XG4gIG1vZGVsLnRyaWdnZXIoJ3JlcXVlc3QnLCBtb2RlbCwgeGhyLCBvcHRpb25zKTtcbiAgcmV0dXJuIHhocjtcbn07XG5cbi8vIE1hcCBmcm9tIENSVUQgdG8gSFRUUCBmb3Igb3VyIGRlZmF1bHQgYEJhY2tib25lLnN5bmNgIGltcGxlbWVudGF0aW9uLlxudmFyIG1ldGhvZE1hcCA9IHtcbiAgJ2NyZWF0ZSc6ICdQT1NUJyxcbiAgJ3VwZGF0ZSc6ICdQVVQnLFxuICAncGF0Y2gnOiAgJ1BBVENIJyxcbiAgJ2RlbGV0ZSc6ICdERUxFVEUnLFxuICAncmVhZCc6ICAgJ0dFVCdcbn07XG5cbi8vIFNldCB0aGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiBvZiBgQmFja2JvbmUuYWpheGAgdG8gcHJveHkgdGhyb3VnaCB0byBgJGAuXG4vLyBPdmVycmlkZSB0aGlzIGlmIHlvdSdkIGxpa2UgdG8gdXNlIGEgZGlmZmVyZW50IGxpYnJhcnkuXG5CYWNrYm9uZS5hamF4ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBCYWNrYm9uZS4kLmFqYXguYXBwbHkoQmFja2JvbmUuJCwgYXJndW1lbnRzKTtcbn07XG4vLyBCYWNrYm9uZS5Sb3V0ZXJcbi8vIC0tLS0tLS0tLS0tLS0tLVxuXG4vLyBSb3V0ZXJzIG1hcCBmYXV4LVVSTHMgdG8gYWN0aW9ucywgYW5kIGZpcmUgZXZlbnRzIHdoZW4gcm91dGVzIGFyZVxuLy8gbWF0Y2hlZC4gQ3JlYXRpbmcgYSBuZXcgb25lIHNldHMgaXRzIGByb3V0ZXNgIGhhc2gsIGlmIG5vdCBzZXQgc3RhdGljYWxseS5cbnZhciBSb3V0ZXIgPSBCYWNrYm9uZS5Sb3V0ZXIgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG4gIGlmIChvcHRpb25zLnJvdXRlcykgdGhpcy5yb3V0ZXMgPSBvcHRpb25zLnJvdXRlcztcbiAgdGhpcy5fYmluZFJvdXRlcygpO1xuICB0aGlzLmluaXRpYWxpemUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbi8vIENhY2hlZCByZWd1bGFyIGV4cHJlc3Npb25zIGZvciBtYXRjaGluZyBuYW1lZCBwYXJhbSBwYXJ0cyBhbmQgc3BsYXR0ZWRcbi8vIHBhcnRzIG9mIHJvdXRlIHN0cmluZ3MuXG52YXIgb3B0aW9uYWxQYXJhbSA9IC9cXCgoLio/KVxcKS9nO1xudmFyIG5hbWVkUGFyYW0gICAgPSAvKFxcKFxcPyk/OlxcdysvZztcbnZhciBzcGxhdFBhcmFtICAgID0gL1xcKlxcdysvZztcbnZhciBlc2NhcGVSZWdFeHAgID0gL1tcXC17fVxcW1xcXSs/LixcXFxcXFxeJHwjXFxzXS9nO1xuXG52YXIgaXNSZWdFeHAgPSBmdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPyAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXScpIDogZmFsc2U7XG59O1xuXG4vLyBTZXQgdXAgYWxsIGluaGVyaXRhYmxlICoqQmFja2JvbmUuUm91dGVyKiogcHJvcGVydGllcyBhbmQgbWV0aG9kcy5cbl8uZXh0ZW5kKFJvdXRlci5wcm90b3R5cGUsIEV2ZW50cywge1xuXG4gIC8vIEluaXRpYWxpemUgaXMgYW4gZW1wdHkgZnVuY3Rpb24gYnkgZGVmYXVsdC4gT3ZlcnJpZGUgaXQgd2l0aCB5b3VyIG93blxuICAvLyBpbml0aWFsaXphdGlvbiBsb2dpYy5cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oKXt9LFxuXG4gIC8vIE1hbnVhbGx5IGJpbmQgYSBzaW5nbGUgbmFtZWQgcm91dGUgdG8gYSBjYWxsYmFjay4gRm9yIGV4YW1wbGU6XG4gIC8vXG4gIC8vICAgICB0aGlzLnJvdXRlKCdzZWFyY2gvOnF1ZXJ5L3A6bnVtJywgJ3NlYXJjaCcsIGZ1bmN0aW9uKHF1ZXJ5LCBudW0pIHtcbiAgLy8gICAgICAgLi4uXG4gIC8vICAgICB9KTtcbiAgLy9cbiAgcm91dGU6IGZ1bmN0aW9uKHJvdXRlLCBuYW1lLCBjYWxsYmFjaykge1xuICAgIGlmICghaXNSZWdFeHAocm91dGUpKSByb3V0ZSA9IHRoaXMuX3JvdXRlVG9SZWdFeHAocm91dGUpO1xuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBuYW1lO1xuICAgICAgbmFtZSA9ICcnO1xuICAgIH1cbiAgICBpZiAoIWNhbGxiYWNrKSBjYWxsYmFjayA9IHRoaXNbbmFtZV07XG4gICAgdmFyIHJvdXRlciA9IHRoaXM7XG4gICAgQmFja2JvbmUuaGlzdG9yeS5yb3V0ZShyb3V0ZSwgZnVuY3Rpb24oZnJhZ21lbnQpIHtcbiAgICAgIHZhciBhcmdzID0gcm91dGVyLl9leHRyYWN0UGFyYW1ldGVycyhyb3V0ZSwgZnJhZ21lbnQpO1xuICAgICAgcm91dGVyLmV4ZWN1dGUoY2FsbGJhY2ssIGFyZ3MpO1xuICAgICAgcm91dGVyLnRyaWdnZXIuYXBwbHkocm91dGVyLCBbJ3JvdXRlOicgKyBuYW1lXS5jb25jYXQoYXJncykpO1xuICAgICAgcm91dGVyLnRyaWdnZXIoJ3JvdXRlJywgbmFtZSwgYXJncyk7XG4gICAgICBCYWNrYm9uZS5oaXN0b3J5LnRyaWdnZXIoJ3JvdXRlJywgcm91dGVyLCBuYW1lLCBhcmdzKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBFeGVjdXRlIGEgcm91dGUgaGFuZGxlciB3aXRoIHRoZSBwcm92aWRlZCBwYXJhbWV0ZXJzLiAgVGhpcyBpcyBhblxuICAvLyBleGNlbGxlbnQgcGxhY2UgdG8gZG8gcHJlLXJvdXRlIHNldHVwIG9yIHBvc3Qtcm91dGUgY2xlYW51cC5cbiAgZXhlY3V0ZTogZnVuY3Rpb24oY2FsbGJhY2ssIGFyZ3MpIHtcbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9LFxuXG4gIC8vIFNpbXBsZSBwcm94eSB0byBgQmFja2JvbmUuaGlzdG9yeWAgdG8gc2F2ZSBhIGZyYWdtZW50IGludG8gdGhlIGhpc3RvcnkuXG4gIG5hdmlnYXRlOiBmdW5jdGlvbihmcmFnbWVudCwgb3B0aW9ucykge1xuICAgIEJhY2tib25lLmhpc3RvcnkubmF2aWdhdGUoZnJhZ21lbnQsIG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIEJpbmQgYWxsIGRlZmluZWQgcm91dGVzIHRvIGBCYWNrYm9uZS5oaXN0b3J5YC4gV2UgaGF2ZSB0byByZXZlcnNlIHRoZVxuICAvLyBvcmRlciBvZiB0aGUgcm91dGVzIGhlcmUgdG8gc3VwcG9ydCBiZWhhdmlvciB3aGVyZSB0aGUgbW9zdCBnZW5lcmFsXG4gIC8vIHJvdXRlcyBjYW4gYmUgZGVmaW5lZCBhdCB0aGUgYm90dG9tIG9mIHRoZSByb3V0ZSBtYXAuXG4gIF9iaW5kUm91dGVzOiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMucm91dGVzKSByZXR1cm47XG4gICAgdGhpcy5yb3V0ZXMgPSBfLnJlc3VsdCh0aGlzLCAncm91dGVzJyk7XG4gICAgdmFyIHJvdXRlLCByb3V0ZXMgPSBPYmplY3Qua2V5cyh0aGlzLnJvdXRlcyk7XG4gICAgd2hpbGUgKChyb3V0ZSA9IHJvdXRlcy5wb3AoKSkgIT0gbnVsbCkge1xuICAgICAgdGhpcy5yb3V0ZShyb3V0ZSwgdGhpcy5yb3V0ZXNbcm91dGVdKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gQ29udmVydCBhIHJvdXRlIHN0cmluZyBpbnRvIGEgcmVndWxhciBleHByZXNzaW9uLCBzdWl0YWJsZSBmb3IgbWF0Y2hpbmdcbiAgLy8gYWdhaW5zdCB0aGUgY3VycmVudCBsb2NhdGlvbiBoYXNoLlxuICBfcm91dGVUb1JlZ0V4cDogZnVuY3Rpb24ocm91dGUpIHtcbiAgICByb3V0ZSA9IHJvdXRlLnJlcGxhY2UoZXNjYXBlUmVnRXhwLCAnXFxcXCQmJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2Uob3B0aW9uYWxQYXJhbSwgJyg/OiQxKT8nKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZShuYW1lZFBhcmFtLCBmdW5jdGlvbihtYXRjaCwgb3B0aW9uYWwpIHtcbiAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9uYWwgPyBtYXRjaCA6ICcoW14vP10rKSc7XG4gICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKHNwbGF0UGFyYW0sICcoW14/XSo/KScpO1xuICAgIHJldHVybiBuZXcgUmVnRXhwKCdeJyArIHJvdXRlICsgJyg/OlxcXFw/KFtcXFxcc1xcXFxTXSopKT8kJyk7XG4gIH0sXG5cbiAgLy8gR2l2ZW4gYSByb3V0ZSwgYW5kIGEgVVJMIGZyYWdtZW50IHRoYXQgaXQgbWF0Y2hlcywgcmV0dXJuIHRoZSBhcnJheSBvZlxuICAvLyBleHRyYWN0ZWQgZGVjb2RlZCBwYXJhbWV0ZXJzLiBFbXB0eSBvciB1bm1hdGNoZWQgcGFyYW1ldGVycyB3aWxsIGJlXG4gIC8vIHRyZWF0ZWQgYXMgYG51bGxgIHRvIG5vcm1hbGl6ZSBjcm9zcy1icm93c2VyIGJlaGF2aW9yLlxuICBfZXh0cmFjdFBhcmFtZXRlcnM6IGZ1bmN0aW9uKHJvdXRlLCBmcmFnbWVudCkge1xuICAgIHZhciBwYXJhbXMgPSByb3V0ZS5leGVjKGZyYWdtZW50KS5zbGljZSgxKTtcbiAgICByZXR1cm4gcGFyYW1zLm1hcChmdW5jdGlvbihwYXJhbSwgaSkge1xuICAgICAgLy8gRG9uJ3QgZGVjb2RlIHRoZSBzZWFyY2ggcGFyYW1zLlxuICAgICAgaWYgKGkgPT09IHBhcmFtcy5sZW5ndGggLSAxKSByZXR1cm4gcGFyYW0gfHwgbnVsbDtcbiAgICAgIHJldHVybiBwYXJhbSA/IGRlY29kZVVSSUNvbXBvbmVudChwYXJhbSkgOiBudWxsO1xuICAgIH0pO1xuICB9XG5cbn0pO1xuLy8gQmFja2JvbmUuSGlzdG9yeVxuLy8gLS0tLS0tLS0tLS0tLS0tLVxuXG4vLyBIYW5kbGVzIGNyb3NzLWJyb3dzZXIgaGlzdG9yeSBtYW5hZ2VtZW50LCBiYXNlZCBvbiBlaXRoZXJcbi8vIFtwdXNoU3RhdGVdKGh0dHA6Ly9kaXZlaW50b2h0bWw1LmluZm8vaGlzdG9yeS5odG1sKSBhbmQgcmVhbCBVUkxzLCBvclxuLy8gW29uaGFzaGNoYW5nZV0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9ET00vd2luZG93Lm9uaGFzaGNoYW5nZSlcbi8vIGFuZCBVUkwgZnJhZ21lbnRzLlxudmFyIEhpc3RvcnkgPSBCYWNrYm9uZS5IaXN0b3J5ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuaGFuZGxlcnMgPSBbXTtcbiAgdGhpcy5jaGVja1VybCA9IHRoaXMuY2hlY2tVcmwuYmluZCh0aGlzKTtcblxuICAvLyBFbnN1cmUgdGhhdCBgSGlzdG9yeWAgY2FuIGJlIHVzZWQgb3V0c2lkZSBvZiB0aGUgYnJvd3Nlci5cbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdGhpcy5sb2NhdGlvbiA9IHdpbmRvdy5sb2NhdGlvbjtcbiAgICB0aGlzLmhpc3RvcnkgPSB3aW5kb3cuaGlzdG9yeTtcbiAgfVxufTtcblxuLy8gQ2FjaGVkIHJlZ2V4IGZvciBzdHJpcHBpbmcgYSBsZWFkaW5nIGhhc2gvc2xhc2ggYW5kIHRyYWlsaW5nIHNwYWNlLlxudmFyIHJvdXRlU3RyaXBwZXIgPSAvXlsjXFwvXXxcXHMrJC9nO1xuXG4vLyBDYWNoZWQgcmVnZXggZm9yIHN0cmlwcGluZyBsZWFkaW5nIGFuZCB0cmFpbGluZyBzbGFzaGVzLlxudmFyIHJvb3RTdHJpcHBlciA9IC9eXFwvK3xcXC8rJC9nO1xuXG4vLyBDYWNoZWQgcmVnZXggZm9yIHJlbW92aW5nIGEgdHJhaWxpbmcgc2xhc2guXG52YXIgdHJhaWxpbmdTbGFzaCA9IC9cXC8kLztcblxuLy8gQ2FjaGVkIHJlZ2V4IGZvciBzdHJpcHBpbmcgdXJscyBvZiBoYXNoIGFuZCBxdWVyeS5cbnZhciBwYXRoU3RyaXBwZXIgPSAvWyNdLiokLztcblxuLy8gSGFzIHRoZSBoaXN0b3J5IGhhbmRsaW5nIGFscmVhZHkgYmVlbiBzdGFydGVkP1xuSGlzdG9yeS5zdGFydGVkID0gZmFsc2U7XG5cbi8vIFNldCB1cCBhbGwgaW5oZXJpdGFibGUgKipCYWNrYm9uZS5IaXN0b3J5KiogcHJvcGVydGllcyBhbmQgbWV0aG9kcy5cbl8uZXh0ZW5kKEhpc3RvcnkucHJvdG90eXBlLCBFdmVudHMsIHtcblxuICAvLyBBcmUgd2UgYXQgdGhlIGFwcCByb290P1xuICBhdFJvb3Q6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmxvY2F0aW9uLnBhdGhuYW1lLnJlcGxhY2UoL1teXFwvXSQvLCAnJCYvJykgPT09IHRoaXMucm9vdDtcbiAgfSxcblxuICAvLyBHZXRzIHRoZSB0cnVlIGhhc2ggdmFsdWUuIENhbm5vdCB1c2UgbG9jYXRpb24uaGFzaCBkaXJlY3RseSBkdWUgdG8gYnVnXG4gIC8vIGluIEZpcmVmb3ggd2hlcmUgbG9jYXRpb24uaGFzaCB3aWxsIGFsd2F5cyBiZSBkZWNvZGVkLlxuICBnZXRIYXNoOiBmdW5jdGlvbih3aW5kb3cpIHtcbiAgICB2YXIgbWF0Y2ggPSAod2luZG93IHx8IHRoaXMpLmxvY2F0aW9uLmhyZWYubWF0Y2goLyMoLiopJC8pO1xuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogJyc7XG4gIH0sXG5cbiAgLy8gR2V0IHRoZSBjcm9zcy1icm93c2VyIG5vcm1hbGl6ZWQgVVJMIGZyYWdtZW50LCBlaXRoZXIgZnJvbSB0aGUgVVJMLFxuICAvLyB0aGUgaGFzaCwgb3IgdGhlIG92ZXJyaWRlLlxuICBnZXRGcmFnbWVudDogZnVuY3Rpb24oZnJhZ21lbnQsIGZvcmNlUHVzaFN0YXRlKSB7XG4gICAgaWYgKGZyYWdtZW50ID09IG51bGwpIHtcbiAgICAgIGlmICh0aGlzLl93YW50c1B1c2hTdGF0ZSB8fCAhdGhpcy5fd2FudHNIYXNoQ2hhbmdlKSB7XG4gICAgICAgIGZyYWdtZW50ID0gZGVjb2RlVVJJKHRoaXMubG9jYXRpb24ucGF0aG5hbWUgKyB0aGlzLmxvY2F0aW9uLnNlYXJjaCk7XG4gICAgICAgIHZhciByb290ID0gdGhpcy5yb290LnJlcGxhY2UodHJhaWxpbmdTbGFzaCwgJycpO1xuICAgICAgICBpZiAoIWZyYWdtZW50LmluZGV4T2Yocm9vdCkpIGZyYWdtZW50ID0gZnJhZ21lbnQuc2xpY2Uocm9vdC5sZW5ndGgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnJhZ21lbnQgPSB0aGlzLmdldEhhc2goKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50LnJlcGxhY2Uocm91dGVTdHJpcHBlciwgJycpO1xuICB9LFxuXG4gIC8vIFN0YXJ0IHRoZSBoYXNoIGNoYW5nZSBoYW5kbGluZywgcmV0dXJuaW5nIGB0cnVlYCBpZiB0aGUgY3VycmVudCBVUkwgbWF0Y2hlc1xuICAvLyBhbiBleGlzdGluZyByb3V0ZSwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICBzdGFydDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIGlmIChIaXN0b3J5LnN0YXJ0ZWQpIHRocm93IG5ldyBFcnJvcihcIkJhY2tib25lLmhpc3RvcnkgaGFzIGFscmVhZHkgYmVlbiBzdGFydGVkXCIpO1xuICAgIEhpc3Rvcnkuc3RhcnRlZCA9IHRydWU7XG5cbiAgICAvLyBGaWd1cmUgb3V0IHRoZSBpbml0aWFsIGNvbmZpZ3VyYXRpb24uXG4gICAgLy8gSXMgcHVzaFN0YXRlIGRlc2lyZWQgb3Igc2hvdWxkIHdlIHVzZSBoYXNoY2hhbmdlIG9ubHk/XG4gICAgdGhpcy5vcHRpb25zICAgICAgICAgID0gXy5leHRlbmQoe3Jvb3Q6ICcvJ30sIHRoaXMub3B0aW9ucywgb3B0aW9ucyk7XG4gICAgdGhpcy5yb290ICAgICAgICAgICAgID0gdGhpcy5vcHRpb25zLnJvb3Q7XG4gICAgdGhpcy5fd2FudHNIYXNoQ2hhbmdlID0gdGhpcy5vcHRpb25zLmhhc2hDaGFuZ2UgIT09IGZhbHNlO1xuICAgIHRoaXMuX3dhbnRzUHVzaFN0YXRlICA9ICEhdGhpcy5vcHRpb25zLnB1c2hTdGF0ZTtcbiAgICB2YXIgZnJhZ21lbnQgICAgICAgICAgPSB0aGlzLmdldEZyYWdtZW50KCk7XG5cbiAgICAvLyBOb3JtYWxpemUgcm9vdCB0byBhbHdheXMgaW5jbHVkZSBhIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHNsYXNoLlxuICAgIHRoaXMucm9vdCA9ICgnLycgKyB0aGlzLnJvb3QgKyAnLycpLnJlcGxhY2Uocm9vdFN0cmlwcGVyLCAnLycpO1xuXG4gICAgLy8gRGVwZW5kaW5nIG9uIHdoZXRoZXIgd2UncmUgdXNpbmcgcHVzaFN0YXRlIG9yIGhhc2hlcywgZGV0ZXJtaW5lIGhvdyB3ZVxuICAgIC8vIGNoZWNrIHRoZSBVUkwgc3RhdGUuXG4gICAgaWYgKHRoaXMuX3dhbnRzUHVzaFN0YXRlKSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCB0aGlzLmNoZWNrVXJsLCBmYWxzZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl93YW50c0hhc2hDaGFuZ2UpIHtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdoYXNoY2hhbmdlJywgdGhpcy5jaGVja1VybCwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8vIERldGVybWluZSBpZiB3ZSBuZWVkIHRvIGNoYW5nZSB0aGUgYmFzZSB1cmwsIGZvciBhIHB1c2hTdGF0ZSBsaW5rXG4gICAgLy8gb3BlbmVkIGJ5IGEgbm9uLXB1c2hTdGF0ZSBicm93c2VyLlxuICAgIHRoaXMuZnJhZ21lbnQgPSBmcmFnbWVudDtcbiAgICB2YXIgbG9jID0gdGhpcy5sb2NhdGlvbjtcblxuICAgIC8vIFRyYW5zaXRpb24gZnJvbSBoYXNoQ2hhbmdlIHRvIHB1c2hTdGF0ZSBvciB2aWNlIHZlcnNhIGlmIGJvdGggYXJlXG4gICAgLy8gcmVxdWVzdGVkLlxuICAgIGlmICh0aGlzLl93YW50c0hhc2hDaGFuZ2UgJiYgdGhpcy5fd2FudHNQdXNoU3RhdGUpIHtcblxuICAgICAgLy8gSWYgd2UndmUgc3RhcnRlZCBvdXQgd2l0aCBhIGhhc2gtYmFzZWQgcm91dGUsIGJ1dCB3ZSdyZSBjdXJyZW50bHlcbiAgICAgIC8vIGluIGEgYnJvd3NlciB3aGVyZSBpdCBjb3VsZCBiZSBgcHVzaFN0YXRlYC1iYXNlZCBpbnN0ZWFkLi4uXG4gICAgICBpZiAodGhpcy5hdFJvb3QoKSAmJiBsb2MuaGFzaCkge1xuICAgICAgICB0aGlzLmZyYWdtZW50ID0gdGhpcy5nZXRIYXNoKCkucmVwbGFjZShyb3V0ZVN0cmlwcGVyLCAnJyk7XG4gICAgICAgIHRoaXMuaGlzdG9yeS5yZXBsYWNlU3RhdGUoe30sIGRvY3VtZW50LnRpdGxlLCB0aGlzLnJvb3QgKyB0aGlzLmZyYWdtZW50KTtcbiAgICAgIH1cblxuICAgIH1cblxuICAgIGlmICghdGhpcy5vcHRpb25zLnNpbGVudCkgcmV0dXJuIHRoaXMubG9hZFVybCgpO1xuICB9LFxuXG4gIC8vIERpc2FibGUgQmFja2JvbmUuaGlzdG9yeSwgcGVyaGFwcyB0ZW1wb3JhcmlseS4gTm90IHVzZWZ1bCBpbiBhIHJlYWwgYXBwLFxuICAvLyBidXQgcG9zc2libHkgdXNlZnVsIGZvciB1bml0IHRlc3RpbmcgUm91dGVycy5cbiAgc3RvcDogZnVuY3Rpb24oKSB7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgdGhpcy5jaGVja1VybCk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2hhc2hjaGFuZ2UnLCB0aGlzLmNoZWNrVXJsKTtcbiAgICBIaXN0b3J5LnN0YXJ0ZWQgPSBmYWxzZTtcbiAgfSxcblxuICAvLyBBZGQgYSByb3V0ZSB0byBiZSB0ZXN0ZWQgd2hlbiB0aGUgZnJhZ21lbnQgY2hhbmdlcy4gUm91dGVzIGFkZGVkIGxhdGVyXG4gIC8vIG1heSBvdmVycmlkZSBwcmV2aW91cyByb3V0ZXMuXG4gIHJvdXRlOiBmdW5jdGlvbihyb3V0ZSwgY2FsbGJhY2spIHtcbiAgICB0aGlzLmhhbmRsZXJzLnVuc2hpZnQoe3JvdXRlOiByb3V0ZSwgY2FsbGJhY2s6IGNhbGxiYWNrfSk7XG4gIH0sXG5cbiAgLy8gQ2hlY2tzIHRoZSBjdXJyZW50IFVSTCB0byBzZWUgaWYgaXQgaGFzIGNoYW5nZWQsIGFuZCBpZiBpdCBoYXMsXG4gIC8vIGNhbGxzIGBsb2FkVXJsYC5cbiAgY2hlY2tVcmw6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjdXJyZW50ID0gdGhpcy5nZXRGcmFnbWVudCgpO1xuICAgIGlmIChjdXJyZW50ID09PSB0aGlzLmZyYWdtZW50KSByZXR1cm4gZmFsc2U7XG4gICAgdGhpcy5sb2FkVXJsKCk7XG4gIH0sXG5cbiAgLy8gQXR0ZW1wdCB0byBsb2FkIHRoZSBjdXJyZW50IFVSTCBmcmFnbWVudC4gSWYgYSByb3V0ZSBzdWNjZWVkcyB3aXRoIGFcbiAgLy8gbWF0Y2gsIHJldHVybnMgYHRydWVgLiBJZiBubyBkZWZpbmVkIHJvdXRlcyBtYXRjaGVzIHRoZSBmcmFnbWVudCxcbiAgLy8gcmV0dXJucyBgZmFsc2VgLlxuICBsb2FkVXJsOiBmdW5jdGlvbihmcmFnbWVudCkge1xuICAgIGZyYWdtZW50ID0gdGhpcy5mcmFnbWVudCA9IHRoaXMuZ2V0RnJhZ21lbnQoZnJhZ21lbnQpO1xuICAgIHJldHVybiB0aGlzLmhhbmRsZXJzLnNvbWUoZnVuY3Rpb24oaGFuZGxlcikge1xuICAgICAgaWYgKGhhbmRsZXIucm91dGUudGVzdChmcmFnbWVudCkpIHtcbiAgICAgICAgaGFuZGxlci5jYWxsYmFjayhmcmFnbWVudCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIC8vIFNhdmUgYSBmcmFnbWVudCBpbnRvIHRoZSBoYXNoIGhpc3RvcnksIG9yIHJlcGxhY2UgdGhlIFVSTCBzdGF0ZSBpZiB0aGVcbiAgLy8gJ3JlcGxhY2UnIG9wdGlvbiBpcyBwYXNzZWQuIFlvdSBhcmUgcmVzcG9uc2libGUgZm9yIHByb3Blcmx5IFVSTC1lbmNvZGluZ1xuICAvLyB0aGUgZnJhZ21lbnQgaW4gYWR2YW5jZS5cbiAgLy9cbiAgLy8gVGhlIG9wdGlvbnMgb2JqZWN0IGNhbiBjb250YWluIGB0cmlnZ2VyOiB0cnVlYCBpZiB5b3Ugd2lzaCB0byBoYXZlIHRoZVxuICAvLyByb3V0ZSBjYWxsYmFjayBiZSBmaXJlZCAobm90IHVzdWFsbHkgZGVzaXJhYmxlKSwgb3IgYHJlcGxhY2U6IHRydWVgLCBpZlxuICAvLyB5b3Ugd2lzaCB0byBtb2RpZnkgdGhlIGN1cnJlbnQgVVJMIHdpdGhvdXQgYWRkaW5nIGFuIGVudHJ5IHRvIHRoZSBoaXN0b3J5LlxuICBuYXZpZ2F0ZTogZnVuY3Rpb24oZnJhZ21lbnQsIG9wdGlvbnMpIHtcbiAgICBpZiAoIUhpc3Rvcnkuc3RhcnRlZCkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghb3B0aW9ucyB8fCBvcHRpb25zID09PSB0cnVlKSBvcHRpb25zID0ge3RyaWdnZXI6ICEhb3B0aW9uc307XG5cbiAgICB2YXIgdXJsID0gdGhpcy5yb290ICsgKGZyYWdtZW50ID0gdGhpcy5nZXRGcmFnbWVudChmcmFnbWVudCB8fCAnJykpO1xuXG4gICAgLy8gU3RyaXAgdGhlIGhhc2ggZm9yIG1hdGNoaW5nLlxuICAgIGZyYWdtZW50ID0gZnJhZ21lbnQucmVwbGFjZShwYXRoU3RyaXBwZXIsICcnKTtcblxuICAgIGlmICh0aGlzLmZyYWdtZW50ID09PSBmcmFnbWVudCkgcmV0dXJuO1xuICAgIHRoaXMuZnJhZ21lbnQgPSBmcmFnbWVudDtcblxuICAgIC8vIERvbid0IGluY2x1ZGUgYSB0cmFpbGluZyBzbGFzaCBvbiB0aGUgcm9vdC5cbiAgICBpZiAoZnJhZ21lbnQgPT09ICcnICYmIHVybCAhPT0gJy8nKSB1cmwgPSB1cmwuc2xpY2UoMCwgLTEpO1xuXG4gICAgLy8gSWYgd2UncmUgdXNpbmcgcHVzaFN0YXRlIHdlIHVzZSBpdCB0byBzZXQgdGhlIGZyYWdtZW50IGFzIGEgcmVhbCBVUkwuXG4gICAgaWYgKHRoaXMuX3dhbnRzUHVzaFN0YXRlKSB7XG4gICAgICB0aGlzLmhpc3Rvcnlbb3B0aW9ucy5yZXBsYWNlID8gJ3JlcGxhY2VTdGF0ZScgOiAncHVzaFN0YXRlJ10oe30sIGRvY3VtZW50LnRpdGxlLCB1cmwpO1xuXG4gICAgLy8gSWYgaGFzaCBjaGFuZ2VzIGhhdmVuJ3QgYmVlbiBleHBsaWNpdGx5IGRpc2FibGVkLCB1cGRhdGUgdGhlIGhhc2hcbiAgICAvLyBmcmFnbWVudCB0byBzdG9yZSBoaXN0b3J5LlxuICAgIH0gZWxzZSBpZiAodGhpcy5fd2FudHNIYXNoQ2hhbmdlKSB7XG4gICAgICB0aGlzLl91cGRhdGVIYXNoKHRoaXMubG9jYXRpb24sIGZyYWdtZW50LCBvcHRpb25zLnJlcGxhY2UpO1xuICAgIC8vIElmIHlvdSd2ZSB0b2xkIHVzIHRoYXQgeW91IGV4cGxpY2l0bHkgZG9uJ3Qgd2FudCBmYWxsYmFjayBoYXNoY2hhbmdlLVxuICAgIC8vIGJhc2VkIGhpc3RvcnksIHRoZW4gYG5hdmlnYXRlYCBiZWNvbWVzIGEgcGFnZSByZWZyZXNoLlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5sb2NhdGlvbi5hc3NpZ24odXJsKTtcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMudHJpZ2dlcikgcmV0dXJuIHRoaXMubG9hZFVybChmcmFnbWVudCk7XG4gIH0sXG5cbiAgLy8gVXBkYXRlIHRoZSBoYXNoIGxvY2F0aW9uLCBlaXRoZXIgcmVwbGFjaW5nIHRoZSBjdXJyZW50IGVudHJ5LCBvciBhZGRpbmdcbiAgLy8gYSBuZXcgb25lIHRvIHRoZSBicm93c2VyIGhpc3RvcnkuXG4gIF91cGRhdGVIYXNoOiBmdW5jdGlvbihsb2NhdGlvbiwgZnJhZ21lbnQsIHJlcGxhY2UpIHtcbiAgICBpZiAocmVwbGFjZSkge1xuICAgICAgdmFyIGhyZWYgPSBsb2NhdGlvbi5ocmVmLnJlcGxhY2UoLyhqYXZhc2NyaXB0OnwjKS4qJC8sICcnKTtcbiAgICAgIGxvY2F0aW9uLnJlcGxhY2UoaHJlZiArICcjJyArIGZyYWdtZW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU29tZSBicm93c2VycyByZXF1aXJlIHRoYXQgYGhhc2hgIGNvbnRhaW5zIGEgbGVhZGluZyAjLlxuICAgICAgbG9jYXRpb24uaGFzaCA9ICcjJyArIGZyYWdtZW50O1xuICAgIH1cbiAgfVxuXG59KTtcbiAgLy8gISEhXG4gIC8vIEluaXQuXG4gIFsnTW9kZWwnLCAnQ29sbGVjdGlvbicsICdSb3V0ZXInLCAnVmlldycsICdIaXN0b3J5J10uZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGl0ZW0gPSBCYWNrYm9uZVtuYW1lXTtcbiAgICBpZiAoaXRlbSkgaXRlbS5leHRlbmQgPSBCYWNrYm9uZS5leHRlbmQ7XG4gIH0pO1xuXG4gIC8vIEFsbG93IHRoZSBgQmFja2JvbmVgIG9iamVjdCB0byBzZXJ2ZSBhcyBhIGdsb2JhbCBldmVudCBidXMsIGZvciBmb2xrcyB3aG9cbiAgLy8gd2FudCBnbG9iYWwgXCJwdWJzdWJcIiBpbiBhIGNvbnZlbmllbnQgcGxhY2UuXG4gIF8uZXh0ZW5kKEJhY2tib25lLCBFdmVudHMpO1xuXG4gIC8vIENyZWF0ZSB0aGUgZGVmYXVsdCBCYWNrYm9uZS5oaXN0b3J5IGlmIHRoZSBIaXN0b3J5IG1vZHVsZSBpcyBpbmNsdWRlZC5cbiAgaWYgKEhpc3RvcnkpIEJhY2tib25lLmhpc3RvcnkgPSBuZXcgSGlzdG9yeSgpO1xuICByZXR1cm4gQmFja2JvbmU7XG59KTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxudmFyIF9tb2R1bGVzRm9ybVNjaGVtYUZvcm1TY2hlbWFWaWV3ID0gcmVxdWlyZSgnLi9tb2R1bGVzL2Zvcm0tc2NoZW1hL2Zvcm0tc2NoZW1hLXZpZXcnKTtcblxudmFyIF9tb2R1bGVzRm9ybVNjaGVtYUZvcm1TY2hlbWFWaWV3MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX21vZHVsZXNGb3JtU2NoZW1hRm9ybVNjaGVtYVZpZXcpO1xuXG52YXIgX2xpYnNIZWxwZXJzRW52aXJvbm1lbnQgPSByZXF1aXJlKCcuL2xpYnMvaGVscGVycy9lbnZpcm9ubWVudCcpO1xuXG52YXIgX2xpYnNGb3JtZWxsU2NoZW1hID0gcmVxdWlyZSgnLi9saWJzL2Zvcm1lbGwtc2NoZW1hJyk7XG5cbnZhciBfbGlic0Zvcm1lbGxTY2hlbWEyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfbGlic0Zvcm1lbGxTY2hlbWEpO1xuXG52YXIgRm9ybWVsbCA9IChmdW5jdGlvbiAoKSB7XG5cdF9jcmVhdGVDbGFzcyhGb3JtZWxsLCBbe1xuXHRcdGtleTogJ2Zvcm1WaWV3Jyxcblx0XHRzZXQ6IGZ1bmN0aW9uIHNldChmb3JtVmlldykge1xuXHRcdFx0dGhpcy5fZm9ybVZpZXcgPSBmb3JtVmlldztcblx0XHR9LFxuXHRcdGdldDogZnVuY3Rpb24gZ2V0KCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2Zvcm1WaWV3O1xuXHRcdH1cblx0fSwge1xuXHRcdGtleTogJ29wdGlvbnMnLFxuXHRcdHNldDogZnVuY3Rpb24gc2V0KG9wdGlvbnMpIHtcblx0XHRcdHRoaXMuX29wdGlvbnMgPSBvcHRpb25zO1xuXHRcdH0sXG5cdFx0Z2V0OiBmdW5jdGlvbiBnZXQoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fb3B0aW9ucztcblx0XHR9XG5cdH0sIHtcblx0XHRrZXk6ICdmb3JtJyxcblx0XHRzZXQ6IGZ1bmN0aW9uIHNldChmb3JtKSB7XG5cdFx0XHR0aGlzLl9mb3JtID0gZm9ybTtcblx0XHR9LFxuXHRcdGdldDogZnVuY3Rpb24gZ2V0KCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2Zvcm07XG5cdFx0fVxuXHR9XSk7XG5cblx0ZnVuY3Rpb24gRm9ybWVsbCgpIHtcblx0XHR2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG5cdFx0X2NsYXNzQ2FsbENoZWNrKHRoaXMsIEZvcm1lbGwpO1xuXG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHR9XG5cblx0Rm9ybWVsbC5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKCkge1xuXG5cdFx0dGhpcy5mb3JtVmlldyA9IG5ldyBfbW9kdWxlc0Zvcm1TY2hlbWFGb3JtU2NoZW1hVmlldzJbJ2RlZmF1bHQnXSh7XG5cdFx0XHRhY3Rpb246IHRoaXMub3B0aW9ucy5hY3Rpb24gfHwgJ2phdmFzY3JpcHQ6dm9pZCgwKScsXG5cdFx0XHRtZXRob2Q6IHRoaXMub3B0aW9ucy5tZXRob2QgfHwgJ1BPU1QnLFxuXHRcdFx0ZGF0YTogdGhpcy5vcHRpb25zLmRhdGEgfHwge31cblx0XHR9KTtcblxuXHRcdHRoaXMuZm9ybSA9IHRoaXMuZm9ybVZpZXcucmVuZGVyKCkuZWw7XG5cblx0XHRyZXR1cm4gdGhpcy5mb3JtO1xuXHR9O1xuXG5cdHJldHVybiBGb3JtZWxsO1xufSkoKTtcblxuO1xuXG4vLyBhZGQgZm9ybWVsIGNsYXNzIHRvIGdsb2JhbCBuYW1lc3BhY2Vcbl9saWJzSGVscGVyc0Vudmlyb25tZW50LmdldEdsb2JhbE9iamVjdCgpLkZvcm1lbGwgPSBGb3JtZWxsO1xuXG5leHBvcnRzWydkZWZhdWx0J10gPSBGb3JtZWxsO1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzWydkZWZhdWx0J107IiwiLyoqXG4gKiBiYXNlZCBvbiBodHRwczovL2dpdGh1Yi5jb20vcmVkcGllL2JhY2tib25lLXNjaGVtYVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxudmFyIF9oZWxwZXJzRXhvc2tlbGVzc3RvbiA9IHJlcXVpcmUoJy4vaGVscGVycy9leG9za2VsZXNzdG9uJyk7XG5cbnZhciBfaGVscGVyc0V4b3NrZWxlc3N0b24yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaGVscGVyc0V4b3NrZWxlc3N0b24pO1xuXG52YXIgX2hlbHBlcnNFbnZpcm9ubWVudCA9IHJlcXVpcmUoJy4vaGVscGVycy9lbnZpcm9ubWVudCcpO1xuXG4ndXNlIHN0cmljdCc7XG5cbi8vIGhlbHBlclxuZnVuY3Rpb24gdW5kZWYoKSB7XG4gICAgcmV0dXJuIGFyZ3VtZW50c1swXTtcbn1cblxudmFyIEZvcm1lbGxTY2hlbWEgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBTY2hlbWEgPSB7fTtcblxuICAgIGZ1bmN0aW9uIGxvZygpIHt9XG5cbiAgICBmdW5jdGlvbiB0b09iamVjdChrZXksIHZhbHVlKSB7XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0eXBlT2YoVmFsdWUsIGFUeXBlKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgVmFsdWUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgYVR5cGUgPT0gJ2Z1bmN0aW9uJyA/IG5ldyBWYWx1ZSgpIGluc3RhbmNlb2YgYVR5cGUgOiBmYWxzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbnN0YW5jZU9mKGluc3QsIGFUeXBlKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgYVR5cGUgPT0gJ2Z1bmN0aW9uJyA/IGluc3QgaW5zdGFuY2VvZiBhVHlwZSA6IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFJlcGxhY2UgZGVmYXVsdCBiYWNrYm9uZSBpbmhlcml0YW5jZSBjb2RlIHdpdGggdGhlIGZvbGxvd2luZyB3aGljaFxuICAgIC8vIHJldHVybnMgdGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoZSB1bmRlcmx5aW5nIGNvbnN0cnVjdG9ycyB3aGljaFxuICAgIC8vIGZhY2lsaXRhdGVzIHRoZSBJZGVudGl0eU1hcCBmZWF0dXJlXG4gICAgdmFyIEN0b3IgPSBmdW5jdGlvbiBDdG9yKCkge307XG5cbiAgICBmdW5jdGlvbiBpbmhlcml0cyhwYXJlbnQsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG4gICAgICAgIHZhciBjaGlsZDtcblxuICAgICAgICAvLyBUaGUgY29uc3RydWN0b3IgZnVuY3Rpb24gZm9yIHRoZSBuZXcgc3ViY2xhc3MgaXMgZWl0aGVyIGRlZmluZWQgYnkgeW91XG4gICAgICAgIC8vICh0aGUgXCJjb25zdHJ1Y3RvclwiIHByb3BlcnR5IGluIHlvdXIgYGV4dGVuZGAgZGVmaW5pdGlvbiksIG9yIGRlZmF1bHRlZFxuICAgICAgICAvLyBieSB1cyB0byBzaW1wbHkgY2FsbCB0aGUgcGFyZW50J3MgY29uc3RydWN0b3IuXG4gICAgICAgIGlmIChwcm90b1Byb3BzICYmIHByb3RvUHJvcHMuaGFzT3duUHJvcGVydHkoJ2NvbnN0cnVjdG9yJykpIHtcbiAgICAgICAgICAgIGNoaWxkID0gcHJvdG9Qcm9wcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNoaWxkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIC8vIFJldHVybmluZyB0aGUgcmV0dXJuIHZhbHVlIGZyb20gcGFyZW50IGJlbG93IGZhY2lsaXRhdGVzXG4gICAgICAgICAgICAgICAgLy8gdGhlIElkZW50aXR5TWFwIGZlYXR1cmVcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW5oZXJpdCBjbGFzcyAoc3RhdGljKSBwcm9wZXJ0aWVzIGZyb20gcGFyZW50LlxuICAgICAgICBPYmplY3QuYXNzaWduKGNoaWxkLCBwYXJlbnQpO1xuXG4gICAgICAgIC8vIFNldCB0aGUgcHJvdG90eXBlIGNoYWluIHRvIGluaGVyaXQgZnJvbSBgcGFyZW50YCwgd2l0aG91dCBjYWxsaW5nXG4gICAgICAgIC8vIGBwYXJlbnRgJ3MgY29uc3RydWN0b3IgZnVuY3Rpb24uXG4gICAgICAgIEN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTtcbiAgICAgICAgY2hpbGQucHJvdG90eXBlID0gbmV3IEN0b3IoKTtcblxuICAgICAgICAvLyBBZGQgcHJvdG90eXBlIHByb3BlcnRpZXMgKGluc3RhbmNlIHByb3BlcnRpZXMpIHRvIHRoZSBzdWJjbGFzcyxcbiAgICAgICAgLy8gaWYgc3VwcGxpZWQuXG4gICAgICAgIGlmIChwcm90b1Byb3BzKSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNoaWxkLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgc3RhdGljIHByb3BlcnRpZXMgdG8gdGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLCBpZiBzdXBwbGllZC5cbiAgICAgICAgaWYgKHN0YXRpY1Byb3BzKSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNoaWxkLCBzdGF0aWNQcm9wcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb3JyZWN0bHkgc2V0IGNoaWxkJ3MgYHByb3RvdHlwZS5jb25zdHJ1Y3RvcmAuXG4gICAgICAgIGNoaWxkLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGNoaWxkO1xuXG4gICAgICAgIC8vIFNldCBhIGNvbnZlbmllbmNlIHByb3BlcnR5IGluIGNhc2UgdGhlIHBhcmVudCdzIHByb3RvdHlwZSBpcyBuZWVkZWQgbGF0ZXIuXG4gICAgICAgIGNoaWxkWydfX3N1cGVyX18nXSA9IHBhcmVudC5wcm90b3R5cGU7XG5cbiAgICAgICAgcmV0dXJuIGNoaWxkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGludGVybmFsRXh0ZW5kKHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IGluaGVyaXRzKHRoaXMsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKTtcbiAgICAgICAgY2hpbGQuaW50ZXJuYWxFeHRlbmQgPSB0aGlzLmludGVybmFsRXh0ZW5kO1xuICAgICAgICBjaGlsZC5wcm90b3R5cGUudW5pcXVlVHlwZUlkID0gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLnV0aWxzLnVuaXF1ZUlkKCk7XG4gICAgICAgIHJldHVybiBjaGlsZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBKU09OUG9pbnRlciBpbXBsZW1lbnRhdGlvbiBvZiBodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9kcmFmdC1pZXRmLWFwcHNhd2ctanNvbi1wb2ludGVyLTAzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iaiBKU09OIG9iamVjdFxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gSlNPTlBvaW50ZXIob2JqKSB7XG4gICAgICAgIHRoaXMub2JqID0gb2JqO1xuICAgIH1cbiAgICBKU09OUG9pbnRlci5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldHMgdGhlIHZhbHVlIGxvY2F0ZWQgYXQgdGhlIEpTT05Qb2ludGVyIHBhdGhcbiAgICAgICAgICogQHBhcmFtICB7U3RyaW5nfSBwYXRoIFBhdGggaW4gdGhlIGZvcm1hdCBcIi9mb28vYmFyLzBcIlxuICAgICAgICAgKiBAcmV0dXJuIHtOdW1iZXJ8U3RyaW5nfE9iamVjdH0gICAgICBWYWx1ZSBsb2NhdGVkIGF0IHBhdGhcbiAgICAgICAgICovXG4gICAgICAgIGdldDogZnVuY3Rpb24gZ2V0KHBhdGgpIHtcbiAgICAgICAgICAgIGlmIChwYXRoID09PSAnJykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm9iajtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9maW5kKHRoaXMub2JqLCB0aGlzLl90b1BhcnRzKHBhdGgpKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0cyB0aGUgcHJvZXJ0eSBsb2NhdGVkIGF0IHRoZSBwcm92aWRlZCBwYXRoXG4gICAgICAgICAqIEBwYXJhbSB7W3R5cGVdfSBwYXRoICBQYXRoIGluIHRoZSBmb3JtYXQgXCIvZm9vL2Jhci8wXCJcbiAgICAgICAgICogQHBhcmFtIHtbdHlwZV19IHZhbHVlIFZhbHVlIHRvIHNldFxuICAgICAgICAgKi9cbiAgICAgICAgc2V0OiBmdW5jdGlvbiBzZXQocGF0aCwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChwYXRoID09PSAnJykge1xuICAgICAgICAgICAgICAgIHRoaXMub2JqID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgcGFydHMgPSB0aGlzLl90b1BhcnRzKHBhdGgpLFxuICAgICAgICAgICAgICAgIG5hbWUgPSBwYXJ0cy5wb3AoKSxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eSA9IHBhcnRzLmxlbmd0aCA+IDAgPyB0aGlzLl9maW5kKHRoaXMub2JqLCBwYXJ0cykgOiB0aGlzLm9iajtcblxuICAgICAgICAgICAgaWYgKHByb3BlcnR5ICE9PSB1bmRlZigpICYmIHByb3BlcnR5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlbbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF90b1BhcnRzOiBmdW5jdGlvbiBfdG9QYXJ0cyhwYXRoKSB7XG4gICAgICAgICAgICByZXR1cm4gcGF0aC5zcGxpdCgnLycpLnNsaWNlKDEpLm1hcChmdW5jdGlvbiAocGFydCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXJ0LnJlcGxhY2UoJ34xJywgJy8nKS5yZXBsYWNlKCd+MCcsICd+Jyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9maW5kOiBmdW5jdGlvbiBfZmluZChvYmosIHBhdGhzKSB7XG4gICAgICAgICAgICB2YXIgcHJvcGVydHkgPSBvYmpbcGF0aHNbMF1dO1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5ICE9PSB1bmRlZigpICYmIHByb3BlcnR5ICE9PSBudWxsICYmIHBhdGhzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBwYXRocy5zaGlmdCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9maW5kKHByb3BlcnR5LCBwYXRocyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJvcGVydHk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIEpTT05Qb2ludGVyLmlzUG9pbnRlciA9IGZ1bmN0aW9uIChwb2ludGVyKSB7XG4gICAgICAgIHJldHVybiBwb2ludGVyICE9PSB1bmRlZigpICYmIHBvaW50ZXIgIT09IG51bGwgfHwgcG9pbnRlci5pbmRleE9mKCcjJykgPj0gMCA/IHRydWUgOiBmYWxzZTtcbiAgICB9O1xuICAgIEpTT05Qb2ludGVyLmZyYWdtZW50UGFydCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgIHZhciBwYXJ0cyA9IHBhdGguc3BsaXQoJyMnKTtcbiAgICAgICAgcmV0dXJuIHBhcnRzLmxlbmd0aCA+IDEgPyBwYXJ0c1sxXSA6IHVuZGVmKCk7XG4gICAgfTtcbiAgICBKU09OUG9pbnRlci5yZW1vdmVGcmFnbWVudCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgIHJldHVybiBwYXRoLnNwbGl0KCcjJylbMF07XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFNjaGVtYUZhY3RvcnkgcHJvdmlkZXMgbWV0aG9kcyB0byByZWdpc3RlciBhbmQgY3JlYXRlIG5ldyBNb2RlbHMgYW5kIENvbGxlY3Rpb25zXG4gICAgICogZnJvbSBKU09OIFNjaGVtYXMuXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgdmFyIFNjaGVtYUZhY3RvcnkgPSBTY2hlbWEuRmFjdG9yeSA9IGZ1bmN0aW9uIFNjaGVtYUZhY3Rvcnkob3B0aW9ucykge1xuXG4gICAgICAgIC8vIEluaXRpYWxpc2UgdGhlIG9wdGlvbnMgb2JqZWN0XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYWludGFpbnMgYSBsaXN0IG9mIHJlZ2lzdGVyZWQgc2NoZW1hcywgaW5kZXhlZCBieSBzY2hlbWEuaWRcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVnaXN0ZXJlZFNjaGVtYXMgPSB7fTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogTWFpbnRhaW5zIGEgbGlzdCBvZiByZWdpc3RlcmVkIG1vZGVscywgaW5kZXhlZCBieSBzY2hlbWEuaWRcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVnaXN0ZXJlZFNjaGVtYVR5cGVzID0ge307XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1haW50YWlucyBhIGxpc3Qgb2YgcGFyc2VkIHNjaGVtYXMsIGluZGV4ZWQgYnkgc2NoZW1hLmlkXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBhcnNlZFNjaGVtYUNhY2hlID0ge307XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1haW50YWlucyBhIGxpc3Qgb2YgY29uc3RydWN0ZWQgTW9kZWxzIGFuZCBDb2xsZWN0aW9ucywgaW5kZXhlZCBieSBzY2hlbWEuaWRcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudHlwZUNhY2hlID0ge307XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1haW50YWlucyBhIGxpc3Qgb2YgYWxsIGluc3RhbnRpYXRlZCBtb2RlbHNcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaW5zdGFuY2VDYWNoZSA9IHt9O1xuXG4gICAgICAgIC8vIEVuc3VyZSB0aGUgYmFzZSBtb2RlbCBpcyBvZiB0eXBlIFNjaGVtYU1vZGVsXG4gICAgICAgIGlmIChvcHRpb25zLm1vZGVsICYmICF0eXBlT2Yob3B0aW9ucy5tb2RlbCwgU2NoZW1hTW9kZWwpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJvcHRpb25zLm1vZGVsIE1VU1QgZXh0ZW5kIEV4b3NrZWxlc3N0b24uU2NoZW1hLk1vZGVsXCIpO1xuICAgICAgICB9XG4gICAgICAgIC8vIEVuc3VyZSB0aGUgYmFzZSBtb2RlbCBpcyBvZiB0eXBlIFNjaGVtYUNvbGxlY3Rpb25cbiAgICAgICAgaWYgKG9wdGlvbnMuY29sbGVjdGlvbiAmJiAhdHlwZU9mKG9wdGlvbnMuY29sbGVjdGlvbiwgU2NoZW1hQ29sbGVjdGlvbikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIm9wdGlvbnMuY29sbGVjdGlvbiBNVVNUIGV4dGVuZCBFeG9za2VsZXNzdG9uLlNjaGVtYS5Db2xsZWN0aW9uXCIpO1xuICAgICAgICB9XG4gICAgICAgIC8vIEVuc3VyZSB0aGUgYmFzZSBtb2RlbCBpcyBvZiB0eXBlIFNjaGVtYVZhbHVlQ29sbGVjdGlvblxuICAgICAgICBpZiAob3B0aW9ucy52YWx1ZUNvbGxlY3Rpb24gJiYgIXR5cGVPZihvcHRpb25zLnZhbHVlQ29sbGVjdGlvbiwgU2NoZW1hVmFsdWVDb2xsZWN0aW9uKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwib3B0aW9ucy52YWx1ZUNvbGxlY3Rpb24gTVVTVCBleHRlbmQgRXhvc2tlbGVzc3Rvbi5TY2hlbWEuVmFsdWVDb2xsZWN0aW9uXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWxsIG1vZGVscyBjcmVhdGVkIGJ5IHRoaXMgZmFjdG9yeSB3aWxsIGJlIG9mIHRoZSBwcm92aWRlZCB0eXBlIG9yIFNjaGVtYU1vZGVsXG4gICAgICAgIHRoaXMuYmFzZU1vZGVsID0gb3B0aW9ucy5tb2RlbCB8fCBTY2hlbWFNb2RlbDtcbiAgICAgICAgLy8gQWxsIGNvbGxlY3Rpb25zIGNyZWF0ZWQgYnkgdGhpcyBmYWN0b3J5IHdpbGwgYmUgb2YgdGhlIHByb3ZpZGVkIHR5cGUgb3IgU2NoZW1hQ29sbGVjdGlvblxuICAgICAgICB0aGlzLmJhc2VDb2xsZWN0aW9uID0gb3B0aW9ucy5jb2xsZWN0aW9uIHx8IFNjaGVtYUNvbGxlY3Rpb247XG4gICAgICAgIC8vIEFsbCB2YWx1ZSBjb2xsZWN0aW9ucyBjcmVhdGVkIGJ5IHRoaXMgZmFjdG9yeSB3aWxsIGJlIG9mIHRoZSBwcm92aWRlZCB0eXBlIG9yIFNjaGVtYVZhbHVlQ29sbGVjdGlvblxuICAgICAgICB0aGlzLmJhc2VWYWx1ZUNvbGxlY3Rpb24gPSBvcHRpb25zLnZhbHVlQ29sbGVjdGlvbiB8fCBTY2hlbWFWYWx1ZUNvbGxlY3Rpb247XG4gICAgfTtcblxuICAgIFNjaGVtYUZhY3RvcnkucHJvdG90eXBlID0ge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWdpc3RlcnMgdGhlIHByb3ZpZGVkIHNjaGVtYSBhbmQgb3B0aW9uYWwgbW9kZWwuXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGFsbG93cyB5b3UgdG8gYXNzb2NpYXRlIGEgTW9kZWwgb3IgQ29sbGVjdGlvbiB3aXRoIGFcbiAgICAgICAgICogcGFydGljdWxhciBzY2hlbWEgd2hpY2ggaXMgdXNlZnVsIHdoZW4geW91IHdpc2ggdG8gcHJvdmlkZSBjdXN0b21cbiAgICAgICAgICogZnVuY3Rpb25hbGl0eSBmb3Igc2NoZW1hcyB3aGljaCBtYXkgYmUgZW1iZWRkZWQgaW4gb3RoZXIgc2NoZW1hcy5cbiAgICAgICAgICogQHBhcmFtICB7U3RyaW5nfE9iamVjdH0gc2NoZW1hIFByb3ZpZGUgYSBzY2hlbWEgaWQgb3IgYSBzY2hlbWEgb2JqZWN0XG4gICAgICAgICAqIEBwYXJhbSAge0V4b3NrZWxlc3N0b24uU2NoZW1hLk1vZGVsfEV4b3NrZWxlc3N0b24uU2NoZW1hLkNvbGxlY3Rpb258RXhvc2tlbGVzc3Rvbi5TY2hlbWEuVmFsdWVDb2xsZWN0aW9ufSBtb2RlbCAgUHJvdmlkZSBhIG1vZGVsIG9yIGNvbGxlY3Rpb24gdG8gYXNzb2NpYXRlIHdpdGggdGhpcyBzY2hlbWFcbiAgICAgICAgICogQHJldHVybiB7dGhpc31cbiAgICAgICAgICovXG4gICAgICAgIHJlZ2lzdGVyOiBmdW5jdGlvbiByZWdpc3RlcihzY2hlbWEsIG1vZGVsKSB7XG4gICAgICAgICAgICB2YXIgc2NoZW1hSWQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHNjaGVtYSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHNjaGVtYUlkID0gc2NoZW1hO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzY2hlbWFJZCA9IHNjaGVtYS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNjaGVtYUlkID09PSB1bmRlZigpIHx8IHNjaGVtYUlkID09PSBudWxsIHx8IHNjaGVtYUlkID09PSAnJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlZ2lzdGVyIGEgc2NoZW1hIHdpdGggbm8gaWQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS51dGlscy5pc09iamVjdChzY2hlbWEpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RlcmVkU2NoZW1hc1tzY2hlbWFJZF0gPSBzY2hlbWE7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMucGFyc2VkU2NoZW1hQ2FjaGVbc2NoZW1hSWRdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobW9kZWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlZ2lzdGVyZWRTY2hlbWFUeXBlc1tzY2hlbWFJZF0gPSBtb2RlbDtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy50eXBlQ2FjaGVbc2NoZW1hSWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVbnJlZ2lzdGVyIGEgc2NoZW1hXG4gICAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gc2NoZW1hSWQgVGhlIHNjaGVtYSBpZCBvZiB0aGUgc2NoZW1hIHlvdSB3aXNoIHRvIHVucmVnaXN0ZXJcbiAgICAgICAgICogQHJldHVybiB7dGhpc31cbiAgICAgICAgICovXG4gICAgICAgIHVucmVnaXN0ZXI6IGZ1bmN0aW9uIHVucmVnaXN0ZXIoc2NoZW1hSWQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnJlZ2lzdGVyZWRTY2hlbWFzW3NjaGVtYUlkXTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnJlZ2lzdGVyZWRTY2hlbWFUeXBlc1tzY2hlbWFJZF07XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5wYXJzZWRTY2hlbWFDYWNoZVtzY2hlbWFJZF07XG4gICAgICAgICAgICBkZWxldGUgdGhpcy50eXBlQ2FjaGVbc2NoZW1hSWRdO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENsZWFycyBhbGwgY2FjaGVzLiBVc2VkIGJ5IHRoZSB0ZXN0c1xuICAgICAgICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgICAgICAgKi9cbiAgICAgICAgcmVzZXQ6IGZ1bmN0aW9uIHJlc2V0KCkge1xuICAgICAgICAgICAgdGhpcy5yZWdpc3RlcmVkU2NoZW1hcyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5yZWdpc3RlcmVkU2NoZW1hVHlwZXMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucGFyc2VkU2NoZW1hQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgIHRoaXMudHlwZUNhY2hlID0ge307XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlQ2FjaGUgPSB7fTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdGUgYSBNb2RlbCBvciBDb2xsZWN0aW9uIGZyb20gdGhlIHByb3ZpZGVkIHNjaGVtYVxuICAgICAgICAgKiBAcGFyYW0gIHtTdHJpbmd8T2JqZWN0fSBzY2hlbWEgUHJvdmlkZSB0aGUgc2NoZW1hIG9yIHRoZSBzY2hlbWEgaWQgb2YgYSBwcmV2aW91c2x5IHJlZmlzdGVyZWQgc2NoZW1hXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdD19IG1vZGVsICBQcm92aWRlcyBhbiBvcHRpb25hbCBtb2RlbCBvciBjb2xsZWN0aW9uIHdoaWNoIG92ZXJyaWRlcyB0aGUgZGVmYXVsdCBiYXNlIGNsYXNzLlxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICBSZXR1cm5zIHRoZSBjb250cnVjdGVkIG1vZGVsIG9yIGNvbGxlY3Rpb25cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZTogZnVuY3Rpb24gY3JlYXRlKHNjaGVtYSwgbW9kZWwpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc2NoZW1hID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgc2NoZW1hID0gdGhpcy5fZ2V0KHNjaGVtYSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNjaGVtYS5pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVnaXN0ZXIoc2NoZW1hLCBtb2RlbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjaGVtYSA9IHRoaXMucGFyc2Uoc2NoZW1hKTtcblxuICAgICAgICAgICAgaWYgKHNjaGVtYS50eXBlICYmIHNjaGVtYS50eXBlID09PSAnYXJyYXknKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NyZWF0ZUNvbGxlY3Rpb24oc2NoZW1hLCB1bmRlZigpLCBtb2RlbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY3JlYXRlTW9kZWwoc2NoZW1hLCB1bmRlZigpLCBtb2RlbCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBhIE1vZGVsIG9yIENvbGxlY3Rpb24gZnJvbSB0aGUgcHJvdmlkZWQgc2NoZW1hXG4gICAgICAgICAqIEBwYXJhbSAge1N0cmluZ3xPYmplY3R9IHNjaGVtYSBQcm92aWRlIHRoZSBzY2hlbWEgb3IgdGhlIHNjaGVtYSBpZCBvZiBhIHByZXZpb3VzbHkgcmVmaXN0ZXJlZCBzY2hlbWFcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gbW9kZWwgIFByb3ZpZGVzIGFuIG9wdGlvbmFsIG1vZGVsIG9yIGNvbGxlY3Rpb24gd2hpY2ggb3ZlcnJpZGVzIHRoZSBkZWZhdWx0IGJhc2UgY2xhc3MuXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdD19IGF0dHJpYnV0ZXMgW2Rlc2NyaXB0aW9uXVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBvcHRpb25zICAgIFtkZXNjcmlwdGlvbl1cbiAgICAgICAgICogQHJldHVybiB7W3R5cGVdfSAgICAgICAgICAgIFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgbW9kZWwgb3IgY29sbGVjdGlvblxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlSW5zdGFuY2U6IGZ1bmN0aW9uIGNyZWF0ZUluc3RhbmNlKHNjaGVtYSwgbW9kZWwsIGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGlmICghKHR5cGVvZiBtb2RlbCA9PSAnZnVuY3Rpb24nKSAmJiBvcHRpb25zID09PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IGF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgYXR0cmlidXRlcyA9IG1vZGVsO1xuICAgICAgICAgICAgICAgIG1vZGVsID0gdW5kZWYoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBNb2RlbCA9IHRoaXMuY3JlYXRlKHNjaGVtYSwgbW9kZWwpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBNb2RlbChhdHRyaWJ1dGVzLCBvcHRpb25zKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9nZXQ6IGZ1bmN0aW9uIF9nZXQoc2NoZW1hSWQpIHtcblxuICAgICAgICAgICAgaWYgKHNjaGVtYUlkID09PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjaGVtYUlkID0gc2NoZW1hSWQuc3BsaXQoJyMnKVswXTtcblxuICAgICAgICAgICAgdmFyIHNjaGVtYSA9IHRoaXMucmVnaXN0ZXJlZFNjaGVtYXNbc2NoZW1hSWRdO1xuICAgICAgICAgICAgaWYgKHNjaGVtYSA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIHNjaGVtYSA9IHRoaXMuZmV0Y2goc2NoZW1hSWQpO1xuICAgICAgICAgICAgICAgIGlmIChzY2hlbWEgIT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RlcmVkU2NoZW1hc1tzY2hlbWFJZF0gPSBzY2hlbWE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmluZCBzY2hlbWEgJyArIHNjaGVtYUlkID8gc2NoZW1hSWQgOiAnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc2NoZW1hO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBPdmVycmlkZSB0aGlzIG1ldGhvZCB0byBwcm92aWRlIGEgd2F5IHRvIGZldGNoIHNjaGVtYSBmcm9tIGEgc2VydmVyXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdHx1bmRlZigpfSBSZXR1cm5zIHRoZSBzY2hlbWEgb3IgdW5kZWYoKSBpZiBub3QgZm91bmRcbiAgICAgICAgICovXG4gICAgICAgIGZldGNoOiBmdW5jdGlvbiBmZXRjaChzY2hlbWFJZCkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZXMgYW4gb2JqZWN0IG1vZGVsIHJlcHJlc2VudGF0aW9uIG9mIHNjaGVtYSBieSBwb3B1bGF0aW5nXG4gICAgICAgICAqIGFsbCByZWZlcmVuY2VzIGFuZCBleHRlbnNpb25zICgkcmVmJ3MpIHdoaWNoIHRoZWlyIGNvcnJlc3BvbmRpbmdcbiAgICAgICAgICogc2NoZW1hcyBpbiBmdWxsLlxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3R9IHNjaGVtYSBQcm92aWRlIHRoZSBzY2hlbWEgdG8gcGFyc2VcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgUmV0dXJucyB0aGUgcGFyc2VkIHNjaGVtYVxuICAgICAgICAgKi9cbiAgICAgICAgcGFyc2U6IGZ1bmN0aW9uIHBhcnNlKHNjaGVtYSkge1xuICAgICAgICAgICAgLy8gRW5zdXJlIHRoYXQgcm9vdCBzY2hlbWFzIGFyZSBpZGVudGlmaWFibGUgYnkgYW4gaWQuXG4gICAgICAgICAgICAvLyBUaGlzIGlzIHVzZWQgZm9yIGNhY2hpbmcgcHVycG9zZXMgaW50ZXJuYWxseVxuICAgICAgICAgICAgaWYgKHNjaGVtYS5pZCA9PT0gdW5kZWYoKSB8fCBzY2hlbWEuaWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBzY2hlbWEuaWQgPSBKU09OLnN0cmluZ2lmeShzY2hlbWEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3BhcnNlKHNjaGVtYSwgc2NoZW1hKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlZCB0aGUgdHJhaWxpbmcgIyBmcm9tIGEgc2NoZW1hIGlkXG4gICAgICAgICAqIEBwYXJhbSAge1N0cmluZ30gc2NoZW1hSWQgU2NoZW1hIGlkXG4gICAgICAgICAqIEByZXR1cm4ge1N0cmluZ30gICAgICAgICAgU2NoZW1hIGlkIG1pbnVzIHRoZSB0cmFpbGluZyAjXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfcmVtb3ZlVHJhaWxpbmdIYXNoOiBmdW5jdGlvbiBfcmVtb3ZlVHJhaWxpbmdIYXNoKHNjaGVtYUlkKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgdHJhaWxpbmcgI1xuICAgICAgICAgICAgcmV0dXJuIHNjaGVtYUlkICE9PSB1bmRlZigpICYmIHNjaGVtYUlkLmxlbmd0aCA+IDEgPyBzY2hlbWFJZC5jaGFyQXQoc2NoZW1hSWQubGVuZ3RoIC0gMSkgPT09ICcjJyA/IHNjaGVtYUlkLnNsaWNlKDAsIC0xKSA6IHNjaGVtYUlkIDogdW5kZWYoKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUHJvdmlkZXMgdGhlIHJlY3Vyc2l2ZSBwYXJzZSBtZXRob2RcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSBzY2hlbWEgICAgIFByb3ZpZGUgdGhlIHNjaGVtYSB0byBwYXJzZVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3R9IHJvb3RTY2hlbWEgUHJvdmlkZSB0aGUgcm9vdCBzY2hlbWEgd2hpY2ggY29ycmVzcG9uZHMgdG8gJHJlZj1cIiNcIlxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICAgUmV0dXJucyB0aGUgcGFyc2VkIHNjaGVtYVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3BhcnNlOiBmdW5jdGlvbiBfcGFyc2Uoc2NoZW1hLCByb290U2NoZW1hKSB7XG5cbiAgICAgICAgICAgIGlmIChzY2hlbWEgPT09IHVuZGVmKCkgfHwgc2NoZW1hID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBzY2hlbWFJZCA9IHRoaXMuX3JlbW92ZVRyYWlsaW5nSGFzaChzY2hlbWEuaWQpO1xuICAgICAgICAgICAgaWYgKHNjaGVtYUlkICYmIHRoaXMucGFyc2VkU2NoZW1hQ2FjaGVbc2NoZW1hSWRdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VkU2NoZW1hQ2FjaGVbc2NoZW1hSWRdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcmVmZXJlbmNlID0gc2NoZW1hWyckcmVmJ107XG4gICAgICAgICAgICBpZiAocmVmZXJlbmNlICYmIHRoaXMucGFyc2VkU2NoZW1hQ2FjaGVbcmVmZXJlbmNlXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlZFNjaGVtYUNhY2hlW3JlZmVyZW5jZV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgLy8gVG8gYXZvaWQgaW5maW5pdGUgbG9vcHMgb24gY2lyY3VsYXIgc2NoZW1hIHJlZmVyZW5jZXMsIGRlZmluZSB0aGVcbiAgICAgICAgICAgIC8vIGV4cGFuZGVkIHNjaGVtYSBub3cgKGFoZWFkIG9mIGV2YWx1YXRpbmcgaXQpIGFuZCBhZGQgaXQgdG8gdGhlIGNhY2hlLlxuICAgICAgICAgICAgLy8gUmUtZW50cmFudCBjYWxscyB3aWxsIHB1bGwgdGhlIGVtcHR5IG9iamVjdCBmcm9tIHRoZSBjYWNoZSB3aGljaFxuICAgICAgICAgICAgLy8gd2lsbCBldmVudHVhbGx5IGJlIHBvcHVsYXRlZCBhcyB0aGUgcmVjdXJzaW9ucyBleGl0LlxuICAgICAgICAgICAgLy92YXIgZXhwYW5kZWRTY2hlbWEgPSBzY2hlbWE7XG4gICAgICAgICAgICBpZiAoc2NoZW1hSWQgIT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlZFNjaGVtYUNhY2hlW3NjaGVtYUlkXSA9IHNjaGVtYTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgICAgICAvLyBQcm9jZXNzIHJlZmVyZW5jZXMgZWFybHksIGFzIHRoZXkgY2FuJ3QgaGF2ZSBhbnkgb3RoZXJcbiAgICAgICAgICAgIC8vIGZpZWxkcy9wcm9wZXJ0aWVzIHByZXNlbnQuXG4gICAgICAgICAgICBpZiAocmVmZXJlbmNlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IG1vc3QgY29tbW9uIHVzYWdlXG4gICAgICAgICAgICAgICAgaWYgKHJlZmVyZW5jZSA9PT0gJyMnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByb290U2NoZW1hO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBwYXJ0cyA9IHJlZmVyZW5jZS5zcGxpdCgnIycpLFxuICAgICAgICAgICAgICAgICAgICByZWZlcmVuY2VkU2NoZW1hSWQgPSBwYXJ0c1swXSxcbiAgICAgICAgICAgICAgICAgICAgcmVmZXJlbmNlZEZyYWdtZW50ID0gcGFydHMubGVuZ3RoID4gMSA/IHBhcnRzWzFdIDogJycsXG4gICAgICAgICAgICAgICAgICAgIHJlZmVyZW5jZWRTY2hlbWE7XG4gICAgICAgICAgICAgICAgaWYgKHJlZmVyZW5jZWRTY2hlbWFJZCA9PT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVmZXJlbmNlZFNjaGVtYSA9IHJvb3RTY2hlbWE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZldGNoZWRTY2hlbWEgPSB0aGlzLl9nZXQocmVmZXJlbmNlZFNjaGVtYUlkKTtcbiAgICAgICAgICAgICAgICAgICAgcmVmZXJlbmNlZFNjaGVtYSA9IHRoaXMuX3BhcnNlKGZldGNoZWRTY2hlbWEsIGZldGNoZWRTY2hlbWEpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciB0b1JldHVybiA9IHJlZmVyZW5jZWRGcmFnbWVudC5sZW5ndGggPiAwID8gbmV3IEpTT05Qb2ludGVyKHJlZmVyZW5jZWRTY2hlbWEpLmdldChyZWZlcmVuY2VkRnJhZ21lbnQpIDogcmVmZXJlbmNlZFNjaGVtYTtcbiAgICAgICAgICAgICAgICAvLyBFbnN1cmUgcmVmZXJlbmNlZCBmcmFnbWVudCBoYXMgYW4gaWRcbiAgICAgICAgICAgICAgICBpZiAodG9SZXR1cm4gJiYgKHRvUmV0dXJuLmlkID09PSB1bmRlZigpIHx8IHRvUmV0dXJuLmlkID09PSBudWxsKSkge1xuICAgICAgICAgICAgICAgICAgICB0b1JldHVybi5pZCA9IHJlZmVyZW5jZS5jaGFyQXQoMCkgPT09ICcjJyA/IHJlZmVyZW5jZWRTY2hlbWEuaWQgKyByZWZlcmVuY2UgOiByZWZlcmVuY2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0b1JldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgIC8vIFByb2Nlc3MgY2hpbGQgcHJvcGVydGllcyBmaXJzdCBzbyB0aGF0IG9iamVjdCBncmFwaCBjb21wbGV0ZXNcbiAgICAgICAgICAgIC8vIGxlYWYgbm9kZXMgZmlyc3RcbiAgICAgICAgICAgIHZhciBwcm9wZXJ0aWVzID0gc2NoZW1hLnByb3BlcnRpZXM7XG4gICAgICAgICAgICB2YXIgcHJvcGVydHk7XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcykge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5ID0gcHJvcGVydGllc1trZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1trZXldID0gdGhpcy5fcGFyc2UocHJvcGVydHksIHJvb3RTY2hlbWEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgLy8gVE9ETzogXCJub3RcIiBiZWxvdyBpcyBhIHN0cmFuZ2Ugb25lIGFuZCBuZWVkcyB0aGlua2luZyB0aHJvdWdoXG4gICAgICAgICAgICBbJ2l0ZW1zJywgJ2FueU9mJywgJ2FsbE9mJywgJ25vdCddLmZvckVhY2goZnVuY3Rpb24gKHByb3BlcnR5TmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBpdGVtcyA9IHNjaGVtYVtwcm9wZXJ0eU5hbWVdO1xuICAgICAgICAgICAgICAgIGlmIChpdGVtcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbXMgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBpdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWFbcHJvcGVydHlOYW1lXVtpXSA9IHRoaXMuX3BhcnNlKGl0ZW1zW2ldLCByb290U2NoZW1hKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjaGVtYVtwcm9wZXJ0eU5hbWVdID0gdGhpcy5fcGFyc2UoaXRlbXMsIHJvb3RTY2hlbWEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAgIHZhciBleHRlbnNpb25zID0gc2NoZW1hWydleHRlbmRzJ107XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9ucykge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSB0aGUgZXh0ZW5kcyBhdHRyaWJ1dGUgYXMgd2UgYXJlIGdvaW5nIHRvIHBlcmZvcm0gdGhlIGV4dGVuc2lvbiBiZWxvd1xuICAgICAgICAgICAgICAgIHNjaGVtYVsnZXh0ZW5kcyddID0gdW5kZWYoKTtcblxuICAgICAgICAgICAgICAgIChleHRlbnNpb25zIGluc3RhbmNlb2YgQXJyYXkgPyBleHRlbnNpb25zIDogW2V4dGVuc2lvbnNdKS5mb3JFYWNoKGZ1bmN0aW9uIChleHRlbnNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGV4cGFuZGVkRXh0ZW5zaW9uID0gdGhpcy5fcGFyc2UoZXh0ZW5zaW9uLCByb290U2NoZW1hKTtcbiAgICAgICAgICAgICAgICAgICAgZXh0ZW5kU2NoZW1hKHNjaGVtYSwgZXhwYW5kZWRFeHRlbnNpb24pO1xuICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc2NoZW1hO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdGVzIGEgU2NoZW1hTW9kZWwgZnJvbSB0aGUgcHJvdmlkZWQgU2NoZW1hXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdH0gc2NoZW1hICAgIFByb3ZpZGUgdGhlIHNjaGVtYSB3aXRoIHdoaWNoIHRvIGJ1aWxkIHRoZSBtb2RlbFxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBvcHRpb25zICAgUHJvdmlkZSBhbnkgb3B0aW9uc1xuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBiYXNlTW9kZWwgUHJvdmlkZSBhIGJhc2UgbW9kZWwgdXNlZCB0byBvdmVycmlkZSB0aGUgZGVmYXVsdFxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICBSZXR1cm4gYSBTY2hlbWEgTW9kZWxcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9jcmVhdGVNb2RlbDogZnVuY3Rpb24gX2NyZWF0ZU1vZGVsKHNjaGVtYSwgb3B0aW9ucywgYmFzZU1vZGVsKSB7XG5cbiAgICAgICAgICAgIHZhciBzY2hlbWFJZCA9IHNjaGVtYS5pZDtcblxuICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byByZS11c2UgcHJldmlvdXNseSBjb25zdHJ1Y3RlZCBtb2RlbHNcbiAgICAgICAgICAgIGlmIChzY2hlbWFJZCAmJiB0aGlzLnR5cGVDYWNoZVtzY2hlbWFJZF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50eXBlQ2FjaGVbc2NoZW1hSWRdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBtZWFuaW5nZnVsIG5hbWUgZm9yIHRoZSBtb2RlIHVzaW5nIHRoZSBzY2hlbWEudGl0bGUgKHdoaXRlc3BhY2UgcmVtb3ZlZClcbiAgICAgICAgICAgIHZhciBtb2RlbE5hbWUgPSBzY2hlbWEudGl0bGUgPyBzY2hlbWEudGl0bGUucmVwbGFjZSgvW15cXHddL2dpLCAnJykgOiAnVW5rbm93bic7XG4gICAgICAgICAgICAvLyBBZGQgU2NoZW1hTW9kZWwgb24gdGhlIGVuZCB0byBjcmVhdGUgXCJ7VGl0bGV9U2NoZW1hTW9kZWxcIlxuICAgICAgICAgICAgdmFyIHR5cGVMYWJlbCA9IG1vZGVsTmFtZSArICdTY2hlbWFNb2RlbCc7XG5cbiAgICAgICAgICAgIGxvZygnQ3JlYXRlIEN1c3RvbSBTY2hlbWEgTW9kZWwgVHlwZTogJyArIHR5cGVMYWJlbCk7XG5cbiAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgYmFzZSBtb2RlbCBzdGFydGluZyB3aXRoIHRoZSBiYXNlTW9kZWwgcGFzc2VkIGluIGFib3ZlLFxuICAgICAgICAgICAgLy8gbmV4dCB0cnkgdGhlIGEgbW9kZWwgcmVnc2l0ZXJlZCBhZ2FpbnN0IHRoZSBzY2hlbWFJZCBhbmRcbiAgICAgICAgICAgIC8vIGxhc3RseSB0cnkgdGhlIFNjaGVtYUZhY3RvcnkgZGVmYXVsdCBiYXNlTW9kZWxcbiAgICAgICAgICAgIHZhciBCYXNlTW9kZWwgPSBiYXNlTW9kZWwgfHwgc2NoZW1hSWQgJiYgdGhpcy5yZWdpc3RlcmVkU2NoZW1hVHlwZXNbc2NoZW1hSWRdIHx8IHRoaXMuYmFzZU1vZGVsO1xuICAgICAgICAgICAgLy8gRW5zdXJlIHRoZSBiYXNlIG1vZGVsIGlzIG9mIHR5cGUgXCJTY2hlbWFNb2RlbFwiXG4gICAgICAgICAgICBpZiAoIUJhc2VNb2RlbC5pc1NjaGVtYU1vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXNlIG1vZGVsIGZvciBzY2hlbWEgJyArIHNjaGVtYUlkICsgJyBpcyBub3QgYSBTY2hlbWFNb2RlbCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBFdmFsIHRoZSBjb25zdHJ1Y3RvciBjb2RlIGFzIHdlIHdhbnQgdG8gaW5qZWN0IHRoZSB0eXBlTGFiZWwgd2hpY2ggd2lsbCBhbGxvdyBtb2RlbHNcbiAgICAgICAgICAgIC8vIGNyZWF0ZWQgd2l0aCB0aGlzIHR5cGUgdG8gaGF2ZSBtZWFuaW5nZnVsIG5hbWVzIHdoZW4gZGVidWdnaW5nXG4gICAgICAgICAgICAvLyBDb25zdHJ1Y3QgdGhlIG5ldyBtb2RlbFxuICAgICAgICAgICAgdmFyIG1vZGVsID0gQmFzZU1vZGVsLmV4dGVuZCh7XG4gICAgICAgICAgICAgICAgY29uc3RydWN0b3I6IGZ1bmN0aW9uIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRvUmV0dXJuID0gQmFzZU1vZGVsLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodG9SZXR1cm4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0b1JldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMgfHwgb3B0aW9ucy52YWxpZGF0aW9uICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52YWxpZGF0aW9uID0gbmV3IFZhbGlkYXRpb25Nb2RlbCh0aGlzLnNjaGVtYS5wcm9wZXJ0aWVzID8gT2JqZWN0LmtleXModGhpcy5zY2hlbWEucHJvcGVydGllcykgOiBbJ3ZhbHVlJ10pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmYWN0b3J5OiB0aGlzLFxuICAgICAgICAgICAgICAgIC8vIFNhdmUgYSByZWZlcmVuY2UgdG8gdGhpcyBmYWN0b3J5IGZvciBmdXR1cmUgdXNlXG4gICAgICAgICAgICAgICAgc2NoZW1hOiBzY2hlbWEsXG4gICAgICAgICAgICAgICAgdHlwZUxhYmVsOiB0eXBlTGFiZWxcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAvLyBNYWtlIHRoZSBzY2hlbWEgYW5kIHR5cGVMYWJlbCBhbHNvIGF2YWlsYWJsZSBhcyBzdGF0aWMgcHJvcGVydGllcyBvZiB0aGUgdHlwZVxuICAgICAgICAgICAgICAgIHNjaGVtYTogc2NoZW1hLFxuICAgICAgICAgICAgICAgIHR5cGVMYWJlbDogdHlwZUxhYmVsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gT25seSBjYWNoZSB0aGUgcmVzdWx0aW5nIG1vZGVsIGlmIGEgd2UgaGF2ZSBhIHNjaGVtYSBpZC5cbiAgICAgICAgICAgIGlmIChzY2hlbWFJZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudHlwZUNhY2hlW3NjaGVtYUlkXSA9IG1vZGVsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgZGVmYXVsdHMgPSB7fSxcbiAgICAgICAgICAgICAgICBzY2hlbWFSZWxhdGlvbnMgPSB7fSxcbiAgICAgICAgICAgICAgICBrZXksXG4gICAgICAgICAgICAgICAgcHJvcGVydHk7XG5cbiAgICAgICAgICAgIC8vIFVzaW5nIHRoZSBzY2hlbWEucHJvcGVydGllcyBkZWZpbml0aW9ucyBkZXRlcm1pbmUgaWYgdGhlcmVcbiAgICAgICAgICAgIC8vIGFyZSBhbnkgcmVsYXRpb25zIGFuZCBpZiBzbyBjcmVhdGUgY29ycmVzcG9uZGluZyBtb2RlbHMgb3IgY29sbGVjdGlvbnNcbiAgICAgICAgICAgIGlmIChzY2hlbWEucHJvcGVydGllcykge1xuXG4gICAgICAgICAgICAgICAgZm9yIChrZXkgaW4gc2NoZW1hLnByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjaGVtYS5wcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5ID0gc2NoZW1hLnByb3BlcnRpZXNba2V5XTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBhbnkgZGVmYXVsdCB2YWx1ZXMgZnJvbSBzY2hlbWEgYW5kIGFzc2lnbiB0byBtb2RlbCdzIGRlZmF1bHQgb2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBBcnJheSBhY2Nlc3MgaXMgcmVxdWlyZWQgYXMgJ2RlZmF1bHQnIGlzIGEgcmVzZXJ2ZWQgd29yZC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eVsnZGVmYXVsdCddICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdHNba2V5XSA9IHByb3BlcnR5WydkZWZhdWx0J107XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9ubHkgdHlwZXMgXCJvYmplY3RcIiBhbmQgXCJhcnJheVwiIG1hcCB0byByZWxhdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAocHJvcGVydHkudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvdW5kIGEgSGFzT25lIHJlbGF0aW9uLCBzbyBjcmVhdGUgYSBjb3JyZXNwb25kaW5nIG1vZGVsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjaGVtYVJlbGF0aW9uc1trZXldID0gdGhpcy5fY3JlYXRlTW9kZWwocHJvcGVydHksIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdhcnJheSc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvdW5kIGEgSGFzTWFueSByZWxhdGlvbiwgc28gY3JlYXRlIGEgY29ycmVzcG9uZGluZyBjb2xsZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjaGVtYVJlbGF0aW9uc1trZXldID0gdGhpcy5fY3JlYXRlQ29sbGVjdGlvbihwcm9wZXJ0eSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBc3NpZ24gdGhlIHJlc3VsdGluZyBkZWZhdWx0IGFuZCByZWxhdGlvbnMgdG8gdGhlIG1vZGVsJ3MgcHJvdG90eXBlXG4gICAgICAgICAgICBtb2RlbC5wcm90b3R5cGUuZGVmYXVsdHMgPSBkZWZhdWx0cztcbiAgICAgICAgICAgIG1vZGVsLnByb3RvdHlwZS5zY2hlbWFSZWxhdGlvbnMgPSBzY2hlbWFSZWxhdGlvbnM7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3JlYXRlcyBhIFNjaGVtYUNvbGxlY3Rpb24gZnJvbSB0aGUgcHJvdmlkZWQgU2NoZW1hXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdH0gc2NoZW1hICAgIFByb3ZpZGUgdGhlIHNjaGVtYSB3aXRoIHdoaWNoIHRvIGJ1aWxkIHRoZSBtb2RlbFxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBvcHRpb25zICAgUHJvdmlkZSBhbnkgb3B0aW9uc1xuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBiYXNlQ29sbGVjdGlvbiBQcm92aWRlIGEgYmFzZSBjb2xsZWN0aW9uIHVzZWQgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHRcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgUmV0dXJuIGEgU2NoZW1hIENvbGxlY3Rpb25cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9jcmVhdGVDb2xsZWN0aW9uOiBmdW5jdGlvbiBfY3JlYXRlQ29sbGVjdGlvbihzY2hlbWEsIG9wdGlvbnMsIGJhc2VDb2xsZWN0aW9uKSB7XG5cbiAgICAgICAgICAgIHZhciBzY2hlbWFJZCA9IHNjaGVtYS5pZDtcblxuICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byByZS11c2UgcHJldmlvdXNseSBjb25zdHJ1Y3RlZCBjb2xsZWN0aW9uc1xuICAgICAgICAgICAgaWYgKHNjaGVtYUlkICYmIHRoaXMudHlwZUNhY2hlW3NjaGVtYUlkXSAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnR5cGVDYWNoZVtzY2hlbWFJZF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIG1lYW5pbmdmdWwgbmFtZSBmb3IgdGhlIG1vZGUgdXNpbmcgdGhlIHNjaGVtYS50aXRsZSAod2hpdGVzcGFjZSByZW1vdmVkKVxuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gc2NoZW1hLnRpdGxlID8gc2NoZW1hLnRpdGxlLnJlcGxhY2UoL1teXFx3XS9naSwgJycpIDogJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgIGl0ZW1zID0gc2NoZW1hLml0ZW1zLFxuICAgICAgICAgICAgICAgIG1vZGVsLFxuICAgICAgICAgICAgICAgIHR5cGVMYWJlbCxcbiAgICAgICAgICAgICAgICBCYXNlQ29sbGVjdGlvbjtcblxuICAgICAgICAgICAgLy8gRGVwZW5kaW5nIG9uIHRoZSBpdGVtcy50eXBlIHdlIG5lZWQgdG8gY3JlYXRlIGEgZGlmZmVyZW50IGJhc2UgY29sbGVjdGlvblxuICAgICAgICAgICAgc3dpdGNoIChpdGVtcy50eXBlKSB7XG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbW9kZWwgYmFzZWQgY29sbGVjdGlvbiBmb3Igb2JqZWN0IHR5cGVzXG4gICAgICAgICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIHRoZSBtb2RlbCB0eXBlIGZyb20gdGhlIGl0ZW1zIHByb3BlcnRpZXNcbiAgICAgICAgICAgICAgICAgICAgbW9kZWwgPSB0aGlzLl9jcmVhdGVNb2RlbChpdGVtcywgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIC8vIFN0cmlwIHRoZSB3b3JkIFwiTW9kZWxcIiAoNSBsZXR0ZXJzKSBmcm9tIHRoZSBlbmQgb2YgdGhlIG1vZGVsJ3Mgc2NoZW1hTW9kZWxUeXBlXG4gICAgICAgICAgICAgICAgICAgIHR5cGVMYWJlbCA9IChzY2hlbWEudGl0bGUgPyBjb2xsZWN0aW9uTmFtZSA6IG1vZGVsLnR5cGVMYWJlbC5zbGljZSgwLCAtNSkpICsgJ0NvbGxlY3Rpb24nO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgYmFzZSBjb2xsZWN0aW9uIHN0YXJ0aW5nIHdpdGggdGhlIGJhc2VDb2xsZWN0aW9uIHBhc3NlZCBpbiBhYm92ZSxcbiAgICAgICAgICAgICAgICAgICAgLy8gbmV4dCB0cnkgdGhlIGEgY29sbGVjdGlvbiByZWdzaXRlcmVkIGFnYWluc3QgdGhlIHNjaGVtYUlkIGFuZFxuICAgICAgICAgICAgICAgICAgICAvLyBsYXN0bHkgdHJ5IHRoZSBTY2hlbWFGYWN0b3J5IGRlZmF1bHQgYmFzZUNvbGxlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgQmFzZUNvbGxlY3Rpb24gPSBiYXNlQ29sbGVjdGlvbiB8fCB0aGlzLnJlZ2lzdGVyZWRTY2hlbWFUeXBlc1tzY2hlbWFJZF0gfHwgdGhpcy5iYXNlQ29sbGVjdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgLy8gRW5zdXJlIHRoZSBiYXNlIGNvbGxlY3Rpb24gaXMgb2YgdHlwZSBcIlNjaGVtYUNvbGxlY3Rpb25cIlxuICAgICAgICAgICAgICAgICAgICBpZiAoIUJhc2VDb2xsZWN0aW9uLmlzU2NoZW1hQ29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXNlIGNvbGxlY3Rpb24gZm9yIHNjaGVtYSAnICsgc2NoZW1hSWQgKyAnIGlzIG5vdCBhIFNjaGVtYUNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBhIHZhbHVlIGJhc2VkIGNvbGxlY3Rpb24gZm9yIHZhbHVlIHR5cGVzXG4gICAgICAgICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2ludGVnZXInOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICAgICAgICAgICAgICB0eXBlTGFiZWwgPSAoc2NoZW1hLnRpdGxlID8gY29sbGVjdGlvbk5hbWUgOiBpdGVtcy50eXBlLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgaXRlbXMudHlwZS5zbGljZSgxKSkgKyAnQ29sbGVjdGlvbic7XG4gICAgICAgICAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgYmFzZSBjb2xsZWN0aW9uIHN0YXJ0aW5nIHdpdGggdGhlIGNvbGxlY3Rpb24gcmVnc2l0ZXJlZCBhZ2FpbnN0IHRoZSBzY2hlbWFJZCBhbmRcbiAgICAgICAgICAgICAgICAgICAgLy8gbGFzdGx5IHRyeSB0aGUgU2NoZW1hRmFjdG9yeSBkZWZhdWx0IGJhc2VWYWx1ZUNvbGxlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgQmFzZUNvbGxlY3Rpb24gPSB0aGlzLnJlZ2lzdGVyZWRTY2hlbWFUeXBlc1tzY2hlbWFJZF0gfHwgdGhpcy5iYXNlVmFsdWVDb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgICAgICAvLyBFbnN1cmUgdGhlIGJhc2UgY29sbGVjdGlvbiBpcyBvZiB0eXBlIFwiU2NoZW1hVmFsdWVDb2xsZWN0aW9uXCJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFCYXNlQ29sbGVjdGlvbi5pc1NjaGVtYVZhbHVlQ29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXNlIGNvbGxlY3Rpb24gZm9yIHNjaGVtYSAnICsgc2NoZW1hSWQgKyAnIGlzIG5vdCBhIFNjaGVtYVZhbHVlQ29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgLy8gVGhlc2UgdHlwZXMgYXJlIG5vdCBjdXJyZW50bHkgc3VwcG9ydGVkXG4gICAgICAgICAgICAgICAgY2FzZSAnYXJyYXknOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2FueSc6XG4gICAgICAgICAgICAgICAgY2FzZSAnbnVsbCc6XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0IGl0ZW1zIHR5cGU6JyArIGl0ZW1zLnR5cGUpO1xuXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGl0ZW1zIHR5cGU6ICcgKyBpdGVtcy50eXBlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nKCdDcmVhdGUgQ3VzdG9tIFNjaGVtYSBDb2xsZWN0aW9uIFR5cGU6ICcgKyB0eXBlTGFiZWwpO1xuXG4gICAgICAgICAgICAvLyBDb25zdHJ1Y3QgdGhlIG5ldyBjb2xsZWN0aW9uXG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IEJhc2VDb2xsZWN0aW9uLmV4dGVuZCh7XG4gICAgICAgICAgICAgICAgY29uc3RydWN0b3I6IGZ1bmN0aW9uIGNvbnN0cnVjdG9yKG1vZGVscywgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdG9SZXR1cm4gPSBCYXNlQ29sbGVjdGlvbi5wcm90b3R5cGUuY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvUmV0dXJuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdG9SZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zIHx8IG9wdGlvbnMudmFsaWRhdGlvbiAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmFsaWRhdGlvbiA9IG5ldyBWYWxpZGF0aW9uRXJyb3JzQ29sbGVjdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBtb2RlbDogbW9kZWwsXG4gICAgICAgICAgICAgICAgc2NoZW1hOiBzY2hlbWEsXG4gICAgICAgICAgICAgICAgZmFjdG9yeTogdGhpcyxcbiAgICAgICAgICAgICAgICAvLyBTYXZlIGEgcmVmZXJlbmNlIHRvIHRoaXMgZmFjdG9yeSBmb3IgZnV0dXJlIHVzZVxuICAgICAgICAgICAgICAgIHR5cGVMYWJlbDogdHlwZUxhYmVsLFxuICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IHVuZGVmKCksXG4gICAgICAgICAgICAgICAgaW5pdFZhbGlkYXRpb246IGZ1bmN0aW9uIGluaXRWYWxpZGF0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnZhbGlkYXRlICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52YWxpZGF0aW9uID0gbmV3IFZhbGlkYXRpb25FcnJvcnNDb2xsZWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG5ld01vZGVsOiBmdW5jdGlvbiBuZXdNb2RlbChhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnNjaGVtYSA9IG9wdGlvbnMuc2NoZW1hIHx8IHRoaXMuc2NoZW1hLml0ZW1zO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IHRoaXMubW9kZWwoYXR0cmlidXRlcywgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBhZGROZXdNb2RlbDogZnVuY3Rpb24gYWRkTmV3TW9kZWwoYXR0cmlidXRlcywgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLm5ld01vZGVsKGF0dHJpYnV0ZXMsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZChtb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtb2RlbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgLy8gTWFrZSB0aGUgc2NoZW1hIGFuZCB0eXBlTGFiZWwgYWxzbyBhdmFpbGFibGUgYXMgc3RhdGljIHByb3BlcnRpZXMgb2YgdGhlIHR5cGVcbiAgICAgICAgICAgICAgICBzY2hlbWE6IHNjaGVtYSxcbiAgICAgICAgICAgICAgICB0eXBlTGFiZWw6IHR5cGVMYWJlbFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIE9ubHkgY2FjaGUgdGhlIHJlc3VsdGluZyBjb2xsZWN0aW9uIGlmIGEgd2UgaGF2ZSBhIHNjaGVtYSBpZC5cbiAgICAgICAgICAgIGlmIChzY2hlbWFJZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudHlwZUNhY2hlW3NjaGVtYUlkXSA9IGNvbGxlY3Rpb247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb2xsZWN0aW9uO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEV4b3NrZWxlc3N0b24uU2NoZW1hLk1vZGVsIHByb3ZpZGVzIGEgc2NoZW1hIGF3YXJlIEV4b3NrZWxlc3N0b24uTW9kZWxcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAZXh0ZW5kcyBFeG9za2VsZXNzdG9uLk1vZGVsXG4gICAgICovXG4gICAgdmFyIFNjaGVtYU1vZGVsID0gU2NoZW1hLk1vZGVsID0gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLk1vZGVsLmV4dGVuZCh7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEpTT04gU2NoZW1hIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vZGVsXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBzY2hlbWE6IHt9LFxuXG4gICAgICAgIC8vIEVhY2ggdGltZSB0aGUgTW9kZWwgaXMgZXh0ZW5kZWQgaXQgd2lsbCByZWNlaXZlIGEgbmV3XG4gICAgICAgIC8vIHVuaXF1ZVR5cGVJZCB3aGljaCBjYW4gbGF0ZXIgYmUgdXNlZCB0byBkaWZmZXJlbnRpYXRlIHR5cGVzXG4gICAgICAgIHVuaXF1ZVR5cGVJZDogX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLnV0aWxzLnVuaXF1ZUlkKCksXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnN0cnVjdG9yIGZ1bmN0aW9uIGlzIHVzZWQgdG8gcHJvdmlkZSBuYW1lZCBvYmplY3RzIGR1cmluZyBkZWJ1Z2dpbmdcbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yOiBmdW5jdGlvbiBTY2hlbWFNb2RlbChhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG5cbiAgICAgICAgICAgIC8vIElkZW50aXR5TWFwIHVzaW5nIFNjaGVtYUlkXG4gICAgICAgICAgICAvLyBUT0RPOiAoTU1JKSBCaW5kIHRvIGRpc3Bvc2UgZXZlbnQgaW4gb3JkZXIgdG8gcmVtb3ZlIHRoZSBpbnN0YW5jZSBmcm9tXG4gICAgICAgICAgICAvLyB0aGUgY2FjaGUgdG8gYXZvaWQgYSBtZW1vcnkgbGVha1xuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZXMgJiYgYXR0cmlidXRlc1t0aGlzLmlkQXR0cmlidXRlXSkge1xuICAgICAgICAgICAgICAgIHZhciBzY2hlbWFJZCA9IHRoaXMuc2NoZW1hID8gdGhpcy5zY2hlbWEuaWQgOiB1bmRlZigpO1xuICAgICAgICAgICAgICAgIGlmIChzY2hlbWFJZCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVLZXkgPSBhdHRyaWJ1dGVzW3RoaXMuaWRBdHRyaWJ1dGVdICsgJ3wnICsgc2NoZW1hSWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zID09PSB1bmRlZigpIHx8IG9wdGlvbnMuaWRlbnRpdHlNYXAgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVkTW9kZWwgPSB0aGlzLmZhY3RvcnkuaW5zdGFuY2VDYWNoZVtjYWNoZUtleV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FjaGVkTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FjaGVkTW9kZWw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mYWN0b3J5Lmluc3RhbmNlQ2FjaGVbY2FjaGVLZXldID0gdGhpcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Nb2RlbC5wcm90b3R5cGUuY29uc3RydWN0b3IuY2FsbCh0aGlzLCBhdHRyaWJ1dGVzLCBvcHRpb25zKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGV0ZXJtaW5lcyB0aGUgc2VydmVyIHNpZGUgdXJsIHByb3ZpZGVkIHZpYSBzY2hlbWEgbGlua3Mgd2hlcmUgbW9kZWwgZGF0YSBjYW4gYmUgbG9jYXRlZFxuICAgICAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IFJldHVybnMgYW4gQVBJIGVuZHBvaW50IFVSTFxuICAgICAgICAgKi9cbiAgICAgICAgdXJsOiBmdW5jdGlvbiB1cmwoKSB7XG4gICAgICAgICAgICB2YXIgc2NoZW1hID0gdGhpcy5zY2hlbWE7XG4gICAgICAgICAgICBpZiAoc2NoZW1hICE9PSB1bmRlZigpICYmIHNjaGVtYS5saW5rcyAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIHZhciB1cmw7XG4gICAgICAgICAgICAgICAgdmFyIGxpbms7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIHNjaGVtYS5saW5rcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2NoZW1hLmxpbmtzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmsgPSBzY2hlbWEubGlua3Nba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaW5rLnJlbCAhPT0gdW5kZWYoKSAmJiBsaW5rLnJlbCA9PT0gJ3NlbGYnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsID0gbGluay5ocmVmO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHVybCAhPT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyByZXBsYWNlIHRoZSB1cmwgcHJvcGVydHkgb24gdGhpcyBtZXRob2Qgc28gdGhhdCBmdXR1cmUgY2FsbHNcbiAgICAgICAgICAgICAgICAgICAgLy8gZG9uJ3QgbmVlZCB0byByZS1wcm9jZXNzXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnVybCA9IHVybC5yZXBsYWNlKC9cXHtpZFxcfS8sIGVuY29kZVVSSUNvbXBvbmVudCh0aGlzLmlkKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Nb2RlbC5wcm90b3R5cGUudXJsLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE92ZXJyaWRlcyB0aGUgZGVmYXVsdCBFeG9za2VsZXNzdG9uLk1vZGVsLmZldGNoIGJlaGF2aW91ciBhbmQgc2V0cyB0aGUgZGVmYXVsdCBvcHRpb25zLnBhcnNlPXRydWVcbiAgICAgICAgICogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kb2N1bWVudGNsb3VkL2JhY2tib25lL2lzc3Vlcy8xODQzIGZvciBtb3JlIGRldGFpbHNcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgUmV0dXJucyBhIHhociBvYmplY3QgZnJvbSB0aGUgZGVmYXVsdCBmZXRjaCBtZXRob2RcbiAgICAgICAgICovXG4gICAgICAgIGZldGNoOiBmdW5jdGlvbiBmZXRjaChvcHRpb25zKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnBhcnNlID09PSB2b2lkIDApIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnBhcnNlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uTW9kZWwucHJvdG90eXBlLmZldGNoLmNhbGwodGhpcywgb3B0aW9ucyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldHMgdGhlIHZhbHVlIG9mIGEgbW9kZWwgYXR0cmlidXRlXG4gICAgICAgICAqIEBwYXJhbSAge1N0cmluZ30ga2V5IFByb3ZpZGUgdGhlIGF0dHJpYnV0ZSBuYW1lXG4gICAgICAgICAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ8T2JqZWN0fSAgICAgUmV0dXJucyB0aGUgYXR0cmlidXRlIHZhbHVlXG4gICAgICAgICAqL1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldChrZXkpIHtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIG1vZGVsIGhhcyBhIHByb3BlcnR5IG9yIG1ldGhvZCBmb3IgdGhlIGtleVxuICAgICAgICAgICAgdmFyIHZhbHVlID0gdGhpc1trZXldO1xuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnZnVuY3Rpb24nID8gdmFsdWUoKSA6IHZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgdG9SZXR1cm4gPSBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uTW9kZWwucHJvdG90eXBlLmdldC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgICAgICAgICAvLyBMYXp5IEluaXRpYWxpc2F0aW9uIG9mIHJlbGF0aW9uc1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIHJldHVybiB2YWx1ZSBpcyBhbiB1bmluaXRpYWxpemVkIHJlbGF0aW9uXG4gICAgICAgICAgICBpZiAodG9SZXR1cm4gPT09IHVuZGVmKCkgfHwgdG9SZXR1cm4gPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB2YXIgUmVsYXRpb25UeXBlID0gdGhpcy5zY2hlbWFSZWxhdGlvbnNba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoUmVsYXRpb25UeXBlICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvUmV0dXJuID0gdGhpcy5hdHRyaWJ1dGVzW2tleV0gPSBuZXcgUmVsYXRpb25UeXBlKHVuZGVmKCksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpbGVudDogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0b1JldHVybjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0cyB0aGUgdmFsdWUgb2YgYW4gYXR0cmlidXRlXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgICAgIFRoZSBhdHRyaWJ1dGUgbmFtZVxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcnxTdHJpbmd8T2JqZWN0fSB2YWx1ZSAgIFRoZSBhdHRyaWJ1dGUgdmFsdWVcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBvcHRpb25zXG4gICAgICAgICAqL1xuICAgICAgICBzZXQ6IGZ1bmN0aW9uIHNldChrZXksIHZhbHVlLCBvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgYXR0cmlidXRlcztcbiAgICAgICAgICAgIGlmIChfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10udXRpbHMuaXNPYmplY3Qoa2V5KSB8fCBrZXkgPT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzID0ga2V5O1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSB2YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnZhbGlkYXRlID09PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy52YWxpZGF0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXR0cmlidXRlcyA9IHRoaXMuX3ByZXBhcmVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICByZXR1cm4gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLk1vZGVsLnByb3RvdHlwZS5zZXQuY2FsbCh0aGlzLCBhdHRyaWJ1dGVzLCBvcHRpb25zKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogSW50ZXJhdGVzIG92ZXIgdGhlIHByb3ZpZGVkIGF0dHJpYnV0ZXMgYW5kIGluaXRpYWxpemVzIGFueSByZWxhdGlvbnNcbiAgICAgICAgICogdG8gdGhlaXIgY29ycmVzcG9uZGluZyBtb2RlbCBvciBjb2xsZWN0aW9uLlxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGF0dHJpYnV0ZXMgQXR0cmlidXRlcyB0byBpbml0aWFsaXplXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdHM9fSBvcHRpb25zXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICBSZXR1cm5zIG5ldyBpbml0aWFsaXplZCBhdHRyaWJ1dGVzXG4gICAgICAgICAqL1xuICAgICAgICBfcHJlcGFyZUF0dHJpYnV0ZXM6IGZ1bmN0aW9uIF9wcmVwYXJlQXR0cmlidXRlcyhhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBJZiBhdHRyaWJ1dGVzIGFyZSBNb2RlbHMgb3IgQ29sbGVjdGlvbnMgY2hlY2sgdGhlIG1hdGNoIHRoZSBzY2hlbWFcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzICE9PSB1bmRlZigpICYmIHRoaXMuc2NoZW1hICE9PSB1bmRlZigpICYmIHRoaXMuc2NoZW1hUmVsYXRpb25zICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGF0dHJzID0ge30sXG4gICAgICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZTtcblxuICAgICAgICAgICAgICAgIGZvciAobmFtZSBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eSAhPT0gJ2Z1bmN0aW9uJyB8fCBhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIFJlbGF0aW9uID0gdGhpcy5zY2hlbWFSZWxhdGlvbnNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoUmVsYXRpb24gJiYgIShhdHRyaWJ1dGUgaW5zdGFuY2VvZiBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uTW9kZWwgfHwgYXR0cmlidXRlIGluc3RhbmNlb2YgX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLkNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXR0cnNbbmFtZV0gPSBuZXcgUmVsYXRpb24oYXR0cmlidXRlLCBPYmplY3QuYXNzaWduKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lsZW50OiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgb3B0aW9ucykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdHRyc1tuYW1lXSA9IGF0dHJpYnV0ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMgPSBhdHRycztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBhdHRyaWJ1dGVzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMb2NrIHVzZWQgdG8gc3RvcCBjaXJjdWxhciByZWZlcmVuY2VzIGZyb20gY2F1c2luZyBhIHN0YWNrIG92ZXJmbG93XG4gICAgICAgICAqIGR1cmluZyB0b0pTT04gc2VyaWFsaXp0aW9uXG4gICAgICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdG9KU09OSW5Qcm9ncmVzczogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZXMgYSBzZXJpYWxpemFibGUgbW9kZWxcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9ICBTZXJpYWxpemFibGUgbW9kZWxcbiAgICAgICAgICovXG4gICAgICAgIHRvSlNPTjogZnVuY3Rpb24gdG9KU09OKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnRvSlNPTkluUHJvZ3Jlc3MpIHtcbiAgICAgICAgICAgICAgICAvLyBUaGlzIG9ubHkgaGFwcGVucyB3aGVuIHRoZXJlIGlzIGEgY2lyY3VsYXIgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgLy8gYW5kIHRoZSBtb2RlbCBoYXMgYWxyZWFkeSBiZWVuIHNlcmlhbGl6ZWQgcHJldmlvdXNseVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmlkID8gdG9PYmplY3QodGhpcy5pZEF0dHJpYnV0ZSwgdGhpcy5pZCkgOiB1bmRlZigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnRvSlNPTkluUHJvZ3Jlc3MgPSB0cnVlO1xuXG4gICAgICAgICAgICB2YXIgdG9SZXR1cm4sIG5hbWUsIHByb3BlcnR5O1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NoZW1hKSB7XG4gICAgICAgICAgICAgICAgZm9yIChuYW1lIGluIHRoaXMuc2NoZW1hLnByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NoZW1hLnByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5ID0gdGhpcy5zY2hlbWEucHJvcGVydGllc1tuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhdHRyaWJ1dGUgPSB0aGlzLmF0dHJpYnV0ZXNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoW3VuZGVmKCksIG51bGxdLmluZGV4T2YoYXR0cmlidXRlKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NoZW1hUmVsYXRpb25zW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gYXR0cmlidXRlLnRvSlNPTihvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IGF0dHJpYnV0ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0b1JldHVybiA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9SZXR1cm4gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b1JldHVybltuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdG9SZXR1cm4gPSBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uTW9kZWwucHJvdG90eXBlLnRvSlNPTi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnRvSlNPTkluUHJvZ3Jlc3MgPSBmYWxzZTtcblxuICAgICAgICAgICAgcmV0dXJuIHRvUmV0dXJuO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBWYWxpZGF0ZXMgdGhlIG1vZGVsIGFnYWluc3QgdGhlIHNjaGVtYSByZXR1cm5pbmcgdHJ1ZSBpZiB2YWxpZFxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICBvcHRpb25zIFBhc3NlZCB0byB0aGUgdmFsaWRhdGUgbWV0aG9kXG4gICAgICAgICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICAgUmV0dXJucyB0cnVlIGlmIHZhbGlkLCBvdGhlcndpc2UgZmFsc2VcbiAgICAgICAgICovXG4gICAgICAgIGlzVmFsaWQ6IGZ1bmN0aW9uIGlzVmFsaWQob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsaWRhdGUodW5kZWYoKSwgb3B0aW9ucykgPT09IHVuZGVmKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX3ZhbGlkYXRlOiBmdW5jdGlvbiBfdmFsaWRhdGUoYXR0cmlidXRlcywgb3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIHRvUmV0dXJuID0gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLk1vZGVsLnByb3RvdHlwZS5fdmFsaWRhdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMudmFsaWRhdGUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdG9SZXR1cm47XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZhbGlkYXRlcyB0aGUgbW9kZWwgYWdhaW5zdCB0aGUgc2NoZW1hXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9ICBSZXR1cm5zIGFuIGFycmF5IG9mIGVycm9ycyBvciB1bmRlZigpXG4gICAgICAgICAqL1xuICAgICAgICB2YWxpZGF0ZTogZnVuY3Rpb24gdmFsaWRhdGUoYXR0cmlidXRlcywgb3B0aW9ucykge1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMudmFsaWRhdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgbm8gYXR0cmlidXRlcyBhcmUgc3VwcGxpZWQsIHRoZW4gdmFsaWRhdGUgYWxsIHNjaGVtYSBwcm9wZXJ0aWVzXG4gICAgICAgICAgICAvLyBieSBidWlsZGluZyBhbiBhdHRyaWJ1dGVzIGFycmF5IGNvbnRhaW5pbmcgYWxsIHByb3BlcnRpZXMuXG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlcyA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiB0aGlzLnNjaGVtYS5wcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYS5wcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuc2NoZW1hLnByb3BlcnRpZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHRoaXMuYXR0cmlidXRlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgX25hbWUgaW4gdGhpcy5hdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5hdHRyaWJ1dGVzLmhhc093blByb3BlcnR5ICE9PSAnZnVuY3Rpb24nIHx8IHRoaXMuYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShfbmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzW19uYW1lXSA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXNbX25hbWVdID0gdGhpcy5hdHRyaWJ1dGVzW19uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMudmFsaWRhdGlvbi5hdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLnZhbGlkYXRpb24uYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eSAhPT0gJ2Z1bmN0aW9uJyB8fCB0aGlzLnZhbGlkYXRpb24uYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhdHRyaWJ1dGUgPSB0aGlzLnZhbGlkYXRpb24uYXR0cmlidXRlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy52YWxpZGF0aW9uLmF0dHJpYnV0ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZS5kaXNwb3NlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGUuZGlzcG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG5cbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGxvZygnVmFsaWRhdGluZyBhdHRyaWJ1dGU6ICcgKyBrZXkpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXR0cmlidXRlRXJyb3JzID0gdGhpcy52YWxpZGF0ZUF0dHJpYnV0ZShrZXksIHZhbHVlLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZUVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbGlkYXRpb24uc2V0KGtleSwgbmV3IFZhbGlkYXRpb25FcnJvcnNDb2xsZWN0aW9uKGF0dHJpYnV0ZUVycm9ycykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2guYXBwbHkoZXJyb3JzLCBhdHRyaWJ1dGVFcnJvcnMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXR1cm4gbm90aGluZyBvbiBzdWNjZXNzXG4gICAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBsb2coJ1ZhbGlkYXRpb24gZmFpbGVkOiAnLCBlcnJvcnMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvcnM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZhbGlkYXRlIGFuIGluZGl2aWR1YWwgYXR0cmlidXRlXG4gICAgICAgICAqIEBwYXJhbSAge1N0cmluZ30ga2V5ICAgICBbZGVzY3JpcHRpb25dXG4gICAgICAgICAqIEBwYXJhbSAge051bWJlcnxTdHJpbmd8T2JqZWN0fSB2YWx1ZSAgIFRoZSB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlXG4gICAgICAgICAqIEBwYXJhbSAge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9ICAgICAgICAgUmV0dXJucyBhbiBhcnJheSBjb250YWluaW5nIGFueSB2YWxpZGF0aW9uIGVycm9yc1xuICAgICAgICAgKi9cbiAgICAgICAgdmFsaWRhdGVBdHRyaWJ1dGU6IGZ1bmN0aW9uIHZhbGlkYXRlQXR0cmlidXRlKGtleSwgdmFsdWUsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgICAgICAgICAvLyBJZiBhIHByb3BlcnR5IGlzIG5vdCBkZWZpbmVkIGluIHNjaGVtYSBhbmQgYWRkaXRpb25hbFByb3BlcnRpZXMgaXMgbm90IHNldCB0byBmYWxzZSwgdGhlbiBhbGxvdyBhbnl0aGluZy5cbiAgICAgICAgICAgIC8vIE5vdGU6IHdlIGRvbid0IGN1cnJlbnRseSBzdXBwb3J0IHNjaGVtYSBiYXNlZCBhZGRpdGlvbmFsUHJvcGVydGllcywgb25seSBib29sZWFuIHZhbHVlc1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NoZW1hLmFkZGl0aW9uYWxQcm9wZXJ0aWVzICE9PSBmYWxzZSAmJiAodGhpcy5zY2hlbWEucHJvcGVydGllcyA9PT0gdW5kZWYoKSB8fCB0aGlzLnNjaGVtYS5wcm9wZXJ0aWVzW2tleV0gPT09IHVuZGVmKCkpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc2NoZW1hUHJvcGVydHkgPSB0aGlzLnNjaGVtYS5wcm9wZXJ0aWVzW2tleV0sXG4gICAgICAgICAgICAgICAgZXJyb3JzID0gW107XG5cbiAgICAgICAgICAgIC8vIE9ubHkgdmFsaWRhdGUgU2NoZW1hIGF0dHJpYnV0ZXNcbiAgICAgICAgICAgIGlmIChzY2hlbWFQcm9wZXJ0eSA9PT0gdW5kZWYoKSkge1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NoZW1hLmFkZGl0aW9uYWxQcm9wZXJ0aWVzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICd0eXBlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHByb3BlcnR5KSBpcyBub3QgYWxsb3dlZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAncHJvcGVydHknOiBrZXlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvcnM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBzY2hlbWFUaXRsZSA9IHNjaGVtYVByb3BlcnR5LnRpdGxlIHx8IGtleTtcblxuICAgICAgICAgICAgLy8gSWYgYSBwcm9wZXJ0eSBpcyBub3QgcmVxdWlyZSBhbmQgaXMgdW5kZWYoKSB0aGVuIHZhbGlkYXRpb24gY2FuIGJlIHNraXBwZWRcbiAgICAgICAgICAgIHZhciByZXF1aXJlc1ZhbGlkYXRpb24gPSBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKHNjaGVtYVByb3BlcnR5LnJlcXVpcmVkID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHByb3BlcnR5IGlzIHJlcXVpcmVkLCBSdW4gYWxsIHZhbGlkYXRvcnNcbiAgICAgICAgICAgICAgICByZXF1aXJlc1ZhbGlkYXRpb24gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFWYWxpZGF0b3JzLnJlcXVpcmVkKHZhbHVlLCB0cnVlKSkge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICdyZXF1aXJlZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgaXMgYSByZXF1aXJlZCBmaWVsZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBvbmx5IHJ1biB2YWxpZGF0b3JzIGlmIGEgdmFsdWUgaGFzIGJlZW4gc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgcmVxdWlyZXNWYWxpZGF0aW9uID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2FsbCBpbnRvIGVhY2ggbmVjZXNzYXJ5IHZhbGlkYXRvclxuICAgICAgICAgICAgaWYgKHJlcXVpcmVzVmFsaWRhdGlvbikge1xuXG4gICAgICAgICAgICAgICAgdmFyIGlzU3RyaW5nID0gdHlwZW9mIHZhbHVlID09ICdzdHJpbmcnO1xuICAgICAgICAgICAgICAgIHZhciBpc051bWJlciA9ICFpc1N0cmluZyAmJiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcic7XG4gICAgICAgICAgICAgICAgdmFyIGlzSW50ZWdlciA9IGlzTnVtYmVyICYmIHZhbHVlICUgMSA9PT0gMDtcbiAgICAgICAgICAgICAgICB2YXIgaXNCb29sZWFuID0gIWlzU3RyaW5nICYmICFpc051bWJlciAmJiB0eXBlb2YgdmFsdWUgPT0gJ2Jvb2xlYW4nO1xuICAgICAgICAgICAgICAgIHZhciBpc1ZhbHVlID0gaXNTdHJpbmcgfHwgaXNOdW1iZXIgfHwgaXNCb29sZWFuO1xuICAgICAgICAgICAgICAgIHZhciBpc01vZGVsID0gIWlzVmFsdWUgJiYgaW5zdGFuY2VPZih2YWx1ZSwgU2NoZW1hTW9kZWwpO1xuICAgICAgICAgICAgICAgIHZhciBpc0NvbGxlY3Rpb24gPSAhaXNWYWx1ZSAmJiBpbnN0YW5jZU9mKHZhbHVlLCBTY2hlbWFDb2xsZWN0aW9uKTtcbiAgICAgICAgICAgICAgICB2YXIgaXNSZWxhdGlvbiA9IGlzTW9kZWwgfHwgaXNDb2xsZWN0aW9uO1xuICAgICAgICAgICAgICAgIHZhciBpc051bGwgPSB2YWx1ZSA9PT0gdW5kZWYoKSB8fCB2YWx1ZSA9PT0gbnVsbDtcblxuICAgICAgICAgICAgICAgIHZhciBzY2hlbWFUeXBlID0gc2NoZW1hUHJvcGVydHkudHlwZTtcblxuICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIHRoZSB0eXBlIG9mIGVhY2ggYXR0cmlidXRlXG4gICAgICAgICAgICAgICAgc3dpdGNoIChzY2hlbWFUeXBlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNNb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICd0eXBlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIHNob3VsZCBiZSBhIG1vZGVsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlICdhcnJheSc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzQ29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICd0eXBlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIHNob3VsZCBiZSBhIGNvbGxlY3Rpb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYVRpdGxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzU3RyaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVsZTogJ3R5cGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgc2hvdWxkIGJlIGEgc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc051bWJlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICd0eXBlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIHNob3VsZCBiZSBhIG51bWJlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzSW50ZWdlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICd0eXBlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIHNob3VsZCBiZSBhIGludGVnZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYVRpdGxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0Jvb2xlYW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAndHlwZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBzaG91bGQgYmUgYSBib29sZWFuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlICdudWxsJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOdWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVsZTogJ3R5cGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgc2hvdWxkIGJlIG51bGwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYVRpdGxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2FueSc6XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIFNjaGVtYSB0eXBlOiAnICsgc2NoZW1hVHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGlzUmVsYXRpb24pIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBPbmx5IHZhbGlkYXRlIHJlbGF0aW9ucyB3aGVuIG9wdGlvbnMuZGVlcCBpcyBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuZGVlcCA9PT0gdHJ1ZSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNNb2RlbCAmJiAhdmFsdWUuaXNWYWxpZChvcHRpb25zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICdyZWxhdGlvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBpcyBpbnZhbGlkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0NvbGxlY3Rpb24gJiYgIXZhbHVlLmlzVmFsaWQob3B0aW9ucykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAncmVsYXRpb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgaXMgaW52YWxpZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc1N0cmluZykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1heExlbmd0aCB2YWxpZGF0b3JcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjaGVtYVByb3BlcnR5Lm1heExlbmd0aCAhPSB1bmRlZigpICYmICFWYWxpZGF0b3JzLm1heExlbmd0aCh2YWx1ZSwgc2NoZW1hUHJvcGVydHkubWF4TGVuZ3RoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICdtYXhMZW5ndGgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBtYXkgbm90IGJlIGxvbmdlciB0aGFuICUobWF4TGVuZ3RoKScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYVRpdGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWF4TGVuZ3RoJzogc2NoZW1hUHJvcGVydHkubWF4TGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBtaW5MZW5ndGggdmFsaWRhdG9yXG4gICAgICAgICAgICAgICAgICAgIGlmIChzY2hlbWFQcm9wZXJ0eS5taW5MZW5ndGggIT0gdW5kZWYoKSAmJiAhVmFsaWRhdG9ycy5taW5MZW5ndGgodmFsdWUsIHNjaGVtYVByb3BlcnR5Lm1pbkxlbmd0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAnbWluTGVuZ3RoJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgbXVzdCBiZSBsb25nZXIgdGhhbiAlKG1pbkxlbmd0aCknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21pbkxlbmd0aCc6IHNjaGVtYVByb3BlcnR5Lm1pbkxlbmd0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZm9ybWF0IHZhbGlkYXRvclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2NoZW1hUHJvcGVydHkuZm9ybWF0ICE9IHVuZGVmKCkgJiYgIVZhbGlkYXRvcnMuZm9ybWF0KHZhbHVlLCBzY2hlbWFQcm9wZXJ0eS5mb3JtYXQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVsZTogJ2Zvcm1hdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIGRvZXMgbm90IG1hdGNoICUoZm9ybWF0KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYVRpdGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZm9ybWF0Jzogc2NoZW1hUHJvcGVydHkuZm9ybWF0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBwYXR0ZXJuIHZhbGlkYXRvclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2NoZW1hUHJvcGVydHkucGF0dGVybiAhPSB1bmRlZigpICYmICFWYWxpZGF0b3JzLnBhdHRlcm4odmFsdWUsIHNjaGVtYVByb3BlcnR5LnBhdHRlcm4pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVsZTogJ3BhdHRlcm4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICclKHRpdGxlKSBpcyBpbnZhbGlkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hVGl0bGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNOdW1iZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbWluaW11bSB2YWxpZGF0b3JcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjaGVtYVByb3BlcnR5Lm1pbmltdW0gIT0gdW5kZWYoKSAmJiAhVmFsaWRhdG9ycy5taW5pbXVtKHZhbHVlLCBzY2hlbWFQcm9wZXJ0eS5taW5pbXVtLCBzY2hlbWFQcm9wZXJ0eS5leGNsdXNpdmVNaW5pbXVtKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICdtaW5pbXVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgbWF5IG5vdCBiZSBsZXNzIHRoYW4gJShtaW5pbXVtKScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYVRpdGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbWluaW11bSc6IHNjaGVtYVByb3BlcnR5Lm1pbmltdW1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1heGltdW0gdmFsaWRhdG9yXG4gICAgICAgICAgICAgICAgICAgIGlmIChzY2hlbWFQcm9wZXJ0eS5tYXhpbXVtICE9IHVuZGVmKCkgJiYgIVZhbGlkYXRvcnMubWF4aW11bSh2YWx1ZSwgc2NoZW1hUHJvcGVydHkubWF4aW11bSwgc2NoZW1hUHJvcGVydHkuZXhjbHVzaXZlTWF4aW11bSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAnbWF4aW11bScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIG1heSBub3QgYmUgbGVzcyB0aGFuICUobWF4aW11bSknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21heGltdW0nOiBzY2hlbWFQcm9wZXJ0eS5tYXhpbXVtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBkaXZpc2libGVCeSB2YWxpZGF0b3JcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjaGVtYVByb3BlcnR5LmRpdmlzaWJsZUJ5ICE9IHVuZGVmKCkgJiYgIVZhbGlkYXRvcnMuZGl2aXNpYmxlQnkodmFsdWUsIHNjaGVtYVByb3BlcnR5LmRpdmlzaWJsZUJ5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGU6ICdkaXZpc2libGVCeScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIGlzIG5vdCBkaXZpc2libGUgYnkgJShkaXZpc2libGVCeSknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGl0bGUnOiBzY2hlbWFUaXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2RpdmlzaWJsZUJ5Jzogc2NoZW1hUHJvcGVydHkuZGl2aXNpYmxlQnlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGVycm9ycztcbiAgICAgICAgfSxcblxuICAgICAgICBpc0Rpc3Bvc2VkOiBmYWxzZSxcbiAgICAgICAgZGlzcG9zZTogZnVuY3Rpb24gZGlzcG9zZSgpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IEFkZCByZWZlcmVuY2UgY291bnQgZnVuY3Rpb25hbGl0eSB0byBhdm9pZCBzaXR1YXRpb25cbiAgICAgICAgICAgIC8vIHdoZXJlIG1vZGVsIGlzIHVzZWQgbXVsdGlwbGUgdGltZXNcbiAgICAgICAgICAgIC8qaWYoIXRoaXMuaXNEaXNwb3NlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuaXNEaXNwb3NlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gQ2FsbCBkaXNwb3NlIG9uIG5lc3RlZCBtb2RlbHMgYW5kIGNvbGxlY3Rpb25zXG4gICAgICAgICAgICAgICAgXy5lYWNoKHRoaXMuc2NoZW1hUmVsYXRpb25zLCBmdW5jdGlvbihyZWxhdGlvbiwgbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsID0gdGhpcy5hdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICBpZihyZWwgIT09IHVuZGVmKCkgJiYgcmVsLmRpc3Bvc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbC5kaXNwb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgICAgIH0qL1xuICAgICAgICB9XG4gICAgfSwge1xuICAgICAgICBpc1NjaGVtYU1vZGVsOiB0cnVlLFxuICAgICAgICB0eXBlTGFiZWw6ICdTY2hlbWFNb2RlbCdcbiAgICB9KTtcblxuICAgIFNjaGVtYU1vZGVsLmV4dGVuZCA9IGludGVybmFsRXh0ZW5kO1xuXG4gICAgLyoqXG4gICAgICogRXhvc2tlbGVzc3Rvbi5TY2hlbWEuQ29sbGVjdGlvbiBwcm92aWRlcyBhIHNjaGVtYSBhd2FyZSBFeG9za2VsZXNzdG9uLkNvbGxlY3Rpb25cbiAgICAgKiBAZXh0ZW5kcyBFeG9za2VsZXNzdG9uLkNvbGxlY3Rpb25cbiAgICAgKi9cbiAgICB2YXIgU2NoZW1hQ29sbGVjdGlvbiA9IFNjaGVtYS5Db2xsZWN0aW9uID0gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLkNvbGxlY3Rpb24uZXh0ZW5kKHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSlNPTiBTY2hlbWEgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW9kZWxcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHNjaGVtYToge30sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERlZmF1bHQgY29sbGVjdGlvbiBtb2RlbFxuICAgICAgICAgKiBAdHlwZSB7W3R5cGVdfVxuICAgICAgICAgKi9cbiAgICAgICAgbW9kZWw6IFNjaGVtYU1vZGVsLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSBjb250aWFuaW5nIGNvbGxlY3Rpb24gbW9kZWxzXG4gICAgICAgICAqIEB0eXBlIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIG1vZGVsczogdW5kZWYoKSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogTnVtYmVyIG9mIGl0ZW1zIGluIHRoZSBjb2xsZWN0aW9uXG4gICAgICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBsZW5ndGg6IDAsXG5cbiAgICAgICAgLy8gRWFjaCB0aW1lIHRoZSBDb2xsZWN0aW9uIGlzIGV4dGVuZGVkIGl0IHdpbGwgcmVjZWl2ZSBhIG5ld1xuICAgICAgICAvLyB1bmlxdWVUeXBlSWQgd2hpY2ggY2FuIGxhdGVyIGJlIHVzZWQgdG8gZGlmZmVyZW50aWF0ZSB0eXBlc1xuICAgICAgICB1bmlxdWVUeXBlSWQ6IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS51dGlscy51bmlxdWVJZCgpLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb25zdHJ1Y3RvciBmdW5jdGlvbiBpcyB1c2VkIHRvIHByb3ZpZGUgbmFtZWQgb2JqZWN0cyBkdXJpbmcgZGVidWdnaW5nXG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24gU2NoZW1hQ29sbGVjdGlvbihtb2RlbHMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Db2xsZWN0aW9uLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5jYWxsKHRoaXMsIG1vZGVscywgb3B0aW9ucyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZhbGlkYXRlcyB0aGUgQ29sbGVjdGlvbiBhZ2FpbnN0IHRoZSBzY2hlbWEgcmV0dXJuaW5nIHRydWUgaWYgdmFsaWRcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0fSAgb3B0aW9ucyBQYXNzZWQgdG8gdGhlIHZhbGlkYXRlIG1ldGhvZFxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgIFJldHVybnMgdHJ1ZSBpZiB2YWxpZCwgb3RoZXJ3aXNlIGZhbHNlXG4gICAgICAgICAqL1xuICAgICAgICBpc1ZhbGlkOiBmdW5jdGlvbiBpc1ZhbGlkKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbGlkYXRlKG9wdGlvbnMpID09PSB1bmRlZigpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGRzIG9uZSBvciBtb3JlIG1vZGVscyB0byB0aGUgY29sbGVjdGlvblxuICAgICAgICAgKiBAcGFyYW0ge1NjaGVtYU1vZGVsfGFycmF5fSBtb2RlbHMgIE1vZGVsIG9yIGFycmF5IG9mIE1vZGVsc1xuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICovXG4gICAgICAgIGFkZDogZnVuY3Rpb24gYWRkKG1vZGVscywgb3B0aW9ucykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5wYXJzZSkge1xuICAgICAgICAgICAgICAgIG1vZGVscyA9IHRoaXMucGFyc2UobW9kZWxzIGluc3RhbmNlb2YgQXJyYXkgPyBtb2RlbHMgOiBbbW9kZWxzXSwgb3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLkNvbGxlY3Rpb24ucHJvdG90eXBlLmFkZC5jYWxsKHRoaXMsIG1vZGVscywgb3B0aW9ucyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZXMgb25lIG9yIG1vcmUgbW9kZWxzIGZyb20gdGhlIGNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIHtTY2hlbWFNb2RlbHxhcnJheX0gbW9kZWxzICBNb2RlbCBvciBhcnJheSBvZiBNb2RlbHNcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBvcHRpb25zXG4gICAgICAgICAqL1xuICAgICAgICByZW1vdmU6IGZ1bmN0aW9uIHJlbW92ZShtb2RlbHMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMucGFyc2UpIHtcbiAgICAgICAgICAgICAgICBtb2RlbHMgPSB0aGlzLnBhcnNlKG1vZGVscyBpbnN0YW5jZW9mIEFycmF5ID8gbW9kZWxzIDogW21vZGVsc10sIG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Db2xsZWN0aW9uLnByb3RvdHlwZS5yZW1vdmUuY2FsbCh0aGlzLCBtb2RlbHMsIG9wdGlvbnMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNldHMgdGhlIGNvbGxlY3Rpb24gd2l0aCB0aGUgcHJvdmlkZWQgTW9kZWxzXG4gICAgICAgICAqIEBwYXJhbSB7U2NoZW1hTW9kZWx8YXJyYXl9IG1vZGVscyAgTW9kZWwgb3IgYXJyYXkgb2YgTW9kZWxzXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKi9cbiAgICAgICAgcmVzZXQ6IGZ1bmN0aW9uIHJlc2V0KG1vZGVscywgb3B0aW9ucykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5wYXJzZSkge1xuICAgICAgICAgICAgICAgIG1vZGVscyA9IHRoaXMucGFyc2UobW9kZWxzIGluc3RhbmNlb2YgQXJyYXkgPyBtb2RlbHMgOiBbbW9kZWxzXSwgb3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLkNvbGxlY3Rpb24ucHJvdG90eXBlLnJlc2V0LmNhbGwodGhpcywgbW9kZWxzLCBvcHRpb25zKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVmFsaWRhdGVzIHRoZSBjb2xsZWN0aW9uIGFnYWluc3QgdGhlIHNjaGVtYVxuICAgICAgICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBvcHRpb25zXG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fSAgUmV0dXJucyBhbiBhcnJheSBvZiBlcnJvcnMgb3IgdW5kZWYoKVxuICAgICAgICAgKi9cbiAgICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uIHZhbGlkYXRlKG9wdGlvbnMpIHtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnZhbGlkYXRpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBzY2hlbWEgPSB0aGlzLnNjaGVtYTtcbiAgICAgICAgICAgIHZhciBlcnJvcnMgPSBbXTtcblxuICAgICAgICAgICAgaWYgKHNjaGVtYS5taW5JdGVtcyAhPSB1bmRlZigpICYmICFWYWxpZGF0b3JzLm1pbkl0ZW1zKHRoaXMubW9kZWxzLCBzY2hlbWEubWluSXRlbXMpKSB7XG4gICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgcnVsZTogJ21pbkl0ZW1zJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ01pbmltdW0gb2YgJShjb3VudCkgJSh0aXRsZSkgcmVxdWlyZWQnLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYS50aXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdjb3VudCc6IHNjaGVtYS5taW5JdGVtc1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzY2hlbWEubWF4SXRlbXMgIT0gdW5kZWYoKSAmJiAhVmFsaWRhdG9ycy5tYXhJdGVtcyh0aGlzLm1vZGVscywgc2NoZW1hLm1heEl0ZW1zKSkge1xuICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgIHJ1bGU6ICdtYXhJdGVtcycsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdNYXhpbXVtIG9mICUoY291bnQpICUodGl0bGUpIGFsbG93ZWQnLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYS50aXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdjb3VudCc6IHNjaGVtYS5tYXhJdGVtc1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzY2hlbWEudW5pcXVlSXRlbXMgIT0gdW5kZWYoKSAmJiAhVmFsaWRhdG9ycy51bmlxdWVJdGVtcyh0aGlzLm1vZGVscywgZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZGVsLmNpZDtcbiAgICAgICAgICAgIH0pKSB7XG4gICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgcnVsZTogJ3VuaXF1ZUl0ZW1zJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ0R1cGxpY2F0ZSAlKHRpdGxlKSBhcmUgbm90IGFsbG93ZWQnLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICd0aXRsZSc6IHNjaGVtYS50aXRsZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZGVlcCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoLmFwcGx5KGVycm9ycywgdGhpcy5fdmFsaWRhdGVNb2RlbHMob3B0aW9ucykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnZhbGlkYXRpb24ucmVzZXQoZXJyb3JzKTtcblxuICAgICAgICAgICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9ycztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVmFsaWRhdGVzIHRoZSBjb2xsZWN0aW9ucyBtb2RlbHNcbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX0gIFJldHVybnMgYW4gZW1wdHkgYXJyYXkgb3IgYW4gYXJyYXkgb2YgZXJyb3JzXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfdmFsaWRhdGVNb2RlbHM6IGZ1bmN0aW9uIF92YWxpZGF0ZU1vZGVscyhvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG4gICAgICAgICAgICB2YXIgaGFzSW52YWxpZCA9IGZhbHNlO1xuICAgICAgICAgICAgdmFyIG1vZGVsO1xuICAgICAgICAgICAgdmFyIGtleTtcblxuICAgICAgICAgICAgZm9yIChrZXkgaW4gdGhpcy5tb2RlbHMpIHtcbiAgICAgICAgICAgICAgICBtb2RlbCA9IHRoaXMubW9kZWxzW2tleV07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubW9kZWxzLmhhc093blByb3BlcnR5KGtleSkgJiYgIW1vZGVsLmlzVmFsaWQob3B0aW9ucykpIHtcbiAgICAgICAgICAgICAgICAgICAgaGFzSW52YWxpZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGhhc0ludmFsaWQpIHtcbiAgICAgICAgICAgICAgICBlcnJvcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICBydWxlOiAncmVsYXRpb24nLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnJSh0aXRsZSkgaXMgaW52YWxpZCcsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogdGhpcy5zY2hlbWEudGl0bGVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMb2NrIHVzZWQgdG8gc3RvcCBjaXJjdWxhciByZWZlcmVuY2VzIGZyb20gY2F1c2luZyBhIHN0YWNrIG92ZXJmbG93XG4gICAgICAgICAqIGR1cmluZyB0b0pTT04gc2VyaWFsaXp0aW9uXG4gICAgICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdG9KU09OSW5Qcm9ncmVzczogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZXMgYSBzZXJpYWxpemFibGUgYXJyYXkgb2YgbW9kZWxzIGZyb20gdGhlIGNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX0gIGFycmF5IG9mIG1vZGVsIG9iamVjdHMgdGhhdCBoYXZlIHRoZW1zZWx2ZXMgYmVlbiBwYXNzZWQgdGhyb3VnaCB0b0pTT05cbiAgICAgICAgICovXG4gICAgICAgIHRvSlNPTjogZnVuY3Rpb24gdG9KU09OKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnRvSlNPTkluUHJvZ3Jlc3MpIHtcbiAgICAgICAgICAgICAgICAvLyBUaGlzIG9ubHkgaGFwcGVucyB3aGVuIHRoZXJlIGlzIGEgY2lyY3VsYXIgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgLy8gYW5kIHRoZSBtb2RlbCBoYXMgYWxyZWFkeSBiZWVuIHNlcmlhbGl6ZWQgcHJldmlvdXNseVxuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy50b0pTT05JblByb2dyZXNzID0gdHJ1ZTtcblxuICAgICAgICAgICAgdmFyIHRvUmV0dXJuO1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NoZW1hKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVscyA9IHRoaXMubW9kZWxzLFxuICAgICAgICAgICAgICAgICAgICBtb2RlbCxcbiAgICAgICAgICAgICAgICAgICAga2V5O1xuICAgICAgICAgICAgICAgIHRvUmV0dXJuID0gW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKGtleSBpbiBtb2RlbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVscy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbCA9IG1vZGVsc1trZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gbW9kZWwudG9KU09OKG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9SZXR1cm4ucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRvUmV0dXJuID0gX2hlbHBlcnNFeG9za2VsZXNzdG9uMlsnZGVmYXVsdCddLkNvbGxlY3Rpb24ucHJvdG90eXBlLnRvSlNPTi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnRvSlNPTkluUHJvZ3Jlc3MgPSBmYWxzZTtcblxuICAgICAgICAgICAgcmV0dXJuIHRvUmV0dXJuO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMb2NrIHdoaWNoIGFsbG93cyBkaXNwb3NlIHRvIGJlIGNhbGxlZCBtdWx0aXBsZSB0aW1lcyB3aXRob3V0IGRpc3Bvc2luZyBtdXRsaXBsZSB0aW1lc1xuICAgICAgICAgKiBkdXJpbmcgdG9KU09OIHNlcmlhbGl6dGlvblxuICAgICAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIGlzRGlzcG9zZWQ6IGZhbHNlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaXNwb3NlIHRoZSBjb2xsZWN0aW9uIGFuZCBhbGwgY29sbGV0aW9ucyBtb2RlbHNcbiAgICAgICAgICovXG4gICAgICAgIGRpc3Bvc2U6IGZ1bmN0aW9uIGRpc3Bvc2UoKSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBBZGQgcmVmZXJlbmNlIGNvdW50IGZ1bmN0aW9uYWxpdHkgdG8gYXZvaWQgc2l0dWF0aW9uXG4gICAgICAgICAgICAvLyB3aGVyZSBjb2xsZWN0aW9uIGlzIHVzZWQgbXVsdGlwbGUgdGltZXNcbiAgICAgICAgICAgIC8qaWYoIXRoaXMuaXNEaXNwb3NlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuaXNEaXNwb3NlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgXy5lYWNoKHRoaXMubW9kZWxzLCBmdW5jdGlvbihtb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICBpZihtb2RlbC5kaXNwb3NlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbC5kaXNwb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0qL1xuICAgICAgICB9XG5cbiAgICB9LCB7XG4gICAgICAgIGlzU2NoZW1hQ29sbGVjdGlvbjogdHJ1ZSxcbiAgICAgICAgdHlwZUxhYmVsOiAnU2NoZW1hQ29sbGVjdGlvbidcbiAgICB9KTtcbiAgICBTY2hlbWFDb2xsZWN0aW9uLmV4dGVuZCA9IGludGVybmFsRXh0ZW5kO1xuXG4gICAgLyoqXG4gICAgICogRXhvc2tlbGVzc3Rvbi5TY2hlbWEuVmFsdWVDb2xsZWN0aW9uIHByb3ZpZGVzIGEgRXhvc2tlbGVzc3Rvbi5TY2hlbWEuQ29sbGVjdGlvbiB0aGF0IGNvbnRhaW5zIHNpbXBsZSB2YWx1ZSB0eXBlcyByYXRoZXIgdGhhbiBtb2RlbHNcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAZXh0ZW5kcyBFeG9za2VsZXNzdG9uLkNvbGxlY3Rpb25cbiAgICAgKi9cbiAgICB2YXIgU2NoZW1hVmFsdWVDb2xsZWN0aW9uID0gU2NoZW1hLlZhbHVlQ29sbGVjdGlvbiA9IFNjaGVtYUNvbGxlY3Rpb24uZXh0ZW5kKHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGVjbGFyZSB0aGUgbW9kZWwgYXMgdW5kZWYoKSBhcyB3ZSBkb24ndCB1c2UgbW9kZWxzIGluIHRoaXMgaW1wbGVtZW50YXRpb25cbiAgICAgICAgICogQHR5cGUge1t0eXBlXX1cbiAgICAgICAgICovXG4gICAgICAgIG1vZGVsOiB1bmRlZigpLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSB1c2VkIHRvIGNvbnRhaW4gdGhlIGNvbGxlY3Rpb25zIHZhbHVlc1xuICAgICAgICAgKiBAdHlwZSB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBtb2RlbHM6IFtdLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIGhhc2ggb2JqZWN0IHdoaWNoIGlzIHVzZWQgdG8gdW5pcXVlbHkgaWRlbnRpZnkgdmFsdWVzIGFscmVhZHkgYWRkZWQgdG8gdGhlIGNvbGxlY3Rpb25cbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHZhbHVlTWFwczoge30sXG5cbiAgICAgICAgLy8gRWFjaCB0aW1lIHRoZSBDb2xsZWN0aW9uIGlzIGV4dGVuZGVkIGl0IHdpbGwgcmVjZWl2ZSBhIG5ld1xuICAgICAgICAvLyB1bmlxdWVUeXBlSWQgd2hpY2ggY2FuIGxhdGVyIGJlIHVzZWQgdG8gZGlmZmVyZW50aWF0ZSB0eXBlc1xuICAgICAgICB1bmlxdWVUeXBlSWQ6IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS51dGlscy51bmlxdWVJZCgpLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb25zdHJ1Y3RvciBmdW5jdGlvbiBpcyB1c2VkIHRvIHByb3ZpZGUgbmFtZWQgb2JqZWN0cyBkdXJpbmcgZGVidWdnaW5nXG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24gU2NoZW1hVmFsdWVDb2xsZWN0aW9uKHZhbHVlcywgb3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIFNjaGVtYUNvbGxlY3Rpb24ucHJvdG90eXBlLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZCBvbmUgb3IgbW9yZSB2YWx1ZXMgdG8gdGhlIGNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ8U3RyaW5nfEFycmF5fSB2YWx1ZXMgIFZhbHVlIG9yIGFycmF5IG9mIHZhbHVlcyB0byBhZGRlZCB0byB0aGUgY29sbGVjdGlvblxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IG9wdGlvbnNcbiAgICAgICAgICogQHJldHVybiB0aGlzXG4gICAgICAgICAqL1xuICAgICAgICBhZGQ6IGZ1bmN0aW9uIGFkZCh2YWx1ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBrZXksIHZhbHVlO1xuXG4gICAgICAgICAgICB2YWx1ZXMgPSB0aGlzLnNjaGVtYS51bmlxdWVJdGVtcyA/IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS51dGlscy51bmlxKHZhbHVlcykgOiB2YWx1ZXM7XG5cbiAgICAgICAgICAgIGZvciAoa2V5IGluIHZhbHVlcykge1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuc2NoZW1hLnVuaXF1ZUl0ZW1zIHx8ICF0aGlzLnZhbHVlTWFwc1t2YWx1ZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmFsdWVNYXBzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucyB8fCAhb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2FkZCcsIHZhbHVlLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgb25lIG9yIG1vcmUgdmFsdWVzIHRvIHRoZSBjb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfFN0cmluZ3xBcnJheX0gdmFsdWVzICBWYWx1ZSBvciBhcnJheSBvZiB2YWx1ZXMgdG8gYWRkZWQgdG8gdGhlIGNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBvcHRpb25zXG4gICAgICAgICAqIEByZXR1cm4gdGhpc1xuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUodmFsdWVzLCBvcHRpb25zKSB7XG5cbiAgICAgICAgICAgIHZhciBrZXksIHZhbHVlO1xuXG4gICAgICAgICAgICB2YWx1ZXMgPSB0aGlzLnNjaGVtYS51bmlxdWVJdGVtcyA/IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS51dGlscy51bmlxKHZhbHVlcykgOiB2YWx1ZXM7XG5cbiAgICAgICAgICAgIGZvciAoa2V5IGluIHZhbHVlcykge1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy52YWx1ZU1hcHNbdmFsdWVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy52YWx1ZU1hcHNbdmFsdWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGluZGV4ID0gdGhpcy5pbmRleE9mKHZhbHVlKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmxlbmd0aC0tO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyKCdyZW1vdmUnLCB2YWx1ZSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzZXRzIHRoZSBjb2xsZWN0aW9uIHdpdGggdGhlIHByb3ZpZGVkIHZhbHVlc1xuICAgICAgICAgKiBAcGFyYW0ge051bWJlcnxTdHJpbmd8QXJyYXl9IHZhbHVlcyAgVmFsdWUgb3IgYXJyYXkgb2YgdmFsdWVzXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gb3B0aW9uc1xuICAgICAgICAgKiBAcmV0dXJuIHRoaXNcbiAgICAgICAgICovXG4gICAgICAgIHJlc2V0OiBmdW5jdGlvbiByZXNldCh2YWx1ZXMsIG9wdGlvbnMpIHtcblxuICAgICAgICAgICAgdmFyIGtleSwgdmFsdWU7XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWxzID0gdGhpcy5zY2hlbWEudW5pcXVlSXRlbXMgPyBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10udXRpbHMudW5pcSh2YWx1ZXMpIDogdmFsdWVzO1xuICAgICAgICAgICAgdGhpcy5sZW5ndGggPSB0aGlzLm1vZGVscy5sZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnZhbHVlTWFwcyA9IHt9O1xuXG4gICAgICAgICAgICBmb3IgKGtleSBpbiB0aGlzLm1vZGVscykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1vZGVscy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdGhpcy5tb2RlbHNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52YWx1ZU1hcHNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0JywgdGhpcywgb3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICBfcHJlcGFyZU1vZGVsOiBmdW5jdGlvbiBfcHJlcGFyZU1vZGVsKHZhbHVlLCBvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX3ZhbGlkYXRlTW9kZWxzOiBmdW5jdGlvbiBfdmFsaWRhdGVNb2RlbHMob3B0aW9ucykge1xuXG4gICAgICAgICAgICB2YXIgZXJyb3JzID0gW107XG5cbiAgICAgICAgICAgIHZhciB2YWxpZGF0b3I7XG4gICAgICAgICAgICBzd2l0Y2ggKHRoaXMuc2NoZW1hLnR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3IgPSBmdW5jdGlvbiBpc1N0cmluZyh2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgdmFsID09PSAnc3RyaW5nJztcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnaW50ZWdlcic6XG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvciA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgbiA9PT0gJ251bWJlcicgJiYgbiAlIDEgPT09IDA7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvciA9IGZ1bmN0aW9uIGlzTnVtYmVyKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICdudW1iZXInO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZhbGlkYXRvcikge1xuICAgICAgICAgICAgICAgIHZhciBoYXNJbnZhbGlkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsO1xuICAgICAgICAgICAgICAgIHZhciBrZXk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGtleSBpbiB0aGlzLm1vZGVscykge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbCA9IHRoaXMubW9kZWxzW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm1vZGVscy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmICF2YWxpZGF0b3IobW9kZWwpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYXNJbnZhbGlkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGhhc0ludmFsaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWw6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBydWxlOiAndmFsdWUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJyUodGl0bGUpIGlzIGludmFsaWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RpdGxlJzogc2NoZW1hLnRpdGxlXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGVycm9ycztcbiAgICAgICAgfSxcblxuICAgICAgICBwbHVjazogZnVuY3Rpb24gcGx1Y2soKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBTdXBwb3J0ZWQnKTtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXRCeUNpZDogZnVuY3Rpb24gZ2V0QnlDaWQoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBTdXBwb3J0ZWQnKTtcbiAgICAgICAgfSxcblxuICAgICAgICB0b0pTT046IGZ1bmN0aW9uIHRvSlNPTihvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tb2RlbHMubGVuZ3RoID4gMCA/IHRoaXMubW9kZWxzLnNsaWNlKCkgOiB1bmRlZigpO1xuICAgICAgICB9XG4gICAgfSwge1xuICAgICAgICBpc1NjaGVtYUNvbGxlY3Rpb246IGZhbHNlLFxuICAgICAgICBpc1NjaGVtYVZhbHVlQ29sbGVjdGlvbjogdHJ1ZSxcbiAgICAgICAgdHlwZUxhYmVsOiAnU2NoZW1hVmFsdWVDb2xsZWN0aW9uJ1xuICAgIH0pO1xuXG4gICAgU2NoZW1hVmFsdWVDb2xsZWN0aW9uLmV4dGVuZCA9IGludGVybmFsRXh0ZW5kO1xuXG4gICAgLyoqXG4gICAgICogU2V2ZXJpdHkgTGV2ZWwgZm9yIEVycm9yc1xuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgdmFyIGVycm9yTGV2ZWxzID0ge1xuICAgICAgICAnZXJyb3InOiAzLFxuICAgICAgICAnd2Fybic6IDIsXG4gICAgICAgICdpbmZvJzogMVxuICAgIH07XG5cbiAgICB2YXIgVmFsaWRhdGlvbkVycm9yc0NvbGxlY3Rpb24gPSBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uQ29sbGVjdGlvbi5leHRlbmQoe1xuICAgICAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24gVmFsaWRhdGlvbkVycm9yc0NvbGxlY3Rpb24obW9kZWxzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBfaGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uQ29sbGVjdGlvbi5wcm90b3R5cGUuY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHRoaXMub24oJ2FkZCcsIHRoaXMuZmlyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLm9uKCdyZW1vdmUnLCB0aGlzLmZpcmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5vbignY2hhbmdlJywgdGhpcy5maXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgfSxcblxuICAgICAgICBmaXJlQ2hhbmdlOiBmdW5jdGlvbiBmaXJlQ2hhbmdlKGF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2U6bWF4TGV2ZWwnKTtcbiAgICAgICAgfSxcblxuICAgICAgICBtYXhMZXZlbDogZnVuY3Rpb24gbWF4TGV2ZWwoKSB7XG5cbiAgICAgICAgICAgIHZhciBrZXksIG1vZGVsO1xuXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0XG4gICAgICAgICAgICBpZiAodGhpcy5tb2RlbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBsZXZlbFN0cmluZyxcbiAgICAgICAgICAgICAgICBsZXZlbCA9IDA7XG5cbiAgICAgICAgICAgIGZvciAoa2V5IGluIHRoaXMubW9kZWxzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubW9kZWxzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWwgPSB0aGlzLm1vZGVsc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3JMZXZlbHNbbW9kZWwuZ2V0KCdsZXZlbCcpXSA+IGxldmVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXZlbCA9IGVycm9yTGV2ZWxzW21vZGVsLmdldCgnbGV2ZWwnKV07XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXZlbFN0cmluZyA9IG1vZGVsLmdldCgnbGV2ZWwnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGxldmVsU3RyaW5nO1xuICAgICAgICB9LFxuXG4gICAgICAgIGRpc3Bvc2U6IGZ1bmN0aW9uIGRpc3Bvc2UoKSB7XG4gICAgICAgICAgICB0aGlzLm9mZigpO1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKCdkaXNwb3NlJyk7XG4gICAgICAgIH1cblxuICAgIH0pO1xuXG4gICAgdmFyIFZhbGlkYXRpb25Nb2RlbCA9IF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Nb2RlbC5leHRlbmQoe1xuICAgICAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24gVmFsaWRhdGlvbk1vZGVsKGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5Nb2RlbC5wcm90b3R5cGUuY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXRFcnJvcjogZnVuY3Rpb24gc2V0RXJyb3Ioa2V5LCBlcnJvcnMpIHtcbiAgICAgICAgICAgIHZhciBwcmV2aW91cyA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBpZiAocHJldmlvdXMgJiYgcHJldmlvdXMuZGlzcG9zZSkge1xuICAgICAgICAgICAgICAgIHByZXZpb3VzLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc2V0KGtleSwgbmV3IFZhbGlkYXRpb25FcnJvcnNDb2xsZWN0aW9uKGVycm9ycykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBpbmhlcml0YW5jZSBzdHlsZSBTY2hlbWEgXCJleHRlbmRzXCIgZnVuY3Rpb25hbGl0eVxuICAgICAqIEBwYXJhbSAge09iamVjdH0gdGFyZ2V0ICAgIFNjaGVtYSBvYmplY3Qgd2hpY2ggaXMgYmVpbmcgZXh0ZW5kZWRcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGV4dGVuc2lvbiBTY2hlbWEgcHJvcGVydGllcyB0byBhcHBseSB0byB0YXJnZXRcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICBSZXR1cm5zIHRoZSBtb2RpZmllZCB0YXJnZXQgc2NoZW1hXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBleHRlbmRTY2hlbWEodGFyZ2V0LCBleHRlbnNpb24pIHtcbiAgICAgICAgZm9yICh2YXIgcHJvcGVydHkgaW4gZXh0ZW5zaW9uKSB7XG4gICAgICAgICAgICAvLyBEb24ndCBleHRlbmQgXCJpZFwiIHByb3BlcnRpZXNcbiAgICAgICAgICAgIC8vaWYoZXh0ZW5zaW9uLmhhc093blByb3BlcnR5KHByb3BlcnR5KSAmJiBwcm9wZXJ0eSAhPSAnaWQnKSB7XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dGVuc2lvblByb3BlcnR5ID0gZXh0ZW5zaW9uW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICBpZiAoZXh0ZW5zaW9uUHJvcGVydHkgIT09IHVuZGVmKCkpIHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0UHJvcGVydHkgPSB0YXJnZXRbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIERvbid0IHByb2Nlc3MgZXF1YWwgb2JqZWN0c1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0UHJvcGVydHkgPT09IGV4dGVuc2lvblByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSB0YXJnZXQgZG9lcyBub3QgZXhpc3QsIHRoZW4gY29weSAoYnkgcmVmZXJlbmNlKSB0aGUgZXh0ZW5zaW9uIHByb3BlcnR5IGRpcmVjdGx5XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRQcm9wZXJ0eSA9PT0gdW5kZWYoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W3Byb3BlcnR5XSA9IGV4dGVuc2lvblByb3BlcnR5O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHRhcmdldCBleGlzdHMgYW5kIGlzIGFuIG9iamVjdCwgdGhlbiBtZXJnZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF9oZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS51dGlscy5pc09iamVjdCh0YXJnZXRQcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHRlbmRTY2hlbWEodGFyZ2V0UHJvcGVydHksIGV4dGVuc2lvblByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhY2hlIG9iamVjdCBmb3IgUmVnRXhwc1xuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgdmFyIHJlZ2V4cyA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogRGF0ZS5wYXJzZSB3aXRoIHByb2dyZXNzaXZlIGVuaGFuY2VtZW50IGZvciBJU08gODYwMSA8aHR0cHM6Ly9naXRodWIuY29tL2Nzbm92ZXIvanMtaXNvODYwMT5cbiAgICAgKiDCqSAyMDExIENvbGluIFNub3ZlciA8aHR0cDovL3pldGFmbGVldC5jb20+XG4gICAgICogUmVsZWFzZWQgdW5kZXIgTUlUIGxpY2Vuc2UuXG4gICAgICovXG4gICAgdmFyIG51bWVyaWNLZXlzID0gWzEsIDQsIDUsIDYsIDcsIDEwLCAxMV07XG5cbiAgICBmdW5jdGlvbiBEYXRlUGFyc2UoZGF0ZSkge1xuICAgICAgICB2YXIgdGltZXN0YW1wLFxuICAgICAgICAgICAgc3RydWN0LFxuICAgICAgICAgICAgbWludXRlc09mZnNldCA9IDA7XG5cbiAgICAgICAgLy8gRVM1IMKnMTUuOS40LjIgc3RhdGVzIHRoYXQgdGhlIHN0cmluZyBzaG91bGQgYXR0ZW1wdCB0byBiZSBwYXJzZWQgYXMgYSBEYXRlIFRpbWUgU3RyaW5nIEZvcm1hdCBzdHJpbmdcbiAgICAgICAgLy8gYmVmb3JlIGZhbGxpbmcgYmFjayB0byBhbnkgaW1wbGVtZW50YXRpb24tc3BlY2lmaWMgZGF0ZSBwYXJzaW5nLCBzbyB0aGF04oCZcyB3aGF0IHdlIGRvLCBldmVuIGlmIG5hdGl2ZVxuICAgICAgICAvLyBpbXBsZW1lbnRhdGlvbnMgY291bGQgYmUgZmFzdGVyXG4gICAgICAgIC8vICAgICAgICAgICAgICAxIFlZWVkgICAgICAgICAgICAgICAgMiBNTSAgICAgICAzIEREICAgICAgICAgICA0IEhIICAgIDUgbW0gICAgICAgNiBzcyAgICAgICAgNyBtc2VjICAgICAgICA4IFogOSDCsSAgICAxMCB0ekhIICAgIDExIHR6bW1cbiAgICAgICAgaWYgKHN0cnVjdCA9IC9eKFxcZHs0fXxbK1xcLV1cXGR7Nn0pKD86LShcXGR7Mn0pKD86LShcXGR7Mn0pKT8pPyg/OlQoXFxkezJ9KTooXFxkezJ9KSg/OjooXFxkezJ9KSg/OlxcLihcXGR7M30pKT8pPyg/OihaKXwoWytcXC1dKShcXGR7Mn0pKD86OihcXGR7Mn0pKT8pPyk/JC8uZXhlYyhkYXRlKSkge1xuICAgICAgICAgICAgLy8gYXZvaWQgTmFOIHRpbWVzdGFtcHMgY2F1c2VkIGJ5IOKAnHVuZGVmKCnigJ0gdmFsdWVzIGJlaW5nIHBhc3NlZCB0byBEYXRlLlVUQ1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGs7IGsgPSBudW1lcmljS2V5c1tpXTsgKytpKSB7XG4gICAgICAgICAgICAgICAgc3RydWN0W2tdID0gK3N0cnVjdFtrXSB8fCAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhbGxvdyB1bmRlZigpIGRheXMgYW5kIG1vbnRoc1xuICAgICAgICAgICAgc3RydWN0WzJdID0gKCtzdHJ1Y3RbMl0gfHwgMSkgLSAxO1xuICAgICAgICAgICAgc3RydWN0WzNdID0gK3N0cnVjdFszXSB8fCAxO1xuXG4gICAgICAgICAgICBpZiAoc3RydWN0WzhdICE9PSAnWicgJiYgc3RydWN0WzldICE9PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgbWludXRlc09mZnNldCA9IHN0cnVjdFsxMF0gKiA2MCArIHN0cnVjdFsxMV07XG5cbiAgICAgICAgICAgICAgICBpZiAoc3RydWN0WzldID09PSAnKycpIHtcbiAgICAgICAgICAgICAgICAgICAgbWludXRlc09mZnNldCA9IDAgLSBtaW51dGVzT2Zmc2V0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGltZXN0YW1wID0gRGF0ZS5VVEMoc3RydWN0WzFdLCBzdHJ1Y3RbMl0sIHN0cnVjdFszXSwgc3RydWN0WzRdLCBzdHJ1Y3RbNV0gKyBtaW51dGVzT2Zmc2V0LCBzdHJ1Y3RbNl0sIHN0cnVjdFs3XSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aW1lc3RhbXAgPSBEYXRlLnBhcnNlID8gRGF0ZS5wYXJzZShkYXRlKSA6IE5hTjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aW1lc3RhbXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVmFyaW91cyBWYWxpZGF0b3JzXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB2YXIgVmFsaWRhdG9ycyA9IHtcbiAgICAgICAgcmVxdWlyZWQ6IGZ1bmN0aW9uIHJlcXVpcmVkKHZhbHVlLCBfcmVxdWlyZWQpIHtcbiAgICAgICAgICAgIF9yZXF1aXJlZCA9IF9yZXF1aXJlZCB8fCB0cnVlO1xuXG4gICAgICAgICAgICBpZiAoX3JlcXVpcmVkICYmICh2YWx1ZSA9PT0gdW5kZWYoKSB8fCB2YWx1ZSA9PT0gJycpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5ICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgbWluTGVuZ3RoOiBmdW5jdGlvbiBtaW5MZW5ndGgodmFsdWUsIF9taW5MZW5ndGgpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWYoKSB8fCB2YWx1ZS5sZW5ndGggPCBfbWluTGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBtYXhMZW5ndGg6IGZ1bmN0aW9uIG1heExlbmd0aCh2YWx1ZSwgX21heExlbmd0aCkge1xuICAgICAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLmxlbmd0aCA+IF9tYXhMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIG1pbmltdW06IGZ1bmN0aW9uIG1pbmltdW0odmFsdWUsIF9taW5pbXVtLCBleGNsdXNpdmVNaW5pbXVtKSB7XG4gICAgICAgICAgICBpZiAoaXNOYU4odmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGV4Y2x1c2l2ZU1pbmltdW0gPT09IHRydWUgPyBwYXJzZUludCh2YWx1ZSwgMTApID4gX21pbmltdW0gOiBwYXJzZUludCh2YWx1ZSwgMTApID49IF9taW5pbXVtO1xuICAgICAgICB9LFxuXG4gICAgICAgIG1heGltdW06IGZ1bmN0aW9uIG1heGltdW0odmFsdWUsIF9tYXhpbXVtLCBleGNsdXNpdmVNYXhpbXVtKSB7XG4gICAgICAgICAgICBpZiAoaXNOYU4odmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGV4Y2x1c2l2ZU1heGltdW0gPT09IHRydWUgPyBwYXJzZUludCh2YWx1ZSwgMTApIDwgX21heGltdW0gOiBwYXJzZUludCh2YWx1ZSwgMTApIDw9IF9tYXhpbXVtO1xuICAgICAgICB9LFxuXG4gICAgICAgIGRpdmlzaWJsZUJ5OiBmdW5jdGlvbiBkaXZpc2libGVCeSh2YWx1ZSwgX2RpdmlzaWJsZUJ5KSB7XG4gICAgICAgICAgICBpZiAoaXNOYU4odmFsdWUpIHx8IF9kaXZpc2libGVCeSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB2YWx1ZSAlIF9kaXZpc2libGVCeSA9PT0gMDtcbiAgICAgICAgfSxcblxuICAgICAgICBmb3JtYXQ6IGZ1bmN0aW9uIGZvcm1hdCh2YWx1ZSwgX2Zvcm1hdCkge1xuICAgICAgICAgICAgc3dpdGNoIChfZm9ybWF0KSB7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdjb2xvcic6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdHRlcm4odmFsdWUsIFwiXiNbQS1GMC05XXs2fXxhbGljZWJsdWV8YW50aXF1ZXdoaXRlfGFxdWF8YXF1YW1hcmluZXxhenVyZXxiZWlnZXxiaXNxdWV8YmxhY2t8YmxhbmNoZWRhbG1vbmR8Ymx1ZXxibHVldmlvbGV0fGJyb3dufGJ1cmx5d29vZHxjYWRldGJsdWV8Y2hhcnRyZXVzZXxjaG9jb2xhdGV8Y29yYWx8Y29ybmZsb3dlcmJsdWV8Y29ybnNpbGt8Y3JpbXNvbnxjeWFufGRhcmtibHVlfGRhcmtjeWFufGRhcmtnb2xkZW5yb2R8ZGFya2dyYXl8ZGFya2dyZWVufGRhcmtraGFraXxkYXJrbWFnZW50YXxkYXJrb2xpdmVncmVlbnxkYXJrb3JhbmdlfGRhcmtvcmNoaWR8ZGFya3JlZHxkYXJrc2FsbW9ufGRhcmtzZWFncmVlbnxkYXJrc2xhdGVibHVlfGRhcmtzbGF0ZWdyYXl8ZGFya3R1cnF1b2lzZXxkYXJrdmlvbGV0fGRlZXBwaW5rfGRlZXBza3libHVlfGRpbWdyYXl8ZG9kZ2VyYmx1ZXxmaXJlYnJpY2t8ZmxvcmFsd2hpdGV8Zm9yZXN0Z3JlZW58ZnVjaHNpYXxnYWluc2Jvcm98Z2hvc3R3aGl0ZXxnb2xkfGdvbGRlbnJvZHxncmF5fGdyZWVufGdyZWVueWVsbG93fGhvbmV5ZGV3fGhvdHBpbmt8aW5kaWFucmVkIHxpbmRpZ28gfGl2b3J5fGtoYWtpfGxhdmVuZGVyfGxhdmVuZGVyYmx1c2h8bGF3bmdyZWVufGxlbW9uY2hpZmZvbnxsaWdodGJsdWV8bGlnaHRjb3JhbHxsaWdodGN5YW58bGlnaHRnb2xkZW5yb2R5ZWxsb3d8bGlnaHRncmV5fGxpZ2h0Z3JlZW58bGlnaHRwaW5rfGxpZ2h0c2FsbW9ufGxpZ2h0c2VhZ3JlZW58bGlnaHRza3libHVlfGxpZ2h0c2xhdGVncmF5fGxpZ2h0c3RlZWxibHVlfGxpZ2h0eWVsbG93fGxpbWV8bGltZWdyZWVufGxpbmVufG1hZ2VudGF8bWFyb29ufG1lZGl1bWFxdWFtYXJpbmV8bWVkaXVtYmx1ZXxtZWRpdW1vcmNoaWR8bWVkaXVtcHVycGxlfG1lZGl1bXNlYWdyZWVufG1lZGl1bXNsYXRlYmx1ZXxtZWRpdW1zcHJpbmdncmVlbnxtZWRpdW10dXJxdW9pc2V8bWVkaXVtdmlvbGV0cmVkfG1pZG5pZ2h0Ymx1ZXxtaW50Y3JlYW18bWlzdHlyb3NlfG1vY2Nhc2lufG5hdmFqb3doaXRlfG5hdnl8b2xkbGFjZXxvbGl2ZXxvbGl2ZWRyYWJ8b3JhbmdlfG9yYW5nZXJlZHxvcmNoaWR8cGFsZWdvbGRlbnJvZHxwYWxlZ3JlZW58cGFsZXR1cnF1b2lzZXxwYWxldmlvbGV0cmVkfHBhcGF5YXdoaXB8cGVhY2hwdWZmfHBlcnV8cGlua3xwbHVtfHBvd2RlcmJsdWV8cHVycGxlfHJlZHxyb3N5YnJvd258cm95YWxibHVlfHNhZGRsZWJyb3dufHNhbG1vbnxzYW5keWJyb3dufHNlYWdyZWVufHNlYXNoZWxsfHNpZW5uYXxzaWx2ZXJ8c2t5Ymx1ZXxzbGF0ZWJsdWV8c2xhdGVncmF5fHNub3d8c3ByaW5nZ3JlZW58c3RlZWxibHVlfHRhbnx0ZWFsfHRoaXN0bGV8dG9tYXRvfHR1cnF1b2lzZXx2aW9sZXR8d2hlYXR8d2hpdGV8d2hpdGVzbW9rZXx5ZWxsb3d8eWVsbG93Z3JlZW4kXCIpO1xuXG4gICAgICAgICAgICAgICAgY2FzZSAnc3R5bGUnOlxuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGNhc2UgJ3Bob25lJzpcbiAgICAgICAgICAgICAgICAgICAgLy8gZnJvbSBodHRwOi8vYmxvZy5zdGV2ZW5sZXZpdGhhbi5jb20vYXJjaGl2ZXMvdmFsaWRhdGUtcGhvbmUtbnVtYmVyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdHRlcm4odmFsdWUsIFwiXlxcXFwrKD86WzAtOV1cXFxceDIwPyl7NiwxNH1bMC05XSRcIik7XG5cbiAgICAgICAgICAgICAgICBjYXNlICd1cmknOlxuICAgICAgICAgICAgICAgICAgICAvLyBmcm9tIGh0dHA6Ly9zbmlwcGxyLmNvbS92aWV3LzY4ODkvXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdHRlcm4odmFsdWUsIFwiXig/Omh0dHBzP3xmdHApOi8vLitcXFxcLi4rJFwiKTtcblxuICAgICAgICAgICAgICAgIGNhc2UgJ2VtYWlsJzpcbiAgICAgICAgICAgICAgICAgICAgLy8gZnJvbSBodHRwOi8vZmlnaHRpbmdmb3JhbG9zdGNhdXNlLm5ldC9taXNjLzIwMDYvY29tcGFyZS1lbWFpbC1yZWdleC5waHBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0dGVybih2YWx1ZSwgJ15bLWEtejAtOX4hJCVeJipfPSt9e1xcJz9dKyhcXFxcLlstYS16MC05fiEkJV4mKl89K317XFwnP10rKSpAKFthLXowLTlfXVstYS16MC05X10qKFxcXFwuWy1hLXowLTlfXSspKlxcXFwuKGFlcm98YXJwYXxiaXp8Y29tfGNvb3B8ZWR1fGdvdnxpbmZvfGludHxtaWx8bXVzZXVtfG5hbWV8bmV0fG9yZ3xwcm98dHJhdmVsfG1vYml8W2Etel1bYS16XSl8KFswLTldezEsM31cXFxcLlswLTldezEsM31cXFxcLlswLTldezEsM31cXFxcLlswLTldezEsM30pKSg6WzAtOV17MSw1fSk/JCcpO1xuXG4gICAgICAgICAgICAgICAgY2FzZSAnaXAtYWRkcmVzcyc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdHRlcm4odmFsdWUsIFwiXFxcXGR7MSwzfVxcXFwuXFxcXGR7MSwzfVxcXFwuXFxcXGR7MSwzfVxcXFwuXFxcXGR7MSwzfVwiKTtcblxuICAgICAgICAgICAgICAgIGNhc2UgJ2lwdjYnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXR0ZXJuKHZhbHVlLCBcIlxcXFxkezEsM31cXFxcLlxcXFxkezEsM31cXFxcLlxcXFxkezEsM31cXFxcLlxcXFxkezEsM31cIik7XG5cbiAgICAgICAgICAgICAgICAvLyBUT0RPXG4gICAgICAgICAgICAgICAgLy8gY2FzZSAqdmFyaW91cyBtaW1lLXR5cGVzKlxuICAgICAgICAgICAgICAgIGNhc2UgJ2RhdGUtdGltZSc6XG4gICAgICAgICAgICAgICAgY2FzZSAnZGF0ZSc6XG4gICAgICAgICAgICAgICAgY2FzZSAndGltZSc6XG4gICAgICAgICAgICAgICAgY2FzZSAndXRjLW1pbGxpc2VjJzpcbiAgICAgICAgICAgICAgICBjYXNlICdyZWdleCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnc3RyZWV0LWFkZHJlc3MnOlxuICAgICAgICAgICAgICAgIGNhc2UgJ2xvY2FsaXR5JzpcbiAgICAgICAgICAgICAgICBjYXNlICdyZWdpb24nOlxuICAgICAgICAgICAgICAgIGNhc2UgJ3Bvc3RhbC1jb2RlJzpcbiAgICAgICAgICAgICAgICBjYXNlICdjb3VudHJ5JzpcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdXQVJOSU5HIC0gVmFsaWRhdGlvbiBub3QgaW1wbGVtZW50ZWQgZm9yIGZvcm1hdDonICsgX2Zvcm1hdCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgbG9nKCdXQVJOSU5HIC0gVW5rbm93biB2YWxpZGF0aW9uIGZvcm1hdDonICsgX2Zvcm1hdCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIHBhdHRlcm46IGZ1bmN0aW9uIHBhdHRlcm4odmFsdWUsIF9wYXR0ZXJuKSB7XG4gICAgICAgICAgICB2YXIgcmVnZXggPSByZWdleHNbX3BhdHRlcm5dO1xuXG4gICAgICAgICAgICBpZiAocmVnZXggPT09IHVuZGVmKCkpIHtcbiAgICAgICAgICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAoX3BhdHRlcm4sIFwiaVwiKTtcbiAgICAgICAgICAgICAgICByZWdleHNbX3BhdHRlcm5dID0gcmVnZXg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZWdleC50ZXN0KHZhbHVlKTtcbiAgICAgICAgfSxcblxuICAgICAgICBtaW5JdGVtczogZnVuY3Rpb24gbWluSXRlbXMoaXRlbXMsIF9taW5JdGVtcykge1xuICAgICAgICAgICAgcmV0dXJuIGl0ZW1zLmxlbmd0aCA+PSBfbWluSXRlbXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgbWF4SXRlbXM6IGZ1bmN0aW9uIG1heEl0ZW1zKGl0ZW1zLCBfbWF4SXRlbXMpIHtcbiAgICAgICAgICAgIHJldHVybiBpdGVtcy5sZW5ndGggPD0gX21heEl0ZW1zO1xuICAgICAgICB9LFxuXG4gICAgICAgIHVuaXF1ZUl0ZW1zOiBmdW5jdGlvbiB1bmlxdWVJdGVtcyhpdGVtcywgdHJhbnNmb3JtKSB7XG4gICAgICAgICAgICBpZiAodHJhbnNmb3JtID09PSB1bmRlZigpKSB7XG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtID0gZnVuY3Rpb24gKGEpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGE7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB1bmlxdWVJdGVtcyA9IHt9O1xuICAgICAgICAgICAgdmFyIGhhc1VuaXF1ZUl0ZW1zID0gdHJ1ZTtcbiAgICAgICAgICAgIHZhciBrZXksIHZhbHVlLCBpZDtcblxuICAgICAgICAgICAgZm9yIChrZXkgaW4gaXRlbXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXRlbXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IGl0ZW1zW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGlkID0gdHJhbnNmb3JtKHZhbHVlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodW5pcXVlSXRlbXNbaWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYXNVbmlxdWVJdGVtcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdW5pcXVlSXRlbXNbaWRdID0gaWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaGFzVW5pcXVlSXRlbXM7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIG90aGVyd2lzZSBwcml2YXRlIG9iamVjdHMuIFVzZWQgZnJvbSB0ZXN0c1xuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgU2NoZW1hLlRlc3RIZWxwZXIgPSB7XG4gICAgICAgIFZhbGlkYXRvcnM6IFZhbGlkYXRvcnMsXG4gICAgICAgIEpTT05Qb2ludGVyOiBKU09OUG9pbnRlclxuICAgIH07XG5cbiAgICByZXR1cm4gU2NoZW1hO1xufSkuY2FsbCh1bmRlZmluZWQpO1xuXG5faGVscGVyc0Vudmlyb25tZW50LmdldEdsb2JhbE9iamVjdCgpLkZvcm1lbGxTY2hlbWEgPSBGb3JtZWxsU2NoZW1hO1xuZXhwb3J0c1snZGVmYXVsdCddID0gRm9ybWVsbFNjaGVtYTtcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1snZGVmYXVsdCddOyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHMuZ2V0R2xvYmFsT2JqZWN0ID0gZ2V0R2xvYmFsT2JqZWN0O1xuXG5mdW5jdGlvbiBnZXRHbG9iYWxPYmplY3QoKSB7XG5cdC8vIFdvcmtlcnMgZG9u77+9dCBoYXZlIGB3aW5kb3dgLCBvbmx5IGBzZWxmYFxuXHRpZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0cmV0dXJuIHNlbGY7XG5cdH1cblx0aWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0cmV0dXJuIGdsb2JhbDtcblx0fVxuXHQvLyBOb3QgYWxsIGVudmlyb25tZW50cyBhbGxvdyBldmFsIGFuZCBGdW5jdGlvblxuXHQvLyBVc2Ugb25seSBhcyBhIGxhc3QgcmVzb3J0OlxuXHRyZXR1cm4gbmV3IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0cy5uYW1lID0gbmFtZTtcbmV4cG9ydHMudGFnTmFtZSA9IHRhZ05hbWU7XG5leHBvcnRzLmVsID0gZWw7XG5leHBvcnRzLiRlbCA9ICRlbDtcbmV4cG9ydHMuaWQgPSBpZDtcbmV4cG9ydHMuY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xuZXhwb3J0cy5ldmVudHMgPSBldmVudHM7XG5leHBvcnRzLm9uID0gb247XG5leHBvcnRzLnRlbXBsYXRlID0gdGVtcGxhdGU7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxudmFyIF9leG9za2VsZXRvbiA9IHJlcXVpcmUoJ2V4b3NrZWxldG9uJyk7XG5cbnZhciBfZXhvc2tlbGV0b24yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZXhvc2tlbGV0b24pO1xuXG52YXIgX2JhY2tib25lTmF0aXZldmlldyA9IHJlcXVpcmUoJ2JhY2tib25lLm5hdGl2ZXZpZXcnKTtcblxudmFyIF9iYWNrYm9uZU5hdGl2ZXZpZXcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfYmFja2JvbmVOYXRpdmV2aWV3KTtcblxudmFyIF9iYWNrYm9uZU5hdGl2ZWFqYXggPSByZXF1aXJlKCdiYWNrYm9uZS5uYXRpdmVhamF4Jyk7XG5cbnZhciBfYmFja2JvbmVOYXRpdmVhamF4MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2JhY2tib25lTmF0aXZlYWpheCk7XG5cbnZhciBfc3RyaW5nID0gcmVxdWlyZSgnLi9zdHJpbmcnKTtcblxuX2V4b3NrZWxldG9uMlsnZGVmYXVsdCddLlZpZXcgPSBfYmFja2JvbmVOYXRpdmV2aWV3MlsnZGVmYXVsdCddO1xuX2V4b3NrZWxldG9uMlsnZGVmYXVsdCddLlZpZXcucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcoKSB7XG5cdHJldHVybiB0aGlzLm5hbWU7XG59O1xuX2V4b3NrZWxldG9uMlsnZGVmYXVsdCddLmFqYXggPSBfYmFja2JvbmVOYXRpdmVhamF4MlsnZGVmYXVsdCddO1xuXG5fZXhvc2tlbGV0b24yWydkZWZhdWx0J10udXRpbHMuaXNPYmplY3QgPSBmdW5jdGlvbiAob2JqKSB7XG5cdHZhciB0eXBlID0gdHlwZW9mIG9iajtcblx0cmV0dXJuIHR5cGUgPT09ICdmdW5jdGlvbicgfHwgdHlwZSA9PT0gJ29iamVjdCcgJiYgISFvYmo7XG59O1xuXG5fZXhvc2tlbGV0b24yWydkZWZhdWx0J10udXRpbHMudW5pcSA9IGZ1bmN0aW9uIChhcnIpIHtcblxuXHRpZiAoIWFycikge1xuXHRcdGFyciA9IFtdO1xuXHR9IGVsc2Uge1xuXHRcdGFyciA9IGFyci5maWx0ZXIoZnVuY3Rpb24gKGl0ZW0sIGluZGV4KSB7XG5cdFx0XHRyZXR1cm4gYXJyLmluZGV4T2YoaXRlbSkgPT0gaW5kZXg7XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gYXJyO1xufTtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gX2V4b3NrZWxldG9uMlsnZGVmYXVsdCddO1xuXG4vL2RlY29yYXRvcnNcblxuZnVuY3Rpb24gbmFtZSh2YWx1ZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gZGVjb3JhdG9yKHRhcmdldCkge1xuXHRcdHRhcmdldC5wcm90b3R5cGUubmFtZSA9IHZhbHVlO1xuXHR9O1xufVxuXG5mdW5jdGlvbiB0YWdOYW1lKHZhbHVlKSB7XG5cdHJldHVybiBmdW5jdGlvbiBkZWNvcmF0b3IodGFyZ2V0KSB7XG5cdFx0dGFyZ2V0LnByb3RvdHlwZS50YWdOYW1lID0gdmFsdWU7XG5cdH07XG59XG5cbmZ1bmN0aW9uIGVsKHZhbHVlKSB7XG5cdHJldHVybiBmdW5jdGlvbiBkZWNvcmF0b3IodGFyZ2V0KSB7XG5cdFx0dGFyZ2V0LnByb3RvdHlwZS5lbCA9IHZhbHVlO1xuXHR9O1xufVxuXG5mdW5jdGlvbiAkZWwodmFsdWUpIHtcblx0cmV0dXJuIGZ1bmN0aW9uIGRlY29yYXRvcih0YXJnZXQpIHtcblx0XHR0YXJnZXQucHJvdG90eXBlLiRlbCA9IHZhbHVlO1xuXHR9O1xufVxuXG5mdW5jdGlvbiBpZCh2YWx1ZSkge1xuXHRyZXR1cm4gZnVuY3Rpb24gZGVjb3JhdG9yKHRhcmdldCkge1xuXHRcdHRhcmdldC5wcm90b3R5cGUuaWQgPSB2YWx1ZTtcblx0fTtcbn1cblxuZnVuY3Rpb24gY2xhc3NOYW1lKHZhbHVlKSB7XG5cdHJldHVybiBmdW5jdGlvbiBkZWNvcmF0b3IodGFyZ2V0KSB7XG5cdFx0dGFyZ2V0LnByb3RvdHlwZS5jbGFzc05hbWUgPSB2YWx1ZTtcblx0fTtcbn1cblxuZnVuY3Rpb24gZXZlbnRzKHZhbHVlKSB7XG5cdHJldHVybiBmdW5jdGlvbiBkZWNvcmF0b3IodGFyZ2V0KSB7XG5cdFx0dGFyZ2V0LnByb3RvdHlwZS5ldmVudHMgPSB2YWx1ZTtcblx0fTtcbn1cblxuZnVuY3Rpb24gb24oZXZlbnROYW1lKSB7XG5cdHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBuYW1lLCBkZXNjcmlwdG9yKSB7XG5cdFx0aWYgKCF0YXJnZXQuZXZlbnRzKSB7XG5cdFx0XHR0YXJnZXQuZXZlbnRzID0ge307XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgdGFyZ2V0LmV2ZW50cyA9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1RoZSBvbiBkZWNvcmF0b3IgaXMgbm90IGNvbXBhdGlibGUgd2l0aCBhbiBldmVudHMgbWV0aG9kJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghZXZlbnROYW1lKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1RoZSBvbiBkZWNvcmF0b3IgcmVxdWlyZXMgYW4gZXZlbnROYW1lIGFyZ3VtZW50Jyk7XG5cdFx0fVxuXHRcdHRhcmdldC5ldmVudHNbZXZlbnROYW1lXSA9IG5hbWU7XG5cdFx0cmV0dXJuIGRlc2NyaXB0b3I7XG5cdH07XG59XG5cbmZ1bmN0aW9uIHRlbXBsYXRlKHZhbHVlKSB7XG5cdHJldHVybiBmdW5jdGlvbiBkZWNvcmF0b3IodGFyZ2V0KSB7XG5cdFx0dGFyZ2V0LnByb3RvdHlwZS50ZW1wbGF0ZSA9IF9zdHJpbmcuZ2VuZXJhdGVUZW1wbGF0ZVN0cmluZyh2YWx1ZSk7XG5cdH07XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0cy5jcmVhdGVVSUQgPSBjcmVhdGVVSUQ7XG5cbmZ1bmN0aW9uIGNyZWF0ZVVJRCgpIHtcblx0cmV0dXJuICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgZnVuY3Rpb24gKGMpIHtcblx0XHR2YXIgciA9IE1hdGgucmFuZG9tKCkgKiAxNiB8IDAsXG5cdFx0ICAgIHYgPSBjID09ICd4JyA/IHIgOiByICYgMHgzIHwgMHg4O1xuXHRcdHJldHVybiB2LnRvU3RyaW5nKDE2KTtcblx0fSk7XG59XG5cbnZhciBnZW5lcmF0ZVRlbXBsYXRlU3RyaW5nID0gKGZ1bmN0aW9uICgpIHtcblx0dmFyIGNhY2hlID0ge307XG5cblx0ZnVuY3Rpb24gZ2VuZXJhdGVUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXG5cdFx0dmFyIGZuID0gY2FjaGVbdGVtcGxhdGVdO1xuXG5cdFx0aWYgKCFmbikge1xuXG5cdFx0XHQvLyBSZXBsYWNlICR7ZXhwcmVzc2lvbnN9IChldGMpIHdpdGggJHttYXAuZXhwcmVzc2lvbnN9LlxuXHRcdFx0dmFyIHNhbml0aXplZCA9IHRlbXBsYXRlLnJlcGxhY2UoL1xcJFxceyhbXFxzXSpbXjtcXHNdK1tcXHNdKilcXH0vZywgZnVuY3Rpb24gKF8sIG1hdGNoKSB7XG5cdFx0XHRcdHJldHVybiAnJHttYXAuJyArIG1hdGNoLnRyaW0oKSArICd9Jztcblx0XHRcdH0pXG5cdFx0XHQvLyBBZnRlcndhcmRzLCByZXBsYWNlIGFueXRoaW5nIHRoYXQncyBub3QgJHttYXAuZXhwcmVzc2lvbnN9JyAoZXRjKSB3aXRoIGEgYmxhbmsgc3RyaW5nLlxuXHRcdFx0LnJlcGxhY2UoLyhcXCRcXHsoPyFtYXBcXC4pW159XStcXH0pL2csICcnKTtcblxuXHRcdFx0Zm4gPSBGdW5jdGlvbignbWFwJywgJ3JldHVybiBgJyArIHNhbml0aXplZCArICdgJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZuO1xuXHR9O1xuXG5cdHJldHVybiBnZW5lcmF0ZVRlbXBsYXRlO1xufSkoKTtcbmV4cG9ydHMuZ2VuZXJhdGVUZW1wbGF0ZVN0cmluZyA9IGdlbmVyYXRlVGVtcGxhdGVTdHJpbmc7IiwiLyoqXHJcbiAqIENvcHlyaWdodCAoYykgMjAxMCBNYXhpbSBWYXNpbGlldlxyXG4gKlxyXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XHJcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcclxuICogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xyXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXHJcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xyXG4gKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxyXG4gKlxyXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxyXG4gKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cclxuICpcclxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxyXG4gKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcclxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXHJcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcclxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcclxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxyXG4gKiBUSEUgU09GVFdBUkUuXHJcbiAqXHJcbiAqIEBhdXRob3IgTWF4aW0gVmFzaWxpZXZcclxuICogRGF0ZTogMDkuMDkuMjAxMFxyXG4gKiBUaW1lOiAxOTowMjozM1xyXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcblx0aWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuXHRcdC8vIE5vZGVKU1xuXHRcdG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuXHRcdC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cblx0XHRkZWZpbmUoZmFjdG9yeSk7XG5cdH0gZWxzZSB7XG5cdFx0Ly8gQnJvd3NlciBnbG9iYWxzXG5cdFx0cm9vdC5mb3JtMmpzID0gZmFjdG9yeSgpO1xuXHR9XG59KSh1bmRlZmluZWQsIGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0LyoqXHJcbiAgKiBSZXR1cm5zIGZvcm0gdmFsdWVzIHJlcHJlc2VudGVkIGFzIEphdmFzY3JpcHQgb2JqZWN0XHJcbiAgKiBcIm5hbWVcIiBhdHRyaWJ1dGUgZGVmaW5lcyBzdHJ1Y3R1cmUgb2YgcmVzdWx0aW5nIG9iamVjdFxyXG4gICpcclxuICAqIEBwYXJhbSByb290Tm9kZSB7RWxlbWVudHxTdHJpbmd9IHJvb3QgZm9ybSBlbGVtZW50IChvciBpdCdzIGlkKSBvciBhcnJheSBvZiByb290IGVsZW1lbnRzXHJcbiAgKiBAcGFyYW0gZGVsaW1pdGVyIHtTdHJpbmd9IHN0cnVjdHVyZSBwYXJ0cyBkZWxpbWl0ZXIgZGVmYXVsdHMgdG8gJy4nXHJcbiAgKiBAcGFyYW0gc2tpcEVtcHR5IHtCb29sZWFufSBzaG91bGQgc2tpcCBlbXB0eSB0ZXh0IHZhbHVlcywgZGVmYXVsdHMgdG8gdHJ1ZVxyXG4gICogQHBhcmFtIG5vZGVDYWxsYmFjayB7RnVuY3Rpb259IGN1c3RvbSBmdW5jdGlvbiB0byBnZXQgbm9kZSB2YWx1ZVxyXG4gICogQHBhcmFtIHVzZUlkSWZFbXB0eU5hbWUge0Jvb2xlYW59IGlmIHRydWUgdmFsdWUgb2YgaWQgYXR0cmlidXRlIG9mIGZpZWxkIHdpbGwgYmUgdXNlZCBpZiBuYW1lIG9mIGZpZWxkIGlzIGVtcHR5XHJcbiAgKi9cblx0ZnVuY3Rpb24gZm9ybTJqcyhyb290Tm9kZSwgZGVsaW1pdGVyLCBza2lwRW1wdHksIG5vZGVDYWxsYmFjaywgdXNlSWRJZkVtcHR5TmFtZSwgZ2V0RGlzYWJsZWQpIHtcblx0XHRnZXREaXNhYmxlZCA9IGdldERpc2FibGVkID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdGlmICh0eXBlb2Ygc2tpcEVtcHR5ID09ICd1bmRlZmluZWQnIHx8IHNraXBFbXB0eSA9PSBudWxsKSBza2lwRW1wdHkgPSB0cnVlO1xuXHRcdGlmICh0eXBlb2YgZGVsaW1pdGVyID09ICd1bmRlZmluZWQnIHx8IGRlbGltaXRlciA9PSBudWxsKSBkZWxpbWl0ZXIgPSAnLic7XG5cdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPCA1KSB1c2VJZElmRW1wdHlOYW1lID0gZmFsc2U7XG5cblx0XHRyb290Tm9kZSA9IHR5cGVvZiByb290Tm9kZSA9PSAnc3RyaW5nJyA/IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJvb3ROb2RlKSA6IHJvb3ROb2RlO1xuXG5cdFx0dmFyIGZvcm1WYWx1ZXMgPSBbXSxcblx0XHQgICAgY3Vyck5vZGUsXG5cdFx0ICAgIGkgPSAwO1xuXG5cdFx0LyogSWYgcm9vdE5vZGUgaXMgYXJyYXkgLSBjb21iaW5lIHZhbHVlcyAqL1xuXHRcdGlmIChyb290Tm9kZS5jb25zdHJ1Y3RvciA9PSBBcnJheSB8fCB0eXBlb2YgTm9kZUxpc3QgIT0gXCJ1bmRlZmluZWRcIiAmJiByb290Tm9kZS5jb25zdHJ1Y3RvciA9PSBOb2RlTGlzdCkge1xuXHRcdFx0d2hpbGUgKGN1cnJOb2RlID0gcm9vdE5vZGVbaSsrXSkge1xuXHRcdFx0XHRmb3JtVmFsdWVzID0gZm9ybVZhbHVlcy5jb25jYXQoZ2V0Rm9ybVZhbHVlcyhjdXJyTm9kZSwgbm9kZUNhbGxiYWNrLCB1c2VJZElmRW1wdHlOYW1lLCBnZXREaXNhYmxlZCkpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb3JtVmFsdWVzID0gZ2V0Rm9ybVZhbHVlcyhyb290Tm9kZSwgbm9kZUNhbGxiYWNrLCB1c2VJZElmRW1wdHlOYW1lLCBnZXREaXNhYmxlZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByb2Nlc3NOYW1lVmFsdWVzKGZvcm1WYWx1ZXMsIHNraXBFbXB0eSwgZGVsaW1pdGVyKTtcblx0fVxuXG5cdC8qKlxyXG4gICogUHJvY2Vzc2VzIGNvbGxlY3Rpb24gb2YgeyBuYW1lOiAnbmFtZScsIHZhbHVlOiAndmFsdWUnIH0gb2JqZWN0cy5cclxuICAqIEBwYXJhbSBuYW1lVmFsdWVzXHJcbiAgKiBAcGFyYW0gc2tpcEVtcHR5IGlmIHRydWUgc2tpcHMgZWxlbWVudHMgd2l0aCB2YWx1ZSA9PSAnJyBvciB2YWx1ZSA9PSBudWxsXHJcbiAgKiBAcGFyYW0gZGVsaW1pdGVyXHJcbiAgKi9cblx0ZnVuY3Rpb24gcHJvY2Vzc05hbWVWYWx1ZXMobmFtZVZhbHVlcywgc2tpcEVtcHR5LCBkZWxpbWl0ZXIpIHtcblx0XHR2YXIgcmVzdWx0ID0ge30sXG5cdFx0ICAgIGFycmF5cyA9IHt9LFxuXHRcdCAgICBpLFxuXHRcdCAgICBqLFxuXHRcdCAgICBrLFxuXHRcdCAgICBsLFxuXHRcdCAgICB2YWx1ZSxcblx0XHQgICAgbmFtZVBhcnRzLFxuXHRcdCAgICBjdXJyUmVzdWx0LFxuXHRcdCAgICBhcnJOYW1lRnVsbCxcblx0XHQgICAgYXJyTmFtZSxcblx0XHQgICAgYXJySWR4LFxuXHRcdCAgICBuYW1lUGFydCxcblx0XHQgICAgbmFtZSxcblx0XHQgICAgX25hbWVQYXJ0cztcblxuXHRcdGZvciAoaSA9IDA7IGkgPCBuYW1lVmFsdWVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR2YWx1ZSA9IG5hbWVWYWx1ZXNbaV0udmFsdWU7XG5cblx0XHRcdGlmIChza2lwRW1wdHkgJiYgKHZhbHVlID09PSAnJyB8fCB2YWx1ZSA9PT0gbnVsbCkpIGNvbnRpbnVlO1xuXG5cdFx0XHRuYW1lID0gbmFtZVZhbHVlc1tpXS5uYW1lO1xuXHRcdFx0X25hbWVQYXJ0cyA9IG5hbWUuc3BsaXQoZGVsaW1pdGVyKTtcblx0XHRcdG5hbWVQYXJ0cyA9IFtdO1xuXHRcdFx0Y3VyclJlc3VsdCA9IHJlc3VsdDtcblx0XHRcdGFyck5hbWVGdWxsID0gJyc7XG5cblx0XHRcdGZvciAoaiA9IDA7IGogPCBfbmFtZVBhcnRzLmxlbmd0aDsgaisrKSB7XG5cdFx0XHRcdG5hbWVQYXJ0ID0gX25hbWVQYXJ0c1tqXS5zcGxpdCgnXVsnKTtcblx0XHRcdFx0aWYgKG5hbWVQYXJ0Lmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0XHRmb3IgKGsgPSAwOyBrIDwgbmFtZVBhcnQubGVuZ3RoOyBrKyspIHtcblx0XHRcdFx0XHRcdGlmIChrID09IDApIHtcblx0XHRcdFx0XHRcdFx0bmFtZVBhcnRba10gPSBuYW1lUGFydFtrXSArICddJztcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoayA9PSBuYW1lUGFydC5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0XHRcdG5hbWVQYXJ0W2tdID0gJ1snICsgbmFtZVBhcnRba107XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRuYW1lUGFydFtrXSA9ICdbJyArIG5hbWVQYXJ0W2tdICsgJ10nO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRhcnJJZHggPSBuYW1lUGFydFtrXS5tYXRjaCgvKFthLXpfXSspP1xcWyhbYS16X11bYS16MC05X10rPylcXF0vaSk7XG5cdFx0XHRcdFx0XHRpZiAoYXJySWR4KSB7XG5cdFx0XHRcdFx0XHRcdGZvciAobCA9IDE7IGwgPCBhcnJJZHgubGVuZ3RoOyBsKyspIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYXJySWR4W2xdKSBuYW1lUGFydHMucHVzaChhcnJJZHhbbF0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRuYW1lUGFydHMucHVzaChuYW1lUGFydFtrXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgbmFtZVBhcnRzID0gbmFtZVBhcnRzLmNvbmNhdChuYW1lUGFydCk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoaiA9IDA7IGogPCBuYW1lUGFydHMubGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0bmFtZVBhcnQgPSBuYW1lUGFydHNbal07XG5cblx0XHRcdFx0aWYgKG5hbWVQYXJ0LmluZGV4T2YoJ1tdJykgPiAtMSAmJiBqID09IG5hbWVQYXJ0cy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0YXJyTmFtZSA9IG5hbWVQYXJ0LnN1YnN0cigwLCBuYW1lUGFydC5pbmRleE9mKCdbJykpO1xuXHRcdFx0XHRcdGFyck5hbWVGdWxsICs9IGFyck5hbWU7XG5cblx0XHRcdFx0XHRpZiAoIWN1cnJSZXN1bHRbYXJyTmFtZV0pIGN1cnJSZXN1bHRbYXJyTmFtZV0gPSBbXTtcblx0XHRcdFx0XHRjdXJyUmVzdWx0W2Fyck5hbWVdLnB1c2godmFsdWUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG5hbWVQYXJ0LmluZGV4T2YoJ1snKSA+IC0xKSB7XG5cdFx0XHRcdFx0YXJyTmFtZSA9IG5hbWVQYXJ0LnN1YnN0cigwLCBuYW1lUGFydC5pbmRleE9mKCdbJykpO1xuXHRcdFx0XHRcdGFycklkeCA9IG5hbWVQYXJ0LnJlcGxhY2UoLyheKFthLXpfXSspP1xcWyl8KFxcXSQpL2dpLCAnJyk7XG5cblx0XHRcdFx0XHQvKiBVbmlxdWUgYXJyYXkgbmFtZSAqL1xuXHRcdFx0XHRcdGFyck5hbWVGdWxsICs9ICdfJyArIGFyck5hbWUgKyAnXycgKyBhcnJJZHg7XG5cblx0XHRcdFx0XHQvKlxyXG4gICAgICAqIEJlY2F1c2UgYXJySWR4IGluIGZpZWxkIG5hbWUgY2FuIGJlIG5vdCB6ZXJvLWJhc2VkIGFuZCBzdGVwIGNhbiBiZVxyXG4gICAgICAqIG90aGVyIHRoYW4gMSwgd2UgY2FuJ3QgdXNlIHRoZW0gaW4gdGFyZ2V0IGFycmF5IGRpcmVjdGx5LlxyXG4gICAgICAqIEluc3RlYWQgd2UncmUgbWFraW5nIGEgaGFzaCB3aGVyZSBrZXkgaXMgYXJySWR4IGFuZCB2YWx1ZSBpcyBhIHJlZmVyZW5jZSB0b1xyXG4gICAgICAqIGFkZGVkIGFycmF5IGVsZW1lbnRcclxuICAgICAgKi9cblxuXHRcdFx0XHRcdGlmICghYXJyYXlzW2Fyck5hbWVGdWxsXSkgYXJyYXlzW2Fyck5hbWVGdWxsXSA9IHt9O1xuXHRcdFx0XHRcdGlmIChhcnJOYW1lICE9ICcnICYmICFjdXJyUmVzdWx0W2Fyck5hbWVdKSBjdXJyUmVzdWx0W2Fyck5hbWVdID0gW107XG5cblx0XHRcdFx0XHRpZiAoaiA9PSBuYW1lUGFydHMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0aWYgKGFyck5hbWUgPT0gJycpIHtcblx0XHRcdFx0XHRcdFx0Y3VyclJlc3VsdC5wdXNoKHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0YXJyYXlzW2Fyck5hbWVGdWxsXVthcnJJZHhdID0gY3VyclJlc3VsdFtjdXJyUmVzdWx0Lmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y3VyclJlc3VsdFthcnJOYW1lXS5wdXNoKHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0YXJyYXlzW2Fyck5hbWVGdWxsXVthcnJJZHhdID0gY3VyclJlc3VsdFthcnJOYW1lXVtjdXJyUmVzdWx0W2Fyck5hbWVdLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZiAoIWFycmF5c1thcnJOYW1lRnVsbF1bYXJySWR4XSkge1xuXHRcdFx0XHRcdFx0XHRpZiAoL15bMC05YS16X10rXFxbPy9pLnRlc3QobmFtZVBhcnRzW2ogKyAxXSkpIGN1cnJSZXN1bHRbYXJyTmFtZV0ucHVzaCh7fSk7ZWxzZSBjdXJyUmVzdWx0W2Fyck5hbWVdLnB1c2goW10pO1xuXG5cdFx0XHRcdFx0XHRcdGFycmF5c1thcnJOYW1lRnVsbF1bYXJySWR4XSA9IGN1cnJSZXN1bHRbYXJyTmFtZV1bY3VyclJlc3VsdFthcnJOYW1lXS5sZW5ndGggLSAxXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjdXJyUmVzdWx0ID0gYXJyYXlzW2Fyck5hbWVGdWxsXVthcnJJZHhdO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFyck5hbWVGdWxsICs9IG5hbWVQYXJ0O1xuXG5cdFx0XHRcdFx0aWYgKGogPCBuYW1lUGFydHMubGVuZ3RoIC0gMSkgLyogTm90IHRoZSBsYXN0IHBhcnQgb2YgbmFtZSAtIG1lYW5zIG9iamVjdCAqL1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRpZiAoIWN1cnJSZXN1bHRbbmFtZVBhcnRdKSBjdXJyUmVzdWx0W25hbWVQYXJ0XSA9IHt9O1xuXHRcdFx0XHRcdFx0XHRjdXJyUmVzdWx0ID0gY3VyclJlc3VsdFtuYW1lUGFydF07XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y3VyclJlc3VsdFtuYW1lUGFydF0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Rm9ybVZhbHVlcyhyb290Tm9kZSwgbm9kZUNhbGxiYWNrLCB1c2VJZElmRW1wdHlOYW1lLCBnZXREaXNhYmxlZCkge1xuXHRcdHZhciByZXN1bHQgPSBleHRyYWN0Tm9kZVZhbHVlcyhyb290Tm9kZSwgbm9kZUNhbGxiYWNrLCB1c2VJZElmRW1wdHlOYW1lLCBnZXREaXNhYmxlZCk7XG5cdFx0cmV0dXJuIHJlc3VsdC5sZW5ndGggPiAwID8gcmVzdWx0IDogZ2V0U3ViRm9ybVZhbHVlcyhyb290Tm9kZSwgbm9kZUNhbGxiYWNrLCB1c2VJZElmRW1wdHlOYW1lLCBnZXREaXNhYmxlZCk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRTdWJGb3JtVmFsdWVzKHJvb3ROb2RlLCBub2RlQ2FsbGJhY2ssIHVzZUlkSWZFbXB0eU5hbWUsIGdldERpc2FibGVkKSB7XG5cdFx0dmFyIHJlc3VsdCA9IFtdLFxuXHRcdCAgICBjdXJyZW50Tm9kZSA9IHJvb3ROb2RlLmZpcnN0Q2hpbGQ7XG5cblx0XHR3aGlsZSAoY3VycmVudE5vZGUpIHtcblx0XHRcdHJlc3VsdCA9IHJlc3VsdC5jb25jYXQoZXh0cmFjdE5vZGVWYWx1ZXMoY3VycmVudE5vZGUsIG5vZGVDYWxsYmFjaywgdXNlSWRJZkVtcHR5TmFtZSwgZ2V0RGlzYWJsZWQpKTtcblx0XHRcdGN1cnJlbnROb2RlID0gY3VycmVudE5vZGUubmV4dFNpYmxpbmc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGZ1bmN0aW9uIGV4dHJhY3ROb2RlVmFsdWVzKG5vZGUsIG5vZGVDYWxsYmFjaywgdXNlSWRJZkVtcHR5TmFtZSwgZ2V0RGlzYWJsZWQpIHtcblx0XHRpZiAobm9kZS5kaXNhYmxlZCAmJiAhZ2V0RGlzYWJsZWQpIHJldHVybiBbXTtcblxuXHRcdHZhciBjYWxsYmFja1Jlc3VsdCxcblx0XHQgICAgZmllbGRWYWx1ZSxcblx0XHQgICAgcmVzdWx0LFxuXHRcdCAgICBmaWVsZE5hbWUgPSBnZXRGaWVsZE5hbWUobm9kZSwgdXNlSWRJZkVtcHR5TmFtZSk7XG5cblx0XHRjYWxsYmFja1Jlc3VsdCA9IG5vZGVDYWxsYmFjayAmJiBub2RlQ2FsbGJhY2sobm9kZSk7XG5cblx0XHRpZiAoY2FsbGJhY2tSZXN1bHQgJiYgY2FsbGJhY2tSZXN1bHQubmFtZSkge1xuXHRcdFx0cmVzdWx0ID0gW2NhbGxiYWNrUmVzdWx0XTtcblx0XHR9IGVsc2UgaWYgKGZpZWxkTmFtZSAhPSAnJyAmJiBub2RlLm5vZGVOYW1lLm1hdGNoKC9JTlBVVHxURVhUQVJFQS9pKSkge1xuXHRcdFx0ZmllbGRWYWx1ZSA9IGdldEZpZWxkVmFsdWUobm9kZSwgZ2V0RGlzYWJsZWQpO1xuXHRcdFx0aWYgKG51bGwgPT09IGZpZWxkVmFsdWUpIHtcblx0XHRcdFx0cmVzdWx0ID0gW107XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQgPSBbeyBuYW1lOiBmaWVsZE5hbWUsIHZhbHVlOiBmaWVsZFZhbHVlIH1dO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoZmllbGROYW1lICE9ICcnICYmIG5vZGUubm9kZU5hbWUubWF0Y2goL1NFTEVDVC9pKSkge1xuXHRcdFx0ZmllbGRWYWx1ZSA9IGdldEZpZWxkVmFsdWUobm9kZSwgZ2V0RGlzYWJsZWQpO1xuXHRcdFx0cmVzdWx0ID0gW3sgbmFtZTogZmllbGROYW1lLnJlcGxhY2UoL1xcW1xcXSQvLCAnJyksIHZhbHVlOiBmaWVsZFZhbHVlIH1dO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQgPSBnZXRTdWJGb3JtVmFsdWVzKG5vZGUsIG5vZGVDYWxsYmFjaywgdXNlSWRJZkVtcHR5TmFtZSwgZ2V0RGlzYWJsZWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRGaWVsZE5hbWUobm9kZSwgdXNlSWRJZkVtcHR5TmFtZSkge1xuXHRcdGlmIChub2RlLm5hbWUgJiYgbm9kZS5uYW1lICE9ICcnKSByZXR1cm4gbm9kZS5uYW1lO2Vsc2UgaWYgKHVzZUlkSWZFbXB0eU5hbWUgJiYgbm9kZS5pZCAmJiBub2RlLmlkICE9ICcnKSByZXR1cm4gbm9kZS5pZDtlbHNlIHJldHVybiAnJztcblx0fVxuXG5cdGZ1bmN0aW9uIGdldEZpZWxkVmFsdWUoZmllbGROb2RlLCBnZXREaXNhYmxlZCkge1xuXHRcdGlmIChmaWVsZE5vZGUuZGlzYWJsZWQgJiYgIWdldERpc2FibGVkKSByZXR1cm4gbnVsbDtcblxuXHRcdHN3aXRjaCAoZmllbGROb2RlLm5vZGVOYW1lKSB7XG5cdFx0XHRjYXNlICdJTlBVVCc6XG5cdFx0XHRjYXNlICdURVhUQVJFQSc6XG5cdFx0XHRcdHN3aXRjaCAoZmllbGROb2RlLnR5cGUudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0XHRcdGNhc2UgJ3JhZGlvJzpcblx0XHRcdFx0XHRcdGlmIChmaWVsZE5vZGUuY2hlY2tlZCAmJiBmaWVsZE5vZGUudmFsdWUgPT09IFwiZmFsc2VcIikgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdGNhc2UgJ2NoZWNrYm94Jzpcblx0XHRcdFx0XHRcdGlmIChmaWVsZE5vZGUuY2hlY2tlZCAmJiBmaWVsZE5vZGUudmFsdWUgPT09IFwidHJ1ZVwiKSByZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdGlmICghZmllbGROb2RlLmNoZWNrZWQgJiYgZmllbGROb2RlLnZhbHVlID09PSBcInRydWVcIikgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0aWYgKGZpZWxkTm9kZS5jaGVja2VkKSByZXR1cm4gZmllbGROb2RlLnZhbHVlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0XHRjYXNlICdidXR0b24nOlxuXHRcdFx0XHRcdGNhc2UgJ3Jlc2V0Jzpcblx0XHRcdFx0XHRjYXNlICdzdWJtaXQnOlxuXHRcdFx0XHRcdGNhc2UgJ2ltYWdlJzpcblx0XHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdHJldHVybiBmaWVsZE5vZGUudmFsdWU7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSAnU0VMRUNUJzpcblx0XHRcdFx0cmV0dXJuIGdldFNlbGVjdGVkT3B0aW9uVmFsdWUoZmllbGROb2RlKTtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0U2VsZWN0ZWRPcHRpb25WYWx1ZShzZWxlY3ROb2RlKSB7XG5cdFx0dmFyIG11bHRpcGxlID0gc2VsZWN0Tm9kZS5tdWx0aXBsZSxcblx0XHQgICAgcmVzdWx0ID0gW10sXG5cdFx0ICAgIG9wdGlvbnMsXG5cdFx0ICAgIGksXG5cdFx0ICAgIGw7XG5cblx0XHRpZiAoIW11bHRpcGxlKSByZXR1cm4gc2VsZWN0Tm9kZS52YWx1ZTtcblxuXHRcdGZvciAob3B0aW9ucyA9IHNlbGVjdE5vZGUuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJvcHRpb25cIiksIGkgPSAwLCBsID0gb3B0aW9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0XHRcdGlmIChvcHRpb25zW2ldLnNlbGVjdGVkKSByZXN1bHQucHVzaChvcHRpb25zW2ldLnZhbHVlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cmV0dXJuIGZvcm0yanM7XG59KTsiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5cbnZhciBfY3JlYXRlRGVjb3JhdGVkQ2xhc3MgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgZGVzY3JpcHRvcnMsIGluaXRpYWxpemVycykgeyBmb3IgKHZhciBpID0gMDsgaSA8IGRlc2NyaXB0b3JzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvcnNbaV07IHZhciBkZWNvcmF0b3JzID0gZGVzY3JpcHRvci5kZWNvcmF0b3JzOyB2YXIga2V5ID0gZGVzY3JpcHRvci5rZXk7IGRlbGV0ZSBkZXNjcmlwdG9yLmtleTsgZGVsZXRlIGRlc2NyaXB0b3IuZGVjb3JhdG9yczsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmICgndmFsdWUnIGluIGRlc2NyaXB0b3IgfHwgZGVzY3JpcHRvci5pbml0aWFsaXplcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IGlmIChkZWNvcmF0b3JzKSB7IGZvciAodmFyIGYgPSAwOyBmIDwgZGVjb3JhdG9ycy5sZW5ndGg7IGYrKykgeyB2YXIgZGVjb3JhdG9yID0gZGVjb3JhdG9yc1tmXTsgaWYgKHR5cGVvZiBkZWNvcmF0b3IgPT09ICdmdW5jdGlvbicpIHsgZGVzY3JpcHRvciA9IGRlY29yYXRvcih0YXJnZXQsIGtleSwgZGVzY3JpcHRvcikgfHwgZGVzY3JpcHRvcjsgfSBlbHNlIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIGRlY29yYXRvciBmb3IgbWV0aG9kICcgKyBkZXNjcmlwdG9yLmtleSArICcgaXMgb2YgdGhlIGludmFsaWQgdHlwZSAnICsgdHlwZW9mIGRlY29yYXRvcik7IH0gfSBpZiAoZGVzY3JpcHRvci5pbml0aWFsaXplciAhPT0gdW5kZWZpbmVkKSB7IGluaXRpYWxpemVyc1trZXldID0gZGVzY3JpcHRvcjsgY29udGludWU7IH0gfSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMsIHByb3RvSW5pdGlhbGl6ZXJzLCBzdGF0aWNJbml0aWFsaXplcnMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzLCBwcm90b0luaXRpYWxpemVycyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMsIHN0YXRpY0luaXRpYWxpemVycyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gJ2Z1bmN0aW9uJyAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ1N1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgJyArIHR5cGVvZiBzdXBlckNsYXNzKTsgfSBzdWJDbGFzcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MgJiYgc3VwZXJDbGFzcy5wcm90b3R5cGUsIHsgY29uc3RydWN0b3I6IHsgdmFsdWU6IHN1YkNsYXNzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9IH0pOyBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7IH1cblxudmFyIF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24gPSByZXF1aXJlKCcuLi8uLi9saWJzL2hlbHBlcnMvZXhvc2tlbGVzc3RvbicpO1xuXG52YXIgX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3RvbjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24pO1xuXG52YXIgX2xpYnNIZWxwZXJzU3RyaW5nID0gcmVxdWlyZSgnLi4vLi4vbGlicy9oZWxwZXJzL3N0cmluZycpO1xuXG52YXIgX2l0ZW1zRm9ybVNjaGVtYUl0ZW1GYWN0b3J5ID0gcmVxdWlyZSgnLi9pdGVtcy9mb3JtLXNjaGVtYS1pdGVtLWZhY3RvcnknKTtcblxudmFyIF9pdGVtc0Zvcm1TY2hlbWFJdGVtRmFjdG9yeTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9pdGVtc0Zvcm1TY2hlbWFJdGVtRmFjdG9yeSk7XG5cbnZhciBfbGlic1ZlbmRvckZvcm0yanMgPSByZXF1aXJlKCcuLi8uLi9saWJzL3ZlbmRvci9mb3JtMmpzJyk7XG5cbnZhciBfbGlic1ZlbmRvckZvcm0yanMyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfbGlic1ZlbmRvckZvcm0yanMpO1xuXG52YXIgRm9ybVNjaGVtYVZpZXcgPSAoZnVuY3Rpb24gKF9FeG9za2VsZXRvbiRWaWV3KSB7XG5cdF9pbmhlcml0cyhGb3JtU2NoZW1hVmlldywgX0V4b3NrZWxldG9uJFZpZXcpO1xuXG5cdGZ1bmN0aW9uIEZvcm1TY2hlbWFWaWV3KCkge1xuXHRcdF9jbGFzc0NhbGxDaGVjayh0aGlzLCBfRm9ybVNjaGVtYVZpZXcpO1xuXG5cdFx0X0V4b3NrZWxldG9uJFZpZXcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0fVxuXG5cdEZvcm1TY2hlbWFWaWV3LnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcblx0XHR2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0fTtcblxuXHRGb3JtU2NoZW1hVmlldy5wcm90b3R5cGUuYWRkU3VibWl0ID0gZnVuY3Rpb24gYWRkU3VibWl0KCkge1xuXG5cdFx0aWYgKCF0aGlzLmVsLnF1ZXJ5U2VsZWN0b3IoJ1t0eXBlPVwic3VibWl0XCJdJykpIHtcblxuXHRcdFx0dmFyIHN1Ym1pdEJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRcdFx0c3VibWl0QnV0dG9uLnNldEF0dHJpYnV0ZSgndHlwZScsICdzdWJtaXQnKTtcblx0XHRcdC8vIEB0b2RvIGkxOG4vbDEwblxuXHRcdFx0c3VibWl0QnV0dG9uLmlubmVySFRNTCA9ICdPSyc7XG5cdFx0XHR0aGlzLmVsLmFwcGVuZENoaWxkKHN1Ym1pdEJ1dHRvbik7XG5cdFx0fVxuXHR9O1xuXG5cdEZvcm1TY2hlbWFWaWV3LnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbiBzZXJpYWxpemUoKSB7fTtcblxuXHRGb3JtU2NoZW1hVmlldy5wcm90b3R5cGUuYWRkT25lID0gZnVuY3Rpb24gYWRkT25lKG5hbWUsIHByb3BlcnR5KSB7XG5cdFx0dmFyIEl0ZW1WaWV3ID0gX2l0ZW1zRm9ybVNjaGVtYUl0ZW1GYWN0b3J5MlsnZGVmYXVsdCddLmNyZWF0ZShwcm9wZXJ0eS50eXBlKTtcblx0XHR2YXIgdmlldyA9IG5ldyBJdGVtVmlldyh7XG5cdFx0XHRkYXRhOiB7XG5cdFx0XHRcdG5hbWU6IG5hbWUsXG5cdFx0XHRcdHByb3BlcnRpZXM6IHByb3BlcnR5XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBAdG9kbyBpbXBsZW1lbnQgYXBwZW5kQ2hpbGQgaWYgd3JhcHBlciBpcyBwcmVzZW50XG5cdFx0Ly8gd3JhcHBlclZpZXcuYXBwZW5kQ2hpbGQoLi4uKTtcblx0XHR0aGlzLmVsLmFwcGVuZENoaWxkKHZpZXcucmVuZGVyKCkuZWwpO1xuXHR9O1xuXG5cdEZvcm1TY2hlbWFWaWV3LnByb3RvdHlwZS5hZGRBbGwgPSBmdW5jdGlvbiBhZGRBbGwoKSB7XG5cblx0XHR2YXIgcHJvcGVydGllcyA9IHRoaXMub3B0aW9ucy5kYXRhLnByb3BlcnRpZXM7XG5cblx0XHRmb3IgKHZhciBrZXkgaW4gcHJvcGVydGllcykge1xuXG5cdFx0XHRpZiAocHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRcdHRoaXMuYWRkT25lKGtleSwgcHJvcGVydGllc1trZXldKTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0Rm9ybVNjaGVtYVZpZXcucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcigpIHtcblxuXHRcdHRoaXMuZWwuc2V0QXR0cmlidXRlKCdtZXRob2QnLCB0aGlzLm9wdGlvbnMubWV0aG9kKTtcblx0XHR0aGlzLmVsLnNldEF0dHJpYnV0ZSgnYWN0aW9uJywgdGhpcy5vcHRpb25zLmFjdGlvbik7XG5cblx0XHR0aGlzLmFkZEFsbCgpO1xuXHRcdHRoaXMuYWRkU3VibWl0KCk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0X2NyZWF0ZURlY29yYXRlZENsYXNzKEZvcm1TY2hlbWFWaWV3LCBbe1xuXHRcdGtleTogJ3N1Ym1pdEJ1dHRvbkNsaWNrJyxcblx0XHRkZWNvcmF0b3JzOiBbX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3Rvbi5vbignY2xpY2sgW3R5cGU9XCJzdWJtaXRcIl0nKV0sXG5cdFx0dmFsdWU6IGZ1bmN0aW9uIHN1Ym1pdEJ1dHRvbkNsaWNrKGV2dCkge1xuXHRcdFx0Y29uc29sZS5sb2codGhpcyArICcuc3VibWl0QnV0dG9uQ2xpY2soKScpO1xuXHRcdH1cblx0fSwge1xuXHRcdGtleTogJ3N1Ym1pdCcsXG5cdFx0ZGVjb3JhdG9yczogW19saWJzSGVscGVyc0V4b3NrZWxlc3N0b24ub24oJ3N1Ym1pdCcpXSxcblx0XHR2YWx1ZTogZnVuY3Rpb24gc3VibWl0KGV2dCkge1xuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRjb25zb2xlLmxvZyh0aGlzICsgJy5zdWJtaXQoKScsICcnICsgSlNPTi5zdHJpbmdpZnkoX2xpYnNWZW5kb3JGb3JtMmpzMlsnZGVmYXVsdCddKHRoaXMuZWwpKSk7XG5cdFx0fVxuXHR9XSk7XG5cblx0dmFyIF9Gb3JtU2NoZW1hVmlldyA9IEZvcm1TY2hlbWFWaWV3O1xuXHRGb3JtU2NoZW1hVmlldyA9IF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24udGFnTmFtZSgnZm9ybScpKEZvcm1TY2hlbWFWaWV3KSB8fCBGb3JtU2NoZW1hVmlldztcblx0Rm9ybVNjaGVtYVZpZXcgPSBfbGlic0hlbHBlcnNFeG9za2VsZXNzdG9uLmlkKCdmcm1sbC0nICsgX2xpYnNIZWxwZXJzU3RyaW5nLmNyZWF0ZVVJRCgpKShGb3JtU2NoZW1hVmlldykgfHwgRm9ybVNjaGVtYVZpZXc7XG5cdEZvcm1TY2hlbWFWaWV3ID0gX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3Rvbi5uYW1lKCdGb3JtU2NoZW1hVmlldycpKEZvcm1TY2hlbWFWaWV3KSB8fCBGb3JtU2NoZW1hVmlldztcblx0cmV0dXJuIEZvcm1TY2hlbWFWaWV3O1xufSkoX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3RvbjJbJ2RlZmF1bHQnXS5WaWV3KTtcblxuO1xuXG5leHBvcnRzWydkZWZhdWx0J10gPSBGb3JtU2NoZW1hVmlldztcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1snZGVmYXVsdCddOyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gJ2Z1bmN0aW9uJyAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ1N1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgJyArIHR5cGVvZiBzdXBlckNsYXNzKTsgfSBzdWJDbGFzcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MgJiYgc3VwZXJDbGFzcy5wcm90b3R5cGUsIHsgY29uc3RydWN0b3I6IHsgdmFsdWU6IHN1YkNsYXNzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9IH0pOyBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7IH1cblxudmFyIF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24gPSByZXF1aXJlKCcuLi8uLi8uLi9saWJzL2hlbHBlcnMvZXhvc2tlbGVzc3RvbicpO1xuXG52YXIgX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3RvbjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24pO1xuXG52YXIgRm9ybVNjaGVtYUJhc2VWaWV3ID0gKGZ1bmN0aW9uIChfRXhvc2tlbGV0b24kVmlldykge1xuXHRfaW5oZXJpdHMoRm9ybVNjaGVtYUJhc2VWaWV3LCBfRXhvc2tlbGV0b24kVmlldyk7XG5cblx0ZnVuY3Rpb24gRm9ybVNjaGVtYUJhc2VWaWV3KCkge1xuXHRcdF9jbGFzc0NhbGxDaGVjayh0aGlzLCBfRm9ybVNjaGVtYUJhc2VWaWV3KTtcblxuXHRcdF9FeG9za2VsZXRvbiRWaWV3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdH1cblxuXHRGb3JtU2NoZW1hQmFzZVZpZXcucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuXHRcdHZhciBvcHRpb25zID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8ge30gOiBhcmd1bWVudHNbMF07XG5cblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdHRoaXMuZGF0YSA9IG9wdGlvbnMuZGF0YTtcblx0XHR0aGlzLnByb3BzID0gb3B0aW9ucy5kYXRhLnByb3BlcnRpZXM7XG5cblx0XHR0aGlzLmVsLm5hbWUgPSB0aGlzLmRhdGEubmFtZTtcblxuXHRcdGlmICh0aGlzLnByb3BzLnJlcXVpcmVkKSB7XG5cdFx0XHR0aGlzLmVsLnNldEF0dHJpYnV0ZSgncmVxdWlyZWQnLCAncmVxdWlyZWQnKTtcblx0XHR9XG5cdH07XG5cblx0Rm9ybVNjaGVtYUJhc2VWaWV3LnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIoKSB7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fTtcblxuXHR2YXIgX0Zvcm1TY2hlbWFCYXNlVmlldyA9IEZvcm1TY2hlbWFCYXNlVmlldztcblx0Rm9ybVNjaGVtYUJhc2VWaWV3ID0gX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3Rvbi5uYW1lKCdpdGVtcy9Gb3JtU2NoZW1hQmFzZVZpZXcnKShGb3JtU2NoZW1hQmFzZVZpZXcpIHx8IEZvcm1TY2hlbWFCYXNlVmlldztcblx0cmV0dXJuIEZvcm1TY2hlbWFCYXNlVmlldztcbn0pKF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24yWydkZWZhdWx0J10uVmlldyk7XG5cbjtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gRm9ybVNjaGVtYUJhc2VWaWV3O1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzWydkZWZhdWx0J107IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuXG52YXIgX2NyZWF0ZUNsYXNzID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmICgndmFsdWUnIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KSgpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyAnZGVmYXVsdCc6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG52YXIgX2Zvcm1TY2hlbWFTdHJpbmdWaWV3ID0gcmVxdWlyZSgnLi9mb3JtLXNjaGVtYS1zdHJpbmctdmlldycpO1xuXG52YXIgX2Zvcm1TY2hlbWFTdHJpbmdWaWV3MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2Zvcm1TY2hlbWFTdHJpbmdWaWV3KTtcblxudmFyIEZvcm1TY2hlbWFJdGVtRmFjdG9yeSA9IChmdW5jdGlvbiAoKSB7XG5cdGZ1bmN0aW9uIEZvcm1TY2hlbWFJdGVtRmFjdG9yeSgpIHtcblx0XHRfY2xhc3NDYWxsQ2hlY2sodGhpcywgRm9ybVNjaGVtYUl0ZW1GYWN0b3J5KTtcblx0fVxuXG5cdEZvcm1TY2hlbWFJdGVtRmFjdG9yeS5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKHR5cGUpIHtcblxuXHRcdGlmICh0aGlzLnR5cGVzTWFwcGluZ1t0eXBlXSkge1xuXG5cdFx0XHRyZXR1cm4gdGhpcy50eXBlc01hcHBpbmdbdHlwZV07XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdUeXBlICcgKyB0eXBlICsgJyBpcyBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH07XG5cblx0X2NyZWF0ZUNsYXNzKEZvcm1TY2hlbWFJdGVtRmFjdG9yeSwgW3tcblx0XHRrZXk6ICd0eXBlc01hcHBpbmcnLFxuXHRcdGdldDogZnVuY3Rpb24gZ2V0KCkge1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzdHJpbmc6IF9mb3JtU2NoZW1hU3RyaW5nVmlldzJbJ2RlZmF1bHQnXVxuXHRcdFx0fTtcblx0XHR9XG5cdH1dKTtcblxuXHRyZXR1cm4gRm9ybVNjaGVtYUl0ZW1GYWN0b3J5O1xufSkoKTtcblxudmFyIGZvcm1TY2hlbWFJdGVtRmFjdG9yeSA9IG5ldyBGb3JtU2NoZW1hSXRlbUZhY3RvcnkoKTtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gZm9ybVNjaGVtYUl0ZW1GYWN0b3J5O1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzWydkZWZhdWx0J107IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyAnZGVmYXVsdCc6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG5mdW5jdGlvbiBfaW5oZXJpdHMoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIHsgaWYgKHR5cGVvZiBzdXBlckNsYXNzICE9PSAnZnVuY3Rpb24nICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCAnICsgdHlwZW9mIHN1cGVyQ2xhc3MpOyB9IHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwgeyBjb25zdHJ1Y3RvcjogeyB2YWx1ZTogc3ViQ2xhc3MsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH0gfSk7IGlmIChzdXBlckNsYXNzKSBPYmplY3Quc2V0UHJvdG90eXBlT2YgPyBPYmplY3Quc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIDogc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzczsgfVxuXG52YXIgX2Zvcm1TY2hlbWFCYXNlVmlldyA9IHJlcXVpcmUoJy4vZm9ybS1zY2hlbWEtYmFzZS12aWV3Jyk7XG5cbnZhciBfZm9ybVNjaGVtYUJhc2VWaWV3MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2Zvcm1TY2hlbWFCYXNlVmlldyk7XG5cbnZhciBfbGlic0hlbHBlcnNFeG9za2VsZXNzdG9uID0gcmVxdWlyZSgnLi4vLi4vLi4vbGlicy9oZWxwZXJzL2V4b3NrZWxlc3N0b24nKTtcblxudmFyIEZvcm1TY2hlbWFTdHJpbmdWaWV3ID0gKGZ1bmN0aW9uIChfRm9ybVNjaGVtYUJhc2VWaWV3KSB7XG5cdF9pbmhlcml0cyhGb3JtU2NoZW1hU3RyaW5nVmlldywgX0Zvcm1TY2hlbWFCYXNlVmlldyk7XG5cblx0ZnVuY3Rpb24gRm9ybVNjaGVtYVN0cmluZ1ZpZXcoKSB7XG5cdFx0X2NsYXNzQ2FsbENoZWNrKHRoaXMsIF9Gb3JtU2NoZW1hU3RyaW5nVmlldyk7XG5cblx0XHRfRm9ybVNjaGVtYUJhc2VWaWV3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdH1cblxuXHRGb3JtU2NoZW1hU3RyaW5nVmlldy5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uIGluaXRpYWxpemUoKSB7XG5cdFx0dmFyIG9wdGlvbnMgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1swXTtcblxuXHRcdF9Gb3JtU2NoZW1hQmFzZVZpZXcucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBvcHRpb25zKTtcblx0fTtcblxuXHRGb3JtU2NoZW1hU3RyaW5nVmlldy5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyKCkge1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0dmFyIF9Gb3JtU2NoZW1hU3RyaW5nVmlldyA9IEZvcm1TY2hlbWFTdHJpbmdWaWV3O1xuXHRGb3JtU2NoZW1hU3RyaW5nVmlldyA9IF9saWJzSGVscGVyc0V4b3NrZWxlc3N0b24udGFnTmFtZSgnaW5wdXQnKShGb3JtU2NoZW1hU3RyaW5nVmlldykgfHwgRm9ybVNjaGVtYVN0cmluZ1ZpZXc7XG5cdEZvcm1TY2hlbWFTdHJpbmdWaWV3ID0gX2xpYnNIZWxwZXJzRXhvc2tlbGVzc3Rvbi5uYW1lKCdpdGVtcy9Gb3JtU2NoZW1hU3RyaW5nVmlldycpKEZvcm1TY2hlbWFTdHJpbmdWaWV3KSB8fCBGb3JtU2NoZW1hU3RyaW5nVmlldztcblx0cmV0dXJuIEZvcm1TY2hlbWFTdHJpbmdWaWV3O1xufSkoX2Zvcm1TY2hlbWFCYXNlVmlldzJbJ2RlZmF1bHQnXSk7XG5cbjtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gRm9ybVNjaGVtYVN0cmluZ1ZpZXc7XG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbJ2RlZmF1bHQnXTsiXX0=
