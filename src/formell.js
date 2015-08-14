import h from 'virtual-dom/h';
import hParser from 'virtual-html';
import diff from 'virtual-dom/diff';
import patch from 'virtual-dom/patch';
import createElement from 'virtual-dom/create-element';

class Formell {

	get form() {
		return this._form
	}

	set form(formRef) {
		this._form = formRef;
	}

	get options() {
		return this._options || {};
	}

	set options(options) {
		this._options = options;
	}

	get defaults() {
		return {
			biDirectionalDataBind: true,
			formH: h('form', {id: this.uid}, [])
		};
	}

	_createUUID() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	}

	constructor(options={}) {

		this._form = null;
		this.formElement = null;
		this._initOptions(options);

		this.addAllDataFields(this.options.data);

		this.form = this.formElement = createElement(this.options.formH);

		if (options.parent) {

			this.formElement = this._includeForm(options.parent);
		}

		return this;
	}

	_initOptions(options) {

		options.formAttributes = options.formAttributes || {};
		// id set via options -> no! -> use uid if exists -> no! -> create uid
		this.uid = options.formAttributes.id || this.uid || this._createUUID();

		this.options = Object.assign(this.options, this.defaults, options);
	}

	_convertToDOMNode(normalizeVal) {

		let el = normalizeVal;

		if (typeof normalizeVal === 'string') {
			el = document.querySelector(normalizeVal);
		}

		return el;
	}

	_includeForm(formParent) {

		formParent = this._convertToDOMNode(formParent);

		if (formParent) {

			formParent.appendChild(this.form);
		}

		return formParent;
	}

	addAllDataFields(data) {

		var key;

		for (key in data) {

			if (data.hasOwnProperty(key)) {

				this.addOneDataField(key, data[key]);
			}
		}
	}

	addOneDataField(key, value) {

		//console.log(key, value);
	}
};

export default Formell;