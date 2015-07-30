import h from 'virtual-dom/h';
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
		return this._options;
	}

	set options(options) {
		this._options = options;
	}

	get defaults() {
		return {
			biDirectionalDataBind: true,
			formH: h('form', {})
		};
	}

	constructor(options) {
		this._form = null;
		this._options = options || {};

		this.options = Object.assign(this.options, options, this.defaults);
		this.form = this.options.form;
	}

	apply(options) {
		this.options = Object.assign(this.options, options);
	}

	create(options) {
		this.options = Object.assign(this.options, options);
	}
};

export default Formell;