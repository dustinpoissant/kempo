export const fuzzyMatch=(t,r)=>{const e=((t,r)=>{const e=t.length,n=r.length,a=Array.from({length:e+1},(()=>Array(n+1).fill(0)));for(let h=0;h<=e;h++)for(let e=0;e<=n;e++)a[h][e]=0===h?e:0===e?h:Math.min(a[h-1][e-1]+(t.charAt(h-1)===r.charAt(e-1)?0:1),a[h][e-1]+1,a[h-1][e]+1);return a[e][n]})(t.toLowerCase(),r.toLowerCase());if(0===e)return 10;const n=Math.max(0,10-e/3),a=Math.min((t.length-e)/t.length,1);return Math.round(5*n+5*a)};export const fuzzyMatchArray=(t,r)=>{const e=t.map((t=>fuzzyMatch(t,r))).filter((t=>0!==t));if(0===e.length)return 0;return e.reduce(((t,r)=>t+r),0)/e.length};