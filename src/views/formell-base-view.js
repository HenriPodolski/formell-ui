import BaseView from '../libs/base-view';

/**
 *
 */

class FormellBaseView extends BaseView {

	constructor(options={}) {

		if (!options.el && !options.template) {
			options.tagName = options.tagName || 'div';
		}

		options.className = options.className || options.baseClassName;

		if (options.className.indexOf(options.baseClassName) < 0) {
			options.className = options.baseClassName + ' ' + options.className;
		}

		super(options);
	}
}

export default FormellBaseView;