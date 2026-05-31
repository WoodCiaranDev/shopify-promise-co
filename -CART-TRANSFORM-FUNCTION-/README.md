# Co-Lab Cart Transform Function

Holding directory for the Shopify Function that merges Co-Lab bundle lines (ring + birthstone add-ons + engraving add-on) into a single cart line.

These files don't deploy from here — they need to live inside a Shopify Partner **app** project (which we don't yet have because it needs a Partner account). When the app exists, copy them into the extension dir and deploy.

## Setup steps (one-time)

```sh
# 1. Create a Partner account at https://partners.shopify.com (free, ~2 min)

# 2. Log the Shopify CLI in to that Partner account
shopify auth login

# 3. Scaffold an app in a sibling dir
cd /Users/ciaranwood/Sites
shopify app init --name "Promise Co Functions" --path promise-co-functions
cd promise-co-functions

# 4. Generate a cart transform extension scaffold
shopify app generate extension --template cart_transform --name "Co-Lab Bundle"

# 5. Drop our files into the scaffolded extension dir, overwriting the templates
cp /Users/ciaranwood/Sites/promise-co/-CART-TRANSFORM-FUNCTION-/src/run.graphql \
   extensions/co-lab-bundle/src/run.graphql
cp /Users/ciaranwood/Sites/promise-co/-CART-TRANSFORM-FUNCTION-/src/run.js \
   extensions/co-lab-bundle/src/run.js
cp /Users/ciaranwood/Sites/promise-co/-CART-TRANSFORM-FUNCTION-/shopify.extension.toml \
   extensions/co-lab-bundle/shopify.extension.toml

# 6. Build to confirm it compiles
cd extensions/co-lab-bundle
npm install
npm run build

# 7. Deploy the function
cd ../..
shopify app deploy
```

## After deploy — activate the function on the store

The function is published to Shopify but needs to be enabled on the storefront via the Admin API.

```sh
# Find the deployed function ID
curl -s -X POST 'https://thepromiseringco.myshopify.com/admin/api/2024-10/graphql.json' \
  -H "X-Shopify-Access-Token: <TOKEN_WITH_read_cart_transforms_OR_admin>" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ shopifyFunctions(first: 10) { nodes { id title apiType app { title } } } }"}'

# Activate it (replace <FUNCTION_ID>)
curl -s -X POST 'https://thepromiseringco.myshopify.com/admin/api/2024-10/graphql.json' \
  -H "X-Shopify-Access-Token: <TOKEN_WITH_write_cart_transforms>" \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation($id:String!){cartTransformCreate(functionId:$id,blockOnFailure:false){cartTransform{id}userErrors{field message}}}","variables":{"id":"<FUNCTION_ID>"}}'
```

Note: the existing Promise Form token will need `read_cart_transforms` + `write_cart_transforms` scopes added (Settings → Apps and sales channels → Develop apps → Promise Form → Configuration).

## How the function works

Each Co-Lab add-to-cart fires a single `/cart/add.js` POST with multiple `items[]`:
- The ring variant, with `properties[Birthstone One]`, `properties[Birthstone Two]`, `properties[Engraving]`, plus hidden `properties[_bundle_id] = <uuid>` and `properties[_bundle_role] = parent`
- A `birthstone-addon` line (qty = number of stones picked), with `properties[_bundle_id] = <same uuid>` and `properties[_bundle_role] = birthstone`
- An `engraving-addon` line (only when engraving non-empty), with `properties[_bundle_id] = <same uuid>` and `properties[_bundle_role] = engraving`

Shopify then runs `cart.transform.run` on every cart mutation. The function:
1. Groups lines by `_bundle_id`
2. For each bundle, finds the parent line (the ring) and the child add-on lines
3. Emits a `merge` operation: child lines collapse into the parent line, with the human-readable Birthstone / Engraving attributes preserved on the merged line

Result in cart/checkout/order:
- **One line**: "Promise Heart Solitaire Ring — 18k Gold Vermeil / L"
  - Birthstone One: Sapphire - September
  - Birthstone Two: Emerald - May
  - Engraving: Forever
- **Price**: £96 (base) + £10 + £10 + £20 = £136 (natural sum, no markup or discount needed — the cost rolls up from the underlying lines)

## What's still needed after deploy

- Make sure the `birthstone-addon` and `engraving-addon` products are published to the Online Store sales channel (currently `status: ACTIVE` but `onlineStoreUrl: null`). They need to be channel-published so `/cart/add` can add them. Hidden from search/sitemap/discovery is fine.
- Verify end-to-end: pick stones, ATC, check cart drawer shows one merged line at correct total, proceed to checkout, confirm same.

## Why a Function and not the line-item-properties-only approach

Without the function, the cart would show three separate lines (ring + 2 birthstone-addon + 1 engraving-addon). The price would be charged correctly (line items sum) but the cart UI would expose the add-on products to the customer, which looks unprofessional and confuses bundle editing. The function gives us the merged-line presentation Shopify has documented as the "fixed-price bundle" pattern.
