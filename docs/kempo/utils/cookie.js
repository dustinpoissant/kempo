const saveCookie=(e,o,t=43200,i="/")=>{const n=new Date(Date.now()+60*t*1e3);document.cookie=`${e}=${o};expires=${n.toUTCString()};path=${i}`},getCookie=e=>{const o=document.cookie.split(";").map((e=>e.trim().split("="))),t=o.find((o=>o[0]===e));return t?t[1]:null},deleteCookie=e=>{document.cookie=`${e}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`};export{saveCookie,getCookie,deleteCookie};