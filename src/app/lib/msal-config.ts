import {
  BrowserCacheLocation,
  type Configuration,
  LogLevel,
  PublicClientApplication,
} from "@azure/msal-browser"

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const clientId = getRequiredEnv(
  "VITE_AZURE_CLIENT_ID",
  import.meta.env.VITE_AZURE_CLIENT_ID,
)
const tenantId = getRequiredEnv(
  "VITE_AZURE_TENANT_ID",
  import.meta.env.VITE_AZURE_TENANT_ID,
)

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.SessionStorage,
  },
  system: {
    loggerOptions: {
      logLevel: import.meta.env.DEV ? LogLevel.Info : LogLevel.Error,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return
        }

        if (level === LogLevel.Error) {
          console.error(message)
        } else if (level === LogLevel.Warning) {
          console.warn(message)
        }
      },
    },
    tokenRenewalOffsetSeconds: 300,
  },
}

export const loginRequest = {
  scopes: [`${clientId}/.default`],
}

export const msalInstance = new PublicClientApplication(msalConfig)

export async function initializeMsal(): Promise<void> {
  await msalInstance.initialize()

  const response = await msalInstance.handleRedirectPromise()
  if (response?.account) {
    msalInstance.setActiveAccount(response.account)
    return
  }

  const account = msalInstance.getAllAccounts()[0]
  if (account) {
    msalInstance.setActiveAccount(account)
  }
}
