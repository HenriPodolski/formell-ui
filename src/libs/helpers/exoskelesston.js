import Exoskeleton from 'exoskeleton';
import NativeView from 'backbone.nativeview';
import NativeAjax from 'backbone.nativeajax';
import {generateTemplateString} from './string';

Exoskeleton.View = NativeView;
Exoskeleton.View.prototype.toString = function toString() {
	return this.name;
}
Exoskeleton.ajax = NativeAjax;

Exoskeleton.utils.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
};

Exoskeleton.utils.uniq = function(arr) {

    if(!arr) {
        arr = [];
    } else {
        arr = arr.filter(function(item,index){
            return arr.indexOf(item) == index;
        });
    }   

    return arr;
}

export default Exoskeleton;

//decorators
export function name(value) {  
	return function decorator(target) {
		target.prototype.name = value;
	}
}

export function tagName(value) {  
	return function decorator(target) {
		target.prototype.tagName = value;
	}
}

export function el(value) {  
	return function decorator(target) {
		target.prototype.el = value;
	}
}

export function $el(value) {  
	return function decorator(target) {
		target.prototype.$el = value;
	}
}

export function id(value) {  
	return function decorator(target) {
		target.prototype.id = value;
	}
}

export function className(value) {  
	return function decorator(target) {
		target.prototype.className = value;
	}
}

export function events(value) {  
	return function decorator(target) {
		target.prototype.events = value;
	}
}

export function on(eventName){  
  return function(target, name, descriptor){
	if(!target.events) {
		target.events = {};
	}
	if(typeof target.events == 'function') {
		throw new Error('The on decorator is not compatible with an events method');
		return;
	}
	if(!eventName) {
		throw new Error('The on decorator requires an eventName argument');
	}
	target.events[eventName] = name;
	return descriptor;
  }
}

export function template(value) {  
	return function decorator(target) {
		target.prototype.template = generateTemplateString(value);
	}
}