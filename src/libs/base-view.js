class BaseView {

	set el(domElement) {
		this._el = domElement;
	}

	get el() {
		return this._el;
	}

	set tagName(tag) {
		this._tagName = tag;
	}

	get tagName() {
		return this._tagName || 'div';
	}

	set className(classes) {
		this._className = classes;
	}

	get className() {
		return this._className;
	}

	constructor(options={}) {

		this.options = options;

		this.className = options.className;

		this.el = options.el;

		if (!this.el && !options.template) {
			this.tagName = options.tagName;
			this.ensureElement();
		}

		if (this.className) {
			this.addClasses(this.className);
		}
	}

	addClasses(classNames) {

		let classList = classNames.split(' ');

		classList.forEach(this.addClass.bind(this))
	}

	addClass(className) {

		if (!this.el.classList.contains(className)) {

			this.el.classList.add(className);
		}
	}

	ensureElement() {

		this.el = this.options.el || document.createElement(this.tagName)
	}
}

export default BaseView;