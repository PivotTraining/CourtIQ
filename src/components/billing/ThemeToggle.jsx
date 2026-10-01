'use client';
import { useEffect, useState } from 'react';
export default function ThemeToggle() {
  const [dark,setDark]=useState(()=>{
    if(typeof window==='undefined')return true;
    try{return localStorage.getItem('courtiq-theme')!=='light';}catch{return true;}
  });
  useEffect(()=>{
    document.documentElement.classList.toggle('dark',dark);
    try{localStorage.setItem('courtiq-theme',dark?'dark':'light');}catch{/* Optional preference storage. */}
  },[dark]);
  return <button aria-label={dark?'Switch to light mode':'Switch to dark mode'} onClick={()=>setDark(!dark)}>{dark?'Light mode':'Dark mode'}</button>;
}
