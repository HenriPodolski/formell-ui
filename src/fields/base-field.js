export default class BaseField {

	get tagName() {

		return this.options.tagName;
	}

	get type() {

		return this.options.type;
	}

	get el() {

		return this._el;
	}

	set el(element) {

		this._el = element;
	}

	constructor(options={}) {

		this.options = options;

		this.el = document.createElement(this.tagName);
		this.el.type = this.type;

		this.addAttributes();

		return this;
	}

	addAttributes() {

		for (let attr in this.options) {

			if (this.options.hasOwnProperty(attr)) {

				this.addAttribute(attr)
			}
		}
	}

	addAttribute(attr) {

		//console.log(attr, attr in this.el);

		if (attr in this.el) {

			this.el.setAttribute(attr, this.options[attr]);
		}
	}
}