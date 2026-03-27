/**
 * Azure OpenAI + API Management (APIM) helpers.
 * APIM gateways (e.g. *.azure-api.net) often require Ocp-Apim-Subscription-Key;
 * native Cognitive Services endpoints use api-key.
 */

export function normalizeAzureEndpoint(endpoint: string): string {
  let e = endpoint.trim().replace(/\/+$/, '')
  if (!e.startsWith('http://') && !e.startsWith('https://')) {
    e = `https://${e}`
  }
  return e
}

/**
 * Returns true if the base URL looks like Azure API Management (custom gateway prefix path is OK).
 */
export function isAzureApiManagementHost(endpointNormalized: string): boolean {
  try {
    return new URL(endpointNormalized).hostname.includes('azure-api.net')
  } catch {
    return false
  }
}

/** Auth headers for Azure OpenAI (GET or POST). APIM gateways often need Ocp-Apim-Subscription-Key. */
export function azureOpenAiAuthHeaders(
  apiKey: string,
  endpointNormalized: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'api-key': apiKey,
  }
  if (isAzureApiManagementHost(endpointNormalized)) {
    headers['Ocp-Apim-Subscription-Key'] = apiKey
  }
  return headers
}

/** JSON POST headers (chat completions). */
export function azureOpenAiJsonHeaders(apiKey: string, endpointNormalized: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...azureOpenAiAuthHeaders(apiKey, endpointNormalized),
  }
}

/** Default deployment name when switching to Azure OpenAI (must match your Azure/APIM deployment id). */
export const DEFAULT_AZURE_DEPLOYMENT_ID = 'gpt-4o-2024-11-20'
