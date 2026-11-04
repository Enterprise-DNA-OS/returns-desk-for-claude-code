---
description: Add a read-only returns view
---

# Add a read-only returns view

Read views.json and the migration. Use the existing views and explicit column names. Add a SELECT-only section to views.json, keep currencies separate and label missing prices. Run npm run view and inspect the resulting HTML at desktop and mobile sizes. Escape all data through scripts/lib/render.mjs. Do not create forms, actions, a server or a second data store. Include a specific data assertion in npm test when the query introduces new calculations.
