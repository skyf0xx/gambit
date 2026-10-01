import { describe, it, expect } from 'vitest';
import { joinResults } from '../src/lib/dictation';

describe('joinResults', () => {
  it('keeps desktop results as they are', () => {
    expect(joinResults(['I want to', ' open a salon'])).toBe('I want to open a salon');
  });
  it('spaces Android results that arrive without spacing', () => {
    expect(joinResults(['I want to', 'open a salon'])).toBe('I want to open a salon');
  });
  it('collapses Android results that repeat the one before', () => {
    expect(joinResults(['I', 'I want', 'I want to', 'I want to open a salon'])).toBe('I want to open a salon');
  });
  it('drops a result already covered by the previous one', () => {
    expect(joinResults(['I want to open', 'I want'])).toBe('I want to open');
  });
});
