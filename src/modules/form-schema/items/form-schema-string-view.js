import FormSchemaBaseView from './form-schema-base-view';
import {name, tagName, on, id, template} from '../../../libs/helpers/exoskelesston';

@name('items/FormSchemaStringView')
@tagName('input')
class FormSchemaStringView extends FormSchemaBaseView {

	initialize(options={}) {
		super(options);
	}

	render() {

		return this;
	}
};

export default FormSchemaStringView;