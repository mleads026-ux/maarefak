import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'لمتنا',
    short_name: 'لمتنا',
    description: 'مساحتك للتعارف والتواصل',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1560BD',
    orientation: 'portrait',
    lang: 'ar',
    dir: 'rtl',
  }
}
