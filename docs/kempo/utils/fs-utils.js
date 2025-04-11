import fs from"fs/promises";import path from"path";export async function ensureDir(i){try{await fs.mkdir(i,{recursive:!0})}catch(i){if("EEXIST"!==i.code)throw i}}export async function copyDir(i,r){await ensureDir(r);const t=await fs.readdir(i,{withFileTypes:!0});for(const a of t){const t=path.join(i,a.name),o=path.join(r,a.name);a.isDirectory()?await copyDir(t,o):await fs.copyFile(t,o)}}export async function emptyDir(i){try{const r=await fs.readdir(i);await Promise.all(r.map((r=>fs.rm(path.join(i,r),{recursive:!0,force:!0}))))}catch(i){if("ENOENT"!==i.code)throw i}}