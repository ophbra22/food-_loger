# BiteFlow Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after explicit user approval. Steps use checkbox (`- [ ]`) syntax for tracking. **PLANNING ONLY — no implementation, external write, live AI or release is authorized by this document.**

**Goal:** לסגור באופן מדיד את הפערים שנותרו במפרט F01–F20, ולהגיש גרסת iOS ו־Android מוכנה לאישור שחרור, עם ראיות, בעלי אחריות ודרך התאוששות בטוחה.

**Architecture:** ממשיכים את FastAPI, היומן הקיים, חוזי MealDraft, מסך האישור המשותף, SQLite/PostgreSQL והמתאמים המקומיים של Expo. לא בונים יומן/מנוע תזונה/מערכת הזדהות חלופיים. מפרידים תיקוני קוד, אימות חיצוני, חתימה, הפעלת יכולות ושחרור; התקדמות במשימה אינה סוגרת חסם של משימה אחרת.

**Tech Stack:** Python 3.11–3.12, FastAPI, pytest/Ruff; PostgreSQL/SQLite; Expo SDK 57, React Native 0.86, TypeScript/Jest; Swift/WidgetKit/HealthKit ו־Kotlin/Health Connect/App Widgets. אלה גרסאות הבסיס שנבדק בקוד, לא המלצה לשדרוג לגרסה שלא נבחנה.

**Spec:** [מפרט המוצר](../../biteflow/requirements/BiteFlow_SPEC_EN.md), [תוכנית P00–P14](../../biteflow/requirements/BiteFlow_IMPLEMENTATION_PLAN_EN.md), [מפת העבודה המותאמת למאגר](../../biteflow/roadmap.md), [כל החסמים](../../biteflow/p14-open-gates.md), [מטריצת F01–F20](../../biteflow/p13-verification-matrix.md), [תוכנית ההתאוששות](../../biteflow/p13-release-plan.md), [האימות האחרון](../../biteflow/p14-packaging-follow-up.md).

## מצב, היקף וגבול ההצלחה

תאריך: 2026-10-18. בסיס נבדק: `e7f7c9deaae32d600ec4499018451f9cc0612229`, ענף מקומי `codex/biteflow-p14`, בעותק העבודה `/Users/braude/.codex/worktrees/biteflow-p01/food-_loger`. בתחילת התכנון השינוי היחיד מחוץ למעקב היה קישור `.venv` הקיים. נוצר מסמך תוכנית בלבד; לא הורצו מחדש בדיקות מוצר ולא נעשו שינויים במימוש.

בסיס הראיות האחרון: 660 בדיקות Python עברו, 9 דולגו; 6 בדיקות דפדפן הורצו בנפרד ועברו, כך ש־666 בדיקות Python ייחודיות עברו ו־3 בדיקות מודל לא הורצו. 428 בדיקות מובייל ב־83 חבילות עברו, וכן typecheck, lint ואריזת Python. אלה תוצאות היסטוריות של המקור המתועד, לא הבטחה לגבי קוד עתידי או מכשירים. בניית iOS האחרונה ובדיקת Android lint המלאה נכשלו; 67 התרעות npm הן נתון מהבדיקה הקודמת, לא סריקה עדכנית.

ברירת המחדל לתוכנית היא **מלוא F01–F20 בשתי הפלטפורמות**. הפחתת היקף דורשת החלטה מפורשת של בעל המוצר, משאירה את הפער המתאים פתוח ומתועדת כגרסה מצומצמת. יכולת כבויה אינה יכולת שהושלמה.

יש שלוש נקודות סיום שונות:

1. **מוכן לאישור שחרור — RC19:** קוד, בדיקות, איכות זיהוי, חתימה, מכשירים, staging, פרטיות והתאוששות מאומתים להיקף המאושר. עדיין לא שוחרר דבר.
2. **שוחרר — RC20:** פעולה נפרדת, רק לאחר אישור מפורש המתייחס לגרסאות ולפעולות המדויקות.
3. **P14 מלא — RC21:** רק לאחר שחרור ותצפיות אמיתיות. אי אפשר להפוך אותו לתנאי מקדים מעגלי לשחרור או לסגור אותו באמצעות נתונים סינתטיים.

## Global Constraints

- לא מתחילים מימוש עד אישור המשתמש. אישור עבודה מקומית אינו אישור push, merge, פריסה, שינוי מסד מרוחק, פעולת חנות, איסוף מידע או קריאות AI אמיתיות.
- ממשיכים בחוזים ובמנגנוני הבעלות הקיימים. כל קלט מגיע לאישור מפורש; אין שמירת AI אוטומטית. `unknown != 0`; אין שינוי שקט של היסטוריה או העתקת יעדים עם ארוחות.
- שומרים על precision, כמויות חלקיות ועל גבול הכמות הקיים `0.0001–2000 g/ml`. אין המרת g/ml ללא בסיס מתאים; kcal מתווית אינו מוחלף אוטומטית בחישוב 4/4/9.
- מפתחות ספקים נשארים בשרת; אין סודות בקוד, בדוחות או בדגלי Expo ציבוריים. אין עבודה על פרטי חשבון אמיתי בתוך fixtures.
- בדיקות שגרתיות משתמשות ב־AI מדומה. הערכה אמיתית דורשת הרשאה ייעודית עם ספק, מודל, נתונים, מגבלת קריאות ותקציב; 500/350/150 אינן מכסות חשבון מוכחות.
- שינויים במסד, אם יידרשו, יהיו מוסיפים ותואמים; קוראים תואמים לפני כותבים חדשים, ניסוי על עותק, ותוכנית שחזור. אין מחיקת טבלאות/קבלות/רשומות לשם rollback.
- שומרים על תיקוני P13 ועל רצפת המקור התואמת `4d97784`, לרבות אבטחה, ניקוי קבצים ו־Retry אחרי logout. אין חזרה תפעולית ל־P12 או ביטול גורף של P13.
- שומרים על טיוטות label, פעולות מדידה ממתינות, notification leases, קבלות Health ויכולות ניקוי widget בכל החלפת גרסה.
- תוצאה תסומן PASS / FAIL / SKIPPED / NOT RUN / BLOCKED עם מקור, פקודה, תאריך וסביבה. אין סגירת חסם על בסיס הבטחה או תוצאה ישנה.
- עובדים במשימות קטנות עם commits מקומיים, סקירה ובדיקות רלוונטיות. לא משנים שלוש מערכות גדולות במקביל; עבודה מקבילית אפשרית רק בגבולות המפורשים להלן.

## Review Focus

1. **תגובה שאבדה אחרי עריכת ארוחה או שינוי יום:** אותה בקשת retry לא משכפלת או מחזירה רשומה שנמחקה; שני הימים והסנכרון מתעדכנים — RC04, RC13, RC18.
2. **תיקון g/ml במוצר מאומת:** נשמרים המקור והתיקון הידני, בלי המצאת צפיפות או שדרוג אמינות; קורא ישן לא מאבד provenance בשקט — RC03, RC16.
3. **קריסה אחרי יצירת ייצוא ולפני ניקוי, גם לאחר logout:** התאוששות פועלת ללא אימות משתמש, אינה מוחקת טיוטות/קבלות או קבצים זרים, ואינה משקרת על הצלחה — RC05, RC19.
4. **אובדן אחסון מקומי/הרשאה/חשבון בזמן Health או widget:** אין כפילויות, מחיקת מידע צד שלישי או חשיפת המשתמש הקודם — RC13–RC14, RC18–RC19.
5. **מקור זיהוי חסר או ניסוי שנכשל/חזר על עצמו:** כישלונות וקריאות חוזרות נשארים במכנה ובתקציב; held-out אינו משמש לכוונון — RC09–RC11, RC17, RC21.

## סביבת ביצוע ואישורים

הסימונים בטבלת המשימות: **L** מקומי; **X** גישה חיצונית; **D** מכשיר אמיתי; **A** החלטה/אישור משתמש. L אינו אומר שהמשימה מאומתת על מכשיר.

| הרשאה | מה נדרש ומתי | מה אינה מאשרת |
|---|---|---|
| A1 — התחלת עבודה מקומית | אישור לתוכנית או לגל מוגדר מתוכה; תיקוני קוד, tests, builds, מסדי בדיקה זמניים ו־commits מקומיים | שינוי מרוחק, AI חי, התקנה בטלפון או פרסום |
| A2 — גישה לחשבונות | גישת קריאה מתאימה ל־GitHub/hosting/ספק AI/Apple/Google, לפי המשימה. פרטי גישה במנגנון מאובטח, לא בהודעה או בקובץ תוכנית | יצירת משאבים, שינוי billing/quotas, הרשאות או provisioning |
| A3 — CI ו־staging | branch ויעד מוגדרים, אישור push והפעלת CI, משאבי ניסוי, עלות, פריסה ומיגרציות ב־staging בלבד; בדיקת טריגרי deploy לפני push | merge או פריסת production |
| A4 — מכשירים וחתימה | בעל מכשיר מסכים להתקנה ולבדיקה; זהויות בדיקה ונתוני מזון/בריאות סינתטיים; גישת חתימה. שינויים ב־Apple/Play/provisioning מאושרים במפורש | נתוני בריאות אישיים, פרסום לחנויות או הפעלה לכלל המשתמשים |
| A5 — הערכה אמיתית | אישור נפרד להרצת מודל מקומי אמיתי אם ההגבלה נשארת mocked-only; לקריאות ספק: מודל/פרויקט, תנאים, dataset מורשה, תקרת קריאות ועלות וכלל עצירה | retry בלתי מוגבל, fallback בתשלום, חשיפת מידע אישי או AI בייצור |
| A6 — מדיניות ואיסוף | החלטות retention, פרטיות, נתוני ניטור, יעד, גישה, cohort ובעלי אחריות. אישור נפרד להפעלת איסוף אמיתי | הסקת הסכמה מאישור טכני או איסוף כבר בזמן התכנון |
| A7 — שחרור | אישור סופי ל־commit, artifacts חתומים, flags, migrations, cohort, חלון שינוי ותוכנית rollback ספציפיים | שינויים נוספים מעבר לחבילת השחרור המאושרת |

קריאת תיעוד ציבורי וסריקת advisory registries אינן קריאות AI או שינוי production; הן יבוצעו כחלק מהעבודה שאושרה. הורדות SDK/תלויות או גישה לחשבונות תתועדנה בנפרד מהיכולת לעבוד ללא רשת. אין צורך לפתוח את כל ההרשאות מראש.

## סדר עדיפות, תלויות וגלי עבודה

**דחיפות 1:** שלמות נתונים, פרטיות, יכולת בנייה וביטחון בנתוני התזונה. **דחיפות 2:** השלמת בדיקות תכונות, מכשירים וסביבה אמיתית. **דחיפות 3:** שיפורים נדחים ותפעול; חומרתם המקורית לא משתנה רק משום שנכללו בתוכנית.

| גל / מזהה | תוצר | דחיפות | תלות | סביבה ואישור |
|---|---|---|---|---|
| 0 / RC00 | היקף גרסה, מטריצת חסמים, בעלים ומשאבים | 1 | אישור התוכנית | L, A1; החלטות מוצר |
| 1 / RC01 | כלי בנייה תואמים ו־native build משוחזר | 1 | RC00 | L; X להורדות לפי הצורך |
| 1 / RC02 | טיפול בתלויות, סודות ו־lint מלא | 1 | RC00; תיאום גרסאות עם RC01 | L/X; A2 לחשבונות אם נחוץ |
| 1 / RC03 | provenance ותאימות לתיקון בסיס תזונתי | 1 | RC00 | L |
| 1 / RC05 | התאוששות ניקוי קבצים אחרי סגירה/קריסה | 1 | RC00 | L; אימות D בהמשך |
| 2 / RC04 | עריכת ארוחה שמורה מקצה לקצה | 1 | RC03 | L; D בגל 5 |
| 2 / RC06 | 10%, עברית, רענון וגבולות שימוש | 3 | RC00; RC01–02 לאזהרות native | L; D בגל 5 |
| במקביל / RC07 | פרטיות, retention, ייצוא גדול ותמיכה | 1 | RC00 | L/X/A6; D לניקוי בפועל |
| במקביל / RC08 | מקורות ומנות ישראליות עם ראיות | 1 | RC00; RC03 לשמירת התיקונים | L/X/A2; אישור נתונים/תנאים |
| במקביל / RC09 | תנאי ספק, מכסות ותקציב מאומתים | 1 | RC00 | X/A2/A5; ללא inference בשלב האימות |
| במקביל / RC10 | dataset ופרוטוקול תמונות/OCR וקול | 1 | RC00, RC07; RC08 לתוויות/מקורות | L/X/D/A; איסוף מורשה בלבד |
| 3 / RC11 | baseline, שיפור זיהוי והשוואת held-out | 1 | RC03, RC08–RC10, A5 | L/X; AI אמיתי רק באישור |
| 3 / RC16 | CI, staging, מיגרציות ושחזור | 1 | הכנה מ־RC00; מועמד אחרי RC01–RC08 | L/X/A3; שער סביבה לשאר הבדיקות |
| 3 / RC17 | ניטור מינימלי ובדיקתו הסינתטית | 2 | RC07/A6; staging מ־RC16 | L/X/A3/A6; איסוף אמיתי עדיין כבוי |
| 4 / RC12 | קול והרשאות במכשירים | 2 | RC01–RC02, RC05, RC07, RC10 | D/A4; A5 רק אם מוצע cloud fallback |
| 4 / RC13 | Apple Health / Health Connect | 2 | RC01–RC05, RC07, RC16 | D/X/A4; פלטפורמות נבדקות בנפרד |
| 4 / RC14 | widgets, זמן ורענון ופרטיות | 2 | RC01–RC05, RC07, RC16 | D/A4; אין תלות מלאכותית ב־Health אם לא צורך בו |
| 4 / RC15 | משלוח התראות אמיתי ב־staging | 2 | RC01–RC02, RC07, RC16 | D/X/A3/A4 |
| 5 / RC18 | כל E2E-01–20, נגישות וביצועים | 1 | RC01–RC17 הרלוונטיים הושלמו | L/X/D |
| 6 / RC19 | סקירה, rollback וחתימת מוכנות | 1 | RC18; כל חסמי ההיקף סגורים | L/X/D/A; **עוצרים לפני שחרור** |
| נפרד / RC20 | שחרור מדורג מאושר | 1 | RC19 + A7 מפורש | X/A7 |
| אחרי שחרור / RC21 | P14 עם תצפיות ומשוב אמיתיים | 2 | RC20, RC17 + A6 לאיסוף | X/A6; ללא המצאת מדדים |

מסלול קריטי: `RC00 → RC01/02 + RC03/04/05 → RC16 → RC12–15 → RC18 → RC19`. במקביל חייב להסתיים מסלול איכות הליבה `RC07/08/09/10 → RC11 → RC18`. הכנת חשבונות, מכשירים ונתוני הערכה מתחילה מוקדם לאחר אישור, כדי שלא תחסום בסוף. הכנת ניטור ובדיקתו קודמות לשחרור; הנתונים האמיתיים מגיעים אחריו.

אפשר לקדם במקביל הכנת נתונים/גישות ותיקון קוד אחד. iOS ו־Android יכולים להיבדק במקביל לאחר קיבוע ממשק הסנכרון. לא מבצעים שני שדרוגי תלויות עצמאיים על אותו lockfile. אין לוחות זמנים מובטחים לפני RC00–RC02: זמינות מכשירים, חשבונות, נתונים ותוצאת build אינם ידועים מראש.

## מבנה התוצרים והראיות

כל הנתיבים להלן יחסיים לשורש המאגר. משימה תיצור דוח `docs/biteflow/release-readiness/RCxx.md` וראיות ב־`docs/biteflow/evidence/release-readiness/RCxx/`; אלו נתיבים מתוכננים, לא קבצים שכבר קיימים. דוחות קודמים נשארים היסטוריים, ללא דריסה. RC00 ייצור `docs/biteflow/release-readiness/gate-register.md`, עם שורה לכל חסם מקורי: מקור, חומרה, משימת סגירה, סביבה, בעלים, סטטוס והראיה המסיימת.

כל שינוי קוד עובר מחזור: **בדיקה נכשלת משמעותית → תיקון קטן → בדיקות מושפעות → סקירה ותיקון ממצאים → commit מקומי ודוח**. אין צורך לכתוב בדיקת יחידה למסמך אנושי; משימות אימות נחתמות בראיות אמיתיות במקום RED מלאכותי. שינוי API/סכמה יופרד מהפעלת הכותב; ממצא המחייב שינוי ארכיטקטורה מהותי חוזר לאישור לפני ביצועו.

## Task 0: RC00 — קיבוע היקף, אחריות ומשאבים

**ממשק:** מקבל את המפרט ואת כל הרשומות ב־`p14-open-gates.md`; מפיק רשימת F01–F20/E2E-01–20 וסביבות נתמכות עם בעלים, ללא מחיקת חסמים נדחים. אישור המשתמש הוא תנאי להתחלה, לא תוצאה של כתיבת התוכנית.

- [ ] ליצור את gate-register ולמפות כל שורה בטבלת הכיסוי בסוף מסמך זה. ניסוחי "Pxx not started" היסטוריים אינם חסמים חדשים לאחר אישורים מאוחרים.
- [ ] לאשר פלטפורמות/גרסאות OS, היקף הפיצ׳רים, מי בודק מכשירים ומי אחראי נתונים, פרטיות ושחרור. אפשר שאדם אחד ימלא כמה תפקידים, אבל אין להמציא שמות או signoff.
- [ ] לרשום מה זמין בפועל: מכשירים, Mac/Xcode, חתימה, חשבונות ספק, staging ו־GitHub. לסמן בעל גישה וחוסר גישה בלי להעתיק סודות.
- [ ] להגדיר חלונות עבודה ואישור לגל הראשון בלבד או להיקף מקומי מוסכם. **סיום:** מטריצה מאושרת ומשימות ללא בעלים מסומנות BLOCKED, לא מוכנות.

## Task 1: RC01 — כלי בנייה וגרסאות תואמים

**קבצים:** `mobile/package.json`, `mobile/package-lock.json`, `mobile/app.config.ts`, `mobile/plugins/with-health.cjs`, `with-health-connect.cjs`, `with-widgets.cjs`; מסמך סביבה חדש תחת RC01. קבצי `ios/android` הנוצרים אינם מקור לתיקון ידני קבוע.

- [ ] לשחזר על עותק נקי את כשל `ExpoModulesJSI` ב־Xcode27.1/Swift6.4 ואת build Android; לתעד גרסאות, פקודה ושגיאה, לפני בחירת תיקון. חסם Java הישן כבר נפתר מקומית ואין לפתוח אותו מחדש ללא ראיה.
- [ ] לבדוק תיעוד רשמי תואם SDK57 בעת הביצוע, לבחור שינוי מינימלי של compiler/SDK/dependency בתיאום RC02, ולתעד מדוע הוא נתמך. אין קביעה מראש שגרסה מסוימת תפתור את הכשל.
- [ ] לבנות Debug/Release נקיים, כולל extension ו־native modules; להריץ בדיקות Swift/JVM ושני מצבי flags. ליצור manifest של כלים/מקור/lockfiles. גרסת debug-signed אינה גרסת חנות.
- [ ] **סיום:** בניות משוחזרות בשתי הפלטפורמות, בלי cache שמסתיר שינוי flags. **Rollback:** חזרה לצמד toolchain/lockfiles המתועד בלבד; תיקוני אבטחה ו־P13 נשמרים.

## Task 2: RC02 — אבטחת תלויות, סודות ו־native lint מלא

**קבצים:** `mobile/package*.json`, `pyproject.toml`, `.github/workflows/ci.yml`, `Dockerfile.free`, מודולי native לפי ממצא; `mobile/plugins/speech-guard.json` ו־`with-on-device-speech.cjs` אם גרסת speech משתנה.

- [ ] להריץ audit עדכני של עץ runtime/build/test ושל סביבת Python/תמונת ההפצה המיועדת; למפות כל אחת מההתרעות ההיסטוריות למצב הנוכחי, כולל קוד שאינו מופעל. לסרוק סודות בקוד ובהיסטוריה בלי לפרסם סוד שנמצא; סיבוב סוד אמיתי הוא פעולה מתואמת בנפרד.
- [ ] לתקן ב־commits לפי משפחת תלות, בלי `audit fix --force` או שינוי Expo גורף ללא ניתוח. אם אין תיקון תואם, המשימה נשארת חסומה עד חלופה נבדקת; לא לסגור באמצעות "רק dev" ללא ראיה.
- [ ] לשחזר ולתקן את קריסת Worklets/KaModule. להריץ lint מלא ללא החרגות Worklets/Expo-core. למפות את שמונה האזהרות הקודמות ל־RC06 או לתיקון כאן.
- [ ] **סיום:** אין ממצא Critical/High רלוונטי בלתי פתור, לכל התרעה סיווג וראיה, בדיקות/build מלאים עוברים ו־speech guard עדיין מונע fallback רשת לא מאושר. false positive דורש נימוק מתועד; קבלת סיכון אינה "תוקן". אין סגירת gate אבטחה אוטומטית.

## Task 3: RC03 — מקור ותיקון בסיס תזונתי

**קבצים:** `src/foodlogger/domain.py`, `meal_service.py`, `security.py`, `app.py`; `mobile/src/domain/{canonical,meal-analysis,unified-review}.ts`, `components/MealFoodEditor.tsx`, `api/endpoints.ts`; `tests/test_canonical_domain.py`, `test_meal_service.py`, `test_partial_compatibility.py`, בדיקות canonical/unified-review/MealFoodEditor במובייל.

**ממשק מתוכנן:** להשתמש ב־`MealDraftItem.manual_override` הקיים. להוסיף metadata אופציונלי `basis_correction` עם `original_nutrition_per_100: NutritionPer100` ו־`original_source: FoodReference`; הבסיס הנוכחי נשאר ב־`nutrition_per_100.basis`. ב־ReviewFood יתווסף המקביל `basisCorrection`. metadata לא קיים לא יתווסף כשדה null לסריאליזציה ישנה; אין המצאת מקור ברשומה היסטורית. תחילת המקור נשמרת גם אחרי כמה עריכות; לא נבנה יומן אירועים חדש.

- [ ] להוסיף RED: מעבר g→ml ואחר כך ml→g שומר את המקור, מסמן override ומבטל אישור; אין המרת צפיפות אוטומטית. ערך מתוקן אינו מסומן כאילו אומת על ידי ספק.
- [ ] להוסיף בדיקות round-trip לטיוטה/מוצר פרטי/מתכון/repeat/copy/export, ו־retry של בקשה שכבר נשלחה בגרסה הישנה — ה־payload digest אינו משתנה בשל שדה חדש ריק.
- [ ] לממש קוראים תואמים תחילה, capabilities בשם `basis_correction_provenance`, ורק אז כותב metadata. כששרת אינו תומך, לא לשלוח תיקון שאובד בשקט. אם נדרש שינוי SQL, להוסיף migration נפרד וניסוי restore; לא משנים טבלאות מראש רק מפני שיש metadata חדש.
- [ ] **סיום:** מקור לפני/אחרי נגיש למשתמש, כל הנתיבים שומרים אותו, ולקוחות/טיוטות קודמים נבדקו. **Rollback:** לעצור כותב חדש ולהשאיר קוראים תואמים; אין מחיקת provenance.

## Task 4: RC04 — עריכת ארוחה שמורה, ללא מסלול שמירה כפול

**קבצים:** `mobile/src/app/(app)/meal/[id].tsx`, נתיב חדש `meal/edit/[id].tsx`, `components/MealAnalysisReview.tsx`, `api/endpoints.ts`, `data/{journal-store,save-draft}.ts`, `domain/unified-review.ts`; בדיקות חדשות `components/__tests__/MealEdit.test.tsx`, `api/__tests__/canonical-edit.test.ts`; בדיקות `tests/test_meal_service.py`, `test_health.py`, `test_health_connect.py` לפי השפעת העריכה.

**ממשק קיים:** `GET /api/meal-logs/{group_id}` ו־`PATCH /api/meal-logs/{group_id}` עם `{draft, expected_version}` ו־`Idempotency-Key`. אין API שרת חדש ללא פער מוכח. wrappers מוצעים: `mealLog(groupId)` ו־`patchMealLog(groupId, payload, idempotencyKey)` ב־endpoints; התוצאה מאומתת runtime לפי הקבוצה שהשרת כבר מחזיר. `JournalStore.onLogChanged(dates)` הוא מנגנון ההפצה הקיים.

- [ ] PR מקומי RC04-A: RED לטעינת קבוצה נכונה מתוך שורת רכיב, עריכת כמות/רכיב/זמן/יום באותו עורך, ביטול ללא mutation, ומידע legacy ללא זמן מומצא. לממש תצוגת עריכה עם writes חסומים עד השלמת RC04-B.
- [ ] PR מקומי RC04-B: RED ל־lost response→retry, 409/404, שינוי חשבון/401 בזמן עריכה, דיסק מלא ומעבר יום. לממש שמירה מפורשת עם מפתח יציב וניהול תוצאה לא ידועה; אין "הוסף ארוחה" במקום PATCH ואין overwrite עיוור אחרי 409.
- [ ] לאמת invalidation לשני הימים, Today/Trends/weekly advice/library ו־Health/widget פעילים, תוך שימור יעדים וארוחות אחרות. תרחיש E2E-04: יעדים 2,300 kcal ו־150g חלבון, עריכת צהריים משנה DayDial, שינוי יעד עתידי אינו משנה עבר.
- [ ] **סיום:** round-trip של ארוחה מרובת רכיבים ועדכון יחיד, עם נתוני מקור מ־RC03. **Rollback:** ניתן להסתיר כניסת עריכה; שומרים יכולת קריאה וקבלות של פעולות שכבר אושרו.

## Task 5: RC05 — ניקוי פרטי שממשיך גם אחרי הפעלה מחדש

**קבצים:** `mobile/src/storage/private-files.ts`, `export.ts`, `export-session.ts`, `auth/AuthProvider.tsx`, `app/_layout.tsx`; מודול חדש `storage/private-cleanup-recovery.ts`; בדיקות `storage/__tests__/private-files.test.ts`, `auth/__tests__/private-cleanup-navigation.test.tsx` ובדיקות recovery חדשות.

**ממשק מוצע:** `recoverPrivateFiles(): Promise<void>` כפעולה סדרתית אחת מעל מנגנון הניקוי הקיים. מצב recovery מינימלי ללא משתמש/טוקן/תוכן, וניקוי cold-start לפני יצירת ייצוא חדש. שמירת marker אינה תחליף לסריקת קבצים בבעלות האפליקציה; קריסה בין כתיבת קובץ לעדכון marker חייבת להיתפס.

- [ ] RED עם שתי הפעלות מבודדות: יצירת JSON/CSV→קריסה→אתחול חדש signed-out; שגיאת מחיקה חוזרת, הצלחת retry, marker חסר/פגום וכתיבה שנכשלה. טיוטות, pending operations, native receipts וקבצים זרים נשארים ללא שינוי.
- [ ] לממש התאוששות לפני export/share חדש, ללא login או שחזור credentials; כשל מציג מצב אמיתי ו־Retry מעל הניווט. לא מבטלים revocation ולא מוחקים חשבון לשם ניקוי. לא מרחיבים matcher למחיקה כללית של Caches.
- [ ] להריץ את כל בדיקות export/session/auth/cleanup, כולל stop flags. לבדוק race בין startup, share, logout והחלפת חשבון. אימות lock/reboot/kill ו־OS backup מועבר ל־RC19.
- [ ] **סיום מקומי:** ראיות תהליך חדש, לא רק retry באותו provider. **Rollback:** שומרים recovery וניקוי גם בגרסה עם export כבוי; לא חוזרים לקוד שקדם ל־P13.

## Task 6: RC06 — שיפורים נדחים וגבולות שימוש

**קבצים:** `mobile/src/domain/{goals,exact,servings}.ts`, `components/{ServingSelector,FoodRestrictions}.tsx`, `i18n/locales/{he,en}.ts`; `src/foodlogger/goals.py`; בדיקות goals/servings/FoodRestrictions. אזהרות native מטופלות בקובץ שעליו יצביע lint המעודכן, לא ברשימה משוערת.

- [ ] RC06-A: RED להשוואת אזהרת מאקרו מול Python. יעד 200, חלבון 20, פחמימה 17 ושומן 8 נותנים 220 בדיוק — **אין** אזהרה בתנאי הקיים `>10%`; חלבון 20.00001 מפעיל אותה ו־19.99999 אינו מפעיל. לבדוק גם הצד השלילי ו־null. לממש השוואה מדויקת ללא שינוי kcal שמורים.
- [ ] RC06-B: לתרגם תוויות יחידה/confidence בלי להחליף טקסט מקור המוצג כציטוט מקור; לרענן הגבלות מזון בחזרה מ־background ולבדוק response ישן/שינוי ממכשיר נוסף. לעבור על שמונה אזהרות native ולתקן או להציג ראיה ספציפית לאי־רלוונטיות.
- [ ] RC06-C: לבדוק ולהציג גבולות קיימים: copy עד 20 קבוצות, עד 100 מוצרים פרטיים פעילים, pool המלצות 60, עמודי מדידה וסנכרון מוגבלים ו־30 ימי שחזור Health. להוסיף המשך/הודעה מדויקת היכן שחסר; אין truncation שקט. אובדן תוצאת AI בזיכרון לאחר restart דורש בקשה מפורשת חדשה, בלי retry מחויב אוטומטי.
- [ ] **סיום:** כל פריט נדחה מתוקן ונבדק, או מגבלת מוצר מפורשת שהמשתמש אישר ונשארת מסומנת כמגבלה — לא כיכולת בלתי מוגבלת. הגדלת מכסות או אחסון AI קבוע אינם נכללים אוטומטית במשימה.

## Task 7: RC07 — פרטיות, retention, ייצוא גדול ותמיכה

**קבצים:** `docs/biteflow/p13-privacy.md`, `p13-release-plan.md`; `src/foodlogger/privacy.py`, `private_products.py`, `ai_gateway.py`, `auth.py`; `tests/test_privacy.py`, `test_postgres.py`. כל שינוי תפעולי עתידי יקבל runbook וראיית dry-run.

- [ ] לקבע עם בעל אחריות מדיניות לכל טבלה/קובץ/לוג/גיבוי/ספק: מה נשמר, למה, למי גישה, משך שמירה ואיך מוחקים. בפרט label cache שפג תוקפו, hashes וקבלות AI אחרי מחיקת חשבון, והבדל בין metadata תפעולי למידע אישי. אין להמציא משך retention.
- [ ] לאחר A6, להוסיף בדיקות לפני מנגנון pruning/תזמון הנדרש למדיניות. לא למחוק קבלות המשמשות למניעת resurrection או להגבלת תקציב; לשמור מינימום תואם ומאושר. dry-run מקומי קודם לכל הפעלה מרוחקת.
- [ ] לאמת מגבלות הייצוא 50,000 רשומות / 10MiB: דחייה ברורה ולא חיתוך. להכין ולתרגל על חשבון סינתטי גדול נוהל ייצוא מלא בסיוע תמיכה עם אימות בעלות, chunks/ספירות/checksums, עקביות מתועדת, הרשאות ומחיקה לאחר מסירה. לא להוסיף משימת ענן אוטומטית ללא צורך מאושר.
- [ ] לבדוק כיסוי יצוא/מחיקה לכל מידע חדש ב־RC03–RC05, ואת גבולות העותקים שכבר נמסרו לאפליקציה אחרת. **סיום:** מדיניות חתומה, מנגנונים תואמים וניסוי עם תוצאות; שאריות OS/backup דורשות RC19, לא נסגרות כאן.

## Task 8: RC08 — מקורות ישראליים, ברקודים והמרות ביתיות

**קבצים:** `src/foodlogger/{food_providers,servings,label_input,private_products}.py`, `data/servings.json`; `tests/test_servings.py`, `test_label_input.py`, fixtures תחת `tests/fixtures/biteflow/`; `docs/biteflow/p06-sources.md`.

- [ ] לבצע רענון תנאי שימוש/ייחוס/נגישות ממקורות רשמיים. גישת משרד הבריאות 403 בעבר אינה הוכחה למצב כעת; אם עדיין אין מקור מורשה ואמין, לתעד fallback USDA/OFF/private כמתיר המפרט, בלי import פיקטיבי.
- [ ] להגדיר מטריצת כיסוי לכל המזונות הרצויים ב־F10 ולמוצרים ארוזים ישראליים: רשומה נבדלת, מקור/גרסה, aliases, מצב homemade/recipe-dependent, מה חסר ומה דורש שקילה. אין משקל אחיד לחצי פיתה או לכף מכל מזון.
- [ ] להוסיף fixtures מורשים ובדיקות: חצי פיתה לפי הרשומה המסוימת, כף טחינה 15g מול כף אורז 9.875g **ברשומות הקיימות בלבד**, unit חסר, density חסר, kcal/kJ ו־per-serving, barcode מדויק/לא נמצא/מקור לא זמין. לבצע lookup אמיתי במקור המורשה לאחר גישה, ולשמור תגובה מצונזרת/גרסה כמקור ראיה.
- [ ] **סיום:** אין הבטחת כיסוי ישראלי רחב בלי מטריצת הכיסוי; אין פרסום קטלוג משולב או נתוני משתמש ללא אישור רישוי נפרד. ערכים מתוקנים נשארים user-confirmed, לא provider-verified.

## Task 9: RC09 — ספק AI, מדיניות ומכסות אמיתיות

**קבצים:** `src/foodlogger/{ai_gateway,security}.py`, `tests/test_ai_gateway.py`; מסמך ראיות ספק מצונזר RC09. שומרים את המתאם הקיים; בחירת ספק אחר היא החלטה נפרדת אם נחוצה.

- [ ] עם A2 לקרוא את הפרויקט/מודל/tier/billing/אזור/reset, daily/RPM/TPM, חיוב retry ושאר צרכני אותו פרויקט. לתעד תאריך ומקור בלי מפתחות. תנאים ציבוריים בלבד אינם ראיית מכסה או היתר לשימוש בנתוני תזונה/תמונה.
- [ ] לקבל החלטת מדיניות על סוגי הנתונים והספק המותר. אם השירות אינו מתיר את המידע, לא משתמשים בו גם כאשר יש תקציב.
- [ ] להציע budget עם headroom ושמירת עדיפות לתמונה; 100 בקשות מקביליות, reset, timeout לאחר שידור, retry ו־429 נבדקים במוק. לוודא שכל נתיב AI עובר gateway ואין fallback בתשלום שלא אושר.
- [ ] **סיום:** מכסות/תנאים/בעלים מאומתים ומדיניות נבדקת. A5 נדרש בנפרד לכל ניסוי אמיתי. שום flag ייצור אינו מופעל כאן.

## Task 10: RC10 — נתונים ופרוטוקול הערכה מוקפא

**קבצים:** `docs/biteflow/p02-photo-gate.md`, מסמך OCR/voice חדש תחת RC10; `scripts/evaluate_meal_analysis.py`, `evaluate_meal_challenges.py`, `fetch_meal_eval.py`, `tests/test_meal_analysis_evaluation.py`. תמונות/קול נשמרים רק במיקום ובמדיניות מאושרים; ל־Git מגיעים metadata מורשים או fixtures שהרישיון מתיר.

- [ ] לקבע הרשאות/הסכמה ו־ground truth עם אדם בודק עצמאי: פריטי מזון, משקלים שנמדדו, תוויות/מתכונים ומידע לא ידוע. לכל זוויות אותה ארוחה מזהה משותף, ללא זליגה בין splits. שמונה fixtures ישנים נשארים regression, אינם held-out.
- [ ] לאשר מראש את ההצעה הקיימת לפיילוט 100 ארוחות חדשות +20 תמונות ללא אוכל ו־60/20/20, או חלופה מנומקת. אלה **הצעה**, לא dataset קיים ולא גודל שמוכיח לבדו דיוק. לקבוע בנפרד מדגם תוויות עברית/אנגלית והקלטות לפי הפלטפורמות.
- [ ] להקפיא hashes, split, גרסת מדיניות ומדדים: precision/recall מותנה ומקצה לקצה, שגיאת מנה/קלוריות, כיול אי־ודאות, דיוק שדות OCR ושיעור תיקון, איכות תמלול ותיקון. לקבל ספים לפני פתיחת held-out; הספים המספריים ב־P02 הם הצעה שטרם הוכחה.
- [ ] להוסיף בדיקות evaluator מקומיות עם נתונים סינתטיים ל־missing truth, abstention, retries וכשל חלקי. לוודא מצב offline אינו שולח בקשה; ניסוי vision דורש opt-in מפורש ובדיקת budget.
- [ ] **סיום:** dataset מורשה, מאומת ומופרד, פרוטוקול וספים מאושרים; איסוף חסר משאיר BLOCKED. אין שינוי prompt להצדקת תוצאה שלא נמדדה.

## Task 11: RC11 — הוכחת איכות ותיקון תמונות/OCR

**קבצים:** `src/foodlogger/meal_analysis.py`, `label_input.py`, `nutrition_reference.py` והמתאם הקיים לפי ממצא; `tests/test_meal_analysis_{pipeline,reliability,evaluation}.py`, `test_label_input.py`; כלי ההערכה הקיימים מ־RC10. שמות בסוגריים מציינים את שלושת קובצי הבדיקות הקיימים בנפרד.

- [ ] לאחר A5, למדוד baseline של מקור קפוא עם אותם נתונים ומודל. לתעד כל ניסיון/עלות ידועה או unknown, p50/p95, שגיאות ומכנים; אין שימוש בתזמוני הכנת תמונה כתחליף לזמן ספק.
- [ ] לתעד כשלים, להפוך כל כשל שנבחר לתיקון לרגרסיה עם תשובה מדומה, ולבצע תיקון ממוקד אחד בכל פעם על development/calibration. ריבוי AI passes רק אם השיפור והתקציב מצדיקים זאת ונכללו באישור.
- [ ] להקפיא candidate ואז להעריך baseline ו־candidate על אותו held-out. כישלון אינו מתוקן באמצעות כוונון על held-out או שינוי הסף בדיעבד; חוזרים לפיתוח עם hold-out עתידי תקף.
- [ ] **סיום:** השוואה אמיתית מול הספים המאושרים, אי־ודאות ומספר דוגמאות; תמונה עם 3 פריטים ותווית ישראלית מגיעות לאישור editable, בלי ערכים מומצאים. אי־עמידה חוסמת את היכולת המתאימה. מוק אינו ראיית דיוק.

## Task 12: RC12 — קול על iOS ו־Android

**קבצים:** `mobile/src/native/speech.ts`, `components/VoiceControls.tsx`, `TextEntry.tsx`, `plugins/with-on-device-speech.cjs`, speech bridge/session tests; `src/foodlogger/text_input.py` רק לפער מוכח בפענוח.

- [ ] על מכשירים מאושרים לבדוק Hebrew/English וקיום מודל on-device, פקודת עצירה/ביטול, denied/revoked permissions, מעבר לרקע וסגירה. לוודא היעדר רשת כאשר הובטח on-device והיעדר קובצי קול שנותרו אחרי השימוש.
- [ ] E2E-03: ״אכלתי שתי ביצים וחצי פיתה״→תמלול editable→אותו Confirm; שגיאת תמלול ניתנת לתיקון ללא הקלטה חוזרת. בדיקת E2E-02 נשארת זמינה גם ללא מיקרופון.
- [ ] ממצא יוצר RED מול native boundary ותיקון קטן, ואז בדיקה חוזרת על המכשיר. cloud fallback אינו תיקון אוטומטי: דורש החלטת פרטיות ו־A5 חדש.
- [ ] **סיום:** מטריצת locale/OS/הרשאות ואיכות אמיתית; פלטפורמה ללא תמיכה נשארת חסומה או מוחרגת במפורש מהיקף הגרסה.

## Task 13: RC13 — סנכרון בריאות, שתי חבילות בדיקה נפרדות

**קבצים:** `mobile/modules/biteflow-health/`, `mobile/src/native/health/`, `src/foodlogger/{health,health_connect}.py`, בדיקות Health הקיימות. אותן משמעויות בעלות/זהות/revision; אין מסלול תזונה מיובא חדש.

- [ ] RC13-iOS: חתימה/entitlements והרשאות מינימליות; record counts אמיתיים על נתוני בדיקה, sync חוזר, write→קריסה לפני ack, edit/delete, partial/revoked permissions, foreground/background, logout וחשבון אחר.
- [ ] RC13-Android: אותם תרחישים וגם API24–27 logging ללא כניסה ל־Health SDK, availability מ־API28, גרסאות provider נתמכות, token expiry, exact-ID missing/repeated-delete, 30-day recovery והמשך עמודים. מחיקה שנכשלה נשארת pending ואינה חוסמת עבודה בלתי תלויה.
- [ ] לבדוק reinstall/אובדן ledger/כמה מכשירים, שינוי של מקור חיצוני, UUID resurrection ואי־מחיקת רשומות צד שלישי. עותק חיצוני אינו נמחק רק כי חשבון נמחק בשרת.
- [ ] **סיום:** אין כפילות או מחיקה לא מורשית בכל תרחישי ההיקף, כל מגבלת היסטוריה מוצגת במדויק, וראיות מכשיר/חתימה לכל פלטפורמה. תיקון חדש מחייב regression מקומי ובדיקה חוזרת, לא תוצאת simulator ישנה.

## Task 14: RC14 — widgets, פרטיות ושעון מערכת

**קבצים:** `mobile/modules/biteflow-widgets/`, `mobile/src/native/widgets/`, `mobile/plugins/with-widgets.cjs`, בדיקות widget/native/auth הקיימות.

- [ ] על מכשירים חתומים: gallery/install, small/medium, Android narrow/wide launchers, App Group, deep link מאומת, שינוי ארוחה/מים/יעד ורענון, עברית/אנגלית ונגישות.
- [ ] למדוד בנפרד מחיקה בדיסק ומה שעדיין נראה במסך: logout, A→B, מחיקה, expiry, lock/reboot, killed app, חצות/DST/נסיעה, אובדן marker/App Group ו־restore. אין הבטחת עדכון מיידי או פיקסלים שנעלמים תוך 15 דקות ללא ראיה.
- [ ] אם OS caching חושף מידע קודם, לתקן את מדיניות התצוגה/הפרטיות ולבדוק שוב; לא לסגור כ־"מגבלת OS" בלי פתרון והחלטת היקף מפורשת. bridges/entitlements לניקוי נשארים גם בגרסת rollback.
- [ ] **סיום:** E2E-17/19/20 על המטריצה, נתונים טריים מוצגים רק כשמתאים, ובדיקות signed-out privacy עברו בפועל.

## Task 15: RC15 — התראות אמיתיות בסביבת ניסוי

**קבצים:** `src/foodlogger/{habits,reminder_delivery}.py`, `mobile/src/native/notifications*.ts`, `components/Reminders.tsx`; בדיקות habits/delivery/session והגדרת scheduler נפרדת לאחר בחירת יעד מורשה.

- [ ] עם A3/A4 להגדיר APNs/FCM/Expo וסדרן רק ל־staging/מכשירי בדיקה. לא ליצור automation או שרת production כחלק מהכנת הקוד.
- [ ] E2E-15/18: ארוחת צהריים קיימת מדכאת תזכורת בזמן החלטה, מידע לא ידוע מדכא, water-only אינו streak, denied/revoked, quiet hours, DST, token rotation/reinstall, offline logout והחלפת חשבון.
- [ ] למדוד expiry של lease בן 15 דקות, receipts והפרדה בין התקבלה אצל שירות לבין נמסרה למכשיר; push שהתקבל בשירות אינו ניתן לביטול בדיעבד. התוכן, ההסכמה והודעות המשתמש חייבים להתאים למגבלה.
- [ ] **סיום:** משלוח אמיתי ללא כפילות/זליגת חשבון, stop/drain פועל, תצורת scheduler ו־retention נבדקו. שינוי לקוח לא מוכר/לא רשום נשאר unknown, לא "מסונכרן".

## Task 16: RC16 — CI, staging, נתונים ישנים וגיבוי/שחזור

**קבצים:** `.github/workflows/ci.yml`, `supabase/migrations/`, `src/foodlogger/{foundation,partial_migration,database}.py`, `tests/test_postgres.py`, `test_partial_compatibility.py`; `docs/biteflow/evidence/p13/restore_rehearsal.py` כנקודת ייחוס, בלי להריץ fixture הרסני על מסד אמיתי.

- [ ] להכין CI מקומי ולבדוק טריגרי deploy. אחרי A3 בלבד, push לענף שאושר והרצת CI על ה־commit המדויק. אין merge/push ל־deployment branch אגב בדיקה.
- [ ] להקים/לאמת staging נפרד, roles/grants/RLS/גרסאות/מפתחות/API origins. להפעיל שם רק flags שהיקפם אושר, עם AI כבוי כברירת מחדל. להריץ migration/backfill פעמיים וביטול/חידוש על עותק מזוהה.
- [ ] לבדוק קוראים ישנים מול partial/tiny ו־RC03 metadata; להשוות IDs/ספירות/checksums/תאריכים ותזונה. רשומות legacy פגומות נשארות quarantine. זהויות בקשות שנמחקו לפני P01 אינן ניתנות להמצאה: affected owners נשארים חסומים עד תוכנית מעבר מבוססת ואישור מפורש.
- [ ] לתרגל backup→כתיבות ועדכונים חדשים→מחיקות/erasure→restore לעותק→reconciliation, כולל כמה משתמשים, replay וביטול באמצע. להגדיר מקור capture לשינויים, encryption, retention, owner ויעדי RTO/RPO מוסכמים; דוגמה סינתטית אחת אינה DR מלא.
- [ ] **סיום:** hosted CI ו־staging עברו על המקור המיועד, בלי אובדן כתיבה או החייאת מידע שנמחק. שחזור production נשאר פעולה נפרדת; rollback שומר receipts וסכמה תואמת.

## Task 17: RC17 — ניטור מאושר לפני השחרור, עדיין ללא נתוני משתמש אמיתיים

**קבצים:** `docs/biteflow/p14-measurement-protocol.md`, `p13-privacy.md`; `src/foodlogger/{measurement,measurement_report}.py` כצרכנים קיימים. producer/adapter קטן יתווסף רק לאחר בחירת יעד ומדיניות ב־A6; לא משנים את מחשב המדדים למערכת telemetry חדשה.

- [ ] להקפיא את הגדרות 22 המדדים, cohort, מכנים, session, retries, sampling, missingness ובסיס ההשוואה עם בעל המוצר; להפריד מדד שאין עדיין לו instrumentation.
- [ ] להוסיף tests לספירה ידנית של מסעות סינתטיים: attempted/confirmed save, failure/unknown outcome, duplicate retry, no-use week, crash, sync/widget attempts. timestamp/source hash אינם הופכים קלט למאומת.
- [ ] לממש רק איסוף מינימלי שאושר עם off switch; לוודא שאין תוכן אוכל/בריאות/אלרגיות, תמונה/קול, מזהה או סוד לא מאושר בלוגים. לבחון גישה, retention ומחיקה ב־staging.
- [ ] **סיום:** דוחות סינתטיים תואמים בדיוק למקור, ניטור נכשל אינו מפיל save, וניתן להפסיק איסוף. עדיין אין מדדי אימוץ/שימור/עלות אמיתיים ואין סגירת P14.

## Task 18: RC18 — רגרסיה מלאה, נגישות וביצועים

**קבצים:** tests קיימים ב־Python/mobile; `docs/biteflow/p13-verification-matrix.md`; מטריצת device חדשה בראיות RC18. מתקנים רק כשלים ששוחזרו, עם regression לפני התיקון.

- [ ] להריץ סט בדיקות מקומי מלא של המקור המאוחד והחבילה המותקנת, כולל ה־precision וה־fresh-output regressions של P14. להריץ בנייה נקייה, native tests ו־lint מלא, לא רק JavaScript export.
- [ ] להריץ על מכשירים את E2E-01–20 לפי טבלת הכיסוי; לכל תא OS/build/lang/הרשאות/result/evidence. לבדוק HE/EN, RTL/LTR, dark, large font, VoiceOver/TalkBack, כיווניות/יחידות וצירי גרפים.
- [ ] לבדוק כל מסלול ב־offline, 401, timeout, 429, denied/cancel, source unavailable, lost response וחשבון A/B. repeat נשאר ללא AI; בחירת recommendation אינה שומרת; יעדים/מתכונים אינם משנים היסטוריה.
- [ ] למדוד זמני save/day/trends/query, bundle/startup, repeat interactions ונתיב זיהוי על אותה תצורה ונתונים; לתעד warm/cold ומכנים. לא להשוות תזמוני SQLite in-process לרשת ולהכריז שיפור.
- [ ] **סיום:** כל בדיקת קבלה רלוונטית בוצעה ועברה; אין P0/P1 או רגרסיית נתונים/פרטיות. NOT RUN אינו PASS. ספים מספריים ניסיוניים מקבלים אישור מראש; מדגם קטן נשאר לא מכריע.

## Task 19: RC19 — גרסת מועמד מוכנה לאישור שחרור

- [ ] להכין סקירה ביקורתית עצמאית של טווח commits מדויק ושל מצב החסמים, כולל חוזים, מקור תזונה, auth, race/retry ו־privacy. לתקן ממצאים מאומתים ולהריץ מחדש את הבדיקות שנפגעו; אין חובה לסבב בדיקות מיותר אם השתנה רק מסמך.
- [ ] לבנות artifacts חתומים עם המקור וה־flags הסופיים, hashes, API origin, entitlements ו־SBOM; להכין release notes, הנחיות משתמש, privacy/Health/store declarations וערוץ תמיכה. הגשתם לחנויות דורשת אישור נפרד.
- [ ] במכשירים וב־staging בלבד, להוכיח rollback תואם: עצירת קבלה חדשה, drain בכל workers, retained drafts/receipts, export disabled, CSV/security נשמרים, cleanup/retry/kill/restart, widget pixels והגנת קובץ בנעילה/backup. לא מוחקים חשבון כדי לנקות קובץ ולא חוזרים ל־P12.
- [ ] לסגור שורה־שורה את gate-register בראיה. להציג בנפרד מגבלות פלטפורמה שאינן ניתנות לביטול ואושרו במוצר, בלי הבטחות בלתי אפשריות כגון recall לעותק שכבר שותף.
- [ ] **סיום:** דוח מוכנות עם 0 חסמים פתוחים להיקף המאושר, כל הארטיפקטים והראיות, בעל rollout ו־rollback מזוהים. **עוצרים כאן ומבקשים A7; אין שחרור אוטומטי.**

## RC20–RC21 — פעולות נפרדות שאינן כלולות באישור עבודה מקומית

**RC20 — שחרור:** רק אחרי A7 מפורש לפרטי המועמד, לבצע את פעולות ה־push/merge/deploy/migrations/store/cohort שאושרו, לפי הסדר והתנאים המוסכמים. לעצור על הפרת פרטיות/שלמות נתונים או תנאי העצירה; לא לבצע שחזור מסד גורף. לתעד תוצאה אמיתית, לא להחשיב upload לשחרור. ההצעה הקודמת ל־5 בודקי staging, 2 מכשירים לפלטפורמה ו־48 שעות אינה אישור או הבטחת מספקות סטטיסטית; גם ספי saves/crash/latency נשארים הצעות עד שנקבעו מראש.

**RC21 — P14:** רק לאחר RC20 ואישור איסוף A6, לאסוף תצפיות לפרקי הזמן המאושרים, לאמת lineage/coverage/מכנים באופן עצמאי, להפעיל את כלי הדוחות הקיים ולבחון פערים מול baseline ומשוב אמיתי מצונזר. מדדים חסרים נשארים חסרים; אין המצאת שיפור retention. לקבל החלטות מוצר על backlog המשך. שינוי פיצ׳ר נוסף או traffic מתמשך בתשלום דורש היקף מאושר חדש.

## תוכנית בדיקות ופקודות — לביצוע עתידי בלבד

כל פקודה תורץ בסביבה מסוננת, בלי production/provider credentials, עם תוצאות בנתיב ראיות חדש. בדיקות PostgreSQL מקבלות DSN של מסד זמני ייעודי בשם המסתיים `_test`; ה־fixture מוחק/יוצר מבנה ולכן אסור להפנותו ל־staging/production. ל־staging יוכנו בדיקות לא הרסניות או עותק נפרד. טווח בדיקות targeted נקבע בקובצי המשימה; בסגירת גל משמעותי וב־RC18 נדרשות גם הבדיקות המלאות.

| בדיקה | פקודה/מנגנון | תנאי סיום |
|---|---|---|
| Backend | `.venv/bin/python -m pytest -q -rs` עם DB זמני | 0 failures; כל skip מסווג ומושלם היכן שנדרש |
| Browser | `FOODLOGGER_RUN_BROWSER_TESTS=1 .venv/bin/python -m pytest -m browser -q -rs` | כל המסעות הרלוונטיים עוברים; אין כפל ספירה |
| Mobile | ב־mobile: `npm test -- --runInBand`, `npm run typecheck`, `npm run lint` | 0 failures/errors; warnings נבדקים ולא מוסתרים |
| Python style | `.venv/bin/python -m ruff check src tests scripts`; `.venv/bin/python -m ruff format --check src tests scripts` | exit 0 |
| Package | archive של commit→`python -m build --no-isolation`→venv חדש→`pip install --no-index --no-deps <wheel>` | מודולים/SQL/data כלולים; CLI מותקן בודק את הפלט החדש; לא פלט ישן |
| Expo JS | `npx --no-install expo export --platform ios --platform android --output-dir <fresh-owned-dir>` | export בלבד; אינו ראיית native build |
| Android | ב־mobile/android: `./gradlew :biteflow-widgets:testDebugUnitTest :biteflow-health:testDebugUnitTest :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain` | suites ובניות עוברים; חתימת production נבדקת בנפרד |
| Android full lint | `./gradlew :app:lintDebug :biteflow-widgets:lintDebug :biteflow-health:lintDebug --console=plain` | ללא החרגות ניתוח תלויות וללא analyzer crash |
| iOS | אותו workspace/scheme הקיים `ios/Biteflow.xcworkspace` / `Biteflow`; xcodebuild Debug/Release simulator, ולאחר A4 archive חתום למכשיר | build מלא + extension; swiftc policy checks לבדם אינם מספיקים |
| Model smoke | לאחר הרשאת הרצה אמיתית מתאימה: tests/test_lite_classifier.py עם `FOODLOGGER_RUN_LITE_TESTS=1`; tests/test_ml_integration.py עם `FOODLOGGER_RUN_ML_TESTS=1` | 3 המקרים שדולגו מופעלים בסביבה/weights מורשים; אין ספק חיצוני. רכיב שלא נכלל בהפצה מסומן לא רלוונטי רק אחרי החלטת היקף וראיה שאינו בחבילה |
| Dependency/security | audit npm, audit של סביבת Python/תמונת הפצה נקייה, סריקת source/history וסקירת log/export | אין שימוש חוזר ב־67 היסטוריות או ב־0 של סביבת מפתח כראיית הפצה |
| Physical E2E | מטריצה מתועדת עם המועמד החתום ונתוני בדיקה | תוצאות מכשיר אמיתיות, לא mock/simulator בלבד |

ה־Python המשותף אינו בהכרח כולל pip; בונים סביבת התקנה חדשה ומסירים `PYTHONPATH` כדי שלא תיטען חבילת המקור בטעות. raw logs נשמרים כמות שהם, עם סודות מצונזרים; whitespace של פלט גולמי אינו ממצא מוצר ואינו סיבה לדרוס ראיות.

## כיסוי כל הפערים והקבלה

| פער / קבוצת דרישות | משימות אחראיות | ראיה שמאפשרת סגירה |
|---|---|---|
| iOS compiler/import, Android Worklets lint, dependencies, speech patch | RC01–02 | build נקי, lint ללא החרגות, audit ותאימות guard |
| F01 עריכה, goals/history/DayDial; F04/F05/F08 repeat/recipes/copy | RC03–04, RC18 | E2E-04–07; snapshot/version/retry/DST; 0 AI ב־repeat |
| F02/F03/F19 trends/weight/water ושרשרת invalidation | RC04, RC13–14, RC18 | E2E-10–12: 250+500−250=500; 70/69.5 עם gap; 3 ימים מתוך 7 אינם 7 ימים של נתונים |
| F06/F07 טקסט וקול, הרשאות/locale/פרטיות | RC10, RC12, RC18 | E2E-02–03/18/20 על מכשיר, תיקון תמלול ו־manual fallback |
| F09–F11 מקורות/מנות/OCR/provenance | RC03, RC07–RC11, RC18 | E2E-08–09, מקור חוקי, label אמיתי, תיקון פרטי, kcal/kJ/100/serving ללא ערכים מומצאים |
| F12/F13 insights/recommendations והגבלות | RC06–07, RC09, RC18 | E2E-12–14: אותן סטטיסטיקות, 500kcal/40g שנותרו, allergen סינון, unknown אינו none, אישור לפני שמירה |
| F14 מכסות/עלות/תנאים, תוצאות AI שאבדו | RC06, RC09, RC11, RC17 | account evidence, 100 concurrent mocks, fallback/429, accounting אמיתי לניסוי מאושר |
| F15 notification/streak/leases/reinstall/legacy offline clients | RC15, RC18–19 | E2E-15/18/19, delivery ו־stop/drain; אי־ידיעה נשארת מפורשת |
| F16/F17 ownership/dedup/delete/cursors/30-day/ledger loss | RC13, RC18–19 | E2E-16/19, נתוני בדיקה במכשיר, אין third-party delete או UUID resurrection |
| F18 widget/App Group/OS pixels/lock/refresh/DST/storage loss | RC14, RC18–19 | E2E-17/19/20 על signed device; אפס זליגת משתמש קודם בתרחישים המאושרים |
| F20 איכות תמונות, held-out, portions/calibration/cost | RC09–RC11, RC18 | E2E-01/14, dataset עצמאי ודו״ח השוואה אמיתי |
| Hosted CI, RLS/auth, migration/legacy/quarantine, backup/restore/new writes/deletion | RC16, RC18–19 | E2E-18/19, restricted roles, עותק staging ותוכנית affected owners ללא מידע מומצא |
| Export/retention/large account/audio/photos/provider copies/backups | RC05, RC07, RC12–RC14, RC19 | policy + synthetic tests + מכשיר/OS, תמיכה ואי־הבטחת recall |
| P13 rollback caveats יחד עם P06 label/P07 pending/P09 leases/P10–11 receipts/P12 bridges | RC03–RC05, RC13–RC16, RC19 | reader תואם, stop/drain וניקוי בפועל; אין P12 downgrade או מחיקת receipts |
| Exact10%, Hebrew confidence/servings, resume refresh, native warnings, bounded histories | RC06, RC18 | בדיקות גבול/localization ומגבלות מאושרות; חומרה נדחית נשמרת |
| P14 owners/cohort/retention/telemetry/baseline/real feedback | RC00, RC07, RC17, RC20–21 | policy ובדיקות סינתטיות לפני שחרור; תצפיות אמיתיות רק אחריו |

## תנאי החלטה, דיווח ועצירה

אחרי כל משימה: commit/source, קבצים וחוזים שהשתנו, migration אם קיים, בדיקות ומספרים בפועל, review/fixes, סביבה/מכשיר, חסמים שנשארו, rollback והמשימה הבאה שהתלויות שלה התקיימו. שומרים ממצא חדש באותה מטריצה ולא מעבירים אותו בשתיקה ל״אחרי השחרור״.

כשל פרטיות/בעלות/שלמות נתונים או P0/P1 עוצר את המסלול התלוי בו. אפשר להמשיך עבודה עצמאית שאושרה; מחסור במכשיר או חשבון לא מתורגם ל־PASS. מגבלה בלתי הפיכה, כגון בקשת עבר שאין לה עוד זהות או עותק שכבר נמסר החוצה, מקבלת טיפול מוצר/תפעול מפורש וראיות — לא ״תיקון״ מומצא.

**בדיקת התוכנית:** נבדקו כל F01–F20, כל E2E-01–20, gate-register המורש, caveats של P13/P14 וגבולות הרשאה. זו סקירה עצמית של תוכנית, לא code review חדש ולא ריצת בדיקות. אישור לתוכנית אינו אישור לרדת מכללי הבטיחות או לפתוח AI/production. מימוש עדיין לא התחיל.

**התחלה מוצעת לאישור:** RC00, אחריו גל מקומי ממוקד RC01–RC05; במקביל הכנת RC07–RC10 וגישות בלי שינוי חיצוני. את RC06 אפשר לשבץ אחרי תיקוני שלמות/פרטיות. שערי A3–A7 יאושרו רק כשהפעולות והארטיפקטים הרלוונטיים יהיו קונקרטיים וניתנים לבדיקה.
