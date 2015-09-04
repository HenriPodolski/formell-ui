import BaseView from '../libs/base-view';

/**
 * creates form items
 */

class FormItemView extends BaseView {

	constructor(options={}) {

		if (!options.itemEl && !options.template) {
			options.tagName = options.tagName || 'div';
		}

		options.className = 'frmll-item';

		super(options);
	}
}

export default FormItemView;