package expo.modules.biteflowwidgets

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal object WidgetPolicy {
 const val ttl=900000L
 private val numeric=setOf("calories","calorie_known","calorie_target","calorie_remaining","protein","protein_known","protein_target","water","water_target")
 private val keys=numeric+setOf("version","date","timezone","updated_at","expires_at","language","state","calorie_status","protein_status","partial","logged")
 private val statuses=setOf("unknown","no_goal","unlogged","partial","below_range","above_range","in_range","met","below_target")
 fun validSession(s:String)=s.matches(Regex("[a-fA-F0-9-]{36}"))
 fun parse(raw:String,now:Long):JSONObject?=try {
  require(raw.toByteArray().size<=8192)
  val d=JSONObject(raw);require(d.keys().asSequence().toSet()==keys && d.get("version") is Number && d.getDouble("version")==1.0)
  require(d.getString("language") in setOf("en","he") && d.getString("state") in setOf("ready","unavailable"))
  require(d.get("partial") is Boolean && d.get("logged") is Boolean)
  require(d.getString("calorie_status") in statuses && d.getString("protein_status") in statuses)
  for(k in setOf("updated_at","expires_at")){require(d.get(k) is Number);val n=d.getDouble(k);require(n.isFinite() && n>=0 && n<=9007199254740991.0 && n%1.0==0.0)}
  val updated=d.getLong("updated_at");val expires=d.getLong("expires_at")
  require(updated<=now+1000 && expires>now && expires>updated && expires<=updated+ttl)
  val zone=d.getString("timezone");require(zone in TimeZone.getAvailableIDs())
  val f=SimpleDateFormat("yyyy-MM-dd",Locale.US);f.timeZone=TimeZone.getTimeZone(zone)
  require(d.getString("date")==f.format(Date(now)) && d.getString("date")==f.format(Date(updated)))
  for(k in numeric)if(!d.isNull(k)){
   require(d.get(k) is Number);val n=d.getDouble(k)
   require(n.isFinite() && kotlin.math.abs(n)<=100000000 && (k=="calorie_remaining"||n>=0) && d.getString("state")=="ready")
  }
  if(d.getString("state")=="ready")require(!d.isNull("calorie_known")&&!d.isNull("protein_known"))
  if(d.isNull("calories")||d.isNull("calorie_target"))require(d.isNull("calorie_remaining"))
  d
 }catch(_:Exception){null}
 fun lines(d:JSONObject?,now:Long):List<String>{
  val he=d?.optString("language")=="he"
  if(d==null||d.optString("state")!="ready")return listOf("BiteFlow",if(he)"פתחו לרענון היום" else "Open to refresh Today","","","","")
  fun n(k:String)=if(d.isNull(k))"—" else String.format(Locale.US,"%.0f",d.getDouble(k))
  val energy=if(!d.getBoolean("logged")){if(he)"לא נרשמו ארוחות" else "No meals logged"}else if(d.isNull("calories")){if(he)"חלקי: לפחות ${n("calorie_known")} קק״ל" else "Partial: at least ${n("calorie_known")} kcal"}else "${n("calories")} "+if(he)"קק״ל" else "kcal"
  val protein=if(d.isNull("protein")){if(he)"חלבון חלקי: לפחות ${n("protein_known")} ג׳" else "Partial protein: at least ${n("protein_known")} g"}else (if(he)"חלבון " else "Protein ")+n("protein")+(if(d.isNull("protein_target"))" g" else " / ${n("protein_target")} g")
  val detail=when(d.getString("calorie_status")){"unknown"->if(he)"היעד לא זמין" else "Goal unavailable";"no_goal"->if(he)"ללא יעד קלורי" else "No calorie goal";"partial"->if(he)"הנותר לא ידוע" else "Remaining unknown";"unlogged"->if(he)"טרם נרשמו ארוחות" else "No meals logged";else->(if(he)"נותרו " else "Remaining ")+n("calorie_remaining")+" kcal · "+when(d.getString("calorie_status")){"in_range"->if(he)"בטווח" else "in range";"above_range"->if(he)"מעל הטווח" else "above range";else->if(he)"מתחת לטווח" else "below range"}}
  val water=(if(he)"מים " else "Water ")+n("water")+(if(d.isNull("water_target"))" ml" else " / ${n("water_target")} ml")
  val f=SimpleDateFormat("HH:mm",Locale.US);f.timeZone=TimeZone.getTimeZone(d.getString("timezone"))
  return listOf("BiteFlow · "+d.getString("date"),energy,protein,detail,water,(if(he)"עודכן " else "Updated ")+f.format(Date(d.getLong("updated_at"))))
 }
}
internal interface WidgetFiles {fun read():String?;fun write(value:String);fun remove()}
internal class WidgetStore(private val files:WidgetFiles,private val now:()->Long=System::currentTimeMillis){
 private var session:String?=null;private var sequence=0L
 @Synchronized fun bind(value:String){require(WidgetPolicy.validSession(value));clear();session=value}
 @Synchronized fun clear(){session=null;sequence=0;files.remove()}
 @Synchronized fun publish(value:String,revision:Long,raw:String):Boolean{
  if(session!=value||revision<=sequence)return false
  val data=WidgetPolicy.parse(raw,now())?:throw IllegalArgumentException("Invalid widget snapshot")
  files.write(JSONObject().put("session",value).put("sequence",revision).put("snapshot",data).toString());sequence=revision;return true
 }
 @Synchronized fun read():JSONObject?=try{val raw=files.read();require(raw!=null&&raw.toByteArray().size<=10000);val value=JSONObject(raw);require(value.keys().asSequence().toSet()==setOf("session","sequence","snapshot")&&WidgetPolicy.validSession(value.getString("session"))&&value.getLong("sequence")>0);WidgetPolicy.parse(value.getJSONObject("snapshot").toString(),now())}catch(_:Exception){null}
}
