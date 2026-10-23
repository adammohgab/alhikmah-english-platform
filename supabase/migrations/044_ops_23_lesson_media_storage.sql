-- TC-11: storage bucket and ownership policies for lesson editor media.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-media',
  'lesson-media',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','audio/aac']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public reads are intentional so published lesson media can be played by students.
create policy "lesson media public read"
on storage.objects for select
to public
using (bucket_id = 'lesson-media');

create policy "lesson media lesson owner upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'lesson-media'
  and (storage.foldername(name))[1] = 'lessons'
  and public.owns_lesson(((storage.foldername(name))[2])::uuid)
);

create policy "lesson media lesson owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'lesson-media'
  and (storage.foldername(name))[1] = 'lessons'
  and public.owns_lesson(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'lesson-media'
  and (storage.foldername(name))[1] = 'lessons'
  and public.owns_lesson(((storage.foldername(name))[2])::uuid)
);

create policy "lesson media lesson owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'lesson-media'
  and (storage.foldername(name))[1] = 'lessons'
  and public.owns_lesson(((storage.foldername(name))[2])::uuid)
);
