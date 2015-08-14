export default {

	isCustomByKey(key, value, custom) {
		return !!(custom && custom.key && custom.name)
			&& key === custom.key
			&& custom.name.toLowerCase();
	},

	isBoolean(key, value, custom) {
		return typeof value === 'boolean' && 'boolean';
	}
}