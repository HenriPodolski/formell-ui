import Formell from '../../../src/formell.js';
import chai from 'chai';
import JohnDoeMock from '../helpers/mock/john.doe.js';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell Field', function () {

	afterEach(()=>{

		var formWrap;

		if(formWrap = document.querySelector('form')) {
			document.body.removeChild(formWrap);
		}
	});

	it('should merge options when passing to a method after creation', ()=>{

	});
});