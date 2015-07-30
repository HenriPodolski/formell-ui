import Formell from '../../src/formell.js';
import chai from 'chai';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell Facade', function () {

	var formell;

	beforeEach(()=>{
		formell = new Formell({
			data: 1
		});
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
});