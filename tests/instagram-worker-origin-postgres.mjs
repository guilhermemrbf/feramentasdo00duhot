import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {resolve} from "node:path";
const require=createRequire(resolve(process.env.INTELLIGENCE_PG_TEST_DEPS||".","package.json"));
const {PGlite}=require("@electric-sql/pglite");const db=new PGlite();
const old="https://feramentasdo00duhot.lovable.app/api/instagram/worker", current="https://mausehot.lovable.app/api/instagram/worker";
try {
 await db.exec(`create schema cron;create table cron.job(jobid bigint primary key,jobname text,command text,active boolean,schedule text);
 create function cron.alter_job(job_id bigint,command text) returns void language sql as $$update cron.job set command=$2 where jobid=$1$$;
 create function public.enable_instagram_worker() returns text language sql security definer set search_path='' as $$select '${old}'::text$$;
 insert into cron.job values(1,'00duhot-instagram-worker','${old} Bearer protected-vault-reference',true,'* * * * *'),(2,'00duhot-instagram-analytics','${old}?job=analytics Analytics protected-vault-reference',true,'0 */6 * * *'),(3,'unrelated-job','${old}',true,'* * * * *');`);
 const sql=await readFile(new URL('../supabase/migrations/20261115210000_repair_instagram_publisher_origin.sql',import.meta.url),'utf8');
 assert.equal((await db.query('select enable_instagram_worker() url')).rows[0].url,old);
 await db.exec(sql);
 const rows=(await db.query('select * from cron.job order by jobid')).rows;
 assert.equal((await db.query('select enable_instagram_worker() url')).rows[0].url,current);
 assert.equal(rows[0].command,current+' Bearer protected-vault-reference');assert.equal(rows[1].command,current+'?job=analytics Analytics protected-vault-reference');assert.equal(rows[2].command,old);
 assert.equal(rows[0].active,true);assert.equal(rows[1].schedule,'0 */6 * * *');
 await db.exec(sql);assert.deepEqual((await db.query('select * from cron.job order by jobid')).rows,rows);
 console.log('PASS: publisher function and two cron origins repaired; schedules, auth references and unrelated jobs preserved; migration idempotent. Fixtures only.');
} finally {await db.close();}
