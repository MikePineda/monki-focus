// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApiRequest, ApiResponse } from '@japa/api-client'

/** Sends the request (if needed), asserts its status and answers the response. */
export async function expectStatus(request: ApiRequest | Promise<ApiResponse>, status: number) {
  const response = await request
  response.assertStatus(status)
  return response
}

/** Sends the request (if needed), asserts its exact body and answers the response. */
export async function expectBody(request: ApiRequest | Promise<ApiResponse>, body: unknown) {
  const response = await request
  response.assertBody(body)
  return response
}
