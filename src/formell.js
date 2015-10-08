import FormSchemaView from './modules/form-schema/form-schema-view';
import {getGlobalObject} from './libs/helpers/environment';
import FormellSchema from './libs/formell-schema';

/**
 * controller and facade for Formell UI
 * @class Formell 
 * @todo  rename to FormellUI
 */
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
	}

	createSchema() {

		// @todo implement create schema
	}

	updateSchema() {
		// @todo same as createSchema but exisiting data passed
	}

	createForm() {

		let formellSchemaFactory = new FormellSchema.Factory();

		// @todo check if FormSchemaView should be responsible for all requirements
		// or does it need an extra FormView module
		this.formView = new FormSchemaView({
			action: this.options.action || 'javascript:void(0)',
			method: this.options.method || 'POST',
			data: this.options.data || {}/*,
			model: formellSchemaFactory.create(this.options.data)
			*/
		});

		this.form = this.formView.render().el;

		return this.form;
	}

	updateForm() {
		// @todo same as createForm but exisiting data passed
	}
};

// add formel class to global namespace
getGlobalObject().Formell = Formell;

export default Formell;