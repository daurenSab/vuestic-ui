import VaToast from './VaToast'
import type { NotificationOptions } from './types'
import { VNode, createVNode, render, AppContext } from 'vue'

const GAP = 5
let seed = 1

declare global {
  interface Window { vaToastInstances: VNode[]; }
}

window.vaToastInstances = []

type OptionKeys = keyof NotificationOptions;

export type VaToastId = string

const getTranslateValue = (item: VNode, position: string) => {
  if (item.el) {
    const direction = position.includes('bottom') ? -1 : 1
    return (item.el.offsetHeight + GAP) * direction
  }
  return 0
}

const getNewTranslateValue = (transformY: string, redundantHeight: number, position: string) => {
  const direction = position.includes('bottom') ? -1 : 1
  return parseInt(transformY, 10) - (redundantHeight + GAP) * direction
}

const getNodeProps = (vNode: VNode) => {
  // Here we assume that vNode is a `withConfigTransport` wrapped component
  // so we can derive computedProps from it

  // @ts-ignore
  return vNode.component?.proxy?.computedProps as Record<OptionKeys, any>
}

const closeNotification = (targetInstance: VNode | null, destroyElementFn: () => void) => {
  if (!targetInstance) { return }

  if (!window.vaToastInstances.length) {
    seed = 1
    return
  }

  const targetInstanceIndex = window.vaToastInstances.findIndex((instance) => instance === targetInstance)

  if (targetInstanceIndex < 0) { return }

  const nodeProps = getNodeProps(targetInstance)

  const {
    offsetX: targetOffsetX,
    offsetY: targetOffsetY,
    position: targetPosition,
  } = nodeProps
  const redundantHeight: number | null = targetInstance.el?.offsetHeight

  destroyElementFn()

  window.vaToastInstances = window.vaToastInstances.reduce((acc: any[], instance, index) => {
    if (instance === targetInstance) {
      return acc
    }
    if (instance.component) {
      const { offsetX, offsetY, position } = getNodeProps(instance)
      const isNextInstance = index > targetInstanceIndex && targetOffsetX === offsetX && targetOffsetY === offsetY && targetPosition === position
      if (isNextInstance && instance.el && redundantHeight) {
        const [_, transformY] = instance.el.style.transform.match(/[\d-]+(?=px)/g)
        const transformYNew = getNewTranslateValue(transformY, redundantHeight, position)
        instance.el.style.transform = `translate(0, ${transformYNew}px)`
      }
    }
    return [...acc, instance]
  }, [])

  if (!window.vaToastInstances.length) {
    seed = 1
  }
}

const destroy = (el: HTMLElement | null | undefined, node: VNode | null) => {
  if (el) {
    render(null, el)
    el.remove()
  }
  el = null
  node = null
}

const mount = (component: any, {
  props,
  children,
  element,
  appContext,
}: { props?: { [key: string]: any }; children?: any; element?: HTMLElement; appContext?: AppContext } = {}): { vNode: VNode; el?: HTMLElement } => {
  let el: HTMLElement | null | undefined = element

  // eslint-disable-next-line prefer-const
  let vNode: VNode | null

  const onClose = () => {
    closeNotification(vNode, () => destroy(el, vNode))

    if (props?.onClose) {
      props.onClose()
    }
  }

  vNode = createVNode(component, { ...props, onClose }, children)

  if (appContext) {
    vNode.appContext = appContext
  }

  if (el) {
    render(vNode, el)
  } else if (typeof document !== 'undefined') {
    render(vNode, el = document.createElement('div'))
  }

  return { vNode, el }
}

export const closeAllNotifications = (appContext?: AppContext) => {
  if (!window.vaToastInstances.length) {
    seed = 1
    return
  }
  window.vaToastInstances.forEach(instance => {
    if (appContext && instance.appContext !== appContext) { return }
    getNodeProps(instance).onClose()
  })
}

export const closeById = (id: string) => {
  const targetInstance = window.vaToastInstances.find(instance => instance.el?.id === id)

  if (targetInstance) {
    const nodeProps = getNodeProps(targetInstance)
    nodeProps.onClose()
  }
}

const getToastOptions = (options: string | NotificationOptions): any => {
  if (typeof options === 'string') {
    return {
      message: options,
    }
  }
  return options
}

export const createToastInstance = (customProps: NotificationOptions | string, appContext?: AppContext): VaToastId | null => {
  const { vNode, el } = mount(VaToast, { appContext, props: getToastOptions(customProps) })

  const nodeProps = getNodeProps(vNode)

  if (el && vNode.el && nodeProps) {
    document.body.appendChild(el.childNodes[0])
    const { offsetX, offsetY, position } = nodeProps

    vNode.el.style.display = 'flex'
    vNode.el.id = 'notification_' + seed

    let transformY = 0
    window.vaToastInstances.filter(item => {
      const {
        offsetX: itemOffsetX,
        offsetY: itemOffsetY,
        position: itemPosition,
      } = getNodeProps(item)

      return itemOffsetX === offsetX && itemOffsetY === offsetY && position === itemPosition
    }).forEach((item) => {
      transformY += getTranslateValue(item, position)
    })
    vNode.el.style.transform = `translate(0, ${transformY}px)`

    seed += 1

    window.vaToastInstances.push(vNode)

    return vNode.el.id as VaToastId
  }

  return null
}

export type { NotificationOptions } from './types'
