import Exoskeleton from '../../libs/helpers/exoskelesston';
import {createUID} from '../../libs/helpers/string';
import formSchemaItemFactory from './items/form-schema-item-factory';
import form2js from '../../libs/vendor/form2js';
import {name, tagName, on, id, template} from '../../libs/helpers/exoskelesston';

@name('FormSchemaView')
@id(`frmll-${createUID()}`)
@tagName('form')
class FormSchemaView extends Exoskeleton.View {

	initialize(options={}) {
		this.options = options;
	}

	addSubmit() {

		if (!this.el.querySelector('[type="submit"]')) {
			
			let submitButton = document.createElement('button')
			submitButton.setAttribute('type', 'submit');
			// @todo i18n/l10n
			submitButton.innerHTML = 'OK';
			this.el.appendChild(submitButton);

			this.undelegateEvents();
			this.delegateEvents();
		}
	}

	@on('submit')
	submit(evt) {
		evt.preventDefault();
		console.log(`${this}.submit()`, `${JSON.stringify(form2js(this.el))}`);
	}

	serialize() {

	}

	addOne(name, property) {
		let ItemView = formSchemaItemFactory.create(property.type);
		let view = new ItemView({
			data: {
				name,
				properties: property
			}
		});

		// @todo implement appendChild if wrapper is present
		// wrapperView.appendChild(...);
		this.el.appendChild(view.render().el);
	}

	addAll() {

		let properties = this.options.data.properties;

		console.log(this.options.data);

		for(let key in properties) {

			if(properties.hasOwnProperty(key)) {
				this.addOne(key, properties[key]);
			}
		}
	}

	render() {

		this.el.setAttribute('method', this.options.method);
		this.el.setAttribute('action', this.options.action);

		this.addAll();
		this.addSubmit();
		return this;
	}
};

export default FormSchemaView;