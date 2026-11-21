import assert from 'node:assert/strict'
import test from 'node:test'
import { createExpansionGate, resetExpansionGates } from './run-control'

test('Stop from another surface aborts the owner and drops a later Saved entry', () => {
  resetExpansionGates()
  let clock = 1_000
  const viewer = createExpansionGate(() => clock)
  const popup = createExpansionGate(() => clock)
  const started = viewer.begin()
  assert.equal(started.ok, true)
  if (!started.ok) return

  const suggestions = ['yoga mat thick', 'yoga mat towel']
  assert.equal(viewer.acceptProgress('running'), true)

  assert.equal(popup.stop(started.startedAt), true)
  assert.equal(started.signal.aborted, true)
  assert.equal(viewer.stopped, true)
  assert.equal(viewer.acceptProgress('running'), false)
  assert.equal(viewer.acceptProgress('done'), false)
  assert.equal(viewer.acceptProgress('cancelled'), true)

  const history: Array<{ status: string; count: number }> = []
  const record = (status: 'running' | 'done' | 'cancelled', count: number) => {
    if (!viewer.acceptProgress(status) || status === 'running') return
    history.push({ status, count })
  }
  record('cancelled', suggestions.length)
  record('done', 341)
  assert.deepEqual(history, [{ status: 'cancelled', count: 2 }])
  assert.deepEqual(suggestions, ['yoga mat thick', 'yoga mat towel'])
})

test('Stop blocks the click from starting a second run', () => {
  resetExpansionGates()
  let clock = 5_000
  const gate = createExpansionGate(() => clock)
  const first = gate.begin()
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.equal(gate.stop(first.startedAt), true)
  clock += 200
  assert.equal(gate.begin().ok, false)
  clock += 2_000
  assert.equal(gate.begin().ok, true)
})
