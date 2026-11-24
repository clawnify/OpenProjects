-- Fictional projects for the disposable template preview. Never loaded into a
-- real workspace: the installable schema is ../schema.sql.
--
-- Dates are relative to the day the preview starts, so the plan always sits
-- around today: some phases finished, some running, some still to come.
-- Two double bookings are on purpose, so the preview shows the flag:
--   Crew South: Window frames (Harbour Street) and Flooring (Linden House)
--   Crew East:  Roof strip (Westfield gym) and Tiling (Orchard Close)
-- No file rows: a row without its bytes in storage would only answer 404.

INSERT INTO projects (id, org_id, name, client, location, status, notes, created_by, created_at, updated_at) VALUES
 ('00000000-0000-4000-8000-000000000101', 'demo', 'Harbour Street facade renovation', 'Harbour Street Owners'' Association', '14-28 Harbour Street', 'active',
  'Render and insulation on the street side, new frames on all 42 windows. Residents stay in; scaffold access only between 8:00 and 17:00.', 'You',
  strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')),
 ('00000000-0000-4000-8000-000000000102', 'demo', 'Linden House 3rd floor fit-out', 'Linden Legal', 'Linden House, 3rd floor', 'active',
  'Open plan for 30 desks, four meeting rooms. The tenant moves in the week after handover, so the end date is fixed.', 'You',
  strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
 ('00000000-0000-4000-8000-000000000103', 'demo', 'Westfield gym roof replacement', 'Westfield Primary School', 'Westfield Primary School, sports hall', 'planned',
  'Roof work only while the hall is closed. Materials have a three-week lead time.', 'You',
  strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('00000000-0000-4000-8000-000000000104', 'demo', 'Kitchen and bathroom, 9 Orchard Close', 'Private client', '9 Orchard Close', 'planned',
  'Client signs off the kitchen layout before demolition starts.', 'You',
  strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('00000000-0000-4000-8000-000000000105', 'demo', 'Northgate loading bay doors', 'Northgate Logistics', 'Northgate depot, bays 1-6', 'on_hold',
  'Waiting for the client''s budget approval.', 'You',
  strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-9 days')),
 ('00000000-0000-4000-8000-000000000106', 'demo', 'Library entrance ramp', 'City Library', 'Main entrance, City Library', 'done',
  'Handed over without snags.', 'You',
  strftime('%Y-%m-%dT%H:%M:%fZ','now','-80 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-38 days'));

INSERT INTO phases (id, org_id, project_id, name, start_date, end_date, assignee, done, position, created_at, updated_at) VALUES
 -- Harbour Street: half done
 ('00000000-0000-4000-8000-000000000201', 'demo', '00000000-0000-4000-8000-000000000101', 'Survey', date('now','-20 days'), date('now','-18 days'), 'Maya Jensen', 1, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-18 days')),
 ('00000000-0000-4000-8000-000000000202', 'demo', '00000000-0000-4000-8000-000000000101', 'Scaffolding up', date('now','-15 days'), date('now','-12 days'), 'Crew North', 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 days')),
 ('00000000-0000-4000-8000-000000000203', 'demo', '00000000-0000-4000-8000-000000000101', 'Remove old render', date('now','-11 days'), date('now','-4 days'), 'Crew North', 1, 2, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('00000000-0000-4000-8000-000000000204', 'demo', '00000000-0000-4000-8000-000000000101', 'Insulation and render', date('now','-3 days'), date('now','+10 days'), 'Crew North', 0, 3, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')),
 ('00000000-0000-4000-8000-000000000205', 'demo', '00000000-0000-4000-8000-000000000101', 'Window frames', date('now','+11 days'), date('now','+20 days'), 'Crew South', 0, 4, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')),
 ('00000000-0000-4000-8000-000000000206', 'demo', '00000000-0000-4000-8000-000000000101', 'Scaffolding down', date('now','+21 days'), date('now','+22 days'), 'Crew North', 0, 5, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')),
 ('00000000-0000-4000-8000-000000000207', 'demo', '00000000-0000-4000-8000-000000000101', 'Handover', date('now','+24 days'), date('now','+24 days'), 'Maya Jensen', 0, 6, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')),
 -- Linden House: just started
 ('00000000-0000-4000-8000-000000000211', 'demo', '00000000-0000-4000-8000-000000000102', 'Strip-out', date('now','-6 days'), date('now','-2 days'), 'Crew South', 1, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
 ('00000000-0000-4000-8000-000000000212', 'demo', '00000000-0000-4000-8000-000000000102', 'Partitions and ceilings', date('now','-1 days'), date('now','+8 days'), 'Crew South', 0, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days')),
 ('00000000-0000-4000-8000-000000000213', 'demo', '00000000-0000-4000-8000-000000000102', 'Electrics and data', date('now','+5 days'), date('now','+12 days'), 'Brightwire Electrical', 0, 2, strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days')),
 ('00000000-0000-4000-8000-000000000214', 'demo', '00000000-0000-4000-8000-000000000102', 'Flooring', date('now','+13 days'), date('now','+16 days'), 'Crew South', 0, 3, strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days')),
 ('00000000-0000-4000-8000-000000000215', 'demo', '00000000-0000-4000-8000-000000000102', 'Furniture install', date('now','+17 days'), date('now','+18 days'), 'Crew East', 0, 4, strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days')),
 ('00000000-0000-4000-8000-000000000216', 'demo', '00000000-0000-4000-8000-000000000102', 'Handover', date('now','+19 days'), date('now','+19 days'), 'Maya Jensen', 0, 5, strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days')),
 -- Westfield gym: planned
 ('00000000-0000-4000-8000-000000000221', 'demo', '00000000-0000-4000-8000-000000000103', 'Roof survey', date('now','+7 days'), date('now','+8 days'), 'Maya Jensen', 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('00000000-0000-4000-8000-000000000222', 'demo', '00000000-0000-4000-8000-000000000103', 'Order materials', date('now','+9 days'), date('now','+27 days'), 'Purchasing', 0, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('00000000-0000-4000-8000-000000000223', 'demo', '00000000-0000-4000-8000-000000000103', 'Roof strip', date('now','+28 days'), date('now','+35 days'), 'Crew East', 0, 2, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('00000000-0000-4000-8000-000000000224', 'demo', '00000000-0000-4000-8000-000000000103', 'New roof deck and membrane', date('now','+36 days'), date('now','+52 days'), 'Crew East', 0, 3, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 ('00000000-0000-4000-8000-000000000225', 'demo', '00000000-0000-4000-8000-000000000103', 'Inspection', date('now','+54 days'), date('now','+54 days'), 'Maya Jensen', 0, 4, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
 -- Orchard Close: planned
 ('00000000-0000-4000-8000-000000000231', 'demo', '00000000-0000-4000-8000-000000000104', 'Layout sign-off', date('now','+2 days'), date('now','+3 days'), 'Maya Jensen', 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('00000000-0000-4000-8000-000000000232', 'demo', '00000000-0000-4000-8000-000000000104', 'Demolition', date('now','+21 days'), date('now','+23 days'), 'Crew East', 0, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('00000000-0000-4000-8000-000000000233', 'demo', '00000000-0000-4000-8000-000000000104', 'Plumbing first fix', date('now','+24 days'), date('now','+27 days'), 'Clearflow Plumbing', 0, 2, strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('00000000-0000-4000-8000-000000000234', 'demo', '00000000-0000-4000-8000-000000000104', 'Tiling', date('now','+28 days'), date('now','+33 days'), 'Crew East', 0, 3, strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 ('00000000-0000-4000-8000-000000000235', 'demo', '00000000-0000-4000-8000-000000000104', 'Kitchen install', date('now','+34 days'), date('now','+37 days'), 'Crew South', 0, 4, strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
 -- Northgate: on hold
 ('00000000-0000-4000-8000-000000000241', 'demo', '00000000-0000-4000-8000-000000000105', 'Measure openings', date('now','+30 days'), date('now','+30 days'), 'Maya Jensen', 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 days')),
 ('00000000-0000-4000-8000-000000000242', 'demo', '00000000-0000-4000-8000-000000000105', 'Install doors', date('now','+45 days'), date('now','+50 days'), 'Crew North', 0, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 days')),
 -- Library ramp: done
 ('00000000-0000-4000-8000-000000000251', 'demo', '00000000-0000-4000-8000-000000000106', 'Groundwork', date('now','-60 days'), date('now','-52 days'), 'Crew North', 1, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now','-80 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-52 days')),
 ('00000000-0000-4000-8000-000000000252', 'demo', '00000000-0000-4000-8000-000000000106', 'Ramp and railings', date('now','-51 days'), date('now','-41 days'), 'Crew North', 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now','-80 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-41 days')),
 ('00000000-0000-4000-8000-000000000253', 'demo', '00000000-0000-4000-8000-000000000106', 'Handover', date('now','-38 days'), date('now','-38 days'), 'Maya Jensen', 1, 2, strftime('%Y-%m-%dT%H:%M:%fZ','now','-80 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-38 days'));
