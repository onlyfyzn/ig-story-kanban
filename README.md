# IG Story Kanban (Symone)

A small Kanban web app to track Instagram story sequences (Canva links) with clean status workflow.

## Local dev
```bash
cd ig-story-kanban-app
npm run dev
```
Open: http://localhost:3000

## Collaboration (2 people editing)
This app supports **shared editing** via Supabase.

### 1) Create a Supabase project
- Create a project
- Create a table named `ig_story_cards`
- Use this SQL:

```sql
create table if not exists ig_story_cards (
  id text primary key,
  title text not null,
  canvaUrl text,
  notes text,
  dueDate text,
  owner text,
  priority text,
  status text,
  approvedBy text,
  createdAt text,
  updatedAt text
);

-- RLS off for quick internal use (turn on later if you want auth)
alter table ig_story_cards disable row level security;
```

### 2) Add env vars
Create `ig-story-kanban-app/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Now both you + Symone will see the same board when deployed.

## Canva previews
Paste a Canva share link into a card.
- The app attempts to generate an embed URL and shows it in an iframe preview.
- If Canva blocks embedding for a link, you can still click **Open Canva**.

## Deploy to Vercel
Once the repo is in GitHub:
1) Import it into Vercel
2) Set the same env vars in Vercel project settings
3) Deploy

(If you want, I can run the deploy from this machine once you confirm your Vercel account is connected here.)
