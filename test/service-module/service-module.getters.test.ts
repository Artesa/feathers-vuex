/*
eslint
@typescript-eslint/explicit-function-return-type: 0,
@typescript-eslint/no-explicit-any: 0
*/
import { assert } from 'chai'
import makeServiceGetters from '../../src/service-module/service-module.getters'
import makeServiceMutations from '../../src/service-module/service-module.mutations'
import makeServiceState from '../../src/service-module/service-module.state'
import {
  globalModels,
  clearModels
} from '../../src/service-module/global-models'

import { values as _values } from 'lodash'

const options = {
  idField: '_id',
  tempIdField: '__id',
  autoRemove: false,
  serverAlias: 'service-module-getters',
  servicePath: 'todos',
  Model: null,
  service: null
}

const { addItems, setIdPending, unsetIdPending } = makeServiceMutations()

describe('Service Module - Getters', function () {
  let getters
  let makeGetters
  beforeEach(function () {
    const state = makeServiceState(options)
    getters = makeServiceGetters()
    const {
      find,
      copies,
      copiesById,
      filterQueryOptions,
      temps,
      count,
      list,
      get,
      getCopyById,
      isCreatePendingById,
      isUpdatePendingById,
      isPatchPendingById,
      isRemovePendingById,
      isSavePendingById,
      isPendingById
    } = getters

    makeGetters = (state) => {
      const justState = {
        copies: copies(state),
        copiesById: copiesById(state),
        filterQueryOptions: filterQueryOptions(state),
        temps: temps(state),
        list: list(state),
        get: get(state),
        isCreatePendingById: isCreatePendingById(state),
        isUpdatePendingById: isUpdatePendingById(state),
        isPatchPendingById: isPatchPendingById(state),
        isRemovePendingById: isRemovePendingById(state)
      }

      const withGetters = {
        find: find(state, justState),
        getCopyById: getCopyById(state, justState),
        isSavePendingById: isSavePendingById(state, justState)
      }

      const twoLevels = {
        isPendingById: isPendingById(state, { ...justState, ...withGetters }),
        count: count(state, { ...justState, ...withGetters })
      }

      return {
        ...justState,
        ...withGetters,
        ...twoLevels
      }
    }

    this.items = [
      {
        _id: 1,
        otherField: true,
        age: 21,
        teethRemaining: 2.501,
        test: true
      },
      {
        _id: 2,
        name: 'Marshall',
        otherField: true,
        age: 24,
        teethRemaining: 2.5,
        test: true,
        movies: [{ actors: ['Jerry the Mouse'] }]
      },
      {
        _id: 3,
        otherField: true,
        age: 27,
        teethRemaining: 12,
        test: false,
        movies: [{ actors: ['Tom Hanks', 'Tom Cruise', 'Tomcat'] }]
      },
      {
        name: 'Mariah',
        age: 19,
        teethRemaining: 24,
        status: 'temp'
      }
    ]
    addItems(state, this.items)
    this.state = state
    Object.assign(globalModels, {
      [options.serverAlias]: {
        byServicePath: {
          todos: {
            copiesById: {
              1: { test: true }
            }
          }
        }
      }
    })
    this.getters = makeGetters(state)
  })

  it('list', function () {
    const { state, items } = this
    const results = this.getters.list

    results.forEach((record, index) => {
      const item = items[index]

      assert.deepEqual(record, item, 'item in correct order')
    })
  })

  it('getCopyById with keepCopiesInStore: false', function () {
    const state = {
      servicePath: 'todos',
      serverAlias: 'my-getters-test',
      keyedById: {},
      tempsById: {}
    }

    Object.assign(globalModels, {
      [state.serverAlias]: {
        byServicePath: {
          todos: {
            copiesById: {
              1: { test: true }
            }
          }
        }
      }
    })

    const { getCopyById } = makeGetters(state)

    const result = getCopyById(1)

    assert(result.test, 'got the copy')

    clearModels()
  })

  it('get works on keyedById', function () {
    const { state, items } = this

    const result = this.getters.get(1)

    assert.deepEqual(result, items[0])
  })

  it('get works on tempsById', function () {
    const { state } = this
    const tempId = Object.keys(state.tempsById)[0]

    const result = this.getters.get(tempId)

    assert(result.__id === tempId)
  })

  it('find - with limit: -1', function () {
    const { state, items } = this
    const params = { query: { $limit: -1 } }
    const results = this.getters.find(params)

    assert.deepEqual(
      results.data,
      items.filter((i) => i._id),
      'the list was correct'
    )
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 3, 'total was correct')
  })

  it('find - no temps by default', function () {
    const { state, items } = this
    const params = { query: {} }
    const results = this.getters.find(params)

    assert.deepEqual(
      results.data,
      items.filter((i) => i._id),
      'the list was correct'
    )
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 3, 'total was correct')
  })

  it('find with temps', function () {
    const { state, items } = this
    // Set temps: false to skip the temps.
    const params = { query: {}, temps: true }
    const results = this.getters.find(params)

    assert.deepEqual(results.data, items, 'the list was correct')
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 4, 'total was correct')
  })

  it('find - no copies by default', function () {
    const state = {
      servicePath: 'todos',
      serverAlias: 'my-getters-test',
      keyedById: {
        1: { _id: 1, test: true, __isClone: false },
        2: { _id: 2, test: true, __isClone: false },
        3: { _id: 3, test: true, __isClone: false }
      },
      tempsById: {},
      copiesById: {
        1: { _id: 1, test: true, __isClone: true }
      }
    }
    Object.assign(globalModels, {
      [state.serverAlias]: {
        byServicePath: {
          todos: {
            copiesById: {
              1: { _id: 1, test: true, __isClone: true }
            }
          }
        }
      }
    })

    const params = { query: {} }
    const getters = makeGetters(state)
    const results = getters.find(params)

    assert.deepEqual(
      results.data,
      _values(state.keyedById).filter((i) => !i.__isClone),
      'the list was correct'
    )
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 3, 'total was correct')

    clearModels()
  })

  it('find - with copies with keepCopiesInStore:false', function () {
    const state = {
      servicePath: 'todos',
      serverAlias: 'my-getters-test',
      idField: '_id',
      keyedById: {
        1: { _id: 1, test: true, __isClone: false },
        2: { _id: 2, test: true, __isClone: false },
        3: { _id: 3, test: true, __isClone: false }
      },
      tempsById: {}
    }
    Object.assign(globalModels, {
      [state.serverAlias]: {
        byServicePath: {
          todos: {
            copiesById: {
              1: { _id: 1, test: true, __isClone: true }
            }
          }
        }
      }
    })

    const getters = makeGetters(state)

    const params = { query: {}, copies: true }
    const results = getters.find(params)

    const expected = [
      { _id: 1, test: true, __isClone: true },
      { _id: 2, test: true, __isClone: false },
      { _id: 3, test: true, __isClone: false }
    ]

    assert.deepEqual(results.data, expected, 'the list was correct')
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 3, 'total was correct')

    clearModels()
  })

  it('find - with copies and temps', function () {
    const state = {
      servicePath: 'todos',
      serverAlias: 'my-getters-test',
      idField: '_id',
      keyedById: {
        1: { _id: 1, test: true, __isClone: false },
        2: { _id: 2, test: true, __isClone: false },
        3: { _id: 3, test: true, __isClone: false }
      },
      tempsById: {
        abc: { __id: 'abc', test: true, __isClone: false, __isTemp: true }
      }
    }
    Object.assign(globalModels, {
      [state.serverAlias]: {
        byServicePath: {
          todos: {
            copiesById: {
              1: { _id: 1, test: true, __isClone: true }
            }
          }
        }
      }
    })

    const getters = makeGetters(state)

    const params = { query: {}, copies: true, temps: true }
    const results = getters.find(params)

    const expected = [
      { _id: 1, test: true, __isClone: true },
      { _id: 2, test: true, __isClone: false },
      { _id: 3, test: true, __isClone: false },
      { __id: 'abc', test: true, __isClone: false, __isTemp: true }
    ]

    assert.deepEqual(results.data, expected, 'the list was correct')
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 4, 'total was correct')

    clearModels()
  })

  it('find with query', function () {
    const { state } = this
    const params = { query: { test: false } }
    const results = this.getters.find(params)

    assert(results.data.length === 1, 'the length was correct')
    assert(results.data[0]._id === 3, 'the correct record was returned')
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 1, 'total was correct')
  })

  it('find with custom operator', function () {
    const { state } = this
    const params = { query: { test: false, $populateParams: 'test' } }
    const results = this.getters.find(params)

    assert(results.data.length === 1, 'the length was correct')
    assert(results.data[0]._id === 3, 'the correct record was returned')
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 1, 'total was correct')
  })

  it('find with paramsForServer option', function () {
    const { state } = this
    state.paramsForServer = ['_$client']
    const params = { query: { test: false, _$client: 'test' } }
    const results = this.getters.find(params)

    assert(results.data.length === 1, 'the length was correct')
    assert(results.data[0]._id === 3, 'the correct record was returned')
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 1, 'total was correct')
  })

  it('find with non-whitelisted custom operator fails', function () {
    const { state } = this
    const params = { query: { $client: 'test' } }
    try {
      this.getters.find(params)
    } catch (error) {
      assert(error)
    }
  })

  it('find with whitelisted custom operators', function () {
    const { state } = this
    state.whitelist = ['$regex', '$options']
    const query = {
      name: { $regex: 'marsh', $options: 'igm' }
    }
    const params = { query }
    let results
    try {
      const getters = makeGetters(state)
      results = getters.find(params)
    } catch (error) {
      assert(!error, 'should not have failed with whitelisted custom operator')
    }
    assert(results.data.length === 1, 'the length was correct')
    assert(results.data[0]._id === 2, 'the correct record was returned')
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 1, 'total was correct')
  })

  it('find works with $elemMatch', function () {
    const { state } = this
    const query = {
      movies: {
        $elemMatch: { actors: 'Jerry the Mouse' }
      }
    }
    const params = { query }
    const results = this.getters.find(params)

    assert(results.data.length === 1, 'the length was correct')
    assert(results.data[0]._id === 2, 'the correct record was returned')
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 1, 'total was correct')
  })

  it('find with limit', function () {
    const { state } = this
    const params = { query: { $limit: 1 } }
    const results = this.getters.find(params)

    assert(results.data.length === 1, 'the length was correct')
    assert(results.data[0]._id === 1, 'the correct record was returned')
    assert(results.limit === 1, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 3, 'total was correct')
  })

  it('find with skip', function () {
    const { state } = this
    const params = { query: { $skip: 1 } }
    const results = this.getters.find(params)

    assert(results.data.length === 2, 'the length was correct')
    assert(results.data[0]._id === 2, 'the correct record was returned')
    assert(results.data[1]._id === 3, 'the correct record was returned')
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 1, 'skip was correct')
    assert(results.total === 3, 'total was correct')
  })

  it('find with limit and skip', function () {
    const { state } = this
    const params = { query: { $limit: 1, $skip: 1 } }
    const results = this.getters.find(params)

    assert(results.data.length === 1, 'the length was correct')
    assert(results.data[0]._id === 2, 'the correct record was returned')
    assert(results.limit === 1, 'limit was correct')
    assert(results.skip === 1, 'skip was correct')
    assert(results.total === 3, 'total was correct')
  })

  it('find with select', function () {
    const { state } = this
    const params = { query: { $select: ['otherField'] } }
    const results = this.getters.find(params)

    assert(results.data.length === 3, 'the length was correct')
    results.data.forEach((result) => {
      assert(Object.keys(result).length <= 1, 'only one field was returned')
    })
    assert.equal(
      results.data.filter((i) => i.otherField).length,
      3,
      'three records have the field.'
    )
    assert(results.limit === 0, 'limit was correct')
    assert(results.skip === 0, 'skip was correct')
    assert(results.total === 3, 'total was correct')
  })

  it('find with sort ascending on integers', function () {
    const { state } = this
    const params = {
      query: {
        $sort: { age: 1 }
      }
    }
    const results = this.getters.find(params)

    results.data
      .map((i) => i.age)
      .reduce((oldest, current) => {
        assert(current > oldest, 'age should have been older than previous')
        return current
      }, 0)
  })

  it('find with sort descending on integers', function () {
    const { state } = this
    const params = {
      query: {
        $sort: { age: -1 }
      }
    }
    const results = this.getters.find(params)

    results.data
      .map((i) => i.age)
      .reduce((oldest, current) => {
        assert(current < oldest, 'age should have been younger than previous')
        return current
      }, 100)
  })

  it('find with sort ascending on floats', function () {
    const { state } = this
    const params = {
      query: {
        $sort: { teethRemaining: 1 }
      }
    }
    const results = this.getters.find(params)

    results.data
      .map((i) => i.teethRemaining)
      .reduce((oldest, current) => {
        assert(
          current > oldest,
          'teethRemaining should have been older than previous'
        )
        return current
      }, 0)
  })

  it('find with sort descending on floats', function () {
    const { state } = this
    const params = {
      query: {
        $sort: { teethRemaining: -1 }
      }
    }
    const results = this.getters.find(params)

    results.data
      .map((i) => i.teethRemaining)
      .reduce((oldest, current) => {
        assert(
          current < oldest,
          'teethRemaining should have been younger than previous'
        )
        return current
      }, 100)
  })

  it('count without params fails', function () {
    const { state } = this

    try {
      this.getters.count(null)
    } catch (error) {
      assert(error)
    }
  })

  it('count without query fails', function () {
    const { state } = this

    try {
      this.getters.count({})
    } catch (error) {
      assert(error)
    }
  })

  it('count returns the number of records in the store', function () {
    const { state } = this

    const total = this.getters.count({ query: {} })
    assert(total === 3, 'count is 3')
  })

  it('is*PendingById', function () {
    const { state } = this

    assert(
      this.getters.isCreatePendingById(42) === false,
      'creating status is clear'
    )
    assert(
      this.getters.isUpdatePendingById(42) === false,
      'updating status is clear'
    )
    assert(
      this.getters.isPatchPendingById(42) === false,
      'patching status is clear'
    )
    assert(
      this.getters.isRemovePendingById(42) === false,
      'removing status is clear'
    )
    assert(
      this.getters.isSavePendingById(42) === false,
      'saving status is clear'
    )
    assert(
      this.getters.isPendingById(42) === false,
      'any method pending status is clear'
    )

    // Create
    setIdPending(state, { method: 'create', id: 42 })
    assert(
      this.getters.isCreatePendingById(42) === true,
      'creating status is set'
    )
    assert(this.getters.isSavePendingById(42) === true, 'saving status is set')
    assert(
      this.getters.isPendingById(42) === true,
      'any method pending status is set'
    )

    unsetIdPending(state, { method: 'create', id: 42 })
    assert(
      this.getters.isCreatePendingById(42) === false,
      'creating status is clear'
    )
    assert(
      this.getters.isUpdatePendingById(42) === false,
      'updating status is clear'
    )
    assert(
      this.getters.isPatchPendingById(42) === false,
      'patching status is clear'
    )
    assert(
      this.getters.isRemovePendingById(42) === false,
      'removing status is clear'
    )
    assert(
      this.getters.isSavePendingById(42) === false,
      'saving status is clear'
    )
    assert(
      this.getters.isPendingById(42) === false,
      'any method pending status is clear'
    )

    // Update
    setIdPending(state, { method: 'update', id: 42 })
    assert(
      this.getters.isUpdatePendingById(42) === true,
      'updating status is set'
    )
    assert(this.getters.isSavePendingById(42) === true, 'saving status is set')
    assert(
      this.getters.isPendingById(42) === true,
      'any method pending status is set'
    )

    unsetIdPending(state, { method: 'update', id: 42 })
    assert(
      this.getters.isCreatePendingById(42) === false,
      'creating status is clear'
    )
    assert(
      this.getters.isUpdatePendingById(42) === false,
      'updating status is clear'
    )
    assert(
      this.getters.isPatchPendingById(42) === false,
      'patching status is clear'
    )
    assert(
      this.getters.isRemovePendingById(42) === false,
      'removing status is clear'
    )
    assert(
      this.getters.isSavePendingById(42) === false,
      'saving status is clear'
    )
    assert(
      this.getters.isPendingById(42) === false,
      'any method pending status is clear'
    )

    // Patch
    setIdPending(state, { method: 'patch', id: 42 })
    assert(
      this.getters.isPatchPendingById(42) === true,
      'patching status is set'
    )
    assert(this.getters.isSavePendingById(42) === true, 'saving status is set')
    assert(
      this.getters.isPendingById(42) === true,
      'any method pending status is set'
    )

    unsetIdPending(state, { method: 'patch', id: 42 })
    assert(
      this.getters.isCreatePendingById(42) === false,
      'creating status is clear'
    )
    assert(
      this.getters.isUpdatePendingById(42) === false,
      'updating status is clear'
    )
    assert(
      this.getters.isPatchPendingById(42) === false,
      'patching status is clear'
    )
    assert(
      this.getters.isRemovePendingById(42) === false,
      'removing status is clear'
    )
    assert(
      this.getters.isSavePendingById(42) === false,
      'saving status is clear'
    )
    assert(
      this.getters.isPendingById(42) === false,
      'any method pending status is clear'
    )

    // Remove
    setIdPending(state, { method: 'remove', id: 42 })
    assert(
      this.getters.isRemovePendingById(42) === true,
      'removing status is set'
    )
    assert(
      this.getters.isSavePendingById(42) === false,
      'saving status is clear for remove'
    )
    assert(
      this.getters.isPendingById(42) === true,
      'any method pending status is set'
    )

    unsetIdPending(state, { method: 'remove', id: 42 })
    assert(
      this.getters.isCreatePendingById(42) === false,
      'creating status is clear'
    )
    assert(
      this.getters.isUpdatePendingById(42) === false,
      'updating status is clear'
    )
    assert(
      this.getters.isPatchPendingById(42) === false,
      'patching status is clear'
    )
    assert(
      this.getters.isRemovePendingById(42) === false,
      'removing status is clear'
    )
    assert(
      this.getters.isSavePendingById(42) === false,
      'saving status is clear'
    )
    assert(
      this.getters.isPendingById(42) === false,
      'any method pending status is clear'
    )
  })
})
