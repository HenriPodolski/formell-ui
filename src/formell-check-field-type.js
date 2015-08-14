let defaultMixins = {

	isCustomByKey(key, value, opts) {
		return !!(opts && opts.custom && opts.custom.key && opts.custom.name)
			&& key === opts.custom.key
			&& opts.custom.name.toLowerCase();
	},

	isBoolean(key, value, opts) {
		return typeof value === 'boolean' && 'boolean';
	}
}

class FormellCheckFieldType {

	addMixins(mixins={}) {

		this.mixins = Object.assign({}, defaultMixins, this.mixins, mixins);
	}

	of(key, value, options={}) {

		let type = null;
		let isCheckMixins;
		let methodName;

		if(!this.mixins || options.mixins) {
			this.addMixins(options.mixins);
		}

		isCheckMixins = this.mixins;

		for(methodName in isCheckMixins) {

			if (isCheckMixins.hasOwnProperty(methodName) &&
				typeof isCheckMixins[methodName] === 'function' &&
				typeof isCheckMixins[methodName].apply(this, arguments) === 'string') {
				type = isCheckMixins[methodName].apply(this, arguments);
				break;
			}
		};

		type = type || null;

		return {key: key, value: value, type: type};
	}
}

export default new FormellCheckFieldType();