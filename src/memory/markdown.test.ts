import { describe, expect, it } from 'vitest'

import { chunkMarkdown, keywordSearch, splitDreamEntries } from './markdown.js'

describe('chunkMarkdown', () => {
  it('splits at headings and blank lines with 1-based line ranges', () => {
    const text = [
      '# Title', // line 1
      'intro line', // line 2
      '', // line 3
      'paragraph two', // line 4
      'still paragraph two', // line 5
      '## Section', // line 6
      'section body', // line 7
    ].join('\n')

    const chunks = chunkMarkdown(text)

    expect(chunks.map(c => c.text)).toEqual([
      '# Title\nintro line',
      'paragraph two\nstill paragraph two',
      '## Section\nsection body',
    ])
    expect(chunks.map(c => c.lines)).toEqual([
      [1, 2],
      [4, 5],
      [6, 7],
    ])
  })

  it('skips blank chunks', () => {
    expect(chunkMarkdown('')).toEqual([])
    expect(chunkMarkdown('\n\n   \n\n')).toEqual([])
  })

  it('produces stable hex hashes per chunk text', () => {
    const [a] = chunkMarkdown('hello world')
    const [b] = chunkMarkdown('hello world')
    const [c] = chunkMarkdown('different text')

    expect(a?.hash).toMatch(/^[0-9a-f]{8}$/)
    expect(a?.hash).toBe(b?.hash)
    expect(a?.hash).not.toBe(c?.hash)
  })
})

describe('keywordSearch', () => {
  const chunks = chunkMarkdown([
    'cats are great, cats purr, cats nap', // 3x cats
    '',
    'one cats mention here', // 1x cats
    '',
    'dogs only', // 0x cats
    '',
    'cats and dogs together, cats again, dogs bark', // 2x cats + 2x dogs
  ].join('\n'))

  it('scores total term occurrences and sorts descending', () => {
    const results = keywordSearch(chunks, 'cats')

    expect(results.map(r => r.score)).toEqual([3, 2, 1])
    expect(results[0]?.chunk.text).toContain('cats purr')
    expect(results.every(r => r.source === 'memory')).toBe(true)
  })

  it('sums across multiple lowercase terms', () => {
    const results = keywordSearch(chunks, 'CATS Dogs')
    expect(results[0]?.score).toBe(4) // 2 cats + 2 dogs
    expect(results[0]?.chunk.text).toContain('together')
  })

  it('excludes zero-score chunks and respects limit', () => {
    expect(keywordSearch(chunks, 'zebra')).toEqual([])

    const limited = keywordSearch(chunks, 'cats', 2)
    expect(limited).toHaveLength(2)
    expect(limited.map(r => r.score)).toEqual([3, 2])
  })
})

describe('splitDreamEntries', () => {
  it('splits on ## headings and --- rules', () => {
    const text = [
      '## First Dream',
      'body one',
      '## Second Dream!',
      'body two',
      '---',
      'an untitled dream',
    ].join('\n')

    const entries = splitDreamEntries(text)

    expect(entries).toHaveLength(3)
    expect(entries[0]?.id).toBe('first-dream')
    expect(entries[0]?.text).toBe('## First Dream\nbody one')
    expect(entries[1]?.id).toBe('second-dream')
    expect(entries[2]?.id).toBe('dream-2')
    expect(entries[2]?.text).toBe('an untitled dream')
    expect(entries.every(e => typeof e.createdAt === 'number' && e.createdAt > 0)).toBe(true)
  })

  it('parses promoted-from lines', () => {
    const entries = splitDreamEntries([
      '## Promoted Dream',
      'promoted-from: mem-123',
      'body',
      '---',
      'plain dream',
    ].join('\n'))

    expect(entries[0]?.promotedFrom).toBe('mem-123')
    expect(entries[1]?.promotedFrom).toBeUndefined()
  })

  it('skips blank segments', () => {
    expect(splitDreamEntries('')).toEqual([])
    expect(splitDreamEntries('---\n\n---')).toEqual([])
  })
})
