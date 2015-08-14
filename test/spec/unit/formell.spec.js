import Formell from '../../../src/formell.js';
import chai from 'chai';
import JohnDoeMock from '../helpers/mock/john.doe.js';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell Facade', function () {

	const formWrapperClassName = 'form-wrapper';
	const formWrapperClass = `.${formWrapperClassName}`;
	const formWrapperString = `<div class="${formWrapperClassName}"><form id="my-form"></form></div>`;

	afterEach(()=>{

		var formWrap;

		// remove appended DOM nodes
		if(formWrap = document.querySelector(formWrapperClass)) {
			document.body.removeChild(formWrap);
		}

		if(formWrap = document.querySelector('form')) {
			document.body.removeChild(formWrap);
		}
	});

	it('should merge options when passing to a method after creation', ()=>{

		let formell = new Formell({
			prop: 2
		});

		expect(formell.options.prop).to.equal(2);
		expect(formell.options.biDirectionalDataBind).to.equal(true);
	});

	it('should override defaults when passed through options', ()=>{

		let formell = new Formell({biDirectionalDataBind: false});

		expect(formell.options.biDirectionalDataBind).to.equal(false);
	});

	it('should create a html form element', ()=>{
		let formell = new Formell({biDirectionalDataBind: false});
		expect(formell.formElement.toString()).to.equal('[object HTMLFormElement]');
	});

	it('should include the form, when options.parent is a valid DOM node', ()=>{
		let formell;
		let formContainer = document.createElement('div');

		formContainer.setAttribute('class', formWrapperClassName);
		document.body.insertBefore(formContainer, document.body.firstElementChild);

		formell = new Formell({parent: formContainer, formAttributes: {id: 'my-form'}});

		expect(formell.formElement.outerHTML).to.equal(formWrapperString);
	});

	it('should include the form, when options.parent is a valid selector', ()=>{

		let formell;
		let formContainer = document.createElement('div');
		formContainer.setAttribute('class', formWrapperClassName);

		document.body.insertBefore(formContainer, document.body.firstElementChild);

		formell = new Formell({parent: '.form-wrapper', formAttributes: {id: 'my-form'}});

		expect(document.querySelector('.form-wrapper').outerHTML).to.equal(formWrapperString);
	});

	it('should return the form on creation, when options.parent is not set', ()=> {
		let formell = new Formell();
		expect(formell.formElement.nodeName).to.equal('FORM');
	});

	it('should return the form wrapper on creation, when it exists', ()=> {
		let formell = new Formell({parent: document.createElement('article')});
		expect(formell.formElement.nodeName).to.equal('ARTICLE');
	});

	it('should accept data object and save it to options.data', ()=>{
		let data = [1,2,3];
		let formell = new Formell({data: data});

		expect(formell.options.data).to.equal(data);
	});

	it('should render input fields for every options.data attribute', ()=>{
		let data = {
			firstname: 'John',
			lastname: 'Doe',
			age: 27,
			available: true
		};
		let formell = new Formell({data: data});
		let inputsCount = formell.formElement.querySelectorAll('input textarea select').length;

		expect(inputsCount).to.equal(Object.keys(data).length);
	});
});