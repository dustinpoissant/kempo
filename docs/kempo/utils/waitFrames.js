export default(e=1)=>new Promise((t=>{let n=0;requestAnimationFrame((function i(){n++,n>=e?t():requestAnimationFrame(i)}))}));