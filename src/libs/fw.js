;(function() {

	'use strict';

	// Save a reference to the global object
	var root = this;

	root.fw = root.fw || {};

	class Collection {

		constructor(options) {

			this.name = 'fw.Collection';

			this.options = options;

			this.setup = this.options;
		}

		toString() {

			return this.name;
		}
	}

	fw.Collection = Collection;

	class Model {

		defaults() {

			return {};
		}

		constructor(options) {

			this.name = 'fw.Model';

			this.options = options;

			this.setup = Object.assign({}, this.defaults(), this.options);
		}

		toString() {

			return this.name;
		}
	}

	fw.Model = Model;

	class View {

		defaults() {

			return {};
		}

		constructor(options) {

			this.name = 'fw.View';

			this.setup = {};

			this.setup = Object.assign({}, this.defaults(), this.options);

			this.name = this.setup.name || this.name;
		}

		toString() {

			return this.name;
		}
	}

	fw.View = View;

	var normalizeContext = fw.normalizeContext = function(context) {

		if (!context) {

			context = [document];
		} else if (context.nodeName) {

			context = [context];
		} else if (typeof context === 'string') {

			context = Array.prototype.slice.call(
				document.querySelectorAll(context)
			);
		}

		if (!(context instanceof Array)) {
			throw new Error('Parameter context is not a valid NodeList.');
		}

		return context;
	}

	var ComponentFactory = fw.ComponentFactory = {

		/**
		 * @param options.pluginMethodName string
		 * @param options.ElementView view class
		 */
		createPlugin: function(options) {

			var self = this;
			var pluginMethodName = options.pluginMethodName;
			var ElementView = options.View;
			var defaultSelector = options.selector;
			var pluginPrefix = 'fw';
			var initPrefix = 'bootstrap';
			// if reinitialize is set to false
			// the component cannot be initialized by fw.bootstrapper.reinitialize
			var reinitialize = options.reinitialize === false ? false : true;

			if ($.fn[pluginPrefix + pluginMethodName]) {

				throw new Error('Plugin method ' + pluginPrefix + pluginMethodName + ' already exists.');
			}

			$.fn[pluginPrefix + pluginMethodName] = function(pluginSetup) {

				return this.each(function() {

					var setup = self.getElementSetup.call(this, pluginSetup);
					var $this = $(this);

					// make the view accessible on DOM element
					this.View = new ElementView(setup);
					this.View.render();
					// and on jQuery property Object
					$this.prop('View', this.View);
				});
			}

			if (fw[initPrefix + pluginMethodName]) {

				throw new Error('Initializer method ' + initPrefix + pluginMethodName + ' already exists.');
			}

			fw[initPrefix + pluginMethodName] = function(selector, context, options) {

				var obj;
				var isParamsObj = typeof selector === 'object' && !selector.jquery && !selector.style;

				// accepts a parameter object as the first argument too,
				// if is not selector string or jquery object or dom node
				if (isParamsObj) {

					obj = selector;
					selector = obj.selector;
					context = obj.context;
					options = obj.options;
				}

				selector = selector || defaultSelector;
				options = options || {};

				if (typeof selector !== 'String') {
					// reset context if passed, when selector is a dom node
					context = null;
				}

				return function() {

					var $el = $(selector, context);
					return $el[pluginPrefix + pluginMethodName](options).prop('View');
				};
			};

			fw[initPrefix + pluginMethodName].reinitializable = reinitialize;
		},

		// /**
		//  * @param options.tagName
		//  * @param options.View
		//  * @param options.elementProto
		//  * @param options.created
		//  * @param options.attached
		//  * @param options.detached
		//  * @param options.attributeChange
		//  */
		// createComponent: function(options) {

		// 	var self = this;
		// 	var componentName = options.componentName;
		// 	var ElementView = options.View;
		// 	var elementProto = options.elementProto;
		// 	var created = options.created;
		// 	var attached = options.attached;
		// 	var detached = options.detached;
		// 	var attributeChanged = options.attributeChange;
		// 	var component = Object.create(elementProto || HTMLElement.prototype);
		// 	var _super = {
		// 		created: function createdF() {

		// 			var setup = self.getElementSetup.call(this);

		// 			self.View = ElementView && (new ElementView(setup));
		// 		},

		// 		attached: function attachedF() {

		// 			self.View && self.View.render();
		// 		},

		// 		detached: function detachedF() {

		// 			self.View && self.View.undelegateEvents();
		// 		},

		// 		attributeChanged: function attributeChangedF(name, previousValue, value) {

		// 			self.View && self.View.attributeChanged && self.View.attributeChanged.apply(self.View, arguments);
		// 		}
		// 	};

		// 	if (!ElementView && !(created || attached || detached || attributeChanged)) {

		// 		throw new Error('View parameter is not defined');
		// 	}


		// 	component.createdCallback = created || _super.created;

		// 	component.attachedCallback = attached || _super.attached;

		// 	component.detachedCallback = detached || _super.detached;

		// 	component.attributeChangedCallback = attributeChanged || _super.attributeChanged;

		// 	document.registerElement(componentName, {
		// 		prototype: component
		// 	});
		// },

		/**
		 * @scope this DOM node
		 * @param options object
		 */
		getElementSetup: function(options) {
			var dataSetup, setup;

			// get data-setup attribute
			dataSetup = $(this).data('setup');

			if (dataSetup && typeof dataSetup === 'string') {
				// if <div data-setup="{'show': true}"> is used, instead of <div data-setup='{"show": true}'>
				// convert to valid json string and parse to JSON
				dataSetup = dataSetup.replace(/\\'/g, '\'')
					.replace(/'/g, '"');
				dataSetup = JSON.parse(dataSetup);
			}

			// merge setup option
			setup = Exoskeleton.utils.extend({}, dataSetup, options || {});

			// console.log('getElementSetup', setup);

			// create reference to this DOM node
			setup.el = this;
			return setup;
		}
	};

}.call(this));