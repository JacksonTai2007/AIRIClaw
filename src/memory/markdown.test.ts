import { describe, expect, it } from 'vitest'

import { chunkMarkdown, keywordSearch, splitDreamEntries } from './markdown.js'

describe('chunkMarkdown', () => {
  it('produces chunks with 1-based line ranges and stable hashes', () => {
    const md = [
      '# Title', // 1
      'intro line', // 2
      '', // 3
      '## Section', // 4
      'body one', // 5
      'body two', // 6
    ].join('\n')

    const chunks = chunkMarkdown(md)

    expect(chunks).toHaveLength(2)
    expect(chunks[0]!.lines).toEqual([1, 2])
    expect(chunks[0]!.text).toBe('# Title\nintro line')
    expect(chunks[1]!.lines).toEqual([4, 6])
    expect(chunks[1]!.text).toBe('## Section\nbody one\nbody two')

    // Hash is hex and stable across runs.
    expect(chunks[0]!.hash).toMatch(/^[0-9a-f]+$/)
    expect(chunkMarkdown(md)[0]!.hash).toBe(chunks[0]!.hash)
  })

  it('skips empty chunks', () => {
    expect(chunkMarkdown('\n\n  \n\n')).toEqual([])
  })
})

describe('keywordSearch', () => {
  it('ranks chunks by occurrence count, descending', () => {
    const chunks = chunkMarkdown(
      [
        'apple apple banana', // 3 occ of apple-ish
        '',
        'apple once',
        '',
        'no fruit here',
      ].join('\n'),
    )

    const results = keywordSearch(chunks, 'apple')

    expect(results).toHaveLength(2)
    expect(results[0]!.score).toBe(2)
    expect(results[0]!.chunk.text).toContain('apple apple')
    expect(results[1]!.score).toBe(1)
    expect(results[0]!.source).toBe('memory')
  })

  it('respects the limit and excludes zero-score chunks', () => {
    const chunks = chunkMarkdown(['cat dog', '', 'cat', '', 'cat'].join('\n'))
    const results = keywordSearch(chunks, 'cat', 2)
    expect(results).toHaveLength(2)
    expect(results.every(r => r.score > 0)).toBe(true)
  })

  it('returns nothing for an empty query', () => {
    const chunks = chunkMarkdown('hello world')
    expect(keywordSearch(chunks, '   ')).toEqual([])
  })
})

describe('splitDreamEntries', () => {
  it('parses heading-delimited entries with promoted-from', () => {
    const md = [
      '## First Dream',
      'I dreamt of databases.',
      'promoted-from: mem-42',
      '',
      '## Second Dream',
      'A second reverie.',
    ].join('\n')

    const entries = splitDreamEntries(md)

    expect(entries).toHaveLength(2)
    expect(entries[0]!.id).toBe('first-dream')
    expect(entries[0]!.text).toBe('I dreamt of databases.')
    expect(entries[0]!.promotedFrom).toBe('mem-42')
    expect(entries[1]!.id).toBe('second-dream')
    expect(entries[1]!.promotedFrom).toBeUndefined()
  })

  it('parses rule-delimited entries and falls back to index ids', () => {
    const md = ['no heading here', '---', 'another block'].join('\n')
    const entries = splitDreamEntries(md)
    expect(entries).toHaveLength(2)
    expect(entries[0]!.id).toBe('0')
    expect(entries[1]!.id).toBe('1')
    expect(entries[0]!.text).toBe('no heading here')
  })
})
