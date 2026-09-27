-- 030: برچسبِ نقش‌هایِ زوج — هر دو «همسر» بودند و در UI «همسر ۱/همسر ۲» نمایش داده می‌شد.
-- حالا «خانم» / «آقا» (دو زن ⇒ «خانم ۱/۲»). فقط برچسبِ نمایشی؛ code و context_label دست نمی‌خورند.
UPDATE tu_member_roles SET label_fa = 'خانم' WHERE code = 'partner_f' AND label_fa = 'همسر';
UPDATE tu_member_roles SET label_fa = 'آقا'  WHERE code = 'partner_m' AND label_fa = 'همسر';
