import { assert } from 'chai'
import { read, ReadStream, wait } from './'

function bufferStream () {
  const values = [Buffer.from('12'), Buffer.from('3'), Buffer.from('4'), null]
  return read({ objectMode: false }, () => values.shift())
}

function promiseImmediate (data?) {
  return new Promise(resolve => setImmediate(() => resolve(data)))
}

describe('ReadStream', () => {
  describe('constructors', () => {
    it('read()', async () => {
      assert.instanceOf(read(async () => {}), ReadStream)
    })

    it('new ReadStream()', async () => {
      const stream = new ReadStream(() => {})
      assert.instanceOf(stream, ReadStream)
    })

    it('allows extension', async () => {
      const arr = [1, 2, 3, null]
      class MyRead extends ReadStream {
        public _read () {
          this.push(arr.shift())
        }
      }
      const stream = new MyRead()
      let sum = 0
      stream.on('data', data => {
        sum += (data as any)
      })
      await wait(stream)
      assert.equal(sum, 6)
    })
  })

  it('works with .push', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(function () {
      this.push(arr.shift())
    })
    let sum = 0
    stream.on('data', data => {
      sum += (data as any)
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('works with .push of a promise', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(function () {
      this.push(Promise.resolve(arr.shift()))
    })
    let sum = 0
    stream.on('data', data => {
      sum += (data as any)
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('pushes a return value', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(() => {
      return arr.shift()
    })
    let sum = 0
    stream.on('data', data => {
      sum += (data as any)
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('pushes a promise return', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(async () => {
      return arr.shift()
    })
    let sum = 0
    stream.on('data', data => {
      sum += (data as any)
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('allows not returning a value', async () => {
    const arr = [1, 2, undefined, 3, null]
    const stream = read(() => {
      return arr.shift()
    })
    let sum = 0
    stream.on('data', data => {
      sum += (data as any)
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('allows not calling .push in a call', async () => {
    const arr = [1, 2, undefined, 3, null]
    const stream = read(function () {
      const data = arr.shift()
      if (data !== undefined) {
        this.push(data)
      }
    })
    let sum = 0
    stream.on('data', data => {
      sum += (data as any)
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('allows pushing async and returning sync', async () => {
    let callCount = 0
    const stream = read(function () {
      callCount++
      this.push(promiseImmediate(1))
      this.push(promiseImmediate(2))
      return null
    })
    let sum = 0
    stream.on('data', data => {
      sum += (data as any)
    })
    await wait(stream)
    assert.equal(sum, 3)
    assert.equal(callCount, 1)
  })

  it('does not call read until all pushed values have resolved to check for null', async () => {
    let callCount = 0
    const stream = read(function () {
      callCount++
      this.push(promiseImmediate(1))
      this.push(promiseImmediate(2))
      this.push(null)
    })
    let sum = 0
    stream.on('data', data => {
      sum += (data as any)
    })
    await wait(stream)
    assert.equal(sum, 3)
    assert.equal(callCount, 1)
  })

  it('allows for an external pushing of null to end the stream early', async () => {
    let callCount = 0
    let pushCount = 0
    const stream = read(async function () {
      callCount++
      this.push(await promiseImmediate(1))
      pushCount++
      this.push(await promiseImmediate(2))
      pushCount++
    })
    let sum = 0
    stream.on('data', data => {
      sum += (data as any)
    })
    await promiseImmediate()
    await promiseImmediate()
    assert.equal(1, pushCount)
    stream.push(null)
    await wait(stream)
    assert.equal(sum, 3)
    assert.equal(callCount, 1)
  })

  it('#promise()', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(() => arr.shift())
    await stream.promise()
    assert.equal(arr.length, 0)
  })

  it('supports async iterators', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(() => arr.shift())
    const asyncArray: any[] = []
    for await (const val of (stream as any)) {
      asyncArray.push(val)
    }
    assert.deepEqual(asyncArray, [1, 2, 3])
  })

  it('supports async iterators with buffers', async () => {
    const stream = bufferStream()
    const valuesArray: any[] = []
    for await (const val of (stream as any)) {
      valuesArray.push(val)
    }
    assert.deepEqual(Buffer.concat(valuesArray), Buffer.from('1234'))
  })
})
