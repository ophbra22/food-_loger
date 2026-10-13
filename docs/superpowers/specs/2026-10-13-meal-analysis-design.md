# Biteflow meal analysis

The user's detailed brief authorizes autonomous implementation. Preserve Orbit,
English/Hebrew/RTL, authentication, barcode lookup, account data and existing APIs.
This is an architectural extension of the existing photo → review → journal flow.

## Diagnosis and choices

The original MobileNetV2/ImageNet pipeline center-crops to 224px, maps only 23
classes, proposes one food, and uses an explicitly illustrative nutrition catalog.
Keep that endpoint for installed clients and baseline evaluation. Add a typed
meal-analysis endpoint backed by server-side Gemini in a confirmed Free Tier
project. The user subsequently prohibited paid APIs and dependency on their Mac.
These constraints supersede the initial OpenAI proposal. Paid providers are removed.
The existing Google project/key was reused after its Free Tier status was verified.
No billing was activated. Model selection and measurements are in
`../../MEAL_ANALYSIS.md`; do not claim superiority to untested paid services.

Use one structured whole-image call, optionally with a second angle and plate
diameter/context. Separate visible components, including sides/drinks/sauces;
composite dishes are single items with descriptive ingredients, never separately
counted children. No fabricated segmentation/boxes/depth. Region descriptions
help distinguish duplicate-looking servings. Return abstention for no food and
explicit clarification for ambiguity. A second image is another view, not another
meal. Provider generates identities and grams/ranges only, never nutrient values
or database identifiers. Bound and validate every output.

USDA FDC public-domain SR Legacy and FNDDS extracts provide actual IDs, descriptions,
per-100g values and provenance. Deterministic conservative candidate ranking rejects
raw/cooked and preparation conflicts. Expose alternatives and search to the user.
Unknown records remain missing, not zero or invented calories; manual values are
explicitly user supplied. Open Food Facts remains the existing barcode workflow.
Server and client use the same decimal rounding rule for item nutrition and totals.
Weight ranges are heuristic uncertainty guardrails, not calibrated intervals.

## Flow and reliability

User selects image, sees preview/privacy notice, can optionally add a second view,
plate size and food context, then analyzes. Show honest stage labels without fake
percentages. Review multiple editable items with nutrient source, uncertainty,
alternative selection/search, rename/add/remove, editable grams and immediate math.
Persist the analysis as an account-scoped draft without photos. Save all items
atomically to the existing meals table with group provenance and retry-safe IDs;
no schema migration. Diary continues to show individual entries.

Bound uploads before decode, transpose EXIF, strip metadata, retain aspect ratio,
limit inference resolution, detect low-quality images with explicitly heuristic
warnings. Require existing auth/CSRF, per-user rate limits and global concurrency.
Cache short-lived result JSON per account and request fingerprint, never photos.
Timeouts/retries bounded; fail closed on absent keys, malformed/refused output.
Do not silently fall back to fake or legacy successful analysis. Provider retention
terms are disclosed. Gemini requests use store=false, which does not override
Google's unpaid-service data-use terms. Keys stay backend-only. A local Ollama
adapter is available solely for explicit development comparisons; production
rejects it. The shipped phone calls the hosted backend, not a developer computer.

## Validation and release

Test arithmetic, schema, matching, provider transport failures, image handling,
complete authenticated API/save/retry/isolation, mobile editing/draft saving and
existing suites. Use licensed Nutrition5k photos and published mass/nutrition labels
for evaluation, with a manifest for additional cases and explicit coverage gaps.
Do not fabricate accuracy, ground truth, latency or cost. Preserve failed live
attempts as evidence alongside successful runs. No infrastructure migration, paid
subscription, public release or deployment is implied by local implementation.
