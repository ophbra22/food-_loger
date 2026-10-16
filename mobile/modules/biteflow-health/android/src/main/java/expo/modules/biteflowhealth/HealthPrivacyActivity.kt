package expo.modules.biteflowhealth

import android.app.Activity
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView

/** Local, network-free permission rationale. Store policy/URL approval remains a release gate. */
class HealthPrivacyActivity:Activity() {
  override fun onCreate(savedInstanceState:Bundle?) {
    super.onCreate(savedInstanceState)
    val he=resources.configuration.locales[0].language=="he"
    val text=if(he) "BiteFlow · פרטיות Health Connect\n\nהחיבור אופציונלי. לפי בחירתכם, נייבא משקל ודגימות צעדים ליומן הפרטי בחשבון המחובר, ונכתוב תזונה שאישרתם ומים ל-Health Connect. אין קריאת תזונה ואין סנכרון ברקע.\n\nאפשר לבטל הרשאות בכל עת ב-Health Connect. ניתוק אינו מוחק דגימות קיימות. מחיקת החשבון מוחקת את העותק בשרת; נתונים ב-Health Connect מנוהלים בנפרד.\n\nהנתונים משמשים ליומן ולמגמות, לא לפרסום. מוצא הנתונים והזמן נשמרים. הייבוא הראשוני מוגבל ל-30 ימים. אין כאן מדידה רפואית או אימות ערכי תזונה."
      else "BiteFlow · Health Connect privacy\n\nConnection is optional. With your selected permissions, BiteFlow imports weight and raw step samples into your signed-in private journal, and writes your confirmed nutrition and water to Health Connect. It does not read nutrition or sync in the background.\n\nRevoke permissions at any time in Health Connect. Disconnect retains existing samples. Account deletion erases the server copy; Health Connect data is managed separately.\n\nData supports your journal and trends, not advertising. Source and timestamps are retained. Initial import covers 30 days. This is not a medical measurement or verification of nutrition values."
    val label=TextView(this).apply {this.text=text;textSize=18f;setPadding(32,48,32,48)}
    setContentView(ScrollView(this).apply {addView(label)})
  }
}
