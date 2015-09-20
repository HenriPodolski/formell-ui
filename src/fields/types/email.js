import BaseField from '../base-field';

export class EmailField extends BaseField  {

	constructor(options={}) {

		options.tagName = 'input';
		options.type = 'email';

		super(options)

		return this;
	}
}