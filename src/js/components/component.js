/**
 * --------------------------------------------------------------------------
 * Licensed under MIT (https://github.com/quark-dev/Phonon-Framework/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */
import { dispatchElementEvent, dispatchWinDocEvent } from '../core/events/dispatch'
import { generateId } from '../core/utils'
import Event from '../core/events'
import ComponentManager, { setAttributesConfig, getAttributesConfig } from './componentManager'

/**
 * ------------------------------------------------------------------------
 * Class Definition
 * ------------------------------------------------------------------------
 */

export default class Component {

  constructor(name, version, defaultOptions = {}, options = {}, optionAttrs = [], supportDynamicElement = false, addToStack = false) {
    this._name = name
    this._version = version
    this.options = Object.assign(defaultOptions, options)
    this.optionAttrs = optionAttrs
    this.supportDynamicElement = supportDynamicElement
    this.addToStack = addToStack
    this.id = generateId()

    const checkElement = !this.supportDynamicElement || this.options.element !== null

    if (typeof this.options.element === 'string') {
      this.options.element = document.querySelector(this.options.element)
    }

    if (checkElement && this.options.element === null) {
      throw new Error(`${this._name}. The element is not a HTMLElement.`)
    }

    this.dynamicElement = this.options.element === null
    this.registeredElements = []

    if (!this.dynamicElement) {
      /**
       * if the element exists, we read the data attributes config
       * then we overwrite existing config keys in JavaScript, so that
       * we keep the following order
       * [1] default JavaScript configuration of the component
       * [2] Data attributes configuration if the element exists in the DOM
       * [3] JavaScript configuration
       */
      this.options = Object.assign(this.options, this.assignJsConfig(this.getAttributes(), options))

      console.log(this.options)
      // then, set the new data attributes to the element
      this.setAttributes()
    }

    this.elementListener = event => this.onBeforeElementEvent(event)          
  }

  assignJsConfig(attrConfig, options) {
    this.optionAttrs.forEach((key) => {
      if (options[key]) {
        attrConfig[key] = options[key]
      }
    })

    return attrConfig
  }

  get version() {
    return `${this._name}-${this._version}`
  }

  set version(version) {
    this._version = version
  }

  registerElements(elements) {
    elements.forEach(element => this.registerElement(element))
  }

  registerElement(element) {
    element.target.addEventListener(element.event, this.elementListener)
    this.registeredElements.push(element)
  }

  unregisterElements() {
    this.registeredElements.forEach((element) => {
      this.unregisterElement(element)
    })
  }

  unregisterElement(element) {
    const registeredElementIndex = this.registeredElements
      .findIndex(el => el.target === element.target && el.event === element.event)

    if (registeredElementIndex > -1) {
      element.target.removeEventListener(element.event, this.elementListener)
      this.registeredElements.splice(registeredElementIndex, 1)
    } else {
      console.error(`Warning! Unknown registered element: ${element.target} with event: ${element.event}.`)
    }
  }

  triggerEvent(eventName, detail = {}, objectEventOnly = false) {
    if (this.addToStack) {
      if (eventName === Event.SHOW) {
        ComponentManager.add(this)
      } else if (eventName === Event.HIDE) {
        ComponentManager.remove(this)
      }
    }

    const eventNameAlias = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`

    // object event
    if (typeof this.options[eventName] === 'function') {
      this.options[eventName].apply(this, [detail])
    }

    if (typeof this.options[eventNameAlias] === 'function') {
      this.options[eventNameAlias].apply(this, [detail])
    }

    if (objectEventOnly) {
      return
    }

    // dom event
    if (this.options.element) {
      dispatchElementEvent(this.options.element, eventName, this._name, detail)
    } else {
      dispatchWinDocEvent(eventName, this._name, detail)
    }
  }

  setAttributes() {
    if (this.optionAttrs.length > 0) {
      setAttributesConfig(this.options.element, this.options, this.optionAttrs)
    }
  }

  getAttributes() {
    const options = Object.assign({}, this.options)
    return getAttributesConfig(this.options.element, options, this.optionAttrs)
  }

  /**
   * the preventClosable method manages concurrency between active components.
   * For example, if there is a shown off-canvas and dialog, the last
   * shown component gains the processing priority
   */
  preventClosable() {
    return this.addToStack && !ComponentManager.closable(this)
  }

  onBeforeElementEvent(event) {
    if (this.preventClosable()) {
      return
    }

    this.onElementEvent(event)
  }

  onElementEvent(event) {
    //
  }

  static _DOMInterface(ComponentClass, options) {
    return new ComponentClass(options)
  }
}