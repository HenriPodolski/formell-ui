import FormView from '../../../../src/views/form-view.js';
import chai from 'chai';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell FormView', function () {

	it('should create the action attribute and value when passed', ()=>{

		let action = 'javascript:void(0)';
		let formView = new FormView({
			action: action
		});

		expect(formView.el.getAttribute('action')).to.equal(action);
	});

	it('could use existing dom node', ()=>{

		let form = document.createElement('form');

		let formView = new FormView({
			el: form
		});

		expect(formView.el).to.equal(form);
	});

	it('should create the method attribute and value when passed', ()=>{

		let method = 'PUT';
		let formView = new FormView({
			method: method
		});

		expect(formView.el.getAttribute('method')).to.equal(method);
	});

	it('should apply CSS classes when passed', ()=>{

		let classNames = 'frmll-form';
		let formView = new FormView({
			className: classNames
		});

		expect(formView.el.getAttribute('class')).to.equal(classNames);
	});
});