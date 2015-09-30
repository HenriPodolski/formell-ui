import FormView from './modules/form-schema/form-schema-view';
import {getGlobalObject} from './libs/helpers/environment';
import FormellSchema from './libs/formell-schema';

class Formell {

	set formView(formView) {
		this._formView = formView;
	}

	get formView() {
		return this._formView;
	}

	set options(options) {
		this._options = options;
	}

	get options() {
		return this._options;
	}

	set form(form) {
		this._form = form;
	}

	get form() {
		return this._form;
	}

	constructor(options={}) {

		this.options = options;
		this.create();
	}

	create() {

		this.formView = new FormView({
			action: this.options.action || 'javascript:void(0)',
			method: this.options.method || 'POST',
			data: this.options.data || {}
		});

		this.form = this.formView.render().el;

		return this.form;
	}
};

// add formel class to global namespace
getGlobalObject().Formell = Formell;

export default Formell;