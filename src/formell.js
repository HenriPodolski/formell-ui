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

	constructor(options={}) {
		this._form = null;
		this._options = options || {};

		this.options = Object.assign(this.options, options, this.defaults);
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

	_useExistingForm(form) {

		let formWrapper;

		form = this._convertToDOMNode(form);

		if (form) {
			this.options.formH = hParser(form.outerHTML);
			formWrapper = form.parentNode;
		}

		if (formWrapper) {

			this.form = createElement(this.options.formH);
			formWrapper.replaceChild(this.form, form);
		}
	}

	create(options={}) {

		let formWithWrapper;

		this.options = Object.assign(this.options, options);

		this.form = createElement(this.options.formH);

		if (options.parent) {
			formWithWrapper = this._includeForm(options.parent);
		}

		return formWithWrapper || this.form;
	}

	use(options={}) {

		this.options = Object.assign(this.options, options);

		if (options.form) {
			this._useExistingForm(options.form);
		} else {
			throw new Error('Form node or valid form selector via options.form expected.');
		}

		return this.form;
	}
};

export default Formell;