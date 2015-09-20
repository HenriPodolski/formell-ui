import FormFieldFactory from '../../../../src/factories/form-field-factory.js';
import chai from 'chai';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell FormFieldFactory', function () {

	it('should create a text input field by default', ()=>{

		let formFieldFactory = new FormFieldFactory();
		let formField = formFieldFactory.createFormField();

		expect(formField.type).to.equal('text');
		expect(formField.tagName).to.equal('input');
	});

	it('should create a specific input field class when type parameter is given', ()=>{
		let formFieldFactory = new FormFieldFactory();
		let formField = formFieldFactory.createFormField({
			type: 'email'
		});

		expect(formField.type).to.equal('email');
		expect(formField.tagName).to.equal('input');
	});

	it('should not create a field when not existing field type is given', ()=>{
		let formFieldFactory = new FormFieldFactory();
		let formField = formFieldFactory.createFormField({
			type: 'none'
		});

		expect(formField.type).to.not.be.ok;
		expect(formField.tagName).to.not.be.ok;
	});

	it('should create an input field dom node with type text', ()=>{
		let formFieldFactory = new FormFieldFactory();
		let formField = formFieldFactory.createFormField();

		expect(formField.el.nodeName.toLowerCase()).to.equal('input');
		expect(formField.el.getAttribute('type').toLowerCase()).to.equal('text');
	});
});