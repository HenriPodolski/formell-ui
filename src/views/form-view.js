import FormellBaseView from './formell-base-view';

/**
 * creates form
 */

class FormView extends FormellBaseView {

	constructor(options={}) {

		options.tagName = options.tagName || 'form';
		options.baseClassName = 'frmll-form';

		super(options);

		this.setAttributes();
		this.addClasses(this.options.className);
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