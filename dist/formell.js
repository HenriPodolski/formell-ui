(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/create"), __esModule: true };
},{"core-js/library/fn/object/create":12}],2:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/define-property"), __esModule: true };
},{"core-js/library/fn/object/define-property":13}],3:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/get-own-property-descriptor"), __esModule: true };
},{"core-js/library/fn/object/get-own-property-descriptor":14}],4:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/get-own-property-names"), __esModule: true };
},{"core-js/library/fn/object/get-own-property-names":15}],5:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/set-prototype-of"), __esModule: true };
},{"core-js/library/fn/object/set-prototype-of":16}],6:[function(require,module,exports){
"use strict";

exports["default"] = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

exports.__esModule = true;
},{}],7:[function(require,module,exports){
"use strict";

var _Object$defineProperty = require("babel-runtime/core-js/object/define-property")["default"];

exports["default"] = (function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;

      _Object$defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
})();

exports.__esModule = true;
},{"babel-runtime/core-js/object/define-property":2}],8:[function(require,module,exports){
"use strict";

var _Object$getOwnPropertyNames = require("babel-runtime/core-js/object/get-own-property-names")["default"];

var _Object$getOwnPropertyDescriptor = require("babel-runtime/core-js/object/get-own-property-descriptor")["default"];

var _Object$defineProperty = require("babel-runtime/core-js/object/define-property")["default"];

exports["default"] = function (obj, defaults) {
  var keys = _Object$getOwnPropertyNames(defaults);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    var value = _Object$getOwnPropertyDescriptor(defaults, key);

    if (value && value.configurable && obj[key] === undefined) {
      _Object$defineProperty(obj, key, value);
    }
  }

  return obj;
};

exports.__esModule = true;
},{"babel-runtime/core-js/object/define-property":2,"babel-runtime/core-js/object/get-own-property-descriptor":3,"babel-runtime/core-js/object/get-own-property-names":4}],9:[function(require,module,exports){
"use strict";

var _Object$create = require("babel-runtime/core-js/object/create")["default"];

var _Object$setPrototypeOf = require("babel-runtime/core-js/object/set-prototype-of")["default"];

exports["default"] = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = _Object$create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) _Object$setPrototypeOf ? _Object$setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};

exports.__esModule = true;
},{"babel-runtime/core-js/object/create":1,"babel-runtime/core-js/object/set-prototype-of":5}],10:[function(require,module,exports){
"use strict";

exports["default"] = function (obj) {
  return obj && obj.__esModule ? obj : {
    "default": obj
  };
};

exports.__esModule = true;
},{}],11:[function(require,module,exports){
"use strict";

exports["default"] = function (obj) {
  if (obj && obj.__esModule) {
    return obj;
  } else {
    var newObj = {};

    if (obj != null) {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
      }
    }

    newObj["default"] = obj;
    return newObj;
  }
};

exports.__esModule = true;
},{}],12:[function(require,module,exports){
var $ = require('../../modules/$');
module.exports = function create(P, D){
  return $.create(P, D);
};
},{"../../modules/$":22}],13:[function(require,module,exports){
var $ = require('../../modules/$');
module.exports = function defineProperty(it, key, desc){
  return $.setDesc(it, key, desc);
};
},{"../../modules/$":22}],14:[function(require,module,exports){
var $ = require('../../modules/$');
require('../../modules/es6.object.statics-accept-primitives');
module.exports = function getOwnPropertyDescriptor(it, key){
  return $.getDesc(it, key);
};
},{"../../modules/$":22,"../../modules/es6.object.statics-accept-primitives":25}],15:[function(require,module,exports){
var $ = require('../../modules/$');
require('../../modules/es6.object.statics-accept-primitives');
module.exports = function getOwnPropertyNames(it){
  return $.getNames(it);
};
},{"../../modules/$":22,"../../modules/es6.object.statics-accept-primitives":25}],16:[function(require,module,exports){
require('../../modules/es6.object.set-prototype-of');
module.exports = require('../../modules/$').core.Object.setPrototypeOf;
},{"../../modules/$":22,"../../modules/es6.object.set-prototype-of":24}],17:[function(require,module,exports){
var $ = require('./$');
function assert(condition, msg1, msg2){
  if(!condition)throw TypeError(msg2 ? msg1 + msg2 : msg1);
}
assert.def = $.assertDefined;
assert.fn = function(it){
  if(!$.isFunction(it))throw TypeError(it + ' is not a function!');
  return it;
};
assert.obj = function(it){
  if(!$.isObject(it))throw TypeError(it + ' is not an object!');
  return it;
};
assert.inst = function(it, Constructor, name){
  if(!(it instanceof Constructor))throw TypeError(name + ": use the 'new' operator!");
  return it;
};
module.exports = assert;
},{"./$":22}],18:[function(require,module,exports){
// Optional / simple context binding
var assertFunction = require('./$.assert').fn;
module.exports = function(fn, that, length){
  assertFunction(fn);
  if(~length && that === undefined)return fn;
  switch(length){
    case 1: return function(a){
      return fn.call(that, a);
    };
    case 2: return function(a, b){
      return fn.call(that, a, b);
    };
    case 3: return function(a, b, c){
      return fn.call(that, a, b, c);
    };
  } return function(/* ...args */){
      return fn.apply(that, arguments);
    };
};
},{"./$.assert":17}],19:[function(require,module,exports){
var $          = require('./$')
  , global     = $.g
  , core       = $.core
  , isFunction = $.isFunction;
function ctx(fn, that){
  return function(){
    return fn.apply(that, arguments);
  };
}
// type bitmap
$def.F = 1;  // forced
$def.G = 2;  // global
$def.S = 4;  // static
$def.P = 8;  // proto
$def.B = 16; // bind
$def.W = 32; // wrap
function $def(type, name, source){
  var key, own, out, exp
    , isGlobal = type & $def.G
    , isProto  = type & $def.P
    , target   = isGlobal ? global : type & $def.S
        ? global[name] : (global[name] || {}).prototype
    , exports  = isGlobal ? core : core[name] || (core[name] = {});
  if(isGlobal)source = name;
  for(key in source){
    // contains in native
    own = !(type & $def.F) && target && key in target;
    if(own && key in exports)continue;
    // export native or passed
    out = own ? target[key] : source[key];
    // prevent global pollution for namespaces
    if(isGlobal && !isFunction(target[key]))exp = source[key];
    // bind timers to global for call from export context
    else if(type & $def.B && own)exp = ctx(out, global);
    // wrap global constructors for prevent change them in library
    else if(type & $def.W && target[key] == out)!function(C){
      exp = function(param){
        return this instanceof C ? new C(param) : C(param);
      };
      exp.prototype = C.prototype;
    }(out);
    else exp = isProto && isFunction(out) ? ctx(Function.call, out) : out;
    // export
    exports[key] = exp;
    if(isProto)(exports.prototype || (exports.prototype = {}))[key] = out;
  }
}
module.exports = $def;
},{"./$":22}],20:[function(require,module,exports){
module.exports = function($){
  $.FW   = false;
  $.path = $.core;
  return $;
};
},{}],21:[function(require,module,exports){
// fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window
var $ = require('./$')
  , toString = {}.toString
  , getNames = $.getNames;

var windowNames = typeof window == 'object' && Object.getOwnPropertyNames
  ? Object.getOwnPropertyNames(window) : [];

function getWindowNames(it){
  try {
    return getNames(it);
  } catch(e){
    return windowNames.slice();
  }
}

module.exports.get = function getOwnPropertyNames(it){
  if(windowNames && toString.call(it) == '[object Window]')return getWindowNames(it);
  return getNames($.toObject(it));
};
},{"./$":22}],22:[function(require,module,exports){
'use strict';
var global = typeof self != 'undefined' ? self : Function('return this')()
  , core   = {}
  , defineProperty = Object.defineProperty
  , hasOwnProperty = {}.hasOwnProperty
  , ceil  = Math.ceil
  , floor = Math.floor
  , max   = Math.max
  , min   = Math.min;
// The engine works fine with descriptors? Thank's IE8 for his funny defineProperty.
var DESC = !!function(){
  try {
    return defineProperty({}, 'a', {get: function(){ return 2; }}).a == 2;
  } catch(e){ /* empty */ }
}();
var hide = createDefiner(1);
// 7.1.4 ToInteger
function toInteger(it){
  return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
}
function desc(bitmap, value){
  return {
    enumerable  : !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable    : !(bitmap & 4),
    value       : value
  };
}
function simpleSet(object, key, value){
  object[key] = value;
  return object;
}
function createDefiner(bitmap){
  return DESC ? function(object, key, value){
    return $.setDesc(object, key, desc(bitmap, value));
  } : simpleSet;
}

function isObject(it){
  return it !== null && (typeof it == 'object' || typeof it == 'function');
}
function isFunction(it){
  return typeof it == 'function';
}
function assertDefined(it){
  if(it == undefined)throw TypeError("Can't call method on  " + it);
  return it;
}

var $ = module.exports = require('./$.fw')({
  g: global,
  core: core,
  html: global.document && document.documentElement,
  // http://jsperf.com/core-js-isobject
  isObject:   isObject,
  isFunction: isFunction,
  that: function(){
    return this;
  },
  // 7.1.4 ToInteger
  toInteger: toInteger,
  // 7.1.15 ToLength
  toLength: function(it){
    return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
  },
  toIndex: function(index, length){
    index = toInteger(index);
    return index < 0 ? max(index + length, 0) : min(index, length);
  },
  has: function(it, key){
    return hasOwnProperty.call(it, key);
  },
  create:     Object.create,
  getProto:   Object.getPrototypeOf,
  DESC:       DESC,
  desc:       desc,
  getDesc:    Object.getOwnPropertyDescriptor,
  setDesc:    defineProperty,
  setDescs:   Object.defineProperties,
  getKeys:    Object.keys,
  getNames:   Object.getOwnPropertyNames,
  getSymbols: Object.getOwnPropertySymbols,
  assertDefined: assertDefined,
  // Dummy, fix for not array-like ES3 string in es5 module
  ES5Object: Object,
  toObject: function(it){
    return $.ES5Object(assertDefined(it));
  },
  hide: hide,
  def: createDefiner(0),
  set: global.Symbol ? simpleSet : hide,
  each: [].forEach
});
/* eslint-disable no-undef */
if(typeof __e != 'undefined')__e = core;
if(typeof __g != 'undefined')__g = global;
},{"./$.fw":20}],23:[function(require,module,exports){
// Works with __proto__ only. Old v8 can't work with null proto objects.
/* eslint-disable no-proto */
var $      = require('./$')
  , assert = require('./$.assert');
function check(O, proto){
  assert.obj(O);
  assert(proto === null || $.isObject(proto), proto, ": can't set as prototype!");
}
module.exports = {
  set: Object.setPrototypeOf || ('__proto__' in {} // eslint-disable-line
    ? function(buggy, set){
        try {
          set = require('./$.ctx')(Function.call, $.getDesc(Object.prototype, '__proto__').set, 2);
          set({}, []);
        } catch(e){ buggy = true; }
        return function setPrototypeOf(O, proto){
          check(O, proto);
          if(buggy)O.__proto__ = proto;
          else set(O, proto);
          return O;
        };
      }()
    : undefined),
  check: check
};
},{"./$":22,"./$.assert":17,"./$.ctx":18}],24:[function(require,module,exports){
// 19.1.3.19 Object.setPrototypeOf(O, proto)
var $def = require('./$.def');
$def($def.S, 'Object', {setPrototypeOf: require('./$.set-proto').set});
},{"./$.def":19,"./$.set-proto":23}],25:[function(require,module,exports){
var $        = require('./$')
  , $def     = require('./$.def')
  , isObject = $.isObject
  , toObject = $.toObject;
$.each.call(('freeze,seal,preventExtensions,isFrozen,isSealed,isExtensible,' +
  'getOwnPropertyDescriptor,getPrototypeOf,keys,getOwnPropertyNames').split(',')
, function(KEY, ID){
  var fn     = ($.core.Object || {})[KEY] || Object[KEY]
    , forced = 0
    , method = {};
  method[KEY] = ID == 0 ? function freeze(it){
    return isObject(it) ? fn(it) : it;
  } : ID == 1 ? function seal(it){
    return isObject(it) ? fn(it) : it;
  } : ID == 2 ? function preventExtensions(it){
    return isObject(it) ? fn(it) : it;
  } : ID == 3 ? function isFrozen(it){
    return isObject(it) ? fn(it) : true;
  } : ID == 4 ? function isSealed(it){
    return isObject(it) ? fn(it) : true;
  } : ID == 5 ? function isExtensible(it){
    return isObject(it) ? fn(it) : false;
  } : ID == 6 ? function getOwnPropertyDescriptor(it, key){
    return fn(toObject(it), key);
  } : ID == 7 ? function getPrototypeOf(it){
    return fn(Object($.assertDefined(it)));
  } : ID == 8 ? function keys(it){
    return fn(toObject(it));
  } : require('./$.get-names').get;
  try {
    fn('z');
  } catch(e){
    forced = 1;
  }
  $def($def.S + $def.F * forced, 'Object', method);
});
},{"./$":22,"./$.def":19,"./$.get-names":21}],26:[function(require,module,exports){
'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _interopRequireWildcard = require('babel-runtime/helpers/interop-require-wildcard')['default'];

exports.__esModule = true;

var _libsBase = require('../libs/base');

var _libsBase2 = _interopRequireDefault(_libsBase);

var _fieldTypesIndex = require('../field-types/index');

var fieldTypes = _interopRequireWildcard(_fieldTypesIndex);

var _libsHelpers = require('../libs/helpers');

var FormFieldFactory = (function (_Base) {
	_inherits(FormFieldFactory, _Base);

	_createClass(FormFieldFactory, [{
		key: 'types',
		get: function get() {
			return this._types;
		},
		set: function set(type) {

			if (!this._types) {
				this._types = [];
			}

			this._types.push(type);
		}
	}, {
		key: 'field',
		get: function get() {
			return this.switchFieldTypes();
		}
	}]);

	function FormFieldFactory() {
		var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

		_classCallCheck(this, FormFieldFactory);

		_Base.call(this, options);

		console.log(fieldTypes);

		for (var type in fieldTypes) {

			if (fieldTypes.hasOwnProperty(type) && type.indexOf('__es') !== 0) {
				this.types = fieldTypes[type];
			}
		}
	}

	FormFieldFactory.prototype.switchFieldTypes = function switchFieldTypes() {

		console.log(this.types);

		return null;
	};

	return FormFieldFactory;
})(_libsBase2['default']);

_libsHelpers.getGlobalObject().FormFieldFactory = FormFieldFactory;

exports['default'] = FormFieldFactory;
module.exports = exports['default'];
},{"../field-types/index":27,"../libs/base":32,"../libs/helpers":33,"babel-runtime/helpers/class-call-check":6,"babel-runtime/helpers/create-class":7,"babel-runtime/helpers/inherits":9,"babel-runtime/helpers/interop-require-default":10,"babel-runtime/helpers/interop-require-wildcard":11}],27:[function(require,module,exports){
'use strict';

var _defaults = require('babel-runtime/helpers/defaults')['default'];

var _interopRequireWildcard = require('babel-runtime/helpers/interop-require-wildcard')['default'];

exports.__esModule = true;

var _inputEmail = require('./input/email');

_defaults(exports, _interopRequireWildcard(_inputEmail));

var _inputText = require('./input/text');

_defaults(exports, _interopRequireWildcard(_inputText));
},{"./input/email":28,"./input/text":29,"babel-runtime/helpers/defaults":8,"babel-runtime/helpers/interop-require-wildcard":11}],28:[function(require,module,exports){
'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

exports.__esModule = true;

var EmailFieldType = (function () {
	function EmailFieldType() {
		_classCallCheck(this, EmailFieldType);
	}

	_createClass(EmailFieldType, [{
		key: 'uiType',
		get: function get() {

			return 'input';
		}
	}, {
		key: 'type',
		get: function get() {

			return 'email';
		}
	}]);

	return EmailFieldType;
})();

exports.EmailFieldType = EmailFieldType;
},{"babel-runtime/helpers/class-call-check":6,"babel-runtime/helpers/create-class":7}],29:[function(require,module,exports){
'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

exports.__esModule = true;

var TextFieldType = (function () {
	function TextFieldType() {
		_classCallCheck(this, TextFieldType);
	}

	_createClass(TextFieldType, [{
		key: 'uiType',
		get: function get() {

			return 'input';
		}
	}, {
		key: 'type',
		get: function get() {

			return 'text';
		}
	}]);

	return TextFieldType;
})();

exports.TextFieldType = TextFieldType;
},{"babel-runtime/helpers/class-call-check":6,"babel-runtime/helpers/create-class":7}],30:[function(require,module,exports){
'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _interopRequireWildcard = require('babel-runtime/helpers/interop-require-wildcard')['default'];

exports.__esModule = true;

var _viewsFormView = require('./views/form-view');

var _viewsFormView2 = _interopRequireDefault(_viewsFormView);

var _factoriesFormFieldFactory = require('./factories/form-field-factory');

var sdsdsd = _interopRequireWildcard(_factoriesFormFieldFactory);

var _libsHelpers = require('./libs/helpers');

var Formell = (function () {
	_createClass(Formell, [{
		key: 'form',
		set: function set(formNode) {
			this._form = formNode;
		},
		get: function get() {
			return this._form;
		}
	}]);

	function Formell() {
		var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

		_classCallCheck(this, Formell);

		options.form = options.form || {};
		options.form.uid = _libsHelpers.createUID();

		options.data = options.data || {};

		var formView = new _viewsFormView2['default'](options.form);

		this.form = formView.el;
	}

	return Formell;
})();

;

var glob = _libsHelpers.getGlobalObject();

glob.Formell = Formell;

exports['default'] = Formell;
module.exports = exports['default'];
},{"./factories/form-field-factory":26,"./libs/helpers":33,"./views/form-view":34,"babel-runtime/helpers/class-call-check":6,"babel-runtime/helpers/create-class":7,"babel-runtime/helpers/interop-require-default":10,"babel-runtime/helpers/interop-require-wildcard":11}],31:[function(require,module,exports){
'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

exports.__esModule = true;

var BaseView = (function () {
	_createClass(BaseView, [{
		key: 'el',
		set: function set(domElement) {
			this._el = domElement;
		},
		get: function get() {
			return this._el;
		}
	}, {
		key: 'tagName',
		set: function set(tag) {
			this._tagName = tag;
		},
		get: function get() {
			return this._tagName || 'div';
		}
	}, {
		key: 'className',
		set: function set(classes) {
			this._className = classes;
		},
		get: function get() {
			return this._className;
		}
	}]);

	function BaseView() {
		var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

		_classCallCheck(this, BaseView);

		this.options = options;

		this.className = options.className;

		this.el = options.el;

		if (!this.el && !options.template) {
			this.tagName = options.tagName;
			this.ensureElement();
		}

		if (this.className) {
			this.addClasses(this.className);
		}
	}

	BaseView.prototype.addClasses = function addClasses(classNames) {

		var classList = classNames.split(' ');

		classList.forEach(this.addClass.bind(this));
	};

	BaseView.prototype.addClass = function addClass(className) {

		if (!this.el.classList.contains(className)) {

			this.el.classList.add(className);
		}
	};

	BaseView.prototype.ensureElement = function ensureElement() {

		this.el = this.options.el || document.createElement(this.tagName);
	};

	return BaseView;
})();

exports['default'] = BaseView;
module.exports = exports['default'];
},{"babel-runtime/helpers/class-call-check":6,"babel-runtime/helpers/create-class":7}],32:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

exports.__esModule = true;

var Base = function Base() {
	var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

	_classCallCheck(this, Base);

	this.options = options;

	return this;
};

exports["default"] = Base;
module.exports = exports["default"];
},{"babel-runtime/helpers/class-call-check":6}],33:[function(require,module,exports){
(function (global){
'use strict';

exports.__esModule = true;
exports.createUID = createUID;
exports.getGlobalObject = getGlobalObject;

function createUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0,
		    v = c == 'x' ? r : r & 0x3 | 0x8;
		return v.toString(16);
	});
}

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
},{}],34:[function(require,module,exports){
'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

exports.__esModule = true;

var _formellBaseView = require('./formell-base-view');

/**
 * creates form
 */

var _formellBaseView2 = _interopRequireDefault(_formellBaseView);

var FormView = (function (_FormellBaseView) {
	_inherits(FormView, _FormellBaseView);

	function FormView() {
		var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

		_classCallCheck(this, FormView);

		options.tagName = options.tagName || 'form';
		options.baseClassName = 'frmll-form';

		_FormellBaseView.call(this, options);

		this.setAttributes();
		this.addClasses(this.options.className);
	}

	FormView.prototype.ensureElement = function ensureElement() {

		_FormellBaseView.prototype.ensureElement.call(this);
		this.el.id = 'frmll-' + this.options.uid;
	};

	FormView.prototype.setAttributes = function setAttributes() {

		var attributes = ['action', 'method'];

		attributes.forEach(this.setAttribute.bind(this));
	};

	FormView.prototype.setAttribute = function setAttribute(attr) {

		if (this.options[attr]) {
			this.el.setAttribute(attr, this.options[attr]);
		}
	};

	return FormView;
})(_formellBaseView2['default']);

exports['default'] = FormView;
module.exports = exports['default'];
},{"./formell-base-view":35,"babel-runtime/helpers/class-call-check":6,"babel-runtime/helpers/inherits":9,"babel-runtime/helpers/interop-require-default":10}],35:[function(require,module,exports){
'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

exports.__esModule = true;

var _libsBaseView = require('../libs/base-view');

/**
 *
 */

var _libsBaseView2 = _interopRequireDefault(_libsBaseView);

var FormellBaseView = (function (_BaseView) {
	_inherits(FormellBaseView, _BaseView);

	function FormellBaseView() {
		var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

		_classCallCheck(this, FormellBaseView);

		if (!options.el && !options.template) {
			options.tagName = options.tagName || 'div';
		}

		options.className = options.className || options.baseClassName;

		if (options.className.indexOf(options.baseClassName) < 0) {
			options.className = options.baseClassName + ' ' + options.className;
		}

		_BaseView.call(this, options);
	}

	return FormellBaseView;
})(_libsBaseView2['default']);

exports['default'] = FormellBaseView;
module.exports = exports['default'];
},{"../libs/base-view":31,"babel-runtime/helpers/class-call-check":6,"babel-runtime/helpers/inherits":9,"babel-runtime/helpers/interop-require-default":10}]},{},[30]);
