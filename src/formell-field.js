import h from 'virtual-dom/h';
import hParser from 'virtual-html';
import diff from 'virtual-dom/diff';
import patch from 'virtual-dom/patch';
import createElement from 'virtual-dom/create-element';

class FormellField {

	get formField() {
		return this._formField
	}

	set formField(formFieldRef) {
		this._formField = formFieldRef;
	}

	get options() {
		return this._options || {};
	}

	set options(options) {
		this._options = options;
	}

	constructor() {

		this._formField = null;

		return this;
	}
};

export default FormellField;