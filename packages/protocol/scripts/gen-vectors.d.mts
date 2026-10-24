// SPDX-License-Identifier: AGPL-3.0-or-later
/** Types for `gen-vectors.mjs`, used by the regeneration test. */
export interface VectorFile {
  /** Path relative to the package root. */
  readonly path: string
  readonly content: string
}

export function generateVectors(): Promise<VectorFile[]>

/** Paths whose committed content differs from the generator output. */
export function driftedVectors(): Promise<string[]>
