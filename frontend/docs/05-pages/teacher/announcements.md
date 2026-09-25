# Page: Announcements (Teacher: `/app/teacher/announcements`, Supervisor: `/app/supervisor/announcements`)

Shared component/layout between the two roles; scope differs by permission
(`auth-and-roles.md`: teacher posts to own class, supervisor posts school-wide).

## Layout

- Composer at top: title `Input`, body `Textarea`, audience `Select` (teacher: own
  classes only; supervisor: any class or "entire school"), "Post" primary button.
- Feed below: reverse-chronological list of posted announcements, each a `Card`
  (title, audience `Badge`, date, body, `ghost` edit/delete for the author's own
  posts — `ConfirmDialog` before delete per `feedback.md`).

## Notes

Announcements also surface to students/relevant recipients via the `TopBar`
notification bell (`layout-shell.md`) with the `brand-gold-500` badge count.
