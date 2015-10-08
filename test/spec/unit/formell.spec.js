import Formell from '../../../src/formell.js';
import {createUID} from '../../../src/libs/helpers/string.js';
import chai from 'chai';
import JohnDoeMock from '../helpers/mock/john.doe.scheme.json';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell Facade', ()=>{

	it('should return a value for member form and formView', ()=> {
		let formell = new Formell();
		formell.createForm();

		expect(formell.form).to.be.ok;
		expect(formell.formView).to.be.ok;
	});

	it('should accept values named data, method and action and assign it to options object', ()=> {
		let mock = JohnDoeMock;
		let action = '#';
		let method = 'GET';
		let formell = new Formell({data: mock, action: action, method: method});

		expect(formell.options.data).to.equal(mock);
		expect(formell.options.action).to.equal(action);
		expect(formell.options.method).to.equal(method);
	});
});

describe('Formell Initialization of DOM', ()=>{

	it('should provide a <form> dom node with a unique id name starting with frmll-', ()=>{
		let formell = new Formell();
		formell.createForm();

		expect(formell.form.nodeName.toLowerCase()).to.equal('form');
		expect(formell.form.id).to.be.ok;
		expect(formell.form.id.indexOf('frmll-')).to.equal(0);
		expect(formell.form.id).to.not.equal('frmll-' + createUID());
	});

	it('should use values passed for keys method and action, to create valid form attributes on the form element', ()=>{
		let formell = new Formell({method: 'GET', action: '#'});

		formell.createForm();

		expect(formell.form.getAttribute('method')).to.equal('GET');
		expect(formell.form.getAttribute('action')).to.equal('#');
	});
});