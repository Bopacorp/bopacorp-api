# CMS Content Blocks — BOPADIGITAL

How the frontend fetches landing page content from the CMS.

---

## Public Endpoint

```
GET /api/v1/cms/landing
```

No authentication required. Returns all non-deleted content blocks for the landing page.

### Response shape

```json
{
  "success": true,
  "data": {
    "blocks": {
      "<contentKey>": {
        "id": "uuid",
        "contentKey": "string",
        "contentTypeId": "uuid",
        "title": "string | null",
        "body": "string | null",
        "sortOrder": 0,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      }
    }
  }
}
```

`blocks` is a flat `Record<contentKey, ContentBlockResponse>`. Each key maps to exactly one block (unique constraint on `contentKey`).

---

## Content Key Convention

Content keys use a **dot-notation** naming convention to express hierarchy without requiring a nested DB model.

### Pattern

```
<section>.<subsection>.<index?>
```

| Segment | Meaning |
|----------|---------|
| `section` | Top-level page area (hero, features, cta, footer, etc.) |
| `subsection` | Component within the section (title, subtitle, button, image, etc.) |
| `index` (optional) | Numeric position for repeated items (item.1, item.2, item.3) |

### Example: landing page

| contentKey | contentType | Purpose |
|------------|-------------|---------|
| `hero.title` | TEXT | Main heading |
| `hero.subtitle` | TEXT | Supporting text |
| `hero.cta` | TEXT | Call-to-action button label |
| `hero.background` | IMAGE | Background image URL |
| `features.title` | TEXT | Section heading |
| `features.subtitle` | TEXT | Section description |
| `features.item.1` | HTML | Feature card 1 (rendered HTML) |
| `features.item.2` | HTML | Feature card 2 |
| `features.item.3` | HTML | Feature card 3 |
| `pricing.title` | TEXT | Pricing section heading |
| `pricing.card.1` | HTML | Pricing tier 1 card |
| `pricing.card.2` | HTML | Pricing tier 2 card |
| `pricing.card.3` | HTML | Pricing tier 3 card |
| `cta.title` | TEXT | Bottom CTA heading |
| `cta.button` | TEXT | Button label |
| `footer.text` | TEXT | Copyright text |
| `footer.links` | HTML | Footer link list |

### Frontend consumption (TypeScript)

```typescript
type CmsBlock = {
  id: string;
  contentKey: string;
  contentTypeId: string;
  title: string | null;
  body: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type CmsLanding = {
  blocks: Record<string, CmsBlock>;
};

function getSection(key: string, blocks: Record<string, CmsBlock>): CmsBlock[] {
  return Object.values(blocks).filter(
    (b) => b.contentKey === key || b.contentKey.startsWith(`${key}.`)
  );
}

const landing = await fetch('/api/v1/cms/landing').then(r => r.json());
const { blocks } = landing.data;

const hero      = getSection('hero', blocks);     // [hero.title, hero.subtitle, hero.cta, hero.background]
const features  = getSection('features', blocks); // [features.title, features.subtitle, features.item.1, ...]
const pricing   = getSection('pricing', blocks);  // [pricing.title, pricing.card.1, ...]
```

### Admin: creating content blocks

Keys are stored in the `content_key` column of the `catalog.content_blocks` table via the existing CRUD endpoints at `/api/v1/catalog/content-blocks`.

```bash
POST /api/v1/catalog/content-blocks
Authorization: Bearer <admin-token>

{
  "contentKey": "hero.title",
  "contentTypeId": "<uuid-of-TEXT>",
  "title": "Hero Title",
  "body": "Bienvenido a Bopacorp",
  "sortOrder": 1
}
```

## Seed Script

A seed script populates the landing page with example blocks for local development:

```bash
npx tsx src/scripts/seed-cms-landing.ts
```

Requires `content_types` to be seeded first (run `seed-content-types.ts` once).

### What it seeds

| contentKey | contentType | Description |
|---|---|---|
| `hero.title` | TEXT | Main heading |
| `hero.subtitle` | TEXT | Supporting text |
| `hero.cta` | TEXT | Button label |
| `hero.background` | IMAGE | Hero background URL |
| `features.title` | TEXT | Features section heading |
| `features.subtitle` | TEXT | Features section description |
| `features.item.1` | HTML | Feature card 1 |
| `features.item.2` | HTML | Feature card 2 |
| `features.item.3` | HTML | Feature card 3 |
| `banner.promo` | BANNER | Promotional banner (rendered HTML) |
| `video.intro` | VIDEO | Video embed (iframe HTML in body) |
| `cta.title` | TEXT | CTA heading |
| `cta.button` | TEXT | CTA button label |
| `footer.text` | TEXT | Copyright text |
| `footer.links` | HTML | Footer link list |

Uses `onConflictDoNothing` so it is safe to run repeatedly.

### Rules

- `contentKey` must be unique across all blocks (enforced by DB unique index where `deleted_at IS NULL`).
- Blocks are returned sorted by `sortOrder` ascending.
- Soft-deleted blocks (`deleted_at IS NOT NULL`) are excluded from the public endpoint.
- The `body` field can contain plain text, HTML, or a URL depending on the `contentTypeId` (TEXT, HTML, IMAGE, BANNER, VIDEO).
- Adding a new section is just creating blocks with a new prefix (e.g., `testimonials.item.1`). No code changes needed.
