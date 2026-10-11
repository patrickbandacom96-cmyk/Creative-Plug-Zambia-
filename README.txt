CREATIVE PLUG ZAMBIA - ORDER APP (full rebuild)
================================================

WHAT IS IN THIS FOLDER
  index.html            Customer app (services, prices, order form, order tracking)
  admin.html            Admin login + dashboard (orders, status, prices, services)
  config.js             The ONLY file you edit (Supabase URL + anon key)
  cpz.js, cpz.css       Shared code and styles
  sw.js                 Lets the app install and open fast
  manifest.json         Install settings for the customer app
  admin-manifest.json   Install settings for the admin app
  icons/                App icons (swap in your real CPZ logo, same file names)
  cpz-supabase-setup.sql  Database setup (run once in Supabase)

HOW IT WORKS
  Customer phone -> internet -> Supabase online database -> your admin phone
  The server sets the price, so customers cannot change it by editing the page.

STEP 1 - SUPABASE (once)
  1. supabase.com > New project (name CPZ, closest region, save the password).
  2. SQL Editor > paste all of cpz-supabase-setup.sql > Run.
  3. Authentication > Users > Add user > create your admin email + password.
     Tick "Auto Confirm User".
  4. SQL Editor > run this (use your admin email):
       insert into admins (user_id) select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
  5. Authentication > Sign In / Providers > turn OFF "Allow new users to sign up".
  6. Project Settings > API: copy Project URL and the "anon public" key.
     NEVER use the service_role key in this app.

STEP 2 - CONFIG
  Open config.js, paste the Project URL and anon public key between the quotes.

STEP 3 - UPLOAD TO GITHUB (repo CPZ, branch main)
  Upload ALL files and the icons folder, replacing the old ones.
  Customer link:  https://patrickbandacom96-cmyk.github.io/CPZ/
  Admin link:     https://patrickbandacom96-cmyk.github.io/CPZ/admin.html
  Share only the customer link. Keep the admin link to yourself.
  Wait about 1-2 minutes after uploading, then open the link.

STEP 4 - THE 5 REAL TESTS (use two phones)
  1. Customer phone: place a test order.
  2. Admin phone: log in. The same order appears with number, name, phone,
     service, quantity, unit price, total, date, instructions.
  3. Admin phone: change the status to Confirmed.
  4. Customer phone: Track order (order number + phone). It shows Confirmed.
  5. Log in as admin on a third phone or browser. The order is still there.

NOTES
  - Logo Design shows "From K100". Open the order in admin and use
    "Confirm final price" when you agree the price with the customer.
  - Changing a service price only affects NEW orders. Old orders keep the price
    they were placed at.
  - If the old version is still showing on a phone, close the app and reopen it
    (or clear the site data once).
