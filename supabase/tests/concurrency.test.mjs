// Optional real multi-connection test. Requires a disposable local Postgres/Supabase
// with the migration applied. Never accepts a remote database or credentials in args.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const connection = process.env.BOOKING_TEST_DATABASE_URL;
function psql(sql) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.PSQL_BIN || 'psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{
      env:{...process.env,PGDATABASE:connection},stdio:['pipe','pipe','pipe'],
    });
    let out='',err='';child.stdout.on('data',v=>out+=v);child.stderr.on('data',v=>err+=v);
    child.on('error',reject);child.on('close',code=>resolve({code,out:out.trim(),err}));child.stdin.end(sql);
  });
}
test('two PostgreSQL sessions: overlap is rejected and same-request retry is idempotent', {skip:!connection}, async()=>{
  const url=new URL(connection);
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Only a disposable local database is allowed');
  assert.equal(process.env.BOOKING_TEST_ALLOW_LOCAL,'yes','Explicitly confirm the local database is disposable');
  const slots=[crypto.randomUUID(),crypto.randomUUID()];
  const requests=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
  const base=`date_trunc('hour', now()) + interval '10 days'`;
  const created=await psql(`insert into booking_private.availability_slots(id,starts_at,ends_at) values
    ('${slots[0]}',${base},${base}+interval '1 hour'),
    ('${slots[1]}',${base}+interval '2 hours',${base}+interval '3 hours');`);
  assert.equal(created.code,0,created.err);
  const payload=(slot,id)=>({type:'1a1',plan:4,slotId:slot,requestId:id,timezone:'Europe/Warsaw',language:'es',student:{name:'Concurrent test',email:`${id}@example.invalid`,phone:'',country:'',message:'',spanishLevel:'',language:'es'}});
  const sql=value=>`select public.booking_create('${JSON.stringify(value)}'::jsonb)->>'id';`;
  async function race(first,second) {
    // The winner holds its transaction while the second connection tries to insert.
    // Poll that transaction's advisory lock to synchronize the actual overlap.
    const a=psql(`begin; ${sql(first)} select pg_sleep(3); commit;`);
    let ready=false;
    for(let i=0;i<80;i++){
      const result=await psql(`select exists(select 1 from pg_locks where locktype='advisory' and granted);`);
      if(result.out==='t'){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    assert.ok(ready,'The first transaction must be running before the second starts');
    const b=psql(sql(second));
    return Promise.all([a,b]);
  }
  try{
    const [first,second]=await race(payload(slots[0],requests[0]),payload(slots[0],requests[1]));
    assert.equal(first.code,0,first.err);assert.notEqual(second.code,0);
    assert.match(second.err,/SLOT_UNAVAILABLE/);
    const same=payload(slots[1],requests[2]);
    const [retry1,retry2]=await race(same,same);
    assert.equal(retry1.code,0,retry1.err);assert.equal(retry2.code,0,retry2.err);
    assert.equal(retry1.out.trim(),retry2.out.trim());
    const count=await psql(`select count(*) from booking_private.bookings where slot_id in ('${slots[0]}','${slots[1]}');`);
    assert.equal(count.out,'2');
  } finally {
    await psql(`delete from booking_private.bookings where request_id in (${requests.map(id=>`'${id}'`).join(',')});
      delete from booking_private.availability_slots where id in ('${slots[0]}','${slots[1]}');`);
  }
});
