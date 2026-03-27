-- ============================================================
-- Low-stock notification trigger
-- Fires when an inventory_item's quantity is updated to <= reorder_level.
-- Inserts a notification for every admin/site_manager of that site.
-- ============================================================

create or replace function notify_low_stock()
returns trigger
language plpgsql
security definer
as $$
declare
  v_reorder_level integer;
  v_new_qty       integer;
  v_site_id       uuid;
  v_item_name     text;
  v_user_id       uuid;
begin
  v_new_qty       := new.quantity;
  v_reorder_level := new.reorder_level;
  v_site_id       := new.site_id;
  v_item_name     := new.name;

  -- Only fire when quantity drops to/below reorder_level (and reorder_level is set)
  if v_reorder_level is null then
    return new;
  end if;

  if v_new_qty > v_reorder_level then
    return new;
  end if;

  -- If this was already low stock before this update, skip (avoid duplicate spam)
  if old.quantity <= old.reorder_level and old.reorder_level is not null then
    return new;
  end if;

  -- Insert a notification for each admin/site_manager at this site
  for v_user_id in
    select user_id
    from   user_site_roles
    where  site_id = v_site_id
      and  role in ('admin', 'site_manager')
  loop
    insert into notifications (user_id, title, body, type, read)
    values (
      v_user_id,
      'Low Stock: ' || v_item_name,
      'Quantity has dropped to ' || v_new_qty ||
        ' (reorder level: ' || v_reorder_level || '). Please reorder.',
      'warning',
      false
    );
  end loop;

  return new;
end;
$$;

-- Drop existing trigger if present (idempotent)
drop trigger if exists trg_low_stock_notification on inventory_items;

create trigger trg_low_stock_notification
  after update of quantity
  on inventory_items
  for each row
  execute function notify_low_stock();
