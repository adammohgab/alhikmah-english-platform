# 14. TRACEABILITY MATRIX (PAGES TO BACKEND OPERATIONS)

Purpose: the bridge between the page specs (frontend/docs) and the backend contract (05-API-CONTRACT.md). For every page it lists the gate that unlocks it, the contract operations it uses, and the rule sections that govern behavior. It is the main input for writing precise tasks: a page task depends on the operations in its row, and an operation task unlocks the pages in the reverse index.
This file is validated by a script: every page id in the four specs must have a row, and every operation named here must exist in 05-API-CONTRACT.md. When a spec or the contract changes, update this file in the same change.

Abbreviations in the Rules column: ECONOMY = frontend/docs/03-student/ECONOMY-AND-GAMES.md; AI-BEHAVIOR = frontend/docs/03-student/AI-BEHAVIOR.md; BUSINESS = 06-BUSINESS-LOGIC.md; AUTH = 04-AUTH-AND-ACCESS.md; AI-SYSTEM = 07-AI-SYSTEM.md; STORAGE = 08-STORAGE-REALTIME-NOTIFICATIONS.md; GLOBAL-STYLES = frontend/docs/01-styles/GLOBAL-STYLES-SPEC.md; frontend 02 = frontend/docs/02-public/SHARED-SPEC.md. Section numbers use the "§" sign.

Gates: BG0 Foundation; BG1 Content, progress and XP core; BG2 Assessments and engagement; BG3 Shop, communication and insight; BG4 AI; BG5 Admin operations and hardening (see 13-ROADMAP-AND-GATES.md). A page's gate is the latest gate among its operations.

---

## SHARED AND PUBLIC PAGES (frontend/docs/02-public/SHARED-SPEC.md)

| Page | Title | Gate | Contract operations | Rules and logic |
|---|---|---|---|---|
| SH-00 | Shared shell parts | BG0 | `get_public_state`, `get_session_context`, `notifications`, `mark_notifications_read`, `global_search`, `server_time`, `auth_logout`, `view_as_end`, `view_as_extend`, `view_as_log_page`, `get_asset_url` | frontend 02 §6A, §7 |
| SH-01 | Landing page | BG0 | `get_public_state` |  |
| SH-02 | Sign in | BG0 | `get_public_state`, `auth_login`, `get_session_context` | backend 04 §2 |
| SH-03 | Forgot password (request form and contact info) | BG0 | `get_public_state`, `request_password_reset` | backend 04 §3.2 |
| SH-04 | Set a new password | BG0 | `get_public_state`, `auth_change_password`, `get_session_context` | backend 04 §3 |
| SH-05 | Account not active | BG0 | `get_public_state` |  |
| SH-06 | Help and contact the school | BG0 | `get_public_state` |  |
| SH-07 | FAQ | BG0 | `get_public_state` |  |
| SH-08 | Terms and Privacy | BG0 | `get_public_state` |  |
| SH-09 | About the platform | BG0 | `get_public_state` |  |
| SH-10 | Not found (404) | BG0 | `get_public_state` |  |
| SH-11 | Something went wrong | BG0 | `get_public_state` |  |
| SH-12 | Offline | BG0 | `get_public_state` |  |
| SH-13 | Maintenance | BG0 | `get_public_state` |  |
| SH-14 | No access | BG0 | `get_public_state` |  |

## STUDENT PAGES (frontend/docs/03-student/STUDENT-SPEC.md)

| Page | Title | Gate | Contract operations | Rules and logic |
|---|---|---|---|---|
| ST-00 | Student shell | BG0 | `get_session_context`, `notifications`, `mark_notifications_read`, `global_search`, `server_time`, `auth_logout`, `my_stats`, `my_ai_limits`, `report_problem` |  |
| ST-01 | Dashboard | BG1 | `my_stats`, `my_quests`, `my_streak`, `my_xp_week`, `my_deadlines`, `my_announcements`, `get_announcement`, `my_courses`, `my_resume`, `leaderboard_snapshot`, `my_badges_summary`, `claim_quest`, `open_chest` | ECONOMY §2-5; BUSINESS §2, §7 |
| ST-02 | Courses list | BG1 | `my_courses`, `join_class_by_code` | BUSINESS §14 |
| ST-03 | Course details | BG1 | `get_course` | BUSINESS §4 |
| ST-04 | Unit page | BG1 | `get_unit`, `add_words_to_library` | BUSINESS §4 |
| ST-05 | Lesson page | BG1 | `get_lesson`, `touch_lesson`, `check_lesson_answer`, `complete_lesson`, `save_lesson_notes`, `add_words_to_library`, `get_asset_url`, `report_problem` | ECONOMY §2.1; BUSINESS §2.5 |
| ST-06 | Activity page | BG1 | `get_activity`, `save_activity_state`, `submit_activity` | ECONOMY §2.1; BUSINESS §2.5 |
| ST-07 | Quizzes hub | BG2 | `my_quizzes`, `my_quiz_attempts` | BUSINESS §3 |
| ST-08 | Quiz start | BG2 | `get_quiz_brief`, `start_quiz_attempt` | BUSINESS §3.1, §4 |
| ST-09 | Quiz attempt (question + navigation) | BG2 | `save_quiz_answers`, `submit_quiz_attempt`, `server_time` | BUSINESS §3.2-3.3 |
| ST-10 | Quiz result | BG2 | `get_quiz_result`, `my_quiz_attempts`, `start_practice_session`, `ai_tutor_chat` | BUSINESS §3.4; AI-BEHAVIOR §4.3 |
| ST-11 | Assignments list | BG2 | `my_assignments` | BUSINESS §5 |
| ST-12 | Assignment details | BG2 | `get_assignment_brief`, `start_assignment`, `get_asset_url` | BUSINESS §5.1 |
| ST-13 | Assignment solving (autosave) | BG2 | `start_assignment`, `save_assignment_draft`, `submit_assignment`, `ai_writing_feedback` | BUSINESS §5.2-5.3 |
| ST-14 | Assignment result and feedback | BG2 | `get_assignment_result`, `ai_tutor_chat` | BUSINESS §5.4 |
| ST-15 | Vocabulary | BG1 | `practice_groups`, `list_vocab_items`, `library_words`, `start_practice_session`, `finish_practice_session`, `review_word`, `get_asset_url` | BUSINESS §6 |
| ST-16 | Grammar | BG1 | `practice_groups`, `list_grammar_topics`, `get_grammar_topic`, `library_topics`, `start_practice_session`, `finish_practice_session` | BUSINESS §6 |
| ST-17 | Reading | BG1 | `practice_groups`, `list_passages`, `get_passage`, `library_passages`, `finish_practice_session`, `add_words_to_library` | BUSINESS §6 |
| ST-18 | Writing | BG4 | `list_writing_prompts`, `writing_drafts`, `ai_writing_feedback`, `finish_writing_check`, `my_ai_limits` | AI-BEHAVIOR §4.1 |
| ST-19 | Translation | BG4 | `ai_translate`, `translation_history`, `add_words_to_library`, `my_ai_limits` | AI-BEHAVIOR §4.2 |
| ST-20 | AI Tutor | BG4 | `ai_tutor_chat`, `ai_conversations`, `ai_messages`, `rate_ai_message`, `finish_tutor_quiz`, `my_ai_limits`, `report_problem` | AI-BEHAVIOR §3; AI-SYSTEM §4-6 |
| ST-21 | Game selection | BG2 | `list_games`, `my_inventory` | ECONOMY §9.1; BUSINESS §8 |
| ST-22 | Game screen | BG2 | `start_game_session`, `game_hint`, `game_extra_time`, `finish_game_session`, `abandon_game_session`, `get_asset_url` | ECONOMY §9.2; BUSINESS §8 |
| ST-23 | Game results | BG2 | `finish_game_session`, `list_games` | ECONOMY §9.3-9.4 |
| ST-24 | Daily quests and weekly goals | BG2 | `my_quests`, `claim_quest`, `open_chest`, `my_streak` | ECONOMY §4; BUSINESS §7.2 |
| ST-25 | Leaderboard | BG2 | `leaderboard` | ECONOMY §7; BUSINESS §7.4 |
| ST-26 | Achievements (badges) | BG2 | `my_badges`, `pin_badges` | ECONOMY §5; BUSINESS §7.3 |
| ST-27 | Shop | BG3 | `shop_list`, `shop_theme`, `purchase_item`, `equip_item`, `my_inventory` | ECONOMY §6; BUSINESS §9 |
| ST-28 | Profile and avatar editor | BG3 | `my_profile`, `my_profile_stats`, `save_avatar`, `my_inventory`, `equip_item`, `my_certificates` | BUSINESS §9.2, §10 |
| ST-29 | Certificates | BG2 | `my_certificates`, `get_certificate` | ECONOMY §8; BUSINESS §10 |
| ST-30 | Notifications and announcements | BG3 | `notifications`, `mark_notifications_read`, `get_announcement`, `respond_class_invite` | NOTIFICATIONS §5 |
| ST-31 | Settings | BG1 | `user_settings`, `auth_change_password`, `my_inventory`, `equip_item` |  |

## TEACHER PAGES (frontend/docs/04-teacher/TEACHER-SPEC.md)

| Page | Title | Gate | Contract operations | Rules and logic |
|---|---|---|---|---|
| TC-00 | Teacher shell | BG4 | `get_session_context`, `notifications`, `mark_notifications_read`, `global_search`, `ai_copilot`, `ai_action_apply`, `ai_action_undo`, `ai_action_discard`, `ai_action_regenerate`, `my_ai_limits`, `auth_logout`, `server_time` | AI-SYSTEM §6 |
| TC-01 | Dashboard | BG2 | `teacher_grading_queue_summary`, `teacher_attention_students`, `teacher_activity_feed`, `teacher_classes_summary`, `teacher_deadlines`, `suggested_actions`, `announcements`, `publish_announcement`, `ai_draft_announcement`, `approve_all_ai_grades` | BUSINESS §13 |
| TC-02 | Classes list | BG0 | `list_my_classes`, `create_class`, `update_class`, `archive_class`, `duplicate_class`, `ai_page_action` | BUSINESS §14 |
| TC-03 | Class detail | BG2 | `class_overview`, `class_work`, `class_progress`, `ai_page_action` |  |
| TC-04 | Class roster and enrollment | BG0 | `class_roster`, `search_students`, `add_students_to_class`, `invite_students_validate`, `invite_students`, `rotate_join_code`, `decide_join_request`, `remove_student_from_class`, `add_co_teacher`, `remove_co_teacher`, `reset_password` | AUTH §3.2; BUSINESS §14 |
| TC-05 | Class rules | BG0 | `class_rules`, `update_class_rules`, `class_rules_impact`, `ai_page_action` | BUSINESS §3.1, §5.1 |
| TC-06 | Class rewards | BG2 | `class_leaderboard`, `class_streaks`, `class_quests`, `class_quest_progress`, `confirm_class_quest`, `award_bonus`, `bonus_history`, `ai_page_action` | ECONOMY §4.4, §2.1 |
| TC-07 | All my students | BG2 | `my_students` | BUSINESS §13 |
| TC-08 | Student progress | BG2 | `student_overview`, `student_courses`, `student_quiz_results`, `student_assignment_results`, `student_skills`, `student_activity_log`, `reset_password`, `award_bonus`, `ai_support_plan` | BUSINESS §13 |
| TC-09 | Courses | BG1 | `my_courses_authoring`, `library_courses`, `create_course`, `duplicate_course`, `ai_generate_course` | BUSINESS §11 |
| TC-10 | Course builder | BG1 | `create_course`, `reorder_children`, `course_checklist`, `preview_course`, `ai_page_action`, `get_asset_url` | BUSINESS §11.1 |
| TC-11 | Lesson editor | BG1 | `reorder_children`, `create_upload`, `complete_upload`, `get_asset_url`, `ai_generate_lesson` | STORAGE §2 |
| TC-12 | Course publish and assign | BG1 | `publish_course`, `publish_course_changes`, `course_pending_changes`, `assign_course_to_classes`, `unpublish_course` | BUSINESS §11 |
| TC-13 | Assignments list | BG2 | `list_assignments`, `duplicate_assessment` |  |
| TC-14 | Assignment builder | BG2 | `questions`, `validate_assessment`, `publish_assessment`, `add_question_to_assessment`, `ai_generate_assessment`, `ai_check_assessment`, `reorder_children`, `rubrics` | BUSINESS §5, §11.4 |
| TC-15 | Assignment results | BG2 | `assignment_results`, `send_submission_reminder`, `release_grades`, `close_assessment_early`, `ai_grade_submissions` | BUSINESS §5.4 |
| TC-16 | Quizzes list | BG2 | `list_quizzes`, `duplicate_assessment` |  |
| TC-17 | Quiz builder | BG2 | `questions`, `validate_assessment`, `publish_assessment`, `random_questions_for_quiz`, `add_question_to_assessment`, `ai_generate_assessment`, `ai_check_assessment` | BUSINESS §3, §11.4 |
| TC-18 | Quiz results and item analysis | BG2 | `quiz_results`, `grant_extra_attempt`, `ai_page_action` |  |
| TC-19 | Question bank | BG2 | `questions`, `list_questions`, `find_duplicate_questions`, `autotag_questions`, `ai_generate_questions` | AI-BEHAVIOR §5.2 |
| TC-20 | Grading queue | BG2 | `grading_queue`, `approve_all_ai_grades`, `ai_grade_submissions` | BUSINESS §5.4 |
| TC-21 | Grading screen | BG2 | `get_submission_for_grading`, `lock_submission`, `unlock_submission`, `save_grade`, `confirm_submission`, `override_score`, `grade_history`, `add_inline_comment`, `comment_snippets` | BUSINESS §5.4; STORAGE §6.4 |
| TC-22 | Reports hub | BG3 | `recent_reports` |  |
| TC-23 | Class report | BG3 | `report_class`, `save_report`, `ai_report_narrative` |  |
| TC-24 | Compare classes | BG3 | `report_compare` |  |
| TC-25 | Student report card | BG3 | `report_student`, `ai_report_comments` | AI-BEHAVIOR §5.6 |
| TC-26 | Announcements list | BG3 | `announcements`, `announcement_stats`, `remind_unread` | STORAGE §5.4 |
| TC-27 | Announcement composer | BG3 | `announcements`, `publish_announcement`, `ai_draft_announcement` | AI-BEHAVIOR §5.5 |
| TC-28 | Notifications | BG3 | `notifications`, `mark_notifications_read` | STORAGE §5.2 |
| TC-29 | Settings | BG1 | `user_settings`, `my_ai_limits`, `my_ai_activity`, `rubrics`, `comment_snippets` |  |
| TC-30 | Generate a course (AI wizard) | BG4 | `ai_generate_course`, `get_job`, `cancel_job`, `ai_page_action` | AI-SYSTEM §9; AI-BEHAVIOR §5.3 |
| TC-31 | Planner (AI lesson and weekly planning) | BG4 | `planner_items`, `lesson_plans`, `ai_planner`, `ai_lesson_plan`, `ai_action_apply`, `ai_action_discard`, `ai_action_regenerate` | AI-BEHAVIOR §5.8 |
| TC-32 | Support plans (AI help plans for struggling students) | BG4 | `support_plans`, `ai_support_plan`, `support_plan_progress`, `ai_action_apply`, `ai_action_discard`, `ai_action_regenerate`, `ai_action_undo` | AI-BEHAVIOR §5.7 |

## ADMIN PAGES (frontend/docs/05-admin/ADMIN-SPEC.md)

| Page | Title | Gate | Contract operations | Rules and logic |
|---|---|---|---|---|
| AD-00 | Admin shell | BG0 | `get_session_context`, `notifications`, `global_search`, `ai_admin_copilot`, `view_as_end`, `auth_logout` |  |
| AD-01 | Dashboard | BG5 | `admin_pending_issues`, `admin_users_overview`, `admin_ai_summary`, `health`, `admin_content_overview`, `audit_recent` |  |
| AD-02 | Users list | BG0 | `admin_list_users`, `reset_requests`, `unlock_account`, `reset_password`, `reset_passwords`, `admin_archive_users`, `admin_restore_users`, `admin_export`, `view_as_start` | AUTH §3, §5 |
| AD-03 | User detail | BG0 | `admin_get_user`, `admin_update_user`, `reset_password`, `view_as_start`, `admin_user_notes`, `ai_overrides` | AUTH §5 |
| AD-04 | Create user | BG0 | `admin_create_user` | AUTH §3.2 |
| AD-05 | CSV import wizard | BG5 | `import_users_start`, `import_set_mapping`, `ai_suggest_import_mapping`, `import_validate`, `import_rows`, `import_fix_row`, `import_exclude_rows`, `ai_fix_import_rows`, `import_commit`, `get_job` |  |
| AD-06 | Year rollover | BG5 | `rollover_plan`, `ai_suggest_rollover_classes`, `rollover_execute`, `rollover_undo`, `get_job` |  |
| AD-07 | Classes list | BG0 | `admin_classes`, `delete_class` |  |
| AD-08 | Class detail (admin view) | BG0 | `admin_class_detail`, `add_co_teacher`, `remove_co_teacher`, `move_student` |  |
| AD-09 | Curriculum management | BG1 | `curriculum_versions`, `curriculum_tree`, `curriculum_coverage`, `curriculum_impact`, `publish_curriculum`, `duplicate_curriculum_version`, `course_packages`, `set_package_units`, `ai_page_action` | BUSINESS §11.5 |
| AD-10 | Generate official curriculum (AI wizard) | BG5 | `ai_generate_curriculum`, `get_job` | AI-BEHAVIOR §5.3a |
| AD-11 | Content management | BG1 | `admin_content_list`, `content_impact`, `set_content_status`, `tag_content`, `ai_generate_practice_content`, `ai_content_quality_check`, `ai_autotag_content` | BUSINESS §11.3 |
| AD-12 | Content editor and preview | BG1 | `content_versions`, `restore_content_version`, `preview_course`, `create_upload` |  |
| AD-13 | Moderation queue | BG5 | `moderation_list`, `moderation_get`, `moderation_act`, `ai_moderation_triage`, `view_ai_conversation` | AI-BEHAVIOR §6 |
| AD-14 | XP, levels, coins and streak rules | BG5 | `get_config`, `save_config_draft`, `config_impact`, `publish_config`, `restore_config`, `simulate_student`, `economy_health` | ECONOMY §2-3, §11 |
| AD-15 | Quest templates and badge definitions | BG5 | `quest_templates`, `badge_definitions`, `simulate_quest_day`, `simulate_badge`, `ai_suggest_quests`, `ai_suggest_badges` | ECONOMY §4-5 |
| AD-16 | Shop catalog | BG5 | `shop_items`, `shop_bundles`, `shop_sales`, `shop_admin_list`, `ai_suggest_prices` | ECONOMY §6 |
| AD-17 | Avatar studio | BG5 | `avatar_assets`, `create_upload` |  |
| AD-18 | Themes studio | BG5 | `themes`, `check_theme_contrast`, `publish_theme`, `ai_generate_theme` | GLOBAL-STYLES §4 |
| AD-19 | Leaderboard moderation | BG5 | `leaderboard_admin`, `leaderboard_flags`, `leaderboard_action`, `leaderboard_reset_board`, `ai_explain_flag` | BUSINESS §7.4 |
| AD-20 | AI features and limits | BG5 | `get_config`, `save_config_draft`, `publish_config`, `ai_overrides` | AI-SYSTEM §10 |
| AD-21 | AI safety rules and custom instructions | BG5 | `get_config`, `save_config_draft`, `publish_config`, `ai_test_sandbox`, `ai_run_test_suite`, `ai_test_cases`, `ai_draft_instructions`, `ai_lint_instructions` | AI-SYSTEM §4, §11 |
| AD-22 | AI usage and cost | BG5 | `ai_usage_summary`, `ai_usage_breakdown`, `ai_top_consumers`, `ai_limit_hits`, `ai_anomalies`, `ai_explain_usage_spike`, `admin_export` | AI-SYSTEM §10 |
| AD-23 | AI activity log | BG5 | `ai_log_list`, `ai_log_detail`, `view_ai_conversation` | AUTH §5A |
| AD-24 | School-wide announcements | BG3 | `announcements`, `publish_announcement`, `announcement_stats`, `remind_unread`, `active_urgent_announcements`, `ai_draft_announcement` | STORAGE §5.4 |
| AD-25 | Reports | BG5 | `admin_report`, `ai_report_narrative` |  |
| AD-26 | Audit log | BG5 | `audit_list`, `audit_get` |  |
| AD-27 | Platform settings (Super admin only) | BG5 | `get_platform_settings`, `update_platform_settings`, `set_maintenance`, `admin_recipients`, `platform` |  |
| AD-28 | Admins and roles (Super admin only) | BG5 | `admins`, `admin_list_admins`, `admin_invite_admin`, `admin_change_role`, `admin_deactivate` |  |
| AD-29 | Notifications (admin) | BG3 | `notifications`, `mark_notifications_read` |  |

---

## REVERSE INDEX: OPERATION TO PAGES

Use this to see which pages an operation unlocks (and therefore how critical it is). Names are as written in 05-API-CONTRACT.md.

| Operation | Pages |
|---|---|
| `abandon_game_session` | ST-22 |
| `active_urgent_announcements` | AD-24 |
| `add_co_teacher` | AD-08, TC-04 |
| `add_inline_comment` | TC-21 |
| `add_question_to_assessment` | TC-14, TC-17 |
| `add_students_to_class` | TC-04 |
| `add_words_to_library` | ST-04, ST-05, ST-17, ST-19 |
| `admin_ai_summary` | AD-01 |
| `admin_archive_users` | AD-02 |
| `admin_change_role` | AD-28 |
| `admin_class_detail` | AD-08 |
| `admin_classes` | AD-07 |
| `admin_content_list` | AD-11 |
| `admin_content_overview` | AD-01 |
| `admin_create_user` | AD-04 |
| `admin_deactivate` | AD-28 |
| `admin_export` | AD-02, AD-22 |
| `admin_get_user` | AD-03 |
| `admin_invite_admin` | AD-28 |
| `admin_list_admins` | AD-28 |
| `admin_list_users` | AD-02 |
| `admin_pending_issues` | AD-01 |
| `admin_recipients` | AD-27 |
| `admin_report` | AD-25 |
| `admin_restore_users` | AD-02 |
| `admin_update_user` | AD-03 |
| `admin_user_notes` | AD-03 |
| `admin_users_overview` | AD-01 |
| `admins` | AD-28 |
| `ai_action_apply` | TC-00, TC-31, TC-32 |
| `ai_action_discard` | TC-00, TC-31, TC-32 |
| `ai_action_regenerate` | TC-00, TC-31, TC-32 |
| `ai_action_undo` | TC-00, TC-32 |
| `ai_admin_copilot` | AD-00 |
| `ai_anomalies` | AD-22 |
| `ai_autotag_content` | AD-11 |
| `ai_check_assessment` | TC-14, TC-17 |
| `ai_content_quality_check` | AD-11 |
| `ai_conversations` | ST-20 |
| `ai_copilot` | TC-00 |
| `ai_draft_announcement` | AD-24, TC-01, TC-27 |
| `ai_draft_instructions` | AD-21 |
| `ai_explain_flag` | AD-19 |
| `ai_explain_usage_spike` | AD-22 |
| `ai_fix_import_rows` | AD-05 |
| `ai_generate_assessment` | TC-14, TC-17 |
| `ai_generate_course` | TC-09, TC-30 |
| `ai_generate_curriculum` | AD-10 |
| `ai_generate_lesson` | TC-11 |
| `ai_generate_practice_content` | AD-11 |
| `ai_generate_questions` | TC-19 |
| `ai_generate_theme` | AD-18 |
| `ai_grade_submissions` | TC-15, TC-20 |
| `ai_lesson_plan` | TC-31 |
| `ai_limit_hits` | AD-22 |
| `ai_lint_instructions` | AD-21 |
| `ai_log_detail` | AD-23 |
| `ai_log_list` | AD-23 |
| `ai_messages` | ST-20 |
| `ai_moderation_triage` | AD-13 |
| `ai_overrides` | AD-03, AD-20 |
| `ai_page_action` | AD-09, TC-02, TC-03, TC-05, TC-06, TC-10, TC-18, TC-30 |
| `ai_planner` | TC-31 |
| `ai_report_comments` | TC-25 |
| `ai_report_narrative` | AD-25, TC-23 |
| `ai_run_test_suite` | AD-21 |
| `ai_suggest_badges` | AD-15 |
| `ai_suggest_import_mapping` | AD-05 |
| `ai_suggest_prices` | AD-16 |
| `ai_suggest_quests` | AD-15 |
| `ai_suggest_rollover_classes` | AD-06 |
| `ai_support_plan` | TC-08, TC-32 |
| `ai_test_cases` | AD-21 |
| `ai_test_sandbox` | AD-21 |
| `ai_top_consumers` | AD-22 |
| `ai_translate` | ST-19 |
| `ai_tutor_chat` | ST-10, ST-14, ST-20 |
| `ai_usage_breakdown` | AD-22 |
| `ai_usage_summary` | AD-22 |
| `ai_writing_feedback` | ST-13, ST-18 |
| `announcement_stats` | AD-24, TC-26 |
| `announcements` | AD-24, TC-01, TC-26, TC-27 |
| `approve_all_ai_grades` | TC-01, TC-20 |
| `archive_class` | TC-02 |
| `assign_course_to_classes` | TC-12 |
| `assignment_results` | TC-15 |
| `audit_get` | AD-26 |
| `audit_list` | AD-26 |
| `audit_recent` | AD-01 |
| `auth_change_password` | SH-04, ST-31 |
| `auth_login` | SH-02 |
| `auth_logout` | AD-00, SH-00, ST-00, TC-00 |
| `autotag_questions` | TC-19 |
| `avatar_assets` | AD-17 |
| `award_bonus` | TC-06, TC-08 |
| `badge_definitions` | AD-15 |
| `bonus_history` | TC-06 |
| `cancel_job` | TC-30 |
| `check_lesson_answer` | ST-05 |
| `check_theme_contrast` | AD-18 |
| `claim_quest` | ST-01, ST-24 |
| `class_leaderboard` | TC-06 |
| `class_overview` | TC-03 |
| `class_progress` | TC-03 |
| `class_quest_progress` | TC-06 |
| `class_quests` | TC-06 |
| `class_roster` | TC-04 |
| `class_rules` | TC-05 |
| `class_rules_impact` | TC-05 |
| `class_streaks` | TC-06 |
| `class_work` | TC-03 |
| `close_assessment_early` | TC-15 |
| `comment_snippets` | TC-21, TC-29 |
| `complete_lesson` | ST-05 |
| `complete_upload` | TC-11 |
| `config_impact` | AD-14 |
| `confirm_class_quest` | TC-06 |
| `confirm_submission` | TC-21 |
| `content_impact` | AD-11 |
| `content_versions` | AD-12 |
| `course_checklist` | TC-10 |
| `course_packages` | AD-09 |
| `course_pending_changes` | TC-12 |
| `create_class` | TC-02 |
| `create_course` | TC-09, TC-10 |
| `create_upload` | AD-12, AD-17, TC-11 |
| `curriculum_coverage` | AD-09 |
| `curriculum_impact` | AD-09 |
| `curriculum_tree` | AD-09 |
| `curriculum_versions` | AD-09 |
| `decide_join_request` | TC-04 |
| `delete_class` | AD-07 |
| `duplicate_assessment` | TC-13, TC-16 |
| `duplicate_class` | TC-02 |
| `duplicate_course` | TC-09 |
| `duplicate_curriculum_version` | AD-09 |
| `economy_health` | AD-14 |
| `equip_item` | ST-27, ST-28, ST-31 |
| `find_duplicate_questions` | TC-19 |
| `finish_game_session` | ST-22, ST-23 |
| `finish_practice_session` | ST-15, ST-16, ST-17 |
| `finish_tutor_quiz` | ST-20 |
| `finish_writing_check` | ST-18 |
| `game_extra_time` | ST-22 |
| `game_hint` | ST-22 |
| `get_activity` | ST-06 |
| `get_announcement` | ST-01, ST-30 |
| `get_asset_url` | SH-00, ST-05, ST-12, ST-15, ST-22, TC-10, TC-11 |
| `get_assignment_brief` | ST-12 |
| `get_assignment_result` | ST-14 |
| `get_certificate` | ST-29 |
| `get_config` | AD-14, AD-20, AD-21 |
| `get_course` | ST-03 |
| `get_grammar_topic` | ST-16 |
| `get_job` | AD-05, AD-06, AD-10, TC-30 |
| `get_lesson` | ST-05 |
| `get_passage` | ST-17 |
| `get_platform_settings` | AD-27 |
| `get_public_state` | SH-00, SH-01, SH-02, SH-03, SH-04, SH-05, SH-06, SH-07, SH-08, SH-09, SH-10, SH-11, SH-12, SH-13, SH-14 |
| `get_quiz_brief` | ST-08 |
| `get_quiz_result` | ST-10 |
| `get_session_context` | AD-00, SH-00, SH-02, SH-04, ST-00, TC-00 |
| `get_submission_for_grading` | TC-21 |
| `get_unit` | ST-04 |
| `global_search` | AD-00, SH-00, ST-00, TC-00 |
| `grade_history` | TC-21 |
| `grading_queue` | TC-20 |
| `grant_extra_attempt` | TC-18 |
| `health` | AD-01 |
| `import_commit` | AD-05 |
| `import_exclude_rows` | AD-05 |
| `import_fix_row` | AD-05 |
| `import_rows` | AD-05 |
| `import_set_mapping` | AD-05 |
| `import_users_start` | AD-05 |
| `import_validate` | AD-05 |
| `invite_students` | TC-04 |
| `invite_students_validate` | TC-04 |
| `join_class_by_code` | ST-02 |
| `leaderboard` | ST-25 |
| `leaderboard_action` | AD-19 |
| `leaderboard_admin` | AD-19 |
| `leaderboard_flags` | AD-19 |
| `leaderboard_reset_board` | AD-19 |
| `leaderboard_snapshot` | ST-01 |
| `lesson_plans` | TC-31 |
| `library_courses` | TC-09 |
| `library_passages` | ST-17 |
| `library_topics` | ST-16 |
| `library_words` | ST-15 |
| `list_assignments` | TC-13 |
| `list_games` | ST-21, ST-23 |
| `list_grammar_topics` | ST-16 |
| `list_my_classes` | TC-02 |
| `list_passages` | ST-17 |
| `list_questions` | TC-19 |
| `list_quizzes` | TC-16 |
| `list_vocab_items` | ST-15 |
| `list_writing_prompts` | ST-18 |
| `lock_submission` | TC-21 |
| `mark_notifications_read` | AD-29, SH-00, ST-00, ST-30, TC-00, TC-28 |
| `moderation_act` | AD-13 |
| `moderation_get` | AD-13 |
| `moderation_list` | AD-13 |
| `move_student` | AD-08 |
| `my_ai_activity` | TC-29 |
| `my_ai_limits` | ST-00, ST-18, ST-19, ST-20, TC-00, TC-29 |
| `my_announcements` | ST-01 |
| `my_assignments` | ST-11 |
| `my_badges` | ST-26 |
| `my_badges_summary` | ST-01 |
| `my_certificates` | ST-28, ST-29 |
| `my_courses` | ST-01, ST-02 |
| `my_courses_authoring` | TC-09 |
| `my_deadlines` | ST-01 |
| `my_inventory` | ST-21, ST-27, ST-28, ST-31 |
| `my_profile` | ST-28 |
| `my_profile_stats` | ST-28 |
| `my_quests` | ST-01, ST-24 |
| `my_quiz_attempts` | ST-07, ST-10 |
| `my_quizzes` | ST-07 |
| `my_resume` | ST-01 |
| `my_stats` | ST-00, ST-01 |
| `my_streak` | ST-01, ST-24 |
| `my_students` | TC-07 |
| `my_xp_week` | ST-01 |
| `notifications` | AD-00, AD-29, SH-00, ST-00, ST-30, TC-00, TC-28 |
| `open_chest` | ST-01, ST-24 |
| `override_score` | TC-21 |
| `pin_badges` | ST-26 |
| `planner_items` | TC-31 |
| `platform` | AD-27 |
| `practice_groups` | ST-15, ST-16, ST-17 |
| `preview_course` | AD-12, TC-10 |
| `publish_announcement` | AD-24, TC-01, TC-27 |
| `publish_assessment` | TC-14, TC-17 |
| `publish_config` | AD-14, AD-20, AD-21 |
| `publish_course` | TC-12 |
| `publish_course_changes` | TC-12 |
| `publish_curriculum` | AD-09 |
| `publish_theme` | AD-18 |
| `purchase_item` | ST-27 |
| `quest_templates` | AD-15 |
| `questions` | TC-14, TC-17, TC-19 |
| `quiz_results` | TC-18 |
| `random_questions_for_quiz` | TC-17 |
| `rate_ai_message` | ST-20 |
| `recent_reports` | TC-22 |
| `release_grades` | TC-15 |
| `remind_unread` | AD-24, TC-26 |
| `remove_co_teacher` | AD-08, TC-04 |
| `remove_student_from_class` | TC-04 |
| `reorder_children` | TC-10, TC-11, TC-14 |
| `report_class` | TC-23 |
| `report_compare` | TC-24 |
| `report_problem` | ST-00, ST-05, ST-20 |
| `report_student` | TC-25 |
| `request_password_reset` | SH-03 |
| `reset_password` | AD-02, AD-03, TC-04, TC-08 |
| `reset_passwords` | AD-02 |
| `reset_requests` | AD-02 |
| `respond_class_invite` | ST-30 |
| `restore_config` | AD-14 |
| `restore_content_version` | AD-12 |
| `review_word` | ST-15 |
| `rollover_execute` | AD-06 |
| `rollover_plan` | AD-06 |
| `rollover_undo` | AD-06 |
| `rotate_join_code` | TC-04 |
| `rubrics` | TC-14, TC-29 |
| `save_activity_state` | ST-06 |
| `save_assignment_draft` | ST-13 |
| `save_avatar` | ST-28 |
| `save_config_draft` | AD-14, AD-20, AD-21 |
| `save_grade` | TC-21 |
| `save_lesson_notes` | ST-05 |
| `save_quiz_answers` | ST-09 |
| `save_report` | TC-23 |
| `search_students` | TC-04 |
| `send_submission_reminder` | TC-15 |
| `server_time` | SH-00, ST-00, ST-09, TC-00 |
| `set_content_status` | AD-11 |
| `set_maintenance` | AD-27 |
| `set_package_units` | AD-09 |
| `shop_admin_list` | AD-16 |
| `shop_bundles` | AD-16 |
| `shop_items` | AD-16 |
| `shop_list` | ST-27 |
| `shop_sales` | AD-16 |
| `shop_theme` | ST-27 |
| `simulate_badge` | AD-15 |
| `simulate_quest_day` | AD-15 |
| `simulate_student` | AD-14 |
| `start_assignment` | ST-12, ST-13 |
| `start_game_session` | ST-22 |
| `start_practice_session` | ST-10, ST-15, ST-16 |
| `start_quiz_attempt` | ST-08 |
| `student_activity_log` | TC-08 |
| `student_assignment_results` | TC-08 |
| `student_courses` | TC-08 |
| `student_overview` | TC-08 |
| `student_quiz_results` | TC-08 |
| `student_skills` | TC-08 |
| `submit_activity` | ST-06 |
| `submit_assignment` | ST-13 |
| `submit_quiz_attempt` | ST-09 |
| `suggested_actions` | TC-01 |
| `support_plan_progress` | TC-32 |
| `support_plans` | TC-32 |
| `tag_content` | AD-11 |
| `teacher_activity_feed` | TC-01 |
| `teacher_attention_students` | TC-01 |
| `teacher_classes_summary` | TC-01 |
| `teacher_deadlines` | TC-01 |
| `teacher_grading_queue_summary` | TC-01 |
| `themes` | AD-18 |
| `touch_lesson` | ST-05 |
| `translation_history` | ST-19 |
| `unlock_account` | AD-02 |
| `unlock_submission` | TC-21 |
| `unpublish_course` | TC-12 |
| `update_class` | TC-02 |
| `update_class_rules` | TC-05 |
| `update_platform_settings` | AD-27 |
| `user_settings` | ST-31, TC-29 |
| `validate_assessment` | TC-14, TC-17 |
| `view_ai_conversation` | AD-13, AD-23 |
| `view_as_end` | AD-00, SH-00 |
| `view_as_extend` | SH-00 |
| `view_as_log_page` | SH-00 |
| `view_as_start` | AD-02, AD-03 |
| `writing_drafts` | ST-18 |

---

## OPERATIONS WITHOUT A PAGE (BACKGROUND WORK)
These are job kinds, scheduled functions and internal functions with no page of their own. Each is covered by tasks through the business logic and AI documents: job kinds `ai_course`, `ai_curriculum`, `ai_questions`, `ai_lesson`, `ai_grade_batch`, `ai_report_comments`, `ai_planner`, `import_users`, `rollover`, `report`, `tts_batch`, `content_quality_check`, `notification_fanout` (05 section 8 and 07 section 9); scheduled jobs (06 section 12); internal functions, views and triggers (06 sections 17 and 18).

## COVERAGE RULES FOR TASK WRITERS
Every item below must be covered by at least one task, and a coverage check should be run before the plan is considered complete:
1. Every page id in the four specs (this matrix has all 110 rows).
2. Every operation in 05-API-CONTRACT.md (the reverse index plus the background list above).
3. Every table and enum in 02 and 03 (a migration task per table group with its RLS and tests).
4. Every function, view and trigger in 06 sections 17 and 18, every scheduled job in 06 section 12, every Edge Function slug in 05.
5. Every rule section in docs economy and AI behavior (a test task per rule group).
6. Every runbook and workflow in 11 and every test suite in 12.
