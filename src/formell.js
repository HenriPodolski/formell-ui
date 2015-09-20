import FormView from './views/form-view';
import * as sdsdsd from './factories/form-field-factory';
import {createUID, getGlobalObject} from './libs/helpers';

class Formell {

	set form(formNode) {
		this._form = formNode;
	}

	get form() {
		return this._form;
	}

	constructor(options={}) {

		options.form = options.form || {};
		options.form.uid = createUID();

		options.data = options.data || {};

		let formView = new FormView(options.form);

		this.form = formView.el;
	}
};

let glob = getGlobalObject();

glob.Formell = Formell;

export default Formell;