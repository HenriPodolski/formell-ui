import FormellSchema from '../../../../src/libs/formell-schema.js';
import FormSchemaView from '../../../../src/modules/form-schema/form-schema-view.js';
import chai from 'chai';
import JohnDoeMock from '../../helpers/mock/john.doe.scheme.json';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Form Schema', ()=>{

	describe('FormSchemaView', ()=>{

		let schemaId = "/schemas/person";
		let newSchema;
		let formSchemaView;
		let factory; 
		let FormDataModel;
		let viewEl;

		beforeEach(()=>{
			schemaId = "/schemas/person";
			newSchema = {
				"id": schemaId,
				"type": "object",
				"properties": {
					"name": {
						"type": "string",
						"required": true
					},
					"surname": {
						"type": "string"
					}
				}
			};
			factory = new FormellSchema.Factory();
			
			factory.register(newSchema);
			
			formSchemaView = new FormSchemaView({
				data: factory._get(schemaId),
				itemsTemplate: '<div class="form-group"></div>'
			});

			viewEl = formSchemaView.render().el;
		});
		

		it('should assign given form schema to options.data', ()=>{

			expect(formSchemaView.options.data).to.equal(newSchema);
		});

		it('should generate form elements for scheme properties', ()=>{
			
			expect(viewEl.querySelectorAll('input').length).to.equal(2);
		});

		it('should set the key name of the scheme property to the form elements name', ()=>{
			
			expect(viewEl.querySelector('[name="surname"]')).to.be.ok;
		});

		it('should set the required flag to the form element if present', ()=>{
			
			expect(viewEl.querySelector('[name="name"]').getAttribute('required')).to.be.ok;
			expect(viewEl.querySelector('[name="surname"]').getAttribute('required')).to.be.not.ok;
		});

		it('should wrap the form element with the given wrapper', ()=>{
			
			expect(viewEl.querySelector('[name="name"]').getAttribute('required')).to.be.ok;
			expect(viewEl.querySelector('[name="surname"]').getAttribute('required')).to.be.not.ok;
		});

		it('should wrap form elements with given template', ()=>{
			
			expect(viewEl.querySelectorAll('.form-group').length).to.equal(2);
		});
	});
});