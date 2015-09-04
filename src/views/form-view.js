import BaseView from '../libs/base-view';

/**
 * creates form
 */

class FormView extends BaseView {

	constructor(options={}) {

		options.tagName = options.tagName || 'form';
		options.className = options.className || 'frmll-form';

		if (options.className.indexOf('frmll-form') < 0) {
			options.className = 'frmll-form ' + options.className;
		}

		super(options);

		this.setAttributes();
		this.addClasses(this.options.className);

		return this;
	}

	ensureElement() {

		super.ensureElement();
		this.el.id = 'frmll-' + this.options.uid;
	}

	setAttributes() {

		let attributes = ['action', 'method'];

		attributes.forEach(this.setAttribute.bind(this));
	}

	setAttribute(attr) {

		if (this.options[attr]) {
			this.el.setAttribute(attr, this.options[attr]);
		}
	}
}

export default FormView;