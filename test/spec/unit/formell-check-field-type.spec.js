import formellCheckFieldType from '../../../src/formell-check-field-type';
import chai from 'chai';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell Check Field Type', function () {

	it('should return null if type is unknown', ()=>{

		let {key: key1,value: val1,type: type1} = formellCheckFieldType.of('test', null);
		expect(type1).to.equal(null);

		let {key: key2,value: val2,type: type2} = formellCheckFieldType.of('test');
		expect(type2).to.equal(null);
	});

	it('should detect booleans even if these are falsy', ()=>{
		let {key: key,value: value,type: type} = formellCheckFieldType.of('test', false);
		expect(type).to.not.equal(null);
	});

	it('should return given custom type if it received valid custom object', ()=>{
		let {key: key,value: value,type: type} = formellCheckFieldType.of('test', [1,2,3], {
			custom: {key: 'test', name: 'awesome-list'}
		});
		expect(type).to.equal('awesome-list');
	});
});