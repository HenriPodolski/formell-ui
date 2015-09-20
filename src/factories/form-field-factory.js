import Base from '../libs/base';
import * as fieldTypes from '../fields/index';
import {getGlobalObject} from '../libs/helpers';

class FormFieldFactory extends Base {

	get fields() {
		return {
			text: fieldTypes.TextField,
			email: fieldTypes.EmailField
		}
	}

	constructor(options={}) {

		super(options);
	}

	createFormField(options={}) {

		this.options = Object.assign({}, this.options, options);

		this.options.tagName = this.options.tagName || 'input';

		this.options.type = this.options.type || 'text';

		if (!this.fields[this.options.type]) {

			return {};
		}

		return new this.fields[this.options.type](this.options);
	}
}

getGlobalObject().FormFieldFactory = FormFieldFactory;

export default FormFieldFactory;