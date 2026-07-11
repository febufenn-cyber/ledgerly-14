# Ledgerly

> an AI categorization co-pilot that labels bank and Stripe transactions and drafts month-end journal entries for micro-businesses.

**Alternative to the product-shape pioneered by Truewind (YC W23)** — rank #14 of 500 in the [YC-500 Fable 5 Venture Blueprint](https://github.com/) (score 7.15/10).

## Why this exists
Bookkeeping is high-volume, repetitive, and perfect for AI leverage The buildable wedge: transaction categorization co-pilot fed by bank/stripe feeds.

## MVP scope
- [ ] Import bank/Stripe CSV
- [ ] AI categorize
- [ ] learn corrections
- [ ] monthly summary
- [ ] export to Xero/QBO

## Architecture
`Workers+Supabase+Claude` — Cloudflare Workers + Hono API, Supabase (Postgres + RLS + Auth + pgvector), Claude API via Agent SDK (claude-fable-5 for agent reasoning, claude-haiku-4-5 for volume), wrangler deploys.

**Integrations:** Plaid/CSV; Stripe; QuickBooks/Xero
**Data:** Transactions; category rules; corrections
**Agent core:** Agent categorizes transactions and asks only about ambiguous ones

## Business
| | |
|---|---|
| Monetization | Monthly SaaS per entity |
| First customer | Solo founders doing own books |
| GTM wedge | Founder communities; 'bookkeeping for startups' SEO |
| Competition risk | High: Truewind, Puzzle, QBO |
| Regulatory/trust risk | Med: accounting accuracy |
| India angle | Tally/Zoho Books export; Indian expense heads |
| Difficulty / build time | Medium / 2-3 weeks |

## 30-day plan
- **W1:** core loop — Import bank/Stripe CSV + AI categorize
- **W2:** learn corrections + monthly summary + export to Xero/QBO + auth + billing
- **W3:** polish, instrument events, seed first users via: Founder communities; 'bookkeeping for startups' SEO
- **W4:** launch + first revenue; kill/scale decision

---
*Built with Fable 5 (Claude Code). Blueprint row: inspired by Truewind — "AI-powered bookkeeping and month-end close for startups"*