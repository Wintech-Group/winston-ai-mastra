import { ClientSecretCredential } from "@azure/identity"

const GRAPH_SCOPE = "https://graph.microsoft.com/.default"

let credential: ClientSecretCredential | null = null

function getCredential(): ClientSecretCredential {
  if (!credential) {
    const tenantId = process.env.AZURE_TENANT
    const clientId = process.env.AZURE_CLIENT_ID
    const clientSecret = process.env.AZURE_CLIENT_SECRET

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        "Missing required environment variables: AZURE_TENANT, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET",
      )
    }

    credential = new ClientSecretCredential(tenantId, clientId, clientSecret)
  }
  return credential
}

export async function getAccessToken(): Promise<string> {
  const cred = getCredential()
  const tokenResponse = await cred.getToken(GRAPH_SCOPE)

  if (!tokenResponse?.token) {
    throw new Error("Failed to acquire access token")
  }

  return tokenResponse.token
}
