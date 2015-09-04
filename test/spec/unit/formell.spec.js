import Formell from '../../../src/formell.js';
import {createUID} from '../../../src/libs/helpers.js';
import chai from 'chai';
import JohnDoeMock from '../helpers/mock/john.doe.js';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell Facade', function () {

	it('should provide a <form> dom tree with a unique id', ()=>{
		let formell = new Formell();

		expect(formell.form.nodeName.toLowerCase()).to.equal('form');
		expect(formell.form.id).to.be.ok;
		expect(formell.form.id).to.not.equal('frmll-' + createUID());
	});

	it('should accept an object with key form, which leads to valid form attributes set on the form element', ()=>{
		let formell = new Formell({
			form: {method: 'GET'}
		});

		expect(formell.form.getAttribute('method')).to.equal('GET');
	});
});