-- TC-19 Question Bank facets: persist CEFR/grade and school-library visibility.
alter table public.questions
  add column if not exists grade text,
  add column if not exists is_public boolean not null default false;

create index if not exists idx_questions_grade on public.questions(grade);
create index if not exists idx_questions_public on public.questions(is_public) where is_public = true;

-- Teachers may discover shared school-library questions; edits remain restricted to the owner.
create policy questions_select_shared on public.questions
  for select to authenticated
  using (is_public = true);
