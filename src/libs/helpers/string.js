export function createUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});
}

export var generateTemplateString = (function() {
	let cache = {};

	function generateTemplate(template) {

		let fn = cache[template];

		if (!fn) {
			
			// Replace ${expressions} (etc) with ${map.expressions}.
			let sanitized = template
				.replace(/\$\{([\s]*[^;\s]+[\s]*)\}/g, function(_, match) {
					return `\$\{map.${match.trim()}\}`;
				})
				// Afterwards, replace anything that's not ${map.expressions}' (etc) with a blank string.
				.replace(/(\$\{(?!map\.)[^}]+\})/g, '');
			
			fn = Function('map', `return \`${sanitized}\``);
		}

		return fn;
	};

	return generateTemplate;
})();