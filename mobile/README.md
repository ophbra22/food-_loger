<div dir="rtl">

# FoodLogger לנייד (Android ו־iPhone)

אפליקציית React Native (Expo SDK 57, TypeScript) שמתחברת לשרת ה־FastAPI הקיים של FoodLogger.
האתר והנתונים הקיימים לא השתנו; האפליקציה משתמשת באותם חשבונות ובאותו יומן.

> מצב נוכחי: שכבת היסוד מוכנה ונבדקה (חיבור לשרת, כניסה מאובטחת, תרגום עברית/אנגלית,
> כיוון RTL/LTR, טיוטות, מטמון, בדיקות יחידה). מסכי האפליקציה ייבנו לאחר בחירת כיוון העיצוב.

## מה צריך להתקין

| כלי | למה | הערה |
|---|---|---|
| Node.js 20 ומעלה | הרצת Expo | נבדק עם Node 26 |
| Xcode | בנייה ל־iPhone ולסימולטור | Mac בלבד. נבדק עם Xcode 27 |
| Android Studio | בנייה לאנדרואיד ואמולטור | כולל את ה־JDK הנדרש |
| Python 3.11 או 3.12 | הרצת השרת מקומית | כמו בפרויקט המקורי |

## 1. הפעלת השרת

מתיקיית השורש של המאגר:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
foodlogger
```

לבדיקה מטלפון אמיתי באותה רשת Wi‑Fi יש להאזין בכל הכתובות:

```bash
foodlogger --host 0.0.0.0
```

## 2. כתובת השרת באפליקציה

מעתיקים את `.env.example` ל־`.env` בתיקיית `mobile` וקובעים את `EXPO_PUBLIC_API_URL`:

| היכן רצה האפליקציה | הכתובת |
|---|---|
| סימולטור iOS באותו Mac | `http://localhost:8000` |
| אמולטור Android | `http://10.0.2.2:8000` |
| טלפון אמיתי באותה רשת | `http://<כתובת ה־IP של המחשב>:8000` |
| השרת שפורסם ב־Render | `https://<שם השירות>.onrender.com` |

חשוב: בטלפון, `localhost` הוא הטלפון עצמו ולא המחשב. את כתובת ה־IP של המחשב ב־Mac אפשר לקבל כך:

```bash
ipconfig getifaddr en0
```

הכתובת נצרבת באפליקציה בזמן הבנייה. בקובץ הזה יש רק כתובת; אין לשים בו סיסמאות, מפתחות או כתובת של מסד נתונים.
בגרסאות בדיקה (`development`, `preview`) אפשר להחליף שרת גם מתוך מסך ההגדרות.
כשלא הוגדר דבר, גרסת פיתוח פונה אוטומטית למחשב המקומי (`localhost` ב־iOS, `10.0.2.2` באנדרואיד).

## 3. הרצה בסימולטור ובאמולטור

```bash
cd mobile
npm install
```

iPhone (סימולטור):

```bash
npm run ios
```

Android (אמולטור פתוח או מכשיר מחובר ב־USB):

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run android
```

הפקודות בונות "גרסת פיתוח" (development build) ומתקינות אותה. לאחר ההתקנה הראשונה מספיק להריץ:

```bash
npm start
```

אם `pod install` נכשל עם שגיאת `Unicode Normalization`, יש להריץ קודם `export LANG=en_US.UTF-8`.

### למה לא Expo Go

Expo Go מתאים להצצה ראשונה בלבד (`npm run start:go`). הוא מאפס את כיוון הקריאה בכל פתיחה,
ולכן החלפת עברית/אנגלית והמצלמה נבדקות רק בגרסת פיתוח או בגרסה מותקנת.

## 4. בדיקות

```bash
npm test
npm run typecheck
npm run lint
```

בדיקות השרת, מתיקיית השורש:

```bash
pytest
```

## 5. קובץ APK לאנדרואיד

בנייה מקומית (ללא חשבון):

```bash
cd mobile
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

או בענן של Expo (דורש חשבון Expo חינמי, ללא תשלום במכסה החינמית):

```bash
npx eas-cli@latest build --profile preview --platform android
```

## 6. iPhone אמיתי

| דרך | מה נדרש | עלות |
|---|---|---|
| בנייה מקומית ב־Xcode עם Apple ID רגיל | כבל, Mac, Apple ID | חינם. האפליקציה פגה אחרי 7 ימים וצריך להתקין מחדש |
| EAS Build + התקנה פנימית / TestFlight | חברות ב־Apple Developer Program | 99 דולר לשנה ל־Apple |

בנייה מקומית:

```bash
cd mobile
npx expo run:ios --device
```

בפעם הראשונה פותחים את `ios/FoodLogger.xcworkspace` ב־Xcode, בוחרים Team תחת Signing & Capabilities,
ומאשרים את המפתח בטלפון תחת Settings ← General ← VPN & Device Management.

דבר לא מתפרסם בחנויות ואף שירות בתשלום לא מופעל בלי אישור מפורש.

## מבנה הקוד

```text
mobile/
  app.config.ts        הגדרות האפליקציה, הרשאות ותוספים
  eas.json             פרופילי בנייה: development, preview, production
  .env.example         דוגמה לכתובת השרת
  src/
    app/               מסכים (Expo Router)
    api/               תקשורת עם השרת, סוגי נתונים, מיפוי שגיאות להודעות
    auth/              חיבור לחשבון ושמירת האסימון ב־Keychain / Keystore
    data/              יומן, טיוטות ושמירה ללא כפילויות
    domain/            לוגיקה עסקית: ולידציה, חישובי מנות, תאריכים
    i18n/              תרגומים (locales/en.ts, locales/he.ts), עיצוב מספרים ותאריכים, כיוון
    storage/           אחסון מקומי מופרד לפי חשבון
```

## אבטחה ונתונים

- האפליקציה נכנסת כ"לקוח נייד": השרת מחזיר אסימון חיבור אטום במקום עוגייה, והוא נשמר ב־Keychain (iOS) או ב־Keystore (Android).
- האתר ממשיך לעבוד בדיוק כמו קודם, עם עוגיית HttpOnly והגנת CSRF.
- כל שמירת ארוחה נשלחת עם מפתח ייחודי (`Idempotency-Key`), כך שניסיון חוזר אחרי תקלה ברשת לא יוצר ארוחה כפולה.
- טיוטה נשמרת בטלפון עד שהשרת מאשר את השמירה. טיוטות ומטמון מופרדים לפי חשבון ונמחקים ביציאה מהחשבון.
- ערך תזונתי חסר נשאר חסר ואינו מוצג כאפס.

</div>
