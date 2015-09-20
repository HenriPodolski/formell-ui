import FormItemView from '../../../../src/views/form-item-view.js';
import chai from 'chai';

var expect = chai.expect;
var asset = chai.assert;
chai.should();

describe('Formell FormItemView', function () {

	it('should provide a dom tree with class frmll-item for the form item', ()=>{

		let formItemView = new FormItemView();

		expect(formItemView.el.className.indexOf('frmll-item')).to.not.equal(-1);
	});

	it('could use existing dom node', ()=>{

		let fieldGroup = document.createElement('fieldgroup');

		let formItemView = new FormItemView({
			el: fieldGroup
		});

		expect(formItemView.el).to.equal(fieldGroup);
	});

	it('should apply CSS classes when passed', ()=>{

		let classNames = 'some-class';
		let formItemView = new FormItemView({
			className: classNames
		});

		expect(formItemView.el.getAttribute('class')).to.equal('frmll-item ' + classNames);
	});
});