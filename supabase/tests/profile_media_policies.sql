-- Own profile media is writable. Another user's folder and baked document copies are not.
-- Run with `supabase test db` after the profile-media migration.

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('profile-media','signatures/00000000-0000-0000-0000-00000000000a/current.png')$$,
  'own signature'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('profile-media','signatures/00000000-0000-0000-0000-00000000000b/current.png')$$,
  '42501',
  null,
  'other user blocked'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('profile-media','document-signatures/invoice/x/prepared.png')$$,
  '42501',
  null,
  'baked path blocked'
);

select * from finish();
rollback;
