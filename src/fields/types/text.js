import BaseField from '../base-field';

export class TextField extends BaseField {

	constructor(options={}) {

		options.tagName = 'input';
		options.type = 'text';

		super(options);

		return this;
	}
}