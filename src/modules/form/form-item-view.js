import {createUID} from '../../libs/helpers/string';
import Exoskeleton from '../../libs/helpers/exoskelesston';
import {name, tagName, on, className, template} from '../../libs/helpers/exoskelesston';

@name('Formell')
@tagName('form')
@className(`frmll-${createUID()}`)
@template('<form class="${classNames}" method="${method}" action="${action}"></form>')
class FormView extends Exoskeleton.View {

	initialize(options={}) {
		this.options = options;
	}

	@on('submit')
	submit(evt) {
		evt.preventDefault();
		console.log(`${this}.submit()`);
	}

	addOne(formItem) {
		// FormItemView
	}

	addAll() {

	}

	render() {
		
		this.el.setAttribute("method", this.options.method);
		this.el.setAttribute("action", this.options.action);

		this.addAll();

		this.delegateEvents();

		return this;
	}
};

export default FormView;