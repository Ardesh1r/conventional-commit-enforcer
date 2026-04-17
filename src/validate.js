'use strict';

/**
 * Builds the Conventional Commits regex for the given configuration.
 *
 * Pattern: type(scope)!: description
 *   - type      — one of the allowed types (case-insensitive)
 *   - (scope)   — optional unless requireScope is true
 *   - !         — optional breaking-change marker
 *   - :         — required separator
 *   - description — at least one non-whitespace character after the space
 */
function buildPattern(types, requireScope, scopePattern) {
  const escapedTypes = types.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const scope = requireScope
    ? `\\(${scopePattern}\\)`
    : `(?:\\(${scopePattern}\\))?`;
  return new RegExp(`^(${escapedTypes})${scope}(!)?:\\s\\S.*$`, 'i');
}

/**
 * Validates a single commit subject line.
 *
 * @param {string} subject  - First line of the commit message.
 * @param {RegExp} pattern  - Compiled regex from buildPattern().
 * @param {boolean} ignoreMerge - Skip merge commits.
 * @returns {{ valid: boolean, skipped: boolean }}
 */
function validateSubject(subject, pattern, ignoreMerge) {
  if (ignoreMerge && /^Merge /i.test(subject)) {
    return { valid: true, skipped: true };
  }
  return { valid: pattern.test(subject), skipped: false };
}

module.exports = { buildPattern, validateSubject };
