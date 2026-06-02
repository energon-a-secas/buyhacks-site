# Product

## Register

product

## Users

People who like a curated "stuff that actually works" list: builders, remote workers, and home-optimizers who want a vetted product with a real verdict and community tips, not an affiliate-stuffed listicle. They browse to discover, react (love / own / want), read the life-hack tips, and occasionally submit a product they swear by. They expect to browse and vote with zero signup friction.

## Product Purpose

BuyHacks is a curated product showcase with community votes and life-hack tips. It merges 24 curator-picked products with user submissions, each carrying an honest verdict (Recommended / Mixed Feelings / Skip), curated highlights, and crowd tips. The job: find a trustworthy product fast, see how others rate it across three intents (love it / own it / want it), and learn the tips that make it worth owning. Success is a quick "this one, and here's the trick to using it" moment.

## Brand Personality

Neorgon voice with a warm, practical-recommendation tone: a friend who tests things and tells you the honest verdict. Three words: capable, generous, honest. The verdict system is the personality, it admits when something is a Skip.

## Anti-references

All Neorgon suite anti-references (see root `PRODUCT.md`), plus: affiliate-spam product blogs, fake-urgency "BUY NOW" stores, review sites where everything scores 9/10, and listicles that bury the actual recommendation under ads. BuyHacks shows the verdict first and never fakes scarcity.

## Design Principles

1. **Verdict first.** Every product leads with an honest Recommended / Mixed / Skip badge; the recommendation is the headline, not buried.
2. **Browse and vote without a login.** Discovery, search, filter, sort, and reading tips are all anonymous. Auth gates only contribution (submitting products, posting tips).
3. **Tips are the payoff.** Curated highlights plus community tips turn a product card into "how to actually use this."
4. **Two views, one vocabulary.** Grid and compact-list layouts share the same verdict badge, vote row, and card anatomy so switching never disorients.
5. Inherits all root suite principles.

## Accessibility & Inclusion

WCAG 2.2 AA targets from the suite. Verdict badges and vote states must carry text or shape, never color alone (Recommended/Mixed/Skip differ by label, not just green/amber/red). Vote, detail, and toggle controls need visible `:focus-visible` rings and 44px touch targets. Honor `prefers-reduced-motion` for card entrance and hover lift. Toast and result-count changes announce via `aria-live`.
