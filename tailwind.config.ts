import type { Config } from 'tailwindcss'
export default {
  content:['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  theme:{extend:{
    colors:{denim:'#1560BD',lammetna:{DEFAULT:'#1560BD',dark:'#0D3D78',blue:'#104F9B',soft:'#EAF2FC',mint:'#D7E7FB',surface:'#F8FAFD',gold:'#B88724',purple:'#7657FF',cyan:'#1FC9DA'}},
    borderRadius:{xl2:'1.25rem',lammetna:'1.75rem'},
    boxShadow:{soft:'0 12px 34px rgba(21,96,189,.09)',glow:'0 18px 48px rgba(21,96,189,.16)'}
  }},
  plugins:[]
} satisfies Config