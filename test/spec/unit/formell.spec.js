import Formell from '../../../src/formell.js';
import chai from 'chai';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell Facade', function () {

	var formell;
	const formWrapperClassName = 'form-wrapper';
	const formWrapperClass = `.${formWrapperClassName}`;
	const formWrapperString = `<div class="${formWrapperClassName}"><form></form></div>`;

	beforeEach(()=>{

		var formWrap;

		// create new instance on every call
		formell = new Formell({
			data: 1
		});

		// remove appended DOM nodes
		if(formWrap = document.querySelector(formWrapperClass)) {
			document.body.removeChild(formWrap);
		}
	});

	it('should merge options when passing to a method after creation', ()=>{
		formell.create({prop: 2});
		expect(formell.options.data).to.equal(1);
		expect(formell.options.prop).to.equal(2);
		expect(formell.options.biDirectionalDataBind).to.equal(true);
	});

	it('should override defaults when passed through options', ()=>{
		formell.create({biDirectionalDataBind: false});
		expect(formell.options.biDirectionalDataBind).to.equal(false);
	});

	it('should create a html form element', ()=>{
		expect(formell.create().toString()).to.equal('[object HTMLFormElement]');
	});

	it('should include the form, when options.parent is a valid DOM node', ()=>{
		let formContainer = document.createElement('div');
			formContainer.setAttribute('class', formWrapperClassName);

			document.body.insertBefore(formContainer, document.body.firstElementChild);

			formell.create({parent: formContainer});

			expect(formContainer.outerHTML).to.equal(formWrapperString);
	});

	it('should include the form, when options.parent is a valid selector', ()=>{

		let formContainer = document.createElement('div');
		formContainer.setAttribute('class', formWrapperClassName);

		document.body.insertBefore(formContainer, document.body.firstElementChild);

		formell.create({parent: '.form-wrapper'});

		expect(document.querySelector('.form-wrapper').outerHTML).to.equal(formWrapperString);
	});

	it('should return the form on creation, when options.parent is not set', ()=> {
		expect(formell.create().nodeName).to.equal('FORM');
	});

	it('should return the form wrapper on creation, when it exists', ()=> {
		expect(formell.create({parent: document.createElement('article')}).nodeName).to.equal('ARTICLE');
	});

	it('should use a given form, when options.form is given to .use() and is a valid DOM node', ()=>{
		let formContainer = document.createElement('div');
		let form = document.createElement('form');
		let button = document.createElement('button');
		formContainer.setAttribute('class', formWrapperClassName);
		form.setAttribute('id', 'my-form');
		button.setAttribute('type', 'submit');

		form.appendChild(button);
		formContainer.appendChild(form);

		document.body.insertBefore(formContainer, document.body.firstElementChild);

		expect(formell.use({form: form}).outerHTML).to.equal(form.outerHTML);
	});
});