import type { NextConfig } from 'next'

// External provider origins must be added explicitly when TURN, KYC, payouts, IAP webhooks, or ads are configured.
const contentSecurityPolicy=[
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "media-src 'self' blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders=[
  {key:'Content-Security-Policy',value:contentSecurityPolicy},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(self), microphone=(self), geolocation=()'},
  {key:'X-DNS-Prefetch-Control',value:'off'},
]

const nextConfig:NextConfig={
  reactStrictMode:true,
  async headers(){
    return [{source:'/(.*)',headers:securityHeaders}]
  },
}

export default nextConfig
