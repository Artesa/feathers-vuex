/*
eslint
@typescript-eslint/no-explicit-any: 0
*/
import type { Ref } from 'vue-demi'
import { reactive, computed, toRefs, isRef, watch } from 'vue-demi'
import type { Params } from './utils'
import type { Id, ModelStatic, Model } from './service-module/types'
import type { Class } from './type'

interface UseGetOptions<C> {
  model: Class<C & Model> & ModelStatic
  id: null | string | number | Ref<null> | Ref<string> | Ref<number>
  params?: Params | Ref<Params>
  queryWhen?: Ref<boolean>
  local?: boolean
  immediate?: boolean
}
interface UseGetState {
  isPending: boolean
  hasBeenRequested: boolean
  hasLoaded: boolean
  error: null | Error
  isLocal: boolean
}
interface UseGetData<M> {
  item: Ref<Readonly<M | null>>
  servicePath: Ref<string>
  isPending: Ref<boolean>
  hasBeenRequested: Ref<boolean>
  hasLoaded: Ref<boolean>
  isLocal: Ref<boolean>
  error: Ref<Error>
  get(id: Id, params?: Params): Promise<M | undefined>
}

export default function get<C>(options: UseGetOptions<C>): UseGetData<C> {
  const defaults: UseGetOptions<C> = {
    model: null,
    id: null,
    params: null,
    queryWhen: computed((): boolean => true),
    local: false,
    immediate: true
  }
  const { model, id, params, queryWhen, local, immediate } = Object.assign(
    {},
    defaults,
    options
  )

  if (!model) {
    throw new Error(
      `No model provided for useGet(). Did you define and register it with FeathersVuex?`
    )
  }

  function getId(): null | string | number {
    return isRef(id) ? id.value : id || null
  }
  function getParams(): Params {
    return isRef(params) ? params.value : params
  }

  const state = reactive<UseGetState>({
    isPending: false,
    hasBeenRequested: false,
    hasLoaded: false,
    error: null,
    isLocal: local
  })

  const computes = {
    item: computed(() => {
      const getterId = isRef(id) ? id.value : id
      const getterParams = isRef(params)
        ? Object.assign({}, params.value)
        : params == null
        ? params
        : { ...params }
      if (getterParams != null) {
        return model.getFromStore<C & Model>(getterId, getterParams) || null
      } else {
        return model.getFromStore<C & Model>(getterId) || null
      }
    }),
    servicePath: computed(() => model.servicePath)
  }

  function get(id: Id, params?: Params): Promise<C | undefined> {
    const idToUse = isRef<Id>(id) ? id.value : id
    const paramsToUse = isRef(params) ? params.value : params

    if (idToUse != null && queryWhen.value && !state.isLocal) {
      state.isPending = true
      state.hasBeenRequested = true

      const promise =
        paramsToUse != null
          ? model.get(idToUse, paramsToUse)
          : model.get(idToUse)

      return promise
        .then(response => {
          state.isPending = false
          state.hasLoaded = true
          return response
        })
        .catch(error => {
          state.isPending = false
          state.error = error
          return error
        })
    } else {
      return Promise.resolve(undefined)
    }
  }

  watch(
    [() => getId(), () => getParams()],
    ([id, params]) => {
      get(id as string | number, params as Params)
    },
    { immediate }
  )

  return {
    ...toRefs(state),
    ...computes,
    get
  }
}
