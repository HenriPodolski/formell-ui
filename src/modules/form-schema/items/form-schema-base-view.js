import Exoskeleton from '../../../libs/helpers/exoskelesston';
import {name} from '../../../libs/helpers/exoskelesston';

@name('items/FormSchemaBaseView')
class FormSchemaBaseView extends Exoskeleton.View {

	initialize(options={}) {
		
		this.options = options;
		this.data 	 = options.data;
		this.props 	 = options.data.properties;

		this.el.name = this.data.name;

		if (this.props.required) {
			this.el.setAttribute('required', 'required');
		}
	}

	render() {

		return this;
	}
};

export default FormSchemaBaseView;