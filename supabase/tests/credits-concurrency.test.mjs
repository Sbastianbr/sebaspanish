/** Opt-in real PostgreSQL races against the linked DEVELOPMENT project only.
 * Creates isolated, disabled test slots beyond the public 60-day horizon.
 * Finally deletes only this run's UUID-owned fixtures; never existing bookings.
 * No SDK, database password, psql or new application dependency required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const allowedDevelopment = 'vvvugnkvtkcfuwxroies';
const enabled = process.env.CREDIT_TEST_ALLOW_DEVELOPMENT === 'yes';

test('Phase 2A: concurrent activation, allocation and retry in Development', {
  skip: !enabled, timeout: 180_000,
}, async (t) => {
  // Explicit opt-in and fixed environment guard: never point this runner at production.
  assert.equal(process.env.CREDIT_TEST_PROJECT_REF, allowedDevelopment);
  assert.equal((await readFile(resolve(root, 'supabase/.temp/project-ref'), 'utf8')).trim(), allowedDevelopment);
  const folder = await mkdtemp(join(tmpdir(), 'seba-credit-race-'));
  const cli = process.env.SUPABASE_BIN || 'supabase';
  const student = randomUUID();
  const bookings = [randomUUID(), randomUUID()];
  const slots = [randomUUID(), randomUUID()];
  const request = randomUUID();
  const payment = randomUUID();
  const event = randomUUID();
  let queryNumber = 0;
  let setupStarted = false;

  async function query(sql) {
    const number = ++queryNumber;
    const path = join(folder, `${number}.sql`);
    await writeFile(path, sql);
    try {
      const { stdout } = await execFileAsync(cli, ['db', 'query', '--linked', '--project-ref', allowedDevelopment, '--file', path, '--output', 'json'], {
        cwd: root, timeout: 45_000, maxBuffer: 1_000_000,
      });
      // CLI may precede JSON with login status. Never print secrets or raw CLI diagnostics.
      const start = stdout.indexOf('{');
      const data = JSON.parse(stdout.slice(start));
      assert.ok(Array.isArray(data.rows), 'CLI query returned rows');
      return data.rows;
    } catch (error) {
      throw new Error(`Development SQL query ${number} failed; fixtures are cleaned in finally.`, { cause: error });
    }
  }

  // Fetch an existing server credential for this opt-in test, in memory only.
  // It never enters SQL files, logs, the repo, environment variables or the browser.
  let serverKey;
  try {
    const { stdout } = await execFileAsync(cli, ['projects', 'api-keys', '--project-ref', allowedDevelopment,
      '--reveal', '--output', 'json'], { cwd: root, timeout: 30_000, maxBuffer: 1_000_000 });
    const data = JSON.parse(stdout);
    const keys = Array.isArray(data) ? data : data.api_keys;
    serverKey = keys?.find((key) => key.name === 'service_role')?.api_key;
    assert.ok(serverKey?.startsWith('eyJ'), 'Development server credential available');
  } catch {
    await rm(folder, { recursive: true, force: true });
    throw new Error('Cannot load Development server credential for the opt-in RPC test. No key was printed.');
  }

  async function rpc(name, args) {
    const response = await fetch(`https://${allowedDevelopment}.supabase.co/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: serverKey, Authorization: `Bearer ${serverKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(30_000),
    });
    return { ok: response.ok, status: response.status, body: await response.json() };
  }

  async function cleanup() {
    const cleanupRows = await query(`begin;
      delete from booking_private.credit_events where purchase_id in
        (select id from booking_private.purchases where student_id='${student}');
      delete from booking_private.credit_allocations where credit_id in
        (select c.id from booking_private.credits c join booking_private.purchases p on p.id=c.purchase_id where p.student_id='${student}');
      delete from booking_private.credits where purchase_id in
        (select id from booking_private.purchases where student_id='${student}');
      delete from booking_private.purchases where student_id='${student}';
      delete from booking_private.bookings where id in ('${bookings[0]}','${bookings[1]}')
        and student_email='${student}@example.invalid';
      delete from booking_private.availability_slots where id in ('${slots[0]}','${slots[1]}') and not enabled;
      delete from booking_private.students where id='${student}' and email='${student}@example.invalid';
      commit;
      select (select count(*) from booking_private.students where id='${student}')+
        (select count(*) from booking_private.bookings where id in ('${bookings[0]}','${bookings[1]}'))+
        (select count(*) from booking_private.availability_slots where id in ('${slots[0]}','${slots[1]}')) as remaining;`);
    assert.equal(Number(cleanupRows[0].remaining), 0, 'all technical student, booking and slot fixtures removed');
  }

  try {
    setupStarted = true;
    const purchases = await query(`begin;
      insert into booking_private.students(id,email,name,contact_language)
        values('${student}','${student}@example.invalid','Phase 2A concurrency fixture','es');
      insert into booking_private.availability_slots(id,starts_at,ends_at,enabled) values
        ('${slots[0]}',date_trunc('day',now())+interval '70 days',date_trunc('day',now())+interval '70 days 1 hour',false),
        ('${slots[1]}',date_trunc('day',now())+interval '70 days 2 hours',date_trunc('day',now())+interval '70 days 3 hours',false);
      insert into booking_private.bookings(id,request_id,request_fingerprint,slot_id,offer_code,booking_type,plan,sessions,
        duration_minutes,price_minor,currency,starts_at,ends_at,timezone,language,student_name,student_email,contact_language)
      select case when id='${slots[0]}' then '${bookings[0]}'::uuid else '${bookings[1]}'::uuid end,
        gen_random_uuid(),'phase2a-concurrency-fixture',id,'1a1-1','1a1',1,1,60,6500,'PLN',starts_at,ends_at,
        'Europe/Warsaw','es','Phase 2A concurrency fixture','${student}@example.invalid','es'
      from booking_private.availability_slots where id in ('${slots[0]}','${slots[1]}');
      select public.purchase_prepare('${student}','1a1-1','${randomUUID()}');
      commit;
      select id from booking_private.purchases where student_id='${student}';`);
    assert.equal(purchases.length, 1);
    const purchase = purchases[0].id;
    assert.match(purchase, /^[a-f0-9-]{36}$/);
    const activationArgs = { p_purchase_id: purchase, p_external_source: 'phase2a-concurrency',
      p_external_payment_id: payment, p_external_event_id: event };
    await t.test('same external activation event produces exactly one credit', async () => {
      const [first, second] = await Promise.all([
        rpc('purchase_activate', activationArgs), rpc('purchase_activate', activationArgs),
      ]);
      assert.equal(first.ok, true, 'first activation succeeds');
      assert.equal(second.ok, true, 'concurrent activation retry succeeds');
      assert.deepEqual(first.body, second.body);
      const counts = await query(`select
        (select count(*) from booking_private.credits where purchase_id='${purchase}') as credits,
        (select count(*) from booking_private.credit_events where purchase_id='${purchase}' and action='purchase_activated') as events;`);
      assert.equal(Number(counts[0].credits), 1);
      assert.equal(Number(counts[0].events), 1);
    });
    const creditRows = await query(`select id from booking_private.credits where purchase_id='${purchase}';`);
    assert.equal(creditRows.length, 1, 'activation committed exactly one credit');
    const credit = creditRows[0].id;
    assert.match(credit, /^[a-f0-9-]{36}$/);
    const allocationArgs = bookings.map((booking, index) => ({ p_student_id: student, p_booking_id: booking,
      p_request_id: index === 0 ? request : randomUUID(), p_credit_id: credit }));
    let receipt;
    let winnerArgs;
    await t.test('two different bookings cannot allocate the same credit', async () => {
      const results = await Promise.all(allocationArgs.map((args) => rpc('credit_allocate', args)));
      const winners = results.filter((result) => result.ok);
      const losers = results.filter((result) => !result.ok);
      assert.equal(winners.length, 1, 'exactly one concurrent booking obtains the unit');
      assert.equal(losers.length, 1);
      assert.equal(losers[0].body.message, 'CREDIT_UNAVAILABLE');
      receipt = winners[0].body;
      winnerArgs = allocationArgs[results.findIndex((result) => result.ok)];
      assert.equal(receipt.status, 'reserved');
      const rows = await query(`select count(*) as active from booking_private.credit_allocations
        where credit_id='${credit}' and status in ('reserved','consumed');`);
      assert.equal(Number(rows[0].active), 1);
    });
    await t.test('lost-response allocation retry returns its original receipt', async () => {
      assert.ok(winnerArgs, 'concurrent allocation produced a winner');
      const result = await rpc('credit_allocate', winnerArgs);
      assert.equal(result.ok, true);
      assert.deepEqual(result.body, receipt);
    });
  } finally {
    try {
      if (setupStarted) await cleanup();
    } finally {
      serverKey = undefined;
      await rm(folder, { recursive: true, force: true });
    }
  }
});
