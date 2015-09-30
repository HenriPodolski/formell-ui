import FormSchemaStringView from './form-schema-string-view';

class FormSchemaItemFactory {

	get typesMapping() {

		return {
			string: FormSchemaStringView
		}
	}
	
	create(type) {

		if (this.typesMapping[type]) {

			return this.typesMapping[type];
		} 

		throw new Error(`Type ${type} is not implemented.`);		
		
	}
}

const formSchemaItemFactory = new FormSchemaItemFactory();

export default formSchemaItemFactory;