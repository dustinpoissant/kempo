const args={};let win={};"undefined"!=typeof window?win=window:"undefined"!=typeof global&&(win=global),win.log=(...e)=>{args.debug&&console.log(...e)};export default(e={d:"debug"})=>{let s="",t=[];const n=()=>{s&&(0===t.length?args[s]=!0:1===t.length?args[s]=t[0]:args[s]=t)};for(let g=2;g<process.argv.length;g++){const o=process.argv[g];o.startsWith("-")?(n(),o.startsWith("--")?s=o.slice(2):(s=o.slice(1),e[s]&&(s=e[s])),t=[]):t.push(o)}return n(),args};