export default(e,o="module")=>new Promise(((t,d)=>{const n=document.createElement("script");n.type=o,n.src=e,n.onload=t,n.onerror=d,document.head.appendChild(n)}));