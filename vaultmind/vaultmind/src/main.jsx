import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <Auth0Provider
    domain="dev-qlc3lak0ulo5004s.us.auth0.com"
    clientId="iFyjGhllUum4R1UMgGUU59CumHW55yCa"
    authorizationParams={{
      redirect_uri: window.location.origin,
      audience: 'https://vaultmind.api',
    }}
  >
    <App />
  </Auth0Provider>
)