/*
eslint
@typescript-eslint/explicit-function-return-type: 0,
@typescript-eslint/no-explicit-any: 0
*/
import decode from 'jwt-decode'
import inflection from 'inflection'
import fastCopy from 'fast-copy'
import _isObject from 'lodash/isObject'
import _trim from 'lodash/trim'
import _omit from 'lodash/omit'
import ObjectID from 'bson-objectid'
import { globalModels as models } from './service-module/global-models'
import stringify from 'fast-json-stable-stringify'
import type { Service } from '@feathersjs/feathers'

interface Query {
  [key: string]: any
}
interface PaginationOptions {
  default: number
  max: number
}
interface Params {
  query?: Query
  paginate?: false | Pick<PaginationOptions, 'max'>
  provider?: string
  route?: { [key: string]: string }
  headers?: { [key: string]: any }
  temps?: boolean
  copies?: boolean

  [key: string]: any // (JL) not sure if we want this
}
interface Paginated<T> {
  total: number
  limit: number
  skip: number
  data: T[]
}

export { Query, PaginationOptions, Params, Paginated }

export function stripSlashes(location: string) {
  return _trim(location, '/')
}

export function setByDot(obj, path, value, ifDelete?) {
  if (ifDelete) {
    // eslint-disable-next-line no-console
    console.log(
      'DEPRECATED. Use deleteByDot instead of setByDot(obj,path,value,true). (setByDot)'
    )
  }

  if (path.indexOf('.') === -1) {
    obj[path] = value

    if (value === undefined && ifDelete) {
      delete obj[path]
    }

    return
  }

  const parts = path.split('.')
  const lastIndex = parts.length - 1
  return parts.reduce((obj1, part, i) => {
    if (i !== lastIndex) {
      if (!obj1.hasOwnProperty(part) || typeof obj1[part] !== 'object') {
        obj1[part] = {}
      }
      return obj1[part]
    }

    obj1[part] = value
    if (value === undefined && ifDelete) {
      delete obj1[part]
    }
    return obj1
  }, obj)
}

export function upperCaseFirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

export function getShortName(service) {
  let namespace = stripSlashes(service)
  if (Array.isArray(namespace)) {
    namespace = namespace.slice(-1)
  } else if (namespace.includes('/')) {
    namespace = namespace.slice(namespace.lastIndexOf('/') + 1)
  }
  return namespace
}

export function getNameFromPath(service) {
  return stripSlashes(service)
}

// Reads and returns the contents of a cookie with the provided name.
export function readCookie(cookies, name) {
  if (!cookies) {
    return undefined
  }
  const nameEQ = name + '='
  const ca = cookies.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') {
      c = c.substring(1, c.length)
    }
    if (c.indexOf(nameEQ) === 0) {
      return c.substring(nameEQ.length, c.length)
    }
  }
  return null
}

// Pass a decoded payload and it will return a boolean based on if it hasn't expired.
export function payloadIsValid(payload) {
  return payload && payload.exp * 1000 > new Date().getTime()
}

// from https://github.com/iliakan/detect-node
export const isNode =
  Object.prototype.toString.call(
    typeof process !== 'undefined' ? process : 0
  ) === '[object process]'

export const isBrowser = !isNode

const authDefaults = {
  commit: undefined,
  req: undefined,
  moduleName: 'auth',
  cookieName: 'feathers-jwt'
}

export function getValidPayloadFromToken(token) {
  if (token) {
    try {
      const payload = decode(token)
      return payloadIsValid(payload) ? payload : undefined
    } catch (error) {
      return undefined
    }
  }
  return undefined
}

export const initAuth = function initAuth(options) {
  const { commit, req, moduleName, cookieName, feathersClient } = Object.assign(
    {},
    authDefaults,
    options
  )

  if (typeof commit !== 'function') {
    throw new Error(
      'You must pass the `commit` function in the `initAuth` function options.'
    )
  }
  let cookies
  if (req) {
    cookies = req.headers.cookie
  } else if (document && document.cookie) {
    cookies = document.cookie
  } else {
    throw new Error(
      'You must pass the `req` object in the `initAuth` function options.'
    )
  }

  const accessToken = readCookie(cookies, cookieName)
  const payload = getValidPayloadFromToken(accessToken)

  if (payload) {
    commit(`${moduleName}/setAccessToken`, accessToken)
    commit(`${moduleName}/setPayload`, payload)
    if (feathersClient) {
      return feathersClient.authentication
        .setAccessToken(accessToken)
        .then(() => payload)
    }
  }
  return Promise.resolve(payload)
}

/**
 * run de BaseModel hydration on client for each api
 */
export const hydrateApi = function hydrateApi({ api }) {
  Object.keys(api).forEach((modelName) => {
    if (!['byServicePath', 'BaseModel'].includes(modelName)) {
      const Model = api[modelName]
      Model.hydrateAll()
    }
  })
}

/**
 * Generate a new tempId and mark the record as a temp
 * @param state
 * @param item
 */
export function assignTempId(state, item) {
  const { debug, tempIdField } = state
  if (debug) {
    // eslint-disable-next-line no-console
    console.info('assigning temporary id to item', item)
  }
  const newId = new ObjectID().toHexString()
  item[tempIdField] = newId
  return newId
}

function stringifyIfObject(val): string | any {
  if (typeof val === 'object' && val != null) {
    return val.toString()
  }
  return val
}

/**
 * Get the id from a record in this order:
 *   1. the `idField`
 *   2. id
 *   3. _id
 * @param item
 * @param idField
 */
export function getId(item, idField?) {
  if (!item) {
    return
  }
  if (item[idField] != null || item.hasOwnProperty(idField)) {
    return stringifyIfObject(item[idField])
  }
  if (item.id != null || item.hasOwnProperty('id')) {
    return stringifyIfObject(item.id)
  }
  if (item._id != null || item.hasOwnProperty('_id')) {
    return stringifyIfObject(item._id)
  }
}

// Creates a Model class name from the last part of the servicePath
export function getModelName(Model) {
  // If the Model.name has been customized, use it.
  if (Model.modelName) {
    return Model.modelName
  }

  // Otherwise, use an inflection of the last bit of the servicePath
  const parts = Model.servicePath.split('/')
  let name = parts[parts.length - 1]
  name = inflection.titleize(name)
  name = name.split('-').join('')
  name = inflection.singularize(name)
  return name
}

export function registerModel(Model, globalModels, apiPrefix, servicePath) {
  const modelName = getModelName(Model)
  const path = apiPrefix ? `${apiPrefix}.${modelName}` : modelName

  setByDot(globalModels, path, Model)
  globalModels.byServicePath[servicePath] = Model
  return {
    path,
    name: modelName
  }
}

export function getServicePrefix(servicePath) {
  const parts = servicePath.split('/')
  let name = parts[parts.length - 1]
  // name = inflection.underscore(name)
  name = name.replace(/-/g, '_')
  name = inflection.camelize(name, true)
  return name
}

export function getServiceCapitalization(servicePath) {
  const parts = servicePath.split('/')
  let name = parts[parts.length - 1]
  // name = inflection.underscore(name)
  name = name.replace(/-/g, '_')
  name = inflection.camelize(name)
  return name
}

export function updateOriginal(original, newData) {
  const keys = Object.keys(newData)

  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i]

    const newProp = newData[key]
    const oldProp = original[key]
    let shouldCopyProp = false

    if (newProp === oldProp) {
      continue
    }

    const originalHasOwnProperty = original.hasOwnProperty(key)

    // If the old item doesn't already have this property, update it
    if (!originalHasOwnProperty) {
      shouldCopyProp = true
      // If the old prop is null or undefined, and the new prop is neither
    } else if (
      (oldProp === null || oldProp === undefined) &&
      newProp !== null &&
      newProp !== undefined
    ) {
      shouldCopyProp = true
      // If both old and new are arrays
    } else if (Array.isArray(oldProp) && Array.isArray(newProp)) {
      shouldCopyProp = true
    } else if (_isObject(oldProp)) {
      shouldCopyProp = true
    } else if (
      oldProp !== newProp &&
      !Array.isArray(oldProp) &&
      !Array.isArray(newProp)
    ) {
      shouldCopyProp = true
    }

    if (shouldCopyProp) {
      original[key] = newProp
    }
  }
}

export function getQueryInfo(
  params: Params = {},
  response: Partial<Pick<Paginated<any>, 'limit' | 'skip'>> = {}
) {
  const query = params.query || {}
  const qid: string = params.qid || 'default'
  const $limit =
    response.limit !== null && response.limit !== undefined
      ? response.limit
      : query.$limit
  const $skip =
    response.skip !== null && response.skip !== undefined
      ? response.skip
      : query.$skip

  const queryParams = _omit(query, ['$limit', '$skip'])
  const queryId = stringify(queryParams)
  const pageParams = $limit !== undefined ? { $limit, $skip } : undefined
  const pageId = pageParams ? stringify(pageParams) : undefined

  return {
    qid,
    query,
    queryId,
    queryParams,
    pageParams,
    pageId,
    response: undefined,
    isOutdated: undefined as boolean | undefined
  }
}

export function getItemsFromQueryInfo(pagination, queryInfo, keyedById) {
  const { queryId, pageId } = queryInfo
  const queryLevel = pagination[queryId]
  const pageLevel = queryLevel && queryLevel[pageId]
  const ids = pageLevel && pageLevel.ids

  if (ids && ids.length) {
    return ids.map((id) => keyedById[id])
  } else {
    return []
  }
}

export function makeNamespace(namespace, servicePath, nameStyle) {
  const nameStyles = {
    short: getShortName,
    path: getNameFromPath
  }
  return namespace || nameStyles[nameStyle](servicePath)
}

/**
 * Gets the service path or name from the service.  The modelname is provided
 * to allow easier discovery if there's a problem.
 * @param service
 * @param modelName
 */
export function getServicePath(service: Service<any>, Model: any) {
  if (!service.name && !service.path && !Model.servicePath) {
    throw new Error(
      `Service for model named ${Model.name} is missing a path or name property. The feathers adapter needs to be updated with a PR to expose this property. You can work around this by adding a static servicePath =  passing a 'servicePath' attribute in the options: makeServicePlugin({servicePath: '/path/to/my/service'})`
    )
  }

  return service.path || service.name || Model.servicePath
}

export function randomString(length) {
  let text = ''
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }

  return text
}

export function createRelatedInstance({ item, Model, idField, store }) {
  // Create store instances (if data contains an idField)
  const model = new Model(item)
  const id = getId(model, idField)
  const storedModel = store.state[model.constructor.namespace].keyedById[id]

  return { model, storedModel }
}

export function isBaseModelInstance(item) {
  const baseModels = Object.keys(models).map((alias) => models[alias].BaseModel)
  return !!baseModels.find((BaseModel) => {
    return item instanceof BaseModel
  })
}

export function isFeathersVuexInstance(val) {
  return !!(val.constructor.modelName || val.constructor.namespace)
}

type MergeWithAccessorsOptions = {
  suppressFastCopy?: boolean
}

export function mergeWithAccessors(
  dest,
  source,
  _opts?: MergeWithAccessorsOptions
) {
  if (_opts?.suppressFastCopy) {
    return Object.assign(dest, source)
  } else {
    return Object.assign(dest, fastCopy(source))
  }
}

export function checkNamespace(namespace, item, debug) {
  if (!namespace && debug) {
    // eslint-disable-next-line no-console
    console.error(
      'A `namespace` was not available on the Model for this item:',
      item,
      'this can be caused by not passing the Model into the makeServicePlugin function'
    )
  }
  return namespace !== null && namespace !== undefined
}

export function assignIfNotPresent(Model, props): void {
  for (const key in props) {
    if (!Model.hasOwnProperty(key)) {
      Model[key] = props[key]
    }
  }
}

export function asArray<T>(val: T | T[]): { items: T[]; isArray: boolean } {
  const isArray = Array.isArray(val)
  return {
    items: isArray ? val : val == null ? [] : [val],
    isArray
  }
}
