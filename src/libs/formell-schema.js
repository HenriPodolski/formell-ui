/**
 * based on https://github.com/redpie/backbone-schema
 */
import Exoskelesston from './helpers/exoskelesston';
import {getGlobalObject} from './helpers/environment';

'use strict';

// helper
function undef() {
    return arguments[0];
}

var FormellSchema = (function() {
    var Schema = {};

    function log() {}

    function toObject(key, value) {
        var obj = {};
        obj[key] = value;
        return obj;
    }

    function typeOf(Value, aType) {
        return((typeof Value == 'function') && typeof aType == 'function') ? (new Value()) instanceof aType : false;
    }

    function instanceOf(inst, aType) {
        return typeof aType == 'function' ? inst instanceof aType : false;
    }

    // Replace default backbone inheritance code with the following which
    // returns the value returned by the underlying constructors which
    // facilitates the IdentityMap feature
    var Ctor = function() {};

    function inherits(parent, protoProps, staticProps) {
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if(protoProps && protoProps.hasOwnProperty('constructor')) {
            child = protoProps.constructor;
        } else {
            child = function() {
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
        if(protoProps) {
            Object.assign(child.prototype, protoProps);
        }

        // Add static properties to the constructor function, if supplied.
        if(staticProps) {
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
        child.prototype.uniqueTypeId = Exoskelesston.utils.uniqueId();
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
        get: function(path) {
            if(path === '') {
                return this.obj;
            }
            return this._find(this.obj, this._toParts(path));
        },

        /**
         * Sets the proerty located at the provided path
         * @param {[type]} path  Path in the format "/foo/bar/0"
         * @param {[type]} value Value to set
         */
        set: function(path, value) {
            if(path === '') {
                this.obj = value;
                return true;
            }
            var parts = this._toParts(path),
                name = parts.pop(),
                property = parts.length > 0 ? this._find(this.obj, parts) : this.obj;

            if(property !== undef() && property !== null) {
                property[name] = value;
                return true;
            }
            return false;
        },

        /**
         * @private
         */
        _toParts: function(path) {
            return path.split('/').slice(1).map(function(part) {
                return part.replace('~1', '/').replace('~0', '~');
            });
        },

        /**
         * @private
         */
        _find: function(obj, paths) {
            var property = obj[paths[0]];
            if(property !== undef() && property !== null && paths.length > 1) {
                paths.shift();
                return this._find(property, paths);
            }
            return property;
        }
    };
    JSONPointer.isPointer = function(pointer) {
        return(pointer !== undef() && pointer !== null) || pointer.indexOf('#') >= 0 ? true : false;
    };
    JSONPointer.fragmentPart = function(path) {
        var parts = path.split('#');
        return parts.length > 1 ? parts[1] : undef();
    };
    JSONPointer.removeFragment = function(path) {
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
            if(options.model && !(typeOf(options.model, SchemaModel))) {
                throw new Error("options.model MUST extend Exoskelesston.Schema.Model");
            }
            // Ensure the base model is of type SchemaCollection
            if(options.collection && !(typeOf(options.collection, SchemaCollection))) {
                throw new Error("options.collection MUST extend Exoskelesston.Schema.Collection");
            }
            // Ensure the base model is of type SchemaValueCollection
            if(options.valueCollection && !(typeOf(options.valueCollection, SchemaValueCollection))) {
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
        register: function(schema, model) {
            var schemaId;
            if((typeof schema == 'string')) {
                schemaId = schema;
            } else {
                schemaId = schema.id;
            }

            if(schemaId === undef() || schemaId === null || schemaId === '') {
                throw new Error('Cannot register a schema with no id');
            }

            if(Exoskelesston.utils.isObject(schema)) {
                this.registeredSchemas[schemaId] = schema;
                delete this.parsedSchemaCache[schemaId];
            }

            if(model) {
                this.registeredSchemaTypes[schemaId] = model;
                delete this.typeCache[schemaId];
            }
        },

        /**
         * Unregister a schema
         * @param  {String} schemaId The schema id of the schema you wish to unregister
         * @return {this}
         */
        unregister: function(schemaId) {
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
        reset: function() {
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
        create: function(schema, model) {
            if((typeof schema == 'string')) {
                schema = this._get(schema);
            } else if(schema.id) {
                this.register(schema, model);
            }

            schema = this.parse(schema);

            if(schema.type && schema.type === 'array') {
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
        createInstance: function(schema, model, attributes, options) {
            if(!(typeof model == 'function') && options === undef()) {
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
        _get: function(schemaId) {

            if(schemaId === undef()) {
                return undef();
            }

            schemaId = schemaId.split('#')[0];

            var schema = this.registeredSchemas[schemaId];
            if(schema === undef()) {
                schema = this.fetch(schemaId);
                if(schema !== undef()) {
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
        fetch: function(schemaId) {
            return undef();
        },

        /**
         * Creates an object model representation of schema by populating
         * all references and extensions ($ref's) which their corresponding
         * schemas in full.
         * @param  {Object} schema Provide the schema to parse
         * @return {Object}        Returns the parsed schema
         */
        parse: function(schema) {
            // Ensure that root schemas are identifiable by an id.
            // This is used for caching purposes internally
            if(schema.id === undef() || schema.id === null) {
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
        _removeTrailingHash: function(schemaId) {
            // Remove trailing #
            return schemaId !== undef() && schemaId.length > 1 ? (schemaId.charAt(schemaId.length - 1) === '#' ? schemaId.slice(0, -1) : schemaId) : undef();
        },

        /**
         * Provides the recursive parse method
         * @param  {Object} schema     Provide the schema to parse
         * @param  {Object} rootSchema Provide the root schema which corresponds to $ref="#"
         * @return {Object}            Returns the parsed schema
         * @private
         */
        _parse: function(schema, rootSchema) {

            if(schema === undef() || schema === null) {
                return undef();
            }

            var schemaId = this._removeTrailingHash(schema.id);
            if(schemaId && this.parsedSchemaCache[schemaId]) {
                return this.parsedSchemaCache[schemaId];
            }

            var reference = schema['$ref'];
            if(reference && this.parsedSchemaCache[reference]) {
                return this.parsedSchemaCache[reference];
            }

            ///////////////
            // To avoid infinite loops on circular schema references, define the
            // expanded schema now (ahead of evaluating it) and add it to the cache.
            // Re-entrant calls will pull the empty object from the cache which
            // will eventually be populated as the recursions exit.
            //var expandedSchema = schema;
            if(schemaId !== undef()) {
                this.parsedSchemaCache[schemaId] = schema;
            }

            ///////////////
            // Process references early, as they can't have any other
            // fields/properties present.
            if(reference) {

                // Short circuit most common usage
                if(reference === '#') {
                    return rootSchema;
                }

                var parts = reference.split('#'),
                    referencedSchemaId = parts[0],
                    referencedFragment = parts.length > 1 ? parts[1] : '',
                    referencedSchema;
                if(referencedSchemaId === '') {
                    referencedSchema = rootSchema;
                } else {
                    var fetchedSchema = this._get(referencedSchemaId);
                    referencedSchema = this._parse(fetchedSchema, fetchedSchema);
                }

                var toReturn = referencedFragment.length > 0 ? new JSONPointer(referencedSchema).get(referencedFragment) : referencedSchema;
                // Ensure referenced fragment has an id
                if(toReturn && (toReturn.id === undef() || toReturn.id === null)) {
                    toReturn.id = reference.charAt(0) === '#' ? referencedSchema.id + reference : reference;
                }
                return toReturn;
            }

            //////////////
            // Process child properties first so that object graph completes
            // leaf nodes first
            var properties = schema.properties;
            var property;
            if(properties) {
                for(var key in properties) {
                    if(properties.hasOwnProperty(key)) {
                        property = properties[key];
                        properties[key] = this._parse(property, rootSchema);
                    }
                }
            }

            //////////////
            // TODO: "not" below is a strange one and needs thinking through
            ['items', 'anyOf', 'allOf', 'not'].forEach(function(propertyName) {
                var items = schema[propertyName];
                if(items) {
                    if((items instanceof Array)) {
                        for(var i = 0, l = items.length; i < l; i++) {
                            schema[propertyName][i] = this._parse(items[i], rootSchema);
                        }
                    } else {
                        schema[propertyName] = this._parse(items, rootSchema);
                    }
                }
            }, this);

            var extensions = schema['extends'];
            if(extensions) {
                // Remove the extends attribute as we are going to perform the extension below
                schema['extends'] = undef();

                ((extensions instanceof Array) ? extensions : [extensions]).forEach(function(extension) {
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
        _createModel: function(schema, options, baseModel) {

            var schemaId = schema.id;

            // Attempt to re-use previously constructed models
            if(schemaId && this.typeCache[schemaId]) {
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
            var BaseModel = baseModel || (schemaId && this.registeredSchemaTypes[schemaId]) || this.baseModel;
            // Ensure the base model is of type "SchemaModel"
            if(!BaseModel.isSchemaModel) {
                throw new Error('Base model for schema ' + schemaId + ' is not a SchemaModel');
            }

            // Eval the constructor code as we want to inject the typeLabel which will allow models
            // created with this type to have meaningful names when debugging
            // Construct the new model
            var model = BaseModel.extend({
                constructor: function(attributes, options) {
                    var toReturn = BaseModel.prototype.constructor.apply(this, arguments);
                    if(toReturn) {
                        return toReturn;
                    }
                    if(!options || options.validation !== false) {
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
            if(schemaId) {
                this.typeCache[schemaId] = model;
            }

            var defaults = {},
                schemaRelations = {},
                key,
                property;

            // Using the schema.properties definitions determine if there
            // are any relations and if so create corresponding models or collections
            if(schema.properties) {

                for(key in schema.properties) {
                    if(schema.properties.hasOwnProperty(key)) {
                        property = schema.properties[key];

                        // Extract any default values from schema and assign to model's default object
                        // Array access is required as 'default' is a reserved word.
                        if(property['default'] !== undef()) {
                            defaults[key] = property['default'];
                        }

                        // Only types "object" and "array" map to relations
                        switch(property.type) {
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
        _createCollection: function(schema, options, baseCollection) {

            var schemaId = schema.id;

            // Attempt to re-use previously constructed collections
            if(schemaId && this.typeCache[schemaId] !== undef()) {
                return this.typeCache[schemaId];
            }

            // Create a meaningful name for the mode using the schema.title (whitespace removed)
            var collectionName = schema.title ? schema.title.replace(/[^\w]/gi, '') : 'Unknown',
                items = schema.items,
                model, typeLabel, BaseCollection;

            // Depending on the items.type we need to create a different base collection
            switch(items.type) {
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
                if(!BaseCollection.isSchemaCollection) {
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
                if(!BaseCollection.isSchemaValueCollection) {
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
                constructor: function(models, options) {
                    var toReturn = BaseCollection.prototype.constructor.apply(this, arguments);
                    if(toReturn) {
                        return toReturn;
                    }
                    if(!options || options.validation !== false) {
                        this.validation = new ValidationErrorsCollection();
                    }
                },
                model: model,
                schema: schema,
                factory: this,
                // Save a reference to this factory for future use
                typeLabel: typeLabel,
                validation: undef(),
                initValidation: function() {
                    if(this.options.validate !== false) {
                        this.validation = new ValidationErrorsCollection();
                    }
                },
                newModel: function(attributes, options) {
                    options = options || {};
                    options.schema = options.schema || this.schema.items;
                    return new this.model(attributes, options);
                },
                addNewModel: function(attributes, options) {
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
            if(schemaId) {
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
    var SchemaModel = Schema.Model = Exoskelesston.Model.extend({

        /**
         * JSON Schema associated with this model
         * @type {Object}
         */
        schema: {},

        // Each time the Model is extended it will receive a new
        // uniqueTypeId which can later be used to differentiate types
        uniqueTypeId: Exoskelesston.utils.uniqueId(),

        /**
         * Constructor function is used to provide named objects during debugging
         */
        constructor: function SchemaModel(attributes, options) {

            // IdentityMap using SchemaId
            // TODO: (MMI) Bind to dispose event in order to remove the instance from
            // the cache to avoid a memory leak
            if(attributes && attributes[this.idAttribute]) {
                var schemaId = this.schema ? this.schema.id : undef();
                if(schemaId) {
                    var cacheKey = attributes[this.idAttribute] + '|' + schemaId;
                    if(options === undef() || options.identityMap !== false) {
                        var cachedModel = this.factory.instanceCache[cacheKey];
                        if(cachedModel) {
                            return cachedModel;
                        }
                    }
                    this.factory.instanceCache[cacheKey] = this;
                }
            }

            Exoskelesston.Model.prototype.constructor.call(this, attributes, options);
        },

        /**
         * Determines the server side url provided via schema links where model data can be located
         * @return {String} Returns an API endpoint URL
         */
        url: function() {
            var schema = this.schema;
            if(schema !== undef() && schema.links !== undef()) {
                var url;
                var link;
                for(var key in schema.links) {
                    if(schema.links.hasOwnProperty(key)) {
                        link = schema.links[key];
                        if(link.rel !== undef() && link.rel === 'self') {
                            url = link.href;
                            break;
                        }
                    }
                }

                if(url !== undef()) {
                    // replace the url property on this method so that future calls
                    // don't need to re-process
                    return this.url = url.replace(/\{id\}/, encodeURIComponent(this.id));
                }
            }
            return Exoskelesston.Model.prototype.url.apply(this, arguments);
        },

        /**
         * Overrides the default Exoskelesston.Model.fetch behaviour and sets the default options.parse=true
         * See https://github.com/documentcloud/backbone/issues/1843 for more details
         * @param  {Object=} options
         * @return {Object}         Returns a xhr object from the default fetch method
         */
        fetch: function(options) {
            options = options || {};
            if(options.parse === void 0) {
                options.parse = true;
            }
            return Exoskelesston.Model.prototype.fetch.call(this, options);
        },

        /**
         * Gets the value of a model attribute
         * @param  {String} key Provide the attribute name
         * @return {String|Number|Object}     Returns the attribute value
         */
        get: function(key) {

            // Check if the model has a property or method for the key
            var value = this[key];
            if(value !== undef()) {
                return (typeof value == 'function') ? value() : value;
            }

            var toReturn = Exoskelesston.Model.prototype.get.apply(this, arguments);

            // Lazy Initialisation of relations
            // Check if the return value is an uninitialized relation
            if(toReturn === undef() || toReturn === null) {
                var RelationType = this.schemaRelations[key];
                if(RelationType !== undef()) {
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
        set: function(key, value, options) {
            var attributes;
            if(Exoskelesston.utils.isObject(key) || key === undef()) {
                attributes = key;
                options = value;
            } else {
                attributes = {};
                attributes[key] = value;
            }

            options = options || {};
            if(options.validate === undef()) {
                options.validate = false;
            }
            attributes = this._prepareAttributes(attributes, options);

            return Exoskelesston.Model.prototype.set.call(this, attributes, options);
        },

        /**
         * Interates over the provided attributes and initializes any relations
         * to their corresponding model or collection.
         * @param  {Object} attributes Attributes to initialize
         * @param  {Objects=} options
         * @return {Object}            Returns new initialized attributes
         */
        _prepareAttributes: function(attributes, options) {
            // TODO: If attributes are Models or Collections check the match the schema
            if(attributes !== undef() && this.schema !== undef() && this.schemaRelations !== undef()) {
                var attrs = {},
                name,
                attribute;

                for(name in attributes) {
                    if(typeof attributes.hasOwnProperty !== 'function' || attributes.hasOwnProperty(name)) {
                        attribute = attributes[name];
                        var Relation = this.schemaRelations[name];
                        if(Relation && !(attribute instanceof Exoskelesston.Model || attribute instanceof Exoskelesston.Collection)) {
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
        toJSON: function(options) {
            if(this.toJSONInProgress) {
                // This only happens when there is a circular reference
                // and the model has already been serialized previously
                return this.id ? toObject(this.idAttribute, this.id) : undef();
            }

            this.toJSONInProgress = true;

            var toReturn,
                name,
                property;
            if(this.schema) {
                for(name in this.schema.properties) {
                    if(this.schema.properties.hasOwnProperty(name)) {
                        property = this.schema.properties[name];
                        var attribute = this.attributes[name];
                        if ([undef(), null].indexOf(attribute) === -1) {
                            var value;
                            if(this.schemaRelations[name]) {
                                value = attribute.toJSON(options);
                            } else {
                                value = attribute;
                            }
                            if(value !== undef()) {
                                if(toReturn === undef()) {
                                    toReturn = {};
                                }
                                toReturn[name] = value;
                            }
                        }
                    }
                }
            } else {
                toReturn = Exoskelesston.Model.prototype.toJSON.apply(this, arguments);
            }

            this.toJSONInProgress = false;

            return toReturn;
        },

        /**
         * Validates the model against the schema returning true if valid
         * @param  {Object}  options Passed to the validate method
         * @return {Boolean}         Returns true if valid, otherwise false
         */
        isValid: function(options) {
            return this.validate(undef(), options) === undef();
        },

        _validate: function(attributes, options) {
            var toReturn = Exoskelesston.Model.prototype._validate.apply(this, arguments);
            if(options && options.validate === false) {
                return true;
            }
            return toReturn;
        },

        /**
         * Validates the model against the schema
         * @param  {Object=} options
         * @return {Array}  Returns an array of errors or undef()
         */
        validate: function(attributes, options) {

            if(!this.validation) {
                return;
            }

            // If no attributes are supplied, then validate all schema properties
            // by building an attributes array containing all properties.
            if(attributes === undef()) {
                attributes = {};

                for(let key in this.schema.properties) {
                    if(this.schema.properties.hasOwnProperty(key)) {
                        let value = this.schema.properties[key];
                        attributes[key] = this.attributes[key];                        
                    }
                }

                for(let name in this.attributes) {
                    if(typeof this.attributes.hasOwnProperty !== 'function' || this.attributes.hasOwnProperty(name)) {
                        if (attributes[name] === undef()){
                            attributes[name] = this.attributes[name];
                        }
                    }
                }
            }

            for(let key in this.validation.attributes) {
                if(typeof this.validation.attributes.hasOwnProperty !== 'function' || this.validation.attributes.hasOwnProperty(key)) {
                    let attribute = this.validation.attributes[key]
                    delete this.validation.attributes[key];
                    if(attribute.dispose) {
                        attribute.dispose();
                    }
                }
            }

            var errors = [];

            for(let key in attributes) {
                if(attributes.hasOwnProperty(key)) {
                    let value = attributes[key]
                    log('Validating attribute: ' + key);
                    let attributeErrors = this.validateAttribute(key, value, options);
                    if(attributeErrors.length > 0) {
                        this.validation.set(key, new ValidationErrorsCollection(attributeErrors));
                        errors.push.apply(errors, attributeErrors);
                    }
                }
            }

            // Return nothing on success
            if(errors.length > 0) {
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
        validateAttribute: function(key, value, options) {
            options = options || {};

            // If a property is not defined in schema and additionalProperties is not set to false, then allow anything.
            // Note: we don't currently support schema based additionalProperties, only boolean values
            if(this.schema.additionalProperties !== false && (this.schema.properties === undef() || this.schema.properties[key] === undef())) {
                return [];
            }

            var schemaProperty = this.schema.properties[key],
                errors = [];

            // Only validate Schema attributes
            if(schemaProperty === undef()) {

                if(this.schema.additionalProperties === false) {
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

            if(schemaProperty.required === true) {
                // If the property is required, Run all validators
                requiresValidation = true;

                if(!Validators.required(value, true)) {
                    errors.push({
                        level: 'error',
                        rule: 'required',
                        message: '%(title) is a required field',
                        values: {
                            'title': schemaTitle
                        }
                    });
                }

            } else if(value !== undef()) {
                // Otherwise, only run validators if a value has been specified
                requiresValidation = true;
            }

            // Call into each necessary validator
            if(requiresValidation) {

                var isString = (typeof value == 'string');
                var isNumber = !isString && (typeof value == 'number');
                var isInteger = isNumber && value % 1 === 0;
                var isBoolean = !isString && !isNumber && (typeof value == 'boolean');
                var isValue = isString || isNumber || isBoolean;
                var isModel = !isValue && instanceOf(value, SchemaModel);
                var isCollection = !isValue && instanceOf(value, SchemaCollection);
                var isRelation = isModel || isCollection;
                var isNull = value === undef() || value === null;

                var schemaType = schemaProperty.type;

                // Validate the type of each attribute
                switch(schemaType) {

                case 'object':
                    if(!isModel) {
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
                    if(!isCollection) {
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
                    if(!isString) {
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
                    if(!isNumber) {
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
                    if(!isInteger) {
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
                    if(!isBoolean) {
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
                    if(!isNull) {
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

                if(isRelation) {

                    // Only validate relations when options.deep is specified
                    if(options.deep === true) {

                        if(isModel && !value.isValid(options)) {
                            errors.push({
                                level: 'error',
                                rule: 'relation',
                                message: '%(title) is invalid',
                                values: {
                                    'title': schemaTitle
                                }
                            });
                        }

                        if(isCollection && !value.isValid(options)) {
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

                } else if(isString) {

                    // maxLength validator
                    if(schemaProperty.maxLength != undef() && !Validators.maxLength(value, schemaProperty.maxLength)) {
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
                    if(schemaProperty.minLength != undef() && !Validators.minLength(value, schemaProperty.minLength)) {
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
                    if(schemaProperty.format != undef() && !Validators.format(value, schemaProperty.format)) {
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
                    if(schemaProperty.pattern != undef() && !Validators.pattern(value, schemaProperty.pattern)) {
                        errors.push({
                            level: 'error',
                            rule: 'pattern',
                            message: '%(title) is invalid',
                            values: {
                                'title': schemaTitle
                            }
                        });
                    }

                } else if(isNumber) {
                    // minimum validator
                    if(schemaProperty.minimum != undef() && !Validators.minimum(value, schemaProperty.minimum, schemaProperty.exclusiveMinimum)) {
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
                    if(schemaProperty.maximum != undef() && !Validators.maximum(value, schemaProperty.maximum, schemaProperty.exclusiveMaximum)) {
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
                    if(schemaProperty.divisibleBy != undef() && !Validators.divisibleBy(value, schemaProperty.divisibleBy)) {
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
        dispose: function() {
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
    var SchemaCollection = Schema.Collection = Exoskelesston.Collection.extend({

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
        uniqueTypeId: Exoskelesston.utils.uniqueId(),

        /**
         * Constructor function is used to provide named objects during debugging
         */
        constructor: function SchemaCollection(models, options) {
            Exoskelesston.Collection.prototype.constructor.call(this, models, options);
        },

        /**
         * Validates the Collection against the schema returning true if valid
         * @param  {Object}  options Passed to the validate method
         * @return {Boolean}         Returns true if valid, otherwise false
         */
        isValid: function(options) {
            return this.validate(options) === undef();
        },

        /**
         * Adds one or more models to the collection
         * @param {SchemaModel|array} models  Model or array of Models
         * @param {Object=} options
         */
        add: function(models, options) {
            if(options && options.parse) {
                models = this.parse((models instanceof Array) ? models : [models], options);
            }
            return Exoskelesston.Collection.prototype.add.call(this, models, options);
        },

        /**
         * Removes one or more models from the collection
         * @param {SchemaModel|array} models  Model or array of Models
         * @param {Object=} options
         */
        remove: function(models, options) {
            if(options && options.parse) {
                models = this.parse((models instanceof Array) ? models : [models], options);
            }
            return Exoskelesston.Collection.prototype.remove.call(this, models, options);
        },

        /**
         * Resets the collection with the provided Models
         * @param {SchemaModel|array} models  Model or array of Models
         * @param {Object=} options
         */
        reset: function(models, options) {
            if(options && options.parse) {
                models = this.parse((models instanceof Array) ? models : [models], options);
            }
            return Exoskelesston.Collection.prototype.reset.call(this, models, options);
        },

        /**
         * Validates the collection against the schema
         * @param  {Object=} options
         * @return {Array}  Returns an array of errors or undef()
         */
        validate: function(options) {

            if(!this.validation) {
                return;
            }

            var schema = this.schema;
            var errors = [];

            if(schema.minItems != undef() && !Validators.minItems(this.models, schema.minItems)) {
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

            if(schema.maxItems != undef() && !Validators.maxItems(this.models, schema.maxItems)) {
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

            if(schema.uniqueItems != undef() && !Validators.uniqueItems(this.models, function(model) {
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

            if(options && options.deep === true) {
                errors.push.apply(errors, this._validateModels(options));
            }

            this.validation.reset(errors);

            if(errors.length > 0) {
                return errors;
            }
        },

        /**
         * Validates the collections models
         * @param  {Object=} options
         * @return {Array}  Returns an empty array or an array of errors
         * @private
         */
        _validateModels: function(options) {
            var errors = [];
            var hasInvalid = false;
            var model;
            var key;
            
            for(key in this.models) {
                model = this.models[key]
                if(this.models.hasOwnProperty(key) && !model.isValid(options)) {
                    hasInvalid = true;
                    break;
                }
            }

            if(hasInvalid) {
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
        toJSON: function(options) {
            if(this.toJSONInProgress) {
                // This only happens when there is a circular reference
                // and the model has already been serialized previously
                return undef();
            }
            this.toJSONInProgress = true;

            var toReturn;
            if(this.schema) {
                var models = this.models,
                model, key;
                toReturn = [];

                for(key in models) {
                    if(models.hasOwnProperty(key)) {
                        model = models[key];
                        let value = model.toJSON(options);
                        if(value !== undef()) {
                            toReturn.push(value);
                        }
                    }
                }
            } else {
                toReturn = Exoskelesston.Collection.prototype.toJSON.apply(this, arguments);
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
        dispose: function() {
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
        uniqueTypeId: Exoskelesston.utils.uniqueId(),

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
        add: function(values, options) {
            var key, value;

            values = this.schema.uniqueItems ? Exoskelesston.utils.uniq(values) : values;
            
            for(key in values) {
                if(values.hasOwnProperty(key)) {
                    value = values[key];
                    if(!this.schema.uniqueItems || !this.valueMaps[value]) {
                        this.valueMaps[value] = true;
                        this.models.push(value);
                        if(!options || !options.silent) {
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
        remove: function(values, options) {

            var key, value;

            values = this.schema.uniqueItems ? Exoskelesston.utils.uniq(values) : values;

            for(key in values) {
                if(values.hasOwnProperty(key)) {
                    value = values[key];
                    if(this.valueMaps[value]) {
                        delete this.valueMaps[value];
                        let index;
                        while(index = this.indexOf(value) >= 0) {
                            this.models.splice(index, 1);
                            this.length--;
                            if(!options.silent) {
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
        reset: function(values, options) {

            var key, value;

            this.models = this.schema.uniqueItems ? Exoskelesston.utils.uniq(values) : values;
            this.length = this.models.length;
            this.valueMaps = {};

            for(key in this.models) {
                if(this.models.hasOwnProperty(key)) {
                    value = this.models[key];
                    this.valueMaps[value] = true;
                }
            }

            if(!options.silent) {
                this.trigger('reset', this, options);
            }
            return this;
        },

        _prepareModel: function(value, options) {
            return value;
        },

        _validateModels: function(options) {

            var errors = [];

            var validator;
            switch(this.schema.type) {
                case 'string':
                    validator = function isString(val) {
                        return (typeof val === 'string');
                    };
                    break;
                case 'integer':
                    validator = function(object) {
                        return typeof n === 'number' && n % 1 === 0;
                    };
                    break;
                case 'number':
                    validator = function isNumber(val) {
                        return (typeof val === 'number')
                    };
                    break;
                default:
                    break;
            }

            if(validator) {
                var hasInvalid = false;
                var model;
                var key;
                
                for(key in this.models) {
                    model = this.models[key];
                    if(this.models.hasOwnProperty(key) && !validator(model)) {
                        hasInvalid = true;
                        break;
                    }
                }

                if(hasInvalid) {
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

        pluck: function() {
            throw new Error('Not Supported');
        },

        getByCid: function() {
            throw new Error('Not Supported');
        },

        toJSON: function(options) {
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

    var ValidationErrorsCollection = Exoskelesston.Collection.extend({
        constructor: function ValidationErrorsCollection(models, options) {
            Exoskelesston.Collection.prototype.constructor.apply(this, arguments);
            this.on('add', this.fireChange, this);
            this.on('remove', this.fireChange, this);
            this.on('change', this.fireChange, this);
        },

        fireChange: function(attribute) {
            this.trigger('change:maxLevel');
        },

        maxLevel: function() {

            var key, model;

            // Short circuit
            if(this.models.length === 0) {
                return undef();
            }

            var levelString, level = 0;

            for(key in this.models) {
                if(this.models.hasOwnProperty(key)) {
                    model = this.models[key];
                    if(errorLevels[model.get('level')] > level) {
                        level = errorLevels[model.get('level')];
                        levelString = model.get('level');
                    }
                }
            }

            return levelString;
        },

        dispose: function() {
            this.off();
            this.trigger('dispose');
        }

    });

    var ValidationModel = Exoskelesston.Model.extend({
        constructor: function ValidationModel(attributes, options) {
            Exoskelesston.Model.prototype.constructor.apply(this, arguments);
        },

        setError: function(key, errors) {
            var previous = this.get(key);
            if(previous && previous.dispose) {
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
        for(var property in extension) {
            // Don't extend "id" properties
            //if(extension.hasOwnProperty(property) && property != 'id') {
            if(extension.hasOwnProperty(property)) {

                var extensionProperty = extension[property];
                if(extensionProperty !== undef()) {

                    var targetProperty = target[property];

                    // Don't process equal objects
                    if(targetProperty === extensionProperty) {
                        continue;
                    }

                    // If the target does not exist, then copy (by reference) the extension property directly
                    if(targetProperty === undef()) {
                        target[property] = extensionProperty;
                    } else {
                        // the target exists and is an object, then merge it
                        if(Exoskelesston.utils.isObject(targetProperty)) {
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
        var timestamp, struct, minutesOffset = 0;

        // ES5 §15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
        // before falling back to any implementation-specific date parsing, so that’s what we do, even if native
        // implementations could be faster
        //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 ±    10 tzHH    11 tzmm
        if((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
            // avoid NaN timestamps caused by “undef()” values being passed to Date.UTC
            for(var i = 0, k;
            (k = numericKeys[i]); ++i) {
                struct[k] = +struct[k] || 0;
            }

            // allow undef() days and months
            struct[2] = (+struct[2] || 1) - 1;
            struct[3] = +struct[3] || 1;

            if(struct[8] !== 'Z' && struct[9] !== undef()) {
                minutesOffset = struct[10] * 60 + struct[11];

                if(struct[9] === '+') {
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
        required: function(value, required) {
            required = required || true;

            if(required && (value === undef() || value === '')) {
                return false;
            } else if((value instanceof Array) && value.length === 0) {
                return false;
            } else {
                return true;
            }
        },

        minLength: function(value, minLength) {
            if(value === undef() || value.length < minLength) {
                return false;
            } else {
                return true;
            }
        },

        maxLength: function(value, maxLength) {
            if(value === undef()) {
                return true;
            } else if(value.length > maxLength) {
                return false;
            } else {
                return true;
            }
        },

        minimum: function(value, minimum, exclusiveMinimum) {
            if(isNaN(value)) {
                return false;
            }
            return exclusiveMinimum === true ? parseInt(value, 10) > minimum : parseInt(value, 10) >= minimum;
        },

        maximum: function(value, maximum, exclusiveMaximum) {
            if(isNaN(value)) {
                return false;
            }
            return exclusiveMaximum === true ? parseInt(value, 10) < maximum : parseInt(value, 10) <= maximum;
        },

        divisibleBy: function(value, divisibleBy) {
            if(isNaN(value) || divisibleBy === 0) {
                return false;
            }
            return value % divisibleBy === 0;
        },

        format: function(value, format) {
            switch(format) {

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
                log('WARNING - Validation not implemented for format:' + format);
                return true;

            default:
                log('WARNING - Unknown validation format:' + format);
                return true;
            }
        },

        pattern: function(value, pattern) {
            var regex = regexs[pattern];

            if(regex === undef()) {
                regex = new RegExp(pattern, "i");
                regexs[pattern] = regex;
            }

            return regex.test(value);
        },

        minItems: function(items, minItems) {
            return items.length >= minItems;
        },

        maxItems: function(items, maxItems) {
            return items.length <= maxItems;
        },

        uniqueItems: function(items, transform) {
            if(transform === undef()) {
                transform = function(a) {
                    return a;
                };
            }
            var uniqueItems = {};
            var hasUniqueItems = true;
            var key, value, id;

            for(key in items) {
                if(items.hasOwnProperty(key)) {
                    value = items[key];
                    id = transform(value);
                    
                    if(uniqueItems[id]) {
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
}.call(this));

getGlobalObject().FormellSchema = FormellSchema;
export default FormellSchema;