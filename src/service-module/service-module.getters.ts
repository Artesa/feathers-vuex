/*
eslint
@typescript-eslint/explicit-function-return-type: 0,
@typescript-eslint/no-explicit-any: 0
*/
import sift from 'sift'
import { sorter, select } from '@feathersjs/adapter-commons'
import { unref } from 'vue-demi'
import type { ServiceState } from '..'
import type { Id } from '@feathersjs/feathers'

export default function makeServiceGetters() {
  return {
    list: (state) => Object.values(state.keyedById),
    temps: (state) => Object.values(state.tempsById),
    copies: (state) => Object.values(state.copiesById),
    find: (state, getters) => (_params) => {
      const params = unref(_params) || {}

      const { paramsForServer, idField } = state

      let q = params.query || {}
      let copied = false

      if (paramsForServer?.length) {
        for (let i = 0, n = paramsForServer.length; i < n; i++) {
          const key = paramsForServer[i]
          if (!(key in q)) {
            continue
          }

          // lazily copy
          if (!copied) {
            q = Object.assign({}, q)
            copied = true
          }
          delete q[key]
        }
      }

      // $limit: -1 is a special case for pagination
      // see https://hooks-common.feathersjs.com/hooks.html#disablepagination
      if (q.$limit === -1) {
        if (!copied) {
          q = Object.assign({}, q)
        }

        delete q.$limit
      }

      const { $sort, $limit, $skip, $select, ...query } = q

      let values = getters.list.slice(0)

      if (params.temps) {
        values.push(...getters.temps)
      }

      values = values.filter(sift(query))

      if (params.copies) {
        const { copiesById } = state
        // replace keyedById value with existing clone value
        values = values.map((value) => copiesById[value[idField]] || value)
      }

      const total = values.length

      if ($sort !== undefined) {
        values.sort(sorter($sort))
      }

      if ($skip !== undefined && $limit !== undefined) {
        values = values.slice($skip, $limit + $skip)
      } else if ($skip !== undefined || $limit !== undefined) {
        values = values.slice($skip, $limit)
      }

      if ($select) {
        values = select(params)(values)
      }

      return {
        total,
        limit: $limit ?? 0,
        skip: $skip ?? 0,
        data: values
      }
    },
    count: (state, getters) => (_params) => {
      const params = unref(_params) || {}

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { $limit, $skip, $sort, $select, ...query } = params?.query ?? {}

      return getters.find({
        ...params,
        query: {
          ...query,
          $limit: 0
        }
      }).total
    },
    get:
      ({ keyedById, tempsById, idField, tempIdField }) =>
      (_id, _params = {}) => {
        const id = unref(_id)
        const params = unref(_params)

        const record = keyedById[id] && select(params, idField)(keyedById[id])
        if (record) {
          return record
        }
        const tempRecord =
          tempsById[id] && select(params, tempIdField)(tempsById[id])

        return tempRecord || null
      },
    getCopyById: (state) => (id) => {
      return state.copiesById[id]
    },

    isCreatePendingById:
      ({ isIdCreatePending }: ServiceState) =>
      (id: Id) =>
        isIdCreatePending.includes(id),
    isUpdatePendingById:
      ({ isIdUpdatePending }: ServiceState) =>
      (id: Id) =>
        isIdUpdatePending.includes(id),
    isPatchPendingById:
      ({ isIdPatchPending }: ServiceState) =>
      (id: Id) =>
        isIdPatchPending.includes(id),
    isRemovePendingById:
      ({ isIdRemovePending }: ServiceState) =>
      (id: Id) =>
        isIdRemovePending.includes(id),
    isSavePendingById: (state: ServiceState, getters) => (id: Id) =>
      getters.isCreatePendingById(id) ||
      getters.isUpdatePendingById(id) ||
      getters.isPatchPendingById(id),
    isPendingById: (state: ServiceState, getters) => (id: Id) =>
      getters.isSavePendingById(id) || getters.isRemovePendingById(id)
  }
}

export type GetterName = keyof ReturnType<typeof makeServiceGetters>
