-- Stores student answers and server-calculated scores for each question.
create table if not exists public.attempt_answers (
  attempt_id uuid not null
    references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null
    references public.questions(id) on delete cascade,
  answer jsonb not null default 'null'::jsonb,
  is_correct boolean,
  points_awarded numeric(7,2) not null default 0,
  updated_at timestamptz not null default public.app_now(),
  primary key (attempt_id, question_id)
);

alter table public.attempt_answers enable row level security;

create policy "Students read their own attempt answers"
  on public.attempt_answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.assessment_attempts aa
      where aa.id = attempt_answers.attempt_id
        and aa.student_id = (select auth.uid())
    )
  );

revoke all on public.attempt_answers from public, anon, authenticated;
grant select on public.attempt_answers to authenticated;


create or replace function public.save_quiz_answers(
  attempt_id uuid,
  answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_entry record;
  v_question_id uuid;
  v_now timestamptz := public.app_now();
  v_saved integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if answers is null or jsonb_typeof(answers) <> 'object' then
    raise exception 'Answers must be a JSON object keyed by question ID'
      using errcode = '22023';
  end if;

  select aa.*
    into v_attempt
  from public.assessment_attempts aa
  where aa.id = save_quiz_answers.attempt_id
    and aa.student_id = auth.uid()
  for update;

  if not found then
    raise exception 'Quiz attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'Quiz attempt is not in progress' using errcode = '55000';
  end if;

  if v_attempt.expires_at is not null and v_now > v_attempt.expires_at then
    raise exception 'Quiz attempt has expired' using errcode = '55000';
  end if;

  for v_entry in
    select key, value
    from jsonb_each(answers)
  loop
    begin
      v_question_id := v_entry.key::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid question ID in answers'
        using errcode = '22023';
    end;

    if not (v_attempt.question_order @> jsonb_build_array(v_question_id::text)) then
      raise exception 'Answer includes a question outside this attempt'
        using errcode = '22023';
    end if;

    insert into public.attempt_answers (attempt_id, question_id, answer, updated_at)
    values (v_attempt.id, v_question_id, v_entry.value, v_now)
    on conflict (attempt_id, question_id)
    do update set
      answer = excluded.answer,
      updated_at = excluded.updated_at;

    v_saved := v_saved + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saved', v_saved);
end;
$$;


create or replace function public.submit_quiz_attempt(attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_assessment public.assessments%rowtype;
  v_question record;
  v_answer jsonb;
  v_given jsonb;
  v_expected jsonb;
  v_accepted jsonb;
  v_expected_ids text[];
  v_given_ids text[];
  v_expected_count integer;
  v_correct_count integer;
  v_blank_index integer;
  v_ratio numeric;
  v_points numeric;
  v_awarded numeric := 0;
  v_max_score numeric := 0;
  v_score_pct numeric := 0;
  v_all_auto_graded boolean := true;
  v_is_correct boolean;
  v_now timestamptz := public.app_now();
  v_previous_best_pct numeric := 0;
  v_new_best_pct numeric;
  v_xp_for_best integer;
  v_xp_for_previous_best integer;
  v_xp_delta integer;
  v_coin_reward integer := 0;
  v_coin_ledger_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select aa.*
    into v_attempt
  from public.assessment_attempts aa
  where aa.id = submit_quiz_attempt.attempt_id
    and aa.student_id = auth.uid()
  for update;

  if not found then
    raise exception 'Quiz attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'Quiz attempt is not in progress' using errcode = '55000';
  end if;

  if v_attempt.expires_at is not null
     and v_now > v_attempt.expires_at + interval '30 seconds' then
    raise exception 'Quiz attempt time limit exceeded' using errcode = '55000';
  end if;

  -- Serialize submissions for this quiz so attempts cannot double-award rewards.
  select a.*
    into v_assessment
  from public.assessments a
  where a.id = v_attempt.assessment_id
  for update;

  if not found then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  for v_question in
    select
      q.id as question_id,
      q.question_type::text as question_type,
      q.correct_answer,
      coalesce(aq.points_override, q.points)::numeric as points
    from jsonb_array_elements_text(v_attempt.question_order)
         with ordinality as ord(question_id, position)
    join public.questions q on q.id = ord.question_id::uuid
    join public.assessment_questions aq
      on aq.assessment_id = v_attempt.assessment_id
     and aq.question_id = q.id
    order by ord.position
  loop
    v_points := greatest(coalesce(v_question.points, 0), 0);
    v_max_score := v_max_score + v_points;
    v_ratio := 0;
    v_is_correct := false;

    select aa.answer
      into v_answer
    from public.attempt_answers aa
    where aa.attempt_id = v_attempt.id
      and aa.question_id = v_question.question_id;

    if not found then
      v_answer := 'null'::jsonb;
    end if;

    if v_question.question_type = 'multiple_choice' then
      v_expected := v_question.correct_answer -> 'correct';
      v_given := case
        when jsonb_typeof(v_answer) = 'object'
          then coalesce(v_answer -> 'selected', v_answer -> 'answer', '[]'::jsonb)
        else v_answer
      end;

      if jsonb_typeof(v_expected) <> 'array' then
        raise exception 'Invalid answer key for question %', v_question.question_id
          using errcode = '22023';
      end if;

      if jsonb_typeof(v_given) <> 'array' then
        v_given := case
          when v_given = 'null'::jsonb then '[]'::jsonb
          else jsonb_build_array(v_given)
        end;
      end if;

      select coalesce(array_agg(value order by value), array[]::text[])
        into v_expected_ids
      from jsonb_array_elements_text(v_expected);

      select coalesce(array_agg(value order by value), array[]::text[])
        into v_given_ids
      from jsonb_array_elements_text(v_given);

      if v_expected_ids = v_given_ids and cardinality(v_expected_ids) > 0 then
        v_ratio := 1;
      end if;

    elsif v_question.question_type = 'matching' then
      v_expected := v_question.correct_answer -> 'pairs';
      v_given := case
        when jsonb_typeof(v_answer) = 'object'
          then coalesce(v_answer -> 'pairs', '[]'::jsonb)
        else v_answer
      end;

      if jsonb_typeof(v_expected) <> 'array' then
        raise exception 'Invalid answer key for question %', v_question.question_id
          using errcode = '22023';
      end if;

      if jsonb_typeof(v_given) <> 'array' then
        v_given := '[]'::jsonb;
      end if;

      select count(*)::integer
        into v_expected_count
      from jsonb_array_elements(v_expected);

      if v_expected_count > 0 then
        select count(*)::integer
          into v_correct_count
        from jsonb_array_elements(v_expected) expected_pair(value)
        where exists (
          select 1
          from jsonb_array_elements(v_given) given_pair(value)
          where given_pair.value = expected_pair.value
        );

        v_ratio := v_correct_count::numeric / v_expected_count;
      end if;

    elsif v_question.question_type = 'fill_blank' then
      v_expected := v_question.correct_answer -> 'blanks';
      v_given := case
        when jsonb_typeof(v_answer) = 'object'
          then coalesce(v_answer -> 'blanks', '[]'::jsonb)
        else v_answer
      end;

      if jsonb_typeof(v_expected) <> 'array' then
        raise exception 'Invalid answer key for question %', v_question.question_id
          using errcode = '22023';
      end if;

      if jsonb_typeof(v_given) <> 'array' then
        v_given := '[]'::jsonb;
      end if;

      v_expected_count := jsonb_array_length(v_expected);
      v_correct_count := 0;

      if v_expected_count > 0 then
        for v_blank_index in 0 .. v_expected_count - 1 loop
          v_accepted := v_expected -> v_blank_index;

          if jsonb_typeof(v_accepted) <> 'array' then
            raise exception 'Invalid fill-blank answer key for question %',
              v_question.question_id
              using errcode = '22023';
          end if;

          if v_blank_index < jsonb_array_length(v_given)
             and jsonb_typeof(v_given -> v_blank_index) = 'string'
             and exists (
               select 1
               from jsonb_array_elements_text(v_accepted) accepted(value)
               where lower(regexp_replace(btrim(accepted.value), '[[:space:]]+', ' ', 'g'))
                   = lower(regexp_replace(
                       btrim(v_given ->> v_blank_index),
                       '[[:space:]]+',
                       ' ',
                       'g'
                     ))
             ) then
            v_correct_count := v_correct_count + 1;
          end if;
        end loop;

        v_ratio := v_correct_count::numeric / v_expected_count;
      end if;

    else
      -- Non-objective question types remain available for teacher grading.
      v_all_auto_graded := false;
      v_is_correct := null;
      v_ratio := 0;
    end if;

    v_ratio := greatest(0, least(v_ratio, 1));
    v_awarded := v_awarded + round(v_points * v_ratio, 2);

    if v_is_correct is not null then
      v_is_correct := v_ratio = 1;
    end if;

    insert into public.attempt_answers (
      attempt_id,
      question_id,
      answer,
      is_correct,
      points_awarded,
      updated_at
    )
    values (
      v_attempt.id,
      v_question.question_id,
      v_answer,
      v_is_correct,
      round(v_points * v_ratio, 2),
      v_now
    )
    on conflict (attempt_id, question_id)
    do update set
      is_correct = excluded.is_correct,
      points_awarded = excluded.points_awarded,
      updated_at = excluded.updated_at;
  end loop;

  if v_max_score > 0 then
    v_score_pct := round((v_awarded / v_max_score) * 100, 2);
  end if;

  v_status := case when v_all_auto_graded then 'graded' else 'submitted' end;

  update public.assessment_attempts
     set status = v_status,
         submitted_at = v_now,
         score = round(v_awarded, 2),
         max_score = round(v_max_score, 2)
   where id = v_attempt.id;

  -- Pay only the improvement over the student's previous best quiz result.
  select coalesce(max(
    case
      when aa.max_score > 0 then round((aa.score / aa.max_score) * 100, 2)
      else 0
    end
  ), 0)
    into v_previous_best_pct
  from public.assessment_attempts aa
  where aa.assessment_id = v_attempt.assessment_id
    and aa.student_id = v_attempt.student_id
    and aa.id <> v_attempt.id
    and aa.status = 'graded';

  v_new_best_pct := greatest(v_previous_best_pct, v_score_pct);

  v_xp_for_best := 20 + round(30 * v_new_best_pct / 100)::integer;
  if v_new_best_pct = 100 then
    v_xp_for_best := v_xp_for_best + 10;
  end if;

  v_xp_for_previous_best := 0;
  if v_previous_best_pct > 0 then
    v_xp_for_previous_best := 20 + round(30 * v_previous_best_pct / 100)::integer;
    if v_previous_best_pct = 100 then
      v_xp_for_previous_best := v_xp_for_previous_best + 10;
    end if;
  end if;

  v_xp_delta := greatest(v_xp_for_best - v_xp_for_previous_best, 0);

  perform public.award_xp(
    v_attempt.student_id,
    v_xp_delta,
    'quiz',
    v_attempt.id
  );

  if v_score_pct >= v_assessment.pass_percentage
     and not exists (
       select 1
       from public.coin_ledger cl
       where cl.student_id = v_attempt.student_id
         and cl.source = 'quiz_pass'
         and cl.reference_id = v_assessment.id
     ) then
    v_coin_reward := 15;
    if v_score_pct = 100 then
      v_coin_reward := v_coin_reward + 10;
    end if;

    insert into public.coin_ledger (student_id, amount, source, reference_id)
    values (
      v_attempt.student_id,
      v_coin_reward,
      'quiz_pass',
      v_assessment.id
    )
    returning id into v_coin_ledger_id;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'status', v_status,
    'score', round(v_awarded, 2),
    'max_score', round(v_max_score, 2),
    'score_percentage', v_score_pct,
    'xp_awarded', v_xp_delta,
    'coins_awarded', v_coin_reward,
    'coin_ledger_id', v_coin_ledger_id
  );
end;
$$;

revoke all on function public.save_quiz_answers(uuid, jsonb) from public;
revoke all on function public.submit_quiz_attempt(uuid) from public;

grant execute on function public.save_quiz_answers(uuid, jsonb) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;
