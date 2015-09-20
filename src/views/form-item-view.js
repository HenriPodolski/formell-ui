import FormellBaseView from './formell-base-view';
import FormFieldFactory from '../factories/form-field-factory';

/**
 * - wraps and renders validation-view
 * - wraps and renders form-input-view or form-select-view or form-textarea-view
 * - drag and drop container
 * - container for error/invalid classes
 */

class FormItemView extends FormellBaseView {

	constructor(options={}) {

		options.baseClassName = 'frmll-item';

		super(options);

		// @todo switch case for select, textarea, input
		this.formFieldView = (new FormFieldFactory(this.options.field)).field;
	}
}

export default FormItemView;