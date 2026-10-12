-- Align stored recommendation positions with the 2–14 album import range.
alter table public.recommendations
  drop constraint recommendations_display_order_check,
  add constraint recommendations_display_order_check
    check (display_order between 1 and 14);
