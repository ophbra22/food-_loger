package expo.modules.biteflowhealth

import androidx.annotation.RequiresApi

import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.*
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject

internal object HealthPolicy {
  val permissions = mapOf(
    "nutrition" to HealthPermission.getWritePermission(NutritionRecord::class),
    "water" to HealthPermission.getWritePermission(HydrationRecord::class),
    "weight" to HealthPermission.getReadPermission(WeightRecord::class),
    "steps" to HealthPermission.getReadPermission(StepsRecord::class)
  )
  fun writePermission(kind: String) = permissions[if(kind == "water") "water" else "nutrition"]!!
  fun identity(scope: String, item: JSONObject): String {
    require(scope.matches(Regex("[a-f0-9]{32}")) && item.getString("id").matches(Regex("[a-f0-9]{32}")))
    require(item.getLong("revision") in 1..9007199254740991L)
    require(item.getString("kind") in setOf("calories","protein","carbs","fat","water"))
    return "biteflow:$scope:${item.getString("id") }"
  }
  @RequiresApi(26)
  fun record(scope: String, item: JSONObject): Record {
    val id=identity(scope,item); val kind=item.getString("kind")
    require(!item.getBoolean("deleted") && !item.isNull("value"))
    val value=item.getDouble("value");require(value.isFinite() && value >= 0)
    require(item.getString("unit") == if(kind=="water") "ml" else if(kind=="calories") "kcal" else "g")
    val start=Instant.parse(item.getString("start"));require(item.getString("start")==item.getString("end"))
    val zone=ZoneId.of(item.getString("timezone_id"));val offset=zone.rules.getOffset(start)
    require(start.atZone(zone).toLocalDate().toString()==item.getString("local_date"))
    val end=start.plusMillis(1)
    val metadata=Metadata.manualEntry(clientRecordId=id,clientRecordVersion=item.getLong("revision"))
    return if(kind=="water") HydrationRecord(start,offset,end,zone.rules.getOffset(end),Volume.milliliters(value),metadata)
    else NutritionRecord(startTime=start,startZoneOffset=offset,endTime=end,endZoneOffset=zone.rules.getOffset(end),metadata=metadata,
      energy=if(kind=="calories") Energy.kilocalories(value) else null,
      protein=if(kind=="protein") Mass.grams(value) else null,
      totalCarbohydrate=if(kind=="carbs") Mass.grams(value) else null,
      totalFat=if(kind=="fat") Mass.grams(value) else null,
      name="BiteFlow · user-confirmed, unverified")
  }
}
internal class SessionGate {
  private val bound=AtomicReference<Pair<String,String>?>(null)
  fun bind(session:String,scope:String) {bound.set(session to scope)}
  fun stop(session:String) {val old=bound.get();if(old?.first==session)bound.compareAndSet(old,null)}
  fun check(session:String,scope:String) {check(bound.get()==session to scope) {"Health session ended"}}
}
internal interface RevisionLedger {fun revision(id:String):Long;fun save(id:String,revision:Long)}
internal data class SnapshotPage(val events:List<Map<String,Any?>>,val next:String?)
internal data class ChangePage(val events:List<Map<String,Any?>>,val next:String,val more:Boolean,val expired:Boolean)
internal data class ImportPage(val events:List<Map<String,Any?>>,val nextCursor:String,val hasMore:Boolean,val recovered:Boolean=false) {
  fun bridge()=mapOf("events" to events,"nextCursor" to nextCursor,"hasMore" to hasMore,"recovered" to recovered)
}
internal interface HealthGateway {
  suspend fun permissions():Set<String>
  suspend fun insert(record:Record)
  suspend fun delete(kind:String,id:String)
  suspend fun token(kind:String):String
  suspend fun snapshot(kind:String,from:String,to:String,page:String?):SnapshotPage
  suspend fun changes(kind:String,token:String):ChangePage
}
internal data class ApplyResult(val applied:List<String>,val failed:List<String>) {
  fun bridge()=mapOf("applied" to applied,"failed" to failed)
}
internal class HealthEngine(private val gateway:HealthGateway,private val ledger:RevisionLedger,private val gate:SessionGate) {
  private val mutex=Mutex()
  @RequiresApi(26)
  suspend fun apply(session:String,scope:String,items:List<JSONObject>)=mutex.withLock {
    require(items.size<=50)
    val applied=mutableListOf<String>();val failed=mutableListOf<String>()
    for(item in items) {
      gate.check(session,scope)
      val id=HealthPolicy.identity(scope,item);val revision=item.getLong("revision");val kind=item.getString("kind")
      val sampleId=item.getString("id")
      if(ledger.revision(id)>=revision){applied.add(sampleId);continue}
      try {
        if(HealthPolicy.writePermission(kind) !in gateway.permissions())throw SecurityException("Health write permission denied")
        gate.check(session,scope)
        if(item.getBoolean("deleted"))gateway.delete(kind,id) else gateway.insert(HealthPolicy.record(scope,item))
        gate.check(session,scope);ledger.save(id,revision);applied.add(sampleId)
      }catch(e:CancellationException){throw e}
      catch(e:Exception){gate.check(session,scope);failed.add(sampleId)}
    }
    ApplyResult(applied,failed)
  }
}

internal class HealthReader(private val gateway:HealthGateway,private val gate:SessionGate) {
  @RequiresApi(26)
  suspend fun page(session:String,scope:String,kind:String,cursor:String?,from:String,to:String):ImportPage {
    require(kind in setOf("weight","steps"));gate.check(session,scope)
    if(HealthPolicy.permissions[kind] !in gateway.permissions())throw SecurityException("Health read permission denied")
    gate.check(session,scope)
    var recovered=false
    var state=cursor?.let {require(it.length<=32768);JSONObject(it)}
    if(state!=null) {
      require(state.getString("kind")==kind)
      require(state.getString("stage") in setOf("changes","snapshot"))
      if(state.getString("stage")=="changes") {
        val changes=gateway.changes(kind,state.getString("token"));gate.check(session,scope)
        if(!changes.expired) {
          require(changes.events.size<=1000)
          return ImportPage(changes.events,JSONObject().put("stage","changes").put("kind",kind).put("token",changes.next).toString(),changes.more)
        }
        state=null;recovered=true
      }
    }
    if(state==null) {
      require(Instant.parse(from)<Instant.parse(to))
      val token=gateway.token(kind);gate.check(session,scope)
      state=JSONObject().put("stage","snapshot").put("kind",kind).put("token",token).put("from",from).put("to",to)
    }
    val result=gateway.snapshot(kind,state.getString("from"),state.getString("to"),if(state.isNull("page"))null else state.getString("page"));gate.check(session,scope)
    require(result.events.size<=100)
    if(result.next!=null)state.put("page",result.next)
    else state=JSONObject().put("stage","changes").put("kind",kind).put("token",state.getString("token"))
    return ImportPage(result.events,state.toString(),true,recovered)
  }
}
